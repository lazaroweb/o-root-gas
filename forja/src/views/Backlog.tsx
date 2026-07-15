import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, InputNumber, Select, Skeleton, Empty, Form, Modal, Drawer,
  Popconfirm, Tooltip, Segmented, Slider, DatePicker, Progress, Dropdown, Spin,
} from 'antd';
import {
  Plus, Trash2, Edit3, X, Save, Play, Check, Ban, Hammer, Flame, Target,
  ExternalLink, Layers, Boxes, CircleDot, Sparkles, BrainCircuit, Copy,
  AlertTriangle, Rocket, ListPlus, GitBranch,
} from 'lucide-react';
import dayjs from 'dayjs';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Empreitada {
  id: string; nome: string; objetivo: string; sistemaId: string; sistemaNome: string; repoUrl: string;
  tipo: string; status: string; prioridade: string; accent: string; inicioAlvo: string; entregaAlvo: string;
  ordem: number; totalAtividades: number; atividadesFeitas: number; criadoEm: string; atualizadoEm: string; concluidaEm: string;
}
interface Atividade {
  id: string; empreitadaId: string; sistemaId: string; titulo: string; descricao: string; tipo: string;
  notaImpacto: number; notaEsforco: number; prioridade: string; status: string; mesAlvo: string;
  estimativaHoras: number; dependeDe: string; promptSugerido: string; origem: string; ordem: number;
  criadoEm: string; atualizadoEm: string; concluidaEm: string;
}
interface SistemaLite { id: string; nome: string; repoUrl?: string }

interface ArquitetoFase { ordem: number; nome: string; objetivo: string; risco: string }
interface ArquitetoAtividade {
  titulo: string; descricao: string; tipo: string; impacto: number; esforco: number;
  fase: string; mesRelativo: number; prompt: string;
}
interface ArquitetoPlano {
  diagnostico: string; stackDetectada: string[]; riscosMigracao: string[];
  estrategiaSemQuebrar: string; fases: ArquitetoFase[]; atividades: ArquitetoAtividade[];
}
interface ArquitetoResposta {
  plano: ArquitetoPlano; resumo: string; modelo: string;
  fonte: { repoUrl: string; arquivos: number; bytes: number; commitSha: string; truncado: boolean; erroLeitura: string; manifestArquivos?: number };
}

type Vista = 'foco' | 'todas' | 'empreitadas' | 'roadmap';

const ACCENTS: Array<keyof ReturnType<typeof useTokens>['accents']> = ['blue', 'peach', 'sage', 'lavender', 'clay', 'rose'];

