// AuditoriasTab — histórico de auditorias Forja IA de um sistema, dentro do
// próprio sistema (v1.192.0).
//
// Linha do tempo de todas as rodadas (sparkline da evolução do score + lista
// clicável). Clicar numa rodada abre o drill-down dos achados daquela auditoria
// (reusa FindingCard). "Nova auditoria" abre o AuditoriaDrawer do detalhe.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin, Tag, Empty, Modal, App as AntApp, Tooltip } from 'antd';
import { History, Wand2, Sparkles, Clock, GitCommit, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import FindingCard from './FindingCard';
import callServer from '../gas-client';
import type { HistoricoAuditoriaItem, AuditoriaDetalhe, AuditFinding, ServerResult } from '../types';

interface Props {
  sistemaId: string;
  sistemaNome: string;
  onAbrirAuditoria: () => void;
  // Bump pra recarregar quando uma nova auditoria roda no drawer.
  reloadSignal?: number;
}

function fmtData(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function AuditoriasTab({ sistemaId, sistemaNome, onAbrirAuditoria, reloadSignal }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [itens, setItens] = useState<HistoricoAuditoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<AuditoriaDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<string | null>(null);

  const corScore = (s: number) => (s === 0 ? t.textTertiary : s >= 70 ? t.accents.sage : s >= 40 ? t.accents.peach : t.accents.rose);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('getHistoricoAuditorias', sistemaId)
      .then((r) => { if (r.ok && r.data) setItens(r.data as HistoricoAuditoriaItem[]); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  }, [sistemaId]);

  useEffect(carregar, [carregar, reloadSignal]);

  const abrirRodada = (id: string) => {
    setCarregandoDetalhe(id);
    callServer<ServerResult>('getAuditoriaPorId', id)
      .then((r) => {
        if (r.ok && r.data) setDetalhe(r.data as AuditoriaDetalhe);
        else message.error(r.error || 'Não consegui abrir esta auditoria');
      })
      .catch(() => message.error('Disponível apenas no app publicado'))
      .finally(() => setCarregandoDetalhe(null));
  };

  // Sparkline da evolução do score (antigo → recente).
  const serie = [...itens].reverse();
  const delta = serie.length >= 2 ? serie[serie.length - 1].scoreNoMomento - serie[0].scoreNoMomento : 0;
  const sparkline = (() => {
    if (serie.length < 2) return null;
    const W = 520; const H = 60; const pad = 6;
    const xs = (i: number) => pad + (i * (W - 2 * pad)) / (serie.length - 1);
    const ys = (s: number) => H - pad - (Math.max(0, Math.min(100, s)) / 100) * (H - 2 * pad);
    const pts = serie.map((it, i) => `${xs(i).toFixed(1)},${ys(it.scoreNoMomento).toFixed(1)}`);
    const area = `${pad},${H - pad} ${pts.join(' ')} ${xs(serie.length - 1).toFixed(1)},${H - pad}`;
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points={area} fill={`${t.accents.blue}14`} />
        <polyline points={pts.join(' ')} fill="none" stroke={t.accents.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((it, i) => (
          <circle key={i} cx={xs(i)} cy={ys(it.scoreNoMomento)} r={2.6} fill={corScore(it.scoreNoMomento)} />
        ))}
      </svg>
    );
  })();

  const findings: AuditFinding[] = detalhe?.payload?.findings || [];
  const sevCount = (sev: string) => findings.filter((f) => f.severidade === sev).length;

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Cabeçalho da aba */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${t.accents.peach}1f`, color: t.accents.peach }}>
            <History size={20} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Histórico de auditorias</div>
            <div style={{ fontSize: 12, color: t.textTertiary }}>{itens.length} rodada(s) da Forja IA neste sistema</div>
          </div>
        </div>
        <Button type="primary" icon={<Wand2 size={15} />} onClick={onAbrirAuditoria} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
          Nova auditoria
        </Button>
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '48px auto' }} />
      ) : itens.length === 0 ? (
        <div style={{ background: t.surface, border: `1px dashed ${t.border}`, borderRadius: 14, padding: 36, textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ color: t.textSecondary }}>Nenhuma auditoria rodada ainda neste sistema.</span>}
          >
            <Button type="primary" icon={<Wand2 size={15} />} onClick={onAbrirAuditoria} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
              Rodar primeira auditoria
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          {/* Evolução do score */}
          {sparkline && (
            <div style={{ marginBottom: 18, padding: 16, borderRadius: 14, background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowSoft }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Evolução do score</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: delta > 0 ? t.accents.sage : delta < 0 ? t.accents.rose : t.textTertiary }}>
                  {delta > 0 ? <TrendingUp size={15} /> : delta < 0 ? <TrendingDown size={15} /> : <Minus size={15} />}
                  {delta > 0 ? `+${delta}` : delta} pts desde a primeira
                </span>
              </div>
              {sparkline}
            </div>
          )}

          {/* Lista de rodadas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {itens.map((it) => (
              <button
                key={it.id}
                onClick={() => abrirRodada(it.id)}
                className="forja-lift"
                style={{
                  textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderRadius: 13, background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowSoft,
                }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${corScore(it.scoreNoMomento)}18`, border: `1px solid ${corScore(it.scoreNoMomento)}55` }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: corScore(it.scoreNoMomento), lineHeight: 1 }}>{it.scoreNoMomento === 0 ? '—' : it.scoreNoMomento}</span>
                  <span style={{ fontSize: 8.5, color: t.textTertiary, marginTop: 1 }}>score</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, fontWeight: 600 }}>
                      <Clock size={13} color={t.textTertiary} /> {fmtData(it.criadoEm)}
                    </span>
                    {it.incremental && <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue, fontSize: 10, marginInlineEnd: 0 }}>incremental</Tag>}
                    {it.resolvidos > 0 && <Tag bordered={false} style={{ background: `${t.accents.sage}1a`, color: t.accents.sage, fontSize: 10, marginInlineEnd: 0 }}>{it.resolvidos} resolvido(s)</Tag>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
                    <span style={{ color: t.textSecondary, fontWeight: 600 }}>{it.numFindings} achado(s)</span>
                    {it.duracaoMs > 0 && <span>{(it.duracaoMs / 1000).toFixed(1)}s</span>}
                    {it.modeloUsado && <span style={{ fontFamily: FONTS.mono }}>{it.modeloUsado}</span>}
                    {it.commitSha && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: FONTS.mono }}><GitCommit size={12} /> {it.commitSha}</span>}
                  </div>
                </div>
                {carregandoDetalhe === it.id ? <Spin size="small" /> : <ChevronRight size={18} color={t.textTertiary} />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Drill-down de uma rodada */}
      <Modal
        open={!!detalhe}
        onCancel={() => setDetalhe(null)}
        footer={<Button onClick={() => setDetalhe(null)}>Fechar</Button>}
        width={760}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color={t.accents.peach} />
            Auditoria de {detalhe ? fmtData(detalhe.criadoEm) : ''}
          </span>
        }
        destroyOnClose
      >
        {detalhe && (
          <div>
            {/* Resumo da rodada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${t.borderSoft}` }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: `${corScore(detalhe.scoreNoMomento)}14`, border: `1px solid ${corScore(detalhe.scoreNoMomento)}44` }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: corScore(detalhe.scoreNoMomento) }}>{detalhe.scoreNoMomento === 0 ? '—' : `${detalhe.scoreNoMomento}%`}</span>
                <span style={{ fontSize: 11, color: t.textTertiary }}>score</span>
              </div>
              {sevCount('alta') > 0 && <Tag bordered={false} style={{ background: `${t.accents.rose}1a`, color: t.accents.rose, fontWeight: 600 }}>{sevCount('alta')} alta</Tag>}
              {sevCount('media') > 0 && <Tag bordered={false} style={{ background: `${t.accents.peach}1a`, color: t.accents.peach, fontWeight: 600 }}>{sevCount('media')} média</Tag>}
              {sevCount('baixa') > 0 && <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue, fontWeight: 600 }}>{sevCount('baixa')} baixa</Tag>}
              {detalhe.modeloUsado && <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11.5, color: t.textTertiary }}>{detalhe.modeloUsado}</span>}
            </div>

            {detalhe.payload?.estadoGeral && (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 13, lineHeight: 1.6, color: t.textSecondary }}>
                {detalhe.payload.estadoGeral}
              </div>
            )}

            {findings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: t.textTertiary, fontSize: 13 }}>
                Esta auditoria não registrou achados (sistema saudável no momento).
              </div>
            ) : (
              <>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  Achados ({findings.length})
                </div>
                {findings.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    auditoriaId={detalhe.id}
                    sistemaId={sistemaId}
                    registro={detalhe.registros ? detalhe.registros[f.id] : undefined}
                  />
                ))}
              </>
            )}

            {detalhe.payload?.resolvidos && detalhe.payload.resolvidos.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: `${t.accents.sage}0e`, border: `1px solid ${t.accents.sage}33` }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.accents.sage, marginBottom: 6 }}>
                  Resolvidos nesta rodada ({detalhe.payload.resolvidos.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>
                  {detalhe.payload.resolvidos.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
