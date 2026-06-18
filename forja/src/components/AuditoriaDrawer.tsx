import React, { useState, useEffect } from 'react';
import { Drawer, Button, Spin, Empty, App as AntApp, Tag, Popover, Alert, Divider } from 'antd';
import {
  Wand2, RefreshCw, CheckCircle2, XCircle, Sparkles, FileSearch, Info, Database, Download, Clock, History,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, SaudeBreakdown, AuditResult, UltimaAuditoriaInfo } from '../types';
import FindingCard from './FindingCard';

interface AuditoriaDrawerProps {
  sistemaId: string;
  sistemaNome: string;
  open: boolean;
  onClose: () => void;
  onSaudeRecalculada?: (novoScore: number) => void;
  onAuditoriaAtualizada?: () => void;
}

// "há 2h", "há 3 dias", "agora" — pequeno helper humanizado
function relTempo(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export default function AuditoriaDrawer({ sistemaId, sistemaNome, open, onClose, onSaudeRecalculada, onAuditoriaAtualizada }: AuditoriaDrawerProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [loadingUltima, setLoadingUltima] = useState(false);
  const [resultado, setResultado] = useState<AuditResult | null>(null);
  const [ultima, setUltima] = useState<UltimaAuditoriaInfo | null>(null);
  const [verificouUltima, setVerificouUltima] = useState(false);

  const auditar = async () => {
    setLoading(true);
    try {
      const r = await callServer<ServerResult>('acaoIAAuditarSistema', sistemaId);
      if (r.ok && r.data) {
        const novo = r.data as AuditResult;
        setResultado(novo);
        setUltima(null); // a "ultima" agora é a recém-rodada
        if (onAuditoriaAtualizada) onAuditoriaAtualizada();
      } else {
        message.error(r.error || 'Erro ao auditar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  // Ao abrir, primeiro tenta carregar a última auditoria salva. Só roda nova se
  // o usuário pedir explicitamente. Economiza tokens e respeita o tempo do user.
  useEffect(() => {
    if (!open) return;
    if (resultado || ultima || verificouUltima) return;
    setLoadingUltima(true);
    callServer<ServerResult>('getUltimaAuditoria', sistemaId)
      .then((r) => {
        setVerificouUltima(true);
        if (r.ok && r.data) {
          setUltima(r.data as UltimaAuditoriaInfo);
        }
      })
      .catch(() => { /* preview local sem servidor */ })
      .finally(() => setLoadingUltima(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Quando o drawer fecha, esquecemos o estado pra próxima abertura recarregar
  useEffect(() => {
    if (!open) {
      setResultado(null);
      setUltima(null);
      setVerificouUltima(false);
    }
  }, [open]);

  // Adapta UltimaAuditoriaInfo (sem texto livre) pra formato AuditResult
  const ultimaComoResultado: AuditResult | null = ultima ? {
    id: ultima.id,
    texto: ultima.texto || '',
    payload: ultima.payload,
    fontes: ultima.fontes || { custos: 0, decisoes: 0, riscos: 0, alertas: 0, timeline: 0, oportunidades: 0, temProposito: false, temStack: false, temUrl: false, temRepo: false },
    saudeAtual: ultima.saudeAtual,
    modeloUsado: ultima.modeloUsado,
    duracaoMs: ultima.duracaoMs,
    criadoEm: ultima.criadoEm,
    registros: ultima.registros || {},
  } : null;

  const dadosExibidos = resultado || ultimaComoResultado;
  const auditoriaIdAtual = dadosExibidos?.id || '';
  const registrosAtuais = dadosExibidos?.registros || {};

  const recalcularSaude = async () => {
    try {
      const r = await callServer<ServerResult>('atualizarSaudeReal', sistemaId);
      if (r.ok && r.data) {
        const d = r.data as SaudeBreakdown;
        setResultado((cur) => cur ? { ...cur, saudeAtual: d } : cur);
        if (onSaudeRecalculada) onSaudeRecalculada(d.score);
        message.success(`Saúde atualizada: ${d.score === 0 ? 'não avaliado' : d.score + '%'}`);
      }
    } catch { /* segue */ }
  };

  // Quando o usuário registra um achado, atualizamos o estado local pra
  // o card já refletir o "Já registrado" sem precisar refetch.
  const aoRegistrar = (info: { findingId: string; tipo: string; idCriado: string }) => {
    const novoRegistro = { tipo: info.tipo.replace('registrar_', ''), idCriado: info.idCriado, registradoEm: new Date().toISOString() };
    if (resultado) {
      setResultado({ ...resultado, registros: { ...(resultado.registros || {}), [info.findingId]: novoRegistro } });
    } else if (ultima) {
      setUltima({ ...ultima, registros: { ...(ultima.registros || {}), [info.findingId]: novoRegistro } });
    }
    void recalcularSaude();
  };

  const reset = () => { setResultado(null); };

  const baixarRelatorioCompleto = () => {
    if (!dadosExibidos || !dadosExibidos.payload) return;
    const p = dadosExibidos.payload;
    const linhas: string[] = [];
    linhas.push(`# Auditoria — ${sistemaNome}`);
    linhas.push(`\n_Gerada pela Forja IA · ${new Date().toLocaleString('pt-BR')}_\n`);
    linhas.push('\n## Estado geral\n\n' + p.estadoGeral);
    if (p.oQueEmpolga.length > 0) {
      linhas.push('\n## O que empolga\n');
      for (const b of p.oQueEmpolga) linhas.push('- ' + b);
    }
    linhas.push('\n## Próximos passos estratégicos\n\n' + p.proximosPassos);
    linhas.push('\n## Achados detalhados\n');
    for (const f of p.findings) {
      linhas.push(`\n### [${f.severidade.toUpperCase()}] ${f.titulo}`);
      linhas.push(`_Área: ${f.area}_\n`);
      linhas.push(`**Problema:** ${f.problema}\n`);
      linhas.push(`**Evidência:** ${f.evidencia}\n`);
      linhas.push(`**Solução:** ${f.solucao}\n`);
      if (f.prompt) linhas.push('\n**Prompt pronto:**\n\n```\n' + f.prompt + '\n```\n');
    }
    downloadFile(`auditoria-${slugify(sistemaNome)}-${new Date().toISOString().slice(0, 10)}.md`, linhas.join('\n'), 'text/markdown');
    message.success('Auditoria completa baixada como .md');
  };

  const comoFuncionaPopover = (
    <div style={{ maxWidth: 380, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px' }}><strong>Como a Forja IA audita seu sistema:</strong></p>
      <ol style={{ paddingLeft: 18, margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <li>Lê todos os dados deste sistema (custos, decisões, riscos, alertas, timeline, metadados).</li>
        <li>Identifica problemas concretos — só com evidência verificável.</li>
        <li>Pra cada problema, escreve: <em>problema, evidência, solução, e um prompt</em> pronto pra colar no Cursor/Claude.</li>
        <li>Sugere uma ação (Risco/Decisão/Oportunidade) que você aprova individualmente.</li>
      </ol>
      <p style={{ margin: 0, color: t.textTertiary, fontSize: 12 }}>
        Tag <strong style={{ color: t.accents.sage }}>verificada</strong> = dado direto. Tag <strong style={{ color: t.accents.peach }}>inferência</strong> = a IA deduziu — avalie com cuidado.
      </p>
    </div>
  );

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wand2 size={18} color={t.accents.peach} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Auditoria Forja IA</span>
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>{sistemaNome}</Tag>
          <Popover content={comoFuncionaPopover} title={null} trigger="click" placement="bottomLeft">
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 12 }}>
              <Info size={13} /> como funciona?
            </button>
          </Popover>
        </div>
      }
      open={open}
      onClose={onClose}
      width={720}
      extra={
        dadosExibidos && (
          <div style={{ display: 'flex', gap: 6 }}>
            {dadosExibidos.payload && <Button icon={<Download size={14} />} onClick={baixarRelatorioCompleto}>Baixar .md</Button>}
            <Button icon={<RefreshCw size={14} />} onClick={() => { reset(); void auditar(); }} loading={loading}>
              {resultado ? 'Rodar de novo' : 'Nova auditoria'}
            </Button>
          </div>
        )
      }
    >
      {/* Estado: carregando última auditoria */}
      {loadingUltima && !ultima && !resultado && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <Spin size="small" />
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>Procurando auditoria anterior…</span>
        </div>
      )}

      {/* Estado: rodando nova auditoria */}
      {loading && !resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
          <Spin size="large" />
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, textAlign: 'center', maxWidth: 360 }}>
            A Forja IA está lendo o contexto deste sistema (custos, decisões, riscos, alertas, timeline) e montando uma análise crítica…
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textAlign: 'center', maxWidth: 360 }}>
            Modelos rápidos (ex.: claude-3-5-haiku) levam ~5-10s · modelos premium (Sonnet/Opus) levam 15-40s.
          </div>
        </div>
      )}

      {/* Estado: nunca foi auditado */}
      {!loadingUltima && !loading && !dadosExibidos && verificouUltima && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.accents.peach}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={28} color={t.accents.peach} />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, color: t.text, marginBottom: 6, fontWeight: 500 }}>Primeira auditoria deste sistema</div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
              A Forja IA vai ler tudo que sabe sobre este sistema e propor achados estruturados com problema, evidência, solução e prompt pronto.
            </div>
          </div>
          <Button type="primary" size="large" icon={<Wand2 size={15} />} onClick={auditar} loading={loading} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
            Auditar agora
          </Button>
        </div>
      )}

      {/* Banner de "última auditoria" quando estamos exibindo a salva (não a recém-rodada) */}
      {!resultado && ultima && (
        <Alert
          type="info"
          showIcon
          icon={<History size={16} color={t.accents.blue} />}
          style={{ marginBottom: 18, background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
          message={
            <span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>
              <strong>Última auditoria {relTempo(ultima.criadoEm)}</strong>
              {ultima.modeloUsado && <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 11, marginLeft: 8 }}>{ultima.modeloUsado}</span>}
              {ultima.duracaoMs > 0 && <span style={{ color: t.textTertiary, fontSize: 11, marginLeft: 8 }}><Clock size={10} style={{ verticalAlign: 'text-top' }} /> {(ultima.duracaoMs / 1000).toFixed(1)}s</span>}
              {ultima.totalAuditorias > 1 && <span style={{ color: t.textTertiary, fontSize: 11, marginLeft: 8 }}>· {ultima.totalAuditorias} no histórico</span>}
            </span>
          }
          description={
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              Você está vendo o resultado salvo. Quer pedir uma nova análise? Clique em <strong>Nova auditoria</strong> no canto superior direito.
            </span>
          }
        />
      )}

      {/* Banner da auditoria recém-rodada — destaca o tempo e modelo */}
      {resultado && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 18 }}
          message={
            <span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>
              <strong>Auditoria concluída</strong>
              {resultado.duracaoMs && <span style={{ color: t.textTertiary, fontSize: 11, marginLeft: 8 }}><Clock size={10} style={{ verticalAlign: 'text-top' }} /> {(resultado.duracaoMs / 1000).toFixed(1)}s</span>}
              {resultado.modeloUsado && <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 11, marginLeft: 8 }}>{resultado.modeloUsado}</span>}
            </span>
          }
        />
      )}

      {dadosExibidos && dadosExibidos.payload && (
        <>
          {/* Fontes consultadas (rastreabilidade) */}
          <FontesBlock fontes={dadosExibidos.fontes} modelo={dadosExibidos.modeloUsado} />

          {/* Estado geral */}
          {dadosExibidos.payload.estadoGeral && (
            <Section titulo="Estado geral" icon={<Sparkles size={14} color={t.accents.peach} />}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap' }}>
                {dadosExibidos.payload.estadoGeral}
              </div>
            </Section>
          )}

          {/* O que empolga */}
          {dadosExibidos.payload.oQueEmpolga.length > 0 && (
            <Section titulo="O que empolga" icon={<CheckCircle2 size={14} color={t.accents.sage} />}>
              <ul style={{ margin: 0, paddingLeft: 20, fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.65, color: t.textSecondary }}>
                {dadosExibidos.payload.oQueEmpolga.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </Section>
          )}

          {/* Achados detalhados (cards) */}
          {dadosExibidos.payload.findings.length > 0 && (
            <Section
              titulo={`Achados detalhados (${dadosExibidos.payload.findings.length})`}
              icon={<FileSearch size={14} color={t.accents.rose} />}
              hint="Clique em cada card pra abrir. Pra cada achado: o problema, a evidência (verificada ou inferida), a solução em passos, e um prompt pronto pra colar no Cursor/Claude."
            >
              {dadosExibidos.payload.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  auditoriaId={auditoriaIdAtual}
                  sistemaId={sistemaId}
                  registro={registrosAtuais[f.id]}
                  onRegistered={aoRegistrar}
                />
              ))}
            </Section>
          )}

          {/* Próximos passos */}
          {dadosExibidos.payload.proximosPassos && (
            <Section titulo="Próximos passos estratégicos" icon={<Wand2 size={14} color={t.accents.peach} />}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px' }}>
                {dadosExibidos.payload.proximosPassos}
              </div>
            </Section>
          )}

          <Divider />

          {/* Score de saúde */}
          {dadosExibidos.saudeAtual && <SaudeBreakdownBlock saude={dadosExibidos.saudeAtual} onRecalcular={recalcularSaude} />}
        </>
      )}

      {/* Fallback: payload não parseou — mostra texto bruto */}
      {resultado && !resultado.payload && (
        <>
          <Alert
            type="warning"
            showIcon
            message="Formato não estruturado"
            description="A IA não retornou os achados no formato esperado. Mostrando texto bruto abaixo. Clique em 'Rodar de novo' pra tentar mais uma vez."
            style={{ marginBottom: 16 }}
          />
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 14 }}>
            {resultado.texto}
          </div>
        </>
      )}
    </Drawer>
  );
}

