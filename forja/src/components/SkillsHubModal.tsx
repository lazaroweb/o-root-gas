import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal, Button, Input, Tag, App as AntApp, Empty, Spin, Tooltip, Drawer, Upload,
  Popconfirm, Tabs, Form, Skeleton, Segmented, Collapse, Dropdown, Checkbox, Progress,
} from 'antd';
import {
  BookMarked, Plus, Upload as UploadIcon, Copy, Trash2, Download, Search, Tag as TagIcon,
  ExternalLink, Sparkles, Eye, FileText, Save, X, FolderOpen, Folder, FolderPlus, Pencil,
  FolderInput, Palette, Check, CheckCircle2, Info, Languages, Package, Archive, ListChecks,
  Star, Boxes, Heart, ArrowDownWideNarrow, Wand2, FolderDown,
} from 'lucide-react';
import { criarZipBlob, baixarBlob, type ZipEntry } from '../zip';
import ModeloBadge from './ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import { GAS_APP_KIT_SKILLS } from '../data/gasAppKitSkills';
import ComoUsarSkill from './ComoUsarSkill';
import ImportarLoteModal from './ImportarLoteModal';
import OtimizadorIAModal, { RevisaoProfundaModal } from './OtimizadorIAModal';
import RevisaoFilaModal from './RevisaoFilaModal';
import InstrucoesIDEWidget from './InstrucoesIDEWidget';
import TriagemImportacaoModal, { type ItemTriagem } from './TriagemImportacaoModal';
import EstrelasQualidade from './EstrelasQualidade';
import { FiltroChip, ChipGroup, GrupoAcoes, GrupoDivisor, CommandBar } from './HubToolbar';

interface SkillSummary {
  id: string;
  nome: string;
  descricao: string;
  descricaoPt?: string;
  tipoIA?: string;
  categoria: string;
  tags: string[];
  fonte: string;
  tamanhoBytes: number;
  criadoEm: string;
  atualizadoEm: string;
  favorita?: boolean;
  favoritadaEm?: string;
  // v1.149.0 — campos ricos vindos do parser (Pack PT-BR ou Claude SKILL.md).
  slug?: string;
  idExterno?: string;   // "#0237"
  usos?: number;
  relacionadas?: string[];
  quandoUsar?: string;
  // v1.152.0 — nota global de qualidade (0-5) dada pela Lume.
  estrelas?: number;
  estrelasMotivo?: string;
  avaliadaEm?: string;
  // v1.266.0 — selo "Revisada" pelo Otimizador IA do Atelier.
  revisadaIAEm?: string;
}

// ─── Fontes (pastas) ──────────────────────────────────────────────────────────
// A `fonte` segue a convenção "<pack>/<skill>" (ex.: "gas-app-kit/review-bugbot").
// Skills sem "/" (uploads avulsos) caem em "avulsas". Assim, ao importar novos
// packs no futuro, cada um vira sua própria pasta automaticamente.
const FONTE_META: Record<string, { label: string }> = {
  'gas-app-kit': { label: 'GAS App Kit' },
  avulsas: { label: 'Avulsas / Importadas' },
};
function fonteKey(fonte: string): string {
  if (!fonte) return 'avulsas';
  const i = fonte.indexOf('/');
  return i > 0 ? fonte.slice(0, i) : 'avulsas';
}
function fonteLabel(key: string): string {
  if (FONTE_META[key]) return FONTE_META[key].label;
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SkillFonte {
  id: string;
  chave: string;
  nome: string;
  descricao: string;
  cor: string;
}

interface Traducao { conteudo: string; descricao: string; idioma?: string; em?: string }

// v1.268.6 — cache de sessão da lista (module-level: vive enquanto a página
// está aberta). Evita refetch de ~1000 skills a cada troca de estação.
let _cacheSkillsHub: { skills: SkillSummary[]; fontes: SkillFonte[] } | null = null;

// v1.149.0 — Bloco estruturado extraído do markdown (uma seção H2 do conteúdo).
// `chave` é canonical (quando_usar, identidade, pre_execucao, principios, regras,
// boas_praticas, framework, checklist, metadados, exemplos, antipadroes, outra).
// `titulo` preserva o texto original do heading pra renderizar fiel.
export interface SkillBloco { titulo: string; chave: string; conteudo: string }

interface SkillFull extends SkillSummary {
  conteudo: string;
  parsed: { nome: string; descricao: string; categoria: string; tags: string[]; secoes: string[] };
  traducao?: Traducao | null;
  // v1.149.0 — campos ricos.
  identidadePapel?: string;
  blocos?: SkillBloco[];
}

interface Props {
  open?: boolean;
  onClose?: () => void;
  // Quando true, renderiza o conteúdo direto (sem o Modal wrapper) — usado
  // pelo Atelier que já tem seu próprio container/tabs.
  embedded?: boolean;
}

function bytesHumano(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface ExportSkill { id: string; nome: string; descricao?: string; conteudo: string; original?: string; fonte: string }

type ExportTarget = 'generic' | 'cursor' | 'claude';

// Lembra a última config de export (IDE/SO/shell/opções) entre sessões.
const EXPORT_CFG_KEY = 'forja_export_cfg';
interface ExportCfg { target: ExportTarget; so: string; shell: string; contexto: boolean; adaptar: boolean }
function carregarExportCfg(): Partial<ExportCfg> | null {
  try { return JSON.parse(localStorage.getItem(EXPORT_CFG_KEY) || 'null'); } catch { return null; }
}
function salvarExportCfg(cfg: ExportCfg): void {
  try { localStorage.setItem(EXPORT_CFG_KEY, JSON.stringify(cfg)); } catch { /* sem storage */ }
}

function slugSkill(s: string): string {
  return String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
}

function umaLinha(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

// Onde cada destino coloca os arquivos + como o projeto os lê.
const TARGET_INFO: Record<ExportTarget, { label: string; pasta: (slug: string) => string; instrucao: string }> = {
  generic: { label: 'Genérico / Claude.ai', pasta: (s) => `skills/${s}/SKILL.md`, instrucao: 'Coloque a pasta `skills/` na raiz do projeto.' },
  cursor: { label: 'Cursor', pasta: (s) => `.cursor/rules/${s}.mdc`, instrucao: 'Coloque a pasta `.cursor/` na raiz do projeto — o Cursor carrega as rules automaticamente.' },
  claude: { label: 'Claude Code', pasta: (s) => `${s}/SKILL.md`, instrucao: 'Rode `bash install.sh` no terminal — o script pergunta se você quer instalar global (`~/.claude/skills/`) ou só neste projeto (`.claude/skills/`).' },
};

// v1.148.7 — Gera o conteúdo do install.sh interativo pro Claude Code.
// POSIX bash puro, sem dependências. Pergunta global vs projeto e copia tudo.
// Reusado por: 1) "Exportar tudo (Claude Code)" no header, 2) "Montar kit"
// quando o destino escolhido é Claude Code (fluxo wizard de seleção custom).
function gerarInstallShClaude(qtdSkills: number): string {
  return `#!/usr/bin/env bash
set -euo pipefail

cat <<'BANNER'

  ╔═══════════════════════════════════════════════════════════╗
  ║  Forja — instalar skills no Claude Code                    ║
  ╚═══════════════════════════════════════════════════════════╝

  ${qtdSkills} skill(s) neste pacote prontas pra instalar.

  Onde voce quer instalar?

    1) Global  ->  ~/.claude/skills/
       (vale em TODOS os seus projetos sem precisar copiar de novo)

    2) Projeto ->  ./.claude/skills/  no diretorio atual
       (so este projeto, vai versionado no git, time inteiro adota)

BANNER

read -p "  Escolha [1/2]: " escolha

case "\${escolha:-}" in
  1) DEST="\$HOME/.claude/skills" ;;
  2) DEST="\$(pwd)/.claude/skills" ;;
  *) echo "  Escolha invalida ('1' ou '2'). Saindo."; exit 1 ;;
esac

mkdir -p "\$DEST"
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

count=0
for dir in "\$SCRIPT_DIR"/*/; do
  if [ -f "\$dir/SKILL.md" ]; then
    slug="\$(basename "\$dir")"
    target="\$DEST/\$slug"
    rm -rf "\$target"
    cp -r "\$dir" "\$target"
    echo "  - \$slug -> \$target"
    count=\$((count + 1))
  fi
done

echo
echo "  OK - \$count skills instaladas em:"
echo "       \$DEST"
echo
echo "  Reabra o Claude Code pra ele detectar as novas skills."
`;
}

// Empacota um conjunto de skills num .zip no layout do destino escolhido +
// README. Se `ambienteTexto` vier, injeta cabeçalho de contexto em cada arquivo
// e um AGENTS.md (opção A). No destino Cursor, gera `.mdc` com frontmatter.
function baixarKitZip(nomeKit: string, skills: ExportSkill[], ambienteTexto?: string, target: ExportTarget = 'generic'): void {
  const ctx = (ambienteTexto || '').trim();
  const info = TARGET_INFO[target];
  const cabecalho = ctx ? `> **Contexto do ambiente:** ${ctx}\n>\n> _Adapte comandos e caminhos a este ambiente._\n\n` : '';
  const usados = new Set<string>();
  const entries: ZipEntry[] = [];
  const linhas: string[] = [];
  for (const s of skills) {
    const base = slugSkill(s.nome);
    let u = base; let n = 2;
    while (usados.has(u)) { u = `${base}-${n}`; n++; }
    usados.add(u);
    const path = info.pasta(u);
    let content = cabecalho + s.conteudo;
    if (target === 'cursor') {
      const fm = `---\ndescription: ${umaLinha(s.descricao || s.nome)}\nalwaysApply: false\n---\n\n`;
      content = fm + content;
    }
    entries.push({ path, content });
    linhas.push(`- **${s.nome || u}** — \`${path}\``);
  }
  const readme = `# ${nomeKit}\n\nKit de skills exportado do Forja — destino: **${info.label}**.\n\n`
    + (ctx ? `**Ambiente alvo:** ${ctx}\n\n` : '')
    + `## Skills (${skills.length})\n\n${linhas.join('\n')}\n\n---\n\n${info.instrucao}\n`;
  entries.unshift({ path: 'README.md', content: readme });
  if (ctx) {
    const agents = `# Contexto do projeto\n\n**Ambiente alvo:** ${ctx}\n\n`
      + 'Ao usar as skills deste kit, assuma este ambiente para comandos de terminal, '
      + 'caminhos de arquivo e exemplos.\n\n## Skills\n\n' + linhas.join('\n') + '\n';
    entries.push({ path: 'AGENTS.md', content: agents });
  }
  // v1.148.7 — Destino Claude Code: inclui install.sh interativo que pergunta
  // global vs projeto. Funciona tanto via "Exportar tudo" (atalho) quanto via
  // "Montar kit" + seleção custom (wizard).
  if (target === 'claude') {
    entries.push({ path: 'install.sh', content: gerarInstallShClaude(skills.length) });
  }
  baixarBlob(criarZipBlob(entries), `${slugSkill(nomeKit)}.zip`);
}

// Lê um arquivo .md (ou .txt) como string usando FileReader.
function lerArquivoComoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.readAsText(file, 'utf-8');
  });
}