const TIPO_ATIV: Array<{ value: string; label: string }> = [
  { value: 'feature', label: 'Feature' }, { value: 'bug', label: 'Bug' },
  { value: 'refatoracao', label: 'Refatoração' }, { value: 'migracao', label: 'Migração' },
  { value: 'infra', label: 'Infra' }, { value: 'doc', label: 'Documentação' },
  { value: 'teste', label: 'Teste' }, { value: 'outro', label: 'Outro' },
];
const STATUS_ATIV: Record<string, { label: string; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  backlog: { label: 'Backlog', accent: 'blue' },
  fazendo: { label: 'Fazendo', accent: 'peach' },
  bloqueada: { label: 'Bloqueada', accent: 'rose' },
  feito: { label: 'Feito', accent: 'sage' },
};
const PRIORIDADE = [{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Média' }, { value: 'baixa', label: 'Baixa' }];
const TIPO_EMPR: Array<{ value: string; label: string }> = [
  { value: 'migracao', label: 'Migração' }, { value: 'refatoracao', label: 'Refatoração' },
  { value: 'hardening', label: 'Robustez (hardening)' }, { value: 'feature', label: 'Feature grande' },
  { value: 'infra', label: 'Infra' }, { value: 'outro', label: 'Outro' },
];
const STATUS_EMPR: Record<string, { label: string; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  planejando: { label: 'Planejando', accent: 'blue' },
  'em-andamento': { label: 'Em andamento', accent: 'peach' },
  pausada: { label: 'Pausada', accent: 'clay' },
  concluida: { label: 'Concluída', accent: 'sage' },
};

const prioW: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
// Score de Foco: prioridade pesa forte, alto impacto sobe, alto esforço desce.
function scoreFoco(a: Atividade): number {
  return (prioW[a.prioridade] ?? 2) * 4 + a.notaImpacto * 2 - a.notaEsforco;
}
function mesLabel(ym: string): string {
  if (!ym) return '';
  const d = dayjs(ym + '-01');
  return d.isValid() ? d.format('MMM/YY') : ym;
}

interface BacklogProps { onAbrirSistema?: (id: string) => void }

export default function Backlog({ onAbrirSistema }: BacklogProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [empreitadas, setEmpreitadas] = useState<Empreitada[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [sistemas, setSistemas] = useState<SistemaLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>('foco');

  const [captura, setCaptura] = useState('');
  const [capturando, setCapturando] = useState(false);

  // Modais
  const [ativForm, setAtivForm] = useState(false);
  const [ativEdit, setAtivEdit] = useState<Atividade | null>(null);
  const [ativSalvando, setAtivSalvando] = useState(false);
  const [formA] = Form.useForm();

  const [emprForm, setEmprForm] = useState(false);
  const [emprEdit, setEmprEdit] = useState<Empreitada | null>(null);
  const [emprSalvando, setEmprSalvando] = useState(false);
  const [emprAccent, setEmprAccent] = useState<string>('blue');
  const [formE] = Form.useForm();

  const [drawerId, setDrawerId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResult>('empreitadasList'),
      callServer<ServerResult>('atividadesList'),
    ])
      .then(([re, ra]) => {
        if (re.ok && re.data) setEmpreitadas(re.data as Empreitada[]);
        if (ra.ok && ra.data) setAtividades(ra.data as Atividade[]);
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
    callServer<ServerResult>('getSistemas')
      .then((r) => { if (r.ok && r.data) setSistemas((r.data as SistemaLite[]).map((s) => ({ id: s.id, nome: s.nome, repoUrl: s.repoUrl }))); })
      .catch(() => { /* noop */ });
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const emprPorId = useMemo(() => {
    const m: Record<string, Empreitada> = {};
    empreitadas.forEach((e) => { m[e.id] = e; });
    return m;
  }, [empreitadas]);

  const abertas = useMemo(() => atividades.filter((a) => a.status !== 'feito'), [atividades]);
  const fazendo = useMemo(() => abertas.filter((a) => a.status === 'fazendo').sort((a, b) => scoreFoco(b) - scoreFoco(a)), [abertas]);
  const paraComecar = useMemo(
    () => abertas.filter((a) => a.status === 'backlog').sort((a, b) => scoreFoco(b) - scoreFoco(a)),
    [abertas],
  );
  const bloqueadas = useMemo(() => abertas.filter((a) => a.status === 'bloqueada'), [abertas]);

  const capturaRapida = async () => {
    const titulo = captura.trim();
    if (!titulo) return;
    setCapturando(true);
    const r = await callServer<ServerResult>('atividadeSave', { titulo, status: 'backlog' });
    setCapturando(false);
    if (r.ok) { setCaptura(''); carregar(); } else message.error(r.error || 'Erro');
  };

  const abrirNovaAtiv = (empreitadaId?: string) => {
    setAtivEdit(null);
    formA.resetFields();
    formA.setFieldsValue({ empreitadaId: empreitadaId || undefined, tipo: 'feature', prioridade: 'media', status: 'backlog', notaImpacto: 3, notaEsforco: 3, estimativaHoras: 0 });
    setAtivForm(true);
  };
  const abrirEditarAtiv = (a: Atividade) => {
    setAtivEdit(a);
    formA.setFieldsValue({
      empreitadaId: a.empreitadaId || undefined, titulo: a.titulo, descricao: a.descricao, tipo: a.tipo,
      prioridade: a.prioridade, status: a.status, notaImpacto: a.notaImpacto, notaEsforco: a.notaEsforco,
      estimativaHoras: a.estimativaHoras, dependeDe: a.dependeDe || undefined,
      mesAlvo: a.mesAlvo ? dayjs(a.mesAlvo + '-01') : undefined,
    });
    setAtivForm(true);
  };
  const salvarAtiv = async () => {
    try {
      const v = await formA.validateFields();
      setAtivSalvando(true);
      const empreitadaId = v.empreitadaId || '';
      const sistemaId = empreitadaId ? (emprPorId[empreitadaId]?.sistemaId || '') : '';
      const r = await callServer<ServerResult>('atividadeSave', {
        id: ativEdit?.id, empreitadaId, sistemaId, titulo: v.titulo, descricao: v.descricao || '',
        tipo: v.tipo, prioridade: v.prioridade, status: v.status, notaImpacto: v.notaImpacto,
        notaEsforco: v.notaEsforco, estimativaHoras: Number(v.estimativaHoras || 0),
        dependeDe: v.dependeDe || '', mesAlvo: v.mesAlvo ? dayjs(v.mesAlvo).format('YYYY-MM') : '',
      });
      if (r.ok) { message.success(ativEdit ? 'Atividade atualizada' : 'Atividade criada'); setAtivForm(false); carregar(); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setAtivSalvando(false); }
  };
  const statusAtiv = async (id: string, status: string) => {
    setAtividades((arr) => arr.map((x) => (x.id === id ? { ...x, status } : x)));
    const r = await callServer<ServerResult>('atividadeStatus', id, status);
    if (r.ok) carregar(); else { message.error(r.error || 'Erro'); carregar(); }
  };
  const deletarAtiv = async (id: string) => {
    const r = await callServer<ServerResult>('atividadeDelete', id);
    if (r.ok) { message.success('Atividade removida'); carregar(); } else message.error(r.error || 'Erro');
  };

  const abrirNovaEmpr = () => {
    setEmprEdit(null); setEmprAccent('blue');
    formE.resetFields();
    formE.setFieldsValue({ tipo: 'migracao', status: 'planejando', prioridade: 'media' });
    setEmprForm(true);
  };
  const abrirEditarEmpr = (e: Empreitada) => {
    setEmprEdit(e); setEmprAccent(e.accent || 'blue');
    formE.setFieldsValue({
      nome: e.nome, objetivo: e.objetivo, sistemaId: e.sistemaId || undefined, repoUrl: e.repoUrl,
      tipo: e.tipo, status: e.status, prioridade: e.prioridade,
      inicioAlvo: e.inicioAlvo ? dayjs(e.inicioAlvo + '-01') : undefined,
      entregaAlvo: e.entregaAlvo ? dayjs(e.entregaAlvo + '-01') : undefined,
    });
    setEmprForm(true);
  };
  const salvarEmpr = async () => {
    try {
      const v = await formE.validateFields();
      setEmprSalvando(true);
      const r = await callServer<ServerResult>('empreitadaSave', {
        id: emprEdit?.id, nome: v.nome, objetivo: v.objetivo || '', sistemaId: v.sistemaId || '',
        repoUrl: v.repoUrl || '', tipo: v.tipo, status: v.status, prioridade: v.prioridade, accent: emprAccent,
        inicioAlvo: v.inicioAlvo ? dayjs(v.inicioAlvo).format('YYYY-MM') : '',
        entregaAlvo: v.entregaAlvo ? dayjs(v.entregaAlvo).format('YYYY-MM') : '',
      });
      if (r.ok) { message.success(emprEdit ? 'Empreitada atualizada' : 'Empreitada criada'); setEmprForm(false); carregar(); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setEmprSalvando(false); }
  };
  const deletarEmpr = async (id: string) => {
    const r = await callServer<ServerResult>('empreitadaDelete', id);
    if (r.ok) { message.success('Empreitada removida (atividades viraram soltas)'); setDrawerId(null); carregar(); }
    else message.error(r.error || 'Erro');
  };

  // Ao escolher um Sistema no form de empreitada, herda o repo.
  const onSistemaChange = (sid: string) => {
    const s = sistemas.find((x) => x.id === sid);
    if (s?.repoUrl && !formE.getFieldValue('repoUrl')) formE.setFieldsValue({ repoUrl: s.repoUrl });
  };

  // Arquiteto IA (Fase 3)
  const [arqOpen, setArqOpen] = useState(false);
  const [arqLoading, setArqLoading] = useState(false);
  const [arqData, setArqData] = useState<ArquitetoResposta | null>(null);
  const [arqEmpr, setArqEmpr] = useState<Empreitada | null>(null);
  const [arqImportando, setArqImportando] = useState(false);

  const analisarIA = (e: Empreitada) => {
    setArqEmpr(e); setArqData(null); setArqOpen(true); setArqLoading(true); setDrawerId(null);
    callServer<ServerResult>('empreitadaDiagnosticarIA', e.id)
      .then((r) => {
        if (r.ok && r.data) setArqData(r.data as ArquitetoResposta);
        else { message.error(r.error || 'A IA não conseguiu montar o plano.'); setArqOpen(false); }
      })
      .catch((err) => { message.error(err instanceof Error ? err.message : 'Erro'); setArqOpen(false); })
      .finally(() => setArqLoading(false));
  };
  const importarIA = async (sel: ArquitetoAtividade[]) => {
    if (!arqEmpr || sel.length === 0) return;
    setArqImportando(true);
    const r = await callServer<ServerResult>('empreitadaImportarAtividadesIA', arqEmpr.id, sel);
    setArqImportando(false);
    if (r.ok) {
      const n = (r.data as { criadas?: number })?.criadas || 0;
      message.success(`${n} atividade${n === 1 ? '' : 's'} jogada${n === 1 ? '' : 's'} no backlog`);
      setArqOpen(false); carregar();
    } else message.error(r.error || 'Erro');
  };

  const totalAbertas = abertas.length;
  const drawerEmpr = drawerId ? emprPorId[drawerId] : null;
  const drawerAtivs = useMemo(
    () => (drawerId ? atividades.filter((a) => a.empreitadaId === drawerId) : []),
    [drawerId, atividades],
  );

  const segLabel = (txt: string, n: number) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {txt}
      <span style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10, padding: '1px 6px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </span>
  );

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Backlog"
        subtitle="Jogue tudo aqui: as empreitadas (levar um app a produto) e as atividades do dia. O Foco te diz por onde começar."
        extra={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<Hammer size={15} />} onClick={abrirNovaEmpr}>Nova empreitada</Button>
            <Button type="primary" icon={<Plus size={15} />} onClick={() => abrirNovaAtiv()}>Nova atividade</Button>
          </div>
        )}
      />

      {/* Captura rápida */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Input
          size="large"
          prefix={<Flame size={16} color={t.accents.peach} />}
          placeholder="O que precisa ser feito? Joga aqui e organiza depois…"
          value={captura}
          onChange={(e) => setCaptura(e.target.value)}
          onPressEnter={capturaRapida}
          allowClear
        />
        <Button size="large" type="primary" loading={capturando} onClick={capturaRapida} disabled={!captura.trim()}>Capturar</Button>
      </div>

      <Segmented
        value={vista}
        onChange={(v) => setVista(v as Vista)}
        style={{ marginBottom: 18 }}
        options={[
          { value: 'foco', label: segLabel('Foco', fazendo.length + paraComecar.length) },
          { value: 'todas', label: segLabel('Todas', totalAbertas) },
          { value: 'empreitadas', label: segLabel('Empreitadas', empreitadas.length) },
          { value: 'roadmap', label: 'Roadmap' },
        ]}
      />

      {loading && atividades.length === 0 && empreitadas.length === 0 ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vista === 'foco' ? (
        <FocoView
          t={t}
          fazendo={fazendo}
          paraComecar={paraComecar}
          bloqueadas={bloqueadas}
          emprPorId={emprPorId}
          onStatus={statusAtiv}
          onEditar={abrirEditarAtiv}
          onDeletar={deletarAtiv}
          onNova={() => abrirNovaAtiv()}
        />
      ) : vista === 'todas' ? (
        <TodasView
          t={t}
          atividades={atividades}
          empreitadas={empreitadas}
          emprPorId={emprPorId}
          onStatus={statusAtiv}
          onEditar={abrirEditarAtiv}
          onDeletar={deletarAtiv}
          onNova={() => abrirNovaAtiv()}
        />
      ) : vista === 'empreitadas' ? (
        <EmpreitadasView
          t={t}
          empreitadas={empreitadas}
          onAbrir={(id) => setDrawerId(id)}
          onEditar={abrirEditarEmpr}
          onNova={abrirNovaEmpr}
        />
      ) : (
        <RoadmapView t={t} empreitadas={empreitadas} atividades={atividades} onAbrirEmpr={(id) => setDrawerId(id)} />
      )}

      {/* Drawer de empreitada */}
      <Drawer
        open={!!drawerEmpr}
        onClose={() => setDrawerId(null)}
        width={520}
        title={drawerEmpr ? drawerEmpr.nome : ''}
        extra={drawerEmpr && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="small" icon={<Edit3 size={14} />} onClick={() => { setDrawerId(null); abrirEditarEmpr(drawerEmpr); }}>Editar</Button>
            <Popconfirm title="Remover empreitada?" description="As atividades viram soltas (não são apagadas)." onConfirm={() => deletarEmpr(drawerEmpr.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          </div>
        )}
      >
        {drawerEmpr && (
          <EmpreitadaDetalhe
            t={t}
            e={drawerEmpr}
            ativs={drawerAtivs}
            onStatus={statusAtiv}
            onEditarAtiv={(a) => { setDrawerId(null); abrirEditarAtiv(a); }}
            onDeletarAtiv={deletarAtiv}
            onNovaAtiv={() => abrirNovaAtiv(drawerEmpr.id)}
            onMudarStatusEmpr={(st) => callServer<ServerResult>('empreitadaStatus', drawerEmpr.id, st).then(() => carregar())}
            onAbrirSistema={onAbrirSistema}
            onAnalisarIA={() => analisarIA(drawerEmpr)}
          />
        )}
      </Drawer>

      {/* Form Atividade */}
      <Modal
        open={ativForm}
        onCancel={() => setAtivForm(false)}
        title={ativEdit ? 'Editar atividade' : 'Nova atividade'}
        width={560}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setAtivForm(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={ativSalvando} onClick={salvarAtiv}>{ativEdit ? 'Salvar' : 'Criar'}</Button>,
        ]}
      >
        <Form form={formA} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="O que precisa ser feito" rules={[{ required: true, message: 'Escreva a atividade' }]}>
            <Input placeholder="ex.: migrar coleção de transações pro Firestore" autoFocus />
          </Form.Item>
          <Form.Item name="descricao" label="Detalhe (opcional)">
            <Input.TextArea rows={2} placeholder="contexto, critério de pronto, links…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="empreitadaId" label="Empreitada (opcional)">
              <Select allowClear placeholder="solta (sem projeto)" options={empreitadas.map((e) => ({ value: e.id, label: e.nome }))} />
            </Form.Item>
            <Form.Item name="tipo" label="Tipo"><Select options={TIPO_ATIV} /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="notaImpacto" label="Impacto"><Slider min={1} max={5} marks={{ 1: 'baixo', 5: 'alto' }} /></Form.Item>
            <Form.Item name="notaEsforco" label="Esforço"><Slider min={1} max={5} marks={{ 1: 'leve', 5: 'pesado' }} /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="prioridade" label="Prioridade"><Select options={PRIORIDADE} /></Form.Item>
            <Form.Item name="status" label="Status"><Select options={Object.entries(STATUS_ATIV).map(([value, v]) => ({ value, label: v.label }))} /></Form.Item>
            <Form.Item name="estimativaHoras" label="Estimativa (h)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="mesAlvo" label="Mês-alvo (roadmap)"><DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} placeholder="quando entregar" /></Form.Item>
            <Form.Item name="dependeDe" label="Depende de (opcional)">
              <Select allowClear showSearch optionFilterProp="label" placeholder="outra atividade"
                options={atividades.filter((a) => a.id !== ativEdit?.id).map((a) => ({ value: a.id, label: a.titulo }))} />
            </Form.Item>
          </div>
          {ativEdit?.promptSugerido && (
            <div style={{ background: `${t.accents.lavender}1f`, border: `1px solid ${t.accents.lavender}55`, borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 6 }}><Sparkles size={13} color={t.accents.lavender} /> Prompt sugerido (Arquiteto IA)</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{ativEdit.promptSugerido}</div>
            </div>
          )}
        </Form>
      </Modal>

      {/* Form Empreitada */}
      <Modal
        open={emprForm}
        onCancel={() => setEmprForm(false)}
        title={emprEdit ? 'Editar empreitada' : 'Nova empreitada'}
        width={560}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setEmprForm(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={emprSalvando} onClick={salvarEmpr}>{emprEdit ? 'Salvar' : 'Criar'}</Button>,
        ]}
      >
        <Form form={formE} layout="vertical" requiredMark={false}>
          <Form.Item name="nome" label="Nome da empreitada" rules={[{ required: true, message: 'Dê um nome' }]}>
            <Input placeholder="ex.: Migrar Lastro do Sheets pro Firebase" autoFocus />
          </Form.Item>
          <Form.Item name="objetivo" label="Objetivo (o que quer alcançar)">
            <Input.TextArea rows={2} placeholder="ex.: sair do Apps Script, ganhar performance e login sem aviso de app não verificado" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="sistemaId" label="Sistema (opcional)">
              <Select allowClear showSearch optionFilterProp="label" placeholder="ligar a um sistema" onChange={onSistemaChange}
                options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
            </Form.Item>
            <Form.Item name="tipo" label="Tipo"><Select options={TIPO_EMPR} /></Form.Item>
          </div>
          <Form.Item name="repoUrl" label="Repositório (herda do sistema, se houver)">
            <Input placeholder="https://github.com/…" prefix={<ExternalLink size={13} color={t.textTertiary} />} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="status" label="Status"><Select options={Object.entries(STATUS_EMPR).map(([value, v]) => ({ value, label: v.label }))} /></Form.Item>
            <Form.Item name="prioridade" label="Prioridade"><Select options={PRIORIDADE} /></Form.Item>
            <Form.Item label="Cor">
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                {ACCENTS.map((c) => (
                  <button key={c} type="button" onClick={() => setEmprAccent(c)} aria-label={c}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: t.accents[c], border: emprAccent === c ? `2px solid ${t.text}` : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="inicioAlvo" label="Início alvo"><DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="entregaAlvo" label="Entrega alvo"><DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.5 }}>
            Depois de criar, abra a empreitada e rode o <strong>Arquiteto IA</strong>: ele lê o repositório, diagnostica e monta o plano em fases com prompts prontos.
          </div>
        </Form>
      </Modal>

      {/* Arquiteto IA */}
      <ArquitetoModal
        t={t}
        open={arqOpen}
        loading={arqLoading}
        empr={arqEmpr}
        data={arqData}
        importando={arqImportando}
        onClose={() => setArqOpen(false)}
        onImportar={importarIA}
      />
    </div>
  );
}

// ── Foco ──────────────────────────────────────────────────────────────────────
function FocoView({ t, fazendo, paraComecar, bloqueadas, emprPorId, onStatus, onEditar, onDeletar, onNova }: {
  t: ReturnType<typeof useTokens>; fazendo: Atividade[]; paraComecar: Atividade[]; bloqueadas: Atividade[];
  emprPorId: Record<string, Empreitada>; onStatus: (id: string, s: string) => void; onEditar: (a: Atividade) => void;
  onDeletar: (id: string) => void; onNova: () => void;
}): React.ReactElement {
  if (fazendo.length === 0 && paraComecar.length === 0 && bloqueadas.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada em aberto. Jogue algo na captura rápida acima — depois eu te digo por onde começar.">
        <Button type="primary" icon={<Plus size={14} />} onClick={onNova}>Nova atividade</Button>
      </Empty>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {fazendo.length > 0 && (
        <Secao t={t} icone={<Play size={15} />} accent={t.accents.peach} titulo="Fazendo agora" sub="termine antes de puxar mais">
          {fazendo.map((a) => <AtivRow key={a.id} t={t} a={a} empr={emprPorId[a.empreitadaId]} onStatus={onStatus} onEditar={onEditar} onDeletar={onDeletar} />)}
        </Secao>
      )}
      <Secao t={t} icone={<Target size={15} />} accent={t.accents.sage} titulo="Comece por aqui" sub="ordenado por prioridade e impacto ÷ esforço">
        {paraComecar.length === 0
          ? <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, padding: '4px 2px' }}>Backlog limpo. 👏</div>
          : paraComecar.map((a, i) => <AtivRow key={a.id} t={t} a={a} empr={emprPorId[a.empreitadaId]} rank={i + 1} onStatus={onStatus} onEditar={onEditar} onDeletar={onDeletar} />)}
      </Secao>
      {bloqueadas.length > 0 && (
        <Secao t={t} icone={<Ban size={15} />} accent={t.accents.rose} titulo="Bloqueadas" sub="destrave ou repriorize">
          {bloqueadas.map((a) => <AtivRow key={a.id} t={t} a={a} empr={emprPorId[a.empreitadaId]} onStatus={onStatus} onEditar={onEditar} onDeletar={onDeletar} />)}
        </Secao>
      )}
    </div>
  );
}

function Secao({ t, icone, accent, titulo, sub, children }: {
  t: ReturnType<typeof useTokens>; icone: React.ReactNode; accent: string; titulo: string; sub?: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icone}</span>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>{titulo}</span>
        {sub && <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>· {sub}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

// ── Todas (por status) ──────────────────────────────────────────────────────────
function TodasView({ t, atividades, empreitadas, emprPorId, onStatus, onEditar, onDeletar, onNova }: {
  t: ReturnType<typeof useTokens>; atividades: Atividade[]; empreitadas: Empreitada[];
  emprPorId: Record<string, Empreitada>; onStatus: (id: string, s: string) => void; onEditar: (a: Atividade) => void;
  onDeletar: (id: string) => void; onNova: () => void;
}): React.ReactElement {
  const [filtroEmpr, setFiltroEmpr] = useState<string>('todas');
  const base = filtroEmpr === 'todas'
    ? atividades
    : filtroEmpr === 'soltas'
      ? atividades.filter((a) => !a.empreitadaId)
      : atividades.filter((a) => a.empreitadaId === filtroEmpr);

  const ordemStatus: Array<keyof typeof STATUS_ATIV> = ['fazendo', 'backlog', 'bloqueada', 'feito'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          size="small"
          value={filtroEmpr}
          onChange={setFiltroEmpr}
          style={{ minWidth: 200 }}
          options={[
            { value: 'todas', label: 'Todas as empreitadas' },
            { value: 'soltas', label: 'Soltas (sem empreitada)' },
            ...empreitadas.map((e) => ({ value: e.id, label: e.nome })),
          ]}
        />
        <span style={{ flex: 1 }} />
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onNova}>Nova atividade</Button>
      </div>
      {base.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada aqui com esse filtro." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ordemStatus.map((st) => {
            const grupo = base.filter((a) => a.status === st);
            if (grupo.length === 0) return null;
            const meta = STATUS_ATIV[st];
            return (
              <Secao key={st} t={t} icone={<CircleDot size={14} />} accent={t.accents[meta.accent]} titulo={meta.label} sub={`${grupo.length}`}>
                {grupo.map((a) => <AtivRow key={a.id} t={t} a={a} empr={emprPorId[a.empreitadaId]} onStatus={onStatus} onEditar={onEditar} onDeletar={onDeletar} />)}
              </Secao>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Linha de atividade ──────────────────────────────────────────────────────────
function AtivRow({ t, a, empr, rank, onStatus, onEditar, onDeletar }: {
  t: ReturnType<typeof useTokens>; a: Atividade; empr?: Empreitada; rank?: number;
  onStatus: (id: string, s: string) => void; onEditar: (a: Atividade) => void; onDeletar: (id: string) => void;
}): React.ReactElement {
  const feito = a.status === 'feito';
  const stMeta = STATUS_ATIV[a.status] || STATUS_ATIV.backlog;
  const prioCor = a.prioridade === 'alta' ? t.accents.rose : a.prioridade === 'baixa' ? t.textTertiary : t.accents.clay;
  const emprAccent = empr ? t.accents[(empr.accent as keyof typeof t.accents)] || t.accents.blue : t.border;

  const menuStatus = {
    items: Object.entries(STATUS_ATIV).map(([value, v]) => ({ key: value, label: v.label })),
    onClick: ({ key }: { key: string }) => onStatus(a.id, key),
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.borderSoft}`, borderLeft: `3px solid ${emprAccent}`, background: t.surface, opacity: feito ? 0.6 : 1 }}>
      <Tooltip title={feito ? 'Concluída' : 'Marcar como feita'}>
        <button type="button" onClick={() => onStatus(a.id, feito ? 'backlog' : 'feito')}
          style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', border: `1.5px solid ${feito ? t.accents.sage : t.border}`, background: feito ? t.accents.sage : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          {feito && <Check size={13} />}
        </button>
      </Tooltip>

      {typeof rank === 'number' && (
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: rank <= 3 ? t.accents.sage : t.textTertiary, width: 16, textAlign: 'right', flexShrink: 0 }}>{rank}</span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.35, textDecoration: feito ? 'line-through' : 'none' }}>{a.titulo}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
          {empr && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: emprAccent }}>{empr.nome}</span>}
          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>impacto {a.notaImpacto} · esforço {a.notaEsforco}</span>
          {a.estimativaHoras > 0 && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>· {a.estimativaHoras}h</span>}
          {a.mesAlvo && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>· {mesLabel(a.mesAlvo)}</span>}
          {a.prioridade !== 'media' && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: prioCor }}>{a.prioridade === 'alta' ? 'alta' : 'baixa'}</span>}
        </div>
      </div>

      <Dropdown menu={menuStatus} trigger={['click']}>
        <button type="button" style={{ cursor: 'pointer', border: `1px solid ${t.border}`, background: t.surface, borderRadius: 999, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.accents[stMeta.accent] }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents[stMeta.accent] }} />{stMeta.label}
        </button>
      </Dropdown>

      {!feito && a.status !== 'fazendo' && (
        <Tooltip title="Começar"><Button type="text" size="small" icon={<Play size={14} />} onClick={() => onStatus(a.id, 'fazendo')} /></Tooltip>
      )}
      <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={() => onEditar(a)} /></Tooltip>
      <Popconfirm title="Remover atividade?" onConfirm={() => onDeletar(a.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
        <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
      </Popconfirm>
    </div>
  );
}

// ── Empreitadas ────────────────────────────────────────────────────────────────
function EmpreitadasView({ t, empreitadas, onAbrir, onEditar, onNova }: {
  t: ReturnType<typeof useTokens>; empreitadas: Empreitada[]; onAbrir: (id: string) => void;
  onEditar: (e: Empreitada) => void; onNova: () => void;
}): React.ReactElement {
  if (empreitadas.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma empreitada. Crie um projeto de transformação (ex.: 'migrar Lastro pro Firebase') e quebre em atividades.">
        <Button type="primary" icon={<Hammer size={14} />} onClick={onNova}>Nova empreitada</Button>
      </Empty>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
      {empreitadas.map((e) => {
        const accent = t.accents[(e.accent as keyof typeof t.accents)] || t.accents.blue;
        const st = STATUS_EMPR[e.status] || STATUS_EMPR.planejando;
        const pct = e.totalAtividades > 0 ? Math.round((e.atividadesFeitas / e.totalAtividades) * 100) : 0;
        const tipo = TIPO_EMPR.find((x) => x.value === e.tipo)?.label || e.tipo;
        return (
          <div key={e.id} style={{ border: `1px solid ${t.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, background: t.surface, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: t.shadowSoft }}>
            <button type="button" onClick={() => onAbrir(e.id)} style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Hammer size={16} /></span>
                <span style={{ fontFamily: FONTS.ui, fontSize: 15, fontWeight: 600, color: t.text, flex: 1, minWidth: 0, lineHeight: 1.3 }}>{e.nome}</span>
              </div>
              {e.objetivo && <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.objetivo}</div>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.accents[st.accent] }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents[st.accent] }} />{st.label}
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textSecondary, background: t.surfaceMuted, padding: '1px 8px', borderRadius: 999 }}>{tipo}</span>
              {e.sistemaNome && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}><Boxes size={11} />{e.sistemaNome}</span>}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginBottom: 3 }}>
                <span>{e.atividadesFeitas}/{e.totalAtividades} atividades</span><span>{pct}%</span>
              </div>
              <Progress percent={pct} showInfo={false} strokeColor={accent} size="small" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 'auto', paddingTop: 4 }}>
              <Button type="text" size="small" icon={<Layers size={15} />} onClick={() => onAbrir(e.id)} style={{ paddingLeft: 0 }}>Abrir</Button>
              <span style={{ flex: 1 }} />
              <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={() => onEditar(e)} /></Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Roadmap (gantt leve por mês) ─────────────────────────────────────────────
