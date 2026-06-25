import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Empty, Modal, Form, Switch, Tooltip, Popconfirm,
  Skeleton, Drawer, Segmented, Select, AutoComplete,
} from 'antd';
import {
  Plus, Search, Edit3, Trash2, Sparkles, Download, Copy, Link as LinkIcon,
  Palette, Layers, Code2, CheckCircle2, Rocket, GitBranch, Compass,
  BookOpen, Tag as TagIcon, Settings2, FileDown, Upload, FolderGit2, CopyPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, CodexSecao, CodexCard, CodexPreview } from '../types';

// ─── Registro de ícones pra seções ───────────────────────────────────────────
// Mapeia nomes kebab-case (salvos no Sheet) pra componentes lucide reais.
// Adicionar uma seção nova exige só registrar o ícone aqui se for novo.
const SECAO_ICONES: Record<string, LucideIcon> = {
  'palette': Palette,
  'layers': Layers,
  'code-2': Code2,
  'check-circle-2': CheckCircle2,
  'rocket': Rocket,
  'git-branch': GitBranch,
  'compass': Compass,
  'sparkles': Sparkles,
  'book-open': BookOpen,
  'tag': TagIcon,
};

function getSecaoIcon(nome?: string): LucideIcon {
  if (!nome) return TagIcon;
  return SECAO_ICONES[nome] || TagIcon;
}

// Projeto dono padrão (espelha o server). Cards sem projeto explícito = Forja.
const PROJETO_PADRAO = 'Forja';
const projetoDoCard = (c: CodexCard): string => (c.projeto || '').trim() || PROJETO_PADRAO;

// Ícones disponíveis pro picker de seção. 8 padrão + opções extras úteis.
const SECAO_ICONES_PICKER = Object.keys(SECAO_ICONES);

// ─── Componente Principal ────────────────────────────────────────────────────

