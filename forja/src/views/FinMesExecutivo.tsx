// FinMesExecutivo — "Meu mês": visão executiva e enxuta do Financeiro Pessoal.
//
// Abrir e bater o olho no mês: tudo que entra e sai numa lista limpa, cada
// cartão como UMA linha (nome + total da fatura) com toggle de pago ao lado,
// despesas avulsas (pix/débito/dinheiro) individuais, breakdown por categoria e
// por método ("como paguei") e checagem de orçamento. Navegando pra frente,
// mostra os lançamentos PREVISTOS (parcelas, recorrências, salário) pra você ver
// se ainda cabe e quanto sobra. Dados: getMesExecutivo (projeta o futuro).
import React, { useState, useEffect, useCallback } from 'react';
import { App as AntApp, Spin, Empty, Button, Tooltip, Modal, Select, Tag } from 'antd';
import {
  TrendingUp, TrendingDown, Wallet, CreditCard, Check, Clock,
  Smartphone, Banknote, FileText, ArrowLeftRight, Target, Sparkles, Plus, CalendarClock,
  PiggyBank, RefreshCw, ChevronLeft, ChevronRight, Undo2, Pencil,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { MesExecutivo, MesExecutivoItem, MesExecutivoCartao, CategoriaPessoal, LancamentoPessoal, CartaoPessoal, ServerResponse } from '../types';

interface Props {
  mes: string;
  // Visão do mês já pronta, vinda do bootstrap essencial do FinPessoal. Quando
  // presente (e do mês certo), evita a chamada extra de getMesExecutivo no mount.
  dadosIniciais?: MesExecutivo | null;
  categorias: CategoriaPessoal[];
  lancamentos: LancamentoPessoal[];
  cartoes: CartaoPessoal[];
  onRecarregar: () => void;
  onAbrirCartao: (cartaoId: string) => void;
  onNovoLancamento: () => void;
  onIrParaOrcamentos: () => void;
  onNavegarMes: (delta: number) => void;
  onMesHoje: () => void;
  onEditar: (l: LancamentoPessoal) => void;
}

const METODO_META: Record<string, { label: string; cor: string; icon: React.ReactNode }> = {
  cartao: { label: 'Cartão', cor: '#8b5cf6', icon: <CreditCard size={13} /> },
  pix: { label: 'Pix', cor: '#10b981', icon: <Smartphone size={13} /> },
  debito: { label: 'Débito', cor: '#3b82f6', icon: <CreditCard size={13} /> },
  dinheiro: { label: 'Dinheiro', cor: '#f59e0b', icon: <Banknote size={13} /> },
  boleto: { label: 'Boleto', cor: '#6b7280', icon: <FileText size={13} /> },
  transferencia: { label: 'Transferência', cor: '#06b6d4', icon: <ArrowLeftRight size={13} /> },
};

export default function FinMesExecutivo({ mes, dadosIniciais, categorias, lancamentos, cartoes, onRecarregar, onAbrirCartao, onNovoLancamento, onIrParaOrcamentos, onNavegarMes, onMesHoje, onEditar }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const temIniciais = !!dadosIniciais && dadosIniciais.mes === mes;
  const [data, setData] = useState<MesExecutivo | null>(temIniciais ? dadosIniciais! : null);
  const [loading, setLoading] = useState(!temIniciais);
  const [flight, setFlight] = useState<Record<string, boolean>>({});
  // Drill-down de categoria: lista os lançamentos do mês daquela categoria
  // (em TODOS os cartões + avulsos), com recategorizar inline e editar.
  const [catDetalhe, setCatDetalhe] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [reclassificando, setReclassificando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<MesExecutivo>>('getMesExecutivo', mes)
      .then((r) => { if (r?.ok && r.data) setData(r.data as MesExecutivo); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  }, [mes]);

  // Estratégia de carga da visão do mês:
  //   • Bootstrap já trouxe ESTE mês → usa direto (zero chamada extra).
  //   • Nunca recebemos bootstrap (uso standalone) → busca sob demanda.
  //   • Bootstrap existe mas de OUTRO mês (navegação) → espera o pai empurrar a
  //     visão do novo mês (ele recarrega ao trocar de mês), evitando chamada
  //     dupla. Mostra o loading enquanto isso.
  useEffect(() => {
    if (dadosIniciais && dadosIniciais.mes === mes) {
      setData(dadosIniciais);
      setLoading(false);
      return;
    }
    if (!dadosIniciais) { carregar(); return; }
    setLoading(true);
  }, [carregar, dadosIniciais, mes]);

  const corCategoria = (nome: string): string => categorias.find((c) => c.nome === nome)?.cor || t.accents.peach;
  const labelCategoria = (nome: string): string => {
    const c = categorias.find((x) => x.nome === nome);
    return c ? (c.emoji ? `${c.emoji} ${c.label}` : c.label) : (nome || 'Outros');
  };

  // Recategoriza um lançamento e ENSINA a regra (comércio → categoria), que é
  // reaplicada nos itens iguais do mês — igual à classificação da antiga Visão geral.
  const recategorizar = async (l: LancamentoPessoal, novaCat: string) => {
    if (!novaCat || novaCat === (l.categoria || 'outros')) return;
    setSalvandoId(l.id);
    const res = await callServer<ServerResponse<unknown>>('salvarLancamentoPessoal', { ...l, categoria: novaCat });
    if (res?.ok) {
      await callServer<ServerResponse<unknown>>('salvarRegraCategoria', l.descricao || '', novaCat);
      await callServer<ServerResponse<unknown>>('aplicarRegrasCategoria', mes, true);
      message.success('Recategorizado — vou repetir isso em lançamentos iguais');
      carregar(); onRecarregar();
    } else {
      message.error((res && res.error) || 'Erro ao recategorizar');
    }
    setSalvandoId(null);
  };

  const reclassificarIA = async () => {
    setReclassificando(true);
    const res = await callServer<ServerResponse<{ porRegra: number; porIA: number; restantes: number }>>('reclassificarCategoriasIA', mes);
    setReclassificando(false);
    if (res?.ok) {
      const d = (res.data as { porRegra: number; porIA: number } | undefined) || { porRegra: 0, porIA: 0 };
      const tot = (d.porRegra || 0) + (d.porIA || 0);
      message.success(tot > 0 ? `${tot} lançamento(s) reclassificado(s)` : 'Nada pra reclassificar');
      carregar(); onRecarregar();
    } else {
      message.error((res && res.error) || 'Erro ao reclassificar com IA');
    }
  };

  // Lançamentos (despesa) do mês na categoria aberta — em todos os cartões/avulsos.
  const itensCat = catDetalhe
    ? lancamentos.filter((l) => l.tipo === 'despesa' && (l.categoria || 'outros') === catDetalhe)
    : [];
  const totalCat = itensCat.reduce((s, l) => s + Math.abs(Number(l.valor || 0)), 0);

  // Toggle de pago de um item (receita ou despesa avulsa). OTIMISTA: vira o
  // status no estado local na hora (feedback instantâneo no tablet), depois
  // reconcilia com o servidor (`carregar` = 1 RPC) e atualiza o pai em segundo
  // plano. Em caso de erro, o `carregar` desfaz o otimismo trazendo o real.
  const toggleItem = (item: MesExecutivoItem) => {
    if (item.projecao || !item.id || flight[item.id]) return;
    const novo = item.status === 'pago' ? 'pendente' : 'pago';
    setData((prev) => (prev ? {
      ...prev,
      receitas: prev.receitas.map((x) => (x.id === item.id ? { ...x, status: novo } : x)),
      avulsas: prev.avulsas.map((x) => (x.id === item.id ? { ...x, status: novo } : x)),
    } : prev));
    setFlight((f) => ({ ...f, [item.id]: true }));
    callServer<ServerResponse<unknown>>('marcarLancamentoStatus', item.id, novo)
      .then((r) => {
        if (r?.ok) { carregar(); onRecarregar(); }
        else { message.error(r?.error || 'Erro ao mudar status'); carregar(); }
      })
      .catch(() => { message.error('Disponível apenas no app publicado'); carregar(); })
      .finally(() => setFlight((f) => { const n = { ...f }; delete n[item.id]; return n; }));
  };

  // Toggle de pago de uma fatura inteira (cartão). Mesma estratégia otimista.
  const toggleCartao = (c: MesExecutivoCartao) => {
    if (c.projecao || c.lancamentoIds.length === 0 || flight[c.cartaoId]) return;
    const novo = c.pago ? 'pendente' : 'pago';
    setData((prev) => (prev ? {
      ...prev,
      cartoes: prev.cartoes.map((x) => (x.cartaoId === c.cartaoId ? { ...x, pago: novo === 'pago' } : x)),
    } : prev));
    setFlight((f) => ({ ...f, [c.cartaoId]: true }));
    callServer<ServerResponse<unknown>>('marcarLancamentosStatus', JSON.stringify(c.lancamentoIds), novo)
      .then((r) => {
        if (r?.ok) { carregar(); onRecarregar(); }
        else { message.error(r?.error || 'Erro ao dar baixa na fatura'); carregar(); }
      })
      .catch(() => { message.error('Disponível apenas no app publicado'); carregar(); })
      .finally(() => setFlight((f) => { const n = { ...f }; delete n[c.cartaoId]; return n; }));
  };

  if (loading && !data) return <Spin style={{ display: 'block', margin: '64px auto' }} />;
  if (!data) return <Empty description="Não consegui carregar o mês." style={{ marginTop: 48 }} />;

  const { totais, futuro } = data;
  const semNada = data.receitas.length === 0 && data.cartoes.length === 0 && data.avulsas.length === 0;
  const pctPago = totais.despesas > 0 ? Math.min(100, (totais.pago / totais.despesas) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Navegador de mês — ver os meses à frente (previstos) sem sair da tela. */}
      <MesNavegador mes={mes} t={t} onNavegar={onNavegarMes} onHoje={onMesHoje} />

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
              <Breakdown dados={data.porCategoria} total={totais.despesas} t={t} corDe={corCategoria} labelDe={labelCategoria} onSelecionar={(k) => setCatDetalhe(k)} />
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

      {/* Modal de composição da categoria — lançamentos do mês em todos os
          cartões/avulsos, com recategorizar inline e editar. */}
      <Modal
        open={!!catDetalhe}
        onCancel={() => setCatDetalhe(null)}
        footer={null}
        width={640}
        title={catDetalhe ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${corCategoria(catDetalhe)}1f`, border: `1px solid ${corCategoria(catDetalhe)}40`, color: corCategoria(catDetalhe) }}>
              <Wallet size={15} />
            </span>
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{labelCategoria(catDetalhe)}</div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
                {itensCat.length} lançamento{itensCat.length === 1 ? '' : 's'} · {formatBRL(totalCat)}
              </div>
            </div>
          </div>
        ) : 'Categoria'}
      >
        {catDetalhe === 'outros' && itensCat.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: `${t.accents.lavender}14`, border: `1px solid ${t.accents.lavender}40`,
            borderRadius: 10, padding: '10px 12px', marginBottom: 12,
          }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
              A IA tenta encaixar esses itens nas suas categorias e aprende com o que você corrige.
            </span>
            <Button
              size="small" type="primary" icon={<Sparkles size={14} />} loading={reclassificando}
              onClick={() => void reclassificarIA()}
              style={{ background: t.accents.lavender, borderColor: t.accents.lavender, flexShrink: 0 }}
            >
              {reclassificando ? 'Reclassificando…' : 'Reclassificar com IA'}
            </Button>
          </div>
        )}
        {itensCat.length === 0 ? (
          <Empty description="Nenhum lançamento nesta categoria neste mês" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
            {itensCat.map((l) => {
              const cartao = cartoes.find((c) => c.id === l.cartaoId);
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.descricao || '(sem descrição)'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      {cartao ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cartao.cor }} />
                          {cartao.apelido || cartao.nome}
                        </span>
                      ) : (
                        l.metodo && <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'capitalize' }}>{l.metodo}</span>
                      )}
                      <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                        {dayjs(l.data).format('DD/MM/YYYY')}
                      </span>
                      {l.status && l.status !== 'pago' && (
                        <Tag bordered={false} style={{ marginInlineEnd: 0, background: `${t.accents.peach}22`, color: t.accents.peach, fontSize: 10 }}>
                          {l.status}
                        </Tag>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: FONTS.display, fontSize: 14, color: t.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatBRL(Math.abs(Number(l.valor || 0)))}
                  </span>
                  <Select
                    size="small"
                    value={l.categoria || 'outros'}
                    loading={salvandoId === l.id}
                    disabled={salvandoId === l.id}
                    onChange={(v) => void recategorizar(l, v)}
                    style={{ width: 150, flexShrink: 0 }}
                    options={categorias.filter((c) => c.ativo !== 'nao').map((c) => ({ value: c.nome, label: c.label || c.nome }))}
                  />
                  <Tooltip title="Editar lançamento">
                    <Button size="small" type="text" icon={<Pencil size={13} />}
                      onClick={() => { setCatDetalhe(null); onEditar(l); }} />
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

type Tokens = ReturnType<typeof useTokens>;

// Navegador de mês embutido na própria tela "Meu mês": setas pra andar pra
// frente (ver previstos) e pra trás, com atalho "hoje". Mostra a distância em
// meses ("daqui a 2 meses" / "há 1 mês") pra dar contexto sem precisar contar.
function MesNavegador({ mes, t, onNavegar, onHoje }: { mes: string; t: Tokens; onNavegar: (delta: number) => void; onHoje: () => void }): React.ReactElement {
  const [yyyy, mm] = mes.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hoje = new Date();
  const delta = (yyyy - hoje.getFullYear()) * 12 + (mm - 1 - hoje.getMonth());
  const ehAtual = delta === 0;
  const contexto = ehAtual
    ? 'mês atual'
    : delta > 0
      ? (delta === 1 ? 'mês que vem · previsto' : `daqui a ${delta} meses · previsto`)
      : (delta === -1 ? 'mês passado' : `há ${Math.abs(delta)} meses`);

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
    background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, color: t.textSecondary,
    transition: 'all 0.15s',
  };
  const hoverOn = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = t.accents.lavender + '66'; el.style.color = t.accents.lavender; };
  const hoverOff = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = t.borderSoft; el.style.color = t.textSecondary; };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={btn} onClick={() => onNavegar(-1)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 168, textAlign: 'center' }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text, textTransform: 'capitalize', lineHeight: 1.15 }}>{label}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: delta > 0 ? t.accents.lavender : t.textTertiary }}>{contexto}</span>
      </div>
      <button style={btn} onClick={() => onNavegar(1)} onMouseEnter={hoverOn} onMouseLeave={hoverOff} aria-label="Próximo mês">
        <ChevronRight size={16} />
      </button>
      {!ehAtual && (
        <Button type="text" size="small" onClick={onHoje} style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12 }}>
          hoje
        </Button>
      )}
    </div>
  );
}

function HeroNum({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: number; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, borderLeft: `1px solid ${t.borderSoft}`, paddingLeft: 16 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
        <span style={{ color: cor }}>{icon}</span> {label}
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
  const [hoverPago, setHoverPago] = useState(false);
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
        <Tooltip title={pago ? `Clique para marcar como "${labelPendente.toLowerCase()}"` : `Clique para marcar como "${labelPago.toLowerCase()}"`}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            onMouseEnter={() => setHoverPago(true)}
            onMouseLeave={() => setHoverPago(false)}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap',
              border: `1px solid ${pago ? (hoverPago ? t.accents.rose + '66' : t.accents.sage + '66') : t.accents.peach + '55'}`,
              background: pago ? (hoverPago ? `${t.accents.rose}14` : `${t.accents.sage}1a`) : (hoverPago ? `${t.accents.sage}14` : 'transparent'),
              color: pago ? (hoverPago ? t.accents.rose : t.accents.sage) : (hoverPago ? t.accents.sage : t.accents.peach),
              opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {pago
              ? (hoverPago ? <><Undo2 size={13} /> {labelPendente}</> : <><Check size={13} /> {labelPago}</>)
              : (hoverPago ? <><Check size={13} /> {labelPago} ?</> : <><Clock size={13} /> {labelPendente}</>)}
          </button>
        </Tooltip>
      )}
    </div>
  );
}

// Mini-breakdown: barras horizontais proporcionais (categoria ou método).
// Com `onSelecionar`, cada linha vira clicável (drill-down) com chevron e hover.
function Breakdown({ dados, total, t, corDe, labelDe, onSelecionar }: {
  dados: Record<string, number>; total: number; t: Tokens;
  corDe: (k: string) => string; labelDe: (k: string) => string;
  onSelecionar?: (k: string) => void;
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
        const clicavel = !!onSelecionar;
        return (
          <div
            key={k}
            onClick={clicavel ? () => onSelecionar(k) : undefined}
            title={clicavel ? 'Ver lançamentos desta categoria' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: clicavel ? 'pointer' : 'default',
              borderRadius: 9, padding: clicavel ? 6 : 0, margin: clicavel ? -6 : 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={clicavel ? (e) => { (e.currentTarget as HTMLDivElement).style.background = t.surfaceMuted; } : undefined}
            onMouseLeave={clicavel ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } : undefined}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelDe(k)}</span>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.text, fontWeight: 600, flexShrink: 0 }}>{formatBRL(valor)} <span style={{ color: t.textTertiary, fontWeight: 400 }}>· {pct.toFixed(0)}%</span></span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: cor, transition: 'width 0.3s' }} />
              </div>
            </div>
            {clicavel && <ChevronRight size={15} color={t.textTertiary} style={{ flexShrink: 0 }} />}
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
