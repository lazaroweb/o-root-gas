// AgentsHubModal — v1.149.0
// Esqueleto da estação "Agents" no Atelier. Estrutura paralela a SkillsHubModal.
// Espera o user trazer o prompt com a ESTRUTURA específica dos 422 agents do
// pack pra detalharmos os campos (modelo, ferramentas, system_prompt, etc.).
// Por hora, oferece: listagem, busca, favoritar, importar avulso e drawer.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Spin, Tag, Tooltip, Drawer, message, Skeleton } from 'antd';
import {
  Bot, Plus, Search, Star, Copy, Download, Trash2, Sparkles, Upload as UploadIcon,
  FileText, Hourglass,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface AgentSummary {
  id: string;
  nome: string;
  descricao: string;
  descricaoPt?: string;
  categoria: string;
  tags: string[];
  fonte: string;
  tamanhoBytes: number;
  criadoEm: string;
  atualizadoEm: string;
  favorita?: boolean;
  favoritadaEm?: string;
  slug?: string;
  idExterno?: string;
  usos?: number;
  relacionadas?: string[];
  quandoUsar?: string;
  modelo?: string;
  ferramentas?: string[];
}

interface AgentFull extends AgentSummary {
  conteudo: string;
  identidadePapel?: string;
  blocos?: Array<{ titulo: string; chave: string; conteudo: string }>;
  meta?: Record<string, unknown> | null;
}

function bytesHumano(b: number): string {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function relTempo(iso: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  const dif = Date.now() - dt.getTime();
  const min = Math.floor(dif / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return dt.toLocaleDateString('pt-BR');
}

interface Props {
  embedded?: boolean;
}

export default function AgentsHubModal({ embedded: _embedded }: Props): React.ReactElement {
  const t = useTokens();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [soFavoritas, setSoFavoritas] = useState(false);
  const [aberto, setAberto] = useState<AgentFull | null>(null);
  const [carregandoAberto, setCarregandoAberto] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await callServer<ServerResult>('agentsList');
      if (r.ok && r.data) setAgents(r.data as AgentSummary[]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const filtrados = useMemo(() => {
    let lista = agents;
    if (soFavoritas) lista = lista.filter((a) => !!a.favorita);
    if (!filtro.trim()) return lista;
    const q = filtro.toLowerCase();
    return lista.filter((a) =>
      a.nome.toLowerCase().indexOf(q) >= 0 ||
      a.descricao.toLowerCase().indexOf(q) >= 0 ||
      (a.descricaoPt || '').toLowerCase().indexOf(q) >= 0 ||
      a.categoria.toLowerCase().indexOf(q) >= 0 ||
      a.tags.some((tag) => tag.toLowerCase().indexOf(q) >= 0),
    );
  }, [agents, filtro, soFavoritas]);

  const qtdFavoritas = useMemo(() => agents.filter((a) => !!a.favorita).length, [agents]);

  const toggleFavorita = async (id: string) => {
    const alvo = agents.find((a) => a.id === id);
    if (!alvo) return;
    const era = !!alvo.favorita;
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, favorita: !era, favoritadaEm: era ? '' : new Date().toISOString() } : a));
    try {
      const r = await callServer<ServerResult>('agentsToggleFavorita', id);
      if (!r || !r.ok) {
        setAgents((prev) => prev.map((a) => a.id === id ? { ...a, favorita: era } : a));
        message.error((r && r.error) || 'Não foi possível alterar o favorito.');
      }
    } catch (e) {
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, favorita: era } : a));
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const abrir = async (id: string) => {
    setCarregandoAberto(true);
    try {
      const r = await callServer<ServerResult>('agentsGetContent', id);
      if (r.ok && r.data) setAberto(r.data as AgentFull);
      else message.error((r && r.error) || 'Não foi possível abrir o agent');
    } finally {
      setCarregandoAberto(false);
    }
  };

  const apagar = async (id: string) => {
    try {
      const r = await callServer<ServerResult>('agentsDelete', id);
      if (r.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
        setAberto(null);
        message.success('Agent removido');
      } else {
        message.error(r.error || 'Não foi possível remover');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const importarArquivo = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const conteudo = String(e.target?.result || '');
      if (!conteudo.trim()) { message.error('Arquivo vazio'); return; }
      try {
        const r = await callServer<ServerResult>('agentsSave', { conteudo, fonte: file.name });
        if (r.ok) { message.success('Agent importado'); void carregar(); }
        else message.error(r.error || 'Falha ao importar');
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Erro');
      }
    };
    reader.readAsText(file);
  };

  const corDestaque = t.accents.blue;

  return (
    <div style={{ padding: 24 }}>
      {/* Banner "esperando estrutura" — sinaliza ao user que essa área tá pronta
          pra receber os 422 agents, e que campos específicos vão ser detalhados
          quando ele mandar o prompt com a estrutura. */}
      <div style={{
        background: `${corDestaque}0d`, border: `1px solid ${corDestaque}40`,
        borderRadius: 12, padding: 16, marginBottom: 20,
        display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${corDestaque}1a`, color: corDestaque,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Estação Agents — pronta pra receber seus 422 agents
            <span style={{
              background: `${corDestaque}1a`, color: corDestaque,
              fontFamily: FONTS.ui, fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Hourglass size={9} />ESPERANDO ESTRUTURA
            </span>
          </div>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginTop: 6, lineHeight: 1.55,
          }}>
            A tabela de Agents tá criada no banco com os mesmos campos ricos das Skills
            (slug, id externo, usos, favoritar, blocos estruturados) + 3 campos extras
            específicos de agent (<code style={{ fontFamily: FONTS.mono }}>modelo</code>,{' '}
            <code style={{ fontFamily: FONTS.mono }}>ferramentas</code>,{' '}
            <code style={{ fontFamily: FONTS.mono }}>metaJson</code>).
            Quando você mandar o prompt com a <strong>estrutura padrão de agent</strong>,
            eu adapto o parser e os campos extras pra capturar tudo sem perder informação.
            Por hora, dá pra importar arquivos avulsos pra testar o fluxo.
          </div>
        </div>
      </div>

      {/* Barra de ações */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Filtrar por nome, descrição, categoria ou tag…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        {qtdFavoritas > 0 && (
          <Tooltip title={soFavoritas ? `Mostrando só as ${qtdFavoritas} favorita(s) — clique pra ver todos` : `Filtrar pelos ${qtdFavoritas} agent(s) marcado(s) como favorito`}>
            <Button
              icon={<Star size={14} fill={soFavoritas ? t.accents.peach : 'none'} color={t.accents.peach} strokeWidth={soFavoritas ? 1.5 : 1.8} />}
              onClick={() => setSoFavoritas((v) => !v)}
              style={soFavoritas ? { borderColor: t.accents.peach, color: t.accents.peach, background: `${t.accents.peach}0d` } : undefined}
            >
              Favoritas ({qtdFavoritas})
            </Button>
          </Tooltip>
        )}
        <label>
          <Button icon={<UploadIcon size={14} />}>
            Importar .md
            <input
              type="file"
              accept=".md,.markdown,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarArquivo(f);
                e.target.value = '';
              }}
            />
          </Button>
        </label>
      </div>

      {/* Lista */}
      {loading && agents.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : filtrados.length === 0 ? (
        <Empty
          image={<Bot size={48} color={t.textTertiary} style={{ display: 'block', margin: '0 auto' }} />}
          description={
            <div style={{ fontFamily: FONTS.ui, color: t.textSecondary }}>
              {agents.length === 0
                ? <>Nenhum agent ainda. Importe um <code style={{ fontFamily: FONTS.mono }}>.md</code> pra testar — ou aguarde a estrutura do pack pra trazer os 422 de uma vez.</>
                : 'Nenhum agent bate com o filtro.'}
            </div>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtrados.map((a) => (
            <AgentCard key={a.id} agent={a} onOpen={() => abrir(a.id)} onToggleFavorita={() => toggleFavorita(a.id)} />
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={!!aberto || carregandoAberto}
        onClose={() => setAberto(null)}
        width={680}
        title={aberto ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} color={corDestaque} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberto.nome}</span>
          </span>
        ) : 'Carregando…'}
        extra={aberto && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip title={aberto.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}>
              <Button
                icon={<Star size={14} color={t.accents.peach} fill={aberto.favorita ? t.accents.peach : 'none'} strokeWidth={aberto.favorita ? 1.5 : 1.8} />}
                onClick={() => {
                  const id = aberto.id; const era = !!aberto.favorita;
                  setAberto((prev) => prev ? { ...prev, favorita: !era } : prev);
                  void toggleFavorita(id);
                }}
                style={aberto.favorita ? { borderColor: t.accents.peach, color: t.accents.peach, background: `${t.accents.peach}0d` } : undefined}
              />
            </Tooltip>
            <Tooltip title="Copiar conteúdo">
              <Button icon={<Copy size={14} />} onClick={() => { void navigator.clipboard.writeText(aberto.conteudo); message.success('Copiado'); }} />
            </Tooltip>
            <Tooltip title="Baixar .md">
              <Button icon={<Download size={14} />} onClick={() => {
                const blob = new Blob([aberto.conteudo], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${aberto.slug || 'agent'}.md`;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }} />
            </Tooltip>
            <Tooltip title="Remover">
              <Button danger icon={<Trash2 size={14} />} onClick={() => apagar(aberto.id)} />
            </Tooltip>
          </div>
        )}
      >
        {carregandoAberto && <Skeleton active paragraph={{ rows: 6 }} />}
        {aberto && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {aberto.idExterno && (
                <span style={{
                  background: `${corDestaque}1a`, color: corDestaque,
                  border: `1px solid ${corDestaque}40`,
                  fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {aberto.idExterno}
                </span>
              )}
              {aberto.categoria && <Tag color="blue">{aberto.categoria}</Tag>}
              {aberto.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              {aberto.modelo && <Tag color="purple" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{aberto.modelo}</Tag>}
              <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
                {bytesHumano(aberto.tamanhoBytes)} · {relTempo(aberto.atualizadoEm)}
              </span>
            </div>

            {aberto.descricao && (
              <p style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.65, marginTop: 0 }}>
                {aberto.descricao}
              </p>
            )}

            {/* Blocos estruturados (reusa visual do SkillBlocosRender — mas inline aqui pra não acoplar) */}
            {aberto.blocos && aberto.blocos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {aberto.blocos.filter((b) => b.conteudo.trim()).map((bloco, idx) => (
                  <div key={`${bloco.chave}-${idx}`} style={{
                    background: t.surface, border: `1px solid ${t.border}`,
                    borderLeft: `3px solid ${corDestaque}`,
                    borderRadius: 10, padding: 14,
                  }}>
                    <div style={{
                      fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text,
                      marginBottom: 8,
                    }}>
                      {bloco.titulo}
                    </div>
                    <div style={{
                      fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.65,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {bloco.conteudo}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{
                background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                borderRadius: 10, padding: 14, fontFamily: FONTS.mono,
                fontSize: 12, color: t.text, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 'calc(100vh - 360px)', overflow: 'auto',
              }}>
                {aberto.conteudo}
              </pre>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

// ─── Card de um agent ───────────────────────────────────────────────────────
function AgentCard({ agent, onOpen, onToggleFavorita }: {
  agent: AgentSummary;
  onOpen: () => void;
  onToggleFavorita: () => void;
}): React.ReactElement {
  const t = useTokens();
  const corFav = t.accents.peach;
  const corBot = t.accents.blue;
  return (
    <div
      onClick={onOpen}
      style={{
        background: agent.favorita ? `${corFav}06` : t.surface,
        border: `1.5px solid ${agent.favorita ? `${corFav}55` : t.border}`,
        borderRadius: 12, padding: 14, cursor: 'pointer',
        transition: 'all 0.18s',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = agent.favorita ? corFav : corBot;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = `0 4px 14px ${t.shadowSoft || 'rgba(0,0,0,0.05)'}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = agent.favorita ? `${corFav}55` : t.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorita(); }}
        title={agent.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 28, height: 28, borderRadius: 8,
          background: agent.favorita ? `${corFav}1a` : 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Star size={14} color={corFav} fill={agent.favorita ? corFav : 'none'} strokeWidth={agent.favorita ? 1.5 : 1.8} />
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 32 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: agent.favorita ? `${corFav}1a` : `${corBot}1a`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={15} color={agent.favorita ? corFav : corBot} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 14, fontWeight: 600,
            color: t.text, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {agent.nome || '(sem nome)'}
          </div>
        </div>
      </div>
      {(agent.quandoUsar || agent.descricaoPt || agent.descricao) && (
        <p style={{
          margin: 0, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
        }}>
          {agent.quandoUsar || agent.descricaoPt || agent.descricao}
        </p>
      )}
      {agent.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
          {agent.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{
              background: t.surfaceMuted, color: t.textTertiary,
              fontFamily: FONTS.ui, fontSize: 10,
              padding: '1px 7px', borderRadius: 999,
            }}>
              {tag}
            </span>
          ))}
          {agent.tags.length > 4 && <span style={{ fontSize: 10, color: t.textTertiary }}>+{agent.tags.length - 4}</span>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {agent.idExterno && (
            <span style={{ fontFamily: FONTS.mono, color: corBot, fontWeight: 600 }}>
              {agent.idExterno}
            </span>
          )}
          <span>{bytesHumano(agent.tamanhoBytes)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {typeof agent.usos === 'number' && agent.usos > 0 && (
            <span style={{ fontFamily: FONTS.ui, fontWeight: 600, color: corFav, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Sparkles size={9} />{agent.usos}
            </span>
          )}
          <span>{relTempo(agent.atualizadoEm)}</span>
        </span>
      </div>
    </div>
  );
}
