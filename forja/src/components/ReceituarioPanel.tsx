import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Empty, Modal, Form, Tooltip, Popconfirm,
  Skeleton, Drawer, Select, Segmented,
} from 'antd';
import {
  Plus, Search, Edit3, Trash2, Copy, Star, StarOff, Database, BookOpen, Shield,
  Activity, Columns3, MessageSquare, Sidebar as SidebarIcon, SunMoon, Rocket,
  Package, SearchCheck, Wallet, Tag as TagIcon, Download, Workflow, Flame, Image,
  Sparkles, Box, FileCode2, RotateCcw, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, Receita } from '../types';

// ─── Registry de ícones pras receitas ────────────────────────────────────────
// Mesma estratégia do Códex: nome kebab-case → componente lucide. Permite ao
// user escolher ícone visualmente sem precisar saber importar React.
const RECEITA_ICONES: Record<string, LucideIcon> = {
  'database': Database,
  'book-open': BookOpen,
  'shield': Shield,
  'activity': Activity,
  'columns': Columns3,
  'message-square': MessageSquare,
  'sidebar': SidebarIcon,
  'sun-moon': SunMoon,
  'rocket': Rocket,
  'package': Package,
  'search-check': SearchCheck,
  'wallet': Wallet,
  'tag': TagIcon,
  'download': Download,
  'workflow': Workflow,
  'flame': Flame,
  'image': Image,
  'sparkles': Sparkles,
  'box': Box,
  'file-code-2': FileCode2,
};

const RECEITA_ICONES_PICKER = Object.keys(RECEITA_ICONES);

function getReceitaIcon(nome?: string): LucideIcon {
  if (!nome) return Box;
  return RECEITA_ICONES[nome] || Box;
}

// ─── Categorias e cores ──────────────────────────────────────────────────────
// Categorias livres mas com paleta sugerida pra cada uma. User pode digitar
// outras — usa cor neutra como fallback.
const CATEGORIAS_PADRAO = [
  { value: 'ui', label: 'UI', cor: '#A788C9' },
  { value: 'ai', label: 'IA', cor: '#E2A04A' },
  { value: 'data', label: 'Dados', cor: '#7B9B7E' },
  { value: 'finance', label: 'Finanças', cor: '#3FA679' },
  { value: 'security', label: 'Segurança', cor: '#D87F8C' },
  { value: 'monitoring', label: 'Monitoramento', cor: '#74B7B2' },
  { value: 'deploy', label: 'Deploy', cor: '#C97B5C' },
  { value: 'build', label: 'Build', cor: '#9B7BC9' },
  { value: 'integration', label: 'Integração', cor: '#4A90E2' },
  { value: 'outros', label: 'Outros', cor: '#999' },
];

const COMPLEXIDADE_META: Record<string, { label: string; cor: string }> = {
  baixa: { label: 'Baixa', cor: '#7B9B7E' },
  media: { label: 'Média', cor: '#E2A04A' },
  alta: { label: 'Alta', cor: '#D87F8C' },
};

function getCategoriaCor(cat: string): string {
  const found = CATEGORIAS_PADRAO.find((c) => c.value === cat);
  return found?.cor || '#999';
}

function getCategoriaLabel(cat: string): string {
  const found = CATEGORIAS_PADRAO.find((c) => c.value === cat);
  return found?.label || cat;
}

