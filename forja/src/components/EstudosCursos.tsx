import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App as AntApp, Button, Input, InputNumber, Select, AutoComplete, Skeleton, Empty, Form, Modal,
  Popconfirm, Tooltip, Segmented, Progress, Slider, DatePicker,
} from 'antd';
import {
  Plus, Trash2, Edit3, X, Save, Play, Pause, Check, RotateCcw, GraduationCap, Clock,
  ExternalLink, Gauge, Sparkles, Layers, AlertTriangle, Settings2, Library,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Curso {
  id: string;
  titulo: string;
  plataforma: string;
  url: string;
  categoria: string;
  cargaHoraria: number;
  custo: number;
  prioridade: string;
  posse: 'tenho' | 'quero' | string;
  status: 'nao-iniciado' | 'em-andamento' | 'pausado' | 'concluido' | string;
  progresso: number;
  dataInicioProgramada: string;
  dataInicioReal: string;
  dataConclusao: string;
  notas: string;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

interface Capacidade { maxSimultaneos: number; horasSemana: number }

const STATUS: Record<string, { label: string; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  'nao-iniciado': { label: 'Não iniciado', accent: 'blue' },
  'em-andamento': { label: 'Em andamento', accent: 'peach' },
  pausado: { label: 'Pausado', accent: 'clay' },
  concluido: { label: 'Concluído', accent: 'sage' },
};

const PRIORIDADE_OPCOES = [
  { value: 'alta', label: 'Alta' }, { value: 'media', label: 'Média' }, { value: 'baixa', label: 'Baixa' },
];
const CATEGORIAS_PADRAO = ['IA', 'Frontend', 'Backend', 'DevOps', 'Design', 'Dados', 'Produto', 'Negócios', 'Idiomas'];
const PLATAFORMAS_PADRAO = ['Udemy', 'Alura', 'Coursera', 'YouTube', 'Rocketseat', 'Hotmart', 'edX', 'Domestika'];

const ACCENT_TAB: keyof ReturnType<typeof useTokens>['accents'] = 'clay';

function horasRestantes(c: Curso): number {
  return Math.max(0, c.cargaHoraria * (1 - c.progresso / 100));
}
function fmtHoras(h: number): string {
  const r = Math.round(h * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + 'h';
}
function addSemanas(base: Date, semanas: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + semanas * 7);
  return d;
}
function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function dominioDe(url: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function faviconDe(url: string): string {
  const d = dominioDe(url);
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=128` : '';
}
// Hue estável derivado do domínio (mesmo site → mesma cor sempre).
function hueDe(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

interface EstudosCursosProps { onVirarTrilhas?: () => void }

export default function EstudosCursos(_props: EstudosCursosProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cap, setCap] = useState<Capacidade>({ maxSimultaneos: 2, horasSemana: 5 });
  const [loading, setLoading] = useState(true);
  const [posse, setPosse] = useState<'tenho' | 'quero'>('tenho');
  const [filtroCat, setFiltroCat] = useState<string>('todas');

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const [capOpen, setCapOpen] = useState(false);
  const [capForm] = Form.useForm();
  const [salvandoCap, setSalvandoCap] = useState(false);

  const [iniciarAlvo, setIniciarAlvo] = useState<Curso | null>(null);
  // Só escolhe a aba inicial uma vez, pra não brigar com o toggle manual do usuário.
  const escolheuAba = useRef(false);

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResult>('estudoCursosList'),
      callServer<ServerResult>('estudoCursosCapacidade'),
    ])
      .then(([rc, rcap]) => {
        if (rc.ok && rc.data) {
          const listaC = rc.data as Curso[];
          setCursos(listaC);
          // Se não há nada em "Tenho" mas há em "Quero fazer", abre já no Quero
          // pra não mostrar um vazio bobo com itens escondidos na outra aba.
          if (!escolheuAba.current) {
            escolheuAba.current = true;
            const temTenho = listaC.some((c) => (c.posse === 'quero' ? 'quero' : 'tenho') === 'tenho');
            const temQuero = listaC.some((c) => c.posse === 'quero');
            if (!temTenho && temQuero) setPosse('quero');
          }
        }
        if (rcap.ok && rcap.data) setCap(rcap.data as Capacidade);
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ativos = useMemo(() => cursos.filter((c) => c.status === 'em-andamento'), [cursos]);
  const carga = useMemo(() => {
    const horas = ativos.reduce((s, c) => s + horasRestantes(c), 0);
    const semanas = cap.horasSemana > 0 ? Math.ceil(horas / cap.horasSemana) : 0;
    const previsao = semanas > 0 ? addSemanas(new Date(), semanas) : null;
    const ocupacao = cap.maxSimultaneos > 0 ? Math.round((ativos.length / cap.maxSimultaneos) * 100) : 0;
    return { horas, semanas, previsao, ocupacao };
  }, [ativos, cap]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    cursos.forEach((c) => { if (c.categoria) set.add(c.categoria); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cursos]);
  const catSugeridas = useMemo(() => {
    const set = new Set<string>([...CATEGORIAS_PADRAO, ...categorias]);
    return Array.from(set).map((v) => ({ value: v }));
  }, [categorias]);
  const plataformasSugeridas = useMemo(() => {
    const usadas = cursos.map((c) => c.plataforma).filter(Boolean);
    const set = new Set<string>([...PLATAFORMAS_PADRAO, ...usadas]);
    return Array.from(set).map((v) => ({ value: v }));
  }, [cursos]);

  const listaPosse = useMemo(() => cursos.filter((c) => (c.posse === 'quero' ? 'quero' : 'tenho') === posse), [cursos, posse]);
  const lista = useMemo(() => {
    const base = filtroCat === 'todas' ? listaPosse : listaPosse.filter((c) => c.categoria === filtroCat);
    const ordemStatus: Record<string, number> = { 'em-andamento': 0, pausado: 1, 'nao-iniciado': 2, concluido: 3 };
    const ordemPrio: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    return base.slice().sort((a, b) =>
      (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9)
      || (ordemPrio[a.prioridade] ?? 9) - (ordemPrio[b.prioridade] ?? 9)
      || a.titulo.localeCompare(b.titulo));
  }, [listaPosse, filtroCat]);

  const nTenho = cursos.filter((c) => (c.posse === 'quero' ? 'quero' : 'tenho') === 'tenho').length;
  const nQuero = cursos.length - nTenho;

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ posse, prioridade: 'media', cargaHoraria: 10, progresso: 0 });
    setFormOpen(true);
  };
  const abrirEditar = (c: Curso) => {
    setEditando(c);
    form.setFieldsValue({
      titulo: c.titulo, plataforma: c.plataforma, url: c.url, categoria: c.categoria,
      cargaHoraria: c.cargaHoraria, custo: c.custo, prioridade: c.prioridade, posse: c.posse,
      progresso: c.progresso, notas: c.notas,
      dataInicioProgramada: c.dataInicioProgramada ? dayjs(c.dataInicioProgramada) : undefined,
    });
    setFormOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const payload = {
        id: editando?.id,
        titulo: v.titulo,
        plataforma: v.plataforma || '',
        url: v.url || '',
        categoria: (v.categoria || '').trim(),
        cargaHoraria: Number(v.cargaHoraria || 0),
        custo: Number(v.custo || 0),
        prioridade: v.prioridade || 'media',
        posse: v.posse || 'tenho',
        progresso: Number(v.progresso || 0),
        notas: v.notas || '',
        dataInicioProgramada: v.dataInicioProgramada ? dayjs(v.dataInicioProgramada).format('YYYY-MM-DD') : '',
        status: editando?.status || 'nao-iniciado',
      };
      const r = await callServer<ServerResult>('estudoCursoSave', payload);
      if (r.ok) { message.success(editando ? 'Curso atualizado' : 'Curso adicionado'); setFormOpen(false); carregar(); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('estudoCursoDelete', id);
    if (r.ok) { message.success('Curso removido'); carregar(); } else message.error(r.error || 'Erro');
  };

  const mudarStatus = async (id: string, status: string, silencioso?: boolean) => {
    const r = await callServer<ServerResult>('estudoCursoStatus', id, status);
    if (r.ok) { if (!silencioso) message.success('Atualizado'); carregar(); } else message.error(r.error || 'Erro');
  };

  const mudarProgresso = async (c: Curso, progresso: number) => {
    setCursos((arr) => arr.map((x) => (x.id === c.id ? { ...x, progresso } : x)));
    await callServer<ServerResult>('estudoCursoSave', { id: c.id, titulo: c.titulo, progresso });
  };

  const virarTenho = async (id: string) => {
    const r = await callServer<ServerResult>('estudoCursoPosse', id, 'tenho');
    if (r.ok) { message.success('Movido pra "Tenho"'); carregar(); } else message.error(r.error || 'Erro');
  };

  // Ao iniciar: se o WIP for estourado, mostra o modal de carga (não bloqueia).
  const tentarIniciar = (c: Curso) => {
    if (ativos.length + 1 > cap.maxSimultaneos) {
      setIniciarAlvo(c);
    } else {
      mudarStatus(c.id, 'em-andamento', true).then(() => message.success('Curso iniciado · bom estudo!'));
    }
  };
  const confirmarIniciar = () => {
    if (!iniciarAlvo) return;
    const alvo = iniciarAlvo;
    setIniciarAlvo(null);
    mudarStatus(alvo.id, 'em-andamento', true).then(() => message.success('Curso iniciado mesmo assim · foco!'));
  };

  const salvarCap = async () => {
    try {
      const v = await capForm.validateFields();
      setSalvandoCap(true);
      const r = await callServer<ServerResult>('estudoCursosCapacidadeSet', {
        maxSimultaneos: Number(v.maxSimultaneos), horasSemana: Number(v.horasSemana),
      });
      if (r.ok && r.data) { setCap(r.data as Capacidade); setCapOpen(false); message.success('Capacidade ajustada'); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvandoCap(false); }
  };

  const accent = t.accents[ACCENT_TAB];
  const excedido = ativos.length > cap.maxSimultaneos;
  const noLimite = ativos.length === cap.maxSimultaneos && cap.maxSimultaneos > 0;

  const segLabel = (txt: string, n: number) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {txt}
      <span style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10, padding: '1px 6px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </span>
  );

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      {/* Painel de carga */}
      <CargaPanel
        t={t}
        ativos={ativos.length}
        cap={cap}
        carga={carga}
        excedido={excedido}
        noLimite={noLimite}
        onAjustar={() => { capForm.setFieldsValue(cap); setCapOpen(true); }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px', flexWrap: 'wrap' }}>
        <Segmented
          value={posse}
          onChange={(v) => setPosse(v as 'tenho' | 'quero')}
          options={[
            { value: 'tenho', label: segLabel('Tenho', nTenho) },
            { value: 'quero', label: segLabel('Quero fazer', nQuero) },
          ]}
        />
        {categorias.length > 0 && (
          <Select
            size="small"
            value={filtroCat}
            onChange={setFiltroCat}
            style={{ minWidth: 150 }}
            options={[{ value: 'todas', label: 'Todas as categorias' }, ...categorias.map((c) => ({ value: c, label: c }))]}
          />
        )}
        <span style={{ flex: 1 }} />
        {cursos.length > 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Novo curso</Button>}
      </div>

      {loading && cursos.length === 0 ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : lista.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={posse === 'tenho'
            ? 'Nenhum curso na sua biblioteca ainda. Cadastre o que você já tem acesso e comece pela ordem que fizer sentido.'
            : 'Nada na wishlist. Guarde aqui os cursos que você quer fazer — sem pressão de começar agora.'}
        >
          {cursos.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Novo curso</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {lista.map((c) => (
            <CursoCard
              key={c.id}
              c={c}
              t={t}
              accent={accent}
              onEditar={() => abrirEditar(c)}
              onDeletar={() => deletar(c.id)}
              onIniciar={() => tentarIniciar(c)}
              onStatus={(st) => mudarStatus(c.id, st)}
              onProgresso={(p) => mudarProgresso(c, p)}
              onVirarTenho={() => virarTenho(c.id)}
            />
          ))}
        </div>
      )}

      {/* Form novo/editar */}
      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? 'Editar curso' : 'Novo curso'}
        width={560}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>{editando ? 'Salvar' : 'Adicionar'}</Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="Nome do curso" rules={[{ required: true, message: 'Dê um nome' }]}>
            <Input placeholder="ex.: Domine Agentes de IA com LangGraph" autoFocus />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="plataforma" label="Plataforma (digite ou escolha)">
              <AutoComplete options={plataformasSugeridas} placeholder="Udemy, Alura, um site…" filterOption={(i, o) => (o?.value as string).toLowerCase().includes(i.toLowerCase())} allowClear />
            </Form.Item>
            <Form.Item name="categoria" label="Categoria (digite ou escolha)">
              <AutoComplete options={catSugeridas} placeholder="IA, Frontend…" filterOption={(i, o) => (o?.value as string).toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </div>
          <Form.Item name="url" label="Link (opcional)">
            <Input placeholder="https://…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="cargaHoraria" label="Carga (horas)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="10" />
            </Form.Item>
            <Form.Item name="custo" label="Custo (R$)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
            <Form.Item name="prioridade" label="Prioridade">
              <Select options={PRIORIDADE_OPCOES} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="posse" label="Lista">
              <Select options={[{ value: 'tenho', label: 'Tenho (já tenho acesso)' }, { value: 'quero', label: 'Quero fazer (wishlist)' }]} />
            </Form.Item>
            <Form.Item name="dataInicioProgramada" label="Início programado (opcional)">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="quando pretende começar" />
            </Form.Item>
          </div>
          {editando && editando.status === 'em-andamento' && (
            <Form.Item name="progresso" label="Progresso (%)">
              <Slider min={0} max={100} />
            </Form.Item>
          )}
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} placeholder="o que quer tirar desse curso, pré-requisitos…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Ajustar capacidade */}
      <Modal
        open={capOpen}
        onCancel={() => setCapOpen(false)}
        title="Sua capacidade de estudo"
        width={460}
        footer={[
          <Button key="c" onClick={() => setCapOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvandoCap} onClick={salvarCap}>Salvar</Button>,
        ]}
      >
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
          É com isso que a Forja calcula sua fila e te avisa quando você está pegando curso demais. Não trava nada — só te mostra a real.
        </div>
        <Form form={capForm} layout="vertical" requiredMark={false} initialValues={cap}>
          <Form.Item name="maxSimultaneos" label="Cursos ao mesmo tempo que você topa" rules={[{ required: true }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="cursos" />
          </Form.Item>
          <Form.Item name="horasSemana" label="Horas de estudo por semana" rules={[{ required: true }]}>
            <InputNumber min={1} max={80} style={{ width: '100%' }} addonAfter="h/semana" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Alerta de carga ao iniciar */}
      <IniciarModal
        alvo={iniciarAlvo}
        t={t}
        cap={cap}
        ativos={ativos}
        carga={carga}
        onCancel={() => setIniciarAlvo(null)}
        onConfirm={confirmarIniciar}
      />
    </div>
  );
}

function CargaPanel({ t, ativos, cap, carga, excedido, noLimite, onAjustar }: {
  t: ReturnType<typeof useTokens>;
  ativos: number; cap: Capacidade;
  carga: { horas: number; semanas: number; previsao: Date | null; ocupacao: number };
  excedido: boolean; noLimite: boolean; onAjustar: () => void;
}): React.ReactElement {
  const cor = excedido ? t.accents.rose : noLimite ? t.accents.clay : t.accents.sage;
  const stat = (icon: React.ReactNode, label: string, valor: React.ReactNode, sub?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{icon}{label}</span>
      <span style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
      {sub && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>{sub}</span>}
    </div>
  );
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${cor}`, borderRadius: 14, padding: '16px 18px', boxShadow: t.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: `${cor}22`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Gauge size={15} /></span>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>Sua carga de estudo</span>
        <span style={{ flex: 1 }} />
        <Button type="text" size="small" icon={<Settings2 size={14} />} onClick={onAjustar}>Ajustar</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, alignItems: 'end' }}>
        {stat(<Layers size={12} />, 'Ativos agora', <span style={{ color: excedido ? t.accents.rose : t.text }}>{ativos}<span style={{ fontSize: 13, color: t.textTertiary }}> / {cap.maxSimultaneos}</span></span>, excedido ? 'acima do seu limite' : noLimite ? 'no limite' : 'dentro do limite')}
        {stat(<Clock size={12} />, 'Horas na fila', fmtHoras(carga.horas), `${cap.horasSemana}h por semana`)}
        {stat(<Sparkles size={12} />, 'Previsão de término', carga.previsao ? `~${carga.semanas} sem` : '—', carga.previsao ? `≈ ${fmtData(carga.previsao)}` : 'nada em andamento')}
      </div>
      {(excedido || noLimite) && (
        <div style={{ marginTop: 12, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, background: `${cor}1f`, border: `1px solid ${cor}55`, borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color={cor} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{excedido
            ? `Você tem ${ativos} cursos ativos, acima do seu limite de ${cap.maxSimultaneos}. Considere concluir ou pausar um antes de começar outro.`
            : `Você está no seu limite de ${cap.maxSimultaneos} cursos ativos. Iniciar mais um vai dividir sua atenção.`}</span>
        </div>
      )}
    </div>
  );
}

function CursoCard({ c, t, accent, onEditar, onDeletar, onIniciar, onStatus, onProgresso, onVirarTenho }: {
  c: Curso; t: ReturnType<typeof useTokens>; accent: string;
  onEditar: () => void; onDeletar: () => void; onIniciar: () => void;
  onStatus: (st: string) => void; onProgresso: (p: number) => void; onVirarTenho: () => void;
}): React.ReactElement {
  const st = STATUS[c.status] || STATUS['nao-iniciado'];
  const stCor = t.accents[st.accent];
  const isQuero = (c.posse === 'quero');
  const prioCor = c.prioridade === 'alta' ? t.accents.rose : c.prioridade === 'baixa' ? t.textTertiary : t.accents.clay;
  const dom = dominioDe(c.url);
  const hue = hueDe(dom || c.titulo);
  const temBanner = !!c.url;

  return (
    <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: t.shadowSoft }}>
      {temBanner && (
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          title={`Abrir ${dom}`}
          style={{ display: 'block', height: 56, position: 'relative', textDecoration: 'none', background: `linear-gradient(135deg, hsl(${hue} 58% 50%), hsl(${(hue + 42) % 360} 58% 40%))` }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.94)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <img
                src={faviconDe(c.url)}
                alt=""
                width={18}
                height={18}
                style={{ display: 'block' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </span>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dom}</span>
            <span style={{ flex: 1 }} />
            <ExternalLink size={14} color="rgba(255,255,255,0.92)" />
          </div>
        </a>
      )}

      <div style={{ borderLeft: temBanner ? 'none' : `3px solid ${accent}`, padding: temBanner ? '13px 15px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {!temBanner && <span style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GraduationCap size={16} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 14.5, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>{c.titulo}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {c.plataforma && <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{c.plataforma}</span>}
            {c.categoria && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textSecondary, background: t.surfaceMuted, padding: '1px 8px', borderRadius: 999 }}>{c.categoria}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!isQuero && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: stCor }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stCor }} />{st.label}
          </span>
        )}
        {c.cargaHoraria > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
            <Clock size={11} />{fmtHoras(c.cargaHoraria)}
          </span>
        )}
        {c.prioridade !== 'media' && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: prioCor }}>{c.prioridade === 'alta' ? 'Prioridade alta' : 'Baixa'}</span>
        )}
      </div>

      {c.status === 'em-andamento' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginBottom: 2 }}>
            <span>progresso · faltam {fmtHoras(horasRestantes(c))}</span><span>{c.progresso}%</span>
          </div>
          <Slider min={0} max={100} value={c.progresso} onChangeComplete={onProgresso} tooltip={{ formatter: (v) => `${v}%` }} styles={{ track: { background: t.accents.peach } }} />
        </div>
      )}

      {c.status === 'concluido' && c.dataConclusao && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.accents.sage }}>Concluído em {new Date(c.dataConclusao).toLocaleDateString('pt-BR')}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
        {isQuero ? (
          <Button type="primary" size="small" icon={<Library size={14} />} onClick={onVirarTenho}>Já tenho</Button>
        ) : c.status === 'nao-iniciado' ? (
          <Button type="primary" size="small" icon={<Play size={14} />} onClick={onIniciar}>Iniciar</Button>
        ) : c.status === 'em-andamento' ? (
          <>
            <Button size="small" icon={<Check size={14} />} onClick={() => onStatus('concluido')}>Concluir</Button>
            <Tooltip title="Pausar"><Button type="text" size="small" icon={<Pause size={14} />} onClick={() => onStatus('pausado')} /></Tooltip>
          </>
        ) : c.status === 'pausado' ? (
          <>
            <Button type="primary" size="small" icon={<Play size={14} />} onClick={() => onStatus('em-andamento')}>Retomar</Button>
            <Button size="small" icon={<Check size={14} />} onClick={() => onStatus('concluido')}>Concluir</Button>
          </>
        ) : (
          <Button size="small" icon={<RotateCcw size={14} />} onClick={() => onStatus('em-andamento')}>Reabrir</Button>
        )}
        <span style={{ flex: 1 }} />
        <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
        <Popconfirm title="Remover este curso?" onConfirm={onDeletar} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
        </Popconfirm>
      </div>
      </div>
    </div>
  );
}