export default function SkillsHubModal({ open, onClose, embedded = false }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [tab, setTab] = useState<'lista' | 'adicionar'>('lista');
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [fontes, setFontes] = useState<SkillFonte[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [soFavoritas, setSoFavoritas] = useState(false);
  // v1.152.0 — filtro "só top" (>= 4 estrelas) + ordenação por estrelas + avaliação Lume.
  const [soTop, setSoTop] = useState(false);
  const [ordenarPorEstrelas, setOrdenarPorEstrelas] = useState(false);
  const [avaliando, setAvaliando] = useState(false);
  const [avalProg, setAvalProg] = useState<{ feitas: number; total: number } | null>(null);
  // v1.151.0 — modal de import em lote (JSON/MD com categoria-no-import).
  const [importLoteAberto, setImportLoteAberto] = useState(false);
  // v1.262.0 — triagem pós-import avulso: categoria + estrelas do recém-criado.
  const [triagemItens, setTriagemItens] = useState<ItemTriagem[]>([]);
  // v1.265.0 — Otimizador IA (metadados em massa) + revisão profunda (conteúdo).
  const [otimizadorAberto, setOtimizadorAberto] = useState(false);
  const [revisaoProfundaAberta, setRevisaoProfundaAberta] = useState(false);
  // v1.267.0 — revisão profunda em fila (grupo-fundação/kit ou filtro por estrelas).
  const [revisaoFilaAberta, setRevisaoFilaAberta] = useState(false);
  const [openSources, setOpenSources] = useState<string[]>([]);
  // Categorias abertas por pasta: { [chaveDaPasta]: string[] }. Tudo recolhido
  // por padrão; o usuário expande só o tema que quer ver.
  const [openCats, setOpenCats] = useState<Record<string, string[]>>({});
  const [traduzindoTudo, setTraduzindoTudo] = useState(false);
  const [classificando, setClassificando] = useState(false);

  // Editar metadados de uma pasta/fonte
  const [editandoFonte, setEditandoFonte] = useState<SkillFonte | null>(null);
  const [fonteNome, setFonteNome] = useState('');
  const [fonteDesc, setFonteDesc] = useState('');
  const [fonteCor, setFonteCor] = useState('');
  const [salvandoFonte, setSalvandoFonte] = useState(false);
  const [removendoFonte, setRemovendoFonte] = useState(false);
  const [movendo, setMovendo] = useState(false);

  // Importar pacote (vários .md sob um nome)
  const [importOpen, setImportOpen] = useState(false);
  const [impNome, setImpNome] = useState('');
  const [impDesc, setImpDesc] = useState('');
  const [impArquivos, setImpArquivos] = useState<{ nome: string; conteudo: string }[]>([]);
  const [importando, setImportando] = useState(false);

  // Exportar pasta + montar kit custom (modo seleção)
  const [selMode, setSelMode] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Modal de export unificado (pasta ou kit custom) com parametrização
  const [exportOpen, setExportOpen] = useState(false);
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [kitNome, setKitNome] = useState('Meu Kit');
  const [expSO, setExpSO] = useState('—');
  const [expShell, setExpShell] = useState('—');
  const [expExtra, setExpExtra] = useState('');
  const [expTarget, setExpTarget] = useState<ExportTarget>('generic');
  const [expContexto, setExpContexto] = useState(true);   // A
  const [expAdaptar, setExpAdaptar] = useState(false);    // B
  const [gerando, setGerando] = useState(false);
  const [expFase, setExpFase] = useState<'config' | 'preview'>('config');
  const [expResultado, setExpResultado] = useState<ExportSkill[]>([]);
  const [previewVer, setPreviewVer] = useState<Record<string, 'adaptado' | 'original'>>({});

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // v1.148.13 — toggle favorita com optimistic update: marca na UI imediatamente,
  // reverte se o backend falhar. Skill favoritada sobe pro topo na próxima ordenação.
  const toggleFavorita = async (id: string) => {
    const alvo = skills.find((s) => s.id === id);
    if (!alvo) return;
    const eraFavorita = !!alvo.favorita;
    // Optimistic: atualiza UI antes da resposta do backend.
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, favorita: !eraFavorita, favoritadaEm: eraFavorita ? '' : new Date().toISOString() } : s));
    try {
      const r = await callServer<ServerResult>('skillsToggleFavorita', id);
      if (!r || !r.ok) {
        // Rollback se falhar.
        setSkills((prev) => prev.map((s) => s.id === id ? { ...s, favorita: eraFavorita } : s));
        message.error((r && r.error) || 'Não foi possível alterar o favorito.');
      } else {
        // Re-ordena: favoritas vão pro topo. Backend já retorna ordenado mas mantemos local
        // só pra dar a sensação visual imediata sem precisar de outro fetch.
        setSkills((prev) => [...prev].sort((a, b) => {
          if (!!a.favorita !== !!b.favorita) return a.favorita ? -1 : 1;
          if (a.favorita) return (b.favoritadaEm || '').localeCompare(a.favoritadaEm || '');
          return (b.atualizadoEm || '').localeCompare(a.atualizadoEm || '');
        }));
      }
    } catch (e) {
      setSkills((prev) => prev.map((s) => s.id === id ? { ...s, favorita: eraFavorita } : s));
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const abrirExport = (nome: string, ids: string[]) => {
    if (ids.length === 0) { message.warning('Nada pra exportar aqui.'); return; }
    setExportIds(ids);
    setKitNome(nome || 'Meu Kit');
    const cfg = carregarExportCfg();
    setExpSO(cfg?.so ?? '—');
    setExpShell(cfg?.shell ?? '—');
    setExpExtra('');
    setExpTarget(cfg?.target ?? 'generic');
    setExpContexto(cfg?.contexto ?? true);
    setExpAdaptar(cfg?.adaptar ?? false);
    setExpFase('config');
    setExpResultado([]);
    setPreviewVer({});
    setExportOpen(true);
  };

  const persistirCfg = () => {
    salvarExportCfg({ target: expTarget, so: expSO, shell: expShell, contexto: expContexto, adaptar: expAdaptar });
  };

  const ambienteTexto = (): string => {
    const partes: string[] = [];
    if (expSO !== '—') partes.push(expSO);
    if (expShell !== '—') partes.push(expShell);
    return [partes.join(' · '), expExtra.trim()].filter(Boolean).join(' — ');
  };

  const finalizarDownload = (lista: ExportSkill[]) => {
    baixarKitZip(kitNome, lista, expContexto ? ambienteTexto() : '', expTarget);
    persistirCfg();
    message.success(`"${kitNome}" gerado com ${lista.length} skill(s).`);
    setExportOpen(false);
    if (selMode) { setSelMode(false); setSelecionados(new Set()); }
  };

  const confirmarExport = async () => {
    if (!kitNome.trim()) { message.warning('Dê um nome ao kit.'); return; }
    if (exportIds.length === 0) { message.warning('Nada selecionado.'); return; }
    setGerando(true);
    const hide = message.loading(expAdaptar ? 'Adaptando skills com IA…' : 'Montando o .zip…', 0);
    try {
      if (expAdaptar) {
        // Fase B: adapta e mostra preview antes de baixar.
        const r = await callServer<ServerResult>('skillsAdaptar', { ids: exportIds, ambiente: ambienteTexto() });
        if (r.ok && r.data) {
          const lista = r.data as ExportSkill[];
          setExpResultado(lista);
          setPreviewVer(Object.fromEntries(lista.map((s) => [s.id, 'adaptado' as const])));
          setExpFase('preview');
        } else message.error(r.error || 'Erro ao adaptar');
      } else {
        const r = await callServer<ServerResult>('skillsExportar', exportIds);
        if (r.ok && r.data) finalizarDownload(r.data as ExportSkill[]);
        else message.error(r.error || 'Erro ao gerar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { hide(); setGerando(false); }
  };

  // Drawer de detalhe
  const [aberta, setAberta] = useState<SkillFull | null>(null);
  const [carregandoAberta, setCarregandoAberta] = useState(false);
  // Tradução pt-BR: por padrão mostra traduzido; cache persistido no servidor
  // (coluna traducaoPt) pra não re-gastar tokens. `verOriginal` mostra o original.
  const [traduzido, setTraduzido] = useState<Traducao | null>(null);
  const [traduzindo, setTraduzindo] = useState(false);
  const [verOriginal, setVerOriginal] = useState(false);

  // Form de adicionar/editar
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [fonte, setFonte] = useState('');
  const [nomeOverride, setNomeOverride] = useState('');
  const [descricaoOverride, setDescricaoOverride] = useState('');
  const [categoriaOverride, setCategoriaOverride] = useState('');
  const [tagsOverride, setTagsOverride] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [importandoKit, setImportandoKit] = useState(false);
  // v1.148.6 — exportação 1-clique de TODAS as skills pra Claude Code (global ou projeto).
  // User pediu: "se eu quiser num projeto novo levar todas essas skills de uma vez,
  // pensando em usar o claude code, o que devo fazer?". Resposta: 1 botão + install.sh.
  const [exportandoTodas, setExportandoTodas] = useState(false);
  const [preview, setPreview] = useState<{ nome: string; descricao: string; categoria: string; tags: string[]; secoes: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const carregar = useCallback(() => {
    // v1.268.6 — cache de sessão: ao voltar pra estação Skills, mostra a
    // última lista NA HORA e atualiza em background (sem tela de loading).
    // Com ~1000 skills a resposta do servidor leva segundos; sem isso toda
    // troca de aba do Atelier "recomeçava do zero".
    if (_cacheSkillsHub) {
      setSkills(_cacheSkillsHub.skills);
      setFontes(_cacheSkillsHub.fontes);
    } else {
      setLoading(true);
    }
    Promise.all([
      callServer<ServerResult>('skillsList'),
      callServer<ServerResult>('skillFontesList'),
    ])
      .then(([rs, rf]) => {
        const sk = rs.ok && rs.data ? (rs.data as SkillSummary[]) : null;
        const fs = rf.ok && rf.data ? (rf.data as SkillFonte[]) : null;
        if (sk) setSkills(sk);
        if (fs) setFontes(fs);
        if (sk && fs) _cacheSkillsHub = { skills: sk, fontes: fs };
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open || embedded) {
      carregar();
      setTab('lista');
      setFiltro('');
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, embedded]);

  // v1.262.0 — categorias já usadas na base (manuais + tipoIA da classificação):
  // viram sugestões na triagem pós-importação.
  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if ((s.categoria || '').trim()) set.add(s.categoria.trim());
      if ((s.tipoIA || '').trim()) set.add(String(s.tipoIA).trim());
    }
    return Array.from(set);
  }, [skills]);

  const resetForm = () => {
    setEditandoId(null);
    setConteudo('');
    setFonte('');
    setNomeOverride('');
    setDescricaoOverride('');
    setCategoriaOverride('');
    setTagsOverride('');
    setPreview(null);
  };

  // Faz parse server-side do conteúdo digitado/upload (debounce simples)
  useEffect(() => {
    if (!conteudo.trim()) { setPreview(null); return; }
    setPreviewing(true);
    const timer = setTimeout(() => {
      callServer<ServerResult>('skillsPreviewParse', conteudo)
        .then((r) => { if (r.ok && r.data) setPreview(r.data as typeof preview); })
        .catch(() => { /* sem preview */ })
        .finally(() => setPreviewing(false));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo]);

  const onUploadFile = async (file: File) => {
    try {
      if (file.size > 500 * 1024) {
        message.warning(`Arquivo grande (${bytesHumano(file.size)}). Pode demorar pra salvar.`);
      }
      const texto = await lerArquivoComoTexto(file);
      setConteudo(texto);
      setFonte(file.name);
      message.success(`"${file.name}" carregado — revise o preview e salve.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao ler arquivo');
    }
    return false; // impede upload automático da AntD
  };

  const salvar = async () => {
    if (!conteudo.trim()) { message.warning('Cole o conteúdo da skill ou faça upload de um arquivo .md'); return; }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('skillsSave', {
        id: editandoId || undefined,
        conteudo,
        fonte,
        nomeOverride,
        descricaoOverride,
        categoriaOverride,
        tagsOverride,
      });
      if (r.ok) {
        const d = r.data as { id: string; nome: string; descricao?: string; categoria?: string; jaExistia?: boolean; duplicatasRemovidas?: number } | undefined;
        if (editandoId) message.success('Skill atualizada.');
        else if (d?.jaExistia) {
          message.success(`Essa skill já existia — atualizada sem duplicar${d.duplicatasRemovidas ? ` (${d.duplicatasRemovidas} cópia duplicada removida)` : ''}.`);
        } else message.success('Skill salva.');
        // Import (não edição): abre a triagem pra categoria + estrelas — sem
        // isso a skill some no meio das centenas já classificadas. No upsert,
        // só reabre se a existente ainda estiver sem categoria.
        if (!editandoId && d?.id && (!d.jaExistia || !(d.categoria || '').trim())) {
          setTriagemItens([{ id: d.id, nome: d.nome, descricao: d.descricao, categoria: d.categoria }]);
        }
        resetForm();
        setTab('lista');
        carregar();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  // Semeia a biblioteca com as skills do GAS App Kit embarcadas no build.
  // Idempotente: faz upsert por `fonte` (atualiza a existente em vez de duplicar).
  const importarKit = async () => {
    if (GAS_APP_KIT_SKILLS.length === 0) {
      message.warning('Nenhuma skill do GAS App Kit foi embarcada neste build.');
      return;
    }
    setImportandoKit(true);
    const hide = message.loading(`Importando ${GAS_APP_KIT_SKILLS.length} skills do GAS App Kit…`, 0);
    let novas = 0; let atualizadas = 0; let erros = 0;
    try {
      const idPorFonte = new Map(skills.map((s) => [s.fonte, s.id]));
      for (const ks of GAS_APP_KIT_SKILLS) {
        const id = idPorFonte.get(ks.fonte);
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('skillsSave', { id, conteudo: ks.conteudo, fonte: ks.fonte });
        if (r.ok) { if (id) atualizadas++; else novas++; } else { erros++; }
      }
    } catch {
      /* o resumo abaixo reporta o que deu certo */
    } finally {
      hide();
      setImportandoKit(false);
      carregar();
    }
    if (erros && !novas && !atualizadas) {
      message.error('Não foi possível importar as skills do GAS App Kit.');
    } else {
      message.success(`GAS App Kit importado — ${novas} nova(s), ${atualizadas} atualizada(s)${erros ? `, ${erros} com erro` : ''}.`);
    }
  };

  // v1.148.6 — exporta TODAS as skills do hub em 1 clique no formato Claude Code.
  // v1.148.7 — refatorado pra delegar ao `baixarKitZip` (que agora inclui install.sh
  // pra destino `claude`). DRY com o fluxo wizard "Montar kit + Claude Code".
  const exportarTodasParaClaudeCode = async () => {
    if (skills.length === 0) {
      message.warning('Nenhuma skill no hub pra exportar.');
      return;
    }
    setExportandoTodas(true);
    try {
      const ids = skills.map((s) => s.id);
      const r = await callServer<ServerResult>('skillsExportar', ids);
      if (!r.ok || !r.data) {
        message.error(r.error || 'Erro ao buscar conteúdo das skills.');
        return;
      }
      const lista = r.data as ExportSkill[];
      baixarKitZip(`forja-skills-claude-code-${new Date().toISOString().slice(0, 10)}`, lista, '', 'claude');
      message.success(`${lista.length} skills exportadas — rode "bash install.sh" no terminal pra instalar.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setExportandoTodas(false);
    }
  };

  const abrirSkill = async (id: string) => {
    setCarregandoAberta(true);
    setTraduzido(null);
    setVerOriginal(false);
    try {
      const r = await callServer<ServerResult>('skillsGetContent', id);
      if (r.ok && r.data) {
        const full = r.data as SkillFull;
        setAberta(full);
        if (full.traducao && (full.traducao.conteudo || full.traducao.descricao)) {
          // Cache existe → mostra pt-BR na hora, sem gastar token.
          setTraduzido(full.traducao);
        } else {
          // Sem cache → traduz uma vez (fica guardado pras próximas).
          traduzirSkill(id);
        }
      } else {
        message.error(r.error || 'Erro ao carregar');
      }
    } finally { setCarregandoAberta(false); }
  };

  const traduzirSkill = async (idArg?: string) => {
    const id = idArg || aberta?.id;
    if (!id) return;
    setTraduzindo(true);
    try {
      const r = await callServer<ServerResult>('skillsTraduzir', id);
      if (r.ok && r.data) {
        setTraduzido(r.data as Traducao);
        setVerOriginal(false);
      } else {
        message.error(r.error || 'Não consegui traduzir');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao traduzir');
    } finally {
      setTraduzindo(false);
    }
  };

  const editarSkill = (s: SkillFull) => {
    setAberta(null);
    setEditandoId(s.id);
    setConteudo(s.conteudo);
    setFonte(s.fonte);
    setNomeOverride(s.nome);
    setDescricaoOverride(s.descricao);
    setCategoriaOverride(s.categoria);
    setTagsOverride(s.tags.join(', '));
    setTab('adicionar');
  };

  const deletarSkill = async (id: string) => {
    const r = await callServer<ServerResult>('skillsDelete', id);
    if (r.ok) {
      message.success('Skill removida');
      setAberta(null);
      carregar();
    } else message.error(r.error || 'Erro');
  };

  const copiarConteudo = (texto: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(texto);
      message.success('Copiado para a área de transferência');
    }
  };

  const baixarMd = (s: { nome: string; conteudo: string }) => {
    const slug = s.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';
    const blob = new Blob([s.conteudo], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // v1.149.0 — registra +1 uso no backend e atualiza a UI localmente (optimistic).
  // Best-effort: erro de rede não trava a ação principal (copy/baixar).
  const registrarUso = (id: string) => {
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, usos: (s.usos || 0) + 1 } : s));
    setAberta((prev) => prev && prev.id === id ? { ...prev, usos: (prev.usos || 0) + 1 } : prev);
    void callServer<ServerResult>('skillsRegistrarUso', id).catch(() => { /* silent */ });
  };

  // v1.148.13 — filtro "só favoritas" (☆). v1.152.0 — "só top" (>=4 estrelas).
  const filtradas = useMemo(() => {
    let lista = skills;
    if (soFavoritas) lista = lista.filter((s) => !!s.favorita);
    if (soTop) lista = lista.filter((s) => (s.estrelas || 0) >= 4);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((s) =>
        s.nome.toLowerCase().indexOf(q) >= 0 ||
        s.descricao.toLowerCase().indexOf(q) >= 0 ||
        (s.descricaoPt || '').toLowerCase().indexOf(q) >= 0 ||
        s.categoria.toLowerCase().indexOf(q) >= 0 ||
        s.tags.some((tag) => tag.toLowerCase().indexOf(q) >= 0),
      );
    }
    if (ordenarPorEstrelas) {
      lista = [...lista].sort((a, b) => (b.estrelas || 0) - (a.estrelas || 0) || (a.nome || '').localeCompare(b.nome || ''));
    }
    return lista;
  }, [skills, filtro, soFavoritas, soTop, ordenarPorEstrelas]);

  const qtdAvaliadas = useMemo(() => skills.filter((s) => (s.estrelas || 0) > 0).length, [skills]);

  // Contagem de favoritas pra mostrar no badge do botão (decisão informada).
  const qtdFavoritas = useMemo(() => skills.filter((s) => !!s.favorita).length, [skills]);

  const fonteMeta = useMemo(() => {
    const m: Record<string, SkillFonte> = {};
    for (const f of fontes) m[f.chave] = f;
    return m;
  }, [fontes]);

  // Agrupa: fonte (pasta) → categoria (seção). Pastas colapsadas por padrão.
  const grupos = useMemo(() => {
    const nomeDe = (k: string) => fonteMeta[k]?.nome || fonteLabel(k);
    const porFonte: Record<string, SkillSummary[]> = {};
    for (const s of filtradas) (porFonte[fonteKey(s.fonte)] = porFonte[fonteKey(s.fonte)] || []).push(s);
    const chaves = Object.keys(porFonte).sort((a, b) => {
      // gas-app-kit primeiro, avulsas por último, resto alfabético
      const peso = (k: string) => (k === 'gas-app-kit' ? 0 : k === 'avulsas' ? 2 : 1);
      return peso(a) - peso(b) || nomeDe(a).localeCompare(nomeDe(b));
    });
    return chaves.map((k) => {
      const lista = porFonte[k];
      const meta = fonteMeta[k];
      const bytes = lista.reduce((acc, s) => acc + (s.tamanhoBytes || 0), 0);
      // Subgrupos por tema (IA) com fallback pra categoria do frontmatter.
      const porCat: Record<string, SkillSummary[]> = {};
      for (const s of lista) {
        const cat = (s.tipoIA || s.categoria || '').trim() || '—';
        (porCat[cat] = porCat[cat] || []).push(s);
      }
      const categorias = Object.keys(porCat)
        .sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
        .map((cat) => ({ cat, skills: porCat[cat].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) }));
      return {
        key: k,
        label: meta?.nome || fonteLabel(k),
        descricao: meta?.descricao || '',
        meta: meta || null,
        total: lista.length,
        bytes,
        categorias,
      };
    });
  }, [filtradas, fonteMeta]);

  // Com filtro ativo, expande tudo pra revelar os matches; senão respeita o
  // que o usuário abriu (tudo colapsado por padrão).
  const activeSources = filtro.trim() ? grupos.map((g) => g.key) : openSources;

  const traduzirDescricoes = async () => {
    setTraduzindoTudo(true);
    const hide = message.loading('Traduzindo descrições para português…', 0);
    try {
      const r = await callServer<ServerResult>('skillsTraduzirDescricoes');
      if (r.ok) {
        const d = (r.data as { traduzidas: number }) || { traduzidas: 0 };
        message.success(d.traduzidas > 0 ? `${d.traduzidas} descrição(ões) traduzida(s) para pt-BR.` : 'Todas as descrições já estavam traduzidas.');
        carregar();
      } else {
        message.error(r.error || 'Não consegui traduzir');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao traduzir');
    } finally { hide(); setTraduzindoTudo(false); }
  };

  // v1.265.1 — loop chunked (o backend classifica ~40 por chamada e devolve
  // `restantes`). Antes era 1 chamada com tudo: com muitas pendentes a resposta
  // da IA vinha truncada, o parse falhava em silêncio e nada era gravado.
  const classificarSkills = async () => {
    setClassificando(true);
    const hide = message.loading('Classificando skills por tema (IA)…', 0);
    try {
      let totalFeitas = 0;
      let guarda = 0;
      for (;;) {
        guarda++;
        if (guarda > 100) break;
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('skillsClassificar');
        if (!r.ok) {
          message.error(r.error || 'Não consegui classificar');
          break;
        }
        const d = (r.data as { classificadas: number; restantes?: number }) || { classificadas: 0 };
        totalFeitas += d.classificadas;
        if (!d.restantes || d.restantes <= 0) {
          if (totalFeitas > 0) message.success(`${totalFeitas} skill(s) classificada(s) por tema.`);
          else message.info('Nenhuma skill pendente de classificação.');
          break;
        }
      }
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao classificar');
    } finally { hide(); setClassificando(false); }
  };

  // v1.152.0 — Avalia a qualidade (estrelas 0-5) com a Lume. Loop chunked: o
  // backend processa ~40 por chamada e devolve `restantes`; repetimos até zerar,
  // atualizando a barra de progresso. Escopo: respeita o filtro atual (pasta via
  // soTop não; aqui mandamos só 'pendentes' por padrão pra não re-gastar tokens).
  const avaliarSkills = async (opcoes?: { escopo?: 'pendentes' | 'todas'; fonte?: string }) => {
    setAvaliando(true);
    setAvalProg(null);
    let totalFeitas = 0;
    let totalGeral = 0;
    try {
      // `desde` = cursor do run: no escopo 'todas' (reavaliação), o servidor só
      // pega quem foi avaliado ANTES deste instante — sem isso os chunks
      // repetiriam as mesmas 40 primeiras skills pra sempre.
      const base = {
        escopo: opcoes?.escopo || 'pendentes',
        fonte: opcoes?.fonte,
        desde: opcoes?.escopo === 'todas' ? new Date().toISOString() : undefined,
      };
      // Primeira chamada descobre o total.
      let r = await callServer<ServerResult>('skillsAvaliar', base);
      if (!r.ok) { message.error(r.error || 'Não consegui avaliar'); return; }
      let d = r.data as { avaliadas: number; restantes: number; total: number };
      totalGeral = d.total + 0;
      totalFeitas += d.avaliadas;
      if (totalGeral === 0) { message.info('Nada pendente pra avaliar nesse escopo.'); return; }
      setAvalProg({ feitas: totalFeitas, total: totalGeral });
      // Continua enquanto houver restantes.
      let restantes = d.restantes;
      let guarda = 0;
      while (restantes > 0 && guarda < 200) {
        guarda++;
        r = await callServer<ServerResult>('skillsAvaliar', base);
        if (!r.ok) { message.error(r.error || 'Erro durante avaliação'); break; }
        d = r.data as { avaliadas: number; restantes: number; total: number };
        totalFeitas += d.avaliadas;
        restantes = d.restantes;
        setAvalProg({ feitas: Math.min(totalFeitas, totalGeral), total: totalGeral });
      }
      message.success(`${totalFeitas} skill(s) avaliada(s) pela Lume${opcoes?.fonte ? ' nesta pasta' : ''}.`);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao avaliar');
    } finally { setAvaliando(false); setAvalProg(null); }
  };

  // Override manual da nota (drawer).
  const definirEstrelas = (id: string, n: number) => {
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, estrelas: n, estrelasMotivo: 'Ajuste manual' } : s));
    setAberta((prev) => prev && prev.id === id ? { ...prev, estrelas: n, estrelasMotivo: 'Ajuste manual' } : prev);
    void callServer<ServerResult>('skillsDefinirEstrelas', id, n).catch(() => { /* silent */ });
  };

  const abrirEditarFonte = (f: SkillFonte) => {
    setEditandoFonte(f);
    setFonteNome(f.nome);
    setFonteDesc(f.descricao);
    setFonteCor(f.cor || '');
  };

  const salvarFonte = async () => {
    if (!fonteNome.trim()) { message.warning('Dê um nome pra pasta.'); return; }
    setSalvandoFonte(true);
    try {
      const r = await callServer<ServerResult>('skillFonteSalvar', {
        id: editandoFonte?.id, chave: editandoFonte?.chave, nome: fonteNome, descricao: fonteDesc, cor: fonteCor,
      });
      if (r.ok) { message.success('Pasta atualizada.'); setEditandoFonte(null); carregar(); }
      else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvandoFonte(false); }
  };

  const removerFonte = async () => {
    if (!editandoFonte) return;
    setRemovendoFonte(true);
    try {
      const r = await callServer<ServerResult>('skillFonteRemover', editandoFonte.id);
      if (r.ok) {
        const d = (r.data as { movidas: number }) || { movidas: 0 };
        message.success(`Pasta removida. ${d.movidas} skill(s) movida(s) para "Avulsas".`);
        setEditandoFonte(null);
        carregar();
      } else message.error(r.error || 'Erro ao remover');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setRemovendoFonte(false); }
  };

  // v1.156.0 — monta o "kit dos sonhos" do segmento (só itens dessa seção:
  // skills + agents). A coleção aparece na estação Kits.
  const [montandoSeg, setMontandoSeg] = useState<string | null>(null);
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

  const moverSkill = async (chaveDestino: string) => {
    if (!aberta) return;
    setMovendo(true);
    try {
      const r = await callServer<ServerResult>('skillsMoverFonte', aberta.id, chaveDestino);
      if (r.ok && r.data) {
        const nova = (r.data as { fonte: string }).fonte;
        setAberta((prev) => (prev ? { ...prev, fonte: nova } : prev));
        message.success('Skill movida.');
        carregar();
      } else message.error(r.error || 'Erro ao mover');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setMovendo(false); }
  };

  const onUploadPacote = async (file: File) => {
    try {
      const texto = await lerArquivoComoTexto(file);
      setImpArquivos((a) => [...a, { nome: file.name, conteudo: texto }]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao ler arquivo');
    }
    return false; // impede upload automático
  };

  const importarPacote = async () => {
    if (!impNome.trim()) { message.warning('Dê um nome ao pacote.'); return; }
    if (impArquivos.length === 0) { message.warning('Suba pelo menos um arquivo .md.'); return; }
    setImportando(true);
    const hide = message.loading(`Importando ${impArquivos.length} skill(s)…`, 0);
    try {
      const rf = await callServer<ServerResult>('skillFonteSalvar', { nome: impNome, descricao: impDesc });
      if (!rf.ok || !rf.data) { message.error(rf.error || 'Erro ao criar a pasta'); return; }
      const chave = (rf.data as { chave: string }).chave;
      let n = 0; let erros = 0;
      for (const a of impArquivos) {
        const slug = a.nome.replace(/\.(md|markdown|txt)$/i, '');
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('skillsSave', { conteudo: a.conteudo, fonte: `${chave}/${slug}` });
        if (r.ok) n++; else erros++;
      }
      message.success(`Pacote "${impNome}" — ${n} skill(s) importada(s)${erros ? `, ${erros} com erro` : ''}.`);
      setImportOpen(false); setImpNome(''); setImpDesc(''); setImpArquivos([]);
      setOpenSources((prev) => (prev.includes(chave) ? prev : [...prev, chave]));
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao importar');
    } finally { hide(); setImportando(false); }
  };

  const tabsEl = (
    <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'lista' | 'adicionar')}
          tabBarStyle={{ paddingLeft: 24, paddingRight: 24, marginBottom: 0 }}
          items={[
            {
              key: 'lista',
              label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FolderOpen size={14} /> Minhas skills {skills.length > 0 && <Tag style={{ marginInlineEnd: 0 }}>{skills.length}</Tag>}</span>,
              children: (
                <div style={{ padding: '14px 24px 24px', minHeight: 380, maxHeight: '70vh', overflow: 'auto' }}>
                  {/* Status do LLM usado nesta seção (tradução das skills) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '8px 12px', borderRadius: 10,
                    background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                    flexWrap: 'wrap',
                  }}>
                    <Languages size={14} color={t.accents.sage} />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                      IA usada para tradução das skills:
                    </span>
                    <ModeloBadge uso="chat" size="medium" />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
                      passe o mouse para latência e status · botão "Testar conexão"
                    </span>
                  </div>

                  {/* v1.153.0 — Barra de comando repaginada: busca + chips de
                      filtro numa linha; ações agrupadas e rotuladas (Curadoria
                      IA com destaque, Biblioteca com dropdowns) noutra. Dá
                      respiro, hierarquia e discoverability. */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Input
                      prefix={<Search size={14} color={t.textTertiary} />}
                      placeholder="Filtrar por nome, descrição, categoria ou tag…"
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      allowClear
                      style={{ flex: 1, minWidth: 240 }}
                    />
                    {(qtdFavoritas > 0 || qtdAvaliadas > 0) && (
                      <ChipGroup>
                        {qtdFavoritas > 0 && (
                          <FiltroChip
                            active={soFavoritas}
                            onClick={() => setSoFavoritas((v) => !v)}
                            accent={t.accents.peach}
                            fill
                            title={soFavoritas ? 'Mostrando só as favoritas — clique pra ver todas' : 'Filtrar só as favoritas (coração)'}
                            label={`Favoritas ${qtdFavoritas}`}
                            icon={(cor, filled) => <Heart size={14} color={cor} fill={filled ? cor : 'none'} strokeWidth={1.8} />}
                          />
                        )}
                        {qtdAvaliadas > 0 && (
                          <>
                            <FiltroChip
                              active={soTop}
                              onClick={() => setSoTop((v) => !v)}
                              accent={t.accents.peach}
                              fill
                              title="Mostrar só as skills com 4 ou 5 estrelas (avaliadas pela Lume)."
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
                    {/* Grupo 1 — Curadoria com a Lume (destaque) */}
                    {skills.length > 0 && (
                      <GrupoAcoes label="Curadoria com a Lume" accent={t.accents.peach} icon={<Sparkles size={11} />}>
                        <Tooltip title="A Lume lê nome + descrição e dá uma nota de qualidade (0-5) pra cada skill ainda sem nota. Fica guardado — não re-gasta tokens nas próximas.">
                          <Button
                            icon={<Star size={14} />}
                            loading={avaliando}
                            onClick={() => avaliarSkills({ escopo: 'pendentes' })}
                            style={{ borderColor: `${t.accents.peach}66`, color: t.accents.peach, background: `${t.accents.peach}0d` }}
                          >
                            {avaliando && avalProg ? `Avaliando ${avalProg.feitas}/${avalProg.total}…` : 'Avaliar com a Lume'}
                          </Button>
                        </Tooltip>
                        <Tooltip title="A IA lê nome + descrição e agrupa cada skill num tema de alto nível (Design, Frontend, Backend…). Fica guardado — não re-gasta tokens.">
                          <Button icon={<Wand2 size={14} />} loading={classificando} onClick={classificarSkills}>
                            Classificar por tema
                          </Button>
                        </Tooltip>
                        <Tooltip title="Traduz para português as descrições ainda no original (fica guardado — não re-gasta tokens nas próximas).">
                          <Button icon={<Languages size={14} />} loading={traduzindoTudo} onClick={traduzirDescricoes}>
                            Traduzir descrições
                          </Button>
                        </Tooltip>
                        <Tooltip title="A IA (modelo configurável — serviço 'Atelier' no Roteamento de IA) analisa categoria, tags, descrição e estrelas de cada skill e sugere ajustes. Você revisa tudo antes de aplicar.">
                          <Button
                            icon={<Wand2 size={14} />}
                            onClick={() => setOtimizadorAberto(true)}
                            style={{ borderColor: `${t.accents.lavender}66`, color: t.accents.lavender, background: `${t.accents.lavender}0d` }}
                          >
                            Otimizar com IA
                          </Button>
                        </Tooltip>
                        <Tooltip title="A IA reescreve o CONTEÚDO completo de um grupo de skills (um kit da Lume ou filtro por estrelas + categorias), uma por uma. Você aprova os antes/depois antes de gravar.">
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

                    {skills.length > 0 && <GrupoDivisor />}

                    {/* Grupo 2 — Biblioteca (importar / exportar em dropdowns) */}
                    <GrupoAcoes label="Biblioteca" icon={<BookMarked size={11} />}>
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: [
                            { key: 'lote', icon: <Boxes size={14} />, label: 'Importar lote (.json / .md)' },
                            { key: 'pacote', icon: <FolderPlus size={14} />, label: 'Importar pacote (vários .md)' },
                            ...(GAS_APP_KIT_SKILLS.length > 0 ? [{ key: 'gas', icon: <Download size={14} />, label: `Importar GAS App Kit (${GAS_APP_KIT_SKILLS.length})` }] : []),
                          ],
                          onClick: ({ key }) => {
                            if (key === 'lote') setImportLoteAberto(true);
                            else if (key === 'pacote') setImportOpen(true);
                            else if (key === 'gas') void importarKit();
                          },
                        }}
                      >
                        <Button icon={<FolderDown size={14} />} loading={importandoKit}>Importar ▾</Button>
                      </Dropdown>
                      {skills.length > 0 && (
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              { key: 'tudo', icon: <Package size={14} />, label: 'Exportar tudo (Claude Code)' },
                              { key: 'selecionar', icon: <ListChecks size={14} />, label: 'Selecionar skills pra exportar…' },
                            ],
                            onClick: ({ key }) => {
                              if (key === 'tudo') void exportarTodasParaClaudeCode();
                              else if (key === 'selecionar') { setSelMode(true); setSelecionados(new Set()); }
                            },
                          }}
                        >
                          <Button icon={<Package size={14} />} loading={exportandoTodas}>Exportar ▾</Button>
                        </Dropdown>
                      )}
                    </GrupoAcoes>

                    {/* Grupo 3 — direita: montar kit + adicionar (primário) */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                      {skills.length > 0 && (
                        <Tooltip title="Selecione skills de qualquer pasta e gere um .zip pronto pra levar pro seu projeto.">
                          <Button
                            icon={<ListChecks size={14} />}
                            type={selMode ? 'primary' : 'default'}
                            ghost={selMode}
                            onClick={() => { setSelMode((v) => !v); setSelecionados(new Set()); }}
                          >
                            {selMode ? 'Cancelar seleção' : 'Montar kit'}
                          </Button>
                        </Tooltip>
                      )}
                      <Button type="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setTab('adicionar'); }}>
                        Adicionar skill
                      </Button>
                    </div>
                  </CommandBar>
                  <div style={{ height: 14 }} />

                  {/* v1.271.0 — widget "como usar na IDE" (mini prompt por IDE). */}
                  <InstrucoesIDEWidget contexto="skills" />

                  {/* v1.152.0 — barra de progresso da avaliação pela Lume */}
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

                  {/* v1.148.5 — banner contextual: skills sem categoria detectadas.
                      O usuário viu o problema na prática (importou skill, ficou sem
                      categoria, ficou perdido). Em vez de obrigar ele a descobrir o
                      botão "Classificar por tema" sozinho, sugerimos aqui mesmo. */}
                  {(() => {
                    // v1.151.2 — uma skill está "classificada" se tem tema da IA
                    // (`tipoIA`) OU categoria do frontmatter. O backend
                    // (skillsClassificar) usa exatamente esse critério, então o
                    // banner tem que bater — senão skills do GAS App Kit (que têm
                    // tipoIA mas não categoria) apareciam falsamente como "sem
                    // categoria".
                    const semCategoria = skills.filter((s) =>
                      (!s.categoria || s.categoria.trim() === '') &&
                      (!s.tipoIA || s.tipoIA.trim() === ''),
                    ).length;
                    if (semCategoria === 0 || classificando || selMode) return null;
                    return (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
                        padding: '10px 14px', borderRadius: 12,
                        background: `${t.accents.peach}12`, border: `1px solid ${t.accents.peach}3a`,
                      }}>
                        <Sparkles size={15} color={t.accents.peach} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                            <strong>{semCategoria}</strong> skill(s) sem categoria
                          </span>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, display: 'block', marginTop: 1 }}>
                            A IA lê nome + descrição de cada uma e agrupa em temas (Design, Frontend, Code Quality…). Roda só nas faltantes, em ~10 segundos.
                          </span>
                        </div>
                        <Button size="small" type="primary" icon={<Sparkles size={13} />} loading={classificando} onClick={classificarSkills}>
                          Classificar agora
                        </Button>
                      </div>
                    );
                  })()}

                  {selMode && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                      padding: '10px 14px', borderRadius: 12,
                      background: `${t.accents.lavender}12`, border: `1px solid ${t.accents.lavender}3a`,
                      position: 'sticky', top: 0, zIndex: 3,
                    }}>
                      <ListChecks size={16} color={t.accents.lavender} />
                      <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                        <strong>{selecionados.size}</strong> de {filtradas.length} skill(s) selecionada(s)
                        {filtro && (
                          <span style={{ color: t.textTertiary, marginLeft: 6 }}>
                            (filtro: "{filtro}")
                          </span>
                        )}
                      </span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <Tooltip title={filtro ? `Marca todas as ${filtradas.length} skills que combinam com o filtro atual` : `Marca todas as ${filtradas.length} skills da biblioteca`}>
                          <Button
                            size="small"
                            disabled={filtradas.length === 0 || filtradas.every((s) => selecionados.has(s.id))}
                            onClick={() => setSelecionados((prev) => {
                              const next = new Set(prev);
                              filtradas.forEach((s) => next.add(s.id));
                              return next;
                            })}
                          >
                            {filtro ? 'Selecionar visíveis' : 'Selecionar todas'}
                          </Button>
                        </Tooltip>
                        {selecionados.size > 0 && (
                          <Button size="small" onClick={() => setSelecionados(new Set())}>Limpar</Button>
                        )}
                        <Button size="small" onClick={() => { setSelMode(false); setSelecionados(new Set()); }}>Cancelar</Button>
                        <Tooltip title={selecionados.size === 0 ? 'Marque ao menos uma skill' : 'Próximo passo: escolhe o destino (Claude Code, Cursor, Genérico). Claude Code inclui install.sh interativo.'}>
                          <Button
                            size="small" type="primary" icon={<Archive size={13} />}
                            disabled={selecionados.size === 0}
                            onClick={() => abrirExport('Meu Kit', Array.from(selecionados))}
                          >
                            Gerar kit ({selecionados.size})
                          </Button>
                        </Tooltip>
                      </span>
                    </div>
                  )}

                  {loading && skills.length === 0 ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : filtradas.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <div style={{ fontFamily: FONTS.ui, color: t.textSecondary }}>
                          {skills.length === 0
                            ? 'Sua biblioteca de skills está vazia. Adicione a primeira pra começar.'
                            : `Nenhuma skill combina com "${filtro}"`}
                        </div>
                      }
                    >
                      {skills.length === 0 && (
                        <Button type="primary" icon={<Plus size={14} />} onClick={() => setTab('adicionar')}>
                          Adicionar primeira skill
                        </Button>
                      )}
                    </Empty>
                  ) : (
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
                            <span style={{ width: 30, height: 30, borderRadius: 8, background: `${g.meta?.cor || t.accents.lavender}1a`, color: g.meta?.cor || t.accents.lavender, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {g.key === 'avulsas' ? <Folder size={15} /> : <Package size={15} />}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text }}>{g.label}</span>
                                <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '0 8px', lineHeight: '18px' }}>
                                  {g.total} {g.total === 1 ? 'skill' : 'skills'}
                                </span>
                              </div>
                              {g.descricao && (
                                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {g.descricao}
                                </div>
                              )}
                            </div>
                            <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, flexShrink: 0 }}>{bytesHumano(g.bytes)}</span>
                            <Tooltip title="Montar o kit dos sonhos DESTE segmento (a Lume cura as melhores skills + agents desta seção). Aparece na estação Kits.">
                              <Button
                                type="text"
                                size="small"
                                icon={<Sparkles size={13} />}
                                loading={montandoSeg === g.key}
                                style={{ color: t.accents.peach }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void montarKitSegmento(g.key, g.label);
                                }}
                              />
                            </Tooltip>
                            <Tooltip title="Reavaliar TODAS as skills desta pasta com a Lume (re-dá as notas, inclusive de quem já tem). Use depois de atualizar o conteúdo da pasta.">
                              <Button
                                type="text"
                                size="small"
                                icon={<Star size={13} />}
                                loading={avaliando}
                                style={{ color: t.accents.clay }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void avaliarSkills({ escopo: 'todas', fonte: g.key });
                                }}
                              />
                            </Tooltip>
                            <Tooltip title="Exportar pasta como .zip (skills/<nome>/SKILL.md) pra levar pro projeto">
                              <Button
                                type="text"
                                size="small"
                                icon={<Archive size={13} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirExport(g.label, g.categorias.flatMap((c) => c.skills.map((s) => s.id)));
                                }}
                              />
                            </Tooltip>
                            <Tooltip title="Editar nome e descrição da pasta">
                              <Button
                                type="text"
                                size="small"
                                icon={<Pencil size={13} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // v1.152.0 — toda pasta é editável, inclusive a
                                  // sintética "Avulsas / Importadas". Quando não há
                                  // linha persistida (g.meta null), montamos uma
                                  // SkillFonte sintética com a chave do grupo; o
                                  // backend faz upsert por chave ao salvar.
                                  abrirEditarFonte(g.meta || { id: '', chave: g.key, nome: g.label, descricao: g.descricao || '', cor: '' });
                                }}
                              />
                            </Tooltip>
                          </div>
                        ),
                        children: (
                          <Collapse
                            bordered={false}
                            ghost
                            activeKey={filtro.trim() ? g.categorias.map((c) => c.cat) : (openCats[g.key] || [])}
                            onChange={(k) => setOpenCats((prev) => ({ ...prev, [g.key]: Array.isArray(k) ? (k as string[]) : [k as string] }))}
                            items={g.categorias.map((cg) => ({
                              key: cg.cat,
                              style: { borderBottom: `1px solid ${t.borderSoft}` },
                              label: (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600,
                                    color: t.accents.lavender, background: `${t.accents.lavender}14`,
                                    border: `1px solid ${t.accents.lavender}33`, borderRadius: 999, padding: '2px 10px',
                                    textTransform: 'capitalize',
                                  }}>
                                    <TagIcon size={11} />
                                    {cg.cat === '—' ? 'Sem categoria' : cg.cat}
                                  </span>
                                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                                    {cg.skills.length} {cg.skills.length === 1 ? 'skill' : 'skills'}
                                  </span>
                                </span>
                              ),
                              children: (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                                  {cg.skills.map((s) => (
                                    <SkillCard
                                      key={s.id}
                                      skill={s}
                                      onOpen={() => abrirSkill(s.id)}
                                      selMode={selMode}
                                      selecionado={selecionados.has(s.id)}
                                      onToggleSel={() => toggleSelecionado(s.id)}
                                      onToggleFavorita={() => toggleFavorita(s.id)}
                                    />
                                  ))}
                                </div>
                              ),
                            }))}
                          />
                        ),
                      }))}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'adicionar',
              label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> {editandoId ? 'Editando' : 'Adicionar'}</span>,
              children: (
                <div style={{ padding: '14px 24px 24px', maxHeight: '70vh', overflow: 'auto' }}>
                  {/* Zona de upload */}
                  <Upload.Dragger
                    accept=".md,.markdown,.txt"
                    multiple={false}
                    showUploadList={false}
                    beforeUpload={onUploadFile}
                    style={{ marginBottom: 14, background: t.surfaceMuted }}
                  >
                    <p style={{ margin: 0 }}>
                      <UploadIcon size={28} color={t.accents.lavender} style={{ display: 'inline-block', marginBottom: 6 }} />
                    </p>
                    <p style={{ fontFamily: FONTS.ui, color: t.text, margin: '4px 0', fontSize: 14 }}>
                      Arraste um arquivo <code style={{ fontFamily: FONTS.mono, fontSize: 12 }}>.md</code> aqui ou clique pra escolher
                    </p>
                    <p style={{ fontFamily: FONTS.ui, color: t.textTertiary, fontSize: 12, margin: 0 }}>
                      O nome, descrição e tags são extraídos automaticamente do frontmatter ou do primeiro heading
                    </p>
                  </Upload.Dragger>

                  <div style={{ textAlign: 'center', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, margin: '0 0 14px' }}>
                    ── ou cole o conteúdo abaixo ──
                  </div>

                  <Form layout="vertical">
                    <Form.Item label={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>Conteúdo Markdown {fonte && <Tag style={{ marginLeft: 8, fontSize: 11 }}>{fonte}</Tag>}</span>}>
                      <Input.TextArea
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        placeholder={`---\nname: Revisar PR\ndescription: Checklist de code review\ncategory: review\ntags: [code, quality]\n---\n\n# Como fazer code review\n\n## Passos\n...`}
                        rows={10}
                        style={{ fontFamily: FONTS.mono, fontSize: 12 }}
                      />
                    </Form.Item>

                    {/* Preview do parse */}
                    {(preview || previewing) && (
                      <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Sparkles size={13} color={t.accents.lavender} />
                          <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>Metadados extraídos</span>
                          {previewing && <Spin size="small" />}
                        </div>
                        {preview && (
                          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.7 }}>
                            <div><strong>Nome:</strong> {preview.nome || <em style={{ color: t.textTertiary }}>(não detectado — preencha override abaixo)</em>}</div>
                            <div><strong>Descrição:</strong> {preview.descricao || <em style={{ color: t.textTertiary }}>(vazio)</em>}</div>
                            {preview.categoria && <div><strong>Categoria:</strong> <Tag>{preview.categoria}</Tag></div>}
                            {preview.tags.length > 0 && (
                              <div><strong>Tags:</strong> {preview.tags.map((tg) => <Tag key={tg} icon={<TagIcon size={9} style={{ marginRight: 3 }} />}>{tg}</Tag>)}</div>
                            )}
                            {preview.secoes.length > 0 && (
                              <div><strong>Seções (H2):</strong> {preview.secoes.map((sc) => <Tag key={sc} color="default" style={{ fontWeight: 400 }}>{sc}</Tag>)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overrides */}
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ cursor: 'pointer', fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
                        Sobrescrever metadados (opcional)
                      </summary>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        <Form.Item label="Nome" style={{ marginBottom: 6 }}>
                          <Input value={nomeOverride} onChange={(e) => setNomeOverride(e.target.value)} placeholder={preview?.nome || 'Nome da skill'} />
                        </Form.Item>
                        <Form.Item label="Categoria" style={{ marginBottom: 6 }}>
                          <Input value={categoriaOverride} onChange={(e) => setCategoriaOverride(e.target.value)} placeholder={preview?.categoria || 'ex.: review, infra, prompt'} />
                        </Form.Item>
                        <Form.Item label="Descrição" style={{ marginBottom: 6, gridColumn: '1 / -1' }}>
                          <Input value={descricaoOverride} onChange={(e) => setDescricaoOverride(e.target.value)} placeholder={preview?.descricao || 'Pra que serve essa skill?'} />
                        </Form.Item>
                        <Form.Item label="Tags (separadas por vírgula)" style={{ marginBottom: 6, gridColumn: '1 / -1' }}>
                          <Input value={tagsOverride} onChange={(e) => setTagsOverride(e.target.value)} placeholder={preview?.tags.join(', ') || 'ex.: code, review, claude'} />
                        </Form.Item>
                      </div>
                    </details>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="primary" icon={<Save size={14} />} onClick={salvar} loading={salvando}>
                        {editandoId ? 'Atualizar skill' : 'Salvar skill'}
                      </Button>
                      {editandoId && (
                        <Button icon={<X size={14} />} onClick={() => { resetForm(); setTab('lista'); }}>Cancelar edição</Button>
                      )}
                    </div>
                  </Form>
                </div>
              ),
            },
          ]}
        />
  );

  return (
    <>
      {embedded ? (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {tabsEl}
        </div>
      ) : (
        <Modal
          open={!!open}
          onCancel={onClose}
          footer={null}
          width={920}
          styles={{ body: { padding: 0 } }}
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <BookMarked size={18} strokeWidth={1.6} color={t.accents.lavender} />
              <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Skills</span>
              <Tooltip title="Coleção de prompts, instruções e playbooks reutilizáveis (formato SKILL.md / agent-skill). Tudo fica na sua planilha do Forja — exportável como .md.">
                <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
              </Tooltip>
            </span>
          }
        >
          {tabsEl}
        </Modal>
      )}

      {/* v1.151.0 — Modal de import em lote (JSON/MD + categoria-no-import) */}
      <ImportarLoteModal
        aberto={importLoteAberto}
        onClose={() => setImportLoteAberto(false)}
        tipo="skills"
        rpcBulkSave="skillsBulkSave"
        onConcluido={() => { void carregar(); }}
        categoriasExistentes={categoriasExistentes}
      />

      {/* v1.262.0 — Triagem do import avulso (categoria + estrelas do novo). */}
      <TriagemImportacaoModal
        aberto={triagemItens.length > 0}
        onClose={() => setTriagemItens([])}
        tipo="skills"
        itens={triagemItens}
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.265.0 — Otimização IA em massa (metadados; sugestão → revisão → aplicar). */}
      <OtimizadorIAModal
        aberto={otimizadorAberto}
        onClose={() => setOtimizadorAberto(false)}
        tipo="skills"
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.267.0 — Revisão profunda em fila (grupo-fundação/kit ou filtro). */}
      <RevisaoFilaModal
        aberto={revisaoFilaAberta}
        onClose={() => setRevisaoFilaAberta(false)}
        tipo="skills"
        itens={skills}
        categoriasExistentes={categoriasExistentes}
        onAplicado={() => { void carregar(); }}
      />

      {/* v1.265.0 — Revisão profunda do conteúdo da skill aberta no drawer. */}
      {aberta && (
        <RevisaoProfundaModal
          aberto={revisaoProfundaAberta}
          onClose={() => setRevisaoProfundaAberta(false)}
          tipo="skills"
          id={aberta.id}
          nome={aberta.nome}
          onAplicado={(novoConteudo) => {
            setAberta((prev) => prev ? { ...prev, conteudo: novoConteudo } : prev);
            setTraduzido(null);
            void carregar();
          }}
        />
      )}

      {/* Drawer: detalhe de uma skill */}
      <Drawer
        open={!!aberta || carregandoAberta}
        onClose={() => setAberta(null)}
        width={680}
        title={
          aberta ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color={t.accents.lavender} />
              <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberta.nome}</span>
            </span>
          ) : 'Carregando…'
        }
        extra={
          aberta && (
            <div style={{ display: 'flex', gap: 6 }}>
              {/* v1.148.13 — Estrela de favoritar.
                  Atualiza tanto o objeto `aberta` (drawer) quanto a lista geral via toggleFavorita. */}
              <Tooltip title={aberta.favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}>
                <Button
                  icon={<Heart size={14} color={t.accents.peach} fill={aberta.favorita ? t.accents.peach : 'none'} strokeWidth={aberta.favorita ? 1.5 : 1.8} />}
                  onClick={() => {
                    if (!aberta) return;
                    const id = aberta.id;
                    const era = !!aberta.favorita;
                    setAberta((prev) => prev ? { ...prev, favorita: !era, favoritadaEm: era ? '' : new Date().toISOString() } : prev);
                    toggleFavorita(id);
                  }}
                  style={aberta.favorita ? { borderColor: t.accents.peach, color: t.accents.peach, background: `${t.accents.peach}0d` } : undefined}
                />
              </Tooltip>
              <Tooltip title="Copiar conteúdo">
                <Button icon={<Copy size={14} />} onClick={() => { copiarConteudo(aberta.conteudo); registrarUso(aberta.id); }} />
              </Tooltip>
              <Tooltip title="Baixar como .md">
                <Button icon={<Download size={14} />} onClick={() => { baixarMd(aberta); registrarUso(aberta.id); }} />
              </Tooltip>
              {traduzido ? (
                <Segmented
                  size="small"
                  value={verOriginal ? 'orig' : 'pt'}
                  onChange={(v) => setVerOriginal(v === 'orig')}
                  options={[
                    { label: 'Português', value: 'pt' },
                    { label: 'Original', value: 'orig' },
                  ]}
                />
              ) : (
                <Tooltip title="Traduzir descrição e conteúdo para português (fica guardado, não gasta token de novo)">
                  <Button
                    icon={<Languages size={14} />}
                    loading={traduzindo}
                    onClick={() => traduzirSkill()}
                  >
                    {traduzindo ? 'Traduzindo…' : 'Traduzir'}
                  </Button>
                </Tooltip>
              )}
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    ...fontes.map((f) => ({ key: f.chave, label: f.nome })),
                    { key: 'avulsas', label: 'Avulsas / Importadas' },
                  ].filter((o) => o.key !== fonteKey(aberta.fonte))
                    .map((o) => ({ key: o.key, label: o.label, onClick: () => moverSkill(o.key) })),
                }}
              >
                <Tooltip title="Mover para outra pasta">
                  <Button icon={<FolderInput size={14} />} loading={movendo}>Mover</Button>
                </Tooltip>
              </Dropdown>
              <Tooltip title="A IA reescreve o conteúdo completo (clareza, estrutura, especificidade) e mostra o antes/depois — você decide se aplica.">
                <Button
                  icon={<Wand2 size={14} />}
                  onClick={() => setRevisaoProfundaAberta(true)}
                  style={{ borderColor: `${t.accents.lavender}66`, color: t.accents.lavender }}
                >
                  Revisar (IA)
                </Button>
              </Tooltip>
              <Button icon={<Sparkles size={14} />} onClick={() => editarSkill(aberta)}>Editar</Button>
              <Popconfirm
                title="Remover essa skill?"
                description="Não dá pra desfazer pelo Forja (mas o registro continua na planilha)."
                onConfirm={() => deletarSkill(aberta.id)}
                okText="Remover" cancelText="Cancelar"
              >
                <Tooltip title="Remover">
                  <Button icon={<Trash2 size={14} />} danger />
                </Tooltip>
              </Popconfirm>
            </div>
          )
        }
      >
        {carregandoAberta && <Skeleton active paragraph={{ rows: 6 }} />}
        {aberta && (
          <>
            {traduzindo && !traduzido && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                background: `${t.accents.blue}1a`, border: `1px solid ${t.accents.blue}40`,
                borderRadius: 999, padding: '3px 10px',
                fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary,
              }}>
                <Spin size="small" />
                Traduzindo para português…
              </div>
            )}
            {traduzido && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
                borderRadius: 999, padding: '3px 10px',
                fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary,
              }}>
                <Languages size={11} color={t.accents.sage} />
                {verOriginal ? 'Mostrando o original' : 'Traduzido por IA (guardado) · use "Original" pra ver o texto-fonte'}
              </div>
            )}
            {(traduzido && !verOriginal ? traduzido.descricao : aberta.descricao) && (
              <p style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.65, marginTop: 0 }}>
                {traduzido && !verOriginal ? traduzido.descricao : aberta.descricao}
              </p>
            )}

            {/* v1.152.0 — nota de qualidade editável (Lume + ajuste manual) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              padding: '8px 12px', borderRadius: 10,
              background: `${t.accents.peach}0d`, border: `1px solid ${t.accents.peach}30`,
            }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} color={t.accents.peach} /> Qualidade:
              </span>
              <EstrelasQualidade
                valor={aberta.estrelas || 0}
                editavel
                onChange={(n) => definirEstrelas(aberta.id, n)}
                size={18}
              />
              {!!(aberta.estrelas && aberta.estrelas > 0) && aberta.estrelasMotivo && (
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, fontStyle: 'italic' }}>
                  {aberta.estrelasMotivo}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, alignItems: 'center' }}>
              {/* v1.149.0 — id externo (#0237 do pack) com destaque */}
              {aberta.idExterno && (
                <span style={{
                  background: `${t.accents.lavender}1a`, color: t.accents.lavender,
                  border: `1px solid ${t.accents.lavender}40`,
                  fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {aberta.idExterno}
                </span>
              )}
              {aberta.categoria && <Tag color="purple">{aberta.categoria}</Tag>}
              {aberta.tags.map((tag) => <Tag key={tag} icon={<TagIcon size={10} style={{ marginRight: 4 }} />}>{tag}</Tag>)}
              {aberta.fonte && <Tag color="default" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{aberta.fonte}</Tag>}
              {typeof aberta.usos === 'number' && aberta.usos > 0 && (
                <Tooltip title="Quantas vezes essa skill já foi copiada ou baixada">
                  <span style={{
                    background: `${t.accents.peach}1a`, color: t.accents.peach,
                    border: `1px solid ${t.accents.peach}40`,
                    fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Sparkles size={10} />{aberta.usos} {aberta.usos === 1 ? 'uso' : 'usos'}
                  </span>
                </Tooltip>
              )}
              <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
                {bytesHumano(aberta.tamanhoBytes)} · {relTempo(aberta.atualizadoEm)}
              </span>
            </div>

            {/* v1.149.0 — Renderização rica das seções estruturadas (Pack PT-BR ou Claude SKILL.md).
                Se temos blocos parseados, mostra cada um como card. Senão cai pro fallback do
                "índice + markdown bruto" tradicional. Toggle "Markdown raw" pra ver a fonte. */}
            {(aberta.blocos && aberta.blocos.length > 0) ? (
              <SkillBlocosRender
                blocos={aberta.blocos}
                conteudoBruto={traduzido && !verOriginal ? traduzido.conteudo : aberta.conteudo}
                aberta={aberta}
                comoUsar={
                  <ComoUsarSkill
                    skillNome={aberta.nome}
                    skillFonte={aberta.fonte}
                    conteudoMd={traduzido && !verOriginal ? traduzido.conteudo : aberta.conteudo}
                  />
                }
              />
            ) : (
              <>
                {/* Fallback: estrutura antiga (índice + ComoUsar + raw) */}
                {aberta.parsed.secoes.length > 0 && (
                  <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Eye size={13} color={t.accents.lavender} />
                      <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>O que essa skill cobre</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {aberta.parsed.secoes.map((sc) => (
                        <span key={sc} style={{
                          background: t.surface, color: t.textSecondary,
                          border: `1px solid ${t.border}`, borderRadius: 999,
                          padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 11,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          <CheckCircle2 size={10} color={t.accents.sage} />
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <ComoUsarSkill
                  skillNome={aberta.nome}
                  skillFonte={aberta.fonte}
                  conteudoMd={traduzido && !verOriginal ? traduzido.conteudo : aberta.conteudo}
                />
                <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 6, marginTop: 12 }}>
                  {traduzido && !verOriginal ? 'Conteúdo Markdown (traduzido)' : 'Conteúdo Markdown'}
                </div>
                <pre style={{
                  background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                  borderRadius: 10, padding: 14, fontFamily: FONTS.mono,
                  fontSize: 12, color: t.text, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 'calc(100vh - 360px)', overflow: 'auto',
                }}>
                  {traduzido && !verOriginal ? traduzido.conteudo : aberta.conteudo}
                </pre>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Modal: editar nome/descrição/cor de uma pasta */}
      <Modal
        open={!!editandoFonte}
        onCancel={() => setEditandoFonte(null)}
        onOk={salvarFonte}
        confirmLoading={salvandoFonte}
        okText="Salvar"
        cancelText="Cancelar"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Package size={16} color={fonteCor || t.accents.lavender} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Editar pasta</span>
          </span>
        }
      >
        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="Nome da pasta">
            <Input value={fonteNome} onChange={(e) => setFonteNome(e.target.value)} placeholder="ex.: GAS App Kit" />
          </Form.Item>
          <Form.Item label="Descrição">
            <Input.TextArea
              value={fonteDesc}
              onChange={(e) => setFonteDesc(e.target.value)}
              placeholder="Pra que serve esse pacote, de onde veio…"
              rows={3}
            />
          </Form.Item>
          <Form.Item label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Palette size={13} /> Cor da pasta</span>} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.values(t.accents).map((c) => {
                const cor = String(c);
                const sel = fonteCor === cor;
                return (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setFonteCor(cor)}
                    title={cor}
                    style={{
                      width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                      background: cor, border: `2px solid ${sel ? t.text : 'transparent'}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: t.shadowSoft,
                    }}
                  >
                    {sel && <Check size={14} color="#fff" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setFonteCor('')}
                title="Padrão"
                style={{
                  height: 28, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
                  background: t.surfaceMuted, border: `1.5px solid ${fonteCor === '' ? t.text : t.border}`,
                  fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary,
                }}
              >
                Padrão
              </button>
            </div>
          </Form.Item>
        </Form>

        {/* v1.152.0 — "Avulsas" é bucket sintético: não dá pra remover (não há
            pasta real). Editar só personaliza o nome/cor; o lixo some. */}
        {editandoFonte?.chave !== 'avulsas' && editandoFonte?.id ? (
          <div style={{ borderTop: `1px solid ${t.borderSoft}`, marginTop: 18, paddingTop: 14 }}>
            <Popconfirm
              title="Remover esta pasta?"
              description="As skills dela vão para 'Avulsas' (não são apagadas)."
              onConfirm={removerFonte}
              okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
            >
              <Button danger icon={<Trash2 size={14} />} loading={removendoFonte}>Remover pasta</Button>
            </Popconfirm>
          </div>
        ) : editandoFonte?.chave === 'avulsas' ? (
          <div style={{ borderTop: `1px solid ${t.borderSoft}`, marginTop: 18, paddingTop: 14, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            Esta é a pasta padrão de skills importadas avulsas. Você pode renomeá-la, mas ela não pode ser removida.
          </div>
        ) : null}
      </Modal>

      {/* Modal: importar pacote (vários .md sob um nome) */}
      <Modal
        open={importOpen}
        onCancel={() => { if (!importando) { setImportOpen(false); } }}
        onOk={importarPacote}
        confirmLoading={importando}
        okText={impArquivos.length > 0 ? `Importar ${impArquivos.length} skill(s)` : 'Importar'}
        cancelText="Cancelar"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FolderPlus size={16} color={t.accents.lavender} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Importar pacote</span>
          </span>
        }
      >
        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="Nome do pacote" required>
            <Input value={impNome} onChange={(e) => setImpNome(e.target.value)} placeholder="ex.: Anthropic Cookbook" />
          </Form.Item>
          <Form.Item label="Descrição (opcional)">
            <Input.TextArea
              value={impDesc}
              onChange={(e) => setImpDesc(e.target.value)}
              placeholder="De quem é, pra que serve, link da fonte…"
              rows={2}
            />
          </Form.Item>
          <Form.Item label="Arquivos da skill (.md)" style={{ marginBottom: 0 }}>
            <Upload.Dragger
              accept=".md,.markdown,.txt"
              multiple
              showUploadList={false}
              beforeUpload={onUploadPacote}
              style={{ background: t.surfaceMuted }}
            >
              <p style={{ margin: 0 }}>
                <UploadIcon size={26} color={t.accents.lavender} style={{ display: 'inline-block', marginBottom: 6 }} />
              </p>
              <p style={{ fontFamily: FONTS.ui, color: t.text, margin: '4px 0', fontSize: 13.5 }}>
                Arraste os <code style={{ fontFamily: FONTS.mono, fontSize: 12 }}>.md</code> do pacote aqui (pode vários)
              </p>
            </Upload.Dragger>
            {impArquivos.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {impArquivos.map((a, i) => (
                  <Tag
                    key={`${a.nome}-${i}`}
                    closable
                    onClose={() => setImpArquivos((arr) => arr.filter((_, j) => j !== i))}
                    icon={<FileText size={11} style={{ marginRight: 4 }} />}
                    style={{ fontFamily: FONTS.mono, fontSize: 11 }}
                  >
                    {a.nome}
                  </Tag>
                ))}
              </div>
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: exportar (.zip) com parametrização de ambiente */}
      <Modal
        open={exportOpen}
        onCancel={() => { if (!gerando) setExportOpen(false); }}
        width={expFase === 'preview' ? 720 : 560}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Archive size={16} color={t.accents.lavender} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
              {expFase === 'preview' ? 'Revisar o que a IA mudou' : 'Exportar kit'}
            </span>
          </span>
        }
        footer={expFase === 'preview' ? [
          <Button key="voltar" onClick={() => setExpFase('config')} disabled={gerando}>Voltar</Button>,
          <Button key="baixar" type="primary" icon={<Archive size={14} />} onClick={() => finalizarDownload(expResultado)}>
            Baixar .zip
          </Button>,
        ] : [
          <Button key="cancelar" onClick={() => setExportOpen(false)} disabled={gerando}>Cancelar</Button>,
          <Button key="ok" type="primary" loading={gerando} onClick={confirmarExport}>
            {expAdaptar ? 'Pré-visualizar' : 'Gerar .zip'}
          </Button>,
        ]}
      >
        {expFase === 'preview' ? (
          <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
            <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginTop: 4 }}>
              A IA adaptou {expResultado.length} skill(s) para <strong>{ambienteTexto() || 'o ambiente'}</strong>.
              Revise abaixo e baixe quando estiver ok. As skills originais no Forja não são alteradas.
            </p>
            <Collapse
              accordion
              bordered={false}
              items={expResultado.map((s) => {
                const mudou = (s.original || '') !== s.conteudo;
                const ver = previewVer[s.id] || 'adaptado';
                return {
                  key: s.id,
                  style: { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color={t.accents.lavender} />
                      <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{s.nome}</span>
                      {mudou ? (
                        <Tag color="purple" style={{ marginInlineEnd: 0 }}>adaptada</Tag>
                      ) : (
                        <Tag style={{ marginInlineEnd: 0 }}>sem mudança</Tag>
                      )}
                    </span>
                  ),
                  children: (
                    <div>
                      <Segmented
                        size="small"
                        value={ver}
                        onChange={(v) => setPreviewVer((prev) => ({ ...prev, [s.id]: v as 'adaptado' | 'original' }))}
                        options={[{ label: 'Adaptado', value: 'adaptado' }, { label: 'Original', value: 'original' }]}
                        style={{ marginBottom: 8 }}
                      />
                      <pre style={{
                        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 8,
                        padding: 12, fontFamily: FONTS.mono, fontSize: 11.5, color: t.text, lineHeight: 1.5,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 360, overflow: 'auto', margin: 0,
                      }}>
                        {ver === 'original' ? (s.original || '') : s.conteudo}
                      </pre>
                    </div>
                  ),
                };
              })}
            />
          </div>
        ) : (
        <>
        <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginTop: 4 }}>
          {exportIds.length} skill(s) → <code style={{ fontFamily: FONTS.mono }}>skills/&lt;nome&gt;/SKILL.md</code> + README,
          pronto pra extrair na raiz do projeto.
        </p>
        <Form layout="vertical" style={{ marginTop: 4 }}>
          <Form.Item label="Nome do kit">
            <Input value={kitNome} onChange={(e) => setKitNome(e.target.value)} placeholder="ex.: Kit Windows" />
          </Form.Item>

          <Form.Item label="Onde vai usar (IDE)" style={{ marginBottom: 12 }}>
            <Segmented
              block
              value={expTarget}
              onChange={(v) => setExpTarget(v as ExportTarget)}
              options={[
                { label: 'Cursor', value: 'cursor' },
                { label: 'Claude Code', value: 'claude' },
                { label: 'Genérico', value: 'generic' },
              ]}
            />
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 6 }}>
              {expTarget === 'cursor' && 'Gera .cursor/rules/<skill>.mdc (com frontmatter) — extrai na raiz e o Cursor lê sozinho.'}
              {expTarget === 'claude' && (
                <>
                  Gera <code>&lt;skill&gt;/SKILL.md</code> + <strong><code>install.sh</code> interativo</strong>.
                  Você roda <code>bash install.sh</code> e ele pergunta:
                  global (<code>~/.claude/skills/</code>, vale em todos os projetos)
                  ou local (<code>./.claude/skills/</code>, só este projeto, versionado).
                </>
              )}
              {expTarget === 'generic' && 'Gera skills/<skill>/SKILL.md — formato padrão de agent-skills (Claude.ai e outras).'}
            </div>
          </Form.Item>

          <Form.Item label="Ambiente alvo (opcional)" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Button size="small" onClick={() => { setExpSO('Windows'); setExpShell('PowerShell'); }}>Windows + PowerShell</Button>
              <Button size="small" onClick={() => { setExpSO('macOS'); setExpShell('zsh'); }}>macOS + zsh</Button>
              <Button size="small" onClick={() => { setExpSO('Linux'); setExpShell('bash'); }}>Linux + bash</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>Sistema</div>
                <Segmented
                  block
                  size="small"
                  value={expSO}
                  onChange={(v) => setExpSO(v as string)}
                  options={['—', 'Windows', 'macOS', 'Linux']}
                />
              </div>
              <div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>Shell</div>
                <Segmented
                  block
                  size="small"
                  value={expShell}
                  onChange={(v) => setExpShell(v as string)}
                  options={['—', 'PowerShell', 'bash', 'zsh', 'cmd']}
                />
              </div>
            </div>
            <Input.TextArea
              value={expExtra}
              onChange={(e) => setExpExtra(e.target.value)}
              placeholder="Contexto extra: stack, IDE, regras do projeto… (ex.: Node 20, monorepo, usar pnpm)"
              rows={2}
              style={{ marginTop: 10 }}
            />
          </Form.Item>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12 }}>
            <Checkbox checked={expContexto} onChange={(e) => setExpContexto(e.target.checked)}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>Incluir contexto do ambiente</span>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginLeft: 24 }}>
                Adiciona um <code style={{ fontFamily: FONTS.mono }}>AGENTS.md</code> e um cabeçalho em cada SKILL.md. Grátis, instantâneo.
              </div>
            </Checkbox>
            <Checkbox checked={expAdaptar} onChange={(e) => setExpAdaptar(e.target.checked)}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                Adaptar o conteúdo com IA <Sparkles size={12} style={{ display: 'inline', verticalAlign: 'middle' }} color={t.accents.lavender} />
              </span>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginLeft: 24 }}>
                Reescreve comandos/caminhos pro ambiente (bash→PowerShell etc.). Usa tokens e demora mais.
              </div>
            </Checkbox>
            {expAdaptar && !ambienteTexto() && (
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.peach, marginLeft: 24 }}>
                Defina o ambiente acima pra IA saber pra onde adaptar.
              </div>
            )}
          </div>
        </Form>
        </>
        )}
      </Modal>
    </>
  );
}

// ─── Sub-componente: card de uma skill na lista ───────────────────────────
function SkillCard({ skill, onOpen, selMode = false, selecionado = false, onToggleSel, onToggleFavorita }: {
  skill: SkillSummary;
  onOpen: () => void;
  selMode?: boolean;
  selecionado?: boolean;
  onToggleSel?: () => void;
  onToggleFavorita?: () => void;
}): React.ReactElement {
  const t = useTokens();
  // v1.148.13 — favorita: borda dourada + estrela preenchida.
  // Cor `gold` aproximada do design system Forja: laranja-âmbar (`peach`).
  const corFavorita = t.accents.peach;
  return (
    <div
      onClick={() => { if (selMode) { onToggleSel?.(); } else { onOpen(); } }}
      style={{
        background: selMode && selecionado ? `${t.accents.lavender}10` : skill.favorita ? `${corFavorita}06` : t.surface,
        border: `1.5px solid ${
          selMode && selecionado ? t.accents.lavender
          : skill.favorita ? `${corFavorita}55`
          : t.border
        }`,
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        transition: 'all 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 140,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = skill.favorita ? corFavorita : t.accents.lavender;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = `0 4px 14px ${t.shadowSoft || 'rgba(0,0,0,0.05)'}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = selMode && selecionado ? t.accents.lavender : skill.favorita ? `${corFavorita}55` : t.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* v1.148.13 — Estrela de favoritar no canto superior direito.
          stopPropagation evita disparar onOpen. Em selMode fica oculta pra não
          competir visualmente com o checkbox. */}
      {!selMode && onToggleFavorita && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorita(); }}
          aria-label={skill.favorita ? 'Desfavoritar' : 'Favoritar'}
          title={skill.favorita ? 'Remover dos favoritos' : 'Marcar como favorita (sobe pro topo)'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: 8,
            background: skill.favorita ? `${corFavorita}1a` : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${corFavorita}26`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = skill.favorita ? `${corFavorita}1a` : 'transparent'; }}
        >
          <Heart
            size={14}
            color={corFavorita}
            fill={skill.favorita ? corFavorita : 'none'}
            strokeWidth={skill.favorita ? 1.5 : 1.8}
          />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: !selMode && onToggleFavorita ? 32 : 0 }}>
        {selMode ? (
          <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Checkbox checked={selecionado} />
          </div>
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: skill.favorita ? `${corFavorita}1a` : `${t.accents.lavender}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookMarked size={15} color={skill.favorita ? corFavorita : t.accents.lavender} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {skill.nome || '(sem nome)'}
          </div>
          {/* v1.152.0 — nota de qualidade da Lume (some quando 0) */}
          {(!!(skill.estrelas && skill.estrelas > 0) || !!skill.revisadaIAEm) && (
            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {!!(skill.estrelas && skill.estrelas > 0) && (
                <EstrelasQualidade valor={skill.estrelas} motivo={skill.estrelasMotivo} avaliadaEm={skill.avaliadaEm} size={12} />
              )}
              {/* v1.266.0 — selo "Revisada": passou pelo Otimizador IA do Atelier. */}
              {!!skill.revisadaIAEm && (
                <Tooltip title={`Revisada pelo Otimizador IA da Forja em ${new Date(skill.revisadaIAEm).toLocaleDateString('pt-BR')} — sai das rodadas "Ainda não revisadas".`}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontFamily: FONTS.ui, fontSize: 9.5, fontWeight: 600,
                    color: t.accents.sage, background: `${t.accents.sage}1f`,
                    border: `1px solid ${t.accents.sage}55`,
                    borderRadius: 999, padding: '1px 7px', letterSpacing: 0.2,
                  }}>
                    <CheckCircle2 size={9} /> Revisada · IA
                  </span>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {/* v1.149.0 — Preview "QUANDO USAR" (clamped 2 linhas) tem prioridade
          sobre a descrição. Cai pra descricaoPt → descricao se não houver. */}
      {(skill.quandoUsar || skill.descricaoPt || skill.descricao) && (
        <p style={{
          margin: 0, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
        }}>
          {skill.quandoUsar || skill.descricaoPt || skill.descricao}
        </p>
      )}

      {skill.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
          {skill.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              style={{
                background: t.surfaceMuted, color: t.textTertiary,
                fontFamily: FONTS.ui, fontSize: 10,
                padding: '1px 7px', borderRadius: 999,
              }}
            >
              {tag}
            </span>
          ))}
          {skill.tags.length > 4 && <span style={{ fontSize: 10, color: t.textTertiary }}>+{skill.tags.length - 4}</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* v1.149.0 — id externo (#0237 do pack) sempre exibido se houver */}
          {skill.idExterno && (
            <span style={{ fontFamily: FONTS.mono, color: t.accents.lavender, fontWeight: 600 }}>
              {skill.idExterno}
            </span>
          )}
          <span>{bytesHumano(skill.tamanhoBytes)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* v1.149.0 — contador de usos quando > 0 */}
          {typeof skill.usos === 'number' && skill.usos > 0 && (
            <span style={{
              fontFamily: FONTS.ui, fontWeight: 600, color: t.accents.peach,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Sparkles size={9} />{skill.usos}
            </span>
          )}
          <span>{relTempo(skill.atualizadoEm)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── v1.150.1 — Render adaptativo do conteúdo de um bloco ───────────────
// Detecta o formato do `conteudo` e escolhe o render certo:
// - Tabela markdown (linhas com `|` e separador `|---|`)  → <table>
// - Lista de slugs (capacidades, requisitos, habilidades_relacionadas) → chips
// - Tudo o mais: texto pre-wrap (preserva quebras e indentação)
function BlocoConteudoRender({ chave, conteudo, cor }: {
  chave: string;
  conteudo: string;
  cor: string;
}): React.ReactElement {
  const t = useTokens();

  // 1) TABELA MARKDOWN — Detecta `| ... | ... |` com linha separadora `|---|---|`.
  // O exemplo "Arestas Perigosas" do vibeship usa esse padrão.
  const linhasTab = conteudo.split('\n').filter((l) => l.trim().startsWith('|'));
  if (linhasTab.length >= 2 && /^\|[\s\-:|]+\|$/.test(linhasTab[1]?.trim() || '')) {
    const cells = (linha: string): string[] => linha.trim().slice(1, -1).split('|').map((c) => c.trim());
    const headers = cells(linhasTab[0]);
    const rows = linhasTab.slice(2).map(cells);
    const antesTab = conteudo.split('\n').slice(0, conteudo.split('\n').findIndex((l) => l.trim().startsWith('|'))).join('\n').trim();
    return (
      <>
        {antesTab && (
          <div style={{
            fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary,
            lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 8,
          }}>
            {antesTab}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: FONTS.ui, fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: t.surfaceMuted }}>
                {headers.map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left', padding: '8px 10px',
                    border: `1px solid ${t.borderSoft}`,
                    fontFamily: FONTS.display, fontWeight: 600, color: t.text,
                    fontSize: 11.5,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '8px 10px',
                      border: `1px solid ${t.borderSoft}`,
                      color: t.textSecondary, verticalAlign: 'top',
                      lineHeight: 1.5,
                    }}>
                      {/* v1.150.1 — destaca severidade na 2ª coluna se for tabela
                          tipo "Problema/Severidade/Solução" do vibeship */}
                      {ci === 1 && /^(critica|alta|media|baixa|critical|high|medium|low)$/i.test(cell.trim())
                        ? <SeveridadeBadge nivel={cell.trim()} />
                        : cell
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // 2) LISTA DE SLUGS (capacidades, requisitos, habilidades_relacionadas) →
  // detecta linhas tipo "- foo-bar" ou items em backticks.
  const ehListaSlugs = ['capacidades', 'requisitos', 'habilidades_relacionadas'].indexOf(chave) >= 0;
  if (ehListaSlugs) {
    // Extrai todos os tokens: bullets `- slug`, `\`slug\``, `[slug]`.
    const slugs: string[] = [];
    const bulletMatches = conteudo.match(/^[\s\-\*]+([a-z0-9][a-z0-9\-_]*)/gm) || [];
    for (const b of bulletMatches) slugs.push(b.replace(/^[\s\-\*]+/, '').trim());
    const tickMatches = conteudo.match(/`([a-z0-9][a-z0-9\-_]*)`/g) || [];
    for (const bt of tickMatches) slugs.push(bt.slice(1, -1));
    const seen = new Set<string>();
    const dedup = slugs.filter((s) => { if (seen.has(s)) return false; seen.add(s); return true; });
    if (dedup.length > 0) {
      // Texto livre fora dos slugs (ex.: "Funciona bem com:" do vibeship).
      const textoLivre = conteudo
        .split('\n')
        .filter((l) => !l.trim().match(/^[\s\-\*]+[a-z0-9][a-z0-9\-_]*$/i))
        .filter((l) => !/^[\s\-\*]*`[a-z0-9\-_]+`[,\s`a-z0-9\-_]*$/i.test(l.trim()))
        .join('\n').trim();
      return (
        <>
          {textoLivre && (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
              lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap',
            }}>
              {textoLivre}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {dedup.map((s) => (
              <span key={s} style={{
                background: `${cor}1a`, color: cor,
                border: `1px solid ${cor}40`,
                fontFamily: FONTS.mono, fontSize: 11,
                padding: '3px 10px', borderRadius: 999,
              }}>
                {s}
              </span>
            ))}
          </div>
        </>
      );
    }
  }

  // 3) Default: texto preservando formatação
  return (
    <div style={{
      fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.65,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {conteudo}
    </div>
  );
}

function SeveridadeBadge({ nivel }: { nivel: string }): React.ReactElement {
  const t = useTokens();
  const n = nivel.toLowerCase();
  const cor = /critica|critical/.test(n) ? '#dc2626'
    : /alta|high/.test(n) ? t.accents.peach
    : /media|medium/.test(n) ? '#f59e0b'
    : t.accents.sage;
  return (
    <span style={{
      background: `${cor}1a`, color: cor,
      border: `1px solid ${cor}55`,
      fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      display: 'inline-block',
    }}>
      {nivel}
    </span>
  );
}

// ─── v1.149.0 — Renderização rica dos blocos estruturados ─────────────────
// Substitui o "dump de markdown bruto" por um layout visual baseado nas seções
// que o parser detectou. Cada bloco vira um card; reconhece os blocos famosos
// do "Pack PT-BR" (QUANDO USAR, IDENTIDADE E PAPEL, PRINCÍPIOS, etc.) e pinta
// com ícone + cor de destaque coerente. Permite alternar pra Markdown raw.
function SkillBlocosRender({ blocos, conteudoBruto, aberta, comoUsar }: {
  blocos: SkillBloco[];
  conteudoBruto: string;
  aberta: SkillFull;
  comoUsar: React.ReactNode;
}): React.ReactElement {
  const t = useTokens();
  const [view, setView] = useState<'estruturado' | 'markdown'>('estruturado');

  // Metadado visual de cada chave canônica (cor + ícone + descrição).
  // v1.150.1 — Adicionadas chaves do formato vibeship-spawner.
  const META_BLOCO: Record<string, { cor: keyof typeof t.accents; icon: React.ReactNode; sub?: string }> = {
    metadados: { cor: 'lavender', icon: <Info size={13} />, sub: 'Identificação' },
    quando_usar: { cor: 'peach', icon: <Sparkles size={13} />, sub: 'Gatilho de ativação' },
    identidade: { cor: 'blue', icon: <BookMarked size={13} />, sub: 'Persona da skill' },
    pre_execucao: { cor: 'sage', icon: <ListChecks size={13} />, sub: 'Coleta de contexto' },
    principios: { cor: 'lavender', icon: <CheckCircle2 size={13} />, sub: 'Princípios operacionais' },
    regras: { cor: 'peach', icon: <FileText size={13} />, sub: 'Regras de execução' },
    boas_praticas: { cor: 'sage', icon: <Sparkles size={13} />, sub: 'Padrões de excelência' },
    framework: { cor: 'blue', icon: <Package size={13} />, sub: 'Formato de entrega' },
    checklist: { cor: 'sage', icon: <CheckCircle2 size={13} />, sub: 'Verificação final' },
    exemplos: { cor: 'lavender', icon: <Eye size={13} />, sub: 'Casos de uso' },
    antipadroes: { cor: 'peach', icon: <X size={13} />, sub: 'O que NÃO fazer' },
    // v1.150.1 — novos
    capacidades: { cor: 'blue', icon: <CheckCircle2 size={13} />, sub: 'Habilidades nucleares' },
    requisitos: { cor: 'peach', icon: <ListChecks size={13} />, sub: 'Pré-requisitos / dependências' },
    arestas_perigosas: { cor: 'peach', icon: <X size={13} />, sub: 'Armadilhas e gotchas' },
    habilidades_relacionadas: { cor: 'lavender', icon: <FolderInput size={13} />, sub: 'Combina bem com' },
    outra: { cor: 'lavender', icon: <FileText size={13} /> },
  };

  const filtraBlocos = blocos.filter((b) => b.conteudo.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented
        size="small"
        value={view}
        onChange={(v) => setView(v as 'estruturado' | 'markdown')}
        options={[
          { label: 'Estruturado', value: 'estruturado' },
          { label: 'Markdown raw', value: 'markdown' },
        ]}
      />

      {view === 'estruturado' ? (
        <>
          {filtraBlocos.map((bloco, idx) => {
            const meta = META_BLOCO[bloco.chave] || META_BLOCO.outra;
            const cor = t.accents[meta.cor];
            return (
              <div
                key={`${bloco.chave}-${idx}`}
                style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderLeft: `3px solid ${cor}`,
                  borderRadius: 10, padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: `${cor}1a`, color: cor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text,
                      lineHeight: 1.3,
                    }}>
                      {bloco.titulo}
                    </div>
                    {meta.sub && (
                      <div style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, marginTop: 1 }}>
                        {meta.sub}
                      </div>
                    )}
                  </div>
                </div>
                {/* v1.150.1 — Render adaptativo do conteúdo: tabelas markdown
                    viram <table>, blocos "lista de slugs" (capacidades, requisitos,
                    habilidades_relacionadas) viram chips. Cai pro texto pre-wrap
                    quando não bate nenhum desses padrões. */}
                <BlocoConteudoRender chave={bloco.chave} conteudo={bloco.conteudo} cor={cor} />
              </div>
            );
          })}

          {/* v1.149.0 — Relacionadas: chips com slugs/ids vindos do bloco METADADOS */}
          {aberta.relacionadas && aberta.relacionadas.length > 0 && (
            <div style={{
              background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FolderInput size={13} color={t.accents.lavender} />
                <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>
                  Skills relacionadas
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {aberta.relacionadas.map((rel) => (
                  <span
                    key={rel}
                    title="Cole o slug na busca pra abrir essa skill"
                    style={{
                      background: t.surface, color: t.accents.lavender,
                      border: `1px solid ${t.accents.lavender}40`,
                      fontFamily: FONTS.mono, fontSize: 11,
                      padding: '3px 10px', borderRadius: 999,
                    }}
                  >
                    {rel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* "Como usar em cada IDE" — sempre embaixo. */}
          {comoUsar}
        </>
      ) : (
        <pre style={{
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
          borderRadius: 10, padding: 14, fontFamily: FONTS.mono,
          fontSize: 12, color: t.text, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 'calc(100vh - 360px)', overflow: 'auto', margin: 0,
        }}>
          {conteudoBruto}
        </pre>
      )}
    </div>
  );
}