export default function CodexPanel(): React.ReactElement {
  const t = useTokens();
  const { message, modal } = AntApp.useApp();

  const [secoes, setSecoes] = useState<CodexSecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [secaoAtivaId, setSecaoAtivaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroIa, setFiltroIa] = useState<'todos' | 'sim' | 'nao'>('todos');
  const [projetoFiltro, setProjetoFiltro] = useState<string>('todos');

  // Modais
  const [cardEditando, setCardEditando] = useState<CodexCard | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [secaoEditando, setSecaoEditando] = useState<CodexSecao | null>(null);
  const [secaoModalOpen, setSecaoModalOpen] = useState(false);

  // Preview do que vai pro prompt da IA
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<CodexPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback((opts?: { manterAtiva?: boolean }) => {
    setLoading(true);
    callServer<ServerResult>('getCodex')
      .then((r) => {
        if (r.ok && r.data) {
          const lista = r.data as CodexSecao[];
          setSecoes(lista);
          // Se nenhuma seção ativa, seleciona a primeira
          if (!opts?.manterAtiva || !secaoAtivaId) {
            if (lista.length > 0) setSecaoAtivaId(lista[0].id);
          }
        }
      })
      .catch(() => message.error('Erro ao carregar Códex'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Seção atualmente selecionada (ou primeira da lista como fallback)
  const secaoAtiva = useMemo(() => {
    return secoes.find((s) => s.id === secaoAtivaId) || secoes[0] || null;
  }, [secoes, secaoAtivaId]);

  // Todos os cards (todas as seções) — base pra derivar projetos e contagens.
  const todosCards = useMemo(() => secoes.flatMap((s) => s.cards || []), [secoes]);

  // Projetos distintos no Códex (ordenados, Forja primeiro).
  const projetos = useMemo(() => {
    const set = new Set(todosCards.map(projetoDoCard));
    const arr = Array.from(set);
    arr.sort((a, b) => (a === PROJETO_PADRAO ? -1 : b === PROJETO_PADRAO ? 1 : a.localeCompare(b)));
    return arr;
  }, [todosCards]);
  const multiProjeto = projetos.length > 1;

  // Aplica o filtro de projeto a uma lista de cards.
  const filtraProjeto = useCallback((lista: CodexCard[]) => (
    projetoFiltro === 'todos' ? lista : lista.filter((c) => projetoDoCard(c) === projetoFiltro)
  ), [projetoFiltro]);

  // Total de cards e quantos vão pra IA (respeitando o projeto selecionado).
  const stats = useMemo(() => {
    const all = filtraProjeto(todosCards);
    const naIa = all.filter((c) => (c.incluirEmIa || 'sim') !== 'nao').length;
    return { total: all.length, naIa };
  }, [todosCards, filtraProjeto]);

  // Contagem por seção respeitando o filtro de projeto (badges da lateral).
  const contagemPorSecao = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of secoes) m[s.id] = filtraProjeto(s.cards || []).length;
    return m;
  }, [secoes, filtraProjeto]);

  // Cards da seção ativa filtrados por projeto + busca + filtro IA
  const cardsFiltrados = useMemo(() => {
    if (!secaoAtiva) return [];
    let lista = filtraProjeto(secaoAtiva.cards || []);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((c) =>
        c.titulo.toLowerCase().includes(q) ||
        c.valor.toLowerCase().includes(q) ||
        (c.tags || '').toLowerCase().includes(q)
      );
    }
    if (filtroIa !== 'todos') {
      lista = lista.filter((c) => (c.incluirEmIa || 'sim') === filtroIa);
    }
    return lista;
  }, [secaoAtiva, busca, filtroIa, filtraProjeto]);

  // ─── Ações ─────────────────────────────────────────────────────────────────

  const abrirNovoCard = () => {
    if (!secaoAtiva) {
      message.warning('Crie uma seção primeiro');
      return;
    }
    setCardEditando({
      id: '', secaoId: secaoAtiva.id, titulo: '', valor: '', referencia: '',
      tags: '', incluirEmIa: 'sim', projeto: projetoFiltro === 'todos' ? PROJETO_PADRAO : projetoFiltro,
      ordem: (secaoAtiva.cards?.length || 0) + 1,
    });
    setCardModalOpen(true);
  };

  const editarCard = (c: CodexCard) => {
    setCardEditando(c);
    setCardModalOpen(true);
  };

  // Duplica um card (id zerado) — atalho pra replicar um padrão em outro
  // projeto. Abre o modal pré-preenchido pro user só trocar o projeto.
  const duplicarCard = (c: CodexCard) => {
    setCardEditando({
      ...c, id: '', titulo: c.titulo, ordem: (secaoAtiva?.cards?.length || 0) + 1,
    });
    setCardModalOpen(true);
  };

  const removerCard = (id: string) => {
    callServer<ServerResult>('deletarCodexCard', id).then((r) => {
      if (r.ok) {
        message.success('Card removido');
        carregar({ manterAtiva: true });
      } else {
        message.error(r.error || 'Erro ao remover');
      }
    });
  };

  const abrirNovaSecao = () => {
    setSecaoEditando({
      id: '', key: '', label: '', icone: 'tag', descricao: '',
      ordem: secoes.length + 1,
    });
    setSecaoModalOpen(true);
  };

  const editarSecao = (s: CodexSecao) => {
    setSecaoEditando(s);
    setSecaoModalOpen(true);
  };

  const removerSecao = (s: CodexSecao) => {
    const qtdCards = s.cards?.length || 0;
    modal.confirm({
      title: `Remover "${s.label}"?`,
      content: qtdCards > 0
        ? `Esta seção tem ${qtdCards} card${qtdCards > 1 ? 's' : ''}. Tudo será removido.`
        : 'Esta seção não tem cards. Confirma?',
      okText: 'Remover',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => {
        callServer<ServerResult>('deletarCodexSecao', s.id).then((r) => {
          if (r.ok) {
            message.success('Seção removida');
            if (secaoAtivaId === s.id) setSecaoAtivaId(null);
            carregar();
          } else {
            message.error(r.error || 'Erro ao remover');
          }
        });
      },
    });
  };

  const importarPadroesDaForja = () => {
    setImportando(true);
    callServer<ServerResult>('importarPadroesForja')
      .then((r) => {
        if (r.ok) {
          const d = r.data as { inseridos: number; total: number };
          if (d.inseridos === 0) {
            message.info('Todos os padrões da Forja já estão no seu Códex');
          } else {
            message.success(`${d.inseridos} padrão${d.inseridos > 1 ? 'ões' : ''} importado${d.inseridos > 1 ? 's' : ''}`);
          }
          carregar({ manterAtiva: true });
        } else {
          message.error(r.error || 'Erro ao importar');
        }
      })
      .finally(() => setImportando(false));
  };

  const abrirPreview = () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    callServer<ServerResult>('previewCodexContext')
      .then((r) => {
        if (r.ok) setPreview(r.data as CodexPreview);
      })
      .finally(() => setPreviewLoading(false));
  };

  const exportarJson = () => {
    const dados = secoes.map((s) => ({
      secao: s.label,
      key: s.key,
      descricao: s.descricao,
      cards: filtraProjeto(s.cards || []).map((c) => ({
        titulo: c.titulo,
        valor: c.valor,
        projeto: projetoDoCard(c),
        referencia: c.referencia,
        tags: c.tags,
        incluirEmIa: c.incluirEmIa,
      })),
    }));
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codex-forja-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Códex exportado');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 480 }}>
      {/* ─── Coluna esquerda: lista de seções ────────────────────────────── */}
      <div style={{
        borderRight: `1px solid ${t.borderSoft}`,
        padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 6px 10px',
        }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.1em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            Seções · {secoes.length}
          </span>
          <Tooltip title="Nova seção">
            <Button
              size="small"
              type="text"
              icon={<Plus size={14} />}
              onClick={abrirNovaSecao}
            />
          </Tooltip>
        </div>

        {secoes.map((s) => {
          const Ic = getSecaoIcon(s.icone);
          const active = s.id === secaoAtiva?.id;
          const qtd = contagemPorSecao[s.id] ?? 0;
          return (
            <button
              key={s.id}
              onClick={() => setSecaoAtivaId(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px',
                border: 'none', borderRadius: 9, cursor: 'pointer',
                background: active ? t.surfaceMuted : 'transparent',
                color: active ? t.text : t.textSecondary,
                fontFamily: FONTS.ui, fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.surfaceMuted; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Ic size={15} strokeWidth={1.7} color={active ? t.accents.sage : t.textTertiary} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary,
                background: active ? t.surface : 'transparent',
                padding: '1px 6px', borderRadius: 999,
                border: active ? `1px solid ${t.border}` : '1px solid transparent',
              }}>
                {qtd}
              </span>
            </button>
          );
        })}

        {/* Footer da lista: ações globais */}
        <div style={{
          marginTop: 16, padding: '12px 6px 0',
          borderTop: `1px solid ${t.borderSoft}`,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <Tooltip title="Cards opinados que refletem este próprio app (Forja).">
            <Button
              size="small"
              icon={<Upload size={13} />}
              onClick={importarPadroesDaForja}
              loading={importando}
              block
              style={{ fontSize: 12, textAlign: 'left', justifyContent: 'flex-start' }}
            >
              Importar Forja
            </Button>
          </Tooltip>
          <Tooltip title={`Preview do contexto que vai pra IA quando o toggle "Códex" estiver ativo. ${stats.naIa}/${stats.total} cards inclusos.`}>
            <Button
              size="small"
              icon={<Sparkles size={13} />}
              onClick={abrirPreview}
              block
              style={{ fontSize: 12, textAlign: 'left', justifyContent: 'flex-start' }}
            >
              Preview IA · {stats.naIa}
            </Button>
          </Tooltip>
          <Tooltip title="Baixar todo o Códex como JSON.">
            <Button
              size="small"
              icon={<FileDown size={13} />}
              onClick={exportarJson}
              block
              style={{ fontSize: 12, textAlign: 'left', justifyContent: 'flex-start' }}
            >
              Exportar JSON
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* ─── Coluna direita: conteúdo da seção ativa ─────────────────────── */}
      <div style={{ padding: '14px 18px', minWidth: 0 }}>
        {secaoAtiva ? (
          <>
            {/* Header da seção */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              marginBottom: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${t.accents.sage}12`,
                border: `1px solid ${t.accents.sage}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {React.createElement(getSecaoIcon(secaoAtiva.icone), {
                  size: 18, strokeWidth: 1.7, color: t.accents.sage,
                })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text,
                }}>
                  {secaoAtiva.label}
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
                    padding: '1px 6px', borderRadius: 999,
                    background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                  }}>
                    /{secaoAtiva.key}
                  </span>
                </div>
                {secaoAtiva.descricao && (
                  <div style={{
                    fontSize: 12, color: t.textTertiary,
                    marginTop: 2, lineHeight: 1.5,
                  }}>
                    {secaoAtiva.descricao}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Tooltip title="Editar seção">
                  <Button
                    size="small" type="text"
                    icon={<Settings2 size={14} />}
                    onClick={() => editarSecao(secaoAtiva)}
                  />
                </Tooltip>
                <Tooltip title="Remover seção">
                  <Button
                    size="small" type="text" danger
                    icon={<Trash2 size={14} />}
                    onClick={() => removerSecao(secaoAtiva)}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Toolbar: busca + filtro + botão novo */}
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
              flexWrap: 'wrap',
            }}>
              <Input
                size="middle"
                placeholder="Filtrar cards por título, valor ou tag…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                prefix={<Search size={14} color={t.textTertiary} />}
                style={{ flex: 1, minWidth: 200 }}
                allowClear
              />
              <Tooltip title="Filtrar por projeto. Cada padrão pertence a um projeto; as seções são universais.">
                <Select
                  size="middle"
                  value={projetoFiltro}
                  onChange={setProjetoFiltro}
                  style={{ minWidth: 150 }}
                  suffixIcon={<FolderGit2 size={14} color={t.textTertiary} />}
                  options={[
                    { label: `Todos os projetos${multiProjeto ? ` · ${projetos.length}` : ''}`, value: 'todos' },
                    ...projetos.map((p) => ({ label: p, value: p })),
                  ]}
                />
              </Tooltip>
              <Segmented
                value={filtroIa}
                onChange={(v) => setFiltroIa(v as 'todos' | 'sim' | 'nao')}
                options={[
                  { label: 'Todos', value: 'todos' },
                  { label: 'IA', value: 'sim' },
                  { label: 'Não-IA', value: 'nao' },
                ]}
                size="small"
              />
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={abrirNovoCard}
                size="middle"
              >
                Novo card
              </Button>
            </div>

            {/* Lista de cards */}
            {cardsFiltrados.length === 0 ? (
              <div style={{
                padding: '36px 16px', textAlign: 'center',
                border: `1px dashed ${t.borderSoft}`, borderRadius: 12,
              }}>
                {(secaoAtiva.cards?.length || 0) === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ color: t.textTertiary, fontSize: 13 }}>
                        Nenhum card ainda. Adicione padrões dessa categoria.
                      </span>
                    }
                  >
                    <Button type="primary" icon={<Plus size={13} />} onClick={abrirNovoCard}>
                      Adicionar o primeiro
                    </Button>
                  </Empty>
                ) : (
                  <span style={{ color: t.textTertiary, fontSize: 13 }}>
                    Nenhum card bate com o filtro atual.
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cardsFiltrados.map((c) => (
                  <CardItem
                    key={c.id}
                    card={c}
                    mostrarProjeto={multiProjeto}
                    onEditar={() => editarCard(c)}
                    onDuplicar={() => duplicarCard(c)}
                    onRemover={() => removerCard(c.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <Empty description="Nenhuma seção. Crie a primeira ou importe os padrões da Forja." />
        )}
      </div>

      {/* Modais */}
      <ModalCard
        open={cardModalOpen}
        card={cardEditando}
        projetosExistentes={projetos}
        onClose={() => setCardModalOpen(false)}
        onSaved={() => { setCardModalOpen(false); carregar({ manterAtiva: true }); }}
      />
      <ModalSecao
        open={secaoModalOpen}
        secao={secaoEditando}
        onClose={() => setSecaoModalOpen(false)}
        onSaved={() => { setSecaoModalOpen(false); carregar({ manterAtiva: true }); }}
      />
      <DrawerPreview
        open={previewOpen}
        loading={previewLoading}
        preview={preview}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}

// ─── Sub-componente: Card individual ─────────────────────────────────────────

function CardItem({ card, mostrarProjeto, onEditar, onDuplicar, onRemover }: {
  card: CodexCard;
  mostrarProjeto?: boolean;
  onEditar: () => void;
  onDuplicar: () => void;
  onRemover: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const tags = (card.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const naIa = (card.incluirEmIa || 'sim') !== 'nao';
  const projeto = projetoDoCard(card);

  return (
    <div style={{
      padding: '14px 16px',
      background: t.surface,
      border: `1px solid ${t.borderSoft}`,
      borderRadius: 12,
      transition: 'border 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.border; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderSoft; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: FONTS.display, fontSize: 14, fontWeight: 500, color: t.text,
            }}>
              {card.titulo}
            </span>
            {mostrarProjeto && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: 0.2,
                padding: '1px 7px', borderRadius: 999,
                background: `${t.accents.lavender}1A`, color: t.accents.lavender,
                border: `1px solid ${t.accents.lavender}33`,
              }}>
                <FolderGit2 size={10} /> {projeto}
              </span>
            )}
            {!naIa && (
              <Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>
                fora da IA
              </Tag>
            )}
          </div>
          <div style={{
            marginTop: 6,
            fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {card.valor}
          </div>
          {(tags.length > 0 || card.referencia) && (
            <div style={{
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
              flexWrap: 'wrap',
            }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  fontFamily: FONTS.mono, fontSize: 10,
                  padding: '1px 7px', borderRadius: 999,
                  background: t.surfaceMuted, color: t.textTertiary,
                  border: `1px solid ${t.borderSoft}`,
                }}>
                  {tag}
                </span>
              ))}
              {card.referencia && (
                <a
                  href={card.referencia}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11, color: t.accents.blue,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <LinkIcon size={11} /> referência
                </a>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <Tooltip title="Copiar valor">
            <Button
              size="small" type="text"
              icon={<Copy size={13} />}
              onClick={() => {
                navigator.clipboard.writeText(card.valor);
                message.success('Copiado');
              }}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" type="text" icon={<Edit3 size={13} />} onClick={onEditar} />
          </Tooltip>
          <Tooltip title="Duplicar (ex: replicar este padrão em outro projeto)">
            <Button size="small" type="text" icon={<CopyPlus size={13} />} onClick={onDuplicar} />
          </Tooltip>
          <Popconfirm
            title="Remover este card?"
            okText="Remover"
            okType="danger"
            cancelText="Cancelar"
            onConfirm={onRemover}
          >
            <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Editar/Criar Card ────────────────────────────────────────────────

function ModalCard({ open, card, projetosExistentes, onClose, onSaved }: {
  open: boolean;
  card: CodexCard | null;
  projetosExistentes: string[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open && card) {
      form.setFieldsValue({
        titulo: card.titulo,
        valor: card.valor,
        projeto: projetoDoCard(card),
        referencia: card.referencia || '',
        tags: card.tags || '',
        incluirEmIa: (card.incluirEmIa || 'sim') === 'sim',
      });
    }
  }, [open, card, form]);

  const opcoesProjeto = (projetosExistentes.length ? projetosExistentes : [PROJETO_PADRAO])
    .map((p) => ({ value: p }));

  const salvar = async (v: Record<string, unknown>) => {
    if (!card) return;
    setSalvando(true);
    try {
      const payload = {
        id: card.id || undefined,
        secaoId: card.secaoId,
        titulo: v['titulo'],
        valor: v['valor'],
        projeto: String(v['projeto'] || '').trim() || PROJETO_PADRAO,
        referencia: v['referencia'],
        tags: v['tags'],
        incluirEmIa: v['incluirEmIa'] ? 'sim' : 'nao',
        ordem: card.ordem,
      };
      const r = await callServer<ServerResult>('salvarCodexCard', payload);
      if (r.ok) {
        message.success(card.id ? 'Card atualizado' : 'Card criado');
        onSaved();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      title={card?.id ? 'Editar card' : 'Novo card do Códex'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={salvando}
      okText="Salvar"
      cancelText="Cancelar"
      width={620}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item
          name="titulo"
          label="Título"
          rules={[{ required: true, message: 'Informe o título' }]}
          tooltip="Nome curto e descritivo (ex: 'Tipografia', 'Stack Backend')"
        >
          <Input placeholder="Ex: Tipografia" autoFocus />
        </Form.Item>

        <Form.Item
          name="valor"
          label="Valor"
          rules={[{ required: true, message: 'Informe o valor' }]}
          tooltip="O conteúdo principal do padrão. Aceita markdown — seja específico, é o que a IA vai consumir."
        >
          <Input.TextArea
            rows={5}
            placeholder="Ex: Inter (UI) + Fraunces (display) + JetBrains Mono (mono/código)"
            style={{ fontFamily: 'inherit' }}
          />
        </Form.Item>

        <Form.Item
          name="projeto"
          label="Projeto"
          tooltip="A qual projeto este padrão pertence. Escolha um existente ou digite um novo (ex: 'Forja', 'App X'). As seções são universais — o projeto é o que separa os padrões de cada app."
        >
          <AutoComplete
            options={opcoesProjeto}
            placeholder="Forja"
            filterOption={(input, option) =>
              String(option?.value || '').toLowerCase().includes(input.toLowerCase())}
          >
            <Input prefix={<FolderGit2 size={13} />} />
          </AutoComplete>
        </Form.Item>

        <Form.Item
          name="referencia"
          label="Referência (opcional)"
          tooltip="URL pra docs, figma, exemplo — qualquer link de apoio"
        >
          <Input placeholder="https://…" prefix={<LinkIcon size={13} />} />
        </Form.Item>

        <Form.Item
          name="tags"
          label="Tags (opcional)"
          tooltip="Separadas por vírgula — usadas pra busca"
        >
          <Input placeholder="design, tipografia, foundation" />
        </Form.Item>

        <Form.Item
          name="incluirEmIa"
          label="Incluir na IA"
          tooltip="Se ativo, este card vai pro contexto da Forja IA quando você usar geração com Códex ativado."
          valuePropName="checked"
        >
          <Switch checkedChildren="Sim" unCheckedChildren="Não" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Modal: Editar/Criar Seção ───────────────────────────────────────────────

function ModalSecao({ open, secao, onClose, onSaved }: {
  open: boolean;
  secao: CodexSecao | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [iconeSelecionado, setIconeSelecionado] = useState('tag');

  useEffect(() => {
    if (open && secao) {
      form.setFieldsValue({
        label: secao.label,
        key: secao.key,
        descricao: secao.descricao,
        ordem: secao.ordem,
      });
      setIconeSelecionado(secao.icone || 'tag');
    }
  }, [open, secao, form]);

  const salvar = async (v: Record<string, unknown>) => {
    if (!secao) return;
    setSalvando(true);
    try {
      const payload = {
        id: secao.id || undefined,
        label: v['label'],
        key: v['key'] || v['label'],
        descricao: v['descricao'],
        ordem: v['ordem'],
        icone: iconeSelecionado,
      };
      const r = await callServer<ServerResult>('salvarCodexSecao', payload);
      if (r.ok) {
        message.success(secao.id ? 'Seção atualizada' : 'Seção criada');
        onSaved();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      title={secao?.id ? 'Editar seção' : 'Nova seção do Códex'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={salvando}
      okText="Salvar"
      cancelText="Cancelar"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item
          name="label"
          label="Nome da seção"
          rules={[{ required: true, message: 'Informe o nome' }]}
        >
          <Input placeholder="Ex: Design, Stack, Código" autoFocus />
        </Form.Item>

        <Form.Item
          name="key"
          label="Key (slug único)"
          tooltip="Identificador técnico. Deixe vazio pra gerar automático do nome."
        >
          <Input placeholder="auto-gerado se vazio" style={{ fontFamily: FONTS.mono }} />
        </Form.Item>

        <Form.Item
          name="descricao"
          label="Descrição"
        >
          <Input.TextArea rows={2} placeholder="O que essa seção representa" />
        </Form.Item>

        <Form.Item label="Ícone">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6,
            padding: 8, background: t.surfaceMuted, borderRadius: 8,
            border: `1px solid ${t.borderSoft}`,
          }}>
            {SECAO_ICONES_PICKER.map((nome) => {
              const Ic = getSecaoIcon(nome);
              const ativo = iconeSelecionado === nome;
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setIconeSelecionado(nome)}
                  title={nome}
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: ativo ? `${t.accents.sage}18` : t.surface,
                    border: ativo ? `2px solid ${t.accents.sage}` : `1px solid ${t.borderSoft}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ic size={17} strokeWidth={1.7} color={ativo ? t.accents.sage : t.textSecondary} />
                </button>
              );
            })}
          </div>
        </Form.Item>

        <Form.Item
          name="ordem"
          label="Ordem"
          tooltip="Menor número aparece primeiro na lista lateral"
        >
          <Input type="number" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Drawer: Preview do contexto IA ──────────────────────────────────────────

function DrawerPreview({ open, loading, preview, onClose }: {
  open: boolean;
  loading: boolean;
  preview: CodexPreview | null;
  onClose: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color={t.accents.sage} />
          <span>Preview do contexto IA</span>
        </div>
      }
      placement="right"
      width={620}
      open={open}
      onClose={onClose}
      extra={
        preview && !loading && (
          <Button
            size="small"
            icon={<Copy size={13} />}
            onClick={() => {
              navigator.clipboard.writeText(preview.texto);
              message.success('Copiado');
            }}
          >
            Copiar
          </Button>
        )
      }
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : preview ? (
        <>
          <div style={{
            display: 'flex', gap: 16, marginBottom: 16,
            padding: 12, background: t.surfaceMuted, borderRadius: 8,
          }}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Caracteres
              </div>
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text }}>
                {preview.caracteres.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Tokens (estimado)
              </div>
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text }}>
                ~{preview.tokens.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 12, lineHeight: 1.6,
            background: t.surface, border: `1px solid ${t.borderSoft}`,
            padding: 14, borderRadius: 8,
            whiteSpace: 'pre-wrap', color: t.textSecondary,
            maxHeight: 'calc(100vh - 280px)', overflowY: 'auto',
          }}>
            {preview.texto || <span style={{ color: t.textTertiary }}>Nenhum card marcado pra IA. Ative o toggle "Incluir na IA" em pelo menos um card.</span>}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