// ─── Render leve de markdown ─────────────────────────────────────────────────
// Não inclui dep nova (marked, react-markdown) pra economizar bundle. Faz só
// o essencial: headers, bold, code blocks, listas. Suficiente pra receituário.
function renderMarkdown(md: string): string {
  let html = md
    // Code blocks (precisa vir antes de inline code pra não conflitar)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre style="background:#1B1D21;color:#EAE7E1;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:12px;font-family:'JetBrains Mono',monospace;margin:8px 0"><code>${
        escapeHtml(code)
      }</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(126,157,196,0.12);padding:1px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.92em">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:14px 0 6px;color:inherit">$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:600;margin:18px 0 8px;color:inherit">$1</h2>')
    // H1
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:600;margin:20px 0 10px;color:inherit">$1</h1>')
    // Lista item
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0">$1</li>');

  // Wrap consecutive <li> em <ul>
  html = html.replace(/(<li[\s\S]*?<\/li>(?:\s*<li[\s\S]*?<\/li>)*)/g,
    '<ul style="margin:6px 0;padding-left:22px">$1</ul>');

  // Quebras de linha
  html = html.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ReceituarioPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [complexidadeFiltro, setComplexidadeFiltro] = useState<string>('todas');

  // Drawer de leitura (full content)
  const [aberta, setAberta] = useState<Receita | null>(null);

  // Modal de edição/criação
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Receita | null>(null);
  const [iconeSelecionado, setIconeSelecionado] = useState('box');
  const [salvando, setSalvando] = useState(false);
  const [reimportando, setReimportando] = useState(false);
  const [form] = Form.useForm();

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('getReceituario')
      .then((r) => { if (r.ok && r.data) setReceitas(r.data as Receita[]); })
      .catch(() => message.error('Erro ao carregar receituário'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Categorias presentes no dataset (pra filtro dinâmico). Aceita customs do user.
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of receitas) if (r.categoria) set.add(r.categoria);
    return Array.from(set).sort();
  }, [receitas]);

  // Receitas filtradas (busca + categoria + complexidade)
  const filtradas = useMemo(() => {
    let lista = receitas;
    if (categoriaFiltro !== 'todas') lista = lista.filter((r) => r.categoria === categoriaFiltro);
    if (complexidadeFiltro !== 'todas') lista = lista.filter((r) => (r.complexidade || 'media') === complexidadeFiltro);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((r) =>
        r.nome.toLowerCase().includes(q) ||
        r.descricao.toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q) ||
        (r.stack || '').toLowerCase().includes(q) ||
        r.conteudo.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [receitas, filtro, categoriaFiltro, complexidadeFiltro]);

  const stats = useMemo(() => ({
    total: receitas.length,
    destaques: receitas.filter((r) => r.destaque === 'sim').length,
  }), [receitas]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const abrirNova = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'ui', complexidade: 'media' });
    setIconeSelecionado('box');
    setFormOpen(true);
  };

  const abrirEditar = (r: Receita) => {
    setEditando(r);
    form.setFieldsValue({
      nome: r.nome,
      descricao: r.descricao,
      categoria: r.categoria,
      conteudo: r.conteudo,
      exemplo: r.exemplo || '',
      tags: r.tags || '',
      complexidade: r.complexidade || 'media',
      tempoEstimado: r.tempoEstimado || '',
      arquivos: r.arquivos || '',
      stack: r.stack || '',
      ordem: r.ordem,
    });
    setIconeSelecionado(r.icone || 'box');
    setFormOpen(true);
    setAberta(null);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const payload = { ...v, id: editando?.id, icone: iconeSelecionado };
      const r = await callServer<ServerResult>('salvarReceita', payload);
      if (r.ok) {
        message.success(editando ? 'Receita atualizada' : 'Receita adicionada');
        setFormOpen(false);
        carregar();
      } else {
        message.error(r.error || 'Erro');
      }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = (id: string) => {
    callServer<ServerResult>('deletarReceita', id).then((r) => {
      if (r.ok) {
        message.success('Receita removida');
        setAberta(null);
        carregar();
      } else {
        message.error(r.error || 'Erro');
      }
    });
  };

  const alternarDestaque = (id: string) => {
    callServer<ServerResult>('alternarDestaqueReceita', id).then((r) => {
      if (r.ok) carregar();
    });
  };

  const reimportar = () => {
    setReimportando(true);
    callServer<ServerResult>('reimportarReceitasForja')
      .then((r) => {
        if (r.ok) {
          message.success('Receituário do Forja atualizado');
          carregar();
        } else {
          message.error(r.error || 'Erro');
        }
      })
      .finally(() => setReimportando(false));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>;
  }

  return (
    <div style={{ padding: '14px 22px 22px' }}>
      {/* Header com stats + ações globais */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.08em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            <strong style={{ color: t.textSecondary }}>{stats.total}</strong> receita{stats.total !== 1 ? 's' : ''}
            {stats.destaques > 0 && <> · <strong style={{ color: t.accents.peach }}>{stats.destaques}</strong> em destaque</>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip title="Re-popula com as receitas atualizadas da Forja. Idempotente — só adiciona as que faltam, não duplica.">
            <Button
              size="small"
              icon={<RotateCcw size={13} />}
              loading={reimportando}
              onClick={reimportar}
            >
              Sincronizar Forja
            </Button>
          </Tooltip>
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Nova receita</Button>
        </div>
      </div>

      {/* Toolbar filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por nome, descrição, tag, stack ou conteúdo…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="Categoria"
          value={categoriaFiltro}
          onChange={setCategoriaFiltro}
          style={{ minWidth: 150 }}
          options={[
            { value: 'todas', label: 'Todas categorias' },
            ...categoriasDisponiveis.map((c) => ({ value: c, label: getCategoriaLabel(c) })),
          ]}
        />
        <Segmented
          value={complexidadeFiltro}
          onChange={(v) => setComplexidadeFiltro(String(v))}
          options={[
            { value: 'todas', label: 'Tudo' },
            { value: 'baixa', label: 'Baixa' },
            { value: 'media', label: 'Média' },
            { value: 'alta', label: 'Alta' },
          ]}
          size="middle"
        />
      </div>

      {/* Lista de receitas em grid */}
      {filtradas.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            receitas.length === 0
              ? <span style={{ color: t.textTertiary }}>Nenhuma receita ainda. Clique em "Sincronizar Forja" pra importar as ~18 padrão.</span>
              : <span style={{ color: t.textTertiary }}>Nenhuma receita bate com os filtros.</span>
          }
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))',
          gap: 12,
        }}>
          {filtradas.map((r) => (
            <ReceitaCard
              key={r.id}
              receita={r}
              onAbrir={() => setAberta(r)}
              onDestaque={() => alternarDestaque(r.id)}
            />
          ))}
        </div>
      )}

      {/* Drawer de leitura */}
      <DrawerReceita
        receita={aberta}
        onClose={() => setAberta(null)}
        onEditar={() => aberta && abrirEditar(aberta)}
        onRemover={(id) => remover(id)}
        onCopiar={(texto) => {
          navigator.clipboard.writeText(texto);
          message.success('Copiado');
        }}
      />

      {/* Modal de edição/criação */}
      <Modal
        title={editando ? `Editar: ${editando.nome}` : 'Nova receita'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={salvar}
        confirmLoading={salvando}
        okText="Salvar"
        cancelText="Cancelar"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Informe o nome' }]}>
            <Input placeholder="Ex: Kanban Drawer" autoFocus />
          </Form.Item>

          <Form.Item name="descricao" label="Descrição curta (1-2 frases)">
            <Input placeholder="O que faz, em uma linha." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="categoria" label="Categoria">
              <Select options={CATEGORIAS_PADRAO} />
            </Form.Item>
            <Form.Item name="complexidade" label="Complexidade">
              <Select options={[
                { value: 'baixa', label: 'Baixa' },
                { value: 'media', label: 'Média' },
                { value: 'alta', label: 'Alta' },
              ]} />
            </Form.Item>
            <Form.Item name="tempoEstimado" label="Tempo estimado">
              <Input placeholder="2-3h" />
            </Form.Item>
          </div>

          <Form.Item label="Ícone" tooltip="Mesma família de ícones outline da sidebar">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6,
              padding: 8, background: t.surfaceMuted, borderRadius: 8,
              border: `1px solid ${t.borderSoft}`, maxHeight: 140, overflowY: 'auto',
            }}>
              {RECEITA_ICONES_PICKER.map((nome) => {
                const Ic = getReceitaIcon(nome);
                const ativo = iconeSelecionado === nome;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setIconeSelecionado(nome)}
                    title={nome}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: ativo ? `${t.accents.peach}20` : t.surface,
                      border: ativo ? `2px solid ${t.accents.peach}` : `1px solid ${t.borderSoft}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ic size={17} strokeWidth={1.6} color={ativo ? t.accents.peach : t.textSecondary} />
                  </button>
                );
              })}
            </div>
          </Form.Item>

          <Form.Item name="tags" label="Tags (CSV)" tooltip="Vírgulas separam: ex: 'kanban,backlog,decisao'">
            <Input placeholder="kanban, backlog" />
          </Form.Item>

          <Form.Item name="stack" label="Stack compatível (CSV)">
            <Input placeholder="react, typescript, gas" />
          </Form.Item>

          <Form.Item name="arquivos" label="Arquivos relacionados (opcional)" tooltip="Caminhos dos arquivos no projeto-fonte — ajuda achar a implementação original">
            <Input placeholder="src/components/BacklogDrawer.tsx" />
          </Form.Item>

          <Form.Item
            name="conteudo"
            label="Conteúdo (markdown)"
            tooltip="Suporta headers ## ###, **bold**, `code`, ```code blocks```, listas com -"
          >
            <Input.TextArea
              rows={10}
              placeholder="## Como funciona&#10;&#10;Descreva passo-a-passo...&#10;&#10;## Pontos de atenção&#10;&#10;- Item 1&#10;- Item 2"
              style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}
            />
          </Form.Item>

          <Form.Item
            name="exemplo"
            label="Exemplo (markdown)"
            tooltip="Um exemplo concreto — normalmente um trecho de código — que mostra exatamente o que a receita faz. Aparece destacado no drawer."
          >
            <Input.TextArea
              rows={8}
              placeholder="### Uso típico&#10;&#10;```tsx&#10;<SubNav items={NAV} value={view} onChange={setView}>&#10;  {view === 'a' && <PainelA />}&#10;</SubNav>&#10;```"
              style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function ReceitaCard({ receita, onAbrir, onDestaque }: {
  receita: Receita;
  onAbrir: () => void;
  onDestaque: () => void;
}): React.ReactElement {
  const t = useTokens();
  const Ic = getReceitaIcon(receita.icone);
  const corCat = getCategoriaCor(receita.categoria);
  const complex = COMPLEXIDADE_META[receita.complexidade || 'media'];
  const ehDestaque = receita.destaque === 'sim';
  const tags = (receita.tags || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);

  return (
    <div
      onClick={onAbrir}
      style={{
        background: t.surface,
        border: `1px solid ${ehDestaque ? `${t.accents.peach}55` : t.borderSoft}`,
        borderLeft: ehDestaque ? `3px solid ${t.accents.peach}` : `1px solid ${t.borderSoft}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border 0.15s, box-shadow 0.15s, transform 0.12s',
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 156,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = ehDestaque ? `${t.accents.peach}88` : t.border;
        e.currentTarget.style.boxShadow = t.shadowSoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = ehDestaque ? `${t.accents.peach}55` : t.borderSoft;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top: ícone + título + star */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${corCat}15`, border: `1px solid ${corCat}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Ic size={17} strokeWidth={1.7} color={corCat} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 14, fontWeight: 500,
            color: t.text, lineHeight: 1.3,
          }}>
            {receita.nome}
          </div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
          }}>
            {getCategoriaLabel(receita.categoria)}
          </div>
        </div>
        <Tooltip title={ehDestaque ? 'Remover do destaque' : 'Fixar como destaque'}>
          <button
            onClick={(e) => { e.stopPropagation(); onDestaque(); }}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: 4, borderRadius: 6, display: 'flex',
              color: ehDestaque ? t.accents.peach : t.textTertiary,
            }}
          >
            {ehDestaque ? <Star size={14} fill={t.accents.peach} /> : <StarOff size={14} />}
          </button>
        </Tooltip>
      </div>

      {/* Descrição */}
      <div style={{
        fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5,
        flex: 1,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }}>
        {receita.descricao}
      </div>

      {/* Footer: complexidade + tempo + tags */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        flexWrap: 'wrap', marginTop: 'auto',
        paddingTop: 8, borderTop: `1px solid ${t.borderSoft}`,
      }}>
        {complex && (
          <Tag color="default" style={{
            margin: 0, fontSize: 10, padding: '0 6px',
            background: `${complex.cor}18`, color: complex.cor, border: `1px solid ${complex.cor}44`,
          }}>
            {complex.label}
          </Tag>
        )}
        {receita.tempoEstimado && (
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
          }}>
            ~{receita.tempoEstimado}
          </span>
        )}
        {tags.length > 0 && (
          <span style={{
            fontFamily: FONTS.mono, fontSize: 9.5, color: t.textTertiary,
            marginLeft: 'auto',
          }}>
            {tags.join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

function DrawerReceita({ receita, onClose, onEditar, onRemover, onCopiar }: {
  receita: Receita | null;
  onClose: () => void;
  onEditar: () => void;
  onRemover: (id: string) => void;
  onCopiar: (texto: string) => void;
}): React.ReactElement {
  const t = useTokens();
  if (!receita) return <Drawer open={false} onClose={onClose} title={null} />;

  const Ic = getReceitaIcon(receita.icone);
  const corCat = getCategoriaCor(receita.categoria);
  const complex = COMPLEXIDADE_META[receita.complexidade || 'media'];
  const stacks = (receita.stack || '').split(',').map((x) => x.trim()).filter(Boolean);
  const tags = (receita.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const arquivos = (receita.arquivos || '').split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <Drawer
      placement="right"
      width={Math.min(820, window.innerWidth - 60)}
      open={true}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: `${corCat}18`, border: `1px solid ${corCat}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ic size={17} strokeWidth={1.7} color={corCat} />
          </div>
          <div>
            <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text }}>
              {receita.nome}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
            }}>
              {getCategoriaLabel(receita.categoria)}
              {complex && <> · {complex.label}</>}
              {receita.tempoEstimado && <> · ~{receita.tempoEstimado}</>}
            </div>
          </div>
        </div>
      }
      extra={
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Copiar markdown completo">
            <Button size="small" icon={<Copy size={13} />} onClick={() => onCopiar(receita.conteudo)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<Edit3 size={13} />} onClick={onEditar} />
          </Tooltip>
          <Popconfirm title="Remover esta receita?" okText="Remover" okType="danger" cancelText="Cancelar" onConfirm={() => onRemover(receita.id)}>
            <Tooltip title="Remover">
              <Button size="small" danger icon={<Trash2 size={13} />} />
            </Tooltip>
          </Popconfirm>
        </div>
      }
    >
      {/* Descrição */}
      {receita.descricao && (
        <div style={{
          fontSize: 13.5, color: t.textSecondary, marginBottom: 16,
          lineHeight: 1.55,
          padding: 12, background: t.surfaceMuted, borderRadius: 8,
          border: `1px solid ${t.borderSoft}`,
        }}>
          {receita.descricao}
        </div>
      )}

      {/* Meta block */}
      {(stacks.length > 0 || tags.length > 0 || arquivos.length > 0) && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stacks.length > 0 && (
            <MetaRow label="Stack" items={stacks} cor={t.accents.blue} />
          )}
          {tags.length > 0 && (
            <MetaRow label="Tags" items={tags} cor={t.accents.lavender} />
          )}
          {arquivos.length > 0 && (
            <MetaRow label="Arquivos" items={arquivos} cor={t.accents.sage} mono />
          )}
        </div>
      )}

      {/* Conteúdo renderizado */}
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 8,
        }}>
          <ChevronRight size={11} /> Receita
        </div>
        <div
          style={{
            fontFamily: FONTS.ui, fontSize: 13.5, color: t.text,
            lineHeight: 1.65,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(receita.conteudo) }}
        />
      </div>

      {/* Exemplo concreto — destacado pra mostrar exatamente o que a receita faz */}
      {receita.exemplo && receita.exemplo.trim() && (
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          background: `${t.accents.sage}0e`,
          border: `1px solid ${t.accents.sage}33`,
          borderRadius: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: FONTS.mono, fontSize: 10.5, color: t.accents.sage,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 8, fontWeight: 600,
          }}>
            <Sparkles size={12} /> Exemplo
          </div>
          <div
            style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(receita.exemplo) }}
          />
        </div>
      )}
    </Drawer>
  );
}

function MetaRow({ label, items, cor, mono }: {
  label: string; items: string[]; cor: string; mono?: boolean;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
        textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 60,
      }}>
        {label}
      </span>
      {items.map((it) => (
        <span key={it} style={{
          fontFamily: mono ? FONTS.mono : FONTS.ui,
          fontSize: mono ? 11 : 11.5,
          padding: '2px 8px', borderRadius: 999,
          background: `${cor}12`, color: cor, border: `1px solid ${cor}33`,
        }}>
          {it}
        </span>
      ))}
    </div>
  );
}
