import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Select, Empty, Skeleton, Tooltip, Modal, Form,
  Popconfirm, InputNumber, DatePicker, Switch, Segmented, AutoComplete,
} from 'antd';
import {
  Plus, Search, Trash2, Pencil, ExternalLink, Sparkles, Code2, Server, AtSign,
  Clapperboard, Boxes, ShieldCheck, CreditCard, CalendarClock, Wand2, Tag as TagIcon, ChevronRight, Copy, Crown, Leaf,
  LifeBuoy, Phone, Mail, BarChart3, AlertTriangle, Star,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import CartaoSelectorModal, { descreverCartao } from './CartaoSelectorModal';
import type { ServerResult, CartaoPessoal } from '../types';

interface Login {
  email: string;
  rotulo: string;
}

interface Conta {
  id: string;
  categoria: string;
  servico: string;
  rotulo: string;
  email: string;
  logins: Login[];
  url: string;
  plano: string;
  tipoCobranca: string;
  custo: number;
  moeda: string;
  formaPagamento: string;
  proximaCobranca: string;
  status: string;
  temSegredo: string;
  segredoLabel: string;
  tags: string;
  notas: string;
  recEmail: string;
  recTelefone: string;
  recNotas: string;
  criadoEm: string;
  atualizadoEm: string;
  cartaoId?: string;
}

// ─── Catálogos de apoio ───────────────────────────────────────────────────────
const CATEGORIAS: Record<string, { label: string; icon: React.ReactNode; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  email: { label: 'E-mail', icon: <AtSign size={15} />, accent: 'blue' },
  ia: { label: 'IA / Assistentes', icon: <Sparkles size={15} />, accent: 'lavender' },
  dev: { label: 'Dev / Código', icon: <Code2 size={15} />, accent: 'sage' },
  midia: { label: 'Mídia / Criação', icon: <Clapperboard size={15} />, accent: 'peach' },
  infra: { label: 'Infra / Cloud', icon: <Server size={15} />, accent: 'blue' },
  outro: { label: 'Outro', icon: <Boxes size={15} />, accent: 'peach' },
};

const STATUS: Record<string, { label: string; cor: string }> = {
  ativa: { label: 'Ativa', cor: '#3CB371' },
  trial: { label: 'Trial', cor: '#4C8DFF' },
  avaliar: { label: 'Avaliar', cor: '#B59AE0' },
  pausada: { label: 'Pausada', cor: '#E2A04A' },
  cancelada: { label: 'Cancelada', cor: '#8C8884' },
};

const TIPOS_COBRANCA = [
  { value: 'gratuito', label: 'Gratuito' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
  { value: 'uso', label: 'Por uso (créditos)' },
  { value: 'vitalicio', label: 'Vitalício' },
];

const MOEDAS = ['BRL', 'USD', 'EUR'];

function fmtMoeda(v: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(v);
  } catch {
    return `${moeda} ${v.toFixed(2)}`;
  }
}

// Normaliza qualquer cobrança pra equivalente mensal (pra somar o gasto recorrente).
function custoMensal(c: Conta): number {
  if (c.tipoCobranca === 'anual') return (c.custo || 0) / 12;
  if (c.tipoCobranca === 'mensal') return c.custo || 0;
  return 0;
}

function cadenciaLabel(t: string): string {
  if (t === 'mensal') return '/mês';
  if (t === 'anual') return '/ano';
  if (t === 'uso') return ' por uso';
  if (t === 'vitalicio') return ' vitalício';
  return '';
}

function ehGratis(c: Conta): boolean {
  return c.tipoCobranca === 'gratuito' || (!c.custo && c.tipoCobranca !== 'mensal' && c.tipoCobranca !== 'anual');
}

function diasAte(iso: string): number | null {
  if (!iso) return null;
  const d = dayjs(iso);
  if (!d.isValid()) return null;
  return d.startOf('day').diff(dayjs().startOf('day'), 'day');
}

export default function ContasPanel({ onAbrirCofre }: { onAbrirCofre?: (label?: string) => void } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('ativa');
  const [organizacao, setOrganizacao] = useState<'tipo' | 'categoria'>('tipo');
  const [seeding, setSeeding] = useState(false);

  // Detalhe de uma conta abre num modal (visão sempre limpa, sem empurrar a lista).
  const [detalhe, setDetalhe] = useState<Conta | null>(null);
  const [loginIdx, setLoginIdx] = useState(0);
  const abrirDetalhe = (c: Conta) => { setDetalhe(c); setLoginIdx(0); };

  const copiarTexto = (txt: string) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt)
      .then(() => message.success('Copiado'))
      .catch(() => { /* clipboard indisponível */ });
  };

  // Relatórios (Recuperação + Visão geral) num modal só, sem poluir a tela.
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relAba, setRelAba] = useState<'recuperacao' | 'geral'>('recuperacao');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();
  const temSegredoWatch = Form.useWatch('temSegredo', form);
  const cartaoIdSel = Form.useWatch('cartaoId', form) as string | undefined;

  // Cartões pessoais (do Financeiro Pessoal) — usados pra autofill da forma de
  // pagamento. Carrega uma vez junto com as contas; reusa entre aberturas do modal.
  const [cartoes, setCartoes] = useState<CartaoPessoal[]>([]);
  const [cartaoModalOpen, setCartaoModalOpen] = useState(false);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('contasList')
      .then((r) => { if (r.ok && r.data) setContas(r.data as Conta[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  const carregarCartoes = () => {
    callServer<ServerResult>('getCartoesPessoais')
      .then((r) => { if (r.ok && Array.isArray(r.data)) setCartoes(r.data as CartaoPessoal[]); })
      .catch(() => { /* sem cartões, segue normal */ });
  };

  useEffect(() => { carregar(); carregarCartoes(); }, []);

  const abrirNova = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'ia', status: 'ativa', tipoCobranca: 'gratuito', moeda: 'BRL', custo: 0, logins: [{ email: '', rotulo: '' }], cartaoId: '' });
    setModalAberto(true);
  };

  const abrirEditar = (c: Conta) => {
    setEditando(c);
    const logins = c.logins && c.logins.length ? c.logins : (c.email ? [{ email: c.email, rotulo: c.rotulo }] : [{ email: '', rotulo: '' }]);
    form.setFieldsValue({
      categoria: c.categoria || 'outro',
      servico: c.servico,
      logins,
      url: c.url,
      plano: c.plano,
      status: c.status || 'ativa',
      tipoCobranca: c.tipoCobranca || 'gratuito',
      custo: c.custo || 0,
      moeda: c.moeda || 'BRL',
      formaPagamento: c.formaPagamento,
      proximaCobranca: c.proximaCobranca && dayjs(c.proximaCobranca).isValid() ? dayjs(c.proximaCobranca) : null,
      temSegredo: c.temSegredo === 'sim',
      segredoLabel: c.segredoLabel,
      tags: c.tags,
      notas: c.notas,
      recEmail: c.recEmail,
      recTelefone: c.recTelefone,
      recNotas: c.recNotas,
      cartaoId: c.cartaoId || '',
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const logins = (Array.isArray(v.logins) ? v.logins : [])
        .map((x: Login) => ({ email: String(x?.email || '').trim(), rotulo: String(x?.rotulo || '').trim() }))
        .filter((x: Login) => x.email || x.rotulo);
      const payload = {
        id: editando?.id,
        categoria: v.categoria,
        servico: v.servico,
        logins,
        url: v.url || '',
        plano: v.plano || '',
        status: v.status || 'ativa',
        tipoCobranca: v.tipoCobranca || 'gratuito',
        custo: v.custo || 0,
        moeda: v.moeda || 'BRL',
        formaPagamento: v.formaPagamento || '',
        proximaCobranca: v.proximaCobranca ? dayjs(v.proximaCobranca).format('YYYY-MM-DD') : '',
        temSegredo: v.temSegredo ? 'sim' : '',
        segredoLabel: v.segredoLabel || '',
        tags: v.tags || '',
        notas: v.notas || '',
        recEmail: v.recEmail || '',
        recTelefone: v.recTelefone || '',
        recNotas: v.recNotas || '',
        cartaoId: v.cartaoId || '',
      };
      const r = await callServer<ServerResult>('contasSave', payload);
      if (r.ok) {
        message.success(editando ? 'Conta atualizada' : 'Conta adicionada');
        setModalAberto(false);
        setEditando(null);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  const remover = async (id: string) => {
    const r = await callServer<ServerResult>('contasDelete', id);
    if (r.ok) { message.success('Conta removida'); setContas((cs) => cs.filter((c) => c.id !== id)); }
    else message.error(r.error || 'Erro');
  };

  const semear = async () => {
    setSeeding(true);
    try {
      const r = await callServer<ServerResult>('contasSeedCatalogo');
      if (r.ok) {
        const n = (r.data as { inseridos: number })?.inseridos ?? 0;
        message.success(n > 0 ? `${n} sugestões adicionadas (status "avaliar").` : 'Catálogo já estava completo — nada a adicionar.');
        if (n > 0) carregar();
      } else message.error(r.error || 'Erro');
    } finally { setSeeding(false); }
  };

  // ─── Derivados ────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contas.filter((c) => {
      if (filtroCat !== 'todas' && c.categoria !== filtroCat) return false;
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (!q) return true;
      const loginsTxt = (c.logins || []).map((l) => `${l.email} ${l.rotulo}`).join(' ').toLowerCase();
      return (
        c.servico.toLowerCase().indexOf(q) >= 0 ||
        c.rotulo.toLowerCase().indexOf(q) >= 0 ||
        c.email.toLowerCase().indexOf(q) >= 0 ||
        loginsTxt.indexOf(q) >= 0 ||
        c.plano.toLowerCase().indexOf(q) >= 0 ||
        c.tags.toLowerCase().indexOf(q) >= 0 ||
        (c.recEmail || '').toLowerCase().indexOf(q) >= 0 ||
        (c.recTelefone || '').toLowerCase().indexOf(q) >= 0
      );
    });
  }, [contas, busca, filtroCat, filtroStatus]);

  const resumo = useMemo(() => {
    const ativas = contas.filter((c) => c.status === 'ativa').length;
    const pagas = contas.filter((c) => !ehGratis(c) && (c.tipoCobranca === 'mensal' || c.tipoCobranca === 'anual')).length;
    // Custo mensal por moeda (recorrentes).
    const porMoeda: Record<string, number> = {};
    for (const c of contas) {
      const m = custoMensal(c);
      if (m > 0) porMoeda[c.moeda || 'BRL'] = (porMoeda[c.moeda || 'BRL'] || 0) + m;
    }
    // Próximas renovações (<= 14 dias).
    const proximas = contas
      .map((c) => ({ c, d: diasAte(c.proximaCobranca) }))
      .filter((x) => x.d !== null && (x.d as number) >= 0 && (x.d as number) <= 14)
      .sort((a, b) => (a.d as number) - (b.d as number));
    return { total: contas.length, ativas, pagas, porMoeda, proximas };
  }, [contas]);

  const catContagem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contas) m[c.categoria] = (m[c.categoria] || 0) + 1;
    return m;
  }, [contas]);

  // Agrupa as filtradas por categoria (na ordem do catálogo), com ativas primeiro.
  const grupos = useMemo(() => {
    const ordemStatus: Record<string, number> = { ativa: 0, trial: 1, avaliar: 2, pausada: 3, cancelada: 4 };
    const byCat: Record<string, Conta[]> = {};
    for (const c of filtradas) (byCat[c.categoria] = byCat[c.categoria] || []).push(c);
    const chaves = Object.keys(CATEGORIAS).filter((k) => byCat[k]?.length);
    // categorias fora do catálogo conhecido entram no fim
    for (const k of Object.keys(byCat)) if (chaves.indexOf(k) < 0) chaves.push(k);
    return chaves.map((k) => ({
      cat: k,
      contas: byCat[k].sort((a, b) =>
        (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) || a.servico.localeCompare(b.servico)),
    }));
  }, [filtradas]);

  // Split por tipo: Premium (planos pagos) à direita, Gratuitas à esquerda.
  // Ambas mantêm a mesma ordenação (status → nome) das outras visões.
  const { premium, gratuitas, premiumCustoTxt } = useMemo(() => {
    const ordemStatus: Record<string, number> = { ativa: 0, trial: 1, avaliar: 2, pausada: 3, cancelada: 4 };
    const ordenar = (arr: Conta[]) => [...arr].sort((a, b) =>
      (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) || a.servico.localeCompare(b.servico));
    const pg = ordenar(filtradas.filter((c) => !ehGratis(c)));
    const gr = ordenar(filtradas.filter((c) => ehGratis(c)));
    const porMoeda: Record<string, number> = {};
    for (const c of pg) {
      const m = custoMensal(c);
      if (m > 0) porMoeda[c.moeda || 'BRL'] = (porMoeda[c.moeda || 'BRL'] || 0) + m;
    }
    const txt = Object.entries(porMoeda).map(([m, v]) => fmtMoeda(v, m)).join(' + ');
    return { premium: pg, gratuitas: gr, premiumCustoTxt: txt };
  }, [filtradas]);

  // ─── Relatório de Recuperação (client-side, sobre TODAS as contas) ──────────
  // Agrupa por valor de e-mail/telefone de recuperação pra responder: "se eu
  // trocar/cancelar este contato, quais contas preciso atualizar antes?".
  const relatorio = useMemo(() => {
    const splitVals = (s: string): string[] =>
      String(s || '').split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

    const agrupar = (campo: 'recEmail' | 'recTelefone') => {
      const mapa = new Map<string, { valor: string; contas: Conta[] }>();
      for (const c of contas) {
        for (const v of splitVals(c[campo])) {
          const k = v.toLowerCase();
          if (!mapa.has(k)) mapa.set(k, { valor: v, contas: [] });
          mapa.get(k)!.contas.push(c);
        }
      }
      return Array.from(mapa.values()).sort(
        (a, b) => b.contas.length - a.contas.length || a.valor.localeCompare(b.valor),
      );
    };

    const porEmail = agrupar('recEmail');
    const porTelefone = agrupar('recTelefone');
    const temRec = (c: Conta) => !!(c.recEmail || c.recTelefone || c.recNotas);
    const comRec = contas.filter(temRec);
    // Contas que ainda não têm nenhum dado de recuperação (ignora canceladas).
    const semRec = contas.filter((c) => !temRec(c) && c.status !== 'cancelada')
      .sort((a, b) => a.servico.localeCompare(b.servico));
    // Contatos compartilhados por 2+ contas (maior risco ao trocar).
    const compartilhados = [...porEmail, ...porTelefone].filter((g) => g.contas.length > 1).length;

    return { porEmail, porTelefone, semRec, comRecTotal: comRec.length, compartilhados };
  }, [contas]);

  // E-mails já cadastrados (de todas as contas) pra sugerir no campo de login.
  const emailOpcoes = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const c of contas) {
      const logins = c.logins && c.logins.length ? c.logins : (c.email ? [{ email: c.email, rotulo: c.rotulo }] : []);
      for (const l of logins) {
        const e = String(l.email || '').trim();
        if (!e) continue;
        if (!mapa.has(e)) mapa.set(e, new Set());
        if (c.servico) mapa.get(e)!.add(c.servico);
      }
    }
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([email, servs]) => ({ email, servicos: Array.from(servs) }));
  }, [contas]);

  // Visão geral (client-side) — contagens por status/categoria e cobertura.
  const visaoGeral = useMemo(() => {
    const porStatus: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    for (const c of contas) {
      porStatus[c.status] = (porStatus[c.status] || 0) + 1;
      porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + 1;
    }
    const pagas = contas.filter((c) => !ehGratis(c)).length;
    return { porStatus, porCategoria, pagas, gratis: contas.length - pagas };
  }, [contas]);

  // ─── Render ───────────────────────────────────────────────────────────────

  // Coluna de contas (usada na visão "Grátis / Premium").
  const renderColuna = (
    key: string,
    titulo: string,
    icon: React.ReactNode,
    accent: string,
    lista: Conta[],
    extra?: React.ReactNode,
  ) => (
    <div key={key} style={{ border: `1px solid ${t.border}`, borderRadius: 14, background: t.surface, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 15px', background: `${accent}0d`, borderBottom: `1px solid ${t.borderSoft}` }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}24`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{titulo}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>{lista.length}</span>
        <span style={{ flex: 1 }} />
        {extra}
      </div>
      <div>
        {lista.length ? lista.map((c, i) => (
          <ContaRow
            key={c.id}
            c={c}
            primeira={i === 0}
            onAbrir={() => abrirDetalhe(c)}
          />
        )) : (
          <div style={{ padding: '26px 16px', textAlign: 'center', fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>
            Nenhuma conta {key === 'premium' ? 'paga' : 'gratuita'} {filtroStatus !== 'todos' ? 'neste filtro' : ''}.
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 24 }} />;

  const custoMoedasTxt = Object.keys(resumo.porMoeda).length
    ? Object.entries(resumo.porMoeda).map(([m, v]) => fmtMoeda(v, m)).join(' + ')
    : '—';

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      {/* Banner de segurança */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: `${t.accents.blue}10`, border: `1px solid ${t.accents.blue}33`,
        borderRadius: 12, padding: 14, marginBottom: 16,
      }}>
        <ShieldCheck size={16} color={t.accents.blue} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6 }}>
          Aqui ficam os <strong style={{ color: t.text }}>metadados</strong> das suas contas (plano, cobrança, custo, renovação).
          Senhas e API keys <strong style={{ color: t.text }}>não</strong> são guardadas aqui — use o <strong style={{ color: t.text }}>Cofre</strong> (criptografado ponta-a-ponta)
          e marque <em>“senha no Cofre”</em> pra lembrar onde está.
        </div>
      </div>

      {/* Header + ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
          {resumo.total} {resumo.total === 1 ? 'conta' : 'contas'} no seu QG
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Tooltip title="Relatórios das contas: recuperação (e-mails/telefones) e visão geral">
            <Button icon={<BarChart3 size={14} />} onClick={() => { setRelAba('recuperacao'); setRelatorioAberto(true); }}>Relatórios</Button>
          </Tooltip>
          <Tooltip title="Adiciona ferramentas atuais de IA, dev e e-mail pra você só completar (não duplica o que já existe)">
            <Button icon={<Wand2 size={14} />} loading={seeding} onClick={semear}>Semear catálogo</Button>
          </Tooltip>
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Adicionar conta</Button>
        </div>
      </div>

      {/* Resumo (stat tiles) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatTile titulo="Total de contas" valor={String(resumo.total)} sub={`${resumo.ativas} ativas`} icon={<Boxes size={16} />} cor={t.accents.lavender} />
        <StatTile titulo="Custo mensal" valor={custoMoedasTxt} sub={`${resumo.pagas} pagas (recorrentes)`} icon={<CreditCard size={16} />} cor={t.accents.peach} />
        <StatTile
          titulo="Renovações ≤ 14d"
          valor={String(resumo.proximas.length)}
          sub={resumo.proximas[0] ? `próx.: ${resumo.proximas[0].c.servico}` : 'nenhuma à vista'}
          icon={<CalendarClock size={16} />}
          cor={resumo.proximas.length ? t.accents.peach : t.accents.sage}
        />
        <StatTile titulo="Categorias" valor={String(Object.keys(catContagem).length)} sub="tipos de conta" icon={<TagIcon size={16} />} cor={t.accents.blue} />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por serviço, rótulo, e-mail, tag…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          value={filtroCat}
          onChange={setFiltroCat}
          style={{ width: 180 }}
          options={[
            { value: 'todas', label: 'Todas as categorias' },
            ...Object.entries(CATEGORIAS).map(([k, v]) => ({ value: k, label: `${v.label}${catContagem[k] ? ` (${catContagem[k]})` : ''}` })),
          ]}
        />
        <Segmented
          value={filtroStatus}
          onChange={(v) => setFiltroStatus(v as string)}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'ativa', label: 'Ativas' },
            { value: 'avaliar', label: 'Avaliar' },
            { value: 'trial', label: 'Trial' },
            { value: 'cancelada', label: 'Canceladas' },
          ]}
        />
      </div>

      {/* Lista de cards */}
      {filtradas.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: t.textSecondary, fontFamily: FONTS.ui }}>
              {contas.length === 0
                ? 'Nenhuma conta ainda. Clique em "Semear catálogo" pra começar com sugestões, ou adicione a sua.'
                : 'Nenhuma conta combina com os filtros.'}
            </span>
          }
        >
          {contas.length === 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button icon={<Wand2 size={14} />} loading={seeding} onClick={semear}>Semear catálogo</Button>
              <Button type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Adicionar conta</Button>
            </div>
          )}
        </Empty>
      ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            {filtradas.length} {filtradas.length === 1 ? 'conta' : 'contas'}
          </span>
          <Segmented
            size="small"
            value={organizacao}
            onChange={(v) => setOrganizacao(v as 'tipo' | 'categoria')}
            options={[
              { value: 'tipo', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Crown size={12} /> Grátis / Premium</span> },
              { value: 'categoria', label: 'Por categoria' },
            ]}
          />
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            Clique numa conta pra ver os detalhes
          </span>
        </div>
        {organizacao === 'tipo' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, alignItems: 'start' }}>
            {renderColuna('gratuitas', 'Gratuitas', <Leaf size={14} />, t.accents.sage, gratuitas)}
            {renderColuna('premium', 'Premium', <Crown size={14} />, t.accents.peach, premium,
              premiumCustoTxt ? (
                <Tooltip title="Custo mensal recorrente das contas pagas (mensais + anuais rateados)">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: t.text, background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}33`, borderRadius: 999, padding: '2px 10px', cursor: 'help' }}>
                    <CreditCard size={12} color={t.accents.peach} />
                    {premiumCustoTxt}<span style={{ color: t.textTertiary, fontWeight: 400 }}>/mês</span>
                  </span>
                </Tooltip>
              ) : null,
            )}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map((g) => {
            const cat = CATEGORIAS[g.cat] || CATEGORIAS.outro;
            const accent = t.accents[cat.accent];
            // Custo mensal recorrente do grupo, por moeda (mesmo critério do resumo).
            const custoGrupo: Record<string, number> = {};
            for (const c of g.contas) {
              const m = custoMensal(c);
              if (m > 0) custoGrupo[c.moeda || 'BRL'] = (custoGrupo[c.moeda || 'BRL'] || 0) + m;
            }
            const custoGrupoTxt = Object.entries(custoGrupo).map(([m, v]) => fmtMoeda(v, m)).join(' + ');
            return (
              <div key={g.cat} style={{ border: `1px solid ${t.border}`, borderRadius: 14, background: t.surface, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: t.surfaceMuted, borderBottom: `1px solid ${t.borderSoft}` }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}1f`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cat.icon}</span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{cat.label}</span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>{g.contas.length}</span>
                  <span style={{ flex: 1 }} />
                  {custoGrupoTxt && (
                    <Tooltip title="Custo mensal recorrente desta categoria (mensais + anuais rateados)">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: t.text, background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}33`, borderRadius: 999, padding: '2px 10px', cursor: 'help' }}>
                        <CreditCard size={12} color={t.accents.peach} />
                        {custoGrupoTxt}<span style={{ color: t.textTertiary, fontWeight: 400 }}>/mês</span>
                      </span>
                    </Tooltip>
                  )}
                </div>
                <div>
                  {g.contas.map((c, i) => (
                    <ContaRow
                      key={c.id}
                      c={c}
                      primeira={i === 0}
                      onAbrir={() => abrirDetalhe(c)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
      )}

      {/* Modal add/edit */}
      <Modal
        open={modalAberto}
        onCancel={() => { setModalAberto(false); setEditando(null); }}
        onOk={salvar}
        okText={editando ? 'Salvar alterações' : 'Adicionar conta'}
        cancelText="Cancelar"
        confirmLoading={salvando}
        title={editando ? `Editar: ${editando.servico}` : 'Adicionar conta'}
        width={620}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="categoria" label="Categoria">
              <Select options={Object.entries(CATEGORIAS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </Form.Item>
            <Form.Item name="servico" label="Serviço / conta" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: ChatGPT, Gmail, Cursor" />
            </Form.Item>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, marginBottom: 6 }}>
              Contas / e-mails
              <span style={{ color: t.textTertiary, fontWeight: 400 }}> — adicione quantas precisar (ex.: pessoal e trabalho)</span>
            </div>
            <Form.List name="logins">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map((field) => (
                    <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: 8, alignItems: 'start' }}>
                      <Form.Item {...field} key={`${field.key}-email`} name={[field.name, 'email']} style={{ marginBottom: 0 }}>
                        <AutoComplete
                          options={emailOpcoes.map((o) => ({
                            value: o.email,
                            label: (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.email}</span>
                                {o.servicos.length > 0 && (
                                  <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, flexShrink: 0 }}>{o.servicos.slice(0, 2).join(', ')}{o.servicos.length > 2 ? '…' : ''}</span>
                                )}
                              </div>
                            ),
                          }))}
                          filterOption={(input, option) => String(option?.value || '').toLowerCase().includes(input.toLowerCase())}
                        >
                          <Input prefix={<AtSign size={13} color={t.textTertiary} />} placeholder="voce@example.com" />
                        </AutoComplete>
                      </Form.Item>
                      <Form.Item {...field} key={`${field.key}-rotulo`} name={[field.name, 'rotulo']} style={{ marginBottom: 0 }}>
                        <Input placeholder="apelido (pessoal…)" />
                      </Form.Item>
                      <Tooltip title="Remover este login">
                        <Button type="text" icon={<Trash2 size={14} />} danger onClick={() => remove(field.name)} disabled={fields.length <= 1} />
                      </Tooltip>
                    </div>
                  ))}
                  <Button type="dashed" icon={<Plus size={14} />} onClick={() => add({ email: '', rotulo: '' })} style={{ alignSelf: 'flex-start' }}>
                    Adicionar e-mail / conta
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
          <Form.Item name="url" label="URL (login / dashboard)">
            <Input placeholder="https://…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="plano" label="Plano">
              <Input placeholder="Free, Plus, Pro, Team…" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 12 }}>
            <Form.Item name="tipoCobranca" label="Cobrança">
              <Select options={TIPOS_COBRANCA} />
            </Form.Item>
            <Form.Item name="custo" label="Valor">
              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
            <Form.Item name="moeda" label="Moeda">
              <Select options={MOEDAS.map((m) => ({ value: m, label: m }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Forma de pagamento: texto livre (PIX, boleto, etc.) + atalho pra
                puxar um cartão cadastrado no Financeiro Pessoal — quando o user
                escolhe, preenchemos o texto com "Cartão X (Bandeira)" + gravamos
                o cartaoId pra ligar as duas áreas do app. */}
            <Form.Item label={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%' }}>
                Forma de pagamento
                <span style={{ flex: 1 }} />
                <Tooltip title={cartoes.length ? 'Puxar um cartão do Financeiro Pessoal' : 'Cadastre cartões em Financeiro > Pessoal > Cartões'}>
                  <Button
                    size="small"
                    type="link"
                    icon={<CreditCard size={12} />}
                    onClick={() => setCartaoModalOpen(true)}
                    style={{ padding: 0, height: 'auto', fontSize: 11.5 }}
                  >
                    {cartaoIdSel ? 'Trocar cartão' : 'Escolher cartão'}
                  </Button>
                </Tooltip>
              </span>
            )} extra="ex.: cartão final 1234, PIX, boleto, débito automático">
              <Form.Item name="formaPagamento" noStyle>
                <Input placeholder="cartão final ****" />
              </Form.Item>
              {cartaoIdSel && (() => {
                const c = cartoes.find((x) => x.id === cartaoIdSel);
                if (!c) return null;
                const cor = c.cor || t.accents.lavender;
                return (
                  <div style={{
                    marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 9px', borderRadius: 999,
                    background: `${cor}12`, border: `1px solid ${cor}40`,
                    fontFamily: FONTS.ui, fontSize: 11, color: t.text,
                  }}>
                    <CreditCard size={11} color={cor} />
                    Vinculado a: <strong style={{ fontWeight: 600 }}>{descreverCartao(c)}</strong>
                    <Button
                      type="text" size="small"
                      onClick={() => form.setFieldsValue({ cartaoId: '' })}
                      style={{ padding: '0 4px', height: 18, fontSize: 10, color: t.textTertiary }}
                    >
                      desvincular
                    </Button>
                  </div>
                );
              })()}
              {/* campo escondido — só pro Form reconhecer o cartaoId */}
              <Form.Item name="cartaoId" hidden>
                <Input />
              </Form.Item>
            </Form.Item>
            <Form.Item name="proximaCobranca" label="Próxima cobrança / renovação">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="selecione" />
            </Form.Item>
          </div>
          <div style={{
            border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            background: t.surfaceMuted,
          }}>
            <Form.Item name="temSegredo" valuePropName="checked" style={{ marginBottom: temSegredoWatch ? 10 : 0 }}>
              <Switch /> <span style={{ marginLeft: 8, fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>Senha / API key guardada no Cofre</span>
            </Form.Item>
            {temSegredoWatch && (
              <Form.Item name="segredoLabel" label="Label do item no Cofre" style={{ marginBottom: 0 }} extra="O nome que você deu ao segredo lá no Cofre, pra achar rápido.">
                <Input placeholder="ex.: OpenAI API key (pessoal)" />
              </Form.Item>
            )}
          </div>
          {/* Recuperação — destaque: base do relatório de recuperação */}
          <div style={{
            border: `1px solid ${t.accents.rose}40`, borderRadius: 10, padding: '12px 14px', marginBottom: 14,
            background: `${t.accents.rose}0d`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: `${t.accents.rose}24`, color: t.accents.rose, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LifeBuoy size={14} />
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 700, color: t.text }}>Recuperação</span>
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
              E-mail e telefone usados pra recuperar esta conta. Vira um relatório pra você achar e atualizar
              tudo <strong style={{ color: t.text }}>antes</strong> de trocar/cancelar um e-mail ou número antigo.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="recEmail" label="E-mail de recuperação" style={{ marginBottom: 0 }} extra="vários? separe por vírgula">
                <AutoComplete
                  options={emailOpcoes.map((o) => ({
                    value: o.email,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.email}</span>
                        {o.servicos.length > 0 && (
                          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, flexShrink: 0 }}>{o.servicos.slice(0, 2).join(', ')}{o.servicos.length > 2 ? '…' : ''}</span>
                        )}
                      </div>
                    ),
                  }))}
                  filterOption={(input, option) => String(option?.value || '').toLowerCase().includes(input.toLowerCase())}
                >
                  <Input prefix={<Mail size={13} color={t.textTertiary} />} placeholder="ex.: backup@example.com" />
                </AutoComplete>
              </Form.Item>
              <Form.Item name="recTelefone" label="Telefone de recuperação" style={{ marginBottom: 0 }} extra="vários? separe por vírgula">
                <Input prefix={<Phone size={13} color={t.textTertiary} />} placeholder="ex.: +55 11 99999-9999" />
              </Form.Item>
            </div>
            <Form.Item name="recNotas" label="Outros (códigos de backup, 2FA, perguntas)" style={{ marginBottom: 0, marginTop: 12 }}>
              <Input.TextArea rows={2} placeholder="ex.: app autenticador no celular X, códigos de backup no Cofre…" />
            </Form.Item>
          </div>

          <Form.Item name="tags" label="Tags" extra="separe por vírgula">
            <Input placeholder="favorito, testar, trabalho" />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Pra que serve, limites do plano, observações…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de detalhes da conta — visão limpa, sem empurrar a lista */}
      <Modal
        open={!!detalhe}
        onCancel={() => setDetalhe(null)}
        footer={null}
        width={500}
        title={detalhe ? (() => {
          const cat = CATEGORIAS[detalhe.categoria] || CATEGORIAS.outro;
          const accent = t.accents[cat.accent];
          const st = STATUS[detalhe.status] || STATUS.ativa;
          const temRec = !!(detalhe.recEmail || detalhe.recTelefone || detalhe.recNotas);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 28 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}1f`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cat.icon}</span>
              <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detalhe.servico}</span>
              {temRec && (
                <Tooltip title="Dados de recuperação preenchidos">
                  <Star size={15} color={t.accents.peach} fill={t.accents.peach} style={{ flexShrink: 0 }} />
                </Tooltip>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: `${st.cor}1a`, color: st.cor, borderRadius: 999, padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />
                {st.label}
              </span>
            </div>
          );
        })() : null}
      >
        {detalhe && (() => {
          const c = detalhe;
          const cat = CATEGORIAS[c.categoria] || CATEGORIAS.outro;
          const accent = t.accents[cat.accent];
          const gratis = ehGratis(c);
          const dias = diasAte(c.proximaCobranca);
          const logins = c.logins && c.logins.length ? c.logins : (c.email ? [{ email: c.email, rotulo: c.rotulo }] : []);
          const lsel = logins[loginIdx] || logins[0];
          const cobrancaLabel = gratis ? 'Grátis' : (TIPOS_COBRANCA.find((x) => x.value === c.tipoCobranca)?.label || '—');
          const renovTxt = dias === null ? '—' : dias < 0 ? 'venceu' : dias === 0 ? 'renova hoje' : `em ${dias} dias`;
          return (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Seletor de e-mail / conta */}
              <div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
                  {logins.length > 1 ? `Escolha a conta (${logins.length})` : 'Conta / e-mail'}
                </div>
                {logins.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {logins.map((l, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLoginIdx(i)}
                        style={{
                          fontFamily: FONTS.ui, fontSize: 12, fontWeight: 500,
                          padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                          background: i === loginIdx ? `${accent}1a` : t.surface,
                          color: i === loginIdx ? t.text : t.textSecondary,
                          border: `1px solid ${i === loginIdx ? `${accent}80` : t.border}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        {l.rotulo || l.email || `Conta ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                {lsel ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px' }}>
                    <AtSign size={15} color={accent} style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {lsel.rotulo && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{lsel.rotulo}</div>}
                      <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lsel.email || '—'}</div>
                    </div>
                    {lsel.email && (
                      <Tooltip title="Copiar e-mail">
                        <Button size="small" type="text" icon={<Copy size={14} />} onClick={() => copiarTexto(lsel.email)} />
                      </Tooltip>
                    )}
                  </div>
                ) : (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>Nenhum e-mail cadastrado.</div>
                )}
              </div>

              {/* Metadados */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <Campo label="Plano" valor={c.plano || '—'} />
                <Campo label="Cobrança" valor={cobrancaLabel} />
                <Campo label="Custo" valor={gratis || !c.custo ? '—' : `${fmtMoeda(c.custo, c.moeda)}${cadenciaLabel(c.tipoCobranca)}`} />
                <Campo label="Renovação" valor={renovTxt} destaque={dias !== null && dias >= 0 && dias <= 7 ? t.accents.peach : undefined} />
                <Campo label="Pagamento" valor={c.formaPagamento || '—'} />
                <Campo label="Categoria" valor={cat.label} />
              </div>

              {/* Notas */}
              {c.notas && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, borderLeft: `2px solid ${accent}66`, paddingLeft: 11 }}>{c.notas}</div>
              )}

              {/* Recuperação — em destaque */}
              {(c.recEmail || c.recTelefone || c.recNotas) && (
                <div style={{ border: `1px solid ${t.accents.rose}40`, background: `${t.accents.rose}0d`, borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                    <LifeBuoy size={13} color={t.accents.rose} />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.accents.rose, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Recuperação</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {c.recEmail && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Mail size={13} color={t.textTertiary} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, flex: 1, wordBreak: 'break-all' }}>{c.recEmail}</span>
                        <Tooltip title="Copiar"><Button size="small" type="text" icon={<Copy size={13} />} onClick={() => copiarTexto(c.recEmail)} /></Tooltip>
                      </div>
                    )}
                    {c.recTelefone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Phone size={13} color={t.textTertiary} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, flex: 1 }}>{c.recTelefone}</span>
                        <Tooltip title="Copiar"><Button size="small" type="text" icon={<Copy size={13} />} onClick={() => copiarTexto(c.recTelefone)} /></Tooltip>
                      </div>
                    )}
                    {c.recNotas && (
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>{c.recNotas}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {c.tags && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {c.tags.split(',').map((x) => x.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '2px 7px' }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Ações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: `1px solid ${t.borderSoft}` }}>
                {c.url && (
                  <Button size="small" icon={<ExternalLink size={13} />} href={c.url} target="_blank" rel="noopener noreferrer">Abrir</Button>
                )}
                {c.temSegredo === 'sim' && onAbrirCofre && (
                  <Tooltip title={c.segredoLabel ? `Ver no Cofre: ${c.segredoLabel}` : 'Abrir o Cofre'}>
                    <Button size="small" icon={<ShieldCheck size={13} />} onClick={() => { onAbrirCofre(c.segredoLabel || c.servico); setDetalhe(null); }}>Cofre</Button>
                  </Tooltip>
                )}
                <Button size="small" icon={<Pencil size={13} />} onClick={() => { setDetalhe(null); abrirEditar(c); }}>Editar</Button>
                <span style={{ flex: 1 }} />
                <Popconfirm title="Remover esta conta?" onConfirm={() => { remover(c.id); setDetalhe(null); }} okText="Remover" cancelText="Cancelar">
                  <Button size="small" danger icon={<Trash2 size={13} />}>Remover</Button>
                </Popconfirm>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal de Relatórios — Recuperação + Visão geral */}
      <Modal
        open={relatorioAberto}
        onCancel={() => setRelatorioAberto(false)}
        footer={null}
        width={620}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: `${t.accents.lavender}1f`, color: t.accents.lavender, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={16} /></span>
            <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text }}>Relatórios de Contas</span>
          </div>
        }
      >
        <div style={{ marginTop: 10 }}>
          <Segmented
            block
            value={relAba}
            onChange={(v) => setRelAba(v as 'recuperacao' | 'geral')}
            options={[
              { value: 'recuperacao', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LifeBuoy size={13} /> Recuperação</span> },
              { value: 'geral', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Boxes size={13} /> Visão geral</span> },
            ]}
            style={{ marginBottom: 16 }}
          />

          {relAba === 'recuperacao' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {/* Resumo topo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <RelMini titulo="Com recuperação" valor={String(relatorio.comRecTotal)} cor={t.accents.sage} />
                <RelMini titulo="Sem recuperação" valor={String(relatorio.semRec.length)} cor={relatorio.semRec.length ? t.accents.peach : t.accents.sage} />
                <RelMini titulo="Contatos compartilhados" valor={String(relatorio.compartilhados)} cor={relatorio.compartilhados ? t.accents.rose : t.accents.sage} />
              </div>

              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.55, background: `${t.accents.blue}0d`, border: `1px solid ${t.accents.blue}33`, borderRadius: 9, padding: '9px 11px' }}>
                Vai trocar ou cancelar um e-mail/telefone? Procure-o abaixo: todas as contas que dependem dele
                aparecem juntas pra você atualizar antes.
              </div>

              {/* Por e-mail */}
              <RelGrupo
                titulo="Por e-mail de recuperação"
                icon={<Mail size={13} />}
                vazio="Nenhum e-mail de recuperação cadastrado ainda."
                grupos={relatorio.porEmail}
                onCopiar={copiarTexto}
                onAbrir={(c) => { setRelatorioAberto(false); abrirDetalhe(c); }}
              />

              {/* Por telefone */}
              <RelGrupo
                titulo="Por telefone de recuperação"
                icon={<Phone size={13} />}
                vazio="Nenhum telefone de recuperação cadastrado ainda."
                grupos={relatorio.porTelefone}
                onCopiar={copiarTexto}
                onAbrir={(c) => { setRelatorioAberto(false); abrirDetalhe(c); }}
              />

              {/* Sem recuperação */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                  <AlertTriangle size={13} color={t.accents.peach} />
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 700, color: t.text }}>Faltando recuperação</span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>{relatorio.semRec.length}</span>
                </div>
                {relatorio.semRec.length === 0 ? (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Tudo certo — todas as contas ativas têm algum dado de recuperação.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {relatorio.semRec.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setRelatorioAberto(false); abrirDetalhe(c); }}
                        style={{ fontFamily: FONTS.ui, fontSize: 12, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', background: t.surface, color: t.textSecondary, border: `1px solid ${t.border}` }}
                      >
                        {c.servico}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <RelMini titulo="Total de contas" valor={String(resumo.total)} cor={t.accents.lavender} />
                <RelMini titulo="Pagas" valor={String(visaoGeral.pagas)} cor={t.accents.peach} />
                <RelMini titulo="Gratuitas" valor={String(visaoGeral.gratis)} cor={t.accents.sage} />
              </div>

              <RelBreakdown
                titulo="Por status"
                itens={Object.entries(visaoGeral.porStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => ({ label: STATUS[k]?.label || k, valor: n, cor: STATUS[k]?.cor || t.textTertiary }))}
                total={resumo.total}
              />

              <RelBreakdown
                titulo="Por categoria"
                itens={Object.entries(visaoGeral.porCategoria)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => ({ label: CATEGORIAS[k]?.label || k, valor: n, cor: t.accents[CATEGORIAS[k]?.accent || 'lavender'] }))}
                total={resumo.total}
              />

              <div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 9 }}>Custo mensal recorrente</div>
                <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: t.text }}>
                  {Object.keys(resumo.porMoeda).length ? Object.entries(resumo.porMoeda).map(([m, v]) => fmtMoeda(v, m)).join(' + ') : '—'}
                </div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
                  {resumo.proximas.length} renovação(ões) nos próximos 14 dias
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de seleção de cartão — compartilhado com FinAssinaturas. Quando
          o user escolhe um cartão, preenchemos `formaPagamento` com um texto
          legível ("Cartão X (Bandeira)") e gravamos o `cartaoId` num campo
          escondido, mantendo o ponteiro pro Financeiro Pessoal. */}
      <CartaoSelectorModal
        open={cartaoModalOpen}
        cartoes={cartoes}
        selectedId={cartaoIdSel}
        onClose={() => setCartaoModalOpen(false)}
        onSelect={(c) => {
          if (c) {
            form.setFieldsValue({
              cartaoId: c.id,
              formaPagamento: descreverCartao(c),
            });
          } else {
            form.setFieldsValue({ cartaoId: '' });
          }
          setCartaoModalOpen(false);
        }}
        title="Cartão usado para pagar esta conta"
      />
    </div>
  );
}

