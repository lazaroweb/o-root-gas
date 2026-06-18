import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Select, Tag, Empty, Skeleton, Tooltip, Modal, Form,
  Popconfirm, InputNumber, DatePicker, Switch, Segmented,
} from 'antd';
import {
  Plus, Search, Trash2, Pencil, ExternalLink, Sparkles, Code2, Server, AtSign,
  Clapperboard, Boxes, ShieldCheck, CreditCard, CalendarClock, Wand2, Tag as TagIcon, ChevronDown, ChevronsDownUp,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

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
  criadoEm: string;
  atualizadoEm: string;
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

export default function ContasPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('ativa');
  const [seeding, setSeeding] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const toggleAberto = (id: string) => setAbertos((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();
  const temSegredoWatch = Form.useWatch('temSegredo', form);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('contasList')
      .then((r) => { if (r.ok && r.data) setContas(r.data as Conta[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNova = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'ia', status: 'ativa', tipoCobranca: 'gratuito', moeda: 'BRL', custo: 0, logins: [{ email: '', rotulo: '' }] });
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
        c.tags.toLowerCase().indexOf(q) >= 0
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

  // ─── Render ───────────────────────────────────────────────────────────────
  const todasAbertas = filtradas.length > 0 && filtradas.every((c) => abertos.has(c.id));

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            {filtradas.length} {filtradas.length === 1 ? 'conta' : 'contas'}
          </span>
          <Button
            type="text"
            size="small"
            icon={<ChevronsDownUp size={13} style={{ transform: todasAbertas ? 'none' : 'rotate(180deg)' }} />}
            onClick={() => setAbertos(todasAbertas ? new Set() : new Set(filtradas.map((c) => c.id)))}
            style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12 }}
          >
            {todasAbertas ? 'Recolher tudo' : 'Expandir tudo'}
          </Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map((g) => {
            const cat = CATEGORIAS[g.cat] || CATEGORIAS.outro;
            const accent = t.accents[cat.accent];
            return (
              <div key={g.cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 2px 8px' }}>
                  <span style={{ color: accent, display: 'inline-flex' }}>{cat.icon}</span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text }}>{cat.label}</span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>· {g.contas.length}</span>
                </div>
                <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
                  {g.contas.map((c, i) => (
                    <ContaRow
                      key={c.id}
                      c={c}
                      primeira={i === 0}
                      aberto={abertos.has(c.id)}
                      onToggle={() => toggleAberto(c.id)}
                      onEditar={() => abrirEditar(c)}
                      onRemover={() => remover(c.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
                        <Input prefix={<AtSign size={13} color={t.textTertiary} />} placeholder="voce@example.com" />
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
            <Form.Item name="formaPagamento" label="Forma de pagamento" extra="ex.: cartão final 1234, PIX, boleto">
              <Input placeholder="cartão final ****" />
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
          <Form.Item name="tags" label="Tags" extra="separe por vírgula">
            <Input placeholder="favorito, testar, trabalho" />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Pra que serve, limites do plano, observações…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub: stat tile ───────────────────────────────────────────────────────────
function StatTile({ titulo, valor, sub, icon, cor }: { titulo: string; valor: string; sub: string; icon: React.ReactNode; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '12px 14px', background: t.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── Sub: linha colapsável de conta ───────────────────────────────────────────
function ContaRow({ c, primeira, aberto, onToggle, onEditar, onRemover }: { c: Conta; primeira: boolean; aberto: boolean; onToggle: () => void; onEditar: () => void; onRemover: () => void }): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);
  const cat = CATEGORIAS[c.categoria] || CATEGORIAS.outro;
  const accent = t.accents[cat.accent];
  const st = STATUS[c.status] || STATUS.ativa;
  const dias = diasAte(c.proximaCobranca);
  const gratis = ehGratis(c);
  const logins = c.logins && c.logins.length ? c.logins : (c.email ? [{ email: c.email, rotulo: c.rotulo }] : []);
  const multi = logins.length > 1;

  return (
    <div style={{ borderTop: primeira ? 'none' : `1px solid ${t.borderSoft}`, background: aberto || hover ? t.surfaceMuted : 'transparent', transition: 'background 0.15s' }}>
      {/* Cabeçalho clicável (colapsado): só o essencial */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', cursor: 'pointer' }}
      >
        <ChevronDown
          size={15}
          color={t.textTertiary}
          style={{ flexShrink: 0, transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.18s' }}
        />
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accent}1f`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {cat.icon}
        </div>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {c.servico}
        </span>
        {c.temSegredo === 'sim' && (
          <Tooltip title={c.segredoLabel ? `Senha no Cofre: ${c.segredoLabel}` : 'Senha guardada no Cofre'}>
            <ShieldCheck size={13} color={t.accents.sage} style={{ flexShrink: 0 }} />
          </Tooltip>
        )}
        {multi && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 7px', flexShrink: 0 }}>
            {logins.length} contas
          </span>
        )}
        <span style={{ flex: 1 }} />
        {/* Status (a "chamada principal" pra saber se está ativa) */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.cor }} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>{st.label}</span>
        </span>
      </div>

      {/* Corpo expandido */}
      {aberto && (
        <div style={{ padding: '2px 16px 14px 53px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Logins */}
          {logins.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {logins.map((l, i) => (
                <Tooltip key={i} title={l.email || l.rotulo}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary,
                    background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 7, padding: '2px 9px',
                    maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <AtSign size={11} color={t.textTertiary} />
                    {l.rotulo ? <strong style={{ fontWeight: 600, color: t.text }}>{l.rotulo}</strong> : null}
                    {l.rotulo && l.email ? <span style={{ color: t.textTertiary }}>·</span> : null}
                    {l.email}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Plano + custo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {c.plano && <Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>{c.plano}</Tag>}
            <Tag color={gratis ? 'green' : 'gold'} style={{ marginInlineEnd: 0, fontSize: 11 }}>{gratis ? 'Grátis' : 'Pago'}</Tag>
            {!gratis && c.custo > 0 && (
              <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, fontWeight: 600 }}>
                {fmtMoeda(c.custo, c.moeda)}<span style={{ fontWeight: 400, color: t.textTertiary }}>{cadenciaLabel(c.tipoCobranca)}</span>
              </span>
            )}
          </div>

          {/* Renovação + pagamento */}
          {(dias !== null || c.formaPagamento) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, flexWrap: 'wrap' }}>
              {dias !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: dias <= 7 && dias >= 0 ? t.accents.peach : t.textTertiary }}>
                  <CalendarClock size={12} />
                  {dias < 0 ? 'venceu' : dias === 0 ? 'renova hoje' : `renova em ${dias}d`}
                </span>
              )}
              {c.formaPagamento && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CreditCard size={12} /> {c.formaPagamento}
                </span>
              )}
            </div>
          )}

          {/* Notas */}
          {c.notas && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>{c.notas}</div>
          )}

          {/* Tags */}
          {c.tags && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {c.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                <span key={tag} style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '1px 6px' }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {c.url && (
              <Button size="small" icon={<ExternalLink size={13} />} href={c.url} target="_blank" rel="noopener noreferrer">Abrir</Button>
            )}
            <Button size="small" icon={<Pencil size={13} />} onClick={onEditar}>Editar</Button>
            <Popconfirm title="Remover esta conta?" onConfirm={onRemover} okText="Remover" cancelText="Cancelar">
              <Button size="small" danger icon={<Trash2 size={13} />}>Remover</Button>
            </Popconfirm>
          </div>
        </div>
      )}
    </div>
  );
}
