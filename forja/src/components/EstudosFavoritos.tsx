import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Skeleton, Empty, Form, Modal, Popconfirm, Tooltip, AutoComplete, Select,
} from 'antd';
import {
  Plus, Search, PlayCircle, Edit3, Trash2, ExternalLink, X, Save,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { EstudoVideo, VideoParaTocar } from '../views/Estudos';
import { ThumbImg } from './EstudosYoutube';

interface EstudosFavoritosProps {
  onTocar: (v: VideoParaTocar, fila?: VideoParaTocar[], titulo?: string) => void;
  refreshKey: number;
}

const CATEGORIAS_PADRAO = ['IA', 'Frontend', 'Backend', 'DevOps', 'Design', 'Dados', 'Produto', 'Carreira', 'Geral'];

// Lista plana de vídeos salvos avulsos (links/garimpo). A organização por tema
// vive nas "Pastas" (playlists do YouTube) — fonte única. Aqui é só uma gaveta
// rápida pra guardar um vídeo solto que não está em nenhuma playlist.
export default function EstudosFavoritos({ onTocar, refreshKey }: EstudosFavoritosProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [videos, setVideos] = useState<EstudoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<EstudoVideo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('estudoVideosList')
      .then((r) => { if (r.ok && r.data) setVideos(r.data as EstudoVideo[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (refreshKey > 0) carregar(); }, [refreshKey]);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    setFormOpen(true);
  };

  const abrirEditar = (v: EstudoVideo) => {
    setEditando(v);
    form.setFieldsValue({ url: v.url, categoria: v.categoria, tags: v.tags.join(', '), nota: v.nota });
    setFormOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('estudoVideoSave', { id: editando?.id, ...v });
      if (r.ok) {
        const dup = !!(r.data as { duplicado?: boolean } | undefined)?.duplicado;
        if (dup) message.info('Esse vídeo já estava nos Favoritos');
        else message.success(editando ? 'Favorito atualizado' : 'Vídeo salvo');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('estudoVideoDelete', id);
    if (r.ok) { message.success('Removido'); carregar(); }
  };

  const categorias = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => { if (v.categoria) set.add(v.categoria); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [videos]);
  const catSugeridas = useMemo(() => {
    const set = new Set<string>([...CATEGORIAS_PADRAO, ...categorias]);
    return Array.from(set).map((v) => ({ value: v }));
  }, [categorias]);

  const filtrados = useMemo(() => {
    const porCat = filtroCat === 'todas' ? videos : videos.filter((v) => v.categoria === filtroCat);
    if (!busca.trim()) return porCat;
    const q = busca.toLowerCase();
    return porCat.filter((v) =>
      v.titulo.toLowerCase().indexOf(q) >= 0 ||
      v.canal.toLowerCase().indexOf(q) >= 0 ||
      v.categoria.toLowerCase().indexOf(q) >= 0 ||
      v.nota.toLowerCase().indexOf(q) >= 0 ||
      v.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0));
  }, [videos, busca, filtroCat]);

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
          {videos.length} {videos.length === 1 ? 'vídeo solto salvo' : 'vídeos soltos salvos'}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Salvar vídeo</Button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por título, canal, categoria, tag, nota…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 220 }}
        />
        {categorias.length > 0 && (
          <Select
            value={filtroCat}
            onChange={setFiltroCat}
            style={{ minWidth: 170 }}
            options={[{ value: 'todas', label: 'Todas as categorias' }, ...categorias.map((c) => ({ value: c, label: c }))]}
          />
        )}
      </div>

      {loading && videos.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 ? (
        <Empty description={videos.length === 0 ? 'Nada salvo aqui ainda — use as Pastas pra navegar suas playlists, ou cole um link na aba Assistir.' : 'Nada combina com a busca.'}>
          {videos.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Salvar o primeiro</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtrados.map((v) => (
            <VideoCard
              key={v.id}
              v={v}
              t={t}
              onTocar={() => onTocar(
                { videoId: v.videoId, url: v.url, titulo: v.titulo, canal: v.canal, thumb: v.thumb },
                filtrados.map((f) => ({ videoId: f.videoId, url: f.url, titulo: f.titulo, canal: f.canal, thumb: f.thumb })),
                'Favoritos',
              )}
              onEditar={() => abrirEditar(v)}
              onDeletar={() => deletar(v.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? 'Editar favorito' : 'Salvar vídeo'}
        width={520}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="url" label="Link do YouTube" rules={[{ required: true, message: 'Cole o link do vídeo' }]} extra="Título, canal e capa são preenchidos automaticamente.">
            <Input placeholder="https://www.youtube.com/watch?v=…" autoFocus disabled={!!editando} />
          </Form.Item>
          <Form.Item name="categoria" label="Categoria (digite uma nova ou escolha)">
            <AutoComplete
              options={catSugeridas}
              placeholder="ex.: IA, Frontend, DevOps…"
              filterOption={(i, o) => (o?.value as string).toLowerCase().includes(i.toLowerCase())}
              allowClear
            />
          </Form.Item>
          <Form.Item name="tags" label="Tags (vírgula)">
            <Input placeholder="ex.: react, supabase" />
          </Form.Item>
          <Form.Item name="nota" label="Nota (por que salvou / o que tirar daqui)">
            <Input.TextArea rows={2} placeholder="ex.: revisar a parte de RLS aos 12min" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function VideoCard({ v, t, onTocar, onEditar, onDeletar }: {
  v: EstudoVideo; t: ReturnType<typeof useTokens>;
  onTocar: () => void; onEditar: () => void; onDeletar: () => void;
}): React.ReactElement {
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: t.shadowSoft }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: t.surfaceMuted }}>
        <button
          type="button"
          onClick={onTocar}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, margin: 0, cursor: 'pointer', background: 'transparent', display: 'block' }}
        >
          <ThumbImg src={v.thumb} videoId={v.videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)' }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlayCircle size={26} />
            </span>
          </span>
        </button>
      </div>
      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {v.titulo}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {v.canal && <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{v.canal}</span>}
          {v.categoria && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: t.accents.clay, background: `${t.accents.clay}1f`, border: `1px solid ${t.accents.clay}55`, padding: '1px 8px', borderRadius: 999 }}>{v.categoria}</span>
          )}
        </div>
        {v.nota && <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5, borderLeft: `2px solid ${t.accents.blue}66`, paddingLeft: 8 }}>{v.nota}</div>}
        {v.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {v.tags.slice(0, 4).map((tag) => (
              <span key={tag} style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '1px 6px' }}>{tag}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 'auto', paddingTop: 6 }}>
          <span style={{ flex: 1 }} />
          <Tooltip title="Tocar aqui"><Button type="text" size="small" icon={<PlayCircle size={15} />} onClick={onTocar} /></Tooltip>
          <Tooltip title="Abrir no YouTube"><Button type="text" size="small" icon={<ExternalLink size={14} />} href={v.url} target="_blank" rel="noopener noreferrer" /></Tooltip>
          <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
          <Popconfirm title="Remover este vídeo?" onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
            <Tooltip title="Remover"><Button type="text" size="small" danger icon={<Trash2 size={14} />} /></Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
