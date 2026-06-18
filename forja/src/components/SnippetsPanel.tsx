import React, { useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select,
} from 'antd';
import {
  Code2, Plus, Search, Copy, Trash2, Edit3, X, Save, Info, Tag as TagIcon, Hash,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Snippet {
  id: string;
  titulo: string;
  descricao: string;
  linguagem: string;
  codigo: string;
  tags: string[];
  fonte: string;
  tamanhoBytes: number;
  criadoEm: string;
  atualizadoEm: string;
}

const LINGUAGENS = [
  'typescript', 'javascript', 'tsx', 'jsx', 'python', 'sql', 'bash', 'html', 'css', 'scss',
  'json', 'yaml', 'markdown', 'go', 'rust', 'java', 'kotlin', 'swift', 'dart', 'php', 'ruby',
  'graphql', 'dockerfile', 'env', 'regex', 'text',
];

const CORES_LINGUAGEM: Record<string, string> = {
  typescript: '#3178C6', javascript: '#F7DF1E', tsx: '#3178C6', jsx: '#F7DF1E',
  python: '#3776AB', sql: '#336791', bash: '#4EAA25', html: '#E34F26',
  css: '#1572B6', scss: '#CC6699', json: '#74B7B2', yaml: '#CB171E',
  markdown: '#999', go: '#00ADD8', rust: '#CE422B', java: '#5382A1',
  kotlin: '#7F52FF', swift: '#FA7343', dart: '#0175C2', php: '#777BB4',
  ruby: '#CC342D', graphql: '#E535AB', dockerfile: '#2496ED', env: '#ECD53F',
  regex: '#A788C9', text: '#999',
};

function bytesHumano(n: number): string {
  if (n < 1024) return `${n}B`;
  return `${(n / 1024).toFixed(1)}KB`;
}

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function SnippetsPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [linguagemFiltro, setLinguagemFiltro] = useState<string>('');
  const [aberto, setAberto] = useState<Snippet | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Snippet | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('snippetsList')
      .then((r) => { if (r.ok && r.data) setSnippets(r.data as Snippet[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ linguagem: 'typescript' });
    setFormOpen(true);
  };

  const abrirEditar = (s: Snippet) => {
    setEditando(s);
    form.setFieldsValue({ ...s, tags: s.tags.join(', ') });
    setFormOpen(true);
    setAberto(null);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('snippetsSave', { id: editando?.id, ...v });
      if (r.ok) {
        message.success(editando ? 'Snippet atualizado' : 'Snippet adicionado');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('snippetsDelete', id);
    if (r.ok) { message.success('Removido'); setAberto(null); carregar(); }
  };

  const copiarCodigo = (codigo: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(codigo);
      message.success('Código copiado');
    }
  };

  const filtrados = useMemo(() => {
    let lista = snippets;
    if (linguagemFiltro) lista = lista.filter((s) => s.linguagem === linguagemFiltro);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((s) =>
        s.titulo.toLowerCase().indexOf(q) >= 0 ||
        s.descricao.toLowerCase().indexOf(q) >= 0 ||
        s.codigo.toLowerCase().indexOf(q) >= 0 ||
        s.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0),
      );
    }
    return lista;
  }, [snippets, filtro, linguagemFiltro]);

  return (
    <div style={{ padding: '14px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code2 size={18} strokeWidth={1.6} color={t.accents.blue} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Snippets de código</span>
            <Tooltip title="Blocos de código reutilizáveis: componentes React, queries SQL, comandos bash, helpers Tailwind, regex que você sempre esquece. Copia e cola direto no Cursor.">
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          {snippets.length > 0 && (
            <p style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>
              <strong>{snippets.length}</strong> snippet{snippets.length > 1 ? 's' : ''} salvo{snippets.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar snippet</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por título, código, tag…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="Linguagem"
          allowClear
          value={linguagemFiltro || undefined}
          onChange={(v) => setLinguagemFiltro(v || '')}
          style={{ minWidth: 160 }}
          options={LINGUAGENS.map((l) => ({ value: l, label: l }))}
          showSearch
        />
      </div>

      {loading && snippets.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 ? (
        <Empty description={snippets.length === 0 ? 'Nenhum snippet ainda — adicione seus blocos favoritos.' : `Nenhum snippet combina com "${filtro}"`}>
          {snippets.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar primeiro snippet</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtrados.map((s) => <SnippetCard key={s.id} snippet={s} onOpen={() => setAberto(s)} onCopiar={() => copiarCodigo(s.codigo)} />)}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={!!aberto}
        onClose={() => setAberto(null)}
        width={720}
        title={aberto ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CORES_LINGUAGEM[aberto.linguagem] || '#999' }} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberto.titulo}</span>
            <Tag color="default" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{aberto.linguagem}</Tag>
          </span>
        ) : ''}
        extra={aberto && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip title="Copiar código"><Button icon={<Copy size={14} />} onClick={() => copiarCodigo(aberto.codigo)}>Copiar</Button></Tooltip>
            <Button icon={<Edit3 size={14} />} onClick={() => abrirEditar(aberto)}>Editar</Button>
            <Popconfirm title="Remover snippet?" onConfirm={() => deletar(aberto.id)} okText="Remover" cancelText="Cancelar">
              <Tooltip title="Remover"><Button icon={<Trash2 size={14} />} danger /></Tooltip>
            </Popconfirm>
          </div>
        )}
      >
        {aberto && (
          <>
            {aberto.descricao && <p style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, marginTop: 0 }}>{aberto.descricao}</p>}
            {aberto.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {aberto.tags.map((tag) => <Tag key={tag} icon={<TagIcon size={10} style={{ marginRight: 4 }} />}>{tag}</Tag>)}
              </div>
            )}
            <pre style={{
              background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
              borderRadius: 10, padding: 16, fontFamily: FONTS.mono,
              fontSize: 12.5, lineHeight: 1.55, color: t.text,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 'calc(100vh - 280px)', overflow: 'auto',
            }}>
              {aberto.codigo}
            </pre>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 8 }}>
              {bytesHumano(aberto.tamanhoBytes)} · atualizado {relTempo(aberto.atualizadoEm)}
              {aberto.fonte && ` · de ${aberto.fonte}`}
            </div>
          </>
        )}
      </Drawer>

      {/* Form */}
      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? `Editar: ${editando.titulo}` : 'Adicionar snippet'}
        width={760}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: useDebounce hook, query de receita por mês" autoFocus />
            </Form.Item>
            <Form.Item name="linguagem" label="Linguagem">
              <Select options={LINGUAGENS.map((l) => ({ value: l, label: l }))} showSearch />
            </Form.Item>
          </div>
          <Form.Item name="descricao" label="Descrição (opcional)">
            <Input placeholder="Quando usar / o que faz" />
          </Form.Item>
          <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={10} placeholder="cole o código aqui" style={{ fontFamily: FONTS.mono, fontSize: 12.5 }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="tags" label="Tags (vírgula)">
              <Input placeholder="hook, react, util" />
            </Form.Item>
            <Form.Item name="fonte" label="Fonte (opcional)">
              <Input placeholder="ex.: shadcn/ui, MDN, gist" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function SnippetCard({ snippet, onOpen, onCopiar }: { snippet: Snippet; onOpen: () => void; onCopiar: () => void }): React.ReactElement {
  const t = useTokens();
  const cor = CORES_LINGUAGEM[snippet.linguagem] || '#999';
  const preview = snippet.codigo.split('\n').slice(0, 5).join('\n');
  return (
    <div
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
        overflow: 'hidden', transition: 'all 0.18s', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)'; }}
      onClick={onOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {snippet.titulo}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, marginTop: 1 }}>
            {snippet.linguagem} · {bytesHumano(snippet.tamanhoBytes)}
          </div>
        </div>
        <Tooltip title="Copiar código">
          <Button
            type="text" size="small" icon={<Copy size={13} />}
            onClick={(e) => { e.stopPropagation(); onCopiar(); }}
          />
        </Tooltip>
      </div>
      {snippet.descricao && (
        <div style={{ padding: '0 14px', fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {snippet.descricao}
        </div>
      )}
      <pre style={{
        margin: '8px 14px 12px', padding: '8px 10px',
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6,
        fontFamily: FONTS.mono, fontSize: 10.5, color: t.textSecondary,
        lineHeight: 1.4, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis',
        maxHeight: 92,
      }}>
        {preview}
      </pre>
      {snippet.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 14px 12px' }}>
          {snippet.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{ background: t.surfaceMuted, color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 10, padding: '1px 7px', borderRadius: 999 }}>
              <Hash size={9} style={{ verticalAlign: 'text-top', marginRight: 2 }} />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
