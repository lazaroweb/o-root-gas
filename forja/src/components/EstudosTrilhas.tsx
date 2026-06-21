import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Select, Skeleton, Empty, Form, Modal, Popconfirm, Tooltip, Segmented, Progress,
} from 'antd';
import {
  Plus, Trash2, Edit3, ChevronLeft, X, Save, PlayCircle, Star, Search, Link2, Film, ListChecks, Target,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { VideoParaTocar } from '../views/Estudos';
import { ThumbImg } from './EstudosYoutube';

interface Trilha {
  id: string; titulo: string; objetivo: string; status: string; prioridade: string; cor: string;
  ordem: number; totalItens: number; itensFeitos: number; totalVideos: number;
}
interface TrilhaItem {
  id: string; trilhaId: string; tipo: string; titulo: string; descricao: string;
  videoId: string; url: string; canal: string; thumb: string; feito: boolean; ordem: number;
}

interface EstudosTrilhasProps {
  onTocar: (v: VideoParaTocar, fila?: VideoParaTocar[], titulo?: string) => void;
}

const STATUS: Record<string, { label: string; cor: string }> = {
  planejando: { label: 'Planejando', cor: '#7E9DC4' },
  estudando: { label: 'Estudando', cor: '#D99B73' },
  concluido: { label: 'Concluído', cor: '#7FA98B' },
};
const STATUS_OPCOES = Object.entries(STATUS).map(([value, v]) => ({ value, label: v.label }));
const PRIORIDADE_OPCOES = [
  { value: 'alta', label: 'Alta' }, { value: 'media', label: 'Média' }, { value: 'baixa', label: 'Baixa' },
];
const CORES: Array<keyof ReturnType<typeof useTokens>['accents']> = ['peach', 'blue', 'sage', 'lavender', 'rose'];

export default function EstudosTrilhas({ onTocar }: EstudosTrilhasProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Trilha | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [cor, setCor] = useState<string>('peach');
  const [form] = Form.useForm();

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('estudoTrilhasList')
      .then((r) => { if (r.ok && r.data) setTrilhas(r.data as Trilha[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const aberta = useMemo(() => trilhas.find((tr) => tr.id === abertaId) || null, [trilhas, abertaId]);

  const abrirNovo = () => {
    setEditando(null); setCor('peach');
    form.resetFields();
    form.setFieldsValue({ status: 'planejando', prioridade: 'media' });
    setFormOpen(true);
  };
  const abrirEditar = (tr: Trilha) => {
    setEditando(tr); setCor(tr.cor || 'peach');
    form.setFieldsValue({ titulo: tr.titulo, objetivo: tr.objetivo, status: tr.status, prioridade: tr.prioridade });
    setFormOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('estudoTrilhaSave', { id: editando?.id, ...v, cor });
      if (r.ok) { message.success(editando ? 'Trilha atualizada' : 'Trilha criada'); setFormOpen(false); carregar(); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('estudoTrilhaDelete', id);
    if (r.ok) { message.success('Trilha removida'); if (abertaId === id) setAbertaId(null); carregar(); }
  };

  if (aberta) {
    return (
      <TrilhaDetalhe
        trilha={aberta}
        t={t}
        onVoltar={() => setAbertaId(null)}
        onEditar={() => abrirEditar(aberta)}
        onDeletar={() => deletar(aberta.id)}
        onMudou={carregar}
        onTocar={onTocar}
      />
    );
  }

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
          {trilhas.length} {trilhas.length === 1 ? 'trilha' : 'trilhas'} de estudo
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Nova trilha</Button>
      </div>

      {loading && trilhas.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : trilhas.length === 0 ? (
        <Empty description="Nenhuma trilha ainda. Crie um tópico (ex.: Agents, Skills, Tools) e monte seu plano com vídeos e tarefas.">
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Criar a primeira</Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {trilhas.map((tr) => (
            <TrilhaCard key={tr.id} tr={tr} t={t} onAbrir={() => setAbertaId(tr.id)} onEditar={() => abrirEditar(tr)} onDeletar={() => deletar(tr.id)} />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? 'Editar trilha' : 'Nova trilha'}
        width={520}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>{editando ? 'Atualizar' : 'Criar'}</Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="Tópico / o que estudar" rules={[{ required: true, message: 'Dê um nome' }]}>
            <Input placeholder="ex.: Agents, Skills, Tools, RAG…" autoFocus />
          </Form.Item>
          <Form.Item name="objetivo" label="Objetivo (o que quer dominar)">
            <Input.TextArea rows={2} placeholder="ex.: entender o que são agents, como criar tools e orquestrar skills." />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="status" label="Status"><Select options={STATUS_OPCOES} /></Form.Item>
            <Form.Item name="prioridade" label="Prioridade"><Select options={PRIORIDADE_OPCOES} /></Form.Item>
          </div>
          <div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, marginBottom: 8 }}>Cor</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={c}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: t.accents[c], border: cor === c ? `2px solid ${t.text}` : `2px solid transparent`, cursor: 'pointer', boxShadow: cor === c ? `0 0 0 2px ${t.surface}` : 'none' }}
                />
              ))}
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function TrilhaCard({ tr, t, onAbrir, onEditar, onDeletar }: {
  tr: Trilha; t: ReturnType<typeof useTokens>; onAbrir: () => void; onEditar: () => void; onDeletar: () => void;
}): React.ReactElement {
  const accent = t.accents[(tr.cor as keyof typeof t.accents)] || t.accents.peach;
  const st = STATUS[tr.status] || STATUS.planejando;
  const pct = tr.totalItens > 0 ? Math.round((tr.itensFeitos / tr.totalItens) * 100) : 0;
  return (
    <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, background: t.surface, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: t.shadowSoft }}>
      <button type="button" onClick={onAbrir} style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Target size={15} /></span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 15, fontWeight: 600, color: t.text, flex: 1, minWidth: 0, lineHeight: 1.3 }}>{tr.titulo}</span>
        </div>
        {tr.objetivo && <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tr.objetivo}</div>}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: st.cor }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />{st.label}
        </span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>· {tr.totalVideos} {tr.totalVideos === 1 ? 'vídeo' : 'vídeos'}</span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginBottom: 3 }}>
          <span>{tr.itensFeitos}/{tr.totalItens} concluídos</span><span>{pct}%</span>
        </div>
        <Progress percent={pct} showInfo={false} strokeColor={accent} size="small" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 'auto', paddingTop: 4 }}>
        <Button type="text" size="small" icon={<ListChecks size={15} />} onClick={onAbrir} style={{ paddingLeft: 0 }}>Abrir plano</Button>
        <span style={{ flex: 1 }} />
        <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
        <Popconfirm title="Remover esta trilha?" description="Os itens dela também serão apagados." onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
          <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}

