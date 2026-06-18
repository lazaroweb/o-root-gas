import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Tag, Tooltip, Button } from 'antd';
import {
  HeartPulse, Sparkles, GitBranch, Server, Plus, AppWindow, Flame, FileCode, FileText,
  AlertTriangle, AlertCircle, Info, ListChecks, GitCommit, ChevronRight, CloudOff,
} from 'lucide-react';
import { Panel, Skeleton, RingProgress, LiveDot, EmptyArt } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { DashboardData, StatusGeral, DashboardOperacional, ServerResponse } from '../types';

interface DashboardProps {
  onSelectSistema: (id: string) => void;
  onNavigate: (view: 'financeiro' | 'sistemas' | 'operacoes' | 'relatorios') => void;
  onImportGAS?: () => void;
  // v1.4.4: abre o drawer de alertas (controlado em App.tsx). Quando ausente
  // (preview local), o link de "ver alertas" não aparece.
  onOpenAlertas?: () => void;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Narrativa TÉCNICA (v1.4.4) — sem qualquer menção a dinheiro/lucro/MRR.
// Foco no que importa pra command center: saúde, atenção, próximas ações.
function narrativaTecnica(
  totais: { sistemas: number; ativos: number },
  saudeMedia: number,
  ops?: DashboardOperacional | null,
): string {
  if (totais.sistemas === 0) return 'Bancada vazia. Importe seus apps do GAS ou cadastre um do zero pra começar.';
  if (totais.ativos === 0) return 'Nenhum app ativo agora — bom momento pra retomar um projeto ou começar um novo.';
  const alertas = ops?.alertasNaoLidos || 0;
  const findings = ops?.findingsAbertos || 0;
  const atencao = ops?.breakdown?.atencao || 0;
  if (alertas > 0 && atencao > 0) return `${atencao} app${atencao > 1 ? 's' : ''} pedindo atenção e ${alertas} alerta${alertas > 1 ? 's' : ''} não lido${alertas > 1 ? 's' : ''} — vale dar uma olhada.`;
  if (atencao > 0) return `${atencao} app${atencao > 1 ? 's' : ''} no status atenção — confere o que tá rolando.`;
  if (alertas > 0) return `${alertas} alerta${alertas > 1 ? 's' : ''} técnico${alertas > 1 ? 's' : ''} pendente${alertas > 1 ? 's' : ''} no painel.`;
  if (findings > 5) return `${findings} findings de auditoria em aberto. Bora resolver um por dia.`;
  if (saudeMedia < 50) return 'Saúde média abaixo de 50 — vários apps pedindo atenção.';
  if (saudeMedia < 75) return 'Algumas pendências leves pra revisar — nada urgente.';
  return 'Tudo rodando bem. Bom momento pra avançar com features novas.';
}

const MOCK: DashboardData = {
  kpis: { mrr: 0, custoMensal: 0, lucro: 0, saudeMedia: 88 },
  mrrSeries: [],
  apps: [
    { id: '1', nome: 'ClientFlow', estagio: 'tempera', cliente: '', mrr: 0, saude: 92, status: 'ativo' },
    { id: '2', nome: 'FORJA', estagio: 'forja', cliente: '', mrr: 0, saude: 85, status: 'ativo' },
  ],
  contas: [],
  totais: { sistemas: 3, ativos: 2, assinaturas: 0 },
};

export default function Dashboard({ onSelectSistema, onNavigate, onImportGAS, onOpenAlertas }: DashboardProps): React.ReactElement {
  const t = useTokens();
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [ops, setOps] = useState<DashboardOperacional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callServer<ServerResponse<DashboardData>>('getDashboardData')
      .then(res => {
        if (res.ok && res.data) setData(res.data);
        else setError(res.error || 'Erro ao carregar');
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
    callServer<ServerResponse<StatusGeral>>('getStatusGeral')
      .then(res => { if (res.ok && res.data) setStatus(res.data as StatusGeral); })
      .catch(() => { /* preview local não valida */ });
    callServer<ServerResponse<DashboardOperacional>>('getDashboardOperacional')
      .then(res => { if (res.ok && res.data) setOps(res.data as DashboardOperacional); })
      .catch(() => { /* preview local */ });
    // Sync silencioso com o GAS: se algo mudou (novo/removido), recarrega o painel.
    callServer<ServerResponse<{ novos: number; removidos: unknown[]; renomeados: unknown[]; restaurados: number; selfVinculado?: boolean }>>('sincronizarGAS')
      .then(res => {
        if (res.ok && res.data) {
          const d = res.data;
          if (d.novos > 0 || (d.removidos && d.removidos.length > 0) || (d.renomeados && d.renomeados.length > 0) || d.restaurados > 0 || d.selfVinculado) {
            callServer<ServerResponse<DashboardData>>('getDashboardData')
              .then(r => { if (r.ok && r.data) setData(r.data); })
              .catch(() => { /* mantém estado atual */ });
          }
        }
      })
      .catch(() => { /* sync é best-effort */ });
  }, []);

  if (loading) {
    return (
      <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <Skeleton width={160} height={14} radius={6} />
        <div style={{ height: 14 }} />
        <Skeleton width={340} height={40} radius={8} />
        <div style={{ height: 28 }} />
        <Row gutter={[18, 18]}>
          <Col xs={24} lg={16}><div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 28, height: 280 }}><Skeleton width={180} height={14} /><div style={{ height: 18 }} /><Skeleton width={240} height={56} radius={10} /><div style={{ height: 28 }} /><Skeleton width="100%" height={120} radius={12} /></div></Col>
          <Col xs={24} lg={8}><div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 22, height: 280 }}><Skeleton width={140} height={14} /><div style={{ height: 18 }} /><div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton width={128} height={128} radius={64} /></div></div></Col>
        </Row>
      </div>
    );
  }
  if (error) return <Alert type="error" message={error} showIcon style={{ margin: 24 }} />;
  if (!data) return null;

  const { kpis, apps } = data;

  const statusColor = (s: string) => s === 'ativo' ? t.accents.sage : s === 'atencao' ? t.accents.peach : s === 'arquivado' ? t.textTertiary : t.accents.blue;
  const statusLabel = (s: string) => s === 'ativo' ? 'Ativo' : s === 'atencao' ? 'Atenção' : s === 'arquivado' ? 'Arquivado' : 'Rascunho';

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const saudeCor = kpis.saudeMedia >= 75 ? t.accents.sage : kpis.saudeMedia >= 45 ? t.accents.peach : t.accents.rose;
  const saudeLabel = kpis.saudeMedia >= 75 ? 'Saudável' : kpis.saudeMedia >= 45 ? 'Atenção leve' : 'Crítico';

  const conta = narrativaTecnica(data.totais, kpis.saudeMedia, ops);
  const stagger = (i: number): React.CSSProperties => ({ animation: `forjaRise 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both` });

  // Breakdown técnico — usa dados operacionais ou cai pro mock
  const bk = ops?.breakdown || { rascunho: 0, forja: 0, tempera: 0, prateleira: 0, atencao: 0 };

  return (
    <div style={{ padding: '36px 40px 48px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Hero editorial — sem números financeiros */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 28, ...stagger(0) }}>
        <div>
          <div style={{ fontSize: 12.5, color: t.textTertiary, textTransform: 'capitalize', letterSpacing: '0.04em', marginBottom: 6 }}>{dataHoje} · Forja</div>
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 44, lineHeight: 1.05, margin: 0, color: t.text, letterSpacing: '-0.022em' }}>
            {saudacao()}, <span style={{ fontStyle: 'italic', color: t.accents.clay }}>mestre</span>.
          </h1>
          <p style={{ margin: '10px 0 0', color: t.textSecondary, fontSize: 14.5, maxWidth: 560, lineHeight: 1.55 }}>{conta}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button icon={<FileText size={16} />} onClick={() => onNavigate('relatorios')}>Relatório do mês</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => onNavigate('sistemas')}>Novo sistema</Button>
        </div>
      </header>

      {/* Hero operacional + Status técnico */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          {/* Hero técnico: saúde média grande + breakdown estágios + counts operacionais */}
          <div style={{
            ...stagger(1),
            position: 'relative',
            borderRadius: 22,
            border: `1px solid ${t.border}`,
            background: `linear-gradient(140deg, ${saudeCor}1a 0%, ${saudeCor}08 30%, ${t.surface} 62%)`,
            boxShadow: t.shadowSoft,
            padding: 28,
            overflow: 'hidden',
            minHeight: 280,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${saudeCor}00, ${saudeCor}, ${saudeCor}00)`, opacity: 0.55 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <HeartPulse size={14} strokeWidth={1.8} color={saudeCor} /> Saúde operacional
              </span>
              <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 11, background: `${saudeCor}1a`, color: saudeCor }}>{saudeLabel}</Tag>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{
                fontFamily: FONTS.display, fontWeight: 500, fontSize: 64,
                color: t.text, lineHeight: 1, letterSpacing: '-0.025em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {kpis.saudeMedia}
                <span style={{ fontSize: 28, color: t.textTertiary, marginLeft: 4 }}>/100</span>
              </span>
            </div>
            <div style={{ fontSize: 13, color: t.textTertiary, marginBottom: 22 }}>
              <span style={{ fontWeight: 600, color: t.text }}>{data.totais.ativos}</span> ativo{data.totais.ativos !== 1 ? 's' : ''} de <span style={{ fontWeight: 600, color: t.text }}>{data.totais.sistemas}</span> sistema{data.totais.sistemas !== 1 ? 's' : ''} cadastrado{data.totais.sistemas !== 1 ? 's' : ''}
            </div>

            {/* Mini-stats operacionais: estágios + counts */}
            <Row gutter={[18, 14]}>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Em forja"
                  valor={bk.forja}
                  cor={t.accents.peach}
                  hint="Em desenvolvimento"
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Têmpera"
                  valor={bk.tempera}
                  cor={t.accents.blue}
                  hint="Em refinamento"
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Prateleira"
                  valor={bk.prateleira}
                  cor={t.accents.sage}
                  hint="Em produção"
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Atenção"
                  valor={bk.atencao}
                  cor={bk.atencao > 0 ? t.accents.rose : t.textTertiary}
                  hint="Pedindo ação"
                  destaque={bk.atencao > 0}
                />
              </Col>
            </Row>

            {/* Linha de counts operacionais (rodapé do hero) */}
            {(ops && (ops.decisoesAbertas > 0 || ops.findingsAbertos > 0 || ops.alertasNaoLidos > 0)) && (
              <div style={{
                marginTop: 22, paddingTop: 16,
                borderTop: `1px solid ${t.borderSoft}`,
                display: 'flex', gap: 20, flexWrap: 'wrap',
                fontSize: 12.5, color: t.textTertiary,
              }}>
                {ops.decisoesAbertas > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ListChecks size={13} color={t.accents.lavender} />
                    <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.decisoesAbertas}</strong> decisões em aberto
                  </span>
                )}
                {ops.findingsAbertos > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={13} color={t.accents.peach} />
                    <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.findingsAbertos}</strong> findings pra resolver
                  </span>
                )}
                {ops.alertasNaoLidos > 0 && onOpenAlertas && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={onOpenAlertas}>
                    <AlertCircle size={13} color={t.accents.rose} />
                    <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.alertasNaoLidos}</strong> alertas não lidos
                  </span>
                )}
              </div>
            )}
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div style={{ ...stagger(2), borderRadius: 22, border: `1px solid ${t.border}`, background: t.surface, boxShadow: t.shadowSoft, padding: 24, height: '100%', minHeight: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Server size={14} strokeWidth={1.8} color={t.accents.blue} /> Conexões
              </span>
              {status && (
                <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 11, fontWeight: 600, background: status.resumo.online === status.resumo.total ? `${t.accents.sage}1a` : `${t.accents.clay}1a`, color: status.resumo.online === status.resumo.total ? t.accents.sage : t.accents.clay }}>{status.resumo.online}/{status.resumo.total} online</Tag>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
              <RingProgress value={kpis.saudeMedia} color={saudeCor} size={132} sublabel={`${data.totais.ativos} apps ativos`} />
            </div>
            <div style={{ borderTop: `1px solid ${t.borderSoft}`, paddingTop: 8 }}>
              {(status ? [
                { icon: <Sparkles size={14} strokeWidth={1.8} />, nome: 'IA — Proxy', live: status.llm, tip: status.llm.detalhe || 'Conexão com o proxy de LLM (Configurações).' },
                { icon: <GitBranch size={14} strokeWidth={1.8} />, nome: 'GitHub', live: status.github, tip: status.github.detalhe || 'Validação do token do GitHub.' },
              ] : []).map((r, i) => {
                const cor = !r.live.configurado ? t.textTertiary : r.live.conectado ? t.accents.sage : t.accents.rose;
                return (
                  <Tooltip key={i} title={r.tip} placement="left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'help' }}>
                      <LiveDot color={cor} live={r.live.conectado === true} />
                      <span style={{ color: t.textSecondary, display: 'inline-flex' }}>{r.icon}</span>
                      <span style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: 500 }}>{r.nome}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>
                        {!r.live.configurado ? 'Não config.' : r.live.conectado ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
              {status && (() => {
                const apisOnline = status.apis.filter(a => a.conectado).length;
                const total = status.apis.length;
                const cor = total === 0 ? t.textTertiary : apisOnline === total ? t.accents.sage : t.accents.rose;
                return (
                  <div onClick={() => onNavigate('operacoes')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }}>
                    <LiveDot color={cor} live={total > 0 && apisOnline > 0} />
                    <span style={{ color: t.textSecondary, display: 'inline-flex' }}><Server size={14} strokeWidth={1.8} /></span>
                    <span style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: 500 }}>Endpoints de APIs</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{total ? `${apisOnline}/${total}` : '—'}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </Col>
      </Row>

      <div style={{ height: 20 }} />

      {/* Aplicações + Atividade técnica */}
      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} lg={16}>
          <div style={{ ...stagger(3), height: '100%' }}>
            <Panel
              title="Aplicações"
              extra={apps.length > 0 ? <a onClick={() => onNavigate('sistemas')} style={{ color: t.accents.peach, fontSize: 13, cursor: 'pointer' }}>Ver todas →</a> : undefined}
              padding={8}
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={apps.length > 0 ? { flex: 1, minHeight: 0, position: 'relative', padding: 0 } : undefined}
            >
              {apps.length === 0 ? (
                <EmptyArt
                  icon={<Flame size={28} strokeWidth={1.6} />}
                  titulo="Sua bancada está vazia"
                  descricao="Importe seus apps do Google Apps Script ou cadastre um do zero — em segundos eles aparecem aqui com saúde e operação."
                  acao={
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      {onImportGAS && <Button type="primary" icon={<FileCode size={16} />} onClick={onImportGAS}>Importar do GAS</Button>}
                      <Button icon={<Plus size={16} />} onClick={() => onNavigate('sistemas')}>Cadastrar manualmente</Button>
                    </div>
                  }
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 8 }}>
                  {apps.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => onSelectSistema(a.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceMuted)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor(a.status)}22`, color: statusColor(a.status), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 600, fontSize: 16 }}>
                        {a.nome.charAt(0)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: t.text, fontWeight: 500, fontSize: 14 }}>{a.nome}</span>
                          {a.removidoNoGas && (
                            <Tooltip title="Não existe mais no seu Google Apps Script. Gerencie em Sistemas.">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: `${t.accents.rose}1f`, color: t.accents.rose, border: `1px solid ${t.accents.rose}66`, borderRadius: 999, padding: '0px 6px', fontSize: 9.5, fontWeight: 700 }}>
                                <CloudOff size={8} strokeWidth={2.4} /> GAS
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        <div style={{ color: t.textTertiary, fontSize: 12, textTransform: 'capitalize' }}>{a.estagio}</div>
                      </div>
                      <Tooltip title="Saúde do app (0–100): uptime, incidentes e manutenção.">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'flex-end', cursor: 'help' }}>
                          <HeartPulse size={13} strokeWidth={1.7} color={a.saude >= 75 ? t.accents.sage : a.saude >= 45 ? t.accents.peach : t.accents.rose} />
                          <span style={{ color: t.textSecondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{a.saude || '—'}</span>
                        </div>
                      </Tooltip>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110, justifyContent: 'flex-end' }}>
                        <LiveDot color={statusColor(a.status)} live={a.status === 'ativo'} />
                        <span style={{ color: t.textSecondary, fontSize: 13 }}>{statusLabel(a.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div style={stagger(4)}>
            <AtividadePanel
              ops={ops}
              onAbrirAlertas={onOpenAlertas || (() => { /* sem callback: link omitido */ })}
              onAbrirSistema={(id) => onSelectSistema(id)}
              temAlertasCallback={!!onOpenAlertas}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}

// ─── Sub-componentes técnicos ────────────────────────────────────────────────

function TechMiniStat({ titulo, valor, cor, hint, destaque }: {
  titulo: string; valor: number; cor: string; hint?: string; destaque?: boolean;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titulo}</span>
      </div>
      <div style={{
        fontFamily: FONTS.display, fontSize: 28, fontWeight: 500,
        color: destaque ? cor : t.text, marginTop: 4,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>
        {valor}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// Painel de atividade técnica — substitui "Contas a vencer" (que era $ no dashboard).
// Mostra alertas não lidos + decisões recentes em um único feed compacto.
function AtividadePanel({ ops, onAbrirAlertas, onAbrirSistema, temAlertasCallback }: {
  ops: DashboardOperacional | null;
  onAbrirAlertas: () => void;
  onAbrirSistema: (id: string) => void;
  temAlertasCallback: boolean;
}): React.ReactElement {
  const t = useTokens();

  const semConteudo = !ops || (ops.alertasTop.length === 0 && ops.decisoesRecentes.length === 0);

  if (!ops) {
    return (
      <Panel title="Atividade técnica" padding={8}>
        <div style={{ padding: 20, color: t.textTertiary, fontSize: 13, textAlign: 'center' }}>
          Carregando...
        </div>
      </Panel>
    );
  }

  if (semConteudo) {
    return (
      <Panel title="Atividade técnica" padding={8}>
        <EmptyArt
          icon={<AppWindow size={26} strokeWidth={1.6} />}
          titulo="Tudo silêncio"
          descricao="Sem alertas pendentes nem decisões recentes. Quando algo acontecer nos seus sistemas, aparece aqui."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Atividade técnica"
      extra={
        ops.alertasNaoLidos > 0 && temAlertasCallback
          ? <a onClick={onAbrirAlertas} style={{ color: t.accents.peach, fontSize: 13, cursor: 'pointer' }}>Ver alertas →</a>
          : undefined
      }
      padding={8}
    >
      {/* Alertas não lidos (top 3) */}
      {ops.alertasTop.length > 0 && (
        <div>
          <div style={{
            padding: '8px 14px 4px',
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.08em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            Alertas
          </div>
          {ops.alertasTop.slice(0, 3).map((a) => {
            const cor = a.severidade === 'critico' ? t.accents.rose
              : a.severidade === 'aviso' ? t.accents.peach
              : t.accents.blue;
            const Ic = a.severidade === 'critico' ? AlertCircle
              : a.severidade === 'aviso' ? AlertTriangle
              : Info;
            return (
              <div
                key={a.id}
                onClick={() => a.sistemaId ? onAbrirSistema(a.sistemaId) : (temAlertasCallback ? onAbrirAlertas() : undefined)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderLeft: `2px solid ${cor}`,
                  background: `${cor}06`,
                  marginBottom: 1,
                }}
              >
                <Ic size={14} color={cor} strokeWidth={1.7} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: t.text, fontSize: 13, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.titulo}
                  </div>
                  <div style={{
                    color: t.textTertiary, fontSize: 11.5, marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.mensagem}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decisões recentes (top 3) */}
      {ops.decisoesRecentes.length > 0 && (
        <div style={{ marginTop: ops.alertasTop.length > 0 ? 10 : 0 }}>
          <div style={{
            padding: '8px 14px 4px',
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.08em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            Decisões recentes
          </div>
          {ops.decisoesRecentes.slice(0, 3).map((d) => {
            const prioCor = d.prioridade === 'alta' ? t.accents.rose
              : d.prioridade === 'media' ? t.accents.peach
              : t.accents.sage;
            return (
              <div
                key={d.id}
                onClick={() => onAbrirSistema(d.sistemaId)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderTop: `1px solid ${t.borderSoft}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = t.surfaceMuted}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <GitCommit size={14} color={prioCor} strokeWidth={1.7} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: t.text, fontSize: 13, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {d.titulo}
                  </div>
                  <div style={{
                    color: t.textTertiary, fontSize: 11.5, marginTop: 1,
                  }}>
                    {d.sistemaNome}
                  </div>
                </div>
                <ChevronRight size={13} color={t.textTertiary} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
