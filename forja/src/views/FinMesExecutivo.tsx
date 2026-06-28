// FinMesExecutivo — "Meu mês": visão executiva e enxuta do Financeiro Pessoal.
//
// Abrir e bater o olho no mês: tudo que entra e sai numa lista limpa, cada
// cartão como UMA linha (nome + total da fatura) com toggle de pago ao lado,
// despesas avulsas (pix/débito/dinheiro) individuais, breakdown por categoria e
// por método ("como paguei") e checagem de orçamento. Navegando pra frente,
// mostra os lançamentos PREVISTOS (parcelas, recorrências, salário) pra você ver
// se ainda cabe e quanto sobra. Dados: getMesExecutivo (projeta o futuro).
import React, { useState, useEffect, useCallback } from 'react';
import { App as AntApp, Spin, Empty, Button, Tooltip } from 'antd';
import {
  TrendingUp, TrendingDown, Wallet, CreditCard, Check, Clock,
  Smartphone, Banknote, FileText, ArrowLeftRight, Target, Sparkles, Plus, CalendarClock,
  PiggyBank, RefreshCw,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { MesExecutivo, MesExecutivoItem, MesExecutivoCartao, CategoriaPessoal, ServerResponse } from '../types';

interface Props {
  mes: string;
  categorias: CategoriaPessoal[];
  onRecarregar: () => void;
  onAbrirCartao: (cartaoId: string) => void;
  onNovoLancamento: () => void;
  onIrParaOrcamentos: () => void;
}

const METODO_META: Record<string, { label: string; cor: string; icon: React.ReactNode }> = {
  cartao: { label: 'Cartão', cor: '#8b5cf6', icon: <CreditCard size={13} /> },
  pix: { label: 'Pix', cor: '#10b981', icon: <Smartphone size={13} /> },
  debito: { label: 'Débito', cor: '#3b82f6', icon: <CreditCard size={13} /> },
  dinheiro: { label: 'Dinheiro', cor: '#f59e0b', icon: <Banknote size={13} /> },
  boleto: { label: 'Boleto', cor: '#6b7280', icon: <FileText size={13} /> },
  transferencia: { label: 'Transferência', cor: '#06b6d4', icon: <ArrowLeftRight size={13} /> },
};

export default function FinMesExecutivo({ mes, categorias, onRecarregar, onAbrirCartao, onNovoLancamento, onIrParaOrcamentos }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<MesExecutivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [flight, setFlight] = useState<Record<string, boolean>>({});

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<MesExecutivo>>('getMesExecutivo', mes)
      .then((r) => { if (r?.ok && r.data) setData(r.data as MesExecutivo); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(carregar, [carregar]);

  const corCategoria = (nome: string): string => categorias.find((c) => c.nome === nome)?.cor || t.accents.peach;
  const labelCategoria = (nome: string): string => {
    const c = categorias.find((x) => x.nome === nome);
    return c ? (c.emoji ? `${c.emoji} ${c.label}` : c.label) : (nome || 'Outros');
  };

  // Toggle de pago de um item (receita ou despesa avulsa).
  const toggleItem = (item: MesExecutivoItem) => {
    if (item.projecao || !item.id || flight[item.id]) return;
    const novo = item.status === 'pago' ? 'pendente' : 'pago';
    setFlight((f) => ({ ...f, [item.id]: true }));
    callServer<ServerResponse<unknown>>('marcarLancamentoStatus', item.id, novo)
      .then((r) => {
        if (r?.ok) { carregar(); onRecarregar(); }
        else message.error(r?.error || 'Erro ao mudar status');
      })
      .catch(() => message.error('Disponível apenas no app publicado'))
      .finally(() => setFlight((f) => { const n = { ...f }; delete n[item.id]; return n; }));
  };

  // Toggle de pago de uma fatura inteira (cartão).
  const toggleCartao = (c: MesExecutivoCartao) => {
    if (c.projecao || c.lancamentoIds.length === 0 || flight[c.cartaoId]) return;
    const novo = c.pago ? 'pendente' : 'pago';
    setFlight((f) => ({ ...f, [c.cartaoId]: true }));
    callServer<ServerResponse<unknown>>('marcarLancamentosStatus', JSON.stringify(c.lancamentoIds), novo)
      .then((r) => {
        if (r?.ok) { carregar(); onRecarregar(); }
        else message.error(r?.error || 'Erro ao dar baixa na fatura');
      })
      .catch(() => message.error('Disponível apenas no app publicado'))
      .finally(() => setFlight((f) => { const n = { ...f }; delete n[c.cartaoId]; return n; }));
  };

  if (loading && !data) return <Spin style={{ display: 'block', margin: '64px auto' }} />;
  if (!data) return <Empty description="Não consegui carregar o mês." style={{ marginTop: 48 }} />;

  const { totais, futuro } = data;
  const semNada = data.receitas.length === 0 && data.cartoes.length === 0 && data.avulsas.length === 0;
  const pctPago = totais.despesas > 0 ? Math.min(100, (totais.pago / totais.despesas) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Faixa executiva: Sobra em destaque + Entradas/Saídas + barra de pago */}
      <div
        style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16,
          padding: 20, boxShadow: t.shadowSoft,
          display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(2, minmax(140px, 1fr))', gap: 18,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {futuro ? 'Sobra prevista' : 'Sobra do mês'}
            </span>
            {futuro && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: t.accents.lavender, background: `${t.accents.lavender}1a`, padding: '1px 7px', borderRadius: 999 }}>
                <CalendarClock size={11} /> previsto
              </span>
            )}
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 34, fontWeight: 600, lineHeight: 1.05, color: totais.sobra >= 0 ? t.accents.sage : t.accents.rose }}>
            {totais.sobra >= 0 ? '' : '–'}{formatBRL(Math.abs(totais.sobra))}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
            {totais.sobra >= 0 ? 'sobra das suas receitas neste mês' : 'as despesas superam as receitas'}
          </div>
        </div>
        <HeroNum icon={<TrendingUp size={18} />} label="Entradas" valor={totais.entradas} cor={t.accents.sage} />
        <HeroNum icon={<TrendingDown size={18} />} label="Saídas" valor={totais.despesas} cor={t.accents.rose} />
        <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
              Pago <strong style={{ color: t.text }}>{formatBRL(totais.pago)}</strong> de {formatBRL(totais.despesas)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {totais.investido > 0 && (
                <Tooltip title="Despesas na categoria Investimento — dinheiro guardado, não gasto.">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: t.accents.blue, background: `${t.accents.blue}14`, border: `1px solid ${t.accents.blue}33`, padding: '2px 9px', borderRadius: 999 }}>
                    <PiggyBank size={12} /> {formatBRL(totais.investido)} investido
                  </span>
                </Tooltip>
              )}
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.accents.peach }}>
                {formatBRL(totais.aPagar)} a pagar
              </span>
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
            <div style={{ width: `${pctPago}%`, height: '100%', background: t.accents.sage, transition: 'width 0.3s' }} />
          </div>

          {/* Fixas × Variáveis: a leitura que a planilha amada faz — quanto do mês
              é compromisso recorrente vs gasto livre. Só aparece quando há os dois. */}
          {totais.fixas > 0 && totais.variaveis > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: t.accents.lavender }} />
                  Fixas <strong style={{ color: t.text }}>{formatBRL(totais.fixas)}</strong>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                  Variáveis <strong style={{ color: t.text }}>{formatBRL(totais.variaveis)}</strong>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: t.accents.peach }} />
                </span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: t.surfaceMuted }}>
                <div style={{ width: `${totais.despesas > 0 ? (totais.fixas / totais.despesas) * 100 : 0}%`, background: t.accents.lavender, transition: 'width 0.3s' }} />
                <div style={{ width: `${totais.despesas > 0 ? (totais.variaveis / totais.despesas) * 100 : 0}%`, background: t.accents.peach, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {futuro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: `${t.accents.lavender}10`, border: `1px solid ${t.accents.lavender}33`, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
          <CalendarClock size={15} color={t.accents.lavender} style={{ flexShrink: 0 }} />
          Mês futuro — mostrando o previsto: parcelas do cartão, despesas e receitas recorrentes. Itens previstos não podem ser marcados como pagos.
        </div>
      )}

      {semNada ? (
        <Panel>
          <Empty description={`Nenhum lançamento ${futuro ? 'previsto' : ''} neste mês.`}>
            <Button type="primary" icon={<Plus size={14} />} onClick={onNovoLancamento} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
              Novo lançamento
            </Button>
          </Empty>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          {/* Coluna esquerda: receitas + despesas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Receitas */}
            <Panel
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color={t.accents.sage} /> Receitas
                  <Contador n={data.receitas.length} t={t} />
                </span>
              }
              extra={<span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.accents.sage }}>{formatBRL(totais.entradas)}</span>}
            >
              {data.receitas.length === 0 ? (
                <Vazio texto="Nenhuma entrada neste mês." t={t} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.receitas.map((r) => (
                    <Linha
                      key={r.id}
                      t={t}
                      cor={t.accents.sage}
                      icon={<TrendingUp size={15} color={t.accents.sage} />}
                      titulo={r.descricao}
                      sub={r.data ? fmtDia(r.data) : ''}
                      valor={r.valor}
                      projecao={r.projecao}
                      pago={r.status === 'pago'}
                      labelPago="Recebido"
                      labelPendente="A receber"
                      loading={!!flight[r.id]}
                      onToggle={() => toggleItem(r)}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Despesas: cartões colapsados + avulsas */}
            <Panel
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <TrendingDown size={16} color={t.accents.rose} /> Despesas
                  <Contador n={data.cartoes.length + data.avulsas.length} t={t} />
                </span>
              }
              extra={<span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.accents.rose }}>{formatBRL(totais.despesas)}</span>}
            >
              {data.cartoes.length === 0 && data.avulsas.length === 0 ? (
                <Vazio texto="Nenhuma despesa neste mês." t={t} />
              ) : (() => {
                const fixasItens = data.avulsas.filter((a) => a.fixo);
                const variaveisAvulsas = data.avulsas.filter((a) => !a.fixo);
                const temVariaveis = data.cartoes.length > 0 || variaveisAvulsas.length > 0;
                // Só mostra os rótulos Fixas/Variáveis quando há de fato os dois
                // tipos — em meses simples, fica uma lista limpa sem cabeçalhos.
                const agrupar = fixasItens.length > 0 && temVariaveis;
                const renderAvulsa = (a: MesExecutivoItem) => {
                  const m = METODO_META[a.metodo || 'pix'] || METODO_META.pix;
                  return (
                    <Linha
                      key={a.id}
                      t={t}
                      cor={m.cor}
                      icon={<span style={{ color: m.cor, display: 'inline-flex' }}>{m.icon}</span>}
                      titulo={a.descricao}
                      sub={`${m.label}${a.categoria ? ` · ${labelCategoria(a.categoria)}` : ''}`}
                      valor={a.valor}
                      projecao={a.projecao}
                      pago={a.status === 'pago'}
                      labelPago="Pago"
                      labelPendente="Pendente"
                      loading={!!flight[a.id]}
                      onToggle={() => toggleItem(a)}
                    />
                  );
                };
                const renderCartao = (c: MesExecutivoCartao) => (
                  <Linha
                    key={c.cartaoId}
                    t={t}
                    cor={c.cor || t.accents.lavender}
                    icon={<CreditCard size={15} color={c.cor || t.accents.lavender} />}
                    titulo={c.nome}
                    sub={`${c.qtdItens} lançamento${c.qtdItens === 1 ? '' : 's'} · ver fatura`}
                    valor={c.total}
                    projecao={c.projecao}
                    pago={c.pago}
                    labelPago="Paga"
                    labelPendente="Em aberto"
                    loading={!!flight[c.cartaoId]}
                    onToggle={() => toggleCartao(c)}
                    onAbrir={() => onAbrirCartao(c.cartaoId)}
                  />
                );
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: agrupar ? 16 : 8 }}>
                    {agrupar && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <SubGrupo t={t} icon={<RefreshCw size={12} color={t.accents.lavender} />} titulo="Fixas" subtotal={totais.fixas} hint="Contas e assinaturas que se repetem todo mês." />
                        {fixasItens.map(renderAvulsa)}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {agrupar && (
                        <SubGrupo t={t} icon={<Sparkles size={12} color={t.accents.peach} />} titulo="Variáveis" subtotal={totais.variaveis} hint="Cartões e gastos avulsos do mês." />
                      )}
                      {data.cartoes.map(renderCartao)}
                      {(agrupar ? variaveisAvulsas : data.avulsas).map(renderAvulsa)}
                    </div>
                  </div>
                );
              })()}
            </Panel>
          </div>

          {/* Coluna direita: por categoria, como paguei, orçamento */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Wallet size={16} color={t.accents.peach} /> Por categoria</span>}>
              <Breakdown dados={data.porCategoria} total={totais.despesas} t={t} corDe={corCategoria} labelDe={labelCategoria} />
            </Panel>

            <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CreditCard size={16} color={t.accents.blue} /> Como você pagou</span>}>
              <Breakdown
                dados={data.porMetodo}
                total={totais.despesas}
                t={t}
                corDe={(k) => (METODO_META[k]?.cor || t.accents.blue)}
                labelDe={(k) => (METODO_META[k]?.label || k)}
              />
            </Panel>

            <Panel
              title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Target size={16} color={t.accents.sage} /> Cabe no orçamento?</span>}
              extra={<Button type="text" size="small" style={{ color: t.textTertiary }} onClick={onIrParaOrcamentos}>gerenciar</Button>}
            >
              {data.orcamentos.length === 0 ? (
                <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, lineHeight: 1.6 }}>
                  Você ainda não definiu tetos por categoria. <a onClick={onIrParaOrcamentos} style={{ color: t.accents.sage, cursor: 'pointer' }}>Criar orçamentos</a> pra ver se o mês cabe.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.orcamentos.map((o) => {
                    const pct = Math.min(100, o.pct);
                    const cor = o.cabe ? (o.pct >= 80 ? t.accents.peach : t.accents.sage) : t.accents.rose;
                    return (
                      <div key={o.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, textTransform: 'capitalize' }}>{labelCategoria(o.categoria)}</span>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: cor, fontWeight: 600 }}>
                            {o.cabe ? `sobra ${formatBRL(o.restante)}` : `passou ${formatBRL(-o.restante)}`}
                          </span>
                        </div>
                        <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cor, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 3 }}>
                          {formatBRL(o.gasto)} de {formatBRL(o.limite)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

type Tokens = ReturnType<typeof useTokens>;

function HeroNum({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: number; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, borderLeft: `1px solid ${t.borderSoft}`, paddingLeft: 16 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
        <span style={{ color }}>{icon}</span> {label}
      </span>
      <span style={{ fontFamily: FONTS.display, fontSize: 21, fontWeight: 600, color: t.text }}>{formatBRL(valor)}</span>
    </div>
  );
}

function Contador({ n, t }: { n: number; t: Tokens }): React.ReactElement {
  return (
    <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, padding: '0 7px', borderRadius: 999, lineHeight: '17px' }}>{n}</span>
  );
}