function TrilhaDetalhe({ trilha, t, onVoltar, onEditar, onDeletar, onMudou, onTocar }: {
  trilha: Trilha; t: ReturnType<typeof useTokens>; onVoltar: () => void; onEditar: () => void;
  onDeletar: () => void; onMudou: () => void; onTocar: (v: VideoParaTocar, fila?: VideoParaTocar[], titulo?: string) => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const accent = t.accents[(trilha.cor as keyof typeof t.accents)] || t.accents.peach;
  const [itens, setItens] = useState<TrilhaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [tarefaOpen, setTarefaOpen] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('estudoTrilhaItensList', trilha.id)
      .then((r) => { if (r.ok && r.data) setItens(r.data as TrilhaItem[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, [trilha.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const feitos = itens.filter((i) => i.feito).length;
  const pct = itens.length > 0 ? Math.round((feitos / itens.length) * 100) : 0;
  const videos = itens.filter((i) => i.tipo === 'video');

  const filaVideos = (): VideoParaTocar[] => videos.map((v) => ({ videoId: v.videoId, url: v.url, titulo: v.titulo, canal: v.canal, thumb: v.thumb }));

  const toggle = async (it: TrilhaItem) => {
    setItens((arr) => arr.map((x) => (x.id === it.id ? { ...x, feito: !x.feito } : x)));
    const r = await callServer<ServerResult>('estudoTrilhaItemToggle', it.id, !it.feito);
    if (r.ok) onMudou(); else carregar();
  };

  const remover = async (id: string) => {
    const r = await callServer<ServerResult>('estudoTrilhaItemDelete', id);
    if (r.ok) { carregar(); onMudou(); } else message.error(r.error || 'Erro');
  };

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button size="small" icon={<ChevronLeft size={14} />} onClick={onVoltar}>Trilhas</Button>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Target size={15} /></span>
        <span style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: t.text }}>{trilha.titulo}</span>
        <span style={{ flex: 1 }} />
        <Tooltip title="Editar trilha"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
        <Popconfirm title="Remover esta trilha?" description="Os itens também serão apagados." onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
          <Tooltip title="Remover trilha"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
        </Popconfirm>
      </div>

      {trilha.objetivo && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 14, paddingLeft: 12, borderLeft: `2px solid ${accent}55` }}>{trilha.objetivo}</div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 4 }}>
          <span>{feitos}/{itens.length} concluídos</span><span>{pct}%</span>
        </div>
        <Progress percent={pct} showInfo={false} strokeColor={accent} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button type="primary" icon={<Film size={14} />} onClick={() => setAddVideoOpen(true)}>Adicionar vídeo</Button>
        <Button icon={<Plus size={14} />} onClick={() => setTarefaOpen(true)}>Adicionar tarefa</Button>
      </div>

      {loading && itens.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : itens.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Plano vazio. Adicione vídeos do seu YouTube e tarefas pra montar a sequência." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {itens.map((it, idx) => (
            <ItemRow
              key={it.id}
              it={it}
              idx={idx}
              t={t}
              onToggle={() => toggle(it)}
              onRemover={() => remover(it.id)}
              onEstudar={() => onTocar({ videoId: it.videoId, url: it.url, titulo: it.titulo, canal: it.canal, thumb: it.thumb }, filaVideos(), trilha.titulo)}
            />
          ))}
        </div>
      )}

      <AddVideoModal open={addVideoOpen} onClose={() => setAddVideoOpen(false)} trilhaId={trilha.id} t={t} onAdicionou={() => { carregar(); onMudou(); }} />
      <TarefaModal open={tarefaOpen} onClose={() => setTarefaOpen(false)} trilhaId={trilha.id} onAdicionou={() => { carregar(); onMudou(); }} />
    </div>
  );
}