function IniciarModal({ alvo, t, cap, ativos, carga, onCancel, onConfirm }: {
  alvo: Curso | null; t: ReturnType<typeof useTokens>; cap: Capacidade; ativos: Curso[];
  carga: { horas: number; semanas: number; previsao: Date | null }; onCancel: () => void; onConfirm: () => void;
}): React.ReactElement {
  const cor = t.accents.clay;
  const horasNovas = alvo ? horasRestantes(alvo) : 0;
  const horasDepois = carga.horas + horasNovas;
  const semanasDepois = cap.horasSemana > 0 ? Math.ceil(horasDepois / cap.horasSemana) : 0;
  const previsaoDepois = semanasDepois > 0 ? addSemanas(new Date(), semanasDepois) : null;
  const maisProximo = ativos.slice().sort((a, b) => horasRestantes(a) - horasRestantes(b))[0];

  const linha = (label: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${t.borderSoft}` }}>
      <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>{label}</span>
      <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );

  return (
    <Modal
      open={!!alvo}
      onCancel={onCancel}
      width={480}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={17} color={cor} /> Você está no seu limite</span>}
      footer={[
        <Button key="c" onClick={onCancel}>Deixar pra depois</Button>,
        <Button key="s" type="primary" icon={<Play size={14} />} onClick={onConfirm}>Iniciar mesmo assim</Button>,
      ]}
    >
      {alvo && (
        <>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
            Você já tem <b style={{ color: t.text }}>{ativos.length}</b> curso{ativos.length === 1 ? '' : 's'} em andamento (seu limite é {cap.maxSimultaneos}).
            Começar <b style={{ color: t.text }}>{alvo.titulo}</b> agora divide sua atenção. Não vou te impedir — só te mostro o impacto:
          </div>
          <div style={{ background: t.surfaceMuted, borderRadius: 10, padding: '4px 14px', marginBottom: 14 }}>
            {linha('Horas na fila hoje', fmtHoras(carga.horas))}
            {linha('Este curso adiciona', `+${fmtHoras(horasNovas)}`)}
            {linha('Nova fila', <span style={{ color: cor }}>{fmtHoras(horasDepois)}</span>)}
            {linha('Previsão de término', previsaoDepois ? `~${semanasDepois} semanas (≈ ${fmtData(previsaoDepois)})` : '—')}
          </div>
          {maisProximo && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: `${t.accents.sage}1f`, border: `1px solid ${t.accents.sage}55`, borderRadius: 10, padding: '10px 12px' }}>
              <Sparkles size={15} color={t.accents.sage} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
                Sugestão: terminar <b style={{ color: t.text }}>{maisProximo.titulo}</b> primeiro (faltam só {fmtHoras(horasRestantes(maisProximo))}) libera espaço e mantém o ritmo.
              </span>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
