// FinFamilia — aba "Família" do Financeiro Pessoal.
//
// Resolve o caso real: compras de familiares (filha, irmã, cunhada...) caem no
// SEU cartão e você precisa saber quem te deve, quem já pagou e o que veio na
// fatura e ainda não foi cobrado. Cadastro de membros + cobranças por mês, com
// status de pagamento, vínculo ao lançamento/assinatura de origem e detecção do
// que ainda não foi atribuído. Visual premium e minimalista.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, Switch,
  App as AntApp, Popconfirm, Empty, Tooltip, Drawer,
} from 'antd';
import {
  Plus, Pencil, Trash2, Users, CheckCircle2, Clock, CreditCard,
  Link2, AlertCircle, Repeat, HandCoins, FileDown, CalendarClock,
  CalendarRange, Layers, ListChecks,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Panel, formatBRL } from '../components/ui';
import { MembroAvatar, MEMBRO_ICONES, MEMBRO_ICONE_KEYS, membroIconeComponent } from '../components/membroIcone';
import { gerarEbaixarPdf } from '../pdf-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type {
  FamiliaMembro, Cobranca, ResumoFamilia, MembroResumo, NaoAtribuido,
  LancamentoPessoal, AssinaturaPessoal, CartaoPessoal, ServerResponse,
} from '../types';


// Cobrança + detalhe do lançamento de origem (vem de getCobrancasMembroDetalhado).
interface CobrancaDetalhada extends Cobranca {
  cartaoNome?: string;
  cartaoBandeira?: string;
  dataCompra?: string;
  metodo?: string;
  faturaCompetencia?: string;
  vencimentoFatura?: string;
  lancamentoValor?: number;
  parcelaAtual?: number;
  parcelasTotal?: number;
  parcelaGrupoId?: string;
}

// Provisionamento do membro por mês (vem de getProvisaoMembro).
interface ProvisaoMesMembro {
  competencia: string;
  total: number;
  pendente: number;
  pago: number;
  futuro: boolean;
  atrasado: boolean;
  itens: CobrancaDetalhada[];
}
interface ProvisaoMembro {
  mesAtual: string;
  totalPendente: number;
  totalPago: number;
  totalEsteMes: number;
  totalFuturo: number;
  totalAtrasado: number;
  porMes: ProvisaoMesMembro[];
}