function ItemRow({ it, idx, t, onToggle, onRemover, onEstudar }: {
  it: TrilhaItem; idx: number; t: ReturnType<typeof useTokens>; onToggle: () => void; onRemover: () => void; onEstudar: () => void;
}): React.ReactElement {
  const isVideo = it.tipo === 'video';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, border: `1px solid ${t.borderSoft}`, background: t.surface, opacity: it.feito ? 0.62 : 1 }}>
      <Tooltip title={it.feito ? 'Concluído' : 'Marcar como concluído'}>
        <button type="button" onClick={onToggle} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', border: `1.5px solid ${it.feito ? t.accents.sage : t.border}`, background: it.feito ? t.accents.sage : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          {it.feito && <span style={{ fontSize: 12, lineHeight: 1 }}>✓</span>}
        </button>
      </Tooltip>

      <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, width: 18, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>

      {isVideo ? (
        <>
          <button type="button" onClick={onEstudar} style={{ position: 'relative', width: 92, height: 52, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: t.surfaceMuted, border: 'none', padding: 0, cursor: 'pointer' }}>
            <ThumbImg src={it.thumb} videoId={it.videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', color: '#fff' }}><PlayCircle size={18} /></span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3, textDecoration: it.feito ? 'line-through' : 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.titulo}</div>
            {it.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{it.canal}</div>}
          </div>
          <Button size="small" type="text" icon={<PlayCircle size={15} />} onClick={onEstudar}>Estudar</Button>
        </>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 500, color: t.text, lineHeight: 1.4, textDecoration: it.feito ? 'line-through' : 'none' }}>{it.titulo}</div>
          {it.descricao && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2, lineHeight: 1.45 }}>{it.descricao}</div>}
        </div>
      )}

      <Popconfirm title="Remover este item?" onConfirm={onRemover} okText="Remover" cancelText="Cancelar">
        <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
      </Popconfirm>
    </div>
  );
}

