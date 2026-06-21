import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Select, Skeleton, Empty, Form, Modal, Popconfirm, Tooltip, Segmented,
} from 'antd';
import {
  Plus, Search, Edit3, Trash2, ExternalLink, X, Save, Database, Code2, Wrench, Boxes, Lightbulb, Sparkles, BookOpen, Route,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface EstudoNota {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string;
  prioridade: string;
  status: string;
  tags: string[];
  url: string;
  criadoEm: string;
  atualizadoEm: string;
}

const TIPOS: Record<string, { label: string; icon: React.ReactNode; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  'banco-dados': { label: 'Banco de dados', icon: <Database size={14} />, accent: 'blue' },
  ide: { label: 'IDE / Editor', icon: <Code2 size={14} />, accent: 'lavender' },
  ferramenta: { label: 'Ferramenta', icon: <Wrench size={14} />, accent: 'peach' },
  linguagem: { label: 'Linguagem / Framework', icon: <Boxes size={14} />, accent: 'sage' },
  conceito: { label: 'Conceito', icon: <Lightbulb size={14} />, accent: 'peach' },
  ia: { label: 'IA', icon: <Sparkles size={14} />, accent: 'lavender' },
  outro: { label: 'Outro', icon: <BookOpen size={14} />, accent: 'blue' },
};

const STATUS: Record<string, { label: string; cor: string }> = {
  'a-rever': { label: 'A rever', cor: '#E2A04A' },
  aprofundando: { label: 'Aprofundando', cor: '#4C8DFF' },
  dominado: { label: 'Dominado', cor: '#3CB371' },
};

const PRIORIDADES: Record<string, { label: string; cor: string }> = {
  alta: { label: 'Alta', cor: '#C98AA0' },
  media: { label: 'Média', cor: '#8C8884' },
  baixa: { label: 'Baixa', cor: '#8C8884' },
};

export default function EstudosCaderno({ onVirarTrilha }: { onVirarTrilha?: () => void }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [notas, setNotas] = useState<EstudoNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<EstudoNota | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('estudoNotasList')
      .then((r) => { if (r.ok && r.data) setNotas(r.data as EstudoNota[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ tipo: 'conceito', status: 'a-rever', prioridade: 'media' });
    setFormOpen(true);
  };

  const abrirEditar = (n: EstudoNota) => {
    setEditando(n);
    form.setFieldsValue({ ...n, tags: n.tags.join(', ') });
    setFormOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('estudoNotaSave', { id: editando?.id, ...v });
      if (r.ok) {
        message.success(editando ? 'Atualizado' : 'Adicionado ao caderno');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('estudoNotaDelete', id);
    if (r.ok) { message.success('Removido'); carregar(); }
  };

  const virarTrilha = async (n: EstudoNota) => {
    const r = await callServer<ServerResult>('estudoTrilhaSave', {
      titulo: n.titulo,
      objetivo: n.descricao,
      status: n.status === 'dominado' ? 'concluido' : n.status === 'aprofundando' ? 'estudando' : 'planejando',
      prioridade: n.prioridade,
      cor: 'lavender',
    });
    if (r.ok) {
      message.success('Virou uma trilha — adicione vídeos e tarefas lá.');
      onVirarTrilha?.();
    } else message.error(r.error || 'Erro');
  };

  const mudarStatus = async (n: EstudoNota, status: string) => {
    const r = await callServer<ServerResult>('estudoNotaSave', {
      id: n.id, titulo: n.titulo, tipo: n.tipo, descricao: n.descricao,
      prioridade: n.prioridade, status, tags: n.tags.join(','), url: n.url,
    });
    if (r.ok) carregar();
  };

  const filtradas = useMemo(() => {
    let lista = notas;
    if (filtroStatus !== 'todos') lista = lista.filter((n) => n.status === filtroStatus);
    if (filtroTipo) lista = lista.filter((n) => n.tipo === filtroTipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((n) =>
        n.titulo.toLowerCase().indexOf(q) >= 0 ||
        n.descricao.toLowerCase().indexOf(q) >= 0 ||
        n.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0));
    }
    return lista;
  }, [notas, busca, filtroStatus, filtroTipo]);

  const contagem = (s: string) => notas.filter((n) => n.status === s).length;

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
          {notas.length} {notas.length === 1 ? 'assunto' : 'assuntos'} no caderno
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Novo assunto</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por assunto, descrição, tag…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 220 }}
        />
        <Select
          placeholder="Tipo"
          allowClear
          value={filtroTipo || undefined}
          onChange={(v) => setFiltroTipo(v || '')}
          style={{ minWidth: 170 }}
          options={Object.entries(TIPOS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <Segmented
          value={filtroStatus}
          onChange={(v) => setFiltroStatus(v as string)}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'a-rever', label: `A rever${contagem('a-rever') ? ` (${contagem('a-rever')})` : ''}` },
            { value: 'aprofundando', label: 'Aprofundando' },
            { value: 'dominado', label: 'Dominado' },
          ]}
        />
      </div>

      {loading && notas.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtradas.length === 0 ? (
        <Empty description={notas.length === 0 ? 'Caderno vazio — registre o que você quer revisar ou aprofundar (um banco novo, uma IDE, um conceito…).' : 'Nada combina com os filtros.'}>
          {notas.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Registrar o primeiro</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtradas.map((n) => (
            <NotaCard
              key={n.id}
              n={n}
              onEditar={() => abrirEditar(n)}
              onDeletar={() => deletar(n.id)}
              onStatus={(s) => mudarStatus(n, s)}
              onVirarTrilha={() => virarTrilha(n)}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? 'Editar assunto' : 'Novo assunto'}
        width={540}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="Assunto / o que estudar" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="ex.: Supabase RLS, Cursor multi-file edits, índices no Postgres" autoFocus />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="tipo" label="Tipo">
              <Select options={Object.entries(TIPOS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </Form.Item>
            <Form.Item name="prioridade" label="Prioridade">
              <Select options={Object.entries(PRIORIDADES).map(([k, v]) => ({ value: k, label: v.label }))} />
            </Form.Item>
          </div>
          <Form.Item name="descricao" label="Por que / o que aprofundar">
            <Input.TextArea rows={3} placeholder="ex.: testar como alternativa ao Firebase; ver pricing e free tier; comparar com o que já uso" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="url" label="Link (opcional)">
              <Input placeholder="https://…" />
            </Form.Item>
            <Form.Item name="tags" label="Tags (vírgula)">
              <Input placeholder="ex.: testar, urgente" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function NotaCard({ n, onEditar, onDeletar, onStatus, onVirarTrilha }: {
  n: EstudoNota; onEditar: () => void; onDeletar: () => void; onStatus: (s: string) => void; onVirarTrilha: () => void;
}): React.ReactElement {
  const t = useTokens();
  const tipo = TIPOS[n.tipo] || TIPOS.outro;
  const accent = t.accents[tipo.accent];
  const st = STATUS[n.status] || STATUS['a-rever'];
  const prio = PRIORIDADES[n.prioridade] || PRIORIDADES.media;
  return (
    <div style={{ border: `1px solid ${t.border}`, borderLeft: `3px solid ${st.cor}`, borderRadius: 12, background: t.surface, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: t.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}1f`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{tipo.icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text, flex: 1, minWidth: 0, lineHeight: 1.3 }}>{n.titulo}</span>
        {n.prioridade === 'alta' && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 10, fontWeight: 700, color: prio.cor, background: `${prio.cor}1f`, borderRadius: 999, padding: '1px 8px', flexShrink: 0 }}>Alta</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>{tipo.label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: st.cor }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />{st.label}
        </span>
      </div>

      {n.descricao && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>{n.descricao}</div>
      )}

      {n.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {n.tags.slice(0, 5).map((tag) => (
            <span key={tag} style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '1px 6px' }}>{tag}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 'auto', paddingTop: 6, borderTop: `1px solid ${t.borderSoft}` }}>
        <Select
          size="small"
          variant="borderless"
          value={n.status}
          onChange={onStatus}
          style={{ width: 132 }}
          options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <span style={{ flex: 1 }} />
        <Tooltip title="Virar trilha de estudo"><Button type="text" size="small" icon={<Route size={14} />} onClick={onVirarTrilha} /></Tooltip>
        {n.url && <Tooltip title="Abrir link"><Button type="text" size="small" icon={<ExternalLink size={14} />} href={n.url} target="_blank" rel="noopener noreferrer" /></Tooltip>}
        <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
        <Popconfirm title="Remover este assunto?" onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
          <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}
