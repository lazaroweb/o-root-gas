import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Spin, Empty, App as AntApp, Tooltip, Select, Tag } from 'antd';
import {
  Target, TrendingUp, Percent, Coins, Building2, ArrowRight,
  GripVertical, Filter,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import ClienteSnapshotDrawer from '../components/ClienteSnapshotDrawer';
import { PIPELINE_ESTAGIOS, ORIGEM_LABEL_MAP } from './PessoasView';
import type { Pessoa, ServerResponse } from '../types';

const brl = (n: number): string => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Pipeline comercial — kanban com as oportunidades comerciais (clientes nos
// estágios pré-fechamento). Os campos `statusComercial`, `ticketPrevisto`,
// `origemContato` e `proximaAcao` cadastrados na ficha do cliente vivem aqui.
//
// Decisões:
//  • Apenas estágios ATIVOS aparecem (lead → conversa → proposta → negociação).
//    "cliente-ativo" não está no funil; "pausado"/"perdido" são arquivo.
//  • Drag-and-drop nativo HTML5 (sem deps novas) — leve e suficiente.
//  • Cards mostram empresa, ticket, próxima ação, origem.
//  • Click no card abre o snapshot drawer (mesma ficha já existente).
//  • KPIs no topo: total em pipeline, valor ponderado (× prob por estágio),
//    ticket médio das oportunidades abertas, taxa histórica de conversão.
export default function PipelineComercial(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotPessoa, setSnapshotPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todas');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<Pessoa[]>>('getPessoas')
      .then((r) => { if (r.ok && r.data) setPessoas(r.data as Pessoa[]); else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Falha ao carregar clientes'))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { carregar(); }, [carregar]);

  // Só clientes vão pro pipeline (parceiros têm fluxo próprio).
  const clientes = useMemo(() => pessoas.filter((p) => p.papel === 'cliente'), [pessoas]);

  // Filtra por origem
  const filtrados = useMemo(() => {
    if (filtroOrigem === 'todas') return clientes;
    return clientes.filter((p) => (p.origemContato || '') === filtroOrigem);
  }, [clientes, filtroOrigem]);

  // Agrupa por estágio
  const porEstagio = useMemo(() => {
    const m = new Map<string, Pessoa[]>();
    for (const e of PIPELINE_ESTAGIOS) m.set(e.value, []);
    for (const p of filtrados) {
      const s = p.statusComercial || 'lead';
      if (m.has(s)) m.get(s)!.push(p);
    }
    return m;
  }, [filtrados]);

  // KPIs derivados
  const kpis = useMemo(() => {
    let total = 0;
    let ponderado = 0;
    let cont = 0;
    for (const e of PIPELINE_ESTAGIOS) {
      const cards = porEstagio.get(e.value) || [];
      for (const c of cards) {
        const v = Number(c.ticketPrevisto || 0);
        total += v;
        ponderado += v * e.prob;
        cont++;
      }
    }
    const ticketMedio = cont > 0 ? total / cont : 0;
    // Conversão histórica = ativos / (ativos + perdidos) — só dos clientes com
    // statusComercial definido (excluindo nulos/leads em aberto).
    const fechados = clientes.filter((c) => c.statusComercial === 'cliente-ativo').length;
    const perdidos = clientes.filter((c) => c.statusComercial === 'perdido').length;
    const conversao = (fechados + perdidos) > 0 ? Math.round((fechados / (fechados + perdidos)) * 100) : 0;
    return { total, ponderado, ticketMedio, cont, conversao };
  }, [porEstagio, clientes]);

  const origensDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientes) {
      const o = c.origemContato;
      if (o) set.add(o);
    }
    return Array.from(set).sort();
  }, [clientes]);

  const moverParaEstagio = useCallback(async (pessoaId: string, novoEstagio: string) => {
    const p = pessoas.find((x) => x.id === pessoaId);
    if (!p || p.statusComercial === novoEstagio) return;
    // Otimismo: atualiza a UI primeiro, faz rollback se der erro
    setPessoas((prev) => prev.map((x) => x.id === pessoaId ? { ...x, statusComercial: novoEstagio } : x));
    try {
      const r = await callServer<ServerResponse<unknown>>('updatePessoa', pessoaId, { statusComercial: novoEstagio });
      if (!r.ok) throw new Error(r.error || 'Erro');
      message.success('Estágio atualizado');
    } catch {
      message.error('Não foi possível mover');
      setPessoas((prev) => prev.map((x) => x.id === pessoaId ? { ...x, statusComercial: p.statusComercial } : x));
    }
  }, [pessoas, message]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ animation: 'forjaFadeIn 0.3s ease' }}>
      {/* KPIs do pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 22 }}>
        <KpiBox cor={t.accents.peach} icon={<Coins size={14} />} label="Total em pipeline" valor={brl(kpis.total)} sub={`${kpis.cont} ${kpis.cont === 1 ? 'oportunidade' : 'oportunidades'}`} />
        <KpiBox cor={t.accents.sage} icon={<Target size={14} />} label="Valor ponderado" valor={brl(kpis.ponderado)} sub="× probabilidade do estágio" />
        <KpiBox cor={t.accents.blue} icon={<TrendingUp size={14} />} label="Ticket médio" valor={brl(kpis.ticketMedio)} />
        <KpiBox cor={t.accents.clay} icon={<Percent size={14} />} label="Conversão histórica" valor={`${kpis.conversao}%`} sub="ativos / (ativos+perdidos)" />
      </div>

      {/* Filtro */}
      {origensDisponiveis.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Filter size={14} style={{ color: t.textTertiary }} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Origem
          </span>
          <Select
            size="small"
            value={filtroOrigem}
            onChange={setFiltroOrigem}
            style={{ minWidth: 180 }}
            options={[
              { value: 'todas', label: `Todas (${clientes.length})` },
              ...origensDisponiveis.map((o) => ({
                value: o,
                label: `${ORIGEM_LABEL_MAP[o] || o} (${clientes.filter((c) => c.origemContato === o).length})`,
              })),
            ]}
          />
        </div>
      )}

      {/* Colunas do kanban */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${PIPELINE_ESTAGIOS.length}, 1fr)`,
        gap: 12,
        alignItems: 'flex-start',
      }}>
        {PIPELINE_ESTAGIOS.map((est) => {
          const cards = porEstagio.get(est.value) || [];
          const totalCol = cards.reduce((acc, c) => acc + Number(c.ticketPrevisto || 0), 0);
          return (
            <div
              key={est.value}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('pessoaId');
                if (id) moverParaEstagio(id, est.value);
                setDraggingId(null);
              }}
              style={{
                background: t.surfaceMuted,
                border: `1px solid ${t.borderSoft}`,
                borderRadius: 12,
                padding: 12,
                minHeight: 360,
              }}
            >
              {/* Cabeçalho da coluna */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 13, color: t.text, lineHeight: 1.2 }}>
                    {est.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.textTertiary, fontFamily: FONTS.mono, marginTop: 2 }}>
                    {cards.length} {cards.length === 1 ? 'opo.' : 'opos.'} · {brl(totalCol)}
                  </div>
                </div>
                <Tooltip title={`Probabilidade do estágio: ${Math.round(est.prob * 100)}%`}>
                  <Tag bordered={false} style={{
                    background: t.surface, color: t.textSecondary, fontFamily: FONTS.mono,
                    fontSize: 10, borderRadius: 6, padding: '0 6px', margin: 0,
                  }}>
                    {Math.round(est.prob * 100)}%
                  </Tag>
                </Tooltip>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span style={{ color: t.textTertiary, fontSize: 11 }}>arraste pra cá</span>}
                    style={{ margin: '24px 0', opacity: 0.5 }}
                  />
                ) : cards.map((p) => (
                  <CardOportunidade
                    key={p.id}
                    p={p}
                    isDragging={draggingId === p.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('pessoaId', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(p.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setSnapshotPessoa({ id: p.id, nome: p.empresa || p.nome })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer do cliente */}
      <ClienteSnapshotDrawer
        pessoaId={snapshotPessoa?.id || null}
        pessoaNome={snapshotPessoa?.nome}
        onClose={() => { setSnapshotPessoa(null); carregar(); }}
      />
    </div>
  );
}

// ─── Sub-componentes locais ──────────────────────────────────────────────────

function KpiBox({ cor, icon, label, valor, sub }: { cor: string; icon: React.ReactNode; label: string; valor: string; sub?: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ padding: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: cor }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {sub && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CardOportunidade({ p, isDragging, onDragStart, onDragEnd, onClick }: {
  p: Pessoa;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}): React.ReactElement {
  const t = useTokens();
  const empresa = p.empresa || p.nome || '—';
  const ticket = Number(p.ticketPrevisto || 0);
  const origem = p.origemContato ? (ORIGEM_LABEL_MAP[p.origemContato] || p.origemContato) : '';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: 10,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'transform 0.12s ease, box-shadow 0.18s ease',
        boxShadow: isDragging ? 'none' : '0 1px 0 rgba(0,0,0,0.02)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px -8px rgba(0,0,0,0.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,0.02)'; }}
    >
      {/* Header do card: empresa + ticket */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Building2 size={11} style={{ color: t.textTertiary, flexShrink: 0 }} />
            <span style={{
              fontFamily: FONTS.ui, fontWeight: 600, fontSize: 13, color: t.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={empresa}>
              {empresa}
            </span>
          </div>
          {p.nomeContato && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, paddingLeft: 17, lineHeight: 1.2 }}>
              {p.nomeContato}{p.cargo ? ` · ${p.cargo}` : ''}
            </div>
          )}
        </div>
        <GripVertical size={12} style={{ color: t.border, flexShrink: 0, marginTop: 2 }} />
      </div>

      {/* Valor */}
      {ticket > 0 && (
        <div style={{
          fontFamily: FONTS.display, fontSize: 16, fontWeight: 600,
          color: t.accents.sage, marginTop: 8, fontVariantNumeric: 'tabular-nums',
        }}>
          {brl(ticket)}
        </div>
      )}

      {/* Próxima ação */}
      {p.proximaAcao && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          background: t.surfaceMuted,
          borderRadius: 6,
          fontFamily: FONTS.ui,
          fontSize: 11.5,
          color: t.textSecondary,
          lineHeight: 1.4,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 5,
        }}>
          <ArrowRight size={11} style={{ color: t.accents.peach, flexShrink: 0, marginTop: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {p.proximaAcao}
          </span>
        </div>
      )}

      {/* Footer: origem */}
      {origem && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <Tag bordered={false} style={{
            background: `${t.accents.blue}14`, color: t.accents.blue,
            fontSize: 10, borderRadius: 999, margin: 0, padding: '0 8px',
          }}>
            {origem}
          </Tag>
        </div>
      )}
    </div>
  );
}