function TarefaModal({ open, onClose, trilhaId, onAdicionou }: {
  open: boolean; onClose: () => void; trilhaId: string; onAdicionou: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) form.resetFields(); }, [open, form]);
  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('estudoTrilhaItemSave', { trilhaId, tipo: 'tarefa', titulo: v.titulo, descricao: v.descricao });
      if (r.ok) { message.success('Tarefa adicionada'); onClose(); onAdicionou(); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvando(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} title="Nova tarefa" width={460} footer={[
      <Button key="c" onClick={onClose}>Cancelar</Button>,
      <Button key="s" type="primary" loading={salvando} onClick={salvar}>Adicionar</Button>,
    ]}>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="titulo" label="Tarefa" rules={[{ required: true, message: 'Escreva a tarefa' }]}>
          <Input placeholder="ex.: ler doc de tools; fazer um agente simples" autoFocus />
        </Form.Item>
        <Form.Item name="descricao" label="Detalhe (opcional)">
          <Input.TextArea rows={2} placeholder="o que exatamente fazer / link de referência" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface YtVideo { videoId: string; titulo: string; canal: string; thumb: string; publicado?: string }
interface FavVideo { id: string; videoId: string; url: string; titulo: string; canal: string; thumb: string }

function AddVideoModal({ open, onClose, trilhaId, t, onAdicionou }: {
  open: boolean; onClose: () => void; trilhaId: string; t: ReturnType<typeof useTokens>; onAdicionou: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [aba, setAba] = useState<'link' | 'favoritos' | 'buscar'>('link');

  const [link, setLink] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  const [favs, setFavs] = useState<FavVideo[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<YtVideo[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [addId, setAddId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) { setLink(''); setBusca(''); setResultados([]); setAddId({}); setAba('link'); }
  }, [open]);

  useEffect(() => {
    if (open && aba === 'favoritos' && favs.length === 0) {
      setLoadingFavs(true);
      callServer<ServerResult>('estudoVideosList')
        .then((r) => { if (r.ok && r.data) setFavs(r.data as FavVideo[]); })
        .catch(() => { /* noop */ })
        .finally(() => setLoadingFavs(false));
    }
  }, [open, aba, favs.length]);

  const addVideo = async (payload: Record<string, unknown>, chave: string) => {
    setAddId((m) => ({ ...m, [chave]: true }));
    try {
      const r = await callServer<ServerResult>('estudoTrilhaItemSave', { trilhaId, tipo: 'video', ...payload });
      if (r.ok) { message.success('Adicionado à trilha'); onAdicionou(); }
      else { message.error(r.error || 'Erro'); setAddId((m) => ({ ...m, [chave]: false })); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
      setAddId((m) => ({ ...m, [chave]: false }));
    }
  };

  const addPorLink = async () => {
    const v = link.trim();
    if (!v) { message.error('Cole um link do YouTube.'); return; }
    setAddingLink(true);
    await addVideo({ url: v }, 'link:' + v);
    setAddingLink(false);
    setLink('');
  };

  const buscar = () => {
    const q = busca.trim();
    if (!q) return;
    setBuscando(true);
    callServer<ServerResult>('estudoYoutubeBuscar', q)
      .then((r) => {
        if (r.ok && r.data) setResultados((r.data as { itens: YtVideo[] }).itens || []);
        else if (r.error === 'NOT_CONNECTED' || r.error === 'AUTH_NEEDED') message.warning('Conecte sua conta do YouTube na aba Pastas pra buscar.');
        else if (r.error === 'API_DISABLED') message.error('Ative a YouTube Data API v3 no seu projeto do Google Cloud.');
        else message.error(r.error || 'Erro na busca');
      })
      .catch((e) => message.error(e.message))
      .finally(() => setBuscando(false));
  };

  return (
    <Modal open={open} onCancel={onClose} title="Adicionar vídeo à trilha" width={620} footer={[<Button key="ok" type="primary" onClick={onClose}>Concluído</Button>]}>
      <Segmented
        block
        value={aba}
        onChange={(v) => setAba(v as 'link' | 'favoritos' | 'buscar')}
        options={[
          { value: 'link', label: <Seg icon={<Link2 size={13} />} txt="Link" /> },
          { value: 'favoritos', label: <Seg icon={<Star size={13} />} txt="Favoritos" /> },
          { value: 'buscar', label: <Seg icon={<Search size={13} />} txt="Buscar" /> },
        ]}
        style={{ marginBottom: 14 }}
      />

      {aba === 'link' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Input prefix={<Link2 size={14} color={t.textTertiary} />} placeholder="https://www.youtube.com/watch?v=…" value={link} onChange={(e) => setLink(e.target.value)} onPressEnter={addPorLink} allowClear style={{ flex: 1 }} />
          <Button type="primary" loading={addingLink} onClick={addPorLink}>Adicionar</Button>
        </div>
      )}

      {aba === 'favoritos' && (
        loadingFavs ? <Skeleton active paragraph={{ rows: 4 }} />
          : favs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem favoritos ainda." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                {favs.map((f) => (
                  <LinhaResultado
                    key={f.id}
                    t={t}
                    videoId={f.videoId}
                    thumb={f.thumb}
                    titulo={f.titulo}
                    canal={f.canal}
                    adicionando={!!addId['fav:' + f.id]}
                    onAdd={() => addVideo({ videoId: f.videoId, url: f.url, titulo: f.titulo, canal: f.canal, thumb: f.thumb }, 'fav:' + f.id)}
                  />
                ))}
              </div>
            )
      )}

      {aba === 'buscar' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input prefix={<Search size={13} color={t.textTertiary} />} placeholder="Buscar vídeos no YouTube…" value={busca} onChange={(e) => setBusca(e.target.value)} onPressEnter={buscar} allowClear style={{ flex: 1 }} />
            <Button type="primary" loading={buscando} onClick={buscar}>Buscar</Button>
          </div>
          {buscando ? <Skeleton active paragraph={{ rows: 4 }} />
            : resultados.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Busque vídeos pra adicionar ao plano." />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                  {resultados.map((v) => (
                    <LinhaResultado
                      key={v.videoId}
                      t={t}
                      videoId={v.videoId}
                      thumb={v.thumb}
                      titulo={v.titulo}
                      canal={v.canal}
                      adicionando={!!addId['busca:' + v.videoId]}
                      onAdd={() => addVideo({ videoId: v.videoId, url: 'https://www.youtube.com/watch?v=' + v.videoId, titulo: v.titulo, canal: v.canal, thumb: v.thumb }, 'busca:' + v.videoId)}
                    />
                  ))}
                </div>
              )}
        </div>
      )}
    </Modal>
  );
}

function LinhaResultado({ t, videoId, thumb, titulo, canal, adicionando, onAdd }: {
  t: ReturnType<typeof useTokens>; videoId: string; thumb: string; titulo: string; canal: string; adicionando: boolean; onAdd: () => void;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', borderRadius: 10, border: `1px solid ${t.borderSoft}`, background: t.surface }}>
      <div style={{ position: 'relative', width: 84, height: 47, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: t.surfaceMuted }}>
        <ThumbImg src={thumb} videoId={videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titulo}</div>
        {canal && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{canal}</div>}
      </div>
      <Button size="small" type="primary" icon={<Plus size={13} />} loading={adicionando} onClick={onAdd}>Adicionar</Button>
    </div>
  );
}

function Seg({ icon, txt }: { icon: React.ReactNode; txt: string }): React.ReactElement {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon}{txt}</span>;
}