const MONTH_W = 74;
const LABEL_W = 210;

function monthsRange(empreitadas: Empreitada[], atividades: Atividade[]): string[] {
  const ds: ReturnType<typeof dayjs>[] = [];
  const add = (ym: string) => { if (ym && dayjs(ym + '-01').isValid()) ds.push(dayjs(ym + '-01')); };
  empreitadas.forEach((e) => { add(e.inicioAlvo); add(e.entregaAlvo); });
  atividades.forEach((a) => add(a.mesAlvo));
  ds.push(dayjs().startOf('month'));
  ds.sort((a, b) => a.valueOf() - b.valueOf());
  let start = ds[0].startOf('month');
  let end = ds[ds.length - 1].startOf('month');
  if (end.diff(start, 'month') < 5) end = start.add(5, 'month');
  if (end.diff(start, 'month') > 23) end = start.add(23, 'month');
  const meses: string[] = [];
  let cur = start;
  while (cur.isBefore(end) || cur.isSame(end, 'month')) { meses.push(cur.format('YYYY-MM')); cur = cur.add(1, 'month'); }
  return meses;
}

function RoadmapView({ t, empreitadas, atividades, onAbrirEmpr }: {
  t: ReturnType<typeof useTokens>; empreitadas: Empreitada[]; atividades: Atividade[]; onAbrirEmpr: (id: string) => void;
}): React.ReactElement {
  const meses = useMemo(() => monthsRange(empreitadas, atividades), [empreitadas, atividades]);
  const hoje = dayjs().format('YYYY-MM');
  const idxDe = (ym: string) => meses.indexOf(ym);
  const soltas = atividades.filter((a) => !a.empreitadaId && a.mesAlvo && a.status !== 'feito');
  const semData = empreitadas.filter((e) => !e.inicioAlvo && !e.entregaAlvo).length;

  if (empreitadas.length === 0 && soltas.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Roadmap vazio. Defina início/entrega nas empreitadas e mês-alvo nas atividades pra elas aparecerem aqui na linha do tempo." />;
  }

  const trackW = meses.length * MONTH_W;
  const cellsFundo = (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      {meses.map((m) => (
        <div key={m} style={{ width: MONTH_W, flexShrink: 0, borderRight: `1px solid ${t.borderSoft}`, background: m === hoje ? `${t.accents.blue}0f` : 'transparent' }} />
      ))}
    </div>
  );

  const linhaEmpr = (e: Empreitada) => {
    const accent = t.accents[(e.accent as keyof typeof t.accents)] || t.accents.blue;
    let ini = idxDe(e.inicioAlvo);
    let fim = idxDe(e.entregaAlvo);
    if (ini < 0 && fim >= 0) ini = fim;
    if (fim < 0 && ini >= 0) fim = ini;
    const temBarra = ini >= 0 && fim >= 0;
    const ativsE = atividades.filter((a) => a.empreitadaId === e.id && a.mesAlvo);
    return (
      <div key={e.id} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.borderSoft}` }}>
        <button type="button" onClick={() => onAbrirEmpr(e.id)} title={e.nome}
          style={{ width: LABEL_W, flexShrink: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</span>
        </button>
        <div style={{ position: 'relative', width: trackW, height: 44, flexShrink: 0 }}>
          {cellsFundo}
          {temBarra ? (
            <Tooltip title={`${e.nome} · ${mesLabel(e.inicioAlvo) || '?'} → ${mesLabel(e.entregaAlvo) || '?'}`}>
              <div
                onClick={() => onAbrirEmpr(e.id)}
                style={{ position: 'absolute', top: 9, height: 26, left: ini * MONTH_W + 6, width: (fim - ini + 1) * MONTH_W - 12, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 10px', boxShadow: t.shadowSoft }}
              >
                <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.totalAtividades > 0 ? `${e.atividadesFeitas}/${e.totalAtividades}` : ''}
                </span>
              </div>
            </Tooltip>
          ) : (
            <span style={{ position: 'absolute', top: 14, left: 10, fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, fontStyle: 'italic' }}>defina início/entrega</span>
          )}
          {ativsE.map((a) => {
            const mi = idxDe(a.mesAlvo);
            if (mi < 0) return null;
            const done = a.status === 'feito';
            return (
              <Tooltip key={a.id} title={`${a.titulo} · ${mesLabel(a.mesAlvo)}`}>
                <span style={{ position: 'absolute', bottom: 4, left: mi * MONTH_W + MONTH_W / 2 - 3, width: 6, height: 6, borderRadius: '50%', background: done ? t.accents.sage : t.accents.peach }} />
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {semData > 0 && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 10 }}>
          {semData} empreitada{semData === 1 ? '' : 's'} sem datas — defina início/entrega pra posicionar no tempo.
        </div>
      )}
      <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface }}>
        <div style={{ minWidth: LABEL_W + trackW }}>
          {/* Header meses */}
          <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${t.border}`, background: t.surfaceMuted }}>
            <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 12px', fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary }}>Empreitada</div>
            <div style={{ display: 'flex', width: trackW, flexShrink: 0 }}>
              {meses.map((m) => (
                <div key={m} style={{ width: MONTH_W, flexShrink: 0, padding: '8px 0', textAlign: 'center', fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: m === hoje ? 700 : 500, color: m === hoje ? t.accents.blue : t.textTertiary, borderRight: `1px solid ${t.borderSoft}` }}>
                  {mesLabel(m)}
                </div>
              ))}
            </div>
          </div>
          {empreitadas.map(linhaEmpr)}
          {soltas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: LABEL_W, flexShrink: 0, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.textTertiary, flexShrink: 0 }} />
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.textSecondary }}>Atividades soltas</span>
              </div>
              <div style={{ position: 'relative', width: trackW, height: 44, flexShrink: 0 }}>
                {cellsFundo}
                {soltas.map((a) => {
                  const mi = idxDe(a.mesAlvo);
                  if (mi < 0) return null;
                  return (
                    <Tooltip key={a.id} title={`${a.titulo} · ${mesLabel(a.mesAlvo)}`}>
                      <span style={{ position: 'absolute', top: 17, left: mi * MONTH_W + MONTH_W / 2 - 5, width: 10, height: 10, borderRadius: 3, background: t.accents.clay }} />
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents.peach }} /> atividade pendente</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents.sage }} /> feita</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: t.accents.clay }} /> solta</span>
      </div>
    </div>
  );
}