function compToLabel(comp: string): string {
  const [y, m] = comp.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

interface FinFamiliaProps {
  mes: string;
  membros: FamiliaMembro[];
  cartoes: CartaoPessoal[];
  lancamentos: LancamentoPessoal[];
  assinaturas: AssinaturaPessoal[];
  onRecarregar: () => void;
  onSelecionarMes?: (comp: string) => void;
}

export default function FinFamilia({ mes, membros, cartoes, lancamentos, assinaturas, onRecarregar, onSelecionarMes }: FinFamiliaProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [resumo, setResumo] = useState<ResumoFamilia | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalMembro, setModalMembro] = useState(false);
  const [membroEdit, setMembroEdit] = useState<FamiliaMembro | null>(null);
  const [modalCobr, setModalCobr] = useState(false);
  const [cobrEdit, setCobrEdit] = useState<Cobranca | null>(null);
  const [cobrPrefill, setCobrPrefill] = useState<Partial<Cobranca> | null>(null);
  const [drawerMembro, setDrawerMembro] = useState<FamiliaMembro | null>(null);
  const [detalheCobr, setDetalheCobr] = useState<CobrancaDetalhada[] | null>(null);
  const [provisao, setProvisao] = useState<ProvisaoMembro | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Ao abrir o drawer do membro: busca as cobranças ENRIQUECIDAS (com cartão,
  // data da compra e vencimento da fatura) de todos os meses + o provisionamento
  // agrupado por mês (este mês × futuro × atrasado) pra visão de longo prazo.
  useEffect(() => {
    if (!drawerMembro) { setDetalheCobr(null); setProvisao(null); return; }
    setDetalheCobr(null);
    setProvisao(null);
    callServer<ServerResponse<CobrancaDetalhada[]>>('getCobrancasMembroDetalhado', drawerMembro.id)
      .then((res) => { if (res?.ok && Array.isArray(res.data)) setDetalheCobr(res.data as CobrancaDetalhada[]); else setDetalheCobr([]); })
      .catch(() => setDetalheCobr([]));
    callServer<ServerResponse<ProvisaoMembro>>('getProvisaoMembro', drawerMembro.id)
      .then((res) => { if (res?.ok && res.data) setProvisao(res.data as ProvisaoMembro); })
      .catch(() => { /* visão por mês fica indisponível, lista normal segue */ });
  }, [drawerMembro]);

  const baixarPdfMembro = (membro: FamiliaMembro) => {
    setPdfLoading(true);
    gerarEbaixarPdf('gerarPdfCobrancasMembro', membro.id, true)
      .then(() => message.success('PDF gerado'))
      .catch(() => message.error('Falha ao gerar PDF'))
      .finally(() => setPdfLoading(false));
  };

  const recarregarFamilia = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<unknown>>('gerarCobrancasRecorrentes', mes)
      .catch(() => { /* ok */ })
      .then(() => Promise.all([
        callServer<ServerResponse<ResumoFamilia>>('getResumoFamilia', mes),
        // Todas as cobranças (qualquer mês) — o drawer do membro mostra o
        // histórico completo do que ele deve/pagou, não só o mês ativo. Assim
        // uma atribuição lançada em outra competência nunca fica escondida.
        callServer<ServerResponse<Cobranca[]>>('getCobrancas'),
      ]))
      .then(([resR, cobR]) => {
        if (resR && resR.ok && resR.data) setResumo(resR.data as ResumoFamilia);
        if (cobR && cobR.ok && cobR.data) setCobrancas(cobR.data as Cobranca[]);
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(recarregarFamilia, [recarregarFamilia]);

  const refreshTudo = () => { recarregarFamilia(); onRecarregar(); };

  const abrirNovaCobranca = (prefill?: Partial<Cobranca>) => {
    setCobrEdit(null);
    setCobrPrefill(prefill || null);
    setModalCobr(true);
  };
  const abrirEditarCobranca = (c: Cobranca) => {
    setCobrEdit(c);
    setCobrPrefill(null);
    setModalCobr(true);
  };

  const togglePago = (c: Cobranca) => {
    callServer<ServerResponse<unknown>>('marcarCobrancaPaga', c.id, c.status !== 'pago').then((res) => {
      if (res.ok) refreshTudo(); else message.error(res.error || 'Erro');
    });
  };
  const removerCobranca = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarCobranca', id).then((res) => {
      if (res.ok) { message.success('Cobrança removida'); refreshTudo(); } else message.error(res.error || 'Erro');
    });
  };

  const cobrancasDoMembro = (membroId: string) => cobrancas.filter((c) => c.membroId === membroId);

  // Fonte de verdade da lista é o resumo que ESTE componente busca — assim um
  // membro recém-cadastrado aparece na hora, mesmo que o refresh do pai atrase.
  // Antes do primeiro carregamento, cai no prop `membros` pra não piscar vazio.
  const listaMembros: MembroResumo[] = resumo
    ? resumo.membros
    : membros.map((m) => ({ membro: m, totalPendente: 0, totalPago: 0, qtdCobrancas: 0, qtdPendentes: 0 }));
  const membrosLista: FamiliaMembro[] = listaMembros.map((mr) => mr.membro);
  const semMembros = listaMembros.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero strip — resumo + gráfico de gastos por membro lado a lado */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.lavender}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            A receber · em aberto (todos os meses)
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 36, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {formatBRL(resumo?.totalAReceber || 0)}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
            <MiniStat label="Recebido no mês" valor={formatBRL(resumo?.totalRecebido || 0)} cor={t.accents.sage} />
            <DivV t={t} />
            <MiniStat label="Membros" valor={String(resumo?.qtdMembros ?? listaMembros.length)} cor={t.text} />
            {resumo && resumo.totalNaoAtribuido > 0 && (
              <>
                <DivV t={t} />
                <MiniStat label="Na fatura, sem cobrar" valor={formatBRL(resumo.totalNaoAtribuido)} cor={t.accents.peach} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Button icon={<Plus size={16} />} onClick={() => { setMembroEdit(null); setModalMembro(true); }}>Novo membro</Button>
            <Button type="primary" icon={<HandCoins size={16} />} onClick={() => abrirNovaCobranca()} disabled={semMembros} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>
              Nova cobrança
            </Button>
          </div>
        </div>
        {!semMembros && <PizzaGastosMembros membros={listaMembros} />}
      </div>

      {/* Régua de 12 meses — a receber por competência, preenchendo cada mês */}
      {!semMembros && (
        <Resumo12Meses cobrancas={cobrancas} mesAtivo={mes} onSelecionar={onSelecionarMes} />
      )}

      {/* Membros */}
      {semMembros ? (
        <Panel title="Família">
          <Empty description="Nenhum membro ainda. Cadastre quem divide contas no seu cartão (filha, irmã, cunhada…).">
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setMembroEdit(null); setModalMembro(true); }} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>
              Adicionar primeiro membro
            </Button>
          </Empty>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {listaMembros.map((mr) => (
            <MembroCard
              key={mr.membro.id}
              mr={mr as MembroResumo}
              onClick={() => setDrawerMembro(mr.membro)}
              onEditar={() => { setMembroEdit(mr.membro); setModalMembro(true); }}
            />
          ))}
        </div>
      )}

      {/* Não atribuídos: veio na fatura e não cobrei */}
      {resumo && resumo.naoAtribuidos.length > 0 && (
        <Panel
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertCircle size={16} color={t.accents.peach} /> No seu cartão, ainda sem cobrar ({resumo.naoAtribuidos.length})</span>}
        >
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 12 }}>
            Compras no cartão deste mês que você ainda não atribuiu a ninguém. Clique em “atribuir” pra cobrar de um membro.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {resumo.naoAtribuidos.map((n) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.descricao}</div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{n.data ? dayjs(n.data).format('DD/MM') : ''} · {n.categoria}</div>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(n.valor)}</div>
                <Button
                  size="small"
                  icon={<Link2 size={13} />}
                  onClick={() => abrirNovaCobranca({ descricao: n.descricao, valor: n.valor, origem: 'lancamento', origemId: n.id, competencia: mes })}
                >
                  atribuir
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <ModalMembro
        open={modalMembro}
        membro={membroEdit}
        onClose={() => setModalMembro(false)}
        onSaved={() => { setModalMembro(false); refreshTudo(); }}
      />

      <ModalCobranca
        open={modalCobr}
        cobranca={cobrEdit}
        prefill={cobrPrefill}
        mes={mes}
        membros={membrosLista}
        lancamentos={lancamentos}
        assinaturas={assinaturas}
        onClose={() => setModalCobr(false)}
        onSaved={() => { setModalCobr(false); refreshTudo(); }}
      />

      <Drawer
        title={drawerMembro ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MembroAvatar membro={drawerMembro} size={26} radius={8} />
            {drawerMembro.nome}
          </span>
        ) : 'Membro'}
        open={!!drawerMembro}
        onClose={() => setDrawerMembro(null)}
        width={480}
        destroyOnClose
        extra={drawerMembro ? (
          <Button size="small" icon={<FileDown size={14} />} loading={pdfLoading} onClick={() => baixarPdfMembro(drawerMembro)}>
            PDF
          </Button>
        ) : null}
      >
        {drawerMembro && (
          <DetalheMembro
            membro={drawerMembro}
            cobrancas={(detalheCobr ?? cobrancasDoMembro(drawerMembro.id)) as CobrancaDetalhada[]}
            provisao={provisao}
            loading={detalheCobr === null}
            onNova={() => abrirNovaCobranca({ membroId: drawerMembro.id, competencia: mes })}
            onTogglePago={togglePago}
            onEditar={abrirEditarCobranca}
            onRemover={removerCobranca}
          />
        )}
      </Drawer>
    </div>
  );
}

