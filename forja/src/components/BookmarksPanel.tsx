import React, { useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Form, Modal, Popconfirm, Tooltip, Select, Switch, AutoComplete,
} from 'antd';
import {
  Bookmark, Plus, Search, ExternalLink, Trash2, Edit3, X, Save, Star, Info, Globe,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface BookmarkItem {
  id: string;
  titulo: string;
  url: string;
  descricao: string;
  categoria: string;
  tags: string[];
  destacado: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

// Sugestões-base. `categoria` é texto livre no servidor: dá pra escolher uma
// destas na lista OU digitar uma nova, que passa a valer normalmente.
const CATEGORIAS = [
  'IA', 'IDEs', 'docs', 'tutorial', 'video', 'ferramenta', 'biblioteca', 'artigo', 'curso', 'inspiracao', 'outros',
];

// Pequena heurística pra "favicon" via Google's favicon service (sem API).
function faviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch { return ''; }
}

function dominio(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export default function BookmarksPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [apenasDestacados, setApenasDestacados] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<BookmarkItem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('bookmarksList')
      .then((r) => { if (r.ok && r.data) setBookmarks(r.data as BookmarkItem[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'docs', destacado: false });
    setFormOpen(true);
  };

  const abrirEditar = (b: BookmarkItem) => {
    setEditando(b);
    form.setFieldsValue({ ...b, tags: b.tags.join(', ') });
    setFormOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('bookmarksSave', { id: editando?.id, ...v });
      if (r.ok) {
        message.success(editando ? 'Bookmark atualizado' : 'Bookmark adicionado');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('bookmarksDelete', id);
    if (r.ok) { message.success('Removido'); carregar(); }
  };

  const toggleDestaque = async (b: BookmarkItem) => {
    await callServer<ServerResult>('bookmarksSave', {
      id: b.id, titulo: b.titulo, url: b.url, descricao: b.descricao,
      categoria: b.categoria, tags: b.tags.join(','), destacado: !b.destacado,
    });
    carregar();
  };

  const filtrados = useMemo(() => {
    let lista = bookmarks;
    if (apenasDestacados) lista = lista.filter((b) => b.destacado);
    if (categoriaFiltro) lista = lista.filter((b) => b.categoria === categoriaFiltro);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((b) =>
        b.titulo.toLowerCase().indexOf(q) >= 0 ||
        b.url.toLowerCase().indexOf(q) >= 0 ||
        b.descricao.toLowerCase().indexOf(q) >= 0 ||
        b.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0),
      );
    }
    return lista;
  }, [bookmarks, filtro, categoriaFiltro, apenasDestacados]);

  const agrupados = useMemo(() => {
    const out: Record<string, BookmarkItem[]> = {};
    for (const b of filtrados) {
      const k = b.categoria || 'outros';
      if (!out[k]) out[k] = [];
      out[k].push(b);
    }
    return out;
  }, [filtrados]);

  const categorias = Object.keys(agrupados).sort();
  const destacados = bookmarks.filter((b) => b.destacado).length;

  // União das sugestões-base com as categorias já usadas (pra atalho no form/filtro).
  const categoriasSugeridas = useMemo(() => {
    const s = new Set<string>(CATEGORIAS);
    bookmarks.forEach((b) => { const c = (b.categoria || '').trim(); if (c) s.add(c); });
    return [...s].map((c) => ({ value: c, label: c }));
  }, [bookmarks]);

  return (
    <div style={{ padding: '14px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bookmark size={18} strokeWidth={1.6} color={t.accents.peach} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Bookmarks</span>
            <Tooltip title="Links que você quer ter à mão: docs, tutoriais, vídeos, ferramentas, inspiração. Destaque com a estrela os que usa mais.">
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          {bookmarks.length > 0 && (
            <p style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>
              <strong>{bookmarks.length}</strong> link{bookmarks.length > 1 ? 's' : ''}
              {destacados > 0 && <> · <Star size={11} style={{ verticalAlign: 'text-top', color: t.accents.peach, fill: t.accents.peach }} /> {destacados} destacado{destacados > 1 ? 's' : ''}</>}
            </p>
          )}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar bookmark</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por título, URL, descrição, tag…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="Categoria"
          allowClear
          showSearch
          value={categoriaFiltro || undefined}
          onChange={(v) => setCategoriaFiltro(v || '')}
          style={{ minWidth: 140 }}
          options={categoriasSugeridas}
        />
        <Tooltip title="Mostrar só destacados">
          <Button
            type={apenasDestacados ? 'primary' : 'default'}
            icon={<Star size={14} style={{ fill: apenasDestacados ? 'white' : 'transparent' }} />}
            onClick={() => setApenasDestacados(!apenasDestacados)}
          />
        </Tooltip>
      </div>

      {loading && bookmarks.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 ? (
        <Empty description={bookmarks.length === 0 ? 'Sem bookmarks ainda — salve os links que você sempre volta.' : `Nada combina com os filtros`}>
          {bookmarks.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar primeiro</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {categorias.map((cat) => (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.textSecondary, textTransform: 'capitalize' }}>
                  {cat} <span style={{ color: t.textTertiary, fontWeight: 400 }}>({agrupados[cat].length})</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agrupados[cat].map((b) => (
                  <BookmarkRow
                    key={b.id}
                    bookmark={b}
                    onToggleDestaque={() => toggleDestaque(b)}
                    onEditar={() => abrirEditar(b)}
                    onDeletar={() => deletar(b.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? `Editar: ${editando.titulo}` : 'Adicionar bookmark'}
        width={560}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="ex.: React docs, Tailwind cheatsheet" autoFocus />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição (opcional)">
            <Input.TextArea rows={2} placeholder="Pra que serve / o que tem de bom" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <Form.Item name="categoria" label="Categoria (escolha da lista ou digite uma nova)">
              <AutoComplete
                options={categoriasSugeridas}
                placeholder="ex.: IA, IDEs, docs…"
                allowClear
                filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
            <Form.Item name="tags" label="Tags (vírgula)">
              <Input placeholder="ex.: react, ui, docs" />
            </Form.Item>
          </div>
          <Form.Item name="destacado" label="Destacar (aparece no topo)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function BookmarkRow({ bookmark, onToggleDestaque, onEditar, onDeletar }: {
  bookmark: BookmarkItem; onToggleDestaque: () => void; onEditar: () => void; onDeletar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const fav = faviconUrl(bookmark.url);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: t.surface,
        border: `1px solid ${bookmark.destacado ? `${t.accents.peach}66` : t.border}`,
        borderRadius: 10, transition: 'all 0.15s',
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 6, background: t.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {fav ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fav} alt="" style={{ width: 16, height: 16 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <Globe size={14} color={t.textTertiary} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            {bookmark.titulo}
          </a>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>{dominio(bookmark.url)}</span>
          {bookmark.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{ background: t.surfaceMuted, color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 10, padding: '0 6px', borderRadius: 4 }}>{tag}</span>
          ))}
        </div>
        {bookmark.descricao && (
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bookmark.descricao}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <Tooltip title={bookmark.destacado ? 'Remover destaque' : 'Destacar'}>
          <Button
            type="text" size="small"
            icon={<Star size={14} style={{ fill: bookmark.destacado ? t.accents.peach : 'transparent', color: bookmark.destacado ? t.accents.peach : t.textTertiary }} />}
            onClick={onToggleDestaque}
          />
        </Tooltip>
        <Tooltip title="Abrir URL">
          <Button type="text" size="small" icon={<ExternalLink size={14} />} href={bookmark.url} target="_blank" rel="noopener noreferrer" />
        </Tooltip>
        <Tooltip title="Editar"><Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} /></Tooltip>
        <Popconfirm title="Remover bookmark?" onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
          <Tooltip title="Remover"><Button type="text" size="small" icon={<Trash2 size={14} />} danger /></Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}