function EmpreitadaDetalhe({ t, e, ativs, onStatus, onEditarAtiv, onDeletarAtiv, onNovaAtiv, onMudarStatusEmpr, onAbrirSistema, onAnalisarIA }: {
  t: ReturnType<typeof useTokens>; e: Empreitada; ativs: Atividade[];
  onStatus: (id: string, s: string) => void; onEditarAtiv: (a: Atividade) => void; onDeletarAtiv: (id: string) => void;
  onNovaAtiv: () => void; onMudarStatusEmpr: (st: string) => void; onAbrirSistema?: (id: string) => void;
  onAnalisarIA: () => void;
}): React.ReactElement {
  const accent = t.accents[(e.accent as keyof typeof t.accents)] || t.accents.blue;
  const feitas = ativs.filter((a) => a.status === 'feito').length;
  const pct = ativs.length > 0 ? Math.round((feitas / ativs.length) * 100) : 0;

  return (
    <div>
      {e.objetivo && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, paddingLeft: 12, borderLeft: `2px solid ${accent}55`, marginBottom: 16 }}>{e.objetivo}</div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select
          size="small"
          value={e.status}
          onChange={onMudarStatusEmpr}
          style={{ minWidth: 150 }}
          options={Object.entries(STATUS_EMPR).map(([value, v]) => ({ value, label: v.label }))}
        />
        {e.repoUrl && <Button size="small" icon={<ExternalLink size={13} />} href={e.repoUrl} target="_blank" rel="noreferrer">Repositório</Button>}
        {e.sistemaId && onAbrirSistema && <Button size="small" icon={<Boxes size={13} />} onClick={() => onAbrirSistema(e.sistemaId)}>Abrir sistema</Button>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 4 }}>
          <span>{feitas}/{ativs.length} atividades</span><span>{pct}%</span>
        </div>
        <Progress percent={pct} showInfo={false} strokeColor={accent} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>Atividades</span>
        <span style={{ flex: 1 }} />
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onNovaAtiv}>Adicionar</Button>
      </div>

      {ativs.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem atividades ainda. Quebre a empreitada em passos." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ativs.slice().sort((a, b) => scoreFoco(b) - scoreFoco(a)).map((a) => (
            <AtivRow key={a.id} t={t} a={a} onStatus={onStatus} onEditar={onEditarAtiv} onDeletar={onDeletarAtiv} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 18, background: `${t.accents.lavender}1f`, border: `1px solid ${t.accents.lavender}55`, borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
          <BrainCircuit size={16} color={t.accents.lavender} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
            O <b style={{ color: t.text }}>Arquiteto IA</b> lê {e.repoUrl || e.sistemaId ? 'o repositório desta empreitada' : 'o objetivo'} e monta um diagnóstico + plano em fases, com atividades e prompts prontos pra colar no Cursor/Claude.
          </span>
        </div>
        <Button type="primary" icon={<Sparkles size={14} />} onClick={onAnalisarIA} block>
          Analisar com Arquiteto IA
        </Button>
      </div>
    </div>
  );
}

