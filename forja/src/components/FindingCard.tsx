import React, { useState } from 'react';
import { Button, Tag, Tooltip, App as AntApp } from 'antd';
import {
  AlertTriangle, Copy, Download, Check, Plus, ChevronDown, ChevronRight, FileSearch, Wrench, Sparkles,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { AuditFinding, RegistroFinding, ServerResult } from '../types';

interface Props {
  finding: AuditFinding;
  // Quando informado, ao registrar com sucesso fazemos o vínculo persistente
  // (auditoriaId, findingId) no servidor — assim o botão vira "Já registrado"
  // pra próxima abertura do drawer.
  auditoriaId?: string;
  // Garante que o item criado (Decisão/Risco/Oportunidade) seja amarrado ao
  // sistema correto, mesmo que a IA tenha esquecido/errado o sistemaId nos
  // toolParams. Defesa em profundidade — o usuário viu o "Registrado!" mas a
  // linha nasceu órfã antes desse fix.
  sistemaId?: string;
  registro?: RegistroFinding;
  onRegistered?: (info: { findingId: string; tipo: string; idCriado: string }) => void;
}

const SEVERIDADE_CFG: Record<string, { bg: (t: ReturnType<typeof useTokens>) => string; cor: (t: ReturnType<typeof useTokens>) => string; label: string }> = {
  alta: { bg: (t) => `${t.accents.rose}1a`, cor: (t) => t.accents.rose, label: 'Alta' },
  media: { bg: (t) => `${t.accents.peach}1a`, cor: (t) => t.accents.peach, label: 'Média' },
  baixa: { bg: (t) => `${t.accents.blue}1a`, cor: (t) => t.accents.blue, label: 'Baixa' },
};

const TOOL_LABEL: Record<string, string> = {
  registrar_risco: 'Registrar como Risco',
  registrar_decisao: 'Registrar como Decisão',
  registrar_oportunidade: 'Registrar como Oportunidade',
};

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

export default function FindingCard({ finding, auditoriaId, sistemaId, registro, onRegistered }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const sev = SEVERIDADE_CFG[finding.severidade] || SEVERIDADE_CFG.media;
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // O estado "registrado" começa true se o servidor já tinha vínculo salvo
  const [registradoLocal, setRegistradoLocal] = useState(false);
  const registrado = registradoLocal || !!registro;
  const [registrando, setRegistrando] = useState(false);

  const copiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(finding.prompt);
      setCopiado(true);
      message.success('Prompt copiado!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      message.error('Não consegui copiar — selecione manualmente.');
    }
  };

  const baixarPrompt = () => {
    const md = `# ${finding.titulo}\n\n**Severidade:** ${sev.label} · **Área:** ${finding.area}\n\n## Problema\n\n${finding.problema}\n\n## Evidência\n\n${finding.evidencia}\n\n## Solução\n\n${finding.solucao}\n\n## Prompt pronto pra colar\n\n\`\`\`\n${finding.prompt}\n\`\`\`\n`;
    downloadFile(`achado-${slugify(finding.titulo)}.md`, md, 'text/markdown');
    message.success('Arquivo .md baixado!');
  };

  const registrar = async () => {
    if (!finding.toolSugerida) return;
    setRegistrando(true);
    try {
      // Defesa: alguns achados antigos podem ter toolParams sem sistemaId ou
      // com placeholder ("<ID>"). Sobrescrevemos com o sistema corrente quando
      // a tool requer vínculo a sistema (decisão/risco/cobrança).
      const paramsBase = { ...(finding.toolParams || {}) } as Record<string, unknown>;
      const toolsQueExigemSistema = ['registrar_decisao', 'registrar_risco', 'criar_cobranca'];
      if (sistemaId && toolsQueExigemSistema.indexOf(finding.toolSugerida) >= 0) {
        const atual = String(paramsBase.sistemaId || '').trim();
        if (!atual || atual === '<ID>' || atual === 'undefined' || atual === 'null') {
          paramsBase.sistemaId = sistemaId;
        }
      }
      const r = await callServer<ServerResult>('executarToolsIA', [{ tool: finding.toolSugerida, params: paramsBase }]);
      if (r.ok && r.data) {
        const d = r.data as { sucessos: number; falhas: number; resultados?: Array<{ ok: boolean; data?: { id?: string } }> };
        if (d.sucessos > 0) {
          setRegistradoLocal(true);
          message.success('Registrado!');
          const idCriado = (d.resultados && d.resultados[0] && d.resultados[0].data && d.resultados[0].data.id) ? String(d.resultados[0].data.id) : '';
          // Persiste o vínculo pra não reaparecer o botão na próxima abertura
          if (auditoriaId) {
            const tipoCurto = finding.toolSugerida.replace('registrar_', '');
            try {
              await callServer<ServerResult>('marcarFindingRegistrado', {
                auditoriaId,
                findingId: finding.id,
                tipo: tipoCurto,
                idCriado,
              });
            } catch { /* não crítico */ }
          }
          if (onRegistered) onRegistered({ findingId: finding.id, tipo: finding.toolSugerida, idCriado });
        } else {
          message.error('Erro ao registrar');
        }
      } else {
        message.error(r.error || 'Erro');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setRegistrando(false);
    }
  };

  const evidenciaInferida = finding.evidencia.toLowerCase().startsWith('inferência');

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${sev.cor(t)}`,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: t.shadowSoft,
      }}
    >
      {/* Header clicável */}
      <button
        onClick={() => setExpandido((e) => !e)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        {expandido ? <ChevronDown size={16} color={t.textTertiary} /> : <ChevronRight size={16} color={t.textTertiary} />}
        <Tag style={{ background: sev.bg(t), color: sev.cor(t), border: `1px solid ${sev.cor(t)}44`, fontFamily: FONTS.ui, fontSize: 10, fontWeight: 600, marginInlineEnd: 0, textTransform: 'uppercase' }}>
          {sev.label}
        </Tag>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'lowercase' }}>{finding.area}</span>
        <span style={{ flex: 1, fontFamily: FONTS.ui, fontSize: 14, color: t.text, fontWeight: 500 }}>{finding.titulo}</span>
        {registrado && <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 10 }}>✓ registrado</Tag>}
      </button>

      {expandido && (
        <div style={{ padding: '0 16px 18px', borderTop: `1px solid ${t.borderSoft}` }}>
          {/* Problema */}
          <Section icon={<AlertTriangle size={13} color={sev.cor(t)} />} titulo="Problema">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: t.textSecondary }}>{finding.problema}</p>
          </Section>

          {/* Evidência (rastreabilidade) */}
          <Section
            icon={<FileSearch size={13} color={evidenciaInferida ? t.accents.peach : t.accents.sage} />}
            titulo={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Evidência
                <Tooltip title={evidenciaInferida
                  ? 'A IA marcou este achado como INFERÊNCIA — não há dado direto no contexto que prove. Avalie com cuidado.'
                  : 'Fato extraído diretamente do contexto enviado à IA (custos, decisões, riscos, alertas, timeline).'}>
                  <Tag color={evidenciaInferida ? 'orange' : 'green'} style={{ marginInlineEnd: 0, fontSize: 9, fontWeight: 600 }}>
                    {evidenciaInferida ? 'inferência' : 'verificada'}
                  </Tag>
                </Tooltip>
              </span>
            }
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: t.textTertiary, fontStyle: 'italic', fontFamily: FONTS.mono }}>{finding.evidencia}</p>
          </Section>

          {/* Solução */}
          <Section icon={<Wrench size={13} color={t.accents.blue} />} titulo="Solução">
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap' }}>{finding.solucao}</div>
          </Section>

          {/* Prompt pronto */}
          {finding.prompt && (
            <Section icon={<Sparkles size={13} color={t.accents.peach} />} titulo="Prompt pronto pra colar no Cursor / Claude">
              <div
                style={{
                  background: t.surfaceMuted,
                  border: `1px dashed ${t.borderSoft}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: t.textSecondary,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {finding.prompt}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" icon={copiado ? <Check size={13} color={t.accents.sage} /> : <Copy size={13} />} onClick={copiarPrompt}>
                  {copiado ? 'Copiado!' : 'Copiar prompt'}
                </Button>
                <Button size="small" icon={<Download size={13} />} onClick={baixarPrompt}>Baixar .md</Button>
                {finding.toolSugerida && TOOL_LABEL[finding.toolSugerida] && (
                  registrado ? (
                    <Tooltip title={registro ? `Registrado como ${registro.tipo} em ${new Date(registro.registradoEm).toLocaleString('pt-BR')}` : 'Já registrado nesta sessão'}>
                      <Button
                        size="small"
                        icon={<Check size={13} color={t.accents.sage} />}
                        disabled
                        style={{ color: t.accents.sage, borderColor: `${t.accents.sage}88`, background: `${t.accents.sage}11` }}
                      >
                        Já registrado
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      icon={<Plus size={13} />}
                      onClick={registrar}
                      loading={registrando}
                    >
                      {TOOL_LABEL[finding.toolSugerida]}
                    </Button>
                  )
                )}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon, titulo, children }: { icon: React.ReactNode; titulo: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {icon}
        {titulo}
      </div>
      {children}
    </div>
  );
}