function Section({ titulo, icon, hint, children }: { titulo: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontWeight: 500, fontSize: 14, color: t.text }}>{titulo}</span>
        {hint && (
          <Popover content={<div style={{ maxWidth: 320, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>{hint}</div>} placement="bottomLeft">
            <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} />
          </Popover>
        )}
      </div>
      {children}
    </div>
  );
}

function FontesBlock({ fontes, modelo }: { fontes: AuditResult['fontes']; modelo: string }): React.ReactElement {
  const t = useTokens();
  const items: Array<{ label: string; valor: string | number; ok: boolean }> = [
    { label: 'Propósito', valor: fontes.temProposito ? 'sim' : 'não', ok: fontes.temProposito },
    { label: 'Stack', valor: fontes.temStack ? 'sim' : 'não', ok: fontes.temStack },
    { label: 'URL/Domínio', valor: fontes.temUrl ? 'sim' : 'não', ok: fontes.temUrl },
    { label: 'Repositório', valor: fontes.temRepo ? 'sim' : 'não', ok: fontes.temRepo },
    { label: 'Custos', valor: fontes.custos, ok: true },
    { label: 'Decisões', valor: fontes.decisoes, ok: true },
    { label: 'Riscos', valor: fontes.riscos, ok: true },
    { label: 'Alertas', valor: fontes.alertas, ok: true },
    { label: 'Timeline', valor: fontes.timeline, ok: true },
  ];

  return (
    <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Database size={13} color={t.textTertiary} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fontes consultadas pela IA</span>
        <Popover content={<div style={{ maxWidth: 320, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>O que a IA leu pra produzir esta auditoria. Se um número está em 0, ela não tem dado pra falar daquilo — qualquer achado relacionado deve estar marcado como "inferência".</div>} placement="bottomLeft">
          <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} />
        </Popover>
        {modelo && modelo !== 'desconhecido' && (
          <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary }}>{modelo}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item) => (
          <span
            key={item.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999,
              padding: '2px 9px', fontFamily: FONTS.ui, fontSize: 11,
              color: item.ok && item.valor !== 0 && item.valor !== 'não' ? t.textSecondary : t.textTertiary,
            }}
          >
            {item.label}
            <strong style={{ color: item.ok && item.valor !== 0 && item.valor !== 'não' ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>
              {item.valor}
            </strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function SaudeBreakdownBlock({ saude, onRecalcular }: { saude: SaudeBreakdown; onRecalcular: () => void }): React.ReactElement {
  const t = useTokens();
  const cor = saude.score === 0 ? t.textTertiary : saude.score >= 70 ? t.accents.sage : saude.score >= 40 ? t.accents.peach : t.accents.rose;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONTS.ui, fontWeight: 500, fontSize: 14, color: t.text }}>Score de Saúde</span>
          <span style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 500, color: cor }}>
            {saude.score === 0 ? 'Não avaliado' : `${saude.score}%`}
          </span>
        </div>
        <Button size="small" icon={<RefreshCw size={13} />} onClick={onRecalcular}>Recalcular</Button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {saude.fatores.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, background: t.surface, border: `1px solid ${t.borderSoft}` }}>
            {f.ok ? <CheckCircle2 size={14} color={t.accents.sage} style={{ marginTop: 2, flexShrink: 0 }} /> : <XCircle size={14} color={t.accents.rose} style={{ marginTop: 2, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>{f.nome}</div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 1 }}>{f.detalhe}</div>
            </div>
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, flexShrink: 0 }}>{f.pontos}/{f.max}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