// ── Arquiteto IA — modal de diagnóstico + plano ──────────────────────────────
function riscoTom(risco: string, t: ReturnType<typeof useTokens>): string {
  const r = String(risco || '').toLowerCase();
  if (r.startsWith('alt')) return t.accents.rose;
  if (r.startsWith('bai')) return t.accents.sage;
  return t.accents.clay;
}

// Painel de espera "vivo": mostra as fases do trabalho da IA com cronômetro,
// pra dar sensação de progresso (não sabemos o progresso real do LLM, então as
// etapas avançam por tempo estimado — a última segura até a resposta chegar).
const ARQ_STAGES: Array<{ label: string; icon: React.ComponentType<{ size?: number; color?: string }>; at: number }> = [
  { label: 'Lendo o repositório', icon: GitBranch, at: 0 },
  { label: 'Mapeando arquitetura e acoplamentos', icon: Boxes, at: 8 },
  { label: 'Identificando riscos de quebrar produção', icon: AlertTriangle, at: 20 },
  { label: 'Montando o plano em fases', icon: Layers, at: 34 },
  { label: 'Escrevendo os prompts das atividades', icon: Rocket, at: 48 },
];
const ARQ_ETA = 55;

function ArquitetoTrabalhando({ t, repoUrl }: { t: ReturnType<typeof useTokens>; repoUrl: string }): React.ReactElement {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(id);
  }, []);
  let atual = 0;
  ARQ_STAGES.forEach((s, i) => { if (elapsed >= s.at) atual = i; });
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const pct = Math.min(96, Math.round((elapsed / ARQ_ETA) * 100));
  const demorou = elapsed >= ARQ_ETA + 15;

  return (
    <div style={{ padding: '8px 4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${t.accents.lavender}22`, color: t.accents.lavender, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <BrainCircuit size={22} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>Arquiteto trabalhando</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repoUrl ? `analisando ${_ghShort(repoUrl)}` : 'analisando o objetivo da empreitada'}
          </div>
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 600, color: t.textSecondary, fontVariantNumeric: 'tabular-nums', background: t.surfaceMuted, borderRadius: 8, padding: '4px 10px' }}>{mm}:{ss}</span>
      </div>

      <Progress percent={pct} showInfo={false} strokeColor={t.accents.lavender} trailColor={t.surfaceMuted} style={{ marginBottom: 18 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ARQ_STAGES.map((s, i) => {
          const done = i < atual;
          const cur = i === atual;
          const Icon = s.icon;
          const cor = done ? t.accents.sage : cur ? t.accents.lavender : t.textTertiary;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, background: cur ? `${t.accents.lavender}12` : 'transparent', opacity: done || cur ? 1 : 0.5, transition: 'all 0.25s ease' }}>
              <span style={{ width: 24, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {done ? <Check size={16} color={t.accents.sage} /> : cur ? <Spin size="small" /> : <Icon size={15} color={cor} />}
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: cur ? 600 : 500, color: done ? t.textSecondary : cur ? t.text : t.textTertiary }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.55 }}>
        {demorou
          ? 'Ainda trabalhando — modelos de raciocínio às vezes demoram mais em repos grandes. Seguimos esperando; não travou.'
          : 'As etapas são uma estimativa visual — o modelo lê o código e raciocina de uma vez. Pode levar de 10s a ~1min.'}
      </div>
    </div>
  );
}