// ─── Hero helpers ──────────────────────────────────────────────────────────────
function MiniStat({ label, valor, cor }: { label: string; valor: string; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
}
function DivV({ t }: { t: ReturnType<typeof useTokens> }): React.ReactElement {
  return <div style={{ width: 1, alignSelf: 'stretch', background: t.borderSoft }} />;
}

// ─── Régua dos próximos 12 meses ────────────────────────────────────────────────
// Sumariza, mês a mês (a partir do mês corrente), o total A RECEBER (cobranças
// pendentes) de toda a família. Cada compra parcelada já cai no seu respectivo
// mês — então dá pra "bater o olho" no compromisso do ano todo. Clicar foca o mês.
function Resumo12Meses({ cobrancas, mesAtivo, onSelecionar }: {
  cobrancas: Cobranca[];
  mesAtivo: string;
  onSelecionar?: (comp: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const hoje = new Date();
  const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const meses = useMemo(() => {
    // Soma pendente/pago por competência.
    const porComp: Record<string, { pendente: number; pago: number; qtd: number }> = {};
    for (const c of cobrancas) {
      const comp = String(c.competencia || '').substring(0, 7); // '2026-06-01' → '2026-06'
      if (!comp) continue;
      if (!porComp[comp]) porComp[comp] = { pendente: 0, pago: 0, qtd: 0 };
      const v = Math.abs(Number(c.valor || 0));
      if (String(c.status) === 'pago') porComp[comp].pago += v;
      else { porComp[comp].pendente += v; porComp[comp].qtd++; }
    }
    // 12 meses a partir do mês corrente.
    const out: Array<{ comp: string; pendente: number; pago: number; qtd: number }> = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({ comp, pendente: porComp[comp]?.pendente || 0, pago: porComp[comp]?.pago || 0, qtd: porComp[comp]?.qtd || 0 });
    }
    return out;
  }, [cobrancas]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxV = Math.max(1, ...meses.map((m) => m.pendente));
  const totalFuturo = meses.reduce((s, m) => s + m.pendente, 0);
  const fmtMesCurto = (comp: string) => {
    const [y, mm] = comp.split('-').map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  };

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarRange size={16} color={t.accents.lavender} /> Próximos 12 meses · a receber</span>}
      extra={<span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Total previsto: <strong style={{ color: t.text }}>{formatBRL(totalFuturo)}</strong></span>}
    >
      <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
        Cada compra parcelada já cai no mês da sua fatura. Clique num mês pra focá-lo na tela.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {meses.map((m) => {
          const ativo = m.comp === mesAtivo.substring(0, 7);
          const ehHoje = m.comp === mesHoje;
          const temValor = m.pendente > 0.01;
          const cor = ehHoje ? t.accents.peach : t.accents.lavender;
          return (
            <button
              key={m.comp}
              onClick={() => onSelecionar?.(m.comp)}
              style={{
                cursor: onSelecionar ? 'pointer' : 'default',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6,
                background: ativo ? `${cor}14` : t.surfaceMuted,
                border: `1.5px solid ${ativo ? cor : t.borderSoft}`,
                borderRadius: 11, padding: '10px 11px', transition: 'all 0.15s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: ehHoje ? t.accents.peach : t.textSecondary, textTransform: 'capitalize' }}>
                  {fmtMesCurto(m.comp)}/{m.comp.slice(2, 4)}
                </span>
                {ehHoje && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents.peach }} />}
              </span>
              <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: temValor ? t.text : t.textTertiary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {temValor ? formatBRL(m.pendente) : '—'}
              </span>
              <span style={{ height: 4, borderRadius: 3, background: t.borderSoft, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(m.pendente / maxV) * 100}%`, background: cor, borderRadius: 3, transition: 'width 0.3s' }} />
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary }}>{m.qtd > 0 ? `${m.qtd} cobr.` : 'livre'}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Pizza: % de gastos por membro ───────────────────────────────────────────
// Donut compacto (conic-gradient, sem lib) embutido na hero da Família. Toggle
// "Em aberto" (totalPendente) vs "Total" (pendente + pago) + legenda enxuta.
function PizzaGastosMembros({ membros }: { membros: MembroResumo[] }): React.ReactElement {
  const t = useTokens();
  const [modo, setModo] = useState<'aberto' | 'total'>('aberto');
  const PALETA = [t.accents.lavender, t.accents.sage, t.accents.peach, t.accents.rose, t.accents.clay, t.accents.blue];
  const dados = membros
    .map((mr, i) => ({
      membro: mr.membro,
      cor: mr.membro.cor || PALETA[i % PALETA.length],
      total: modo === 'aberto' ? (mr.totalPendente || 0) : (mr.totalPendente || 0) + (mr.totalPago || 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalGeral = dados.reduce((s, d) => s + d.total, 0);

  let acc = 0;
  const stops: string[] = [];
  for (const d of dados) {
    const ini = (acc / totalGeral) * 100;
    acc += d.total;
    const fim = (acc / totalGeral) * 100;
    stops.push(`${d.cor} ${ini}% ${fim}%`);
  }
  const grad = stops.length ? `conic-gradient(${stops.join(', ')})` : '';

  return (
    <div style={{
      flex: '1 1 440px', minWidth: 320,
      background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18 }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>Gastos por membro</span>
        {/* Toggle custom (mais contraste que o Segmented no tema custom) */}
        <div style={{ display: 'inline-flex', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 9, padding: 3, gap: 3 }}>
          {([['aberto', 'Em aberto'], ['total', 'Total']] as const).map(([op, label]) => {
            const on = modo === op;
            return (
              <button
                key={op}
                onClick={() => setModo(op)}
                style={{
                  border: 'none', cursor: 'pointer', fontFamily: FONTS.ui, fontSize: 11.5,
                  padding: '4px 13px', borderRadius: 6, transition: 'all 0.15s',
                  background: on ? t.accents.lavender : 'transparent',
                  color: on ? '#fff' : t.textSecondary, fontWeight: on ? 600 : 500,
                  boxShadow: on ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}
              >{label}</button>
            );
          })}
        </div>
      </div>
      {totalGeral <= 0 ? (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, padding: '34px 4px', textAlign: 'center' }}>
          {modo === 'aberto' ? 'Nada em aberto no momento.' : 'Sem gastos atribuídos ainda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Anel mais fino (inset 30 → furo de ~104px) pra o valor central não
              encostar na cor. */}
          <div style={{ position: 'relative', width: 164, height: 164, borderRadius: '50%', background: grad, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 30, borderRadius: '50%', background: t.surface,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, letterSpacing: 0.3, marginBottom: 1 }}>{modo === 'aberto' ? 'Em aberto' : 'Total'}</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBRL(totalGeral)}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 11, maxHeight: 164, overflowY: 'auto' }}>
            {dados.map((d) => {
              const pct = (d.total / totalGeral) * 100;
              return (
                <div key={d.membro.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: d.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.membro.nome}
                  </span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                  <span style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', minWidth: 84, textAlign: 'right' }}>{formatBRL(d.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card de membro ─────────────────────────────────────────────────────────────
function MembroCard({ mr, onClick, onEditar }: { mr: MembroResumo; onClick: () => void; onEditar: () => void }): React.ReactElement {
  const t = useTokens();
  const m = mr.membro;
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 14,
        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', position: 'relative',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      <div style={{ position: 'absolute', top: 8, right: 8 }} onClick={(e) => e.stopPropagation()}>
        <Tooltip title="Editar membro"><Button size="small" type="text" icon={<Pencil size={12} />} onClick={onEditar} /></Tooltip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <MembroAvatar membro={m} size={38} radius={12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</div>
          {m.relacao && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{m.relacao}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>a receber</div>
          <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: mr.totalPendente > 0 ? t.accents.peach : t.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(mr.totalPendente)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>pago no mês</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(mr.totalPago)}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'flex', justifyContent: 'space-between' }}>
        <span>{mr.qtdCobrancas} cobrança(s)</span>
        {mr.qtdPendentes > 0 ? <span style={{ color: t.accents.peach }}>{mr.qtdPendentes} pendente(s)</span> : <span style={{ color: t.accents.sage }}>em dia</span>}
      </div>
    </div>
  );
}

// Uma linha de cobrança no drawer — reusada na lista e na visão por mês.
function LinhaCobranca({ c, onTogglePago, onEditar, onRemover }: {
  c: CobrancaDetalhada;
  onTogglePago: (c: Cobranca) => void;
  onEditar: (c: Cobranca) => void;
  onRemover: (id: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const pgto = c.status === 'pago';
  const temParcela = (c.parcelasTotal || 0) > 1 && (c.parcelaAtual || 0) > 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 10,
      opacity: pgto ? 0.72 : 1,
    }}>
      <Tooltip title={pgto ? 'Marcar como pendente' : 'Marcar como pago'}>
        <Button
          size="small" type="text"
          icon={pgto ? <CheckCircle2 size={18} color={t.accents.sage} /> : <Clock size={18} color={t.accents.peach} />}
          onClick={() => onTogglePago(c)}
        />
      </Tooltip>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, textDecoration: pgto ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.descricao}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          {temParcela && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.lavender}1f`, color: t.accents.lavender }}><Layers size={9} style={{ marginRight: 3 }} />{c.parcelaAtual}/{c.parcelasTotal}</Tag>}
          {c.cartaoNome && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.blue}1a`, color: t.accents.blue }}><CreditCard size={9} style={{ marginRight: 3 }} />{c.cartaoNome}</Tag>}
          {!c.cartaoNome && c.origem === 'lancamento' && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.blue}1a`, color: t.accents.blue }}><CreditCard size={9} style={{ marginRight: 3 }} />no cartão</Tag>}
          {c.origem === 'assinatura' && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.lavender}1a`, color: t.accents.lavender }}>assinatura</Tag>}
          {c.recorrente === 'sim' && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.sage}1a`, color: t.accents.sage }}><Repeat size={9} style={{ marginRight: 3 }} />mensal</Tag>}
        </div>
        {(c.dataCompra || c.vencimentoFatura) && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 3, fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>
            {c.dataCompra && <span>Compra {dayjs(String(c.dataCompra)).format('DD/MM/YY')}</span>}
            {c.vencimentoFatura && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CalendarClock size={10} /> vence {dayjs(String(c.vencimentoFatura)).format('DD/MM')}</span>}
          </div>
        )}
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(c.valor)}</div>
      <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(c)} />
      <Popconfirm title="Remover cobrança?" onConfirm={() => onRemover(c.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
        <Button size="small" type="text" icon={<Trash2 size={13} />} danger />
      </Popconfirm>
    </div>
  );
}