// ─── Sub: mini-stat do relatório ──────────────────────────────────────────────
function RelMini({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 11, padding: '11px 13px', background: t.surface }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: cor, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{titulo}</div>
    </div>
  );
}

// ─── Sub: grupo do relatório de recuperação (valor → contas) ──────────────────
function RelGrupo({ titulo, icon, vazio, grupos, onCopiar, onAbrir }: {
  titulo: string; icon: React.ReactNode; vazio: string;
  grupos: Array<{ valor: string; contas: Conta[] }>;
  onCopiar: (s: string) => void; onAbrir: (c: Conta) => void;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{ color: t.accents.rose, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 700, color: t.text }}>{titulo}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>{grupos.length}</span>
      </div>
      {grupos.length === 0 ? (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>{vazio}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grupos.map((g) => {
            const compartilhado = g.contas.length > 1;
            return (
              <div key={g.valor} style={{ border: `1px solid ${compartilhado ? `${t.accents.rose}40` : t.border}`, background: compartilhado ? `${t.accents.rose}0a` : t.surface, borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, flex: 1, wordBreak: 'break-all' }}>{g.valor}</span>
                  {compartilhado && (
                    <span style={{ fontFamily: FONTS.ui, fontSize: 10, fontWeight: 700, color: t.accents.rose, background: `${t.accents.rose}1f`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>{g.contas.length} contas</span>
                  )}
                  <Tooltip title="Copiar"><Button size="small" type="text" icon={<Copy size={12} />} onClick={() => onCopiar(g.valor)} /></Tooltip>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.contas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onAbrir(c)}
                      style={{ fontFamily: FONTS.ui, fontSize: 11.5, padding: '3px 9px', borderRadius: 7, cursor: 'pointer', background: t.surfaceMuted, color: t.textSecondary, border: `1px solid ${t.borderSoft}` }}
                    >
                      {c.servico}
                    </button>
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

// ─── Sub: breakdown com barras (status/categoria) ─────────────────────────────
function RelBreakdown({ titulo, itens, total }: {
  titulo: string; itens: Array<{ label: string; valor: number; cor: string }>; total: number;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 9 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {itens.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <div style={{ flex: 1, height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
              <div style={{ width: `${total ? Math.round((it.valor / total) * 100) : 0}%`, height: '100%', background: it.cor, borderRadius: 999 }} />
            </div>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text, width: 24, textAlign: 'right' }}>{it.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub: campo label/valor do modal de detalhes ──────────────────────────────
function Campo({ label, valor, destaque }: { label: string; valor: string; destaque?: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: destaque || t.text, fontWeight: destaque ? 600 : 400 }}>{valor}</div>
    </div>
  );
}

// ─── Sub: stat tile ───────────────────────────────────────────────────────────
function StatTile({ titulo, valor, sub, icon, cor }: { titulo: string; valor: string; sub: string; icon: React.ReactNode; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div
      className="forja-lift"
      style={{
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px',
        background: t.surface, boxShadow: t.shadowSoft,
        display: 'flex', flexDirection: 'column', gap: 11,
      }}
    >
      {/* fio de luz no topo na cor do tile — dá vida ao contorno */}
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${cor}00, ${cor}cc, ${cor}00)`, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{titulo}</span>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${cor}1f`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontFamily: FONTS.display, fontSize: 23, fontWeight: 600, color: t.text, lineHeight: 1.1, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Sub: linha limpa de conta (abre detalhe no modal) ────────────────────────
function ContaRow({ c, primeira, onAbrir }: { c: Conta; primeira: boolean; onAbrir: () => void }): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);
  const cat = CATEGORIAS[c.categoria] || CATEGORIAS.outro;
  const accent = t.accents[cat.accent];
  const st = STATUS[c.status] || STATUS.ativa;
  const gratis = ehGratis(c);
  const logins = c.logins && c.logins.length ? c.logins : (c.email ? [{ email: c.email, rotulo: c.rotulo }] : []);
  const multi = logins.length > 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderTop: primeira ? 'none' : `1px solid ${t.borderSoft}`,
        background: hover ? t.surfaceMuted : 'transparent',
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', cursor: 'pointer',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}1f`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {cat.icon}
      </div>
      <span style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {c.servico}
      </span>
      {c.temSegredo === 'sim' && (
        <Tooltip title={c.segredoLabel ? `Senha no Cofre: ${c.segredoLabel}` : 'Senha guardada no Cofre'}>
          <ShieldCheck size={13} color={t.accents.sage} style={{ flexShrink: 0 }} />
        </Tooltip>
      )}
      {(c.recEmail || c.recTelefone || c.recNotas) && (
        <Tooltip title="Dados de recuperação preenchidos">
          <Star size={13} color={t.accents.peach} fill={t.accents.peach} style={{ flexShrink: 0 }} />
        </Tooltip>
      )}
      {multi && (
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '17px', flexShrink: 0 }}>
          {logins.length} contas
        </span>
      )}
      <span style={{ flex: 1 }} />
      {!gratis && c.custo > 0 && (
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoeda(c.custo, c.moeda)}<span style={{ color: t.textTertiary }}>{cadenciaLabel(c.tipoCobranca)}</span>
        </span>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: `${st.cor}1a`, color: st.cor, borderRadius: 999, padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />
        {st.label}
      </span>
      <ChevronRight size={16} color={t.textTertiary} style={{ flexShrink: 0, opacity: hover ? 1 : 0.45, transform: hover ? 'translateX(2px)' : 'none', transition: 'opacity 0.15s, transform 0.15s' }} />
    </div>
  );
}