// "owner/repo" curto a partir de uma URL do GitHub (só pra exibição).
function _ghShort(repoUrl: string): string {
  const m = String(repoUrl || '').match(/github\.com\/([^/]+\/[^/?#]+)/i);
  return m ? m[1].replace(/\.git$/, '') : repoUrl;
}

function ArquitetoModal({ t, open, loading, empr, data, importando, onClose, onImportar }: {
  t: ReturnType<typeof useTokens>; open: boolean; loading: boolean; empr: Empreitada | null;
  data: ArquitetoResposta | null; importando: boolean; onClose: () => void; onImportar: (sel: ArquitetoAtividade[]) => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [sel, setSel] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (data) {
      const inicial: Record<number, boolean> = {};
      data.plano.atividades.forEach((_, i) => { inicial[i] = true; });
      setSel(inicial);
    } else setSel({});
  }, [data]);

  const selecionadas = data ? data.plano.atividades.filter((_, i) => sel[i]) : [];
  const tipoLabel = (v: string) => TIPO_ATIV.find((x) => x.value === v)?.label || v;
  const copiar = (txt: string) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt).then(() => message.success('Prompt copiado')).catch(() => message.error('Não consegui copiar'));
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={760}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <BrainCircuit size={18} color={t.accents.lavender} />
          Arquiteto IA{empr ? ` · ${empr.nome}` : ''}
        </span>
      )}
      footer={data ? [
        <Button key="c" icon={<X size={14} />} onClick={onClose}>Fechar</Button>,
        <Button key="i" type="primary" icon={<ListPlus size={15} />} loading={importando} disabled={selecionadas.length === 0} onClick={() => onImportar(selecionadas)}>
          Jogar {selecionadas.length} no backlog
        </Button>,
      ] : null}
    >
      {loading || !data ? (
        <ArquitetoTrabalhando t={t} repoUrl={empr?.repoUrl || ''} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '64vh', overflow: 'auto', paddingRight: 4 }}>
          {/* Fonte */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
            {data.fonte.repoUrl && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GitBranch size={12} /> {data.fonte.arquivos} arquivos · ~{Math.round(data.fonte.bytes / 1024)}KB{data.fonte.commitSha ? ` · ${data.fonte.commitSha}` : ''}</span>
            )}
            {data.modelo && <span>· modelo: {data.modelo}</span>}
            {data.fonte.truncado && <span style={{ color: t.accents.peach }}>· amostra truncada</span>}
          </div>
          {data.fonte.erroLeitura ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: `${t.accents.peach}1f`, border: `1px solid ${t.accents.peach}55`, borderRadius: 10, padding: '10px 12px' }}>
              <AlertTriangle size={15} color={t.accents.peach} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>Não consegui ler o código: {data.fonte.erroLeitura}. O plano foi montado a partir do objetivo — vincule o repositório pra um diagnóstico mais fundo.</span>
            </div>
          ) : data.fonte.truncado && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: `${t.accents.blue}1f`, border: `1px solid ${t.accents.blue}55`, borderRadius: 10, padding: '10px 12px' }}>
              <AlertTriangle size={15} color={t.accents.blue} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
                Repo grande: a IA leu uma <b style={{ color: t.text }}>amostra priorizada</b> de {data.fonte.arquivos} arquivos (~{Math.round(data.fonte.bytes / 1024)}KB){data.fonte.manifestArquivos ? <>, mas recebeu a <b style={{ color: t.text }}>estrutura completa</b> dos {data.fonte.manifestArquivos} arquivos</> : ''}. O diagnóstico de arquitetura é confiável; detalhes de arquivos não lidos podem faltar.
              </span>
            </div>
          )}

          {/* Diagnóstico */}
          {data.plano.diagnostico && (
            <ArqSecao t={t} titulo="Diagnóstico" accent={t.accents.blue}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.plano.diagnostico.split(/\n{2,}/).map((par, i) => par.trim() && (
                  <p key={i} style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{par.trim()}</p>
                ))}
              </div>
            </ArqSecao>
          )}

          {/* Stack */}
          {data.plano.stackDetectada.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.plano.stackDetectada.map((s, i) => (
                <span key={i} style={{ background: t.surfaceMuted, color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 11, padding: '3px 10px', borderRadius: 999 }}>{s}</span>
              ))}
            </div>
          )}

          {/* Riscos + estratégia */}
          {data.plano.riscosMigracao.length > 0 && (
            <ArqSecao t={t} titulo="Riscos de quebrar produção" accent={t.accents.rose}>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.plano.riscosMigracao.map((r, i) => (
                  <li key={i} style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>{r}</li>
                ))}
              </ul>
            </ArqSecao>
          )}
          {data.plano.estrategiaSemQuebrar && (
            <ArqSecao t={t} titulo="Estratégia sem quebrar o que roda" accent={t.accents.sage}>
              <p style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{data.plano.estrategiaSemQuebrar}</p>
            </ArqSecao>
          )}

          {/* Fases */}
          {data.plano.fases.length > 0 && (
            <ArqSecao t={t} titulo="Plano em fases" accent={t.accents.clay}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.plano.fases.slice().sort((a, b) => a.ordem - b.ordem).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: `${t.accents.clay}22`, color: t.accents.clay, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700 }}>{f.ordem}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{f.nome}</span>
                        {f.risco && <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: riscoTom(f.risco, t), border: `1px solid ${riscoTom(f.risco, t)}66`, borderRadius: 999, padding: '0 7px' }}>risco {f.risco}</span>}
                      </div>
                      {f.objetivo && <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5, marginTop: 2 }}>{f.objetivo}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </ArqSecao>
          )}

          {/* Atividades sugeridas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Rocket size={15} color={t.accents.peach} />
              <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>Atividades sugeridas</span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>· marque as que quer jogar no backlog</span>
            </div>
            {data.plano.atividades.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="A IA não sugeriu atividades." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.plano.atividades.map((a, i) => (
                  <ArqAtivCard key={i} t={t} a={a} checked={!!sel[i]} tipoLabel={tipoLabel(a.tipo)}
                    onToggle={() => setSel((s) => ({ ...s, [i]: !s[i] }))} onCopiar={() => copiar(a.prompt)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ArqSecao({ t, titulo, accent, children }: {
  t: ReturnType<typeof useTokens>; titulo: string; accent: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 6, height: 16, borderRadius: 3, background: accent }} />
        <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>{titulo}</span>
      </div>
      {children}
    </div>
  );
}

function ArqAtivCard({ t, a, checked, tipoLabel, onToggle, onCopiar }: {
  t: ReturnType<typeof useTokens>; a: ArquitetoAtividade; checked: boolean; tipoLabel: string;
  onToggle: () => void; onCopiar: () => void;
}): React.ReactElement {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ border: `1px solid ${checked ? `${t.accents.lavender}66` : t.borderSoft}`, borderRadius: 10, padding: '10px 12px', background: checked ? `${t.accents.lavender}10` : t.surface, transition: 'all 0.15s ease' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <button type="button" onClick={onToggle} aria-label="selecionar"
          style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, borderRadius: 5, cursor: 'pointer', border: `1.5px solid ${checked ? t.accents.lavender : t.border}`, background: checked ? t.accents.lavender : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {checked && <Check size={12} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{a.titulo}</div>
          {a.descricao && <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5, marginTop: 2 }}>{a.descricao}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, background: t.surfaceMuted, borderRadius: 999, padding: '1px 8px' }}>{tipoLabel}</span>
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.accents.sage }}>impacto {a.impacto}</span>
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.accents.clay }}>esforço {a.esforco}</span>
            {a.fase && <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>· {a.fase}</span>}
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>· mês +{a.mesRelativo}</span>
            <span style={{ flex: 1 }} />
            {a.prompt && (
              <>
                <Button size="small" type="text" onClick={() => setAberto((v) => !v)} style={{ fontSize: 11 }}>{aberto ? 'ocultar prompt' : 'ver prompt'}</Button>
                <Tooltip title="Copiar prompt"><Button size="small" type="text" icon={<Copy size={13} />} onClick={onCopiar} /></Tooltip>
              </>
            )}
          </div>
          {aberto && a.prompt && (
            <div style={{ marginTop: 8, background: t.surfaceMuted, borderRadius: 8, padding: '10px 12px', fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{a.prompt}</div>
          )}
        </div>
      </div>
    </div>
  );
}
