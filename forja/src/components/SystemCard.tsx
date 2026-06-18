import React from 'react';
import { Typography, Progress, Tooltip } from 'antd';
import { Sparkles, Globe2, Wand2, Layers, Flame, CloudOff } from 'lucide-react';
import StageBadge from './StageBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { Sistema } from '../types';

const { Text, Paragraph } = Typography;

export interface BacklogSumarioItem {
  aFazer: number;
  fazendo: number;
  alta: number;
  total: number;
}

interface SystemCardProps {
  sistema: Sistema;
  onClick: (id: string) => void;
  auditoria?: { criadoEm: string; numFindings: number; modeloUsado: string } | null;
  // Indicador visual de pendências no backlog do sistema. Quando há itens em
  // "a fazer" ou "fazendo", mostramos uma pílula. Se algum é de prioridade
  // alta, vira pulse vermelho pra puxar a atenção.
  backlog?: BacklogSumarioItem | null;
}

function relTempoCurto(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function SystemCard({ sistema, onClick, auditoria, backlog }: SystemCardProps): React.ReactElement {
  const t = useTokens();
  const stackTags = sistema.stack ? sistema.stack.split(',').map(s => s.trim()).filter(Boolean) : [];
  const saudeColor = sistema.scoreSaude >= 75 ? t.accents.sage : sistema.scoreSaude >= 45 ? t.accents.peach : t.accents.rose;
  // Backlog visual: só mostra se há ao menos 1 item pendente. Prio alta destaca em rose.
  const temBacklog = !!(backlog && (backlog.aFazer + backlog.fazendo) > 0);
  const temAlta = !!(backlog && backlog.alta > 0);
  const backlogCor = temAlta ? t.accents.rose : t.accents.peach;
  const removidoGas = !!sistema.removidoNoGas && String(sistema.removidoNoGas).toLowerCase() !== 'false';

  return (
    <div
      onClick={() => onClick(sistema.id)}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        boxShadow: t.shadowSoft,
        padding: 20,
        cursor: 'pointer',
        transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.borderColor = `${t.accents.peach}66`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = t.shadowSoft; e.currentTarget.style.borderColor = t.border; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <Text strong style={{ fontSize: 16, color: t.text, display: 'block', fontFamily: FONTS.display, fontWeight: 600 }}>{sistema.nome}</Text>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textTertiary }}>{sistema.codinome}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {removidoGas && (
            <Tooltip title="Este projeto não existe mais no seu Google Apps Script (apagado ou na lixeira). A governança no Forja foi preservada — você decide se remove.">
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${t.accents.rose}1f`, color: t.accents.rose,
                  border: `1px solid ${t.accents.rose}66`, borderRadius: 999,
                  padding: '1px 7px', fontSize: 10, fontFamily: FONTS.ui, fontWeight: 700,
                }}
              >
                <CloudOff size={9} strokeWidth={2.2} />
                Removido no GAS
              </span>
            </Tooltip>
          )}
          {temBacklog && (
            <Tooltip
              title={
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Backlog pendente</div>
                  📥 {backlog!.aFazer} a fazer · 🔨 {backlog!.fazendo} fazendo
                  {temAlta && <div style={{ marginTop: 4, color: '#ffcccc' }}>⚠️ {backlog!.alta} de prioridade alta</div>}
                </div>
              }
            >
              <span
                className={temAlta ? 'forja-pulse' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${backlogCor}1f`, color: backlogCor,
                  border: `1px solid ${backlogCor}66`, borderRadius: 999,
                  padding: '1px 7px', fontSize: 10, fontFamily: FONTS.ui, fontWeight: 700,
                }}
              >
                {temAlta ? <Flame size={9} strokeWidth={2.2} /> : <Layers size={9} strokeWidth={2} />}
                {backlog!.aFazer + backlog!.fazendo}
              </span>
            </Tooltip>
          )}
          {auditoria && (
            <Tooltip title={`Auditada há ${relTempoCurto(auditoria.criadoEm)} · ${auditoria.numFindings} achado(s)`}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${t.accents.sage}1a`, color: t.accents.sage,
                  border: `1px solid ${t.accents.sage}55`, borderRadius: 999,
                  padding: '1px 7px', fontSize: 10, fontFamily: FONTS.ui, fontWeight: 600,
                }}
              >
                <Wand2 size={9} strokeWidth={2} />
                {relTempoCurto(auditoria.criadoEm)}
              </span>
            </Tooltip>
          )}
          <StageBadge estagio={sistema.estagio} />
        </div>
      </div>

      {sistema.proposito && (
        <Paragraph style={{ color: t.textSecondary, fontSize: 13, margin: 0 }} ellipsis={{ rows: 2 }}>{sistema.proposito}</Paragraph>
      )}

      {stackTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {stackTags.slice(0, 4).map(tag => (
            <span key={tag} style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 7, padding: '2px 8px', fontSize: 11, color: t.textSecondary }}>{tag}</span>
          ))}
          {stackTags.length > 4 && <span style={{ fontSize: 11, color: t.textTertiary, alignSelf: 'center' }}>+{stackTags.length - 4}</span>}
        </div>
      )}

      {sistema.dominioCustomizado && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.mono, fontSize: 11, color: t.accents.sage }}>
          <Globe2 size={12} strokeWidth={1.7} />
          {sistema.dominioCustomizado}
        </div>
      )}

      {temBacklog && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 11,
            color: t.textTertiary, padding: '6px 10px', borderRadius: 8,
            background: `${backlogCor}10`,
            border: `1px solid ${backlogCor}33`,
            borderLeft: `3px solid ${backlogCor}`,
          }}
        >
          {temAlta ? <Flame size={12} color={backlogCor} strokeWidth={2} /> : <Layers size={12} color={backlogCor} strokeWidth={2} />}
          <span style={{ color: t.textSecondary, fontWeight: 600 }}>Backlog:</span>
          <span>{backlog!.aFazer} a fazer</span>
          {backlog!.fazendo > 0 && <span>· {backlog!.fazendo} fazendo</span>}
          {temAlta && <span style={{ color: backlogCor, fontWeight: 700, marginLeft: 'auto' }}>{backlog!.alta} alta</span>}
        </div>
      )}

      {sistema.scoreSaude > 0 ? (
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: t.textTertiary }}>Saúde</Text>
            <Text style={{ fontSize: 11, color: t.textSecondary }}>{sistema.scoreSaude}%</Text>
          </div>
          <Progress percent={sistema.scoreSaude} showInfo={false} size="small" strokeColor={saudeColor} trailColor={t.borderSoft} />
        </div>
      ) : (
        <Tooltip
          title="O score de saúde é calculado pela Forja IA a partir de sinais reais (alertas recentes, custo vs receita, idade do último deploy etc.). A Auditoria automática chega na Fase 15."
          placement="bottom"
        >
          <div
            style={{
              marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: t.textTertiary, fontFamily: FONTS.ui,
              background: t.surfaceMuted, border: `1px dashed ${t.borderSoft}`,
              borderRadius: 999, padding: '3px 10px', alignSelf: 'flex-start',
              cursor: 'help',
            }}
          >
            <Sparkles size={11} strokeWidth={1.7} />
            Saúde não avaliada
          </div>
        </Tooltip>
      )}
    </div>
  );
}
