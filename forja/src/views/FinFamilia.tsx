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
  App as AntApp, Popconfirm, Empty, Tooltip,
} from 'antd';
import {
  Plus, Pencil, Trash2, Users, CheckCircle2, Clock, CreditCard,
  Link2, AlertCircle, Repeat, HandCoins, FileDown, CalendarClock,
  CalendarRange, Layers, ListChecks, Wand2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Panel, formatBRL, Skeleton } from '../components/ui';
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

// Provisionamento do membro por mês (vem de getProvisaoMembro). Consultivo:
// os totais somam o CUSTO atribuído; `pago` é só o reembolso (discreto).
interface ProvisaoMesMembro {
  competencia: string;
  total: number;
  pendente: number;
  pago: number;
  futuro: boolean;
  itens: CobrancaDetalhada[];
}
interface ProvisaoMembro {
  mesAtual: string;
  totalCusto: number;
  custoEsteMes: number;
  custoFuturo: number;
  custoPassado: number;
  totalPago: number;
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

  const [reorganizando, setReorganizando] = useState(false);
  const reorganizar = () => {
    setReorganizando(true);
    callServer<ServerResponse<{ removidas: number; corrigidas: number; criadas: number }>>('reorganizarCobrancasParcelas')
      .then((res) => {
        if (res?.ok) {
          const d = res.data || { removidas: 0, corrigidas: 0, criadas: 0 };
          message.success(`Pronto — ${d.corrigidas} ajustada(s), ${d.criadas} parcela(s) futura(s) criada(s), ${d.removidas} duplicata(s) removida(s).`);
          refreshTudo();
        } else message.error(res?.error || 'Erro ao reorganizar');
      })
      .catch(() => message.error('Erro ao reorganizar'))
      .finally(() => setReorganizando(false));
  };

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
  // Primeira carga (ainda sem resumo do servidor): mostra esqueleto em vez de
  // zeros/"sem membros", que passavam a falsa sensação de tela quebrada.
  const primeiraCarga = loading && !resumo;