// Mini-stat do topo do drawer.
function StatMembro({ label, valor, cor, destaque }: { label: string; valor: string; cor: string; destaque?: boolean }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ flex: 1, background: destaque ? `${cor}12` : t.surfaceMuted, border: `1px solid ${destaque ? `${cor}40` : t.borderSoft}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
}

// ─── Detalhe do membro (drawer) ─────────────────────────────────────────────────
function DetalheMembro({ membro, cobrancas, provisao, loading, onNova, onTogglePago, onEditar, onRemover }: {
  membro: FamiliaMembro;
  cobrancas: CobrancaDetalhada[];
  provisao: ProvisaoMembro | null;
  loading: boolean;
  onNova: () => void;
  onTogglePago: (c: Cobranca) => void;
  onEditar: (c: Cobranca) => void;
  onRemover: (id: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const [modo, setModo] = useState<'mes' | 'lista'>('mes');
  const pendente = provisao?.totalPendente ?? cobrancas.filter((c) => c.status !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);
  const esteMes = provisao?.totalEsteMes ?? 0;
  const futuro = provisao?.totalFuturo ?? 0;
  const atrasado = provisao?.totalAtrasado ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumo: total em aberto + recorte este mês × futuro (parcelas) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatMembro label="A receber · em aberto" valor={formatBRL(pendente)} cor={pendente > 0 ? t.accents.peach : t.textTertiary} destaque />
        <StatMembro label="Este mês" valor={formatBRL(esteMes)} cor={t.text} />
        <StatMembro label="Futuro · parcelas" valor={formatBRL(futuro)} cor={futuro > 0 ? t.accents.lavender : t.textTertiary} />
      </div>
      {atrasado > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${t.accents.rose}14`, border: `1px solid ${t.accents.rose}40`, borderRadius: 10, fontFamily: FONTS.ui, fontSize: 12.5, color: t.accents.rose }}>
          <AlertCircle size={14} /> {formatBRL(atrasado)} em atraso (meses anteriores)
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onNova} style={{ background: membro.cor, borderColor: membro.cor }}>
          Nova cobrança
        </Button>
        {/* Toggle Por mês × Lista */}
        <div style={{ display: 'inline-flex', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 9, padding: 3, gap: 3 }}>
          {([['mes', 'Por mês', CalendarRange], ['lista', 'Lista', ListChecks]] as const).map(([op, label, Ico]) => {
            const on = modo === op;
            return (
              <button key={op} onClick={() => setModo(op)} style={{
                border: 'none', cursor: 'pointer', fontFamily: FONTS.ui, fontSize: 11.5,
                padding: '4px 11px', borderRadius: 6, transition: 'all 0.15s',
                background: on ? membro.cor : 'transparent', color: on ? '#fff' : t.textSecondary,
                fontWeight: on ? 600 : 500, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Ico size={12} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ color: t.textTertiary, fontSize: 13, textAlign: 'center', padding: 20 }}>Carregando…</div>
      ) : cobrancas.length === 0 ? (
        <Empty description="Sem cobranças ainda" />
      ) : modo === 'lista' || !provisao ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cobrancas.map((c) => (
            <LinhaCobranca key={c.id} c={c} onTogglePago={onTogglePago} onEditar={onEditar} onRemover={onRemover} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {provisao.porMes.map((m) => {
            const tudoPago = m.pendente <= 0.01 && m.pago > 0;
            const corMes = m.atrasado ? t.accents.rose : m.futuro ? t.accents.lavender : t.accents.peach;
            const etiqueta = m.atrasado ? 'em atraso' : m.competencia === provisao.mesAtual ? 'este mês' : m.futuro ? 'previsto' : '';
            return (
              <div key={m.competencia} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>{compToLabel(m.competencia)}</span>
                    {etiqueta && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${corMes}1f`, color: corMes }}>{etiqueta}</Tag>}
                  </span>
                  <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: tudoPago ? t.accents.sage : corMes, fontVariantNumeric: 'tabular-nums' }}>
                    {tudoPago ? '✓ pago' : formatBRL(m.pendente)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.itens.map((c) => (
                    <LinhaCobranca key={c.id} c={c} onTogglePago={onTogglePago} onEditar={onEditar} onRemover={onRemover} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal: novo/editar membro ──────────────────────────────────────────────────
function ModalMembro({ open, membro, onClose, onSaved }: {
  open: boolean;
  membro: FamiliaMembro | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [emoji, setEmoji] = useState('');

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (membro) { form.setFieldsValue(membro); setEmoji(membro.emoji || 'user'); }
      else { form.setFieldsValue({ ativo: 'sim' }); setEmoji('user'); }
    }
  }, [open, membro, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<unknown>>('salvarMembro', { ...v, emoji, id: membro?.id });
      if (res.ok) { message.success(membro ? 'Membro atualizado' : 'Membro adicionado'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={membro ? 'Editar membro' : 'Novo membro'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Informe o nome' }]}>
            <Input placeholder="Ex: Maria" autoFocus />
          </Form.Item>
          <Form.Item name="relacao" label="Relação">
            <Input placeholder="Ex: filha" />
          </Form.Item>
        </div>
        <Form.Item label="Ícone">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MEMBRO_ICONE_KEYS.map((key) => {
              const Icone = MEMBRO_ICONES[key];
              const ativo = emoji === key;
              return (
                <div
                  key={key}
                  onClick={() => setEmoji(key)}
                  style={{
                    width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: ativo ? t.accents.lavender : t.textSecondary,
                    background: ativo ? `${t.accents.lavender}22` : t.surfaceMuted,
                    border: `2px solid ${ativo ? t.accents.lavender : 'transparent'}`,
                  }}
                >
                  <Icone size={19} strokeWidth={1.8} />
                </div>
              );
            })}
          </div>
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
          <Form.Item name="pix" label="Chave PIX" tooltip="Aparece no PDF de cobrança pra o membro te pagar.">
            <Input placeholder="Ex: email, telefone ou CPF" />
          </Form.Item>
          <Form.Item name="telefone" label="Telefone">
            <Input placeholder="Ex: (11) 9…" />
          </Form.Item>
        </div>
        <Form.Item name="notas" label="Notas (opcional)">
          <Input.TextArea rows={2} placeholder="Ex: divide Netflix e Spotify" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Modal: nova/editar cobrança ────────────────────────────────────────────────
function ModalCobranca({ open, cobranca, prefill, mes, membros, lancamentos, assinaturas, onClose, onSaved }: {
  open: boolean;
  cobranca: Cobranca | null;
  prefill: Partial<Cobranca> | null;
  mes: string;
  membros: FamiliaMembro[];
  lancamentos: LancamentoPessoal[];
  assinaturas: AssinaturaPessoal[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [recorrente, setRecorrente] = useState(false);
  const [origem, setOrigem] = useState<string>('manual');
  const [origemId, setOrigemId] = useState<string>('');

  useEffect(() => {
    if (open) {
      form.resetFields();
      const base = cobranca || prefill || {};
      form.setFieldsValue({
        membroId: (base as Cobranca).membroId || membros[0]?.id,
        descricao: (base as Cobranca).descricao || '',
        valor: (base as Cobranca).valor || undefined,
        competencia: (base as Cobranca).competencia ? dayjs((base as Cobranca).competencia + '-01') : dayjs(mes + '-01'),
        status: (base as Cobranca).status || 'pendente',
      });
      setRecorrente(((base as Cobranca).recorrente || 'nao') === 'sim');
      setOrigem((base as Cobranca).origem || 'manual');
      setOrigemId((base as Cobranca).origemId || '');
    }
  }, [open, cobranca, prefill, mes, membros, form]);

  // Opções pra vincular: despesas no cartão do mês + assinaturas ativas.
  const opcoesVinculo = useMemo(() => {
    const desp = lancamentos
      .filter((l) => l.tipo === 'despesa' && l.metodo === 'cartao')
      .map((l) => ({ value: `lancamento:${l.id}`, label: `💳 ${l.descricao} — ${formatBRL(Number(l.valor || 0))}`, valor: Number(l.valor || 0), descricao: l.descricao }));
    const ass = assinaturas
      .filter((a) => a.status === 'ativa')
      .map((a) => ({ value: `assinatura:${a.id}`, label: `🔁 ${a.nome} — ${formatBRL(Number(a.valor || 0))}`, valor: Number(a.valor || 0), descricao: a.nome }));
    return [...desp, ...ass];
  }, [lancamentos, assinaturas]);

  const onVincular = (val: string | undefined) => {
    if (!val) { setOrigem('manual'); setOrigemId(''); return; }
    const [tipo, id] = val.split(':');
    const opt = opcoesVinculo.find((o) => o.value === val);
    setOrigem(tipo);
    setOrigemId(id);
    if (opt) {
      form.setFieldsValue({ descricao: opt.descricao, valor: opt.valor });
      if (tipo === 'assinatura') setRecorrente(true);
    }
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const comp = (v['competencia'] as Dayjs).format('YYYY-MM');
      const payload = {
        id: cobranca?.id,
        membroId: v['membroId'],
        descricao: v['descricao'],
        valor: v['valor'],
        competencia: comp,
        status: v['status'],
        origem,
        origemId,
        recorrente: recorrente ? 'sim' : 'nao',
      };
      const res = await callServer<ServerResponse<unknown>>('salvarCobranca', payload);
      if (res.ok) { message.success(cobranca ? 'Cobrança atualizada' : 'Cobrança criada'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const vinculoValue = origem !== 'manual' && origemId ? `${origem}:${origemId}` : undefined;

  return (
    <Modal
      title={cobranca ? 'Editar cobrança' : 'Nova cobrança'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="membroId" label="Membro" rules={[{ required: true, message: 'Selecione o membro' }]}>
            <Select
              placeholder="Quem deve"
              optionLabelProp="label"
              options={membros.map((m) => {
                const Icone = membroIconeComponent(m.emoji);
                return {
                  value: m.id,
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {Icone ? <Icone size={14} strokeWidth={1.8} style={{ color: m.cor }} /> : null}
                      {m.nome}
                    </span>
                  ),
                };
              })}
            />
          </Form.Item>
          <Form.Item name="competencia" label="Mês de referência" rules={[{ required: true }]}>
            <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
        </div>

        <Form.Item label="Vincular ao que caiu no seu cartão (opcional)" tooltip="Liga a cobrança à compra/assinatura da sua fatura — rastreabilidade total.">
          <Select
            allowClear
            showSearch
            value={vinculoValue}
            onChange={onVincular}
            placeholder="Escolha uma compra ou assinatura"
            optionFilterProp="label"
            options={opcoesVinculo}
          />
        </Form.Item>

        <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Descreva a cobrança' }]}>
          <Input placeholder="Ex: Netflix família / compra na Amazon" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="valor" label="Valor" rules={[{ required: true, type: 'number', min: 0.01, message: 'Informe o valor' }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={0.01} decimalSeparator="," precision={2} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={[{ value: 'pendente', label: 'A receber' }, { value: 'pago', label: 'Já pago' }]} />
          </Form.Item>
        </div>

        <Form.Item label="Repetir todo mês" tooltip="Liga pra cobranças fixas, como uma assinatura que o membro divide com você.">
          <Switch checked={recorrente} onChange={setRecorrente} />
          <span style={{ marginLeft: 10, fontSize: 12.5, color: t.textTertiary }}>
            {recorrente ? 'Vai aparecer automaticamente nos próximos meses' : 'Cobrança só deste mês'}
          </span>
        </Form.Item>
      </Form>
    </Modal>
  );
}
