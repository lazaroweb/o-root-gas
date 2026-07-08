// AgentsHubModal — v1.149.0
// Esqueleto da estação "Agents" no Atelier. Estrutura paralela a SkillsHubModal.
// Espera o user trazer o prompt com a ESTRUTURA específica dos 422 agents do
// pack pra detalharmos os campos (modelo, ferramentas, system_prompt, etc.).
// Por hora, oferece: listagem, busca, favoritar, importar avulso e drawer.
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button, Empty, Input, Spin, Tag, Tooltip, Drawer, message, Skeleton, Segmented, Progress, Dropdown, Collapse } from 'antd';
import {
  Bot, Search, Star, Copy, Download, Trash2, Sparkles, Upload as UploadIcon,
  FileText, ListChecks, BookMarked, Package, CheckCircle2, GitBranch, Workflow,
  Network, Quote, Zap, Boxes, Heart, ArrowDownWideNarrow, Folder, Wand2,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import ImportarLoteModal from './ImportarLoteModal';
import OtimizadorIAModal, { RevisaoProfundaModal } from './OtimizadorIAModal';
import RevisaoFilaModal from './RevisaoFilaModal';
import TriagemImportacaoModal, { type ItemTriagem } from './TriagemImportacaoModal';
import EstrelasQualidade from './EstrelasQualidade';
import { FiltroChip, ChipGroup, GrupoAcoes, GrupoDivisor, CommandBar } from './HubToolbar';

// v1.156.0 — segmento = prefixo da fonte antes da "/" (ex.: "contabilidade/x").
// Mesma convenção do hub de Skills; permite seções por segmento aqui também.
function fonteKey(fonte: string): string {
  if (!fonte) return 'avulsas';
  const i = fonte.indexOf('/');
  return i > 0 ? fonte.slice(0, i) : 'avulsas';
}
function fonteLabel(key: string): string {
  if (key === 'avulsas') return 'Avulsas / Importadas';
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FonteMeta { chave: string; nome: string; cor: string }

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
  // v1.150.0 — campos específicos do formato Agent.
  tipo?: string;            // "agente-autonomo" / "orquestrador" / etc.
  diretrizFinal?: string;   // 1 frase resumo (vira preview do card)
  dominios?: string[];      // áreas de expertise (### dentro de DOMÍNIOS)
  // v1.266.0 — selo "Revisada" pelo Otimizador IA do Atelier.
  revisadaIAEm?: string;
  // v1.152.0 — nota global de qualidade (0-5).
  estrelas?: number;
  estrelasMotivo?: string;
  avaliadaEm?: string;
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
  // v1.151.0 — modal de import em lote.
  const [importLoteAberto, setImportLoteAberto] = useState(false);
  // v1.262.0 — triagem pós-import avulso: categoria + estrelas do recém-criado.
  const [triagemItens, setTriagemItens] = useState<ItemTriagem[]>([]);
  // v1.265.0 — Otimizador IA (metadados em massa) + revisão profunda (conteúdo).
  const [otimizadorAberto, setOtimizadorAberto] = useState(false);
  const [revisaoProfundaAberta, setRevisaoProfundaAberta] = useState(false);
  // v1.267.0 — revisão profunda em fila (grupo-fundação/kit ou filtro por estrelas).
  const [revisaoFilaAberta, setRevisaoFilaAberta] = useState(false);
  // v1.152.0 — estrelas: filtro top, ordenação e avaliação Lume.
  const [soTop, setSoTop] = useState(false);
  const [ordenarPorEstrelas, setOrdenarPorEstrelas] = useState(false);
  const [avaliando, setAvaliando] = useState(false);
  const [avalProg, setAvalProg] = useState<{ feitas: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // v1.156.0 — seções por segmento (fonte).
  const [fontes, setFontes] = useState<FonteMeta[]>([]);
  const [openSources, setOpenSources] = useState<string[]>([]);
  const [montandoSeg, setMontandoSeg] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const [r, rf] = await Promise.all([
        callServer<ServerResult>('agentsList'),
        callServer<ServerResult>('skillFontesList'),
      ]);
      if (r.ok && r.data) setAgents(r.data as AgentSummary[]);
      if (rf.ok && rf.data) setFontes(rf.data as FonteMeta[]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  // v1.156.0 — monta o kit dos sonhos do segmento (só itens dessa seção).
  const montarKitSegmento = async (chave: string, nome: string) => {
    setMontandoSeg(chave);
    const hide = message.loading(`A Lume está montando o kit do segmento "${nome}"…`, 0);
    try {
      const r = await callServer<ServerResult>('kitMontarSegmento', chave, nome);
      if (r.ok) {
        const d = r.data as { skills: number; agents: number };
        message.success(`Kit de "${nome}": ${d.skills} skills + ${d.agents} agents. Veja na estação Kits.`);
      } else {
        message.error(r.error || 'Não consegui montar o kit do segmento');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao montar kit');
    } finally { hide(); setMontandoSeg(null); }
  };

  const filtrados = useMemo(() => {
    let lista = agents;
    if (soFavoritas) lista = lista.filter((a) => !!a.favorita);
    if (soTop) lista = lista.filter((a) => (a.estrelas || 0) >= 4);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((a) =>
        a.nome.toLowerCase().indexOf(q) >= 0 ||
        a.descricao.toLowerCase().indexOf(q) >= 0 ||
        (a.descricaoPt || '').toLowerCase().indexOf(q) >= 0 ||
        a.categoria.toLowerCase().indexOf(q) >= 0 ||
        a.tags.some((tag) => tag.toLowerCase().indexOf(q) >= 0),
      );
    }
    if (ordenarPorEstrelas) {
      lista = [...lista].sort((a, b) => (b.estrelas || 0) - (a.estrelas || 0) || (a.nome || '').localeCompare(b.nome || ''));
    }
    return lista;
  }, [agents, filtro, soFavoritas, soTop, ordenarPorEstrelas]);

  const qtdFavoritas = useMemo(() => agents.filter((a) => !!a.favorita).length, [agents]);

  // v1.262.0 — categorias já usadas na base (sugestões da triagem pós-import).
  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) {
      if ((a.categoria || '').trim()) set.add(a.categoria.trim());
    }
    return Array.from(set);
  }, [agents]);
  const qtdAvaliados = useMemo(() => agents.filter((a) => (a.estrelas || 0) > 0).length, [agents]);

  const fonteMeta = useMemo(() => {
    const m: Record<string, FonteMeta> = {};
    for (const f of fontes) m[f.chave] = f;
    return m;
  }, [fontes]);

  // v1.156.0 — agrupa agents por segmento (fonte). Seções colapsáveis.
  const grupos = useMemo(() => {
    const porFonte: Record<string, AgentSummary[]> = {};
    for (const a of filtrados) (porFonte[fonteKey(a.fonte)] = porFonte[fonteKey(a.fonte)] || []).push(a);
    const chaves = Object.keys(porFonte).sort((x, y) => {
      if (x === 'avulsas') return 1;
      if (y === 'avulsas') return -1;
      return porFonte[y].length - porFonte[x].length;
    });
    return chaves.map((k) => ({
      key: k,
      label: fonteMeta[k]?.nome || fonteLabel(k),
      cor: fonteMeta[k]?.cor || '',
      lista: porFonte[k],
    }));
  }, [filtrados, fonteMeta]);

  const activeSources = filtro.trim() ? grupos.map((g) => g.key) : openSources;

  // v1.152.0 — Avalia qualidade com a Lume (loop chunked com progresso).
  const avaliarAgents = async (opcoes?: { escopo?: 'pendentes' | 'todas' }) => {
    setAvaliando(true);
    setAvalProg(null);
    let totalFeitas = 0;
    let totalGeral = 0;
    try {
      const base = { escopo: opcoes?.escopo || 'pendentes' };
      let r = await callServer<ServerResult>('agentsAvaliar', base);
      if (!r.ok) { message.error(r.error || 'Não consegui avaliar'); return; }
      let d = r.data as { avaliadas: number; restantes: number; total: number };
      totalGeral = d.total;
      totalFeitas += d.avaliadas;
      if (totalGeral === 0) { message.info('Nada pendente pra avaliar.'); return; }
      setAvalProg({ feitas: totalFeitas, total: totalGeral });
      let restantes = d.restantes;
      let guarda = 0;
      while (restantes > 0 && guarda < 200) {
        guarda++;
        r = await callServer<ServerResult>('agentsAvaliar', base);
        if (!r.ok) { message.error(r.error || 'Erro durante avaliação'); break; }
        d = r.data as { avaliadas: number; restantes: number; total: number };
        totalFeitas += d.avaliadas;
        restantes = d.restantes;
        setAvalProg({ feitas: Math.min(totalFeitas, totalGeral), total: totalGeral });
      }
      message.success(`${totalFeitas} agent(s) avaliado(s) pela Lume.`);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao avaliar');
    } finally { setAvaliando(false); setAvalProg(null); }
  };

  const definirEstrelas = (id: string, n: number) => {
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, estrelas: n, estrelasMotivo: 'Ajuste manual' } : a));
    setAberto((prev) => prev && prev.id === id ? { ...prev, estrelas: n, estrelasMotivo: 'Ajuste manual' } : prev);
    void callServer<ServerResult>('agentsDefinirEstrelas', id, n).catch(() => { /* silent */ });
  };

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
        if (r.ok) {
          const d = r.data as { id?: string; nome?: string; descricao?: string; categoria?: string; jaExistia?: boolean; duplicatasRemovidas?: number } | undefined;
          if (d?.jaExistia) {
            message.success(`Esse agent já existia — atualizado sem duplicar${d.duplicatasRemovidas ? ` (${d.duplicatasRemovidas} cópia duplicada removida)` : ''}.`);
          } else message.success('Agent importado');
          // Triagem do recém-importado: categoria + estrelas na hora, pra não
          // sumir no meio dos agents já classificados. No upsert, só reabre
          // se o existente ainda estiver sem categoria.
          if (d?.id && (!d.jaExistia || !(d.categoria || '').trim())) {
            setTriagemItens([{ id: d.id, nome: d.nome || '', descricao: d.descricao, categoria: d.categoria }]);
          }
          void carregar();
        } else message.error(r.error || 'Falha ao importar');
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Erro');
      }
    };
    reader.readAsText(file);
  };

  const corDestaque = t.accents.blue;

  return (
    <div style={{ padding: 24 }}>
      {/* v1.150.0 — Banner "estrutura completa": o parser entende o formato
          Pack PT-BR de Agent (PROTOCOLO DE INICIALIZAÇÃO, DOMÍNIOS, WORKFLOW
          em fases, PROTOCOLO DE COMUNICAÇÃO JSON, INTEGRAÇÕES, DIRETRIZ FINAL).
          Só aparece quando a base está vazia — guia o user. */}
      {agents.length === 0 && (
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
            <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>
              Estação Agents — parser pronto pro formato Pack PT-BR
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
              O parser reconhece <strong>todos os 8 blocos</strong> do padrão Agent:
              QUANDO USAR, IDENTIDADE E EXPERTISE, PROTOCOLO DE INICIALIZAÇÃO,
              DOMÍNIOS DE CONHECIMENTO, CHECKLIST DE QUALIDADE, WORKFLOW DE
              EXECUÇÃO (com fases), PROTOCOLO DE COMUNICAÇÃO (JSON entre agentes)
              e INTEGRAÇÃO COM OUTROS AGENTES. O METADADOS captura também
              {' '}<code style={{ fontFamily: FONTS.mono }}>tipo: agente-autonomo</code>.
              Importe um <code style={{ fontFamily: FONTS.mono }}>.md</code> pra ver o render.
            </div>
          </div>
        </div>
      )}

      {/* v1.153.0 — Barra de comando repaginada (mesma linguagem do hub de Skills) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importarArquivo(f);
          e.target.value = '';
        }}
      />
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={14} color={t.textTertiary} />}
          placeholder="Filtrar por nome, descrição, categoria ou tag…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        {(qtdFavoritas > 0 || qtdAvaliados > 0) && (
          <ChipGroup>
            {qtdFavoritas > 0 && (
              <FiltroChip
                active={soFavoritas}
                onClick={() => setSoFavoritas((v) => !v)}
                accent={t.accents.peach}
                fill
                title={soFavoritas ? 'Mostrando só os favoritos — clique pra ver todos' : 'Filtrar só os favoritos (coração)'}
                label={`Favoritos ${qtdFavoritas}`}
                icon={(cor, filled) => <Heart size={14} color={cor} fill={filled ? cor : 'none'} strokeWidth={1.8} />}
              />
            )}
            {qtdAvaliados > 0 && (
              <>
                <FiltroChip
                  active={soTop}
                  onClick={() => setSoTop((v) => !v)}
                  accent={t.accents.peach}
                  fill
                  title="Mostrar só os agents com 4 ou 5 estrelas (avaliados pela Lume)."
                  label="Top 4★+"
                  icon={(cor, filled) => <Star size={14} color={cor} fill={filled ? cor : 'none'} strokeWidth={1.8} />}
                />
                <FiltroChip
                  active={ordenarPorEstrelas}
                  onClick={() => setOrdenarPorEstrelas((v) => !v)}
                  accent={t.accents.lavender}
                  title="Ordenar pela nota de qualidade (maior primeiro)."
                  label="Por nota"
                  icon={(cor) => <ArrowDownWideNarrow size={14} color={cor} strokeWidth={1.8} />}
                />
              </>
            )}
          </ChipGroup>
        )}
      </div>

      <CommandBar>
        {agents.length > 0 && (
          <GrupoAcoes label="Curadoria com a Lume" accent={t.accents.peach} icon={<Sparkles size={11} />}>
            <Tooltip title="A Lume lê nome + descrição e dá uma nota de qualidade (0-5) pra cada agent ainda sem nota. Fica guardado.">
              <Button
                icon={<Star size={14} />}
                loading={avaliando}
                onClick={() => avaliarAgents({ escopo: 'pendentes' })}
                style={{ borderColor: `${t.accents.peach}66`, color: t.accents.peach, background: `${t.accents.peach}0d` }}
              >
                {avaliando && avalProg ? `Avaliando ${avalProg.feitas}/${avalProg.total}…` : 'Avaliar com a Lume'}
              </Button>
            </Tooltip>
            <Tooltip title="A IA (modelo configurável — serviço 'Atelier' no Roteamento de IA) analisa categoria, tags, descrição e estrelas de cada agent e sugere ajustes. Você revisa tudo antes de aplicar.">
              <Button
                icon={<Wand2 size={14} />}
                onClick={() => setOtimizadorAberto(true)}
                style={{ borderColor: `${t.accents.lavender}66`, color: t.accents.lavender, background: `${t.accents.lavender}0d` }}
              >
                Otimizar com IA
              </Button>
            </Tooltip>
            <Tooltip title="A IA reescreve o CONTEÚDO completo de um grupo de agents (um kit da Lume ou filtro por estrelas + categorias), um por um. Você aprova os antes/depois antes de gravar.">
              <Button
                icon={<ListChecks size={14} />}
                onClick={() => setRevisaoFilaAberta(true)}
                style={{ borderColor: `${t.accents.clay}66`, color: t.accents.clay, background: `${t.accents.clay}0d` }}
              >
                Revisão profunda em fila
              </Button>
            </Tooltip>
          </GrupoAcoes>
        )}

        {agents.length > 0 && <GrupoDivisor />}

        <GrupoAcoes label="Biblioteca" icon={<BookMarked size={11} />}>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'md', icon: <UploadIcon size={14} />, label: 'Importar um .md (avulso)' },
                { key: 'lote', icon: <Boxes size={14} />, label: 'Importar lote (.json / .md)' },
              ],
              onClick: ({ key }) => {
                if (key === 'md') fileInputRef.current?.click();
                else if (key === 'lote') setImportLoteAberto(true);
              },
            }}
          >
            <Button icon={<UploadIcon size={14} />}>Importar ▾</Button>
          </Dropdown>
        </GrupoAcoes>
      </CommandBar>
      <div style={{ height: 14 }} />

      {/* v1.152.0 — progresso da avaliação Lume */}
      {avaliando && avalProg && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
            <Sparkles size={13} color={t.accents.peach} />
            Lume avaliando qualidade: <strong>{avalProg.feitas}</strong>/{avalProg.total}
          </div>
          <Progress
            percent={Math.round((avalProg.feitas / Math.max(avalProg.total, 1)) * 100)}
            strokeColor={t.accents.peach}
            size="small"
          />
        </div>
      )}

      <ImportarLoteModal
        aberto={importLoteAberto}
        onClose={() => setImportLoteAberto(false)}
        tipo="agents"
        rpcBulkSave="agentsBulkSave"
        onConcluido={() => { void carregar(); }}
        categoriasExistentes={categoriasExistentes}
      />

      {/* v1.262.0 — Triagem do import avulso (categoria + estrelas do novo). */}
      <TriagemImportacaoModal
        aberto={triagemItens.length > 0}
        onClose={() => setTriagemItens([])}
        tipo="agents"
        itens={triagemItens}
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.265.0 — Otimização IA em massa (metadados; sugestão → revisão → aplicar). */}
      <OtimizadorIAModal
        aberto={otimizadorAberto}
        onClose={() => setOtimizadorAberto(false)}
        tipo="agents"
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.267.0 — Revisão profunda em fila (grupo-fundação/kit ou filtro). */}
      <RevisaoFilaModal
        aberto={revisaoFilaAberta}
        onClose={() => setRevisaoFilaAberta(false)}
        tipo="agents"
        itens={agents}
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.265.0 — Revisão profunda do conteúdo do agent aberto no drawer. */}
      {aberto && (
        <RevisaoProfundaModal
          aberto={revisaoProfundaAberta}
          onClose={() => setRevisaoProfundaAberta(false)}
          tipo="agents"
          id={aberto.id}
          nome={aberto.nome}
          onAplicado={(novoConteudo) => {
            setAberto((prev) => prev ? { ...prev, conteudo: novoConteudo } : prev);
            void carregar();
          }}
        />
      )}

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
        <>
          {/* v1.153.1 — cabeçalho de resultados: dá contexto e estrutura à grade */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14, gap: 8,
          }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
              <strong style={{ color: t.text, fontFamily: FONTS.display, fontSize: 14 }}>{filtrados.length}</strong>
              {' '}{filtrados.length === 1 ? 'agent' : 'agents'}
              {filtrados.length !== agents.length && (
                <span style={{ color: t.textTertiary }}> de {agents.length}</span>
              )}
            </span>
            {qtdAvaliados > 0 && (
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={11} color={t.accents.peach} />
                {qtdAvaliados} avaliado{qtdAvaliados === 1 ? '' : 's'} pela Lume
              </span>
            )}
          </div>
          <Collapse
            bordered={false}
            activeKey={activeSources}
            onChange={(k) => setOpenSources(Array.isArray(k) ? (k as string[]) : [k as string])}
            style={{ background: 'transparent' }}
            items={grupos.map((g) => ({
              key: g.key,
              style: { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `${g.cor || corDestaque}1a`, color: g.cor || corDestaque, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {g.key === 'avulsas' ? <Folder size={15} /> : <Package size={15} />}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text }}>{g.label}</span>
                      <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>
                        {g.lista.length} {g.lista.length === 1 ? 'agent' : 'agents'}
                      </span>
                    </div>
                  </div>
                  <Tooltip title="Montar o kit dos sonhos DESTE segmento (a Lume cura as melhores skills + agents desta seção). Aparece na estação Kits.">
                    <Button
                      type="text" size="small" icon={<Sparkles size={13} />}
                      loading={montandoSeg === g.key}
                      style={{ color: t.accents.peach }}
                      onClick={(e) => { e.stopPropagation(); void montarKitSegmento(g.key, g.label); }}
                    />
                  </Tooltip>
                </div>
              ),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                  {g.lista.map((a) => (
                    <AgentCard key={a.id} agent={a} onOpen={() => abrir(a.id)} onToggleFavorita={() => toggleFavorita(a.id)} />
                  ))}
                </div>
              ),
            }))}
          />
        </>
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
                icon={<Heart size={14} color={t.accents.peach} fill={aberto.favorita ? t.accents.peach : 'none'} strokeWidth={aberto.favorita ? 1.5 : 1.8} />}
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
            <Tooltip title="A IA reescreve o conteúdo completo (clareza, estrutura, especificidade) e mostra o antes/depois — você decide se aplica.">
              <Button
                icon={<Wand2 size={14} />}
                onClick={() => setRevisaoProfundaAberta(true)}
                style={{ borderColor: `${t.accents.lavender}66`, color: t.accents.lavender }}
              >
                Revisar (IA)
              </Button>
            </Tooltip>
            <Tooltip title="Remover">
              <Button danger icon={<Trash2 size={14} />} onClick={() => apagar(aberto.id)} />
            </Tooltip>
          </div>
        )}
      >
        {carregandoAberto && <Skeleton active paragraph={{ rows: 6 }} />}
        {aberto && (
          <AgentDrawerConteudo
            agent={aberto}
            onApagar={() => apagar(aberto.id)}
            onToggleFavorita={() => {
              const id = aberto.id; const era = !!aberto.favorita;
              setAberto((prev) => prev ? { ...prev, favorita: !era } : prev);
              void toggleFavorita(id);
            }}
            onDefinirEstrelas={(n) => definirEstrelas(aberto.id, n)}
          />
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
  const acento = agent.favorita ? corFav : corBot;
  const preview = agent.diretrizFinal || agent.quandoUsar || agent.descricaoPt || agent.descricao;
  return (
    <div
      onClick={onOpen}
      style={{
        background: t.surface,
        border: `1px solid ${agent.favorita ? `${corFav}40` : t.border}`,
        borderRadius: 16, padding: 18, cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        display: 'flex', flexDirection: 'column', gap: 12, minHeight: 168,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = acento;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${t.shadowSoft || 'rgba(0,0,0,0.06)'}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = agent.favorita ? `${corFav}40` : t.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Faixa de acento sutil no topo — dá identidade sem poluir */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${acento}, ${acento}00)` }} />

      {/* Cabeçalho: avatar + nome/tipo + coração */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: `${acento}14`, border: `1px solid ${acento}26`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={19} color={acento} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600,
            color: t.text, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {agent.nome || '(sem nome)'}
          </div>
          {agent.tipo && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
              background: `${corBot}10`, color: corBot,
              fontFamily: FONTS.ui, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 999,
            }}>
              {agent.tipo}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorita(); }}
          title={agent.favorita ? 'Remover dos favoritos' : 'Marcar como favorito'}
          style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: agent.favorita ? `${corFav}14` : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${corFav}22`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = agent.favorita ? `${corFav}14` : 'transparent'; }}
        >
          <Heart size={15} color={corFav} fill={agent.favorita ? corFav : 'none'} strokeWidth={agent.favorita ? 1.5 : 1.8} />
        </button>
      </div>

      {/* Nota de qualidade da Lume (some quando 0) */}
      {(!!(agent.estrelas && agent.estrelas > 0) || !!agent.revisadaIAEm) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {!!(agent.estrelas && agent.estrelas > 0) && (
            <EstrelasQualidade valor={agent.estrelas} motivo={agent.estrelasMotivo} avaliadaEm={agent.avaliadaEm} size={12} />
          )}
          {/* v1.266.0 — selo "Revisada": passou pelo Otimizador IA do Atelier. */}
          {!!agent.revisadaIAEm && (
            <Tooltip title={`Revisado pelo Otimizador IA da Forja em ${new Date(agent.revisadaIAEm).toLocaleDateString('pt-BR')} — sai das rodadas "Ainda não revisadas".`}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontFamily: FONTS.ui, fontSize: 9.5, fontWeight: 600,
                color: t.accents.sage, background: `${t.accents.sage}1f`,
                border: `1px solid ${t.accents.sage}55`,
                borderRadius: 999, padding: '1px 7px', letterSpacing: 0.2,
              }}>
                <CheckCircle2 size={9} /> Revisado · IA
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {/* Preview — diretriz final em itálico (a "alma" do agent) */}
      {preview && (
        <p style={{
          margin: 0, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary,
          lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
          fontStyle: agent.diretrizFinal ? 'italic' : 'normal',
        }}>
          {preview}
        </p>
      )}

      {agent.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {agent.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{
              background: t.surfaceMuted, color: t.textTertiary,
              fontFamily: FONTS.ui, fontSize: 10, fontWeight: 500,
              padding: '2px 8px', borderRadius: 6,
            }}>
              {tag}
            </span>
          ))}
          {agent.tags.length > 3 && <span style={{ fontSize: 10, color: t.textTertiary, alignSelf: 'center' }}>+{agent.tags.length - 3}</span>}
        </div>
      )}

      {/* Rodapé estruturado: divisor + meta */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${t.borderSoft}`,
        fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, gap: 6,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {agent.idExterno && (
            <span style={{ fontFamily: FONTS.mono, color: corBot, fontWeight: 600 }}>{agent.idExterno}</span>
          )}
          <span>{bytesHumano(agent.tamanhoBytes)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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

// ─── v1.150.0 — Conteúdo do Drawer do Agent ───────────────────────────────
// Renderização rica dos 8 blocos do padrão Pack PT-BR para Agents:
// 1. QUANDO USAR    → peach + sparkles (preview prioritário)
// 2. IDENTIDADE     → blue + bookmark
// 3. PROTOCOLO_INIT → sage + zap (passos numerados)
// 4. DOMÍNIOS       → lavender + network (cards com sub-skills)
// 5. CHECKLIST      → sage + check
// 6. WORKFLOW       → blue + workflow (FASES como stepper visual)
// 7. PROTOCOLO_COM  → peach + quote (JSON em pre com mono)
// 8. INTEGRAÇÕES    → lavender + git-branch (chips de slugs)
// 9. DIRETRIZ_FINAL → peach + quote (epígrafe grande)
function AgentDrawerConteudo({ agent, onApagar: _onApagar, onToggleFavorita: _onToggleFavorita, onDefinirEstrelas }: {
  agent: AgentFull;
  onApagar: () => void;
  onToggleFavorita: () => void;
  onDefinirEstrelas: (n: number) => void;
}): React.ReactElement {
  const t = useTokens();
  const [view, setView] = useState<'estruturado' | 'markdown'>('estruturado');
  const corDestaque = t.accents.blue;

  const blocos = (agent.blocos || []).filter((b) => b.conteudo.trim().length > 0);
  const blocoDiretriz = blocos.find((b) => b.chave === 'diretriz_final');
  const blocosRender = blocos.filter((b) => b.chave !== 'diretriz_final' && b.chave !== 'metadados');

  // META por chave (cor + icone + descrição auxiliar).
  const META: Record<string, { cor: keyof typeof t.accents; icon: React.ReactNode; sub?: string }> = {
    quando_usar: { cor: 'peach', icon: <Sparkles size={13} />, sub: 'Gatilho de ativação' },
    identidade: { cor: 'blue', icon: <BookMarked size={13} />, sub: 'Persona e expertise' },
    protocolo_inicializacao: { cor: 'sage', icon: <Zap size={13} />, sub: 'Sequência ao ser invocado' },
    dominios: { cor: 'lavender', icon: <Network size={13} />, sub: 'Áreas de conhecimento' },
    checklist: { cor: 'sage', icon: <CheckCircle2 size={13} />, sub: 'Critérios mensuráveis' },
    workflow: { cor: 'blue', icon: <Workflow size={13} />, sub: 'Fluxo em fases' },
    protocolo_comunicacao: { cor: 'peach', icon: <Quote size={13} />, sub: 'Formato entre agentes' },
    integracoes: { cor: 'lavender', icon: <GitBranch size={13} />, sub: 'Colabora com' },
    principios: { cor: 'lavender', icon: <CheckCircle2 size={13} />, sub: 'Princípios operacionais' },
    regras: { cor: 'peach', icon: <FileText size={13} />, sub: 'Regras de execução' },
    boas_praticas: { cor: 'sage', icon: <Sparkles size={13} />, sub: 'Padrões de excelência' },
    framework: { cor: 'blue', icon: <Package size={13} />, sub: 'Formato de entrega' },
    exemplos: { cor: 'lavender', icon: <FileText size={13} />, sub: 'Casos de uso' },
    pre_execucao: { cor: 'sage', icon: <ListChecks size={13} />, sub: 'Coleta de contexto' },
    outra: { cor: 'lavender', icon: <FileText size={13} /> },
  };

  return (
    <>
      {/* Header: badges + meta linha */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        {agent.idExterno && (
          <span style={{
            background: `${corDestaque}1a`, color: corDestaque,
            border: `1px solid ${corDestaque}40`,
            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 6,
          }}>
            {agent.idExterno}
          </span>
        )}
        {/* v1.150.0 — tipo (agente-autonomo) com destaque */}
        {agent.tipo && (
          <span style={{
            background: `${t.accents.peach}1a`, color: t.accents.peach,
            border: `1px solid ${t.accents.peach}40`,
            fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Bot size={10} />{agent.tipo}
          </span>
        )}
        {agent.categoria && <Tag color="blue">{agent.categoria}</Tag>}
        {agent.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        {agent.modelo && <Tag color="purple" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{agent.modelo}</Tag>}
        {typeof agent.usos === 'number' && agent.usos > 0 && (
          <span style={{
            background: `${t.accents.peach}1a`, color: t.accents.peach,
            border: `1px solid ${t.accents.peach}40`,
            fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 6,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Sparkles size={10} />{agent.usos} {agent.usos === 1 ? 'uso' : 'usos'}
          </span>
        )}
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
          {bytesHumano(agent.tamanhoBytes)} · {relTempo(agent.atualizadoEm)}
        </span>
      </div>

      {/* v1.152.0 — nota de qualidade editável (Lume + ajuste manual) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        padding: '8px 12px', borderRadius: 10,
        background: `${t.accents.peach}0d`, border: `1px solid ${t.accents.peach}30`,
      }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={13} color={t.accents.peach} /> Qualidade:
        </span>
        <EstrelasQualidade valor={agent.estrelas || 0} editavel onChange={onDefinirEstrelas} size={18} />
        {!!(agent.estrelas && agent.estrelas > 0) && agent.estrelasMotivo && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, fontStyle: 'italic' }}>
            {agent.estrelasMotivo}
          </span>
        )}
      </div>

      {/* v1.150.0 — Diretriz Final: epígrafe grande, posicionada no topo
          como assinatura/missão do agent. Quando existe, é a "alma" dele. */}
      {(blocoDiretriz || agent.diretrizFinal) && (
        <div style={{
          background: `${t.accents.peach}0d`,
          borderLeft: `4px solid ${t.accents.peach}`,
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Quote size={12} color={t.accents.peach} />
            <span style={{
              fontFamily: FONTS.ui, fontSize: 10, fontWeight: 700, color: t.accents.peach,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Diretriz final
            </span>
          </div>
          <div style={{
            fontFamily: FONTS.display, fontSize: 15, color: t.text, lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            {agent.diretrizFinal || (blocoDiretriz?.conteudo || '').slice(0, 360)}
          </div>
        </div>
      )}

      {/* v1.150.0 — Domínios de conhecimento como chips (preview rápido) */}
      {agent.dominios && agent.dominios.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>Domínios:</span>
          {agent.dominios.map((d) => (
            <span key={d} style={{
              background: `${t.accents.lavender}1a`, color: t.accents.lavender,
              border: `1px solid ${t.accents.lavender}40`,
              fontFamily: FONTS.ui, fontSize: 11,
              padding: '2px 8px', borderRadius: 999,
            }}>
              {d}
            </span>
          ))}
        </div>
      )}

      <Segmented
        size="small"
        value={view}
        onChange={(v) => setView(v as 'estruturado' | 'markdown')}
        options={[
          { label: 'Estruturado', value: 'estruturado' },
          { label: 'Markdown raw', value: 'markdown' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {view === 'markdown' ? (
        <pre style={{
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
          borderRadius: 10, padding: 14, fontFamily: FONTS.mono,
          fontSize: 12, color: t.text, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 'calc(100vh - 460px)', overflow: 'auto', margin: 0,
        }}>
          {agent.conteudo}
        </pre>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocosRender.map((bloco, idx) => {
            const meta = META[bloco.chave] || META.outra;
            const cor = t.accents[meta.cor];
            return (
              <BlocoAgentCard
                key={`${bloco.chave}-${idx}`}
                bloco={bloco}
                cor={cor}
                icon={meta.icon}
                sub={meta.sub}
                relacionadas={bloco.chave === 'integracoes' ? agent.relacionadas : undefined}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── v1.150.0 — Card de um bloco do Agent ────────────────────────────────
// Renderização especial dependendo da chave do bloco:
// - `workflow`: detecta sub-headings "### Fase N" e mostra como stepper visual
// - `protocolo_comunicacao`: se tem ```json``` ou {} grande, syntax highlight
// - `dominios`: lista os ### como cards aninhados (cada área + bullets)
// - `integracoes`: chips com os slugs extraídos automaticamente
// - Outros: texto puro com formatação preservada
function BlocoAgentCard({ bloco, cor, icon, sub, relacionadas }: {
  bloco: { titulo: string; chave: string; conteudo: string };
  cor: string;
  icon: React.ReactNode;
  sub?: string;
  relacionadas?: string[];
}): React.ReactElement {
  const t = useTokens();

  const renderConteudo = () => {
    // 1) WORKFLOW: detecta "### Fase N — Nome" e renderiza como stepper.
    if (bloco.chave === 'workflow') {
      const matches = bloco.conteudo.match(/^###\s+(.+)$/gm) || [];
      if (matches.length >= 2) {
        const partes: Array<{ titulo: string; corpo: string }> = [];
        const regex = /^###\s+(.+)$/gm;
        let mm: RegExpExecArray | null;
        const positions: Array<{ titulo: string; inicio: number; fimH: number }> = [];
        while ((mm = regex.exec(bloco.conteudo)) !== null) {
          positions.push({ titulo: mm[1].trim(), inicio: mm.index, fimH: mm.index + mm[0].length });
        }
        for (let i = 0; i < positions.length; i++) {
          const cur = positions[i];
          const prox = positions[i + 1];
          partes.push({
            titulo: cur.titulo,
            corpo: bloco.conteudo.slice(cur.fimH, prox ? prox.inicio : undefined).trim(),
          });
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partes.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: cor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONTS.display, fontSize: 11, fontWeight: 700,
                  flexShrink: 0, marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: FONTS.display, fontSize: 12, fontWeight: 600,
                    color: t.text, marginBottom: 4,
                  }}>
                    {p.titulo}
                  </div>
                  <div style={{
                    fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {p.corpo}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }

    // 2) PROTOCOLO_COMUNICACAO: highlight de JSON
    if (bloco.chave === 'protocolo_comunicacao') {
      // Procura bloco ```json``` ou JSON solto.
      const jsonMatch = bloco.conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonInline = bloco.conteudo.match(/\{[\s\S]*\}/);
      const json = jsonMatch ? jsonMatch[1] : (jsonInline ? jsonInline[0] : '');
      const antes = json ? bloco.conteudo.split(json)[0].replace(/```(?:json)?/g, '').trim() : bloco.conteudo;
      return (
        <>
          {antes && (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
              lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap',
            }}>
              {antes}
            </div>
          )}
          {json && (
            <pre style={{
              background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
              borderRadius: 8, padding: 12, fontFamily: FONTS.mono,
              fontSize: 11.5, color: t.text, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              overflowX: 'auto',
            }}>
              {(() => {
                try { return JSON.stringify(JSON.parse(json), null, 2); }
                catch { return json.trim(); }
              })()}
            </pre>
          )}
        </>
      );
    }

    // 3) DOMÍNIOS: lista os ### como cards aninhados com bullets
    if (bloco.chave === 'dominios') {
      const matches = bloco.conteudo.match(/^###\s+(.+)$/gm) || [];
      if (matches.length >= 1) {
        const regex = /^###\s+(.+)$/gm;
        let mm: RegExpExecArray | null;
        const positions: Array<{ titulo: string; inicio: number; fimH: number }> = [];
        while ((mm = regex.exec(bloco.conteudo)) !== null) {
          positions.push({ titulo: mm[1].trim(), inicio: mm.index, fimH: mm.index + mm[0].length });
        }
        const areas = positions.map((p, i) => {
          const prox = positions[i + 1];
          return { titulo: p.titulo, corpo: bloco.conteudo.slice(p.fimH, prox ? prox.inicio : undefined).trim() };
        });
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {areas.map((a, i) => (
              <div key={i} style={{
                background: t.surface, border: `1px solid ${t.borderSoft}`,
                borderRadius: 8, padding: 12,
              }}>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 12, fontWeight: 600,
                  color: t.text, marginBottom: 6,
                }}>
                  {a.titulo}
                </div>
                <div style={{
                  fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary,
                  lineHeight: 1.55, whiteSpace: 'pre-wrap',
                }}>
                  {a.corpo}
                </div>
              </div>
            ))}
          </div>
        );
      }
    }

    // 4) INTEGRAÇÕES: mostra chips de slugs (se houver) + texto original
    if (bloco.chave === 'integracoes') {
      return (
        <>
          {relacionadas && relacionadas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {relacionadas.map((rel) => (
                <span key={rel} style={{
                  background: `${cor}1a`, color: cor,
                  border: `1px solid ${cor}40`,
                  fontFamily: FONTS.mono, fontSize: 11,
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  {rel}
                </span>
              ))}
            </div>
          )}
          <div style={{
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {bloco.conteudo}
          </div>
        </>
      );
    }

    // 5) Default: texto preservando formatação
    return (
      <div style={{
        fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary,
        lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {bloco.conteudo}
      </div>
    );
  };

  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${cor}1a`, color: cor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>
            {bloco.titulo}
          </div>
          {sub && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, marginTop: 1 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
      {renderConteudo()}
    </div>
  );
}