  if (primeiraCarga) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>
          <Clock size={13} className="forja-spin" /> Carregando família…
        </div>
        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, ${t.accents.lavender}14, ${t.surface})`, border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton width={150} height={12} />
            <Skeleton width={200} height={36} radius={8} />
            <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
              <Skeleton width={90} height={28} />
              <Skeleton width={70} height={28} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <Skeleton width={130} height={32} radius={9} />
              <Skeleton width={130} height={32} radius={9} />
            </div>
          </div>
          <Skeleton width={150} height={150} radius={75} />
        </div>
        {/* Régua 12 meses */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20 }}>
          <Skeleton width={240} height={16} style={{ marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} height={78} radius={11} />)}
          </div>
        </div>
        {/* Cards de membros */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={120} radius={16} />)}
        </div>
      </div>
    );
  }

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
            Custo da família · {compToLabel(mes)}
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 36, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {formatBRL(resumo?.totalCustoMes ?? 0)}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
            <MiniStat label="Total atribuído" valor={formatBRL(resumo?.totalCustoTotal ?? 0)} cor={t.accents.lavender} />
            <DivV t={t} />
            <MiniStat label="Membros" valor={String(resumo?.qtdMembros ?? listaMembros.length)} cor={t.text} />
            {resumo && resumo.totalNaoAtribuido > 0 && (
              <>
                <DivV t={t} />
                <MiniStat label="Na fatura, sem atribuir" valor={formatBRL(resumo.totalNaoAtribuido)} cor={t.accents.peach} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Button icon={<Plus size={16} />} onClick={() => { setMembroEdit(null); setModalMembro(true); }}>Novo membro</Button>
            <Button type="primary" icon={<HandCoins size={16} />} onClick={() => abrirNovaCobranca()} disabled={semMembros} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>
              Atribuir manual
            </Button>
          </div>
        </div>
        {!semMembros && <PizzaGastosMembros membros={listaMembros} />}
      </div>

      {/* Régua de 12 meses — custo da família por competência */}
      {!semMembros && (
        <Resumo12Meses
          cobrancas={cobrancas}
          mesAtivo={mes}
          onSelecionar={onSelecionarMes}
          onReorganizar={reorganizar}
          reorganizando={reorganizando}
        />
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

      {/* Mini-relatório: quanto cada um já me devolveu no ano */}
      {!semMembros && <RelatorioReembolsos cobrancas={cobrancas} membros={membrosLista} />}

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

      <Modal
        title={drawerMembro ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <MembroAvatar membro={drawerMembro} size={32} radius={9} />
            <span>
              <span style={{ display: 'block', fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text, lineHeight: 1.1 }}>{drawerMembro.nome}</span>
              {drawerMembro.relacao && <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textTransform: 'capitalize' }}>{drawerMembro.relacao}</span>}
            </span>
          </span>
        ) : 'Membro'}
        open={!!drawerMembro}
        onCancel={() => setDrawerMembro(null)}
        footer={null}
        width={920}
        destroyOnClose
        styles={{ body: { maxHeight: '74vh', overflowY: 'auto', paddingRight: 6 } }}
      >
        {drawerMembro && (
          <DetalheMembro
            membro={drawerMembro}
            mes={mes}
            cobrancas={(detalheCobr ?? cobrancasDoMembro(drawerMembro.id)) as CobrancaDetalhada[]}
            provisao={provisao}
            loading={detalheCobr === null}
            pdfLoading={pdfLoading}
            onPdf={() => baixarPdfMembro(drawerMembro)}
            onNova={() => abrirNovaCobranca({ membroId: drawerMembro.id, competencia: mes })}
            onTogglePago={togglePago}
            onEditar={abrirEditarCobranca}
            onRemover={removerCobranca}
          />
        )}
      </Modal>
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
function Resumo12Meses({ cobrancas, mesAtivo, onSelecionar, onReorganizar, reorganizando, titulo, descricao }: {
  cobrancas: Cobranca[];
  mesAtivo: string;
  onSelecionar?: (comp: string) => void;
  onReorganizar?: () => void;
  reorganizando?: boolean;
  titulo?: React.ReactNode;
  descricao?: string;
}): React.ReactElement {
  const t = useTokens();
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtualIdx = hoje.getMonth(); // 0-11
  // Ano-calendário fechado (Jan→Dez). Começa no ano em que está o mês ativo,
  // pra que abrir um mês futuro já mostre o ano certo. Navegável por seta.
  const [ano, setAno] = useState(() => {
    const a = Number((mesAtivo || '').substring(0, 4));
    return a >= 2000 ? a : anoAtual;
  });

  const meses = useMemo(() => {
    // Soma pendente/pago por competência.
    const porComp: Record<string, { pendente: number; pago: number; qtd: number }> = {};
    for (const c of cobrancas) {
      const comp = String(c.competencia || '').substring(0, 7); // '2026-06-01' → '2026-06'
      if (!comp) continue;
      if (!porComp[comp]) porComp[comp] = { pendente: 0, pago: 0, qtd: 0 };
      const v = Math.abs(Number(c.valor || 0));
      porComp[comp].qtd++;
      if (String(c.status) === 'pago') porComp[comp].pago += v;
      else porComp[comp].pendente += v;
    }
    // 12 meses fixos: Jan→Dez do ano selecionado.
    const out: Array<{ comp: string; mesIdx: number; total: number; qtd: number }> = [];
    for (let m = 0; m < 12; m++) {
      const comp = `${ano}-${String(m + 1).padStart(2, '0')}`;
      const reg = porComp[comp];
      out.push({ comp, mesIdx: m, total: (reg?.pendente || 0) + (reg?.pago || 0), qtd: reg?.qtd || 0 });
    }
    return out;
  }, [cobrancas, ano]);

  const maxV = Math.max(1, ...meses.map((m) => m.total));
  const totalPeriodo = meses.reduce((s, m) => s + m.total, 0);
  const fmtMesCurto = (comp: string) => {
    const [y, mm] = comp.split('-').map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  };

  return (
    <Panel
      title={titulo ?? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarRange size={16} color={t.accents.lavender} /> Custo da família · 12 meses</span>}
      extra={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Total em {ano}: <strong style={{ color: t.text }}>{formatBRL(totalPeriodo)}</strong></span>
          {onReorganizar && (
            <Tooltip title="Conserta atribuições antigas: remove duplicatas, joga cada parcela no mês da sua fatura e espalha as parcelas futuras. Pode rodar sempre que quiser.">
              <Popconfirm
                title="Reorganizar parcelas?"
                description="Vai limpar duplicatas e distribuir as parcelas pelos meses corretos."
                okText="Reorganizar" cancelText="Cancelar"
                onConfirm={onReorganizar}
              >
                <Button size="small" icon={<Wand2 size={13} />} loading={reorganizando}>Reorganizar parcelas</Button>
              </Popconfirm>
            </Tooltip>
          )}
        </span>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, flex: 1, minWidth: 220 }}>
          {descricao ?? 'Quanto do seu cartão é da família em cada mês do ano — cada parcela já cai no mês da sua fatura. Clique num mês pra focá-lo.'}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 9, padding: '2px 3px' }}>
          <button onClick={() => setAno((a) => a - 1)} title="Ano anterior" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 6, color: t.textSecondary }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{ano}</span>
          <button onClick={() => setAno((a) => a + 1)} title="Próximo ano" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 6, color: t.textSecondary }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {meses.map((m) => {
          const ativo = m.comp === mesAtivo.substring(0, 7);
          const ehHoje = ano === anoAtual && m.mesIdx === mesAtualIdx;
          const passado = ano < anoAtual || (ano === anoAtual && m.mesIdx < mesAtualIdx);
          const temValor = m.total > 0.01;
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
                opacity: passado && !temValor ? 0.5 : 1,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: ehHoje ? t.accents.peach : t.textSecondary, textTransform: 'capitalize' }}>
                  {fmtMesCurto(m.comp)}/{m.comp.slice(2, 4)}
                </span>
                {ehHoje && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents.peach }} />}
              </span>
              <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: temValor ? t.text : t.textTertiary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {temValor ? formatBRL(m.total) : '—'}
              </span>
              <span style={{ height: 4, borderRadius: 3, background: t.borderSoft, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(m.total / maxV) * 100}%`, background: cor, borderRadius: 3, transition: 'width 0.3s' }} />
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary }}>{m.qtd > 0 ? `${m.qtd} item(ns)` : 'livre'}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Mini-relatório: reembolsos no ano ──────────────────────────────────────────
// Consultivo: soma o que cada membro JÁ TE DEVOLVEU (cobranças marcadas como
// reembolsadas) no ano, com tira de 12 meses por membro. Calculado no cliente a
// partir das cobranças já carregadas — fica em sincronia com o toggle de reembolso.
function RelatorioReembolsos({ cobrancas, membros }: { cobrancas: Cobranca[]; membros: FamiliaMembro[] }): React.ReactElement {
  const t = useTokens();
  const membroMap = useMemo(() => {
    const m: Record<string, FamiliaMembro> = {};
    membros.forEach((x) => { m[x.id] = x; });
    return m;
  }, [membros]);

  // Pagos com mês de reembolso resolvido (dataPagamento > competência).
  const pagos = useMemo(() => cobrancas
    .filter((c) => String(c.status) === 'pago')
    .map((c) => {
      const dp = String(c.dataPagamento || '');
      const yyyymm = /^\d{4}-\d{2}/.test(dp) ? dp.substring(0, 7) : String(c.competencia || '').substring(0, 7);
      return { membroId: c.membroId, valor: c.valor, yyyymm };
    })
    .filter((c) => /^\d{4}-\d{2}$/.test(c.yyyymm)), [cobrancas]);

  const anosDisponiveis = useMemo(() => {
    const s = new Set<number>();
    pagos.forEach((c) => s.add(Number(c.yyyymm.substring(0, 4))));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [pagos]);

  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const { lista, totalGeral, maxMes } = useMemo(() => {
    const porMembro: Record<string, { total: number; porMes: number[] }> = {};
    let total = 0;
    for (const c of pagos) {
      const [y, mm] = c.yyyymm.split('-').map(Number);
      if (y !== ano) continue;
      const mid = c.membroId;
      if (!mid) continue;
      if (!porMembro[mid]) porMembro[mid] = { total: 0, porMes: new Array(12).fill(0) };
      const v = Math.abs(Number(c.valor || 0));
      porMembro[mid].total += v;
      porMembro[mid].porMes[mm - 1] += v;
      total += v;
    }
    const lista = Object.keys(porMembro)
      .map((mid) => ({ membro: membroMap[mid], total: porMembro[mid].total, porMes: porMembro[mid].porMes }))
      .filter((x) => x.membro)
      .sort((a, b) => b.total - a.total);
    const maxMes = Math.max(1, ...lista.flatMap((x) => x.porMes));
    return { lista, totalGeral: total, maxMes };
  }, [pagos, ano, membroMap]);

  const MESES_CURTOS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MESES_LONGOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><HandCoins size={16} color={t.accents.sage} /> Reembolsos recebidos</span>}
      extra={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
            No ano: <strong style={{ color: t.accents.sage }}>{formatBRL(totalGeral)}</strong>
          </span>
          <Select
            size="small"
            value={ano}
            onChange={setAno}
            style={{ width: 92 }}
            options={anosDisponiveis.map((a) => ({ value: a, label: String(a) }))}
          />
        </span>
      }
    >
      <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 14 }}>
        Quanto cada um já te devolveu em {ano} — some os itens marcados como reembolsados no detalhe do membro.
      </div>
      {lista.length === 0 ? (
        <Empty description={`Nenhum reembolso marcado em ${ano}. Marque um item como reembolsado no detalhe do membro pra ele aparecer aqui.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map((x) => (
            <div key={x.membro.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px',
              background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12,
            }}>
              <MembroAvatar membro={x.membro} size={34} radius={10} />
              <div style={{ minWidth: 110, flexShrink: 0 }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 500, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.membro.nome}</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(x.total)}</div>
              </div>
              {/* Tira de 12 meses (sparkline) */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: 38, minWidth: 150 }}>
                {x.porMes.map((v, i) => {
                  const h = v > 0 ? Math.max(4, (v / maxMes) * 36) : 2;
                  return (
                    <Tooltip key={i} title={`${MESES_LONGOS[i]}/${String(ano).slice(2)}: ${v > 0 ? formatBRL(v) : 'sem reembolso'}`}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}>
                        <div style={{ width: '100%', maxWidth: 14, height: h, borderRadius: 3, background: v > 0 ? t.accents.sage : t.borderSoft, transition: 'height 0.3s' }} />
                        <span style={{ fontFamily: FONTS.ui, fontSize: 8.5, color: t.textTertiary }}>{MESES_CURTOS[i]}</span>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Pizza: % de gastos por membro ───────────────────────────────────────────
// Donut compacto (conic-gradient, sem lib) embutido na hero da Família. Toggle
// "Em aberto" (totalPendente) vs "Total" (pendente + pago) + legenda enxuta.
function PizzaGastosMembros({ membros }: { membros: MembroResumo[] }): React.ReactElement {
  const t = useTokens();
  const [modo, setModo] = useState<'mes' | 'total'>('mes');
  const [hover, setHover] = useState<number | null>(null);
  const PALETA = [t.accents.lavender, t.accents.sage, t.accents.peach, t.accents.rose, t.accents.clay, t.accents.blue];
  const dados = membros
    .map((mr, i) => ({
      membro: mr.membro,
      cor: mr.membro.cor || PALETA[i % PALETA.length],
      total: modo === 'mes'
        ? (mr.custoMes ?? mr.totalPendente ?? 0)
        : (mr.custoTotal ?? ((mr.totalPendente || 0) + (mr.totalPago || 0))),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalGeral = dados.reduce((s, d) => s + d.total, 0);

  // Donut SVG (mesmo estilo premium da Visão geral): anel fino + hover por fatia.
  const size = 176;
  const r = 42; const C = 2 * Math.PI * r;
  let accF = 0;
  const segs = dados.map((d) => {
    const frac = totalGeral > 0 ? d.total / totalGeral : 0;
    const seg = { ...d, frac, offset: accF };
    accF += frac;
    return seg;
  });
  const hov = hover !== null ? segs[hover] : null;
  const centroLabel = hov ? hov.membro.nome : (modo === 'mes' ? 'Este mês' : 'Total');
  const centroValor = hov ? hov.total : totalGeral;
  const centroPct = hov ? hov.frac * 100 : null;

  return (
    <div style={{
      flex: '1 1 440px', minWidth: 320,
      background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18 }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>Custo por membro</span>
        {/* Toggle custom (mais contraste que o Segmented no tema custom) */}
        <div style={{ display: 'inline-flex', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 9, padding: 3, gap: 3 }}>
          {([['mes', 'Este mês'], ['total', 'Total']] as const).map(([op, label]) => {
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
          {modo === 'mes' ? 'Nenhum custo atribuído neste mês.' : 'Sem custos atribuídos ainda.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Donut SVG com anel fino — fatia destaca no hover e o centro reflete
              o membro apontado (mesmo padrão da Visão geral). */}
          <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              {segs.length === 0 && (
                <circle cx={50} cy={50} r={r} fill="none" stroke={t.surfaceMuted} strokeWidth={11} />
              )}
              {segs.map((s, i) => {
                const len = s.frac * C;
                const active = hover === i;
                return (
                  <circle
                    key={s.membro.id}
                    cx={50} cy={50} r={r} fill="none"
                    stroke={s.cor}
                    strokeWidth={active ? 15 : 11}
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-s.offset * C}
                    opacity={hover === null || active ? 1 : 0.38}
                    style={{ transition: 'opacity 0.15s, stroke-width 0.15s', cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>{`${s.membro.nome}: ${formatBRL(s.total)} (${(s.frac * 100).toFixed(0)}%)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              padding: '0 32px', textAlign: 'center',
            }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 9.5, color: hov ? hov.cor : t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centroLabel}</span>
              <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, whiteSpace: 'nowrap' }}>{formatBRL(centroValor)}</span>
              {centroPct !== null && (
                <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>{centroPct.toFixed(0)}%</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 11, maxHeight: 176, overflowY: 'auto' }}>
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
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>custo este mês</div>
          <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: (mr.custoMes ?? 0) > 0 ? t.text : t.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(mr.custoMes ?? 0)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>total atribuído</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.accents.lavender, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(mr.custoTotal ?? 0)}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'flex', justifyContent: 'space-between' }}>
        <span>{mr.qtdCobrancas} item(ns) atribuído(s)</span>
        <span style={{ color: t.textSecondary }}>ver detalhe →</span>
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
      <Tooltip title={pgto ? 'Reembolsado — clique pra desmarcar' : 'Marcar que o membro já me reembolsou (opcional)'}>
        <Button
          size="small" type="text"
          icon={pgto ? <CheckCircle2 size={18} color={t.accents.sage} /> : <Clock size={18} color={t.textTertiary} />}
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
          {!c.cartaoNome && c.origem === 'lancamento' && c.metodo && c.metodo !== 'credito' && (
            <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.surfaceMuted}`, color: t.textSecondary, textTransform: 'capitalize' }}>{c.metodo}</Tag>
          )}
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
// Identifica a "origem" de uma cobrança pra filtro/agrupamento: cartão (quando
// tem nome) ou método de pagamento avulso (Pix, Débito…). Tudo o mais cai em "Avulso".
function origemDaCobranca(c: CobrancaDetalhada): { key: string; label: string } {
  if (c.cartaoNome) return { key: `c:${c.cartaoNome}`, label: c.cartaoNome };
  if (c.origem === 'lancamento' && c.metodo && c.metodo !== 'credito') {
    return { key: `m:${c.metodo}`, label: c.metodo.charAt(0).toUpperCase() + c.metodo.slice(1) };
  }
  return { key: 'avulso', label: 'Avulso' };
}

function DetalheMembro({ membro, mes, cobrancas, provisao, loading, pdfLoading, onPdf, onNova, onTogglePago, onEditar, onRemover }: {
  membro: FamiliaMembro;
  mes: string;
  cobrancas: CobrancaDetalhada[];
  provisao: ProvisaoMembro | null;
  loading: boolean;
  pdfLoading?: boolean;
  onPdf?: () => void;
  onNova: () => void;
  onTogglePago: (c: Cobranca) => void;
  onEditar: (c: Cobranca) => void;
  onRemover: (id: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const [modo, setModo] = useState<'mes' | 'lista'>('mes');
  const [cartaoFiltro, setCartaoFiltro] = useState<string | null>(null);
  const custoTotal = provisao?.totalCusto ?? cobrancas.reduce((s, c) => s + Number(c.valor || 0), 0);
  const esteMes = provisao?.custoEsteMes ?? 0;
  const futuro = provisao?.custoFuturo ?? 0;
  const reembolsado = provisao?.totalPago ?? 0;

  // Origens (cartões/métodos) presentes nas cobranças do membro, ordenadas por
  // custo. O filtro/agrupamento só "liga" quando há mais de uma — com 1 cartão
  // a tela fica idêntica à de antes (sem ruído).
  const origens = useMemo(() => {
    const mapa: Record<string, { key: string; label: string; total: number }> = {};
    for (const c of cobrancas) {
      const o = origemDaCobranca(c);
      if (!mapa[o.key]) mapa[o.key] = { key: o.key, label: o.label, total: 0 };
      mapa[o.key].total += Math.abs(Number(c.valor || 0));
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [cobrancas]);
  const multiplos = origens.length > 1;
  const filtroAtivo = multiplos ? cartaoFiltro : null;
  const passaFiltro = (c: CobrancaDetalhada) => !filtroAtivo || origemDaCobranca(c).key === filtroAtivo;
  const cobrFiltradas = useMemo(() => cobrancas.filter(passaFiltro), [cobrancas, filtroAtivo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicar num mês da régua do membro foca o grupo correspondente na visão "Por mês".
  const focarMes = (comp: string) => {
    setModo('mes');
    setTimeout(() => {
      document.getElementById(`mesgrupo-${comp}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumo consultivo: custo total + recorte este mês × futuro (parcelas) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatMembro label="Custo total atribuído" valor={formatBRL(custoTotal)} cor={custoTotal > 0 ? t.accents.lavender : t.textTertiary} destaque />
        <StatMembro label="Este mês" valor={formatBRL(esteMes)} cor={t.text} />
        <StatMembro label="Futuro · parcelas" valor={formatBRL(futuro)} cor={futuro > 0 ? t.accents.peach : t.textTertiary} />
      </div>
      {reembolsado > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
          <CheckCircle2 size={13} color={t.accents.sage} /> Já reembolsado: <strong style={{ color: t.accents.sage }}>{formatBRL(reembolsado)}</strong> <span style={{ color: t.textTertiary }}>· opcional, não afeta o custo</span>
        </div>
      )}

      {/* Filtro por cartão — só aparece quando o membro tem mais de uma origem.
          Filtra a régua E a lista ao mesmo tempo. */}
      {!loading && multiplos && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginRight: 2 }}>Cartão:</span>
          {([{ key: null, label: 'Todos' }, ...origens] as Array<{ key: string | null; label: string }>).map((o) => {
            const on = (filtroAtivo ?? null) === o.key;
            return (
              <button key={o.key ?? 'todos'} onClick={() => setCartaoFiltro(o.key)} style={{
                border: `1px solid ${on ? membro.cor : t.borderSoft}`, cursor: 'pointer',
                fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: on ? 600 : 500,
                padding: '3px 11px', borderRadius: 999, transition: 'all 0.15s',
                background: on ? `${membro.cor}1f` : t.surfaceMuted, color: on ? membro.cor : t.textSecondary,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {o.key && o.key.startsWith('c:') && <CreditCard size={11} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Linha do tempo do PRÓPRIO membro — ano-calendário, só o que é dele
          (respeitando o filtro de cartão acima). */}
      {!loading && cobrFiltradas.length > 0 && (
        <Resumo12Meses
          cobrancas={cobrFiltradas}
          mesAtivo={mes}
          onSelecionar={focarMes}
          titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarRange size={16} color={membro.cor} /> {membro.nome} · 12 meses</span>}
          descricao={`O que ${membro.nome.split(' ')[0]} tem no cartão mês a mês no ano — cada parcela já cai no mês da fatura. Clique num mês pra ir até ele.`}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onNova} style={{ background: membro.cor, borderColor: membro.cor }}>
            Atribuir manual
          </Button>
          {onPdf && (
            <Button size="small" icon={<FileDown size={14} />} loading={pdfLoading} onClick={onPdf}>
              PDF
            </Button>
          )}
        </div>
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
      ) : cobrFiltradas.length === 0 ? (
        <Empty description="Nada nesse cartão" />
      ) : modo === 'lista' || !provisao ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cobrFiltradas.map((c) => (
            <LinhaCobranca key={c.id} c={c} onTogglePago={onTogglePago} onEditar={onEditar} onRemover={onRemover} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {provisao.porMes
            .map((m) => ({ ...m, itens: m.itens.filter(passaFiltro) }))
            .filter((m) => m.itens.length > 0)
            .map((m) => {
            const total = m.itens.reduce((s, c) => s + Math.abs(Number(c.valor || 0)), 0);
            const pago = m.itens.filter((c) => String(c.status) === 'pago').reduce((s, c) => s + Math.abs(Number(c.valor || 0)), 0);
            const tudoReembolsado = total - pago <= 0.01 && pago > 0;
            const corMes = m.futuro ? t.accents.lavender : m.competencia === provisao.mesAtual ? t.accents.peach : t.textSecondary;
            const etiqueta = m.competencia === provisao.mesAtual ? 'este mês' : m.futuro ? 'previsto' : '';
            const qtd = m.itens.length;
            // Agrupa por cartão dentro do mês só quando o membro usa vários.
            const grupos = multiplos && !filtroAtivo
              ? Object.values(m.itens.reduce((acc, c) => {
                  const o = origemDaCobranca(c);
                  if (!acc[o.key]) acc[o.key] = { key: o.key, label: o.label, total: 0, itens: [] as CobrancaDetalhada[] };
                  acc[o.key].total += Math.abs(Number(c.valor || 0));
                  acc[o.key].itens.push(c);
                  return acc;
                }, {} as Record<string, { key: string; label: string; total: number; itens: CobrancaDetalhada[] }>))
                  .sort((a, b) => b.total - a.total)
              : null;
            return (
              <div key={m.competencia} id={`mesgrupo-${m.competencia}`} style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '12px 14px 14px', borderRadius: 14,
                background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                borderLeft: `3px solid ${corMes}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 700, color: t.text, textTransform: 'capitalize' }}>{compToLabel(m.competencia)}</span>
                    {etiqueta && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${corMes}1f`, color: corMes }}>{etiqueta}</Tag>}
                    {tudoReembolsado && <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.sage}1a`, color: t.accents.sage }}><CheckCircle2 size={9} style={{ marginRight: 3 }} />reembolsado</Tag>}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontFamily: FONTS.display, fontSize: 15, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                      {formatBRL(total)}
                    </span>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary }}>{qtd} {qtd === 1 ? 'item' : 'itens'}</span>
                  </span>
                </div>
                {grupos ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {grupos.map((g) => (
                      <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textSecondary }}>
                            {g.key.startsWith('c:') && <CreditCard size={11} color={t.accents.blue} />}{g.label}
                          </span>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(g.total)}</span>
                        </div>
                        {g.itens.map((c) => (
                          <LinhaCobranca key={c.id} c={c} onTogglePago={onTogglePago} onEditar={onEditar} onRemover={onRemover} />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.itens.map((c) => (
                      <LinhaCobranca key={c.id} c={c} onTogglePago={onTogglePago} onEditar={onEditar} onRemover={onRemover} />
                    ))}
                  </div>
                )}
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