function Vazio({ texto, t }: { texto: string; t: Tokens }): React.ReactElement {
  return <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, padding: '6px 2px' }}>{texto}</div>;
}

// Cabeçalho de subgrupo (Fixas / Variáveis) com subtotal à direita.
function SubGrupo({ t, icon, titulo, subtotal, hint }: { t: Tokens; icon: React.ReactNode; titulo: string; subtotal: number; hint: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
      {icon}
      <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{titulo}</span>
      <Tooltip title={hint}><span style={{ width: 5, height: 5, borderRadius: 999, background: t.borderSoft, cursor: 'help' }} /></Tooltip>
      <div style={{ flex: 1, height: 1, background: t.borderSoft }} />
      <span style={{ fontFamily: FONTS.display, fontSize: 12.5, fontWeight: 600, color: t.textSecondary }}>{formatBRL(subtotal)}</span>
    </div>
  );
}

// Linha de item: ícone · título/sub · valor · toggle de pago. Linha de cartão
// também recebe onAbrir (clique no corpo abre a fatura).
function Linha({
  t, cor, icon, titulo, sub, valor, projecao, pago, labelPago, labelPendente, loading, onToggle, onAbrir,
}: {
  t: Tokens; cor: string; icon: React.ReactNode; titulo: string; sub: string; valor: number;
  projecao: boolean; pago: boolean; labelPago: string; labelPendente: string; loading: boolean;
  onToggle: () => void; onAbrir?: () => void;
}): React.ReactElement {
  const clicavel = !!onAbrir;
  return (
    <div
      onClick={onAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        borderRadius: 11, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
        cursor: clicavel ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={clicavel ? (e) => { (e.currentTarget as HTMLElement).style.borderColor = cor + '66'; } : undefined}
      onMouseLeave={clicavel ? (e) => { (e.currentTarget as HTMLElement).style.borderColor = t.borderSoft; } : undefined}
    >
      <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${cor}14`, border: `1px solid ${cor}30` }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
        {sub && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatBRL(valor)}</span>
      {projecao ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: t.accents.lavender, background: `${t.accents.lavender}14`, border: `1px solid ${t.accents.lavender}33`, padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>
          <CalendarClock size={11} /> previsto
        </span>
      ) : (
        <Tooltip title={pago ? 'Clique pra desmarcar' : 'Clique pra marcar como pago'}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              padding: '4px 11px', borderRadius: 999,
              border: `1px solid ${pago ? t.accents.sage + '66' : t.accents.peach + '55'}`,
              background: pago ? `${t.accents.sage}1a` : 'transparent',
              color: pago ? t.accents.sage : t.accents.peach,
              opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {pago ? <Check size={13} /> : <Clock size={13} />}
            {pago ? labelPago : labelPendente}
          </button>
        </Tooltip>
      )}
    </div>
  );
}

// Mini-breakdown: barras horizontais proporcionais (categoria ou método).
function Breakdown({ dados, total, t, corDe, labelDe }: {
  dados: Record<string, number>; total: number; t: Tokens;
  corDe: (k: string) => string; labelDe: (k: string) => string;
}): React.ReactElement {
  const itens = Object.keys(dados)
    .map((k) => ({ k, valor: dados[k] }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  if (itens.length === 0) return <Vazio texto="Sem despesas pra agrupar." t={t} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {itens.map(({ k, valor }) => {
        const pct = total > 0 ? (valor / total) * 100 : 0;
        const cor = corDe(k);
        return (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelDe(k)}</span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.text, fontWeight: 600, flexShrink: 0 }}>{formatBRL(valor)} <span style={{ color: t.textTertiary, fontWeight: 400 }}>· {pct.toFixed(0)}%</span></span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: cor, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtDia(iso: string): string {
  try { return new Date(iso.substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}
