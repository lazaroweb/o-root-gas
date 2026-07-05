// FinPessoal — mini sistema financeiro pessoal embutido na aba Financeiro.
//
// Estrutura:
//   • Header com seletor de mês (← Mês ano →)
//   • Cards de resumo: gasto do mês, saldo, pendentes, próximos 7d
//   • Segmented com 4 sub-views:
//       1. Visão (categoria + método)
//       2. Lançamentos (lista + CRUD)
//       3. Cartões (grid + fatura aberta ao clicar)
//       4. Contas a pagar (pendentes/agendadas)
//
// Dados: lê via callServer das funções server-side getResumoFinPessoal,
// getLancamentosPessoais, getCartoesPessoais, getFaturaAberta etc.
// Persistência: sheets dedicados FinPessoalLancamentos + FinPessoalCartoes
// (separados dos Custos/Receitas do negócio).
import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, AutoComplete,
  App as AntApp, Popconfirm, Empty, Tooltip, Drawer, Progress, Radio, Alert, Tabs, Checkbox,
} from 'antd';
import {
  Plus, ChevronLeft, ChevronRight, Wallet, TrendingDown, TrendingUp,
  CreditCard, Smartphone, Banknote, FileText, ArrowLeftRight, AlertCircle,
  Pencil, Trash2, Calendar, CheckCircle2, Clock, ArrowDownRight, ArrowUpRight,
  RotateCcw, Layers as LayersIcon, Target, Sparkles, PauseCircle, PlayCircle, Repeat, History,
  Upload, FileUp, Compass, Users, CalendarRange, FileDown, BadgeCheck, BadgePlus,
  // Ícones de categoria — outline lucide, mesmo padrão da sidebar
  ShoppingCart, Car, Utensils, Gamepad2, Pill, Home, Lightbulb, Tv, BookOpen, Shirt,
  PawPrint, Plane, Briefcase, Laptop, Package, Tag as TagIcon,
  Film, Dumbbell, Beer, Coffee, Bus, Fuel, Palette, Music, Hospital, Smile,
  Baby, GraduationCap, Gift, Flower, Pizza, Wine, Bath, Sofa, Wrench, Phone, Heart,
  Camera, Headphones, Trees, Mountain, Bike, Bookmark, Coins, DollarSign, Globe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Panel, formatBRL, Skeleton } from '../components/ui';
import { MembroChipAvatar, membroIconeComponent } from '../components/membroIcone';
import SubNav from '../components/SubNav';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf } from '../pdf-client';
import { composicaoFaturaMes } from '../lib/faturaComposicao';
import FinMesExecutivo from './FinMesExecutivo';
import FinAssinaturas from './FinAssinaturas';
import FinInteligencia from './FinInteligencia';
import FinPerfil from './FinPerfil';
import FinFamilia from './FinFamilia';
import FinIR from './FinIR';
import type {
  LancamentoPessoal, CartaoPessoal, ResumoFinPessoal, FaturaAberta, LancamentosCartao,
  MetodoPagamento, StatusLancamento, TipoLancamento, ServerResponse,
  RecorrenciaAtiva, OrcamentoPessoal, ProgressoOrcamentos, ProgressoOrcamentoItem,
  CategoriaPessoal, AssinaturaPessoal, ResumoAssinaturas,
  FaturaInterpretada, FaturaItemIA, PlanoConta, FamiliaMembro, MesExecutivo,
  ConciliacaoFatura,
} from '../types';

// ─── Constantes de UI ──────────────────────────────────────────────────────────

// Fallback de categorias enquanto o server não retorna. Vibe code: a UI nunca
// fica em branco — usa essas 16 padrão pra renderizar até a primeira resposta
// real chegar. Após o seed, o server passa a ser fonte da verdade.
const CATEGORIAS_FALLBACK: CategoriaPessoal[] = [
  { id: 'f1', nome: 'mercado', label: 'Mercado', emoji: '🛒', icone: 'shopping-cart', cor: '#10b981', ordem: 1, ativo: 'sim' },
  { id: 'f2', nome: 'transporte', label: 'Transporte', emoji: '🚗', icone: 'car', cor: '#3b82f6', ordem: 2, ativo: 'sim' },
  { id: 'f3', nome: 'alimentacao', label: 'Alimentação', emoji: '🍔', icone: 'utensils', cor: '#f59e0b', ordem: 3, ativo: 'sim' },
  { id: 'f4', nome: 'lazer', label: 'Lazer', emoji: '🎮', icone: 'gamepad-2', cor: '#a855f7', ordem: 4, ativo: 'sim' },
  { id: 'f5', nome: 'saude', label: 'Saúde', emoji: '💊', icone: 'pill', cor: '#ef4444', ordem: 5, ativo: 'sim' },
  { id: 'f6', nome: 'casa', label: 'Casa', emoji: '🏠', icone: 'home', cor: '#84cc16', ordem: 6, ativo: 'sim' },
  { id: 'f7', nome: 'outros', label: 'Outros', emoji: '📦', icone: 'package', cor: '#6b7280', ordem: 99, ativo: 'sim' },
];

// Resolve emoji + label + cor de uma categoria pelo nome. Aceita string vazia.
function resolverCategoria(nome: string, categorias: CategoriaPessoal[]): CategoriaPessoal {
  const found = categorias.find((c) => c.nome === nome);
  if (found) return found;
  // Categoria ad-hoc (string livre que ainda não virou registro): renderiza
  // com nome bruto + emoji default.
  return { id: 'ad-hoc', nome, label: nome, emoji: '📦', cor: '#6b7280', ordem: 99, ativo: 'sim' };
}

// Helper de display textual: usado em contextos onde JSX não dá (dropdowns
// nativos, tooltips, mensagens toast). Em UI rica, usar IconeCategoria.
// Degrada bem: se a categoria não tem emoji (caso novo), mostra só o label.
function labelComEmoji(nome: string, categorias: CategoriaPessoal[]): string {
  const c = resolverCategoria(nome, categorias);
  return c.emoji ? `${c.emoji} ${c.label}` : c.label;
}

// ─── Registro de ícones lucide pra categorias ────────────────────────────────
// Mapeia nomes kebab-case (como salvos no Sheet) pra componentes lucide reais.
// Mesma família de ícones outline da sidebar pra coesão visual total.
// Pra adicionar um ícone novo: importa lá em cima e adiciona aqui.
const ICONE_REGISTRY: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart, 'car': Car, 'utensils': Utensils, 'gamepad-2': Gamepad2,
  'pill': Pill, 'home': Home, 'lightbulb': Lightbulb, 'tv': Tv, 'book-open': BookOpen,
  'shirt': Shirt, 'paw-print': PawPrint, 'plane': Plane, 'trending-up': TrendingUp,
  'briefcase': Briefcase, 'laptop': Laptop, 'package': Package, 'tag': TagIcon,
  'film': Film, 'dumbbell': Dumbbell, 'beer': Beer, 'coffee': Coffee,
  'bus': Bus, 'fuel': Fuel, 'palette': Palette, 'music': Music, 'hospital': Hospital,
  'smile': Smile, 'baby': Baby, 'graduation-cap': GraduationCap,
  'credit-card': CreditCard, 'wallet': Wallet, 'gift': Gift, 'flower': Flower,
  'pizza': Pizza, 'wine': Wine, 'bath': Bath, 'sofa': Sofa, 'wrench': Wrench,
  'phone': Phone, 'heart': Heart, 'camera': Camera, 'headphones': Headphones,
  'trees': Trees, 'mountain': Mountain, 'bike': Bike, 'bookmark': Bookmark,
  'coins': Coins, 'dollar-sign': DollarSign, 'globe': Globe,
};

// Lista pro picker (ordem ergonômica — categorias mais comuns primeiro).
const ICONES_DISPONIVEIS: string[] = [
  'shopping-cart', 'utensils', 'pizza', 'coffee', 'beer', 'wine',
  'car', 'bus', 'bike', 'plane', 'fuel',
  'home', 'sofa', 'bath', 'wrench', 'lightbulb',
  'shirt', 'tv', 'film', 'music', 'gamepad-2', 'headphones',
  'pill', 'hospital', 'dumbbell', 'heart', 'smile',
  'book-open', 'graduation-cap',
  'baby', 'paw-print', 'flower', 'trees', 'mountain',
  'gift', 'camera', 'phone', 'globe',
  'briefcase', 'laptop', 'palette',
  'credit-card', 'wallet', 'coins', 'dollar-sign', 'trending-up',
  'package', 'bookmark', 'tag',
];

// Resolve componente do ícone pelo nome. Fallback: Tag (gen\xE9rico).
function getIconeComponente(nome?: string): LucideIcon {
  if (!nome) return TagIcon;
  return ICONE_REGISTRY[nome] || TagIcon;
}

// Renderiza ícone de categoria no estilo "badge" — mini-box arredondada com
// cor de fundo tênue (10% opacidade) e o ícone outline na cor sólida da
// categoria. Mesmo estilo de "chip" que a sidebar usa.
function IconeCategoria({ nome, cor, size = 18, boxSize = 38 }: {
  nome?: string; cor: string; size?: number; boxSize?: number;
}): React.ReactElement {
  const Icon = getIconeComponente(nome);
  return (
    <div style={{
      width: boxSize, height: boxSize, borderRadius: 10,
      background: `${cor}12`,
      border: `1px solid ${cor}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={size} color={cor} strokeWidth={1.6} />
    </div>
  );
}

// Context pra evitar prop-drilling de categorias por toda a árvore.
const CategoriasContext = createContext<CategoriaPessoal[]>(CATEGORIAS_FALLBACK);

// Hooks de conveniência: encapsulam o lookup e tornam o código de uso mais limpo.
// labelCategoria('mercado') → "🛒 Mercado". corDaCategoria('mercado') → '#10b981'.
function useLabelCategoria(): (nome: string) => string {
  const categorias = useContext(CategoriasContext);
  return useCallback((nome: string) => labelComEmoji(nome, categorias), [categorias]);
}
function useCorDaCategoria(): (nome: string) => string {
  const categorias = useContext(CategoriasContext);
  return useCallback((nome: string) => resolverCategoria(nome, categorias).cor, [categorias]);
}

// Métodos com ícone + cor consistente.
const METODOS: Array<{ value: MetodoPagamento; label: string; icon: React.ReactNode; cor: string }> = [
  { value: 'cartao', label: 'Cartão', icon: <CreditCard size={14} />, cor: '#8b5cf6' },
  { value: 'pix', label: 'Pix', icon: <Smartphone size={14} />, cor: '#10b981' },
  { value: 'debito', label: 'Débito', icon: <CreditCard size={14} />, cor: '#3b82f6' },
  { value: 'dinheiro', label: 'Dinheiro', icon: <Banknote size={14} />, cor: '#f59e0b' },
  { value: 'boleto', label: 'Boleto', icon: <FileText size={14} />, cor: '#6b7280' },
  { value: 'transferencia', label: 'Transferência', icon: <ArrowLeftRight size={14} />, cor: '#06b6d4' },
];

const BANDEIRAS = [
  { value: 'visa', label: 'Visa' },
  { value: 'master', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'Amex' },
  { value: 'hiper', label: 'Hipercard' },
  { value: 'outra', label: 'Outra' },
];

// Paleta de cores pra cartões. Usuário escolhe ao cadastrar.
// Últimas 3 (vermelho, dourado, dourado-bronze) replicam cartões reais:
// Hipercard Itaú Platinum, Smiles Visa Gold e Latam Pass Itaú Gold.
const CORES_CARTAO = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#0ea5e9',
  '#A4161A', '#C8A02C', '#B08D57', '#facc15', '#3e2723',
];

// Helper de label de método.
function labelMetodo(value: string): string {
  const found = METODOS.find((m) => m.value === value);
  return found?.label || value;
}

// ─── Leitor de PDF no navegador (pdf.js lazy via CDN) ─────────────────────────
// Carregamos pdf.js sob demanda — não entra no bundle. Extrai o texto de todas
// as páginas pra mandar pro backend estruturar via IA. PDFs digitais (de banco)
// têm camada de texto; PDFs escaneados (imagem) não — nesse caso o usuário cola
// o texto manualmente no fallback.
const PDFJS_VER = '3.11.174';
let _pdfjsPromise: Promise<unknown> | null = null;

function carregarPdfJs(): Promise<{ getDocument: (opts: unknown) => { promise: Promise<unknown> }; GlobalWorkerOptions: { workerSrc: string } }> {
  const w = window as unknown as { pdfjsLib?: unknown };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib as never);
  if (_pdfjsPromise) return _pdfjsPromise as never;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: { GlobalWorkerOptions: { workerSrc: string } } }).pdfjsLib;
      if (!lib) { reject(new Error('pdf.js não carregou')); return; }
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Falha ao carregar o leitor de PDF (sem internet?)'));
    document.body.appendChild(s);
  });
  return _pdfjsPromise as never;
}

async function arquivoParaBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

async function extrairTextoPdf(file: File): Promise<string> {
  const lib = await carregarPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await (lib.getDocument({ data: buf }).promise as Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }>);
  let texto = '';
  const maxPag = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPag; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => it.str || '').join(' ') + '\n';
  }
  return texto.trim();
}

// ─── Skeletons de carregamento ────────────────────────────────────────────────
// Mostrados na PRIMEIRA carga (antes de os dados do mês chegarem), pra nenhuma
// aba aparecer "sem dados"/zerada parecendo quebrada. Padrão compartilhado.
function SkeletonCardsResumo(): React.ReactElement {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={92} radius={14} />)}
    </div>
  );
}

function SkeletonConteudoFin(): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>
        <Clock size={13} className="forja-spin" /> Carregando…
      </div>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width={200} height={16} />
          <Skeleton width={120} height={30} radius={8} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} radius={10} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={`${50 + (i % 3) * 12}%`} height={12} />
              <Skeleton width={`${28 + (i % 4) * 8}%`} height={10} />
            </div>
            <Skeleton width={70} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinPessoal(): React.ReactElement {
  const t = useTokens();
  const { notification } = AntApp.useApp();
  // Mês selecionado no formato YYYY-MM. Default: mês atual.
  const [mes, setMes] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [view, setView] = useState<'mes' | 'painel' | 'inteligencia' | 'perfil' | 'lancamentos' | 'receitas' | 'familia' | 'familia-recebiveis' | 'familia-cobrar' | 'cartoes' | 'pagar' | 'orcamentos' | 'recorrencias' | 'assinaturas' | 'categorias' | 'plano' | 'imposto-renda'>('mes');
  // Deep-link: clicar num cartão na visão "Meu mês" leva pra aba Cartões já
  // abrindo a fatura daquele cartão.
  const [cartaoParaAbrir, setCartaoParaAbrir] = useState<string | null>(null);
  const abrirCartaoNoPainel = useCallback((cartaoId: string) => {
    setCartaoParaAbrir(cartaoId);
    setView('cartoes');
  }, []);

  // Estado compartilhado entre as sub-views
  const [resumo, setResumo] = useState<ResumoFinPessoal | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoPessoal[]>([]);
  const [cartoes, setCartoes] = useState<CartaoPessoal[]>([]);
  // Visão "Meu mês" já vem pronta no bootstrap essencial — evita o filho
  // (FinMesExecutivo) fazer uma chamada extra de getMesExecutivo no mount.
  const [mesExecutivo, setMesExecutivo] = useState<MesExecutivo | null>(null);
  const [orcamentosProgresso, setOrcamentosProgresso] = useState<ProgressoOrcamentos | null>(null);
  const [recorrencias, setRecorrencias] = useState<RecorrenciaAtiva[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPessoal[]>(CATEGORIAS_FALLBACK);
  const [assinaturas, setAssinaturas] = useState<AssinaturaPessoal[]>([]);
  const [resumoAssinaturas, setResumoAssinaturas] = useState<ResumoAssinaturas | null>(null);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [membros, setMembros] = useState<FamiliaMembro[]>([]);
  const [loading, setLoading] = useState(false);
  // Pendentes não são filtrados por mês — são todos os abertos a qualquer dia
  const [pendentes, setPendentes] = useState<LancamentoPessoal[]>([]);
  // Categorias do usuário (derivadas dos lançamentos + sugeridas).
  const [categoriasUsadas, setCategoriasUsadas] = useState<string[]>([]);

  // Modal de novo/editar lançamento
  const [modalLancOpen, setModalLancOpen] = useState(false);
  const [lancEditando, setLancEditando] = useState<LancamentoPessoal | null>(null);
  // Modal de lançar fatura de cartão
  const [modalFaturaOpen, setModalFaturaOpen] = useState(false);
  // Modal de importar fatura (PDF) via IA
  const [modalImportOpen, setModalImportOpen] = useState(false);
  // Cartão pré-selecionado ao abrir o import a partir de um card específico
  const [importCartaoId, setImportCartaoId] = useState<string | undefined>();
  const abrirImport = (cartaoId?: string) => { setImportCartaoId(cartaoId); setModalImportOpen(true); };
  // Modal de cadastrar receita/salário recorrente
  const [modalReceitaOpen, setModalReceitaOpen] = useState(false);
  const [receitaPreset, setReceitaPreset] = useState<'salario' | null>(null);
  // Modal de atribuir lançamento a membro(s) da família
  const [atribuirLanc, setAtribuirLanc] = useState<LancamentoPessoal | null>(null);
  // Mapa lançamentoId → [membroId...] (quais lançamentos já foram atribuídos)
  const [atribuicoes, setAtribuicoes] = useState<Record<string, string[]>>({});
  // Resolve os membros atribuídos a um lançamento (pra mostrar avatares na linha).
  const membrosDeLancamento = useCallback((lancId: string): FamiliaMembro[] => {
    const ids = atribuicoes[lancId] || [];
    return ids
      .map((id) => membros.find((m) => m.id === id))
      .filter((m): m is FamiliaMembro => Boolean(m));
  }, [atribuicoes, membros]);

  // Lançamentos que já viraram assinatura-espelho (pra marcar a linha da fatura
  // com um ícone "ativo", como os avatares quando atribuído a um membro).
  const lancAssinaturaIds = useMemo(
    () => new Set(
      assinaturas
        .filter((a) => String(a.espelho) === 'sim' && a.origemLancamentoId)
        .map((a) => String(a.origemLancamentoId)),
    ),
    [assinaturas],
  );
  // Assinaturas estáveis (valor+nome) das espelhos — fallback robusto pro selo
  // quando o id do lançamento de origem mudou (ex: fatura reimportada).
  const assinaturaEspelhoSigs = useMemo(
    () => new Set(
      assinaturas
        .filter((a) => String(a.espelho) === 'sim')
        .map((a) => sigEspelho(String(a.nome || ''), Number(a.valor || 0))),
    ),
    [assinaturas],
  );
  // Atualização OTIMISTA ao promover uma compra a assinatura-espelho: insere no
  // estado local na hora (o selo da fatura e a aba Assinaturas derivam daqui), sem
  // esperar o `recarregar` pesado (~12 RPCs). Em seguida reconcilia só o resumo de
  // assinaturas em background — barato e não bloqueia a UI.
  const onAssinaturaCriada = useCallback((nova?: AssinaturaPessoal) => {
    if (nova) {
      // id real vem do servidor; se faltar (resposta sem corpo), usa um temporário
      // só pra render — o selo deriva de espelho/origem/sig, não do id. O próximo
      // recarregar reconcilia com a linha definitiva.
      const comId: AssinaturaPessoal = nova.id ? nova : { ...nova, id: `tmp-${Date.now()}` };
      setAssinaturas((prev) => (prev.some((a) => a.id === comId.id) ? prev : [...prev, comId]));
    }
    callServer<ServerResponse<ResumoAssinaturas>>('getResumoAssinaturas')
      .then((r) => { if (r?.ok && r.data) setResumoAssinaturas(r.data as ResumoAssinaturas); })
      .catch(() => { /* silencioso — o otimista já cobriu a UI */ });
  }, []);

  // Flag pra rodar a auto-geração apenas uma vez por sessão (no primeiro mount).
  // Rodar de novo ao mudar de mês não faz sentido — o gerador é global, não por mês.
  const [autoGerouUmaVez, setAutoGerouUmaVez] = useState(false);

  // Carrega tudo do mês. Na primeira chamada, primeiro dispara o gerador de
  // recorrências pendentes (idempotente no servidor) e só depois recarrega — assim
  // os clones recém-criados já entram no resultado.
  const recarregar = useCallback(() => {
    setLoading(true);
    const preload = !autoGerouUmaVez
      ? callServer<ServerResponse<unknown>>('gerarRecorrenciasPendentes').then(() => setAutoGerouUmaVez(true))
      : Promise.resolve();
    // Carga em 2 ONDAS via ENDPOINTS AGREGADORES (1 execução do GAS cada). Antes
    // eram ~13 `google.script.run` separados — e o GAS trata cada um como uma
    // execução independente (recarrega o bundle, reabre a planilha, roda init),
    // o que somava 10-15s no navegador. Agora:
    //   • Onda 1 (getFinPessoalEssencial): resumo + lançamentos + cartões +
    //     categorias + a visão "Meu mês" pronta → 1 chamada, libera a UI.
    //   • Onda 2 (getFinPessoalSecundario): orçamentos, recorrências,
    //     assinaturas, plano, membros e atribuições → 1 chamada em background.
    interface EssencialPayload {
      resumo: ResumoFinPessoal | null;
      lancamentos: LancamentoPessoal[];
      cartoes: CartaoPessoal[];
      categorias: CategoriaPessoal[];
      mesExecutivo: MesExecutivo | null;
    }
    interface SecundarioPayload {
      orcamentos: ProgressoOrcamentos | null;
      recorrencias: RecorrenciaAtiva[];
      assinaturas: AssinaturaPessoal[];
      resumoAssinaturas: ResumoAssinaturas | null;
      planoContas: PlanoConta[];
      membros: FamiliaMembro[];
      atribuicoes: Array<{ origemId: string; membroId: string }>;
    }

    const carregarSecundarios = () => {
      callServer<ServerResponse<SecundarioPayload>>('getFinPessoalSecundario', mes)
        .then((r) => {
          if (!r?.ok || !r.data) return;
          const d = r.data as SecundarioPayload;
          if (d.orcamentos) setOrcamentosProgresso(d.orcamentos);
          if (Array.isArray(d.recorrencias)) setRecorrencias(d.recorrencias);
          if (Array.isArray(d.assinaturas)) setAssinaturas(d.assinaturas);
          if (d.resumoAssinaturas) setResumoAssinaturas(d.resumoAssinaturas);
          if (Array.isArray(d.planoContas)) setPlanoContas(d.planoContas);
          if (Array.isArray(d.membros)) setMembros(d.membros);
          // Mapa lançamentoId → [membroId...] pra mostrar o avatar do membro no
          // lugar do "boneco" genérico quando o lançamento já foi atribuído.
          if (Array.isArray(d.atribuicoes)) {
            const mapa: Record<string, string[]> = {};
            for (const a of d.atribuicoes) (mapa[a.origemId] = mapa[a.origemId] || []).push(a.membroId);
            setAtribuicoes(mapa);
          }
        })
        .catch((err) => { console.warn('[FinPessoal] falha na carga secundária:', err); });
    };

    preload.then(() => callServer<ServerResponse<EssencialPayload>>('getFinPessoalEssencial', mes)
      .then((r) => {
        const d = (r?.ok && r.data ? r.data : null) as EssencialPayload | null;
        const resumoData = d?.resumo || null;
        if (resumoData) setResumo(resumoData);
        if (d && Array.isArray(d.lancamentos)) {
          const lista = d.lancamentos;
          setLancamentos(lista);
          // Categorias distintas usadas até hoje (autocomplete da modal).
          const cats = new Set<string>();
          for (const l of lista) if (l.categoria) cats.add(l.categoria);
          setCategoriasUsadas(Array.from(cats).sort());
        }
        if (d && Array.isArray(d.cartoes)) setCartoes(d.cartoes);
        if (d && Array.isArray(d.categorias)) setCategorias(d.categorias);
        if (d) setMesExecutivo(d.mesExecutivo || null);
        // Pendentes: fonte autoritativa é o resumo (mesma origem do contador).
        if (resumoData && Array.isArray(resumoData.pendentesLista)) setPendentes(resumoData.pendentesLista);
      })
      .catch((err) => { console.warn('[FinPessoal] falha ao recarregar:', err); })
      .finally(() => setLoading(false))
      .then(() => carregarSecundarios()));
  }, [mes, autoGerouUmaVez]);

  useEffect(recarregar, [recarregar]);

  // Aviso de vencimentos próximos: quando estou olhando o mês corrente e há
  // cartões com fatura em aberto vencendo nos próximos dias (ou já vencida),
  // dispara uma notificação no canto. Mostra uma vez por mês por sessão pra
  // não incomodar a cada refresh.
  const avisoVencRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!cartoes.length) return;
    const hoje = new Date();
    const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const mesAtualReal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    if (mes !== mesAtualReal) return; // só avisa no mês corrente
    if (avisoVencRef.current.has(mes)) return;
    avisoVencRef.current.add(mes);

    const DIAS_AVISO = 7;
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const proximos = cartoes
      .map((c) => {
        const aPagar = c.aPagarMes ?? 0;
        if (aPagar <= 0.005) return null;
        const dia = Math.min(Math.max(1, c.diaVencimento || 1), ultimoDia);
        const venc = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
        const dias = Math.round((venc.getTime() - hojeZero.getTime()) / 86400000);
        return { c, aPagar, dias };
      })
      .filter((x): x is { c: CartaoPessoal; aPagar: number; dias: number } => x !== null && x.dias <= DIAS_AVISO)
      .sort((a, b) => a.dias - b.dias);

    if (proximos.length === 0) return;

    const temVencida = proximos.some((p) => p.dias < 0);
    notification.open({
      type: temVencida ? 'error' : 'warning',
      message: temVencida ? 'Faturas vencidas / vencendo' : 'Vencimentos próximos',
      placement: 'topRight',
      duration: 0,
      icon: <Calendar size={20} color={temVencida ? t.accents.rose : t.accents.peach} />,
      description: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {proximos.map(({ c, aPagar, dias }) => {
            const vencida = dias < 0;
            const txt = vencida
              ? `vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`
              : dias === 0 ? 'vence hoje'
              : `vence em ${dias} dia${dias === 1 ? '' : 's'}`;
            const cor = vencida ? t.accents.rose : dias <= 2 ? t.accents.peach : t.textSecondary;
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 12.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.cor, flexShrink: 0 }} />
                <span style={{ color: t.text, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.apelido || c.nome}
                </span>
                <span style={{ color: cor, whiteSpace: 'nowrap' }}>{txt}</span>
                <span style={{ color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBRL(aPagar)}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 4 }}>
            <Button size="small" type="primary" style={{ background: t.accents.peach, borderColor: t.accents.peach }}
              onClick={() => { setView('cartoes'); notification.destroy(); }}>
              Ver cartões
            </Button>
          </div>
        </div>
      ),
    });
  }, [cartoes, mes, notification, t]);

  // Navegação de mês
  const navegarMes = (delta: number) => {
    const [yyyy, mm] = mes.split('-').map(Number);
    const d = new Date(yyyy, mm - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const labelMes = useMemo(() => {
    const [yyyy, mm] = mes.split('-').map(Number);
    const d = new Date(yyyy, mm - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mes]);

  // Receitas recorrentes ativas (salário e afins): origens de recorrência do
  // tipo entrada. Alimentam a aba Receitas e o resumo do topo.
  const receitasRecorrentes = useMemo(
    () => recorrencias.filter((r) => r.tipo === 'entrada'),
    [recorrencias],
  );

  const abrirNovaReceita = (preset: 'salario' | null) => {
    setReceitaPreset(preset);
    setModalReceitaOpen(true);
  };

  const abrirNovoLancamento = () => {
    setLancEditando(null);
    setModalLancOpen(true);
  };
  const abrirEditarLancamento = (l: LancamentoPessoal) => {
    setLancEditando(l);
    setModalLancOpen(true);
  };

  // Sub-nav vertical (padrão list-detail, estilo Linear/Notion settings — o mesmo
  // que usamos no Atelier). Escala sem estourar: descrição rica por item, sem
  // overflow nem corte. Pra adicionar uma view: 1 item aqui + 1 bloco lá embaixo.
  type ViewKey = typeof view;
  const NAV: Array<{
    key: ViewKey; icon: LucideIcon; label: string;
    count?: number; accent: keyof typeof t.accents; ia?: boolean; desc: string; group?: string;
  }> = [
    { key: 'mes', icon: Wallet, label: 'Meu mês', accent: 'peach', group: 'Panorama', desc: 'Visão executiva: tudo que entra e sai, cartões por nome com toggle de pago, gastos por categoria clicáveis e o que sobra (com previstos dos próximos meses).' },
    { key: 'painel', icon: CalendarRange, label: 'Painel 12 meses', accent: 'sage', group: 'Panorama', desc: 'O ano inteiro: receita, despesa por cartão e saldo acumulado.' },
    { key: 'inteligencia', icon: Compass, label: 'Norte', accent: 'lavender', ia: true, group: 'Panorama', desc: 'Diagnóstico financeiro e plano de abundância com IA.' },
    { key: 'perfil', icon: Home, label: 'Perfil ideal', accent: 'sage', ia: true, group: 'Panorama', desc: 'Orçamento-alvo da família e o cruzamento com o real, num só lugar.' },
    { key: 'lancamentos', icon: ArrowLeftRight, label: 'Lançamentos', count: lancamentos.length, accent: 'blue', group: 'Movimento', desc: 'Todas as despesas e entradas do mês, com filtros e edição.' },
    { key: 'receitas', icon: TrendingUp, label: 'Receitas', count: receitasRecorrentes.length, accent: 'sage', group: 'Movimento', desc: 'Salário e entradas recorrentes que se repetem todo mês.' },
    { key: 'pagar', icon: Clock, label: 'A pagar', count: resumo?.qtdAPagarMes ?? 0, accent: 'rose', group: 'Movimento', desc: 'Contas pendentes e agendadas, com alerta de vencimento.' },
    { key: 'cartoes', icon: CreditCard, label: 'Cartões', count: cartoes.length, accent: 'peach', group: 'Movimento', desc: 'Seus cartões, faturas abertas e limites.' },
    { key: 'assinaturas', icon: Repeat, label: 'Assinaturas', count: assinaturas.length, accent: 'lavender', group: 'Movimento', desc: 'Streamings e recorrências — custo mensal e anual.' },
    { key: 'recorrencias', icon: RotateCcw, label: 'Recorrências', count: recorrencias.length, accent: 'blue', group: 'Movimento', desc: 'Lançamentos que se repetem automaticamente.' },
    { key: 'familia', icon: Users, label: 'Visão geral', count: membros.length, accent: 'lavender', group: 'Família', desc: 'Quanto do seu cartão é de cada familiar — resumo, régua do ano e os membros.' },
    { key: 'familia-recebiveis', icon: Banknote, label: 'Recebíveis', accent: 'sage', group: 'Família', desc: 'Quanto cada um já te devolveu no ano e o que falta receber.' },
    { key: 'familia-cobrar', icon: AlertCircle, label: 'A cobrar', accent: 'peach', group: 'Família', desc: 'Compras que vieram no seu cartão e ainda não foram atribuídas a ninguém.' },
    { key: 'orcamentos', icon: Target, label: 'Orçamentos', count: orcamentosProgresso?.itens.length || 0, accent: 'sage', group: 'Organização', desc: 'Tetos de gasto por categoria e progresso do mês.' },
    { key: 'plano', icon: BookOpen, label: 'Plano de contas', count: planoContas.length, accent: 'sage', ia: true, group: 'Organização', desc: 'Centros de custo gerados pela IA pra classificar gastos.' },
    { key: 'categorias', icon: LayersIcon, label: 'Categorias', count: categorias.length, accent: 'peach', group: 'Organização', desc: 'Categorias de gasto e seus totais no mês.' },
    { key: 'imposto-renda', icon: Coins, label: 'Imposto de Renda', accent: 'clay', group: 'Impostos', desc: 'IRPF: rendimentos, deduções, carnê-leão mensal e ajuste anual da declaração.' },
  ];

  // Primeira carga: dados do mês ainda não chegaram (resumo nulo). Mostra
  // esqueleto em vez de abas zeradas/"sem dados". Refreshes seguintes (troca de
  // mês, ações) não piscam, porque resumo já está preenchido.
  const primeiraCarga = loading && !resumo;

  return (
    <CategoriasContext.Provider value={categorias}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header: seletor de mês + ação de novo lançamento. No "Meu mês" o
          seletor de mês fica escondido (a própria tela já tem o dela), evitando
          dois navegadores de mês na mesma página. */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
          padding: '14px 18px', boxShadow: t.shadowSoft,
        }}
      >
        {view !== 'mes' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => navegarMes(-1)} />
            <div style={{
              minWidth: 180, textAlign: 'center', fontFamily: FONTS.display,
              fontSize: 15, fontWeight: 500, color: t.text, textTransform: 'capitalize',
            }}>
              {labelMes}
            </div>
            <Button size="small" icon={<ChevronRight size={14} />} onClick={() => navegarMes(1)} />
            <Button
              size="small"
              type="text"
              onClick={() => {
                const d = new Date();
                setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }}
              style={{ marginLeft: 4, fontSize: 12, color: t.textTertiary }}
            >
              hoje
            </Button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={abrirNovoLancamento}
          style={{ background: t.accents.peach, borderColor: t.accents.peach }}
        >
          Novo lançamento
        </Button>
      </div>

      {/* Cards de resumo — escondidos no "Meu mês" (que já traz Sobra/Entradas/
          Saídas/Pago/A pagar). Nas outras abas seguem como resumo do mês. Na
          primeira carga, viram esqueleto. */}
      {primeiraCarga ? (
        <SkeletonCardsResumo />
      ) : view !== 'mes' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <CardResumo
            icon={<TrendingDown size={20} />}
            label="Gasto do mês"
            valor={resumo?.totalDespesas || 0}
            cor={t.accents.rose}
            delta={resumo?.deltaPct}
            subtitle={resumo ? `${resumo.totalLancamentos} lançamentos` : ''}
          />
          <CardResumo
            icon={<TrendingUp size={20} />}
            label="Entradas do mês"
            valor={resumo?.totalEntradas || 0}
            cor={t.accents.sage}
          />
          <CardResumo
            icon={<Wallet size={20} />}
            label="Saldo do mês"
            valor={resumo?.saldo || 0}
            cor={resumo && resumo.saldo >= 0 ? t.accents.sage : t.accents.rose}
            highlightSign
          />
          <CardResumo
            icon={<Clock size={20} />}
            label="A pagar no mês"
            valor={resumo?.aPagarMes || 0}
            cor={t.accents.peach}
            subtitle={resumo ? `${resumo.qtdAPagarMes} item(s) · ${resumo.qtdProximos7d} em 7d` : ''}
            highlight={!!resumo && resumo.qtdProximos7d > 0}
          />
          <CardResumo
            icon={<CheckCircle2 size={20} />}
            label="Pago no mês"
            valor={resumo?.pagoMes || 0}
            cor={t.accents.sage}
            subtitle={resumo ? `${resumo.qtdPagoMes} item(s)` : ''}
          />
          <CardResumo
            icon={<Repeat size={20} />}
            label="Assinaturas/mês"
            valor={resumoAssinaturas?.totalMensal || 0}
            cor={t.accents.lavender}
            subtitle={resumoAssinaturas ? `${resumoAssinaturas.qtdAtivas} ativa(s) · ${formatBRL(resumoAssinaturas.totalAnual)}/ano` : 'clique pra gerenciar'}
            onClick={() => setView('assinaturas')}
          />
        </div>
      ) : null}

      {/* Navegação interna — sub-nav vertical reutilizável (list-detail) */}
      <SubNav items={NAV} value={view} onChange={(k) => setView(k)} ariaLabel="Áreas do Financeiro Pessoal">

      {/* Sub-views — na primeira carga, esqueleto pra nenhuma aba aparecer vazia */}
      {primeiraCarga ? (
        <SkeletonConteudoFin />
      ) : (
      <>
      {view === 'mes' && (
        <FinMesExecutivo
          mes={mes}
          dadosIniciais={mesExecutivo}
          categorias={categorias}
          lancamentos={lancamentos}
          cartoes={cartoes}
          onRecarregar={recarregar}
          onAbrirCartao={abrirCartaoNoPainel}
          onNovoLancamento={abrirNovoLancamento}
          onIrParaOrcamentos={() => setView('orcamentos')}
          onNavegarMes={navegarMes}
          onMesHoje={() => {
            const d = new Date();
            setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }}
          onEditar={abrirEditarLancamento}
        />
      )}
      {view === 'painel' && (
        <PainelAnual mes={mes} onLancarReceita={() => abrirNovaReceita('salario')} />
      )}
      {view === 'lancamentos' && (
        <ListaLancamentos
          lancamentos={lancamentos}
          cartoes={cartoes}
          loading={loading}
          onEditar={abrirEditarLancamento}
          onRecarregar={recarregar}
          onNovo={abrirNovoLancamento}
        />
      )}
      {view === 'receitas' && (
        <PainelReceitas
          receitas={receitasRecorrentes}
          lancamentos={lancamentos}
          onNova={abrirNovaReceita}
          onEditar={abrirEditarLancamento}
          onRecarregar={recarregar}
        />
      )}
      {view.startsWith('familia') && (
        <FinFamilia
          mes={mes}
          membros={membros}
          cartoes={cartoes}
          lancamentos={lancamentos}
          assinaturas={assinaturas}
          onRecarregar={recarregar}
          onSelecionarMes={setMes}
          secao={view === 'familia-recebiveis' ? 'recebiveis' : view === 'familia-cobrar' ? 'cobrar' : 'visao'}
        />
      )}
      {view === 'cartoes' && (
        <PainelCartoes
          cartoes={cartoes}
          mes={mes}
          membros={membros}
          membrosDe={membrosDeLancamento}
          lancAssinaturaIds={lancAssinaturaIds}
          assinaturaEspelhoSigs={assinaturaEspelhoSigs}
          onRecarregar={recarregar}
          onAssinaturaCriada={onAssinaturaCriada}
          onImportar={abrirImport}
          onEditarLancamento={abrirEditarLancamento}
          onAtribuir={setAtribuirLanc}
          onLancarFatura={() => setModalFaturaOpen(true)}
          abrirCartaoId={cartaoParaAbrir}
          onConsumirAbrir={() => setCartaoParaAbrir(null)}
        />
      )}
      {view === 'pagar' && (
        <>
          {/* Heurística: se o resumo aponta pendentes mas a lista chegou vazia,
              é quase certo que a chamada `getLancamentosPessoais` (sem mês) falhou
              ou foi truncada pelo GAS. Mostramos um alerta acionável em vez de
              dar "tudo em dia" enganador. */}
          {resumo && resumo.qtdPendentes > 0 && pendentes.length === 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`O resumo aponta ${resumo.qtdPendentes} pendente(s) (${formatBRL(resumo.totalPendente)}), mas a lista não carregou.`}
              description="O servidor pode ter truncado a resposta. Tente recarregar."
              action={
                <Button size="small" type="primary" onClick={recarregar}>Recarregar</Button>
              }
            />
          )}
          <ContasAPagar
            pendentes={pendentes}
            cartoes={cartoes}
            membros={membros}
            membrosDe={membrosDeLancamento}
            onEditar={abrirEditarLancamento}
            onRecarregar={recarregar}
            onAtribuir={setAtribuirLanc}
          />
        </>
      )}
      {view === 'inteligencia' && (
        <FinInteligencia />
      )}
      {view === 'perfil' && (
        <FinPerfil categorias={categorias} />
      )}
      {view === 'assinaturas' && (
        <FinAssinaturas
          assinaturas={assinaturas}
          resumo={resumoAssinaturas}
          cartoes={cartoes}
          loading={loading}
          onRecarregar={recarregar}
        />
      )}
      {view === 'orcamentos' && (
        <PainelOrcamentos
          progresso={orcamentosProgresso}
          categoriasUsadas={categoriasUsadas}
          onRecarregar={recarregar}
        />
      )}
      {view === 'recorrencias' && (
        <PainelRecorrencias
          recorrencias={recorrencias}
          cartoes={cartoes}
          onEditar={abrirEditarLancamento}
          onRecarregar={recarregar}
        />
      )}
      {view === 'plano' && (
        <PainelPlanoContas
          contas={planoContas}
          onRecarregar={recarregar}
        />
      )}
      {view === 'categorias' && (
        <PainelCategorias
          categorias={categorias}
          onRecarregar={recarregar}
        />
      )}
      {view === 'imposto-renda' && (
        <FinIR />
      )}
      </>
      )}
      </SubNav>

      {/* Modal de lançamento (compartilhado entre sub-views) */}
      <ModalLancamento
        open={modalLancOpen}
        onClose={() => setModalLancOpen(false)}
        lancamento={lancEditando}
        cartoes={cartoes}
        categoriasUsadas={categoriasUsadas}
        onSaved={() => { setModalLancOpen(false); recarregar(); }}
      />

      {/* Modal de lançar fatura de cartão */}
      <ModalFatura
        open={modalFaturaOpen}
        onClose={() => setModalFaturaOpen(false)}
        cartoes={cartoes}
        onSaved={() => { setModalFaturaOpen(false); recarregar(); }}
      />

      {/* Modal de importar fatura (PDF) via IA */}
      <ModalImportarFatura
        open={modalImportOpen}
        onClose={() => setModalImportOpen(false)}
        cartoes={cartoes}
        cartaoInicial={importCartaoId}
        onSaved={() => { setModalImportOpen(false); recarregar(); }}
        onConcluir={(status) => {
          setModalImportOpen(false);
          setView(status === 'pendente' ? 'pagar' : 'lancamentos');
          recarregar();
        }}
      />

      {/* Modal de cadastrar receita / salário recorrente */}
      <ModalReceita
        open={modalReceitaOpen}
        preset={receitaPreset}
        onClose={() => setModalReceitaOpen(false)}
        onSaved={() => { setModalReceitaOpen(false); recarregar(); }}
      />

      {/* Modal de atribuir lançamento a membro(s) da família (rateio) */}
      <ModalAtribuirMembros
        lancamento={atribuirLanc}
        membros={membros}
        mes={mes}
        onClose={() => setAtribuirLanc(null)}
        onSaved={() => { setAtribuirLanc(null); recarregar(); }}
      />
    </div>
    </CategoriasContext.Provider>
  );
}

// ─── Cards de resumo do topo ─────────────────────────────────────────────────

interface CardResumoProps {
  icon: React.ReactNode;
  label: string;
  valor: number;
  cor: string;
  subtitle?: string;
  delta?: number; // % vs mês anterior
  highlight?: boolean;
  highlightSign?: boolean; // mostra + ou - no valor (pra saldo)
  onClick?: () => void;
}

function CardResumo({ icon, label, valor, cor, subtitle, delta, highlight, highlightSign, onClick }: CardResumoProps): React.ReactElement {
  const t = useTokens();
  const valorFormatado = highlightSign && valor !== 0
    ? `${valor > 0 ? '+' : '−'}${formatBRL(Math.abs(valor))}`
    : formatBRL(Math.abs(valor));
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface,
        border: `1px solid ${highlight ? `${cor}55` : t.border}`,
        borderRadius: 14,
        padding: 14,
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: t.shadowSoft,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; } : undefined}
    >
      {/* Faixa lateral colorida */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: cor,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `${cor}15`, color: cor, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, letterSpacing: 0.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {label.toUpperCase()}
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: FONTS.display, fontSize: 'clamp(16px, 1.45vw, 21px)', fontWeight: 500, color: t.text,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {valorFormatado}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 16 }}>
        {typeof delta === 'number' && Math.abs(delta) > 0.5 && (
          <span style={{
            fontSize: 11, fontFamily: FONTS.ui, color: delta > 0 ? t.accents.rose : t.accents.sage,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(0)}% vs mês anterior
          </span>
        )}
        {subtitle && (
          <span style={{
            fontSize: 10.5, color: t.textTertiary, fontFamily: FONTS.ui,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}

// ─── Sub-view: painel anual (12 meses) ───────────────────────────────────────
// A visão "ouro": o ano inteiro num relance. Por mês: receita (salário etc.),
// despesa por cartão, saldo do mês e saldo ACUMULADO (positivo/negativo). Meses
// futuros projetam as recorrências (salário e gastos fixos) + parcelas que já
// existem como lançamentos. Premium, minimalista, alto nível.

interface PainelMesData {
  comp: string; mesNum: number; futuro: boolean; atual: boolean;
  totalEntradas: number; totalDespesas: number; saldoMes: number; saldoAcumulado: number;
  porCartao: Array<{ nome: string; valor: number }>; outros: number;
}
interface PainelAnualData {
  ano: number; meses: PainelMesData[];
  totalEntradasAno: number; totalDespesasAno: number; saldoAno: number; cartoes: string[];
}

interface GrupoCartaoMes { key: string; nome: string; bandeira: string; cor?: string; total: number; itens: LancamentoPessoal[] }
interface ComposicaoMes {
  comp: string;
  entradas: LancamentoPessoal[];
  cartoes: GrupoCartaoMes[];
  totalEntradas: number; totalDespesas: number; saldo: number; qtdLancamentos: number;
}

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function PainelAnual({ mes, onLancarReceita }: { mes: string; onLancarReceita: () => void }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ano, setAno] = useState<number>(() => Number(mes.split('-')[0]) || new Date().getFullYear());
  const [data, setData] = useState<PainelAnualData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mesAberto, setMesAberto] = useState<PainelMesData | null>(null);
  const [comp, setComp] = useState<ComposicaoMes | null>(null);
  const [pdfMesLoading, setPdfMesLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    callServer<ServerResponse<PainelAnualData>>('getPainelAnual', ano)
      .then((r) => { if (r?.ok && r.data) setData(r.data as PainelAnualData); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [ano]);

  // Detalhe do mês selecionado (composição por cartão + itens).
  useEffect(() => {
    if (!mesAberto) { setComp(null); return; }
    setComp(null);
    callServer<ServerResponse<ComposicaoMes>>('getComposicaoMes', mesAberto.comp)
      .then((r) => { if (r?.ok && r.data) setComp(r.data as ComposicaoMes); else setComp({ comp: mesAberto.comp, entradas: [], cartoes: [], totalEntradas: 0, totalDespesas: 0, saldo: 0, qtdLancamentos: 0 }); })
      .catch(() => setComp({ comp: mesAberto.comp, entradas: [], cartoes: [], totalEntradas: 0, totalDespesas: 0, saldo: 0, qtdLancamentos: 0 }));
  }, [mesAberto]);

  const baixarPdfMes = (c: string) => {
    setPdfMesLoading(true);
    gerarEbaixarPdf('gerarPdfMesPainel', c)
      .then(() => message.success('PDF gerado'))
      .catch(() => message.error('Falha ao gerar PDF'))
      .finally(() => setPdfMesLoading(false));
  };

  const tituloMes = mesAberto ? `${MESES_LONGO[mesAberto.mesNum - 1]} ${ano}` : '';

  const StatTopo = ({ label, valor, cor }: { label: string; valor: number; cor: string }) => (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{formatBRL(valor)}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero: navegação de ano + totais do ano */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.sage}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>Painel anual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <Button size="small" type="text" icon={<ChevronLeft size={18} />} onClick={() => setAno((a) => a - 1)} />
            <span style={{ fontFamily: FONTS.display, fontSize: 30, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ano}</span>
            <Button size="small" type="text" icon={<ChevronRight size={18} />} onClick={() => setAno((a) => a + 1)} />
          </div>
        </div>
        <StatTopo label="Receita no ano" valor={data?.totalEntradasAno || 0} cor={t.accents.sage} />
        <StatTopo label="Despesa no ano" valor={data?.totalDespesasAno || 0} cor={t.accents.rose} />
        <StatTopo label="Saldo do ano" valor={data?.saldoAno || 0} cor={(data?.saldoAno || 0) >= 0 ? t.accents.sage : t.accents.rose} />
        <Button type="primary" icon={<Plus size={15} />} onClick={onLancarReceita} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
          Lançar salário
        </Button>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', color: t.textTertiary, padding: 40 }}>Carregando o ano…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
          {(data?.meses || []).map((m) => {
            const positivo = m.saldoMes >= 0;
            const acumPos = m.saldoAcumulado >= 0;
            const vazio = m.totalEntradas === 0 && m.totalDespesas === 0;
            return (
              <div key={m.comp}
                onClick={() => setMesAberto(m)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMesAberto(m); } }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = t.accents.sage; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = m.atual ? t.accents.peach : t.border; }}
                className="forja-mes-card"
                style={{
                  background: m.atual ? `${t.accents.peach}10` : t.surface,
                  border: `1px solid ${m.atual ? t.accents.peach : t.border}`,
                  borderRadius: 14, padding: 16, opacity: vazio && m.futuro ? 0.55 : 1,
                  display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer',
                  transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>
                    {MESES_CURTO[m.mesNum - 1]}
                  </span>
                  {m.atual ? (
                    <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${t.accents.peach}22`, color: t.accents.peach }}>atual</Tag>
                  ) : m.futuro ? (
                    <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: t.surfaceMuted, color: t.textTertiary }}>previsto</Tag>
                  ) : null}
                </div>

                {/* Entradas / Despesas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 12 }}>
                    <span style={{ color: t.textTertiary }}>Receita</span>
                    <span style={{ color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(m.totalEntradas)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 12 }}>
                    <span style={{ color: t.textTertiary }}>Despesa</span>
                    <span style={{ color: t.accents.rose, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(m.totalDespesas)}</span>
                  </div>
                </div>

                {/* Detalhe por cartão */}
                {(m.porCartao.length > 0 || m.outros > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 6, borderTop: `1px solid ${t.borderSoft}` }}>
                    {m.porCartao.map((c) => (
                      <div key={c.nome} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <CreditCard size={10} /> {c.nome}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatBRL(c.valor)}</span>
                      </div>
                    ))}
                    {m.outros > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary }}>
                        <span>Outros</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBRL(m.outros)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Saldo do mês + acumulado */}
                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${t.borderSoft}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>Saldo</span>
                    <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: positivo ? t.accents.sage : t.accents.rose, fontVariantNumeric: 'tabular-nums' }}>
                      {positivo ? '+' : ''}{formatBRL(m.saldoMes)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>Acumulado</span>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: acumPos ? t.textSecondary : t.accents.rose, fontVariantNumeric: 'tabular-nums' }}>
                      {acumPos ? '' : ''}{formatBRL(m.saldoAcumulado)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
        Toque num mês pra ver a composição. Despesa de cartão entra no mês do <strong>vencimento</strong>. Meses futuros projetam salário, gastos recorrentes e parcelas já lançadas.
      </div>

      {/* Drawer: detalhe do mês — composição por cartão + itens + export PDF */}
      <Drawer
        title={tituloMes}
        open={!!mesAberto}
        onClose={() => setMesAberto(null)}
        width={520}
        destroyOnClose
        extra={mesAberto ? (
          <Button size="small" icon={<FileDown size={14} />} loading={pdfMesLoading} onClick={() => baixarPdfMes(mesAberto.comp)}>
            PDF
          </Button>
        ) : null}
      >
        {mesAberto && <DetalheMesPainel mesAberto={mesAberto} comp={comp} />}
      </Drawer>
    </div>
  );
}

// Conteúdo do drawer de um mês do painel: 3 stats + grupos por cartão (com itens)
// + receitas. Premium e legível mesmo com vários cartões.
function DetalheMesPainel({ mesAberto, comp }: { mesAberto: PainelMesData; comp: ComposicaoMes | null }): React.ReactElement {
  const t = useTokens();
  const labelCategoria = useLabelCategoria();
  const loading = comp === null;

  const Stat = ({ label, valor, cor }: { label: string; valor: number; cor: string }) => (
    <div style={{ flex: 1, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{formatBRL(valor)}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {mesAberto.futuro && (
        <Alert type="info" showIcon style={{ fontSize: 12 }}
          message="Mês futuro — salário e recorrências aparecem como projeção (etiqueta “projetado”), junto com lançamentos já existentes (parcelas etc.). Viram lançamentos reais quando o mês chegar." />
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <Stat label="Receita" valor={comp?.totalEntradas || 0} cor={t.accents.sage} />
        <Stat label="Despesa" valor={comp?.totalDespesas || 0} cor={t.accents.rose} />
        <Stat label="Saldo" valor={comp?.saldo || 0} cor={(comp?.saldo || 0) >= 0 ? t.accents.sage : t.accents.rose} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: t.textTertiary, padding: 24 }}>Carregando…</div>
      ) : (comp && comp.cartoes.length === 0 && comp.entradas.length === 0) ? (
        <Empty description="Sem movimentações neste mês" />
      ) : (
        <>
          {/* Mini-gráfico de barras: proporção de cada cartão no total de despesas */}
          {comp && comp.cartoes.length > 0 && (() => {
            const max = Math.max(...comp.cartoes.map((g) => g.total), 1);
            const totalD = comp.totalDespesas || 1;
            const cores = [t.accents.blue, t.accents.lavender, t.accents.peach, t.accents.sage, t.accents.rose];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 16px', border: `1px solid ${t.borderSoft}`, borderRadius: 12, background: t.surface }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 }}>Despesa por cartão</div>
                {comp.cartoes.map((g, i) => {
                  const cor = g.cor || cores[i % cores.length];
                  const pct = Math.round((g.total / totalD) * 100);
                  return (
                    <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: FONTS.ui, fontSize: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.textSecondary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} /> {g.nome}
                        </span>
                        <span style={{ color: t.textSecondary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {formatBRL(g.total)} <span style={{ color: t.textTertiary, fontSize: 11 }}>· {pct}%</span>
                        </span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(3, (g.total / max) * 100)}%`, background: cor, borderRadius: 999, transition: 'width .3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {comp?.cartoes.map((g) => (
            <div key={g.key} style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: t.surfaceMuted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>
                  <CreditCard size={14} color={t.accents.blue} /> {g.nome}
                  <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: t.surface, color: t.textTertiary }}>{g.itens.length}</Tag>
                </span>
                <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(g.total)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.itens.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: `1px solid ${t.borderSoft}`, opacity: it.projecao ? 0.72 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.descricao}
                        {it.projecao && <Tag bordered={false} style={{ marginLeft: 6, fontSize: 9.5, lineHeight: '15px', padding: '0 5px', background: t.surfaceMuted, color: t.textTertiary }}>projetado</Tag>}
                      </div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>
                        {it.data ? dayjs(String(it.data)).format('DD/MM') : ''} · {labelCategoria(String(it.categoria || 'outros'))}
                        {it.status === 'pendente' ? ' · a pagar' : ''}
                      </div>
                    </div>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {comp && comp.entradas.length > 0 && (
            <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${t.accents.sage}14` }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>
                  <TrendingUp size={14} color={t.accents.sage} /> Receitas
                </span>
                <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(comp.totalEntradas)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {comp.entradas.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: `1px solid ${t.borderSoft}`, opacity: it.projecao ? 0.72 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.descricao}
                        {it.projecao && <Tag bordered={false} style={{ marginLeft: 6, fontSize: 9.5, lineHeight: '15px', padding: '0 5px', background: t.surfaceMuted, color: t.textTertiary }}>projetado</Tag>}
                      </div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>{it.data ? dayjs(String(it.data)).format('DD/MM') : ''}</div>
                    </div>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-view: lista de lançamentos ───────────────────────────────────────────

interface ListaLancamentosProps {
  lancamentos: LancamentoPessoal[];
  cartoes: CartaoPessoal[];
  loading: boolean;
  onEditar: (l: LancamentoPessoal) => void;
  onRecarregar: () => void;
  onNovo: () => void;
}

function ListaLancamentos({ lancamentos, cartoes, loading, onEditar, onRecarregar, onNovo }: ListaLancamentosProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const labelCategoria = useLabelCategoria();
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'despesa' | 'entrada'>('todos');
  const [filtroMetodo, setFiltroMetodo] = useState<string>('todos');

  const cartaoNome = (id?: string) => {
    if (!id) return '';
    const c = cartoes.find((x) => x.id === id);
    return c ? (c.apelido || c.nome) : '';
  };

  const filtrados = lancamentos.filter((l) => {
    if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;
    if (filtroMetodo !== 'todos' && l.metodo !== filtroMetodo) return false;
    return true;
  });

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarLancamentoPessoal', id).then((res) => {
      if (res.ok) { message.success('Lançamento removido'); onRecarregar(); }
      else message.error(res.error || 'Erro ao remover');
    });
  };

  return (
    <Panel
      title="Lançamentos do mês"
      padding={0}
      extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Radio.Group size="small" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <Radio.Button value="todos">Todos</Radio.Button>
            <Radio.Button value="despesa">Despesas</Radio.Button>
            <Radio.Button value="entrada">Entradas</Radio.Button>
          </Radio.Group>
          <Select
            size="small"
            value={filtroMetodo}
            onChange={setFiltroMetodo}
            style={{ minWidth: 130 }}
            options={[{ value: 'todos', label: 'Todos métodos' }, ...METODOS.map((m) => ({ value: m.value, label: m.label }))]}
          />
        </div>
      }
    >
      {filtrados.length === 0 ? (
        <div style={{ padding: 40 }}>
          <Empty description={loading ? 'Carregando…' : 'Sem lançamentos com esse filtro'}>
            {!loading && (
              <Button type="primary" icon={<Plus size={14} />} onClick={onNovo}>
                Adicionar lançamento
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtrados.map((l, idx) => {
            const metInfo = METODOS.find((m) => m.value === l.metodo);
            const cartao = cartaoNome(l.cartaoId);
            const isPendente = l.status === 'pendente' || l.status === 'agendado';
            // Parcela futura provisionada: pertence a um grupo de parcelas, está
            // pendente e cai num mês posterior ao atual. Recebe selo azul (≠ atual).
            const ehParcelaFutura = !!l.parcelaGrupoId && isPendente
              && dayjs(l.vencimento || l.data).format('YYYY-MM') > dayjs().format('YYYY-MM');
            return (
              <div
                key={l.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px',
                  borderBottom: idx < filtrados.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = t.surfaceMuted; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {/* Ícone do método */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${metInfo?.cor || t.accents.peach}15`,
                  color: metInfo?.cor || t.accents.peach,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {metInfo?.icon}
                </div>
                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, fontWeight: 500 }}>
                    {l.descricao || labelCategoria(l.categoria)}
                  </div>
                  <div style={{
                    fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary,
                    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 2,
                  }}>
                    <span>{dayjs(l.data).format('DD/MM')}</span>
                    <span>·</span>
                    <span>{labelCategoria(l.categoria)}</span>
                    {cartao && <><span>·</span><span>💳 {cartao}</span></>}
                    {l.parcelas && l.parcelas > 1 && (
                      <><span>·</span>
                        <Tooltip title={ehParcelaFutura
                          ? `Parcela ${l.parcelaAtual} de ${l.parcelas} — provisionada (mês futuro)`
                          : `Parcela ${l.parcelaAtual} de ${l.parcelas}`}>
                          <Tag color={ehParcelaFutura ? 'blue' : 'purple'} style={{ marginInlineEnd: 0, fontSize: 10 }}>
                            parcela {l.parcelaAtual}/{l.parcelas}{ehParcelaFutura ? ' · futura' : ''}
                          </Tag>
                        </Tooltip>
                      </>
                    )}
                    {/* Recorrente: origem ativa OU clone gerado por uma origem */}
                    {(l.recorrencia && l.recorrencia !== 'unica' && l.recorrenciaAtiva === 'sim' && !l.recorrenciaOrigemId) && (
                      <Tooltip title="Lançamento recorrente — gera clone a cada período">
                        <Tag icon={<RotateCcw size={10} />} color="cyan" style={{ marginInlineEnd: 0, fontSize: 10 }}>
                          recorre
                        </Tag>
                      </Tooltip>
                    )}
                    {l.recorrenciaOrigemId && (
                      <Tooltip title="Gerado automaticamente por uma recorrência">
                        <Tag icon={<Sparkles size={10} />} color="default" style={{ marginInlineEnd: 0, fontSize: 10 }}>
                          auto
                        </Tag>
                      </Tooltip>
                    )}
                    {isPendente && (
                      <Tag color={l.status === 'agendado' ? 'blue' : 'orange'} style={{ marginInlineEnd: 0, fontSize: 10 }}>
                        {l.status === 'agendado' ? 'Agendado' : 'Pendente'}
                      </Tag>
                    )}
                  </div>
                </div>
                {/* Valor */}
                <div style={{
                  fontFamily: FONTS.display, fontSize: 15, fontWeight: 500,
                  color: l.tipo === 'entrada' ? t.accents.sage : t.text,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  {l.tipo === 'entrada' ? '+' : '−'}{formatBRL(l.valor)}
                </div>
                {/* Ações */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Tooltip title="Editar">
                    <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(l)} />
                  </Tooltip>
                  <Popconfirm
                    title="Remover esse lançamento?"
                    onConfirm={() => remover(l.id)}
                    okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
                  >
                    <Button size="small" type="text" icon={<Trash2 size={13} />} danger />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Sub-view: cartões ─────────────────────────────────────────────────────────

function PainelCartoes({ cartoes, mes, membros, membrosDe, lancAssinaturaIds, assinaturaEspelhoSigs, onRecarregar, onAssinaturaCriada, onImportar, onEditarLancamento, onAtribuir, onLancarFatura, abrirCartaoId, onConsumirAbrir }: { cartoes: CartaoPessoal[]; mes: string; membros: FamiliaMembro[]; membrosDe: (lancId: string) => FamiliaMembro[]; lancAssinaturaIds?: Set<string>; assinaturaEspelhoSigs?: Set<string>; onRecarregar: () => void; onAssinaturaCriada?: (nova?: AssinaturaPessoal) => void; onImportar: (cartaoId?: string) => void; onEditarLancamento: (l: LancamentoPessoal) => void; onAtribuir: (l: LancamentoPessoal) => void; onLancarFatura: () => void; abrirCartaoId?: string | null; onConsumirAbrir?: () => void }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<CartaoPessoal | null>(null);
  const [faturaOpen, setFaturaOpen] = useState(false);
  const [faturaAtual, setFaturaAtual] = useState<FaturaAberta | null>(null);
  const [loadingFatura, setLoadingFatura] = useState(false);
  // Cartão aberto na gaveta + todos os seus lançamentos (qualquer mês/status),
  // pra achar/remover itens fora da janela da fatura atual.
  const [cartaoAberto, setCartaoAberto] = useState<CartaoPessoal | null>(null);
  const [promoverLanc, setPromoverLanc] = useState<LancamentoPessoal | null>(null);
  const [itensCartao, setItensCartao] = useState<LancamentoPessoal[]>([]);
  const [removendoImportados, setRemovendoImportados] = useState(false);
  const [deduplicando, setDeduplicando] = useState(false);
  const [dedupRes, setDedupRes] = useState<DedupResultado | null>(null);
  const [pagandoFatura, setPagandoFatura] = useState(false);
  const [histAberto, setHistAberto] = useState(false);

  const abrirNovo = () => { setEditando(null); setModalOpen(true); };
  const abrirEditar = (c: CartaoPessoal) => { setEditando(c); setModalOpen(true); };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarCartaoPessoal', id).then((res) => {
      if (res.ok) { message.success('Cartão removido'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const carregarFatura = (c: CartaoPessoal) => {
    setLoadingFatura(true);
    setFaturaAtual(null);
    setItensCartao([]);
    Promise.all([
      callServer<ServerResponse<FaturaAberta>>('getFaturaAberta', c.id, mes),
      callServer<ServerResponse<LancamentosCartao>>('getLancamentosPorCartao', c.id),
    ])
      .then(([fR, lR]) => {
        if (fR.ok && fR.data) setFaturaAtual(fR.data as FaturaAberta);
        if (lR.ok && lR.data) setItensCartao((lR.data as LancamentosCartao).lancamentos || []);
      })
      .finally(() => setLoadingFatura(false));
  };

  const verFatura = (c: CartaoPessoal) => {
    setCartaoAberto(c);
    setFaturaOpen(true);
    carregarFatura(c);
  };

  // Deep-link vindo da visão "Meu mês": abre direto a fatura do cartão pedido.
  useEffect(() => {
    if (!abrirCartaoId) return;
    const alvo = cartoes.find((c) => c.id === abrirCartaoId);
    if (alvo) verFatura(alvo);
    onConsumirAbrir?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirCartaoId, cartoes]);

  // Apagar um lançamento já "baixa" de tudo (fatura, a pagar, resumo, mês).
  const removerLancamento = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarLancamentoPessoal', id).then((res) => {
      if (res.ok) {
        message.success('Lançamento removido');
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res.error || 'Erro');
    });
  };

  // Remove APENAS os importados do mês da fatura aberta (passa `mes`), nunca
  // mais os de outros meses. O servidor escopa pela competência.
  const removerImportados = () => {
    if (!cartaoAberto || removendoImportados) return;
    setRemovendoImportados(true);
    const hide = message.loading('Removendo lançamentos importados deste mês…', 0);
    callServer<ServerResponse<{ removidos: number; futurasRemovidas?: number; preservados?: number }>>('deletarLancamentosImportadosCartao', cartaoAberto.id, mes).then((res) => {
      if (res.ok) {
        const d = res.data as { removidos: number; futurasRemovidas?: number; preservados?: number } | undefined;
        const n = d?.removidos ?? 0;
        const f = d?.futurasRemovidas ?? 0;
        const p = d?.preservados ?? 0;
        message.success(
          `${n} importado(s) removido(s)`
          + (f > 0 ? ` + ${f} parcela(s) futura(s) desta importação` : '')
          + (p > 0 ? ` · ${p} parcela(s) de faturas anteriores preservada(s)` : ''),
        );
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res.error || 'Erro');
    }).finally(() => { hide(); setRemovendoImportados(false); });
  };

  // Reset "daqui pra frente": apaga os importados do mês ABERTO em diante
  // (inclui provisões de importações antigas nesses meses), preservando os
  // meses passados — e com eles as atribuições a membros da família. Depois é
  // só reimportar a fatura atual, que reconstrói mês + provisões limpos.
  const zerarDaquiPraFrente = () => {
    if (!cartaoAberto || removendoImportados) return;
    setRemovendoImportados(true);
    const hide = message.loading('Zerando importados deste mês em diante…', 0);
    callServer<ServerResponse<{ removidos: number; preservados?: number }>>('deletarLancamentosImportadosCartao', cartaoAberto.id, mes, true).then((res) => {
      if (res.ok) {
        const d = res.data as { removidos: number; preservados?: number } | undefined;
        const n = d?.removidos ?? 0;
        const p = d?.preservados ?? 0;
        message.success(`${n} importado(s) removido(s) de ${mes} em diante${p > 0 ? ` · ${p} do passado preservado(s) (com as atribuições)` : ''} — reimporte a fatura atual`);
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res.error || 'Erro');
    }).finally(() => { hide(); setRemovendoImportados(false); });
  };

  // Reset TOTAL: apaga TODOS os lançamentos importados de fatura deste cartão
  // (todos os meses, passado e futuro — inclui provisões órfãs de importações
  // desfeitas). Manuais e recorrências ficam. É o "começar do zero" pra quando
  // o histórico de importa/remove/reimporta deixou entulho.
  const zerarImportados = () => {
    if (!cartaoAberto || removendoImportados) return;
    setRemovendoImportados(true);
    const hide = message.loading('Zerando todos os importados deste cartão…', 0);
    callServer<ServerResponse<{ removidos: number }>>('deletarLancamentosImportadosCartao', cartaoAberto.id).then((res) => {
      if (res.ok) {
        const n = (res.data as { removidos: number } | undefined)?.removidos ?? 0;
        message.success(`${n} lançamento(s) importado(s) removido(s) — cartão limpo pra reimportar`);
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res.error || 'Erro');
    }).finally(() => { hide(); setRemovendoImportados(false); });
  };

  const deduplicar = () => {
    if (!cartaoAberto || deduplicando) return;
    setDeduplicando(true);
    const hide = message.loading('Procurando e removendo duplicados…', 0);
    callServer<ServerResponse<DedupResultado>>('deduplicarFaturaCartao', cartaoAberto.id).then((res) => {
      if (res.ok) {
        const d = res.data as DedupResultado | undefined;
        setDedupRes(d ?? { removidos: 0, itens: [], quando: '', cartaoNome: '', historico: [] });
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res.error || 'Erro');
    }).finally(() => { hide(); setDeduplicando(false); });
  };

  const editarLancamento = (l: LancamentoPessoal) => {
    setFaturaOpen(false);
    onEditarLancamento(l);
  };

  // Dá baixa em lote nos lançamentos informados (botão "Pagar fatura").
  const pagarFatura = (ids: string[]) => {
    if (ids.length === 0 || pagandoFatura) return;
    setPagandoFatura(true);
    const hide = message.loading('Dando baixa na fatura…', 0);
    callServer<ServerResponse<{ pagos: number }>>('marcarLancamentosPagos', JSON.stringify(ids)).then((res) => {
      if (res?.ok) {
        const n = (res.data as { pagos: number } | undefined)?.pagos ?? ids.length;
        message.success(`${n} lançamento(s) pago(s)`);
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
      } else message.error(res?.error || 'Erro ao pagar fatura');
    }).finally(() => { hide(); setPagandoFatura(false); });
  };

  // Atribui em lote (100% de cada item) os lançamentos selecionados a um membro.
  // Pra "essa fatura toda é do fulano" ou "esses itens são do fulano". Propaga
  // (4º arg true) parcelas futuras das compras parceladas pro mesmo membro.
  const atribuirLote = (ids: string[], membroId: string): Promise<boolean> => {
    if (ids.length === 0 || !membroId) return Promise.resolve(false);
    return callServer<ServerResponse<{ criadas: number }>>('atribuirLancamentosLote', JSON.stringify(ids), membroId, mes, true).then((res) => {
      if (res?.ok) {
        const n = (res.data as { criadas: number } | undefined)?.criadas ?? ids.length;
        message.success(`${n} cobrança(s) gerada(s)`);
        if (cartaoAberto) carregarFatura(cartaoAberto);
        onRecarregar();
        return true;
      }
      message.error(res?.error || 'Erro ao atribuir em lote');
      return false;
    });
  };

  return (
    <Panel
      title={`Cartões cadastrados${cartoes.length > 0 ? ` (${cartoes.length})` : ''}`}
      extra={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<Sparkles size={14} />} onClick={() => onImportar()}>Importar fatura</Button>
          <Button icon={<FileText size={14} />} onClick={onLancarFatura}>Lançar fatura</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Novo cartão</Button>
        </div>
      }
    >
      {cartoes.length === 0 ? (
        <Empty description="Nenhum cartão cadastrado. Cadastre pra ver a fatura aberta.">
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Cadastrar primeiro cartão</Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
          {cartoes.map((c) => (
            <CartaoCard
              key={c.id}
              cartao={c}
              onClick={() => verFatura(c)}
              onEditar={() => abrirEditar(c)}
              onRemover={() => remover(c.id)}
              onImportar={() => onImportar(c.id)}
            />
          ))}
        </div>
      )}

      <ModalCartao
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cartao={editando}
        onSaved={() => { setModalOpen(false); onRecarregar(); }}
      />

      {/* Fatura do cartão: modal CENTRAL (antes era um drawer lateral). Centrado
          vertical e horizontalmente, largo pra respirar, com rolagem interna no
          corpo — assim as margens superior/inferior e laterais ficam harmônicas
          em qualquer tela. Minimalista e premium. */}
      <Modal
        title={faturaAtual ? `Fatura ${faturaAtual.cartao.apelido || faturaAtual.cartao.nome}` : 'Fatura'}
        open={faturaOpen}
        onCancel={() => setFaturaOpen(false)}
        footer={null}
        centered
        width="min(880px, 94vw)"
        destroyOnClose
        styles={{
          content: { borderRadius: 22, boxShadow: t.shadowSoft, padding: '22px 26px 22px' },
          header: { marginBottom: 14 },
          // Corpo de altura fixa SEM rolagem geral — quem rola é só a lista de
          // lançamentos (ver DetalheFatura). Topo (resumo + abas) fica travado.
          body: { height: '74vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 },
        }}
      >
        <DetalheFatura
          fatura={faturaAtual}
          loading={loadingFatura}
          todosItens={itensCartao}
          membros={membros}
          membrosDe={membrosDe}
          onRemover={removerLancamento}
          onEditar={editarLancamento}
          onRemoverImportados={removerImportados}
          onZerarDaquiPraFrente={zerarDaquiPraFrente}
          onZerarImportados={zerarImportados}
          onHistorico={() => setHistAberto(true)}
          removendoImportados={removendoImportados}
          onDeduplicar={deduplicar}
          deduplicando={deduplicando}
          onPagarFatura={pagarFatura}
          pagandoFatura={pagandoFatura}
          onAtribuir={onAtribuir}
          onAtribuirLote={atribuirLote}
          onPromoverAssinatura={(l) => setPromoverLanc(l)}
          lancAssinaturaIds={lancAssinaturaIds}
          assinaturaEspelhoSigs={assinaturaEspelhoSigs}
        />
      </Modal>

      <DedupResultadoModal res={dedupRes} onClose={() => setDedupRes(null)} />

      <HistoricoImportacoesModal
        open={histAberto}
        cartao={cartaoAberto}
        onClose={() => setHistAberto(false)}
      />

      <PromoverAssinaturaModal
        open={!!promoverLanc}
        lancamento={promoverLanc}
        cartao={cartaoAberto}
        cartoes={cartoes}
        onClose={() => setPromoverLanc(null)}
        onSaved={(nova) => { setPromoverLanc(null); onAssinaturaCriada?.(nova); }}
      />
    </Panel>
  );
}

function CartaoCard({ cartao, onClick, onEditar, onRemover, onImportar }: { cartao: CartaoPessoal; onClick: () => void; onEditar: () => void; onRemover: () => void; onImportar: () => void }): React.ReactElement {
  const t = useTokens();
  // Sinal de status da fatura do mês: verde = paga / sem pendência; laranja =
  // em aberto. Mostra num relance o que ainda falta pagar nos cartões.
  const aPagarMes = cartao.aPagarMes ?? 0;
  const faturaPaga = aPagarMes <= 0.005;
  const statusCor = faturaPaga ? '#22c55e' : '#f59e0b';
  const statusLabel = faturaPaga
    ? 'Fatura do mês paga (sem pendência)'
    : `Fatura do mês em aberto: ${formatBRL(aPagarMes)}`;
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${cartao.cor}, ${cartao.cor}cc)`,
        borderRadius: 14,
        padding: 15,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        minHeight: 128,
      }}
      onClick={onClick}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <CreditCard size={23} strokeWidth={1.5} />
          <Tooltip title={statusLabel}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%', background: statusCor,
              border: '2px solid rgba(255,255,255,0.95)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)', display: 'inline-block', flexShrink: 0,
            }} />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Importar fatura (PDF/texto)">
            <Button
              size="small" type="text" icon={<Sparkles size={12} />}
              onClick={onImportar}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              size="small" type="text" icon={<Pencil size={12} />}
              onClick={onEditar}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
          </Tooltip>
          <Popconfirm title="Remover esse cartão?" onConfirm={onRemover} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button size="small" type="text" icon={<Trash2 size={12} />} style={{ color: 'rgba(255,255,255,0.85)' }} />
          </Popconfirm>
        </div>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 500, marginBottom: 3 }}>
        {cartao.apelido || cartao.nome}
      </div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, opacity: 0.85, marginBottom: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {cartao.bandeira} · fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}
      </div>
      {(() => {
        const limite = cartao.limite || 0;
        const emAberto = cartao.emAberto ?? 0;
        const disponivel = cartao.disponivel ?? (limite - emAberto);
        const pctUso = limite > 0 ? Math.min(100, Math.max(0, (emAberto / limite) * 100)) : 0;
        const temUso = emAberto > 0 || cartao.disponivel !== undefined;
        return (
          <>
            <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, opacity: 0.85 }}>
              {temUso ? 'Limite disponível' : 'Limite'}
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: 16.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(temUso ? Math.max(0, disponivel) : limite)}
            </div>
            {temUso && limite > 0 && (
              <>
                <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                  <div style={{ width: `${pctUso}%`, height: '100%', background: 'rgba(255,255,255,0.9)', borderRadius: 4 }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 10, opacity: 0.8, fontFamily: FONTS.ui, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBRL(emAberto)} usado de {formatBRL(limite)}
                </div>
              </>
            )}
          </>
        );
      })()}
      <div style={{ marginTop: 10, fontSize: 10.5, opacity: 0.7, fontFamily: FONTS.ui }}>
        Clique pra ver fatura aberta →
      </div>
    </div>
  );
}

interface DedupItem { id: string; descricao: string; valor: number; data: string; vencimento: string; status: string; parcelaAtual: number; parcelas: number; manteve: string }
interface DedupLogRun { cartaoId: string; cartaoNome: string; quando: string; removidos: number; itens: DedupItem[] }
interface DedupResultado { removidos: number; itens: DedupItem[]; quando: string; cartaoNome: string; historico: DedupLogRun[] }

// ─── Histórico de importações ─────────────────────────────────────────────────
// Registro PERMANENTE de cada importação de fatura (tabela FinPessoalImportacoes):
// sobrevive a "remover importados"/"zerar". Modal central premium: timeline com
// resumo numérico de cada importação + itens expandíveis (descrição, parcela x/y,
// valor). É a memória de referência pra conferir "o que entrou, quanto e quando".
interface ImportacaoLog {
  id: string;
  competencia: string;
  quando: string;
  totalFatura: number;
  totalImportado: number;
  qtdItens: number;
  criados: number;
  conciliados: number;
  duplicados: number;
  parcelasFuturas: number;
  gruposNovos: number;
  status: string;
  itensJson: string;
}

function HistoricoImportacoesModal({ open, cartao, onClose }: {
  open: boolean;
  cartao: CartaoPessoal | null;
  onClose: () => void;
}): React.ReactElement {
  const t = useTokens();
  const [carregando, setCarregando] = useState(false);
  const [registros, setRegistros] = useState<ImportacaoLog[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !cartao) return;
    setCarregando(true);
    setExpandido(null);
    callServer<ServerResponse<ImportacaoLog[]>>('getHistoricoImportacoes', cartao.id)
      .then((res) => setRegistros(res?.ok ? ((res.data as ImportacaoLog[]) || []) : []))
      .catch(() => setRegistros([]))
      .finally(() => setCarregando(false));
  }, [open, cartao]);

  const chip = (label: string, cor: string) => (
    <span style={{
      fontFamily: FONTS.ui, fontSize: 11, color: cor, background: `${cor}18`,
      border: `1px solid ${cor}44`, borderRadius: 999, padding: '1px 9px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );

  const itensDe = (r: ImportacaoLog): Array<{ d: string; v: number; p: string }> => {
    try {
      const arr = JSON.parse(String(r.itensJson || '[]')) as Array<{ d?: string; v?: number; p?: string }>;
      return Array.isArray(arr) ? arr.map((x) => ({ d: String(x.d || ''), v: Number(x.v || 0), p: String(x.p || '') })) : [];
    } catch { return []; }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={660}
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, background: `${t.accents.peach}1c`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <History size={17} color={t.accents.peach} />
          </span>
          <div>
            <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 500, color: t.text }}>
              Histórico de importações
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, fontWeight: 400 }}>
              {cartao ? (cartao.apelido || cartao.nome) : ''} · registro permanente — sobrevive a remoções e reimportações
            </div>
          </div>
        </div>
      }
    >
      <div className="forja-scroll-y" style={{ maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, marginTop: 6 }}>
        {carregando && (
          <div style={{ textAlign: 'center', padding: 32, color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>
            Carregando histórico…
          </div>
        )}
        {!carregando && registros.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
                Nenhuma importação registrada ainda — o registro é gravado automaticamente a cada importação daqui pra frente.
              </span>
            }
          />
        )}
        {!carregando && registros.map((r) => {
          const itens = itensDe(r);
          const parcelados = itens.filter((i) => i.p).length;
          const temPdf = Number(r.totalFatura || 0) > 0;
          const delta = Math.round((Number(r.totalImportado || 0) - Number(r.totalFatura || 0)) * 100) / 100;
          const bateu = temPdf && Math.abs(delta) < 0.01;
          const aberto = expandido === r.id;
          return (
            <div
              key={r.id}
              style={{
                border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px',
                background: t.surface, display: 'flex', flexDirection: 'column', gap: 9,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 500, color: t.text }}>
                    Fatura {r.competencia}
                  </span>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginLeft: 8 }}>
                    importada em {dayjs(r.quando).isValid() ? dayjs(r.quando).format('DD/MM/YYYY HH:mm') : String(r.quando)}
                  </span>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBRL(Number(r.totalImportado || 0))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {chip(`${r.qtdItens} itens`, t.accents.peach)}
                {parcelados > 0 && chip(`${parcelados} parcelados`, t.accents.lavender)}
                {Number(r.conciliados || 0) > 0 && chip(`${r.conciliados} conciliados c/ provisão`, t.accents.sage)}
                {Number(r.parcelasFuturas || 0) > 0 && chip(`${r.parcelasFuturas} futuras provisionadas`, t.accents.blue)}
                {Number(r.duplicados || 0) > 0 && chip(`${r.duplicados} ignorados (já existiam)`, t.accents.rose)}
                {temPdf && chip(
                  bateu ? `bateu com o PDF (${formatBRL(Number(r.totalFatura))})` : `PDF ${formatBRL(Number(r.totalFatura))} · Δ ${formatBRL(delta)}`,
                  bateu ? t.accents.sage : t.accents.rose,
                )}
                {chip(r.status === 'pago' ? 'lançada como paga' : 'lançada como pendente', t.textTertiary)}
              </div>
              {itens.length > 0 && (
                <div>
                  <Button
                    size="small"
                    type="text"
                    style={{ color: t.accents.peach, fontFamily: FONTS.ui, fontSize: 12, paddingLeft: 0 }}
                    onClick={() => setExpandido(aberto ? null : r.id)}
                  >
                    {aberto ? 'Ocultar itens' : `Ver os ${itens.length} itens`}
                  </Button>
                  {aberto && (
                    <div className="forja-scroll-y" style={{
                      maxHeight: 240, overflowY: 'auto', marginTop: 6,
                      border: `1px solid ${t.border}`, borderRadius: 10,
                    }}>
                      {itens.map((i, idx) => (
                        <div key={idx} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                          padding: '6px 12px', borderTop: idx > 0 ? `1px solid ${t.border}` : 'none',
                        }}>
                          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {i.d}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {i.p && (
                              <span style={{
                                fontFamily: FONTS.mono, fontSize: 10.5, color: t.accents.peach,
                                background: `${t.accents.peach}14`, borderRadius: 6, padding: '0 6px',
                              }}>
                                {i.p}
                              </span>
                            )}
                            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: i.v < 0 ? t.accents.sage : t.text, fontVariantNumeric: 'tabular-nums' }}>
                              {formatBRL(i.v)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// Mostra o resultado da limpeza de duplicados: quantos e QUAIS foram removidos,
// com um histórico das limpezas anteriores (o "log" pedido).
function DedupResultadoModal({ res, onClose }: { res: DedupResultado | null; onClose: () => void }): React.ReactElement {
  const t = useTokens();
  const [verLog, setVerLog] = useState(false);
  const n = res?.removidos ?? 0;
  const mesDe = (it: DedupItem) => (String(it.vencimento || '').substring(0, 7)) || String(it.data || '').substring(0, 7);
  const anteriores = (res?.historico || []).slice(1); // [0] é a execução atual
  return (
    <Modal
      open={!!res}
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>Fechar</Button>}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {n > 0
            ? <CheckCircle2 size={17} color={t.accents.sage} />
            : <AlertCircle size={17} color={t.accents.peach} />}
          {n > 0 ? `${n} duplicado(s) removido(s)` : 'Nenhum duplicado encontrado'}
        </span>
      }
    >
      {n === 0 ? (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          Não achei parcelas repetidas neste cartão pelos critérios de segurança (mesmo cartão, nº da parcela e ao
          menos 2 de 3: mês, valor, descrição). Se você ainda vê itens repetidos, pode ser que sejam parcelas de
          <b> totais diferentes</b> (ex.: uma leitura como 10x e outra como 12x) — nesse caso me diga que ajusto, ou
          apague o grupo errado manualmente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflow: 'auto' }}>
          {(res?.itens || []).map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${t.borderSoft}`, borderRadius: 8 }}>
              <Trash2 size={13} color={t.accents.rose} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.descricao}{it.parcelas > 1 ? ` (${it.parcelaAtual}/${it.parcelas})` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: t.textTertiary }}>{mesDe(it)} · {it.status}</div>
              </div>
              <span style={{ fontSize: 12.5, color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {anteriores.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setVerLog((v) => !v)}>
            {verLog ? 'Ocultar' : 'Ver'} limpezas anteriores ({anteriores.length})
          </Button>
          {verLog && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {anteriores.map((r, i) => (
                <div key={i} style={{ fontSize: 11.5, color: t.textTertiary, display: 'flex', gap: 8 }}>
                  <History size={12} />
                  <span>{r.quando ? dayjs(r.quando).format('DD/MM/YY HH:mm') : '—'}</span>
                  <span>·</span>
                  <span>{r.removidos} removido(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

interface DetalheFaturaProps {
  fatura: FaturaAberta | null;
  loading: boolean;
  todosItens: LancamentoPessoal[];
  membros: FamiliaMembro[];
  membrosDe: (lancId: string) => FamiliaMembro[];
  onRemover: (id: string) => void;
  onEditar: (l: LancamentoPessoal) => void;
  onRemoverImportados: () => void;
  onZerarDaquiPraFrente?: () => void;
  onZerarImportados?: () => void;
  onHistorico?: () => void;
  removendoImportados?: boolean;
  onDeduplicar?: () => void;
  deduplicando?: boolean;
  onPagarFatura: (ids: string[]) => void;
  pagandoFatura?: boolean;
  onAtribuir: (l: LancamentoPessoal) => void;
  onAtribuirLote: (ids: string[], membroId: string) => Promise<boolean>;
  onPromoverAssinatura?: (l: LancamentoPessoal) => void;
  lancAssinaturaIds?: Set<string>;
  assinaturaEspelhoSigs?: Set<string>;
}

// 'YYYY-MM' → "junho de 2026" (pt-BR). Usado em notas que citam a competência.
function compToLabelMes(comp: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(comp || ''));
  if (!m) return String(comp || '');
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// Avatar circular de um membro: ícone lucide (chave em `emoji`), emoji legado ou
// inicial, sobre a cor dele. Delega ao componente compartilhado.
function MembroChip({ membro, style }: { membro: FamiliaMembro; style?: React.CSSProperties }): React.ReactElement {
  return <MembroChipAvatar membro={membro} size={20} style={style} />;
}

// Botão de atribuição: mostra o "boneco" genérico quando não há atribuição, e os
// avatares dos membros (substituindo o boneco) quando o lançamento já foi
// atribuído. Em ambos os casos, clicar abre a modal de atribuição pra editar.
function BotaoAtribuirMembro({ atribuidos, onClick }: { atribuidos: FamiliaMembro[]; onClick: () => void }): React.ReactElement {
  const t = useTokens();
  if (atribuidos.length === 0) {
    return (
      <Tooltip title="Atribuir a membro(s) da família">
        <Button size="small" type="text" icon={<Users size={13} />} onClick={onClick} />
      </Tooltip>
    );
  }
  const nomes = atribuidos.map((m) => m.nome).join(', ');
  return (
    <Tooltip title={`Atribuído a ${nomes} · clique pra editar`}>
      <Button size="small" type="text" onClick={onClick} style={{ padding: '0 6px', height: 24 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {atribuidos.slice(0, 3).map((m, i) => (
            <MembroChip key={m.id} membro={m} style={{ marginInlineStart: i === 0 ? 0 : -7 }} />
          ))}
          {atribuidos.length > 3 && (
            <span style={{ fontSize: 10, marginInlineStart: 3, color: t.textTertiary }}>+{atribuidos.length - 3}</span>
          )}
        </span>
      </Button>
    </Tooltip>
  );
}

// Linha de lançamento com ações (editar / excluir / atribuir). Reusada na janela
// da fatura e na lista completa do cartão.
// Heurística: a compra "cheira" a assinatura/serviço recorrente? Cruza a descrição
// com um catálogo de serviços comuns (streaming, música, IA, software, jogos…).
const ASSINATURA_KEYWORDS = [
  'netflix', 'prime video', 'amazon prime', 'prime canais', 'prime channels', 'disney', 'star+',
  'hbo', 'globoplay', 'paramount', 'apple tv', 'apple.com/bill', 'youtube premium', 'youtube',
  'spotify', 'deezer', 'tidal', 'crunchyroll', 'claro tv', 'telecine', 'mubi', 'looke',
  'chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'google one', 'icloud', 'dropbox',
  'notion', 'canva', 'adobe', 'microsoft', 'office 365', 'office365', 'github', 'figma', 'linkedin',
  'midjourney', 'perplexity', 'gympass', 'totalpass', 'kindle unlimited', 'audible', 'amazon music',
  'apple music', 'amazon ad free', 'playstation', 'xbox', 'game pass', 'nintendo', 'twitch',
];
function pareceAssinatura(l: LancamentoPessoal): boolean {
  const d = String(l.descricao || '').toLowerCase();
  return !!d && ASSINATURA_KEYWORDS.some((k) => d.indexOf(k) >= 0);
}

// Assinatura de uma descrição/valor — chave ESTÁVEL pra casar uma compra da fatura
// com a assinatura-espelho criada a partir dela, mesmo que o id do lançamento mude
// (reimportar a fatura recria os lançamentos com ids novos, deixando o
// `origemLancamentoId` da espelho apontando pro id antigo). Combina valor (em
// centavos) + primeiras palavras do nome normalizado. Tolerante ao marcador de
// parcela "x/y" e a acentos/caixa.
function sigEspelho(nome: string, valor: number): string {
  const n = String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\(?\d{1,2}\s*\/\s*\d{1,2}\)?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ').filter(Boolean).slice(0, 4).join(' ');
  return `${Math.round(Math.abs(Number(valor) || 0) * 100)}|${n}`;
}
function inferirCategoriaAssinatura(desc: string): { categoria: string; cor: string; icone: string } {
  const d = String(desc || '').toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => d.indexOf(k) >= 0);
  if (has('spotify', 'deezer', 'tidal', 'apple music', 'amazon music')) return { categoria: 'musica', cor: '#1DB954', icone: 'music' };
  if (has('chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'midjourney', 'perplexity')) return { categoria: 'ia', cor: '#10a37f', icone: 'sparkles' };
  if (has('icloud', 'google one', 'dropbox')) return { categoria: 'cloud', cor: '#3b82f6', icone: 'cloud' };
  if (has('notion', 'canva', 'adobe', 'microsoft', 'office', 'github', 'figma', 'linkedin')) return { categoria: 'software', cor: '#6366f1', icone: 'laptop' };
  if (has('playstation', 'xbox', 'game pass', 'nintendo', 'twitch')) return { categoria: 'jogos', cor: '#7c3aed', icone: 'gamepad-2' };
  return { categoria: 'streaming', cor: '#8b5cf6', icone: 'tv' };
}

const CATEGORIAS_ASSINATURA = [
  { value: 'streaming', label: 'Streaming' },
  { value: 'musica', label: 'Música' },
  { value: 'ia', label: 'IA' },
  { value: 'software', label: 'Software' },
  { value: 'cloud', label: 'Cloud / Armazenamento' },
  { value: 'jogos', label: 'Jogos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'outros', label: 'Outros' },
];

// Modal enxuto pra "promover" uma compra da fatura a Assinatura (espelho
// consultivo: não soma de novo nos totais). Prefilled a partir do lançamento.
function PromoverAssinaturaModal({ open, lancamento, cartao, cartoes, onClose, onSaved }: {
  open: boolean;
  lancamento: LancamentoPessoal | null;
  cartao: CartaoPessoal | null;
  cartoes: CartaoPessoal[];
  onClose: () => void;
  onSaved: (nova?: AssinaturaPessoal) => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && lancamento) {
      const inf = inferirCategoriaAssinatura(lancamento.descricao || '');
      const dia = lancamento.data ? Math.max(1, Math.min(31, dayjs(lancamento.data).date())) : 5;
      const nome = String(lancamento.descricao || '')
        .replace(/\(?\d{1,2}\s*\/\s*\d{1,2}\)?/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim() || 'Assinatura';
      form.setFieldsValue({
        nome,
        categoria: inf.categoria,
        valor: Math.abs(Number(lancamento.valor || 0)),
        ciclo: 'mensal',
        diaCobranca: dia,
        cartaoId: cartao?.id || lancamento.cartaoId || undefined,
      });
    }
  }, [open, lancamento, cartao, form]);

  const salvar = async (v: Record<string, unknown>) => {
    if (!lancamento) return;
    setSaving(true);
    try {
      const inf = inferirCategoriaAssinatura(String(v['nome'] || lancamento.descricao || ''));
      const payload = {
        nome: String(v['nome'] || '').trim(),
        categoria: String(v['categoria'] || inf.categoria),
        valor: Number(v['valor'] || 0),
        ciclo: String(v['ciclo'] || 'mensal'),
        diaCobranca: Number(v['diaCobranca'] || 5),
        metodo: 'cartao',
        cartaoId: String(v['cartaoId'] || ''),
        status: 'ativa',
        espelho: 'sim',
        origemLancamentoId: lancamento.id,
        dataInicio: lancamento.data || '',
        cor: inf.cor,
        icone: inf.icone,
      };
      const res = await callServer<ServerResponse<unknown>>('salvarAssinatura', payload);
      if (res.ok) {
        message.success('Adicionada às Assinaturas (espelho — não soma de novo)');
        // Devolve a linha criada pro pai aplicar de forma OTIMISTA (selo na hora),
        // sem esperar o recarregar pesado. Fallback: monta o objeto do payload.
        const nova = (res.data as AssinaturaPessoal | undefined) || ({ ...payload } as unknown as AssinaturaPessoal);
        onSaved(nova);
      } else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); } finally { setSaving(false); }
  };

  return (
    <Modal
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Repeat size={16} /> Adicionar às Assinaturas</span>}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Adicionar"
      cancelText="Cancelar"
      width={520}
      destroyOnClose
    >
      <div style={{ background: `${t.accents.lavender}14`, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
        Vira um <strong style={{ color: t.text }}>espelho consultivo</strong>: aparece na aba Assinaturas pra gestão, mas <strong style={{ color: t.text }}>não soma de novo</strong> no total do mês — a fatura do cartão já contabiliza esse gasto.
      </div>
      <Form form={form} layout="vertical" onFinish={salvar}>
        <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Informe o nome' }]}>
          <Input placeholder="Ex: Amazon Prime" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="valor" label="Valor (por ciclo)" style={{ flex: 1 }} rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} step={0.01} precision={2} prefix="R$" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ciclo" label="Ciclo" style={{ width: 120 }}>
            <Select options={[{ value: 'mensal', label: 'Mensal' }, { value: 'anual', label: 'Anual' }]} />
          </Form.Item>
          <Form.Item name="diaCobranca" label="Dia" style={{ width: 86 }}>
            <InputNumber min={1} max={31} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="categoria" label="Categoria" style={{ flex: 1 }}>
            <Select options={CATEGORIAS_ASSINATURA} />
          </Form.Item>
          <Form.Item name="cartaoId" label="Cartão" style={{ flex: 1 }}>
            <Select allowClear placeholder="Cartão" options={cartoes.map((c) => ({ value: c.id, label: c.apelido || c.nome }))} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

function LinhaLancamentoFatura({ l, membros, atribuidos, onRemover, onEditar, onAtribuir, onPromoverAssinatura, temAssinatura, mostrarMes, selecionavel, selecionado, onToggleSel }: { l: LancamentoPessoal; membros?: FamiliaMembro[]; atribuidos?: FamiliaMembro[]; onRemover: (id: string) => void; onEditar: (l: LancamentoPessoal) => void; onAtribuir?: (l: LancamentoPessoal) => void; onPromoverAssinatura?: (l: LancamentoPessoal) => void; temAssinatura?: boolean; mostrarMes?: boolean; selecionavel?: boolean; selecionado?: boolean; onToggleSel?: (id: string) => void }): React.ReactElement {
  const t = useTokens();
  const labelCategoria = useLabelCategoria();
  const importado = String(l.tags || '').indexOf('fatura-importada') >= 0;
  return (
    <div
      onClick={selecionavel && onToggleSel ? () => onToggleSel(l.id) : undefined}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: `1px solid ${t.borderSoft}`, cursor: selecionavel ? 'pointer' : undefined }}
    >
      {selecionavel && (
        <Checkbox checked={!!selecionado} onChange={() => onToggleSel?.(l.id)} onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l.descricao || labelCategoria(l.categoria)}
          {importado && <Tag color="blue" style={{ marginInlineStart: 6, transform: 'scale(0.85)' }}>importado</Tag>}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
          {dayjs(l.data).format(mostrarMes ? 'DD/MM/YYYY' : 'DD/MM')} · {labelCategoria(l.categoria)}
          {l.parcelas && l.parcelas > 1 ? ` · ${l.parcelaAtual}/${l.parcelas}` : ''}
          {l.status && l.status !== 'pago' ? ` · ${l.status}` : ''}
        </div>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {formatBRL(l.valor)}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        {!selecionavel && temAssinatura && (
          <Tooltip title="Já está em Assinaturas (espelho) · gerencie na aba Assinaturas">
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, flexShrink: 0, color: t.accents.sage,
            }}>
              <BadgeCheck size={15} strokeWidth={2.25} />
            </span>
          </Tooltip>
        )}
        {!selecionavel && !temAssinatura && onPromoverAssinatura && (
          <Tooltip title="Marcar como assinatura (espelho — não soma de novo)">
            <Button
              size="small"
              type="text"
              icon={<BadgePlus size={15} />}
              onClick={() => onPromoverAssinatura(l)}
              style={{ color: t.accents.lavender }}
            />
          </Tooltip>
        )}
        {onAtribuir && membros && membros.length > 0 && (
          <BotaoAtribuirMembro atribuidos={atribuidos || []} onClick={() => onAtribuir(l)} />
        )}
        <Tooltip title="Editar (dá pra trocar o cartão aqui)">
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(l)} />
        </Tooltip>
        <Popconfirm title="Excluir este lançamento?" description="Sai da fatura, do a pagar e do resumo." onConfirm={() => onRemover(l.id)} okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
        </Popconfirm>
      </div>
    </div>
  );
}

// ─── Provisionamento de faturas futuras ──────────────────────────────────────
// Detecta a parcela de um lançamento. Prioriza os campos estruturados
// (parcela manual via "Novo lançamento 12x"); se não houver, faz parse do
// "x/y" no texto da descrição (caso das linhas importadas de fatura, onde o
// "4/8" é só texto e parcelas=1). Retorna null quando não é parcelado.
function detectarParcela(l: LancamentoPessoal): { atual: number; total: number } | null {
  if (l.parcelas && l.parcelas > 1 && l.parcelaAtual && l.parcelaAtual >= 1 && l.parcelaAtual <= l.parcelas) {
    return { atual: l.parcelaAtual, total: l.parcelas };
  }
  const m = String(l.descricao || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (m) {
    const atual = Number(m[1]);
    const total = Number(m[2]);
    if (total > 1 && atual >= 1 && atual <= total) return { atual, total };
  }
  return null;
}

interface ItemProvisao {
  descricao: string;
  valor: number;
  projetado: boolean; // true = parcela futura projetada (ainda não existe como lançamento)
  parcelaLabel?: string; // ex: "5/8"
}
interface MesProvisao {
  mes: string; // YYYY-MM
  total: number;
  itens: ItemProvisao[];
}

// Monta a projeção das próximas faturas a partir dos lançamentos EM ABERTO do
// cartão. Cada item cai no mês de `vencimento || data`. Itens parcelados (k/N)
// projetam as parcelas futuras (k+1..N) nos meses seguintes — essas são
// "provisões" (não existem como lançamento ainda). `mesesAfrente` limita o
// horizonte. Inclui o mês corrente em diante.
function construirProvisao(itens: LancamentoPessoal[], mesesAfrente = 18): MesProvisao[] {
  const mapa = new Map<string, MesProvisao>();
  const mesCorrente = dayjs().format('YYYY-MM');

  const garante = (mes: string): MesProvisao => {
    let m = mapa.get(mes);
    if (!m) { m = { mes, total: 0, itens: [] }; mapa.set(mes, m); }
    return m;
  };

  for (const l of itens) {
    if (l.status === 'pago') continue;
    const baseStr = String(l.vencimento || l.data || '').slice(0, 10);
    const base = baseStr ? dayjs(baseStr) : dayjs();
    if (!base.isValid()) continue;
    const parc = detectarParcela(l);

    // A parcela/linha que JÁ existe como lançamento entra no seu próprio mês.
    const mesBase = base.format('YYYY-MM');
    const alvoBase = garante(mesBase);
    alvoBase.itens.push({
      descricao: l.descricao,
      valor: l.valor,
      projetado: false,
      parcelaLabel: parc ? `${parc.atual}/${parc.total}` : undefined,
    });
    alvoBase.total += l.valor;

    // Projeta as parcelas futuras (k+1..N) — uma por mês. SÓ pra parcelas que
    // NÃO foram materializadas como lançamentos reais (parcelaGrupoId vazio). Os
    // imports novos já criam as parcelas futuras como pendentes, então projetar
    // de novo duplicaria. Mantém a projeção pra lançamentos só-texto antigos.
    if (parc && parc.total > parc.atual && !String(l.parcelaGrupoId || '')) {
      for (let j = parc.atual + 1; j <= parc.total; j++) {
        const mesFut = base.add(j - parc.atual, 'month').format('YYYY-MM');
        const alvo = garante(mesFut);
        // Remove o sufixo "(x/y)" da descrição pra recolocar a parcela certa
        const descLimpa = l.descricao.replace(/\s*\(?\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/, '').trim();
        alvo.itens.push({
          descricao: descLimpa || l.descricao,
          valor: l.valor,
          projetado: true,
          parcelaLabel: `${j}/${parc.total}`,
        });
        alvo.total += l.valor;
      }
    }
  }

  return Array.from(mapa.values())
    .filter((m) => m.mes >= mesCorrente)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(0, mesesAfrente);
}

function ProvisaoFaturas({ itens }: { itens: LancamentoPessoal[] }): React.ReactElement {
  const t = useTokens();
  const meses = useMemo(() => construirProvisao(itens), [itens]);
  const totalGeral = meses.reduce((s, m) => s + m.total, 0);
  const qtdProjetadas = meses.reduce((s, m) => s + m.itens.filter((i) => i.projetado).length, 0);

  if (meses.length === 0) {
    return <Empty description="Sem lançamentos em aberto pra projetar" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '12px 14px',
      }}>
        <div style={{ fontSize: 11.5, color: t.textTertiary, fontFamily: FONTS.ui, letterSpacing: 0.4 }}>
          PROVISÃO · próximos {meses.length} mês(es)
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          {formatBRL(totalGeral)}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
          {qtdProjetadas} parcela(s) futura(s) projetada(s) a partir do "x/y" + parcelas reais
        </div>
      </div>

      {meses.map((m) => (
        <div key={m.mes} style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: t.surfaceMuted, borderBottom: `1px solid ${t.borderSoft}`,
          }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, textTransform: 'capitalize' }}>
              {new Date(m.mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(m.total)}
            </div>
          </div>
          <div style={{ padding: '6px 14px 10px' }}>
            {m.itens.map((it, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '6px 0', borderBottom: idx < m.itens.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                opacity: it.projetado ? 0.72 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.descricao}
                  </span>
                  {it.parcelaLabel && (
                    <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }} color={it.projetado ? 'default' : 'blue'}>
                      {it.parcelaLabel}
                    </Tag>
                  )}
                  {it.projetado && (
                    <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }} color="gold">provisão</Tag>
                  )}
                </div>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatBRL(it.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetalheFatura({ fatura, loading, todosItens, membros, membrosDe, onRemover, onEditar, onRemoverImportados, onZerarDaquiPraFrente, onZerarImportados, onHistorico, removendoImportados, onDeduplicar, deduplicando, onPagarFatura, pagandoFatura, onAtribuir, onAtribuirLote, onPromoverAssinatura, lancAssinaturaIds, assinaturaEspelhoSigs }: DetalheFaturaProps): React.ReactElement {
  // Selo "já é assinatura": casa por id (rápido) OU por assinatura estável
  // valor+nome (sobrevive a reimportação que troca o id do lançamento).
  const temAssinaturaDe = (l: LancamentoPessoal): boolean =>
    !!lancAssinaturaIds?.has(l.id) ||
    !!assinaturaEspelhoSigs?.has(sigEspelho(String(l.descricao || ''), Number(l.valor || 0)));
  const t = useTokens();
  // Modo de atribuição em lote: escolhe um membro e marca itens (ou a fatura
  // toda) pra dizer "isso é do fulano". 100% do valor de cada item vai pro membro.
  const [modoLote, setModoLote] = useState(false);
  const [membroLote, setMembroLote] = useState<string>('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvandoLote, setSalvandoLote] = useState(false);

  const toggleSel = (id: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const sairModoLote = () => { setModoLote(false); setSelecionados(new Set()); setMembroLote(''); };
  const atribuir = (ids: string[]) => {
    if (!membroLote || ids.length === 0) return;
    setSalvandoLote(true);
    Promise.resolve(onAtribuirLote(ids, membroLote))
      .then((ok) => { if (ok) sairModoLote(); })
      .finally(() => setSalvandoLote(false));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: t.textTertiary }}>Carregando fatura…</div>;
  if (!fatura) return <Empty description="Sem dados de fatura" />;

  // Escopado ao mês da fatura aberta — o "Remover importados" só mexe neste mês
  // (nunca mais zera meses anteriores).
  const mesFatura = fatura.mes || '';
  const mesDeLanc = (l: LancamentoPessoal) => (String(l.vencimento || '').substring(0, 7)) || (String(l.data || '').substring(0, 7));
  const qtdImportados = todosItens.filter((l) => String(l.tags || '').indexOf('fatura-importada') >= 0 && (!mesFatura || mesDeLanc(l) === mesFatura)).length;
  const qtdImportadosTotal = todosItens.filter((l) => String(l.tags || '').indexOf('fatura-importada') >= 0).length;
  // Reset "daqui pra frente": conta importados com competência >= mês aberto.
  // Os meses anteriores (e as atribuições a membros feitas neles) ficam de fora.
  const qtdImportadosAPartir = mesFatura
    ? todosItens.filter((l) => String(l.tags || '').indexOf('fatura-importada') >= 0 && mesDeLanc(l) >= mesFatura).length
    : 0;
  const totalTodos = todosItens.reduce((s, l) => s + l.valor, 0);
  // Raio-X do mês: de onde vem cada real do total (importados desta fatura,
  // parcelas provisionadas por faturas anteriores, recorrências, manuais) +
  // duplicidade suspeita (mesma parcela x/y da mesma compra 2+ vezes).
  const composicao = mesFatura ? composicaoFaturaMes(todosItens, mesFatura) : null;

  // Uso do limite considera tudo que está EM ABERTO no cartão (não pago),
  // independente da janela de fechamento. A "fatura da janela atual" (mês
  // corrente) costuma ser R$ 0 logo após o fechamento, mas o limite continua
  // comprometido pelas parcelas/pendências futuras — é isso que o usuário
  // precisa enxergar. `fatura.total` (janela) vira uma linha secundária.
  const totalEmAberto = todosItens
    .filter((l) => l.status !== 'pago')
    .reduce((s, l) => s + l.valor, 0);
  const limite = fatura.limite;
  const pctUso = limite > 0 ? (totalEmAberto / limite) * 100 : 0;
  const disponivel = limite - totalEmAberto;

  const corBarra = pctUso < 50 ? t.accents.sage
    : pctUso < 80 ? t.accents.peach
    : t.accents.rose;

  // "Pagar fatura" dá baixa no que está VENCIDO ou vence neste mês — NÃO toca
  // nas parcelas futuras (que não devem ser quitadas antecipadamente). Define a
  // fatura a pagar como tudo não-pago com vencimento/data até o fim do mês atual.
  const fimMesAtual = dayjs().endOf('month');
  const aPagarAgora = todosItens.filter((l) =>
    l.status !== 'pago' && !dayjs(l.vencimento || l.data).isAfter(fimMesAtual)
  );
  const totalAPagarAgora = aPagarAgora.reduce((s, l) => s + l.valor, 0);

  const blocoNumero = (label: string, valor: number, sub: string) => (
    <div style={{ flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: t.textTertiary, fontFamily: FONTS.ui, letterSpacing: 0.4 }}>{label}</div>
      <div style={{
        fontFamily: FONTS.display, fontSize: 27, fontWeight: 500, color: t.text,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 3,
      }}>
        {formatBRL(valor)}
      </div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 3 }}>{sub}</div>
    </div>
  );

  const abaLancamentos = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      {/* Ações no TOPO do drawer — antes ficavam no cabeçalho de "Todos os
          lançamentos" e desciam pro meio quando a janela atual tinha itens.
          Agora ficam sempre acessíveis aqui em cima. */}
      {!modoLote && ((todosItens.length > 0 && (membros.length > 0 || qtdImportadosTotal > 0)) || !!onHistorico) && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Histórico de importações — discreto mas "vivo" (anel de luz girando
              no ícone). Sempre disponível: o registro sobrevive a remoções. */}
          {onHistorico && (
            <Tooltip title="Registro permanente de cada importação: itens, parcelas e totais">
              <Button
                size="small"
                type="text"
                onClick={onHistorico}
                style={{ color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 12 }}
                icon={<span className="forja-live-icon" style={{ color: t.accents.peach }}><History size={13} /></span>}
              >
                Histórico
              </Button>
            </Tooltip>
          )}
          {todosItens.length > 0 && membros.length > 0 && (
            <Button size="small" icon={<Users size={13} />} onClick={() => setModoLote(true)}>
              Atribuir a membro
            </Button>
          )}
          {todosItens.length > 0 && onDeduplicar && (
            <Popconfirm
              title="Remover parcelas/itens duplicados?"
              description="Mantém uma cópia de cada parcela (a paga tem prioridade) e apaga as repetidas deste cartão."
              onConfirm={onDeduplicar}
              okText="Remover duplicados"
              cancelText="Cancelar"
              okButtonProps={{ danger: true, loading: deduplicando }}
            >
              <Button size="small" icon={<LayersIcon size={13} />} loading={deduplicando}>
                {deduplicando ? 'Limpando…' : 'Remover duplicados'}
              </Button>
            </Popconfirm>
          )}
          {qtdImportados > 0 && (
            <Popconfirm
              title={`Remover importados deste mês?`}
              description="Desfaz a importação DESTE mês por completo: remove o que ela criou no mês E as parcelas futuras que ela provisionou nos meses à frente. PRESERVA as parcelas provisionadas pelas faturas anteriores."
              onConfirm={onRemoverImportados}
              okText="Remover deste mês"
              cancelText="Cancelar"
              okButtonProps={{ danger: true, loading: removendoImportados }}
            >
              <Button size="small" danger icon={<Trash2 size={13} />} loading={removendoImportados}>
                {removendoImportados ? 'Removendo…' : `Remover importados do mês (${qtdImportados})`}
              </Button>
            </Popconfirm>
          )}
          {onZerarDaquiPraFrente && qtdImportadosAPartir > 0 && qtdImportadosAPartir < qtdImportadosTotal && (
            <Popconfirm
              title="Zerar importados deste mês em diante?"
              description={`Apaga os ${qtdImportadosAPartir} importado(s) de ${mesFatura} e dos meses à frente — inclusive parcelas provisionadas por faturas antigas nesses meses. Os meses PASSADOS ficam intactos, com as atribuições a membros da família preservadas. Depois, reimporte a fatura deste mês: ela recria o mês e reprovisiona as parcelas futuras.`}
              onConfirm={onZerarDaquiPraFrente}
              okText="Zerar daqui pra frente"
              cancelText="Cancelar"
              okButtonProps={{ danger: true, loading: removendoImportados }}
            >
              <Button size="small" danger icon={<RotateCcw size={13} />} loading={removendoImportados}>
                Zerar deste mês em diante ({qtdImportadosAPartir})
              </Button>
            </Popconfirm>
          )}
          {onZerarImportados && qtdImportadosTotal > 0 && (
            <Popconfirm
              title="Zerar TODOS os importados deste cartão?"
              description={`Começar do zero: apaga os ${qtdImportadosTotal} lançamento(s) importados de fatura deste cartão em TODOS os meses (passado e futuro), incluindo parcelas provisionadas e restos de importações antigas. Lançamentos manuais e recorrências ficam. Depois, reimporte a fatura mais recente.`}
              onConfirm={onZerarImportados}
              okText="Zerar tudo e recomeçar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true, loading: removendoImportados }}
            >
              <Button size="small" danger type="dashed" icon={<RotateCcw size={13} />} loading={removendoImportados}>
                Zerar importados do cartão ({qtdImportadosTotal})
              </Button>
            </Popconfirm>
          )}
        </div>
      )}

      {/* Raio-X do total do mês: responde "por que o total não bate com o PDF?"
          mostrando quanto veio de cada origem. A linha de provisionadas explica
          o valor "a mais" LEGÍTIMO (parcelas de faturas antigas que vencem
          agora); o alerta de duplicidade pega a conciliação que falhou. */}
      {composicao && (composicao.importadosAgora.qtd + composicao.provisionadosAnteriores.qtd + composicao.recorrencias.qtd + composicao.manuais.qtd) > 0 && (
        <div style={{
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, letterSpacing: 0.4 }}>
            COMPOSIÇÃO DO MÊS {dayjs(mesFatura + '-01').format('MMM/YYYY').toUpperCase()} · {formatBRL(composicao.total)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
            {composicao.importadosAgora.qtd > 0 && (
              <span>Importados desta fatura: <strong style={{ color: t.text }}>{formatBRL(composicao.importadosAgora.total)}</strong> ({composicao.importadosAgora.qtd})</span>
            )}
            {composicao.provisionadosAnteriores.qtd > 0 && (
              <Tooltip title="Parcelas de compras de faturas ANTERIORES, provisionadas na época e vencendo neste mês. É normal somarem ao total — a importação concilia com elas em vez de duplicar.">
                <span style={{ cursor: 'help' }}>Parcelas de faturas anteriores: <strong style={{ color: t.text }}>{formatBRL(composicao.provisionadosAnteriores.total)}</strong> ({composicao.provisionadosAnteriores.qtd})</span>
              </Tooltip>
            )}
            {composicao.recorrencias.qtd > 0 && (
              <span>Recorrências: <strong style={{ color: t.text }}>{formatBRL(composicao.recorrencias.total)}</strong> ({composicao.recorrencias.qtd})</span>
            )}
            {composicao.manuais.qtd > 0 && (
              <span>Manuais: <strong style={{ color: t.text }}>{formatBRL(composicao.manuais.total)}</strong> ({composicao.manuais.qtd})</span>
            )}
          </div>
          {composicao.totalExcedente > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 2 }}
              message={`Possível duplicidade: ${formatBRL(composicao.totalExcedente)} a mais em ${composicao.suspeitas.length} compra(s)`}
              description={
                <div style={{ fontSize: 12 }}>
                  {composicao.suspeitas.slice(0, 5).map((s) => (
                    <div key={s.ids[0]}>
                      {s.descricao}{s.parcela ? ` (${s.parcela})` : ''} — {s.qtd}× no mês (+{formatBRL(s.valorExcedente)})
                    </div>
                  ))}
                  {composicao.suspeitas.length > 5 && <div>… e mais {composicao.suspeitas.length - 5}.</div>}
                  <div style={{ marginTop: 4 }}>O botão &quot;Remover duplicados&quot; acima limpa mantendo 1 cópia de cada (a paga tem prioridade).</div>
                </div>
              }
            />
          )}
        </div>
      )}

      {/* Barra de atribuição em lote: escolhe o membro e diz "essa fatura toda
          é dele" ou marca só alguns itens. 100% do valor de cada item. */}
      {modoLote && (
        <div style={{
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
          borderRadius: 10, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Atribuir para:</span>
            <Select
              size="small"
              placeholder="Escolha um membro"
              value={membroLote || undefined}
              onChange={(v) => setMembroLote(v)}
              style={{ minWidth: 200, flex: '1 1 200px' }}
              options={membros.map((m) => ({
                value: m.id,
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <MembroChip membro={m} style={{ width: 16, height: 16, fontSize: 9, lineHeight: '16px' }} />
                    {m.nome}
                  </span>
                ),
              }))}
            />
            <Button size="small" type="text" onClick={sairModoLote}>Cancelar</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Popconfirm
              title="Atribuir a fatura inteira?"
              description={`Todos os ${todosItens.length} lançamento(s) deste cartão vão para o membro escolhido (100% de cada).`}
              onConfirm={() => atribuir(todosItens.map((l) => l.id))}
              okText="Atribuir tudo"
              cancelText="Cancelar"
              disabled={!membroLote}
            >
              <Button size="small" type="primary" loading={salvandoLote} disabled={!membroLote}
                style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
                Atribuir fatura inteira ({todosItens.length})
              </Button>
            </Popconfirm>
            <Button size="small" loading={salvandoLote} disabled={!membroLote || selecionados.size === 0}
              onClick={() => atribuir([...selecionados])}>
              Atribuir selecionados ({selecionados.size})
            </Button>
            {selecionados.size > 0 && (
              <Button size="small" type="text" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
            )}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
            Marque os itens de um membro e atribua; depois troque o membro e marque o restante.
          </div>
        </div>
      )}

      {/* SÓ esta área rola — as ações acima (Atribuir / Remover, barra de lote)
          ficam fixas junto do topo, pra a ação nunca "sumir" enquanto você
          percorre os lançamentos. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* A janela atual costuma estar vazia logo após o fechamento — nesse caso
          não mostramos placeholder, porque a lista completa do cartão (com os
          itens em aberto) vem logo abaixo. Só renderiza se houver itens. */}
      {fatura.lancamentos.length > 0 && (
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 8, letterSpacing: 0.4 }}>
            LANÇAMENTOS DA FATURA (JANELA ATUAL)
          </div>
          {fatura.lancamentos.map((l) => (
            <LinhaLancamentoFatura key={l.id} l={l} membros={membros} atribuidos={membrosDe(l.id)} onRemover={onRemover} onEditar={onEditar} onAtribuir={onAtribuir} onPromoverAssinatura={onPromoverAssinatura} temAssinatura={temAssinaturaDe(l)} selecionavel={modoLote} selecionado={selecionados.has(l.id)} onToggleSel={toggleSel} />
          ))}
        </div>
      )}

      {/* Todos os lançamentos do cartão — qualquer mês/status. É aqui que você
          encontra (e remove) itens importados no cartão errado ou fora da
          janela da fatura atual. */}
      <div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, marginBottom: 8 }}>
          TODOS OS LANÇAMENTOS DESTE CARTÃO ({todosItens.length})
          {todosItens.length > 0 && <span style={{ marginInlineStart: 6 }}>· {formatBRL(totalTodos)}</span>}
        </div>

        {todosItens.length === 0 ? (
          <Empty description="Nenhum lançamento neste cartão" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          todosItens.map((l) => (
            <LinhaLancamentoFatura key={l.id} l={l} membros={membros} atribuidos={membrosDe(l.id)} onRemover={onRemover} onEditar={onEditar} onAtribuir={onAtribuir} onPromoverAssinatura={onPromoverAssinatura} temAssinatura={temAssinaturaDe(l)} mostrarMes
              selecionavel={modoLote} selecionado={selecionados.has(l.id)} onToggleSel={toggleSel} />
          ))
        )}
      </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 0 }}>
      {/* Topo FIXO: resumo da fatura (números, barra de limite, pagar). A barra
          de abas também fica travada; só o conteúdo das abas (a lista de
          lançamentos) rola — ver o <style> da .forja-fatura-tabs abaixo. */}
      <style>{`
        .forja-fatura-tabs{display:flex;flex-direction:column;height:100%;min-height:0;}
        .forja-fatura-tabs > .ant-tabs-nav{flex-shrink:0;margin-bottom:12px;}
        .forja-fatura-tabs .ant-tabs-content-holder{flex:1;min-height:0;}
        .forja-fatura-tabs .ant-tabs-content{height:100%;}
        .forja-fatura-tabs .ant-tabs-tabpane{height:100%;}
      `}</style>
      <div style={{
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
        borderRadius: 12, padding: 16, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {blocoNumero(
            `FATURA ATUAL · vence dia ${fatura.diaVencimento}`,
            fatura.total,
            `janela ${dayjs(fatura.inicio).format('DD/MM')} a ${dayjs(fatura.fim).format('DD/MM')} · ${fatura.qtdLancamentos} lanç.`,
          )}
          {blocoNumero(
            'TOTAL EM ABERTO',
            totalEmAberto,
            'tudo não pago neste cartão',
          )}
        </div>
        {limite > 0 && (
          <div style={{ marginTop: 14 }}>
            <Progress
              percent={Math.min(100, Math.round(pctUso))}
              strokeColor={corBarra}
              size="small"
              format={() => `${pctUso.toFixed(0)}% do limite`}
            />
            <div style={{ fontSize: 11.5, color: t.textTertiary, fontFamily: FONTS.ui, marginTop: 4 }}>
              Disponível: {formatBRL(Math.max(0, disponivel))} de {formatBRL(limite)} · usado {formatBRL(totalEmAberto)}
            </div>
          </div>
        )}
        {aPagarAgora.length > 0 && (
          <Popconfirm
            title="Pagar a fatura?"
            description={`Dá baixa em ${aPagarAgora.length} lançamento(s) vencido(s) ou deste mês (${formatBRL(totalAPagarAgora)}). Parcelas futuras não são afetadas.`}
            onConfirm={() => onPagarFatura(aPagarAgora.map((l) => l.id))}
            okText="Pagar tudo"
            cancelText="Cancelar"
            okButtonProps={{ loading: pagandoFatura }}
          >
            <Button
              type="primary"
              icon={<CheckCircle2 size={15} />}
              block
              loading={pagandoFatura}
              style={{ marginTop: 14, background: t.accents.sage, borderColor: t.accents.sage }}
            >
              {pagandoFatura ? 'Dando baixa…' : `Pagar fatura (${formatBRL(totalAPagarAgora)}) · ${aPagarAgora.length} item(ns)`}
            </Button>
          </Popconfirm>
        )}
      </div>

      <Tabs
        className="forja-fatura-tabs"
        style={{ flex: 1, minHeight: 0 }}
        defaultActiveKey="lancamentos"
        items={[
          { key: 'lancamentos', label: 'Lançamentos', children: abaLancamentos },
          {
            key: 'provisao',
            label: 'Próximas faturas',
            children: (
              <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 6 }}>
                <ProvisaoFaturas itens={todosItens} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// ─── Sub-view: contas a pagar ─────────────────────────────────────────────────

interface ContasAPagarProps {
  pendentes: LancamentoPessoal[];
  cartoes: CartaoPessoal[];
  membros: FamiliaMembro[];
  membrosDe: (lancId: string) => FamiliaMembro[];
  onEditar: (l: LancamentoPessoal) => void;
  onRecarregar: () => void;
  onAtribuir: (l: LancamentoPessoal) => void;
}

function ContasAPagar({ pendentes, cartoes, membros, membrosDe, onEditar, onRecarregar, onAtribuir }: ContasAPagarProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const labelCategoria = useLabelCategoria();

  // Resolve o cartão de um lançamento (se houver). Retorna `null` quando o
  // método é 'cartao' MAS o `cartaoId` aponta pra um cartão que não existe
  // mais (ou está vazio). Esses são os "órfãos" — itens que somem da fatura.
  const cartaoDe = (l: LancamentoPessoal): CartaoPessoal | null => {
    if (l.metodo !== 'cartao') return null;
    return cartoes.find((c) => c.id === l.cartaoId) || null;
  };
  const isOrfao = (l: LancamentoPessoal): boolean => l.metodo === 'cartao' && !cartaoDe(l);
  const orfaos = pendentes.filter(isOrfao);

  // Ordena por vencimento (ou data se não tiver vencimento) — atrasados primeiro
  const ordenados = [...pendentes].sort((a, b) => {
    const da = a.vencimento || a.data;
    const db = b.vencimento || b.data;
    return da.localeCompare(db);
  });

  // Agrupa: atrasados, próximos 7 dias, futuros
  const hoje = dayjs().startOf('day');
  const limite7d = hoje.add(7, 'day');
  const atrasados = ordenados.filter((l) => {
    const venc = dayjs(l.vencimento || l.data);
    return venc.isBefore(hoje);
  });
  const proximos = ordenados.filter((l) => {
    const venc = dayjs(l.vencimento || l.data);
    return !venc.isBefore(hoje) && !venc.isAfter(limite7d);
  });
  const futuros = ordenados.filter((l) => {
    const venc = dayjs(l.vencimento || l.data);
    return venc.isAfter(limite7d);
  });

  const marcarPago = (id: string) => {
    callServer<ServerResponse<unknown>>('marcarLancamentoPago', id).then((res) => {
      if (res.ok) { message.success('Marcado como pago'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const excluir = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarLancamentoPessoal', id).then((res) => {
      if (res.ok) { message.success('Lançamento removido'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const renderGrupo = (titulo: string, items: LancamentoPessoal[], cor: string, icon: React.ReactNode) => {
    if (items.length === 0) return null;
    const total = items.reduce((s, l) => s + l.valor, 0);
    return (
      <Panel
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
            <span>{titulo}</span>
            <Tag color={cor === t.accents.rose ? 'red' : cor === t.accents.peach ? 'orange' : 'blue'} style={{ marginInlineEnd: 0 }}>
              {items.length} · {formatBRL(total)}
            </Tag>
          </div>
        }
        padding={0}
        style={{ marginBottom: 12 }}
      >
        <div>
          {items.map((l, idx) => {
            const venc = dayjs(l.vencimento || l.data);
            const diasDif = venc.diff(hoje, 'day');
            const labelDias =
              diasDif < 0 ? `${Math.abs(diasDif)}d atrasado` :
              diasDif === 0 ? 'vence hoje' :
              `em ${diasDif}d`;
            const cartao = cartaoDe(l);
            const orfao = isOrfao(l);
            return (
              <div
                key={l.id}
                data-lanc-id={l.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px',
                  borderBottom: idx < items.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                  background: orfao ? `${t.accents.rose}0d` : undefined,
                  transition: 'outline 0.2s ease',
                }}
              >
                <Calendar size={16} color={cor} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {l.descricao || labelCategoria(l.categoria)}
                    {String(l.tags || '').indexOf('fatura-importada') >= 0 && (
                      <Tag color="blue" style={{ marginInlineEnd: 0, transform: 'scale(0.85)' }}>importado</Tag>
                    )}
                    {orfao && (
                      <Tag color="red" style={{ marginInlineEnd: 0, transform: 'scale(0.85)' }}>órfão</Tag>
                    )}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
                    {venc.format('DD/MM/YYYY')} · {labelDias} · {labelCategoria(l.categoria)} · {labelMetodo(l.metodo)}
                    {l.metodo === 'cartao' && (cartao
                      ? ` · ${cartao.apelido || cartao.nome}`
                      : <span style={{ color: t.accents.rose, fontWeight: 600 }}> · cartão inválido</span>
                    )}
                  </div>
                </div>
                <div style={{
                  fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 500,
                  color: t.text, fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  {formatBRL(l.valor)}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {l.metodo === 'cartao' && cartao ? (
                    // Item de fatura: não se paga individual — quita-se a fatura
                    // inteira do cartão. O botão fica desabilitado e aponta o caminho.
                    <Tooltip title={`Faz parte da fatura do ${cartao.apelido || cartao.nome}. Pague a fatura completa em Cartões → ${cartao.apelido || cartao.nome}.`}>
                      <Button size="small" disabled icon={<CreditCard size={13} />}>
                        Via fatura
                      </Button>
                    </Tooltip>
                  ) : (
                    // Lançamento avulso (pix, boleto, dinheiro…): pode pagar individual.
                    <Tooltip title="Dar baixa: marcar como pago">
                      <Button size="small" type="primary" icon={<CheckCircle2 size={13} />} onClick={() => marcarPago(l.id)}>
                        Pagar
                      </Button>
                    </Tooltip>
                  )}
                  {membros.length > 0 && (
                    <BotaoAtribuirMembro atribuidos={membrosDe(l.id)} onClick={() => onAtribuir(l)} />
                  )}
                  <Tooltip title={orfao ? 'Editar (vincule a um cartão válido aqui)' : 'Editar'}>
                    <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(l)} />
                  </Tooltip>
                  <Popconfirm title="Excluir este lançamento?" onConfirm={() => excluir(l.id)} okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                    <Tooltip title="Excluir">
                      <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  };

  if (pendentes.length === 0) {
    return (
      <Panel padding={32}>
        <Empty description="Nenhuma conta pendente. Tudo em dia 🎉" />
      </Panel>
    );
  }

  const totalOrfaos = orfaos.reduce((s, l) => s + l.valor, 0);
  // v1.147 — rola até o primeiro órfão quando user clica "Ver órfãos" no alerta.
  const primeiroOrfaoId = orfaos[0]?.id;
  const irParaPrimeiroOrfao = () => {
    if (!primeiroOrfaoId) return;
    const el = document.querySelector(`[data-lanc-id="${primeiroOrfaoId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const original = el.style.outline;
      el.style.outline = `2px solid ${t.accents.rose}`;
      setTimeout(() => { el.style.outline = original; }, 1800);
    }
  };

  return (
    <div>
      {orfaos.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${orfaos.length} lançamento(s) órfão(s) · ${formatBRL(totalOrfaos)}`}
          description={
            <div style={{ fontSize: 12.5 }}>
              Esses itens estão marcados como pagos com cartão, mas o cartão de origem foi removido (ou nunca existiu).
              Por isso somem das telas de Cartões e Lançamentos do mês. Use <b>Editar</b> em cada um pra vincular ao cartão certo,
              ou <b>Excluir</b> pra removê-los se foram um engano.
            </div>
          }
          action={
            <Button size="small" onClick={irParaPrimeiroOrfao}>
              Ver órfãos
            </Button>
          }
        />
      )}
      {renderGrupo('Atrasados', atrasados, t.accents.rose, <AlertCircle size={16} />)}
      {renderGrupo('Próximos 7 dias', proximos, t.accents.peach, <Clock size={16} />)}
      {renderGrupo('Futuros', futuros, t.accents.blue, <Calendar size={16} />)}
    </div>
  );
}

// ─── Modal: atribuir lançamento a membro(s) da família (rateio) ───────────────

function ModalAtribuirMembros({ lancamento, membros, mes, onClose, onSaved }: {
  lancamento: LancamentoPessoal | null;
  membros: FamiliaMembro[];
  mes: string;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [sel, setSel] = useState<Record<string, { on: boolean; valor: number }>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [propagar, setPropagar] = useState(true);

  const ativos = membros.filter((m) => m.ativo !== 'nao');
  const valorLanc = lancamento?.valor || 0;
  // Compra parcelada? (mesmo grupo + mais de 1 parcela). Se sim, oferecemos
  // levar a atribuição pras parcelas seguintes.
  const ehParcelado = !!lancamento?.parcelaGrupoId && (lancamento?.parcelas || 0) > 1;
  const parcelasRestantes = ehParcelado
    ? Math.max(1, (lancamento?.parcelas || 0) - (lancamento?.parcelaAtual || 1) + 1)
    : 0;

  // Ao abrir: carrega cobranças já vinculadas a esse lançamento pra pré-preencher.
  useEffect(() => {
    if (!lancamento) return;
    setSel({});
    setLoading(true);
    callServer<ServerResponse<Array<{ membroId: string; valor: number }>>>('getCobrancasDoLancamento', lancamento.id)
      .then((res) => {
        const inicial: Record<string, { on: boolean; valor: number }> = {};
        if (res?.ok && Array.isArray(res.data)) {
          for (const c of res.data) inicial[String(c.membroId)] = { on: true, valor: Number(c.valor || 0) };
        }
        setSel(inicial);
      })
      .finally(() => setLoading(false));
  }, [lancamento]);

  const toggle = (id: string, on: boolean) => {
    setSel((prev) => {
      if (!on) return { ...prev, [id]: { on: false, valor: 0 } };
      // Ao MARCAR, auto-preenche com o saldo ainda não atribuído (o 1º membro
      // pega o valor cheio do lançamento). Sem isso o valor ficava em R$ 0 e o
      // salvar descartava o membro — a atribuição "sumia" silenciosamente.
      const usadoOutros = Object.entries(prev).reduce(
        (s, [k, v]) => (k !== id && v.on ? s + (v.valor || 0) : s), 0);
      const restante = Math.max(0, Number((valorLanc - usadoOutros).toFixed(2)));
      const atual = prev[id]?.valor || 0;
      return { ...prev, [id]: { on: true, valor: atual > 0 ? atual : restante } };
    });
  };
  const setValor = (id: string, valor: number) => {
    setSel((prev) => ({ ...prev, [id]: { on: prev[id]?.on ?? true, valor } }));
  };

  // Divide o valor do lançamento igualmente entre os membros marcados.
  const dividirIgual = () => {
    const ligados = ativos.filter((m) => sel[m.id]?.on);
    if (ligados.length === 0) { message.info('Marque ao menos um membro.'); return; }
    const fatia = Math.floor((valorLanc / ligados.length) * 100) / 100;
    // Joga a sobra de centavos no primeiro pra fechar a conta exata.
    const sobra = Number((valorLanc - fatia * ligados.length).toFixed(2));
    setSel((prev) => {
      const next = { ...prev };
      ligados.forEach((m, i) => {
        next[m.id] = { on: true, valor: i === 0 ? Number((fatia + sobra).toFixed(2)) : fatia };
      });
      return next;
    });
  };

  const selecionados = ativos.filter((m) => sel[m.id]?.on && (sel[m.id]?.valor || 0) > 0);
  const totalAtribuido = selecionados.reduce((s, m) => s + (sel[m.id]?.valor || 0), 0);
  const restante = Number((valorLanc - totalAtribuido).toFixed(2));

  const salvar = () => {
    if (!lancamento) return;
    // Trava: tem membro(s) marcado(s), mas todos com valor 0. Antes isso "removia"
    // a atribuição em silêncio (envia lista vazia). Agora avisa em vez de apagar.
    const marcados = ativos.filter((m) => sel[m.id]?.on);
    if (marcados.length > 0 && selecionados.length === 0) {
      message.warning('Defina um valor maior que zero para o(s) membro(s) — ou use "Dividir igualmente".');
      return;
    }
    const atribuicoes = selecionados.map((m) => ({ membroId: m.id, valor: Number((sel[m.id]?.valor || 0).toFixed(2)) }));
    const propagarParcelas = ehParcelado && propagar;
    setSaving(true);
    callServer<ServerResponse<{ criadas: number; parcelasAfetadas?: number; propagou?: boolean }>>(
      'atribuirLancamentoMembros', lancamento.id, JSON.stringify(atribuicoes), mes, propagarParcelas)
      .then((res) => {
        if (res?.ok) {
          const d = res.data as { criadas: number; parcelasAfetadas?: number; propagou?: boolean } | undefined;
          const n = d?.criadas ?? atribuicoes.length;
          if (d?.propagou && (d?.parcelasAfetadas || 0) > 1) {
            message.success(`Atribuído e propagado para ${d?.parcelasAfetadas} parcelas`);
          } else {
            message.success(n > 0 ? `Atribuído a ${selecionados.length} membro(s)` : 'Atribuição removida');
          }
          onSaved();
        } else message.error(res?.error || 'Erro ao atribuir');
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      title="Atribuir a membro(s) da família"
      open={!!lancamento}
      onCancel={onClose}
      okText="Salvar atribuição"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={salvar}
      width={460}
      destroyOnClose
    >
      {lancamento && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 600 }}>{lancamento.descricao}</div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
              Valor total: <strong>{formatBRL(valorLanc)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>Quem participa do rateio?</span>
            <Button size="small" onClick={dividirIgual}>Dividir igualmente</Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: t.textTertiary, padding: 12 }}>Carregando…</div>
          ) : ativos.length === 0 ? (
            <Empty description="Cadastre membros na aba Família primeiro." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ativos.map((m) => {
                const on = sel[m.id]?.on || false;
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Checkbox checked={on} onChange={(e) => toggle(m.id, e.target.checked)} style={{ flex: 1 }}>
                      <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {(() => { const I = membroIconeComponent(m.emoji); return I ? <I size={14} strokeWidth={1.8} style={{ color: m.cor }} /> : null; })()}
                        {m.nome}{m.relacao ? <span style={{ color: t.textTertiary }}> · {m.relacao}</span> : null}
                      </span>
                    </Checkbox>
                    <InputNumber
                      disabled={!on}
                      value={sel[m.id]?.valor || 0}
                      onChange={(v) => setValor(m.id, Number(v || 0))}
                      min={0}
                      step={1}
                      prefix="R$"
                      style={{ width: 130 }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {ativos.length > 0 && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: Math.abs(restante) <= 0.02 ? t.accents.sage : t.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
              <span>Atribuído: <strong>{formatBRL(totalAtribuido)}</strong></span>
              <span>{restante > 0 ? `Sobra ${formatBRL(restante)} (sua parte)` : restante < 0 ? `Excede em ${formatBRL(-restante)}` : 'Fecha certinho ✓'}</span>
            </div>
          )}
          {ehParcelado && (
            <div style={{
              background: propagar ? `${t.accents.lavender}14` : t.surfaceMuted,
              border: `1px solid ${propagar ? `${t.accents.lavender}55` : t.borderSoft}`,
              borderRadius: 10, padding: '10px 12px', transition: 'all 0.2s ease',
            }}>
              <Checkbox checked={propagar} onChange={(e) => setPropagar(e.target.checked)}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <LayersIcon size={13} strokeWidth={1.9} style={{ color: t.accents.lavender }} />
                  Aplicar nas próximas parcelas
                </span>
              </Checkbox>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 4, marginLeft: 24 }}>
                {propagar
                  ? `Esta e as demais parcelas (≈${parcelasRestantes} restantes ainda não pagas) ficam com o mesmo rateio, cada uma no mês da sua fatura.`
                  : 'Só esta parcela será atribuída.'}
              </div>
            </div>
          )}
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            Cria cobrança(s) pendente(s) na aba Família. Salvar sem ninguém marcado remove a atribuição.
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Modal: novo/editar lançamento ────────────────────────────────────────────

interface ModalLancamentoProps {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoPessoal | null;
  cartoes: CartaoPessoal[];
  categoriasUsadas: string[];
  onSaved: () => void;
}

function ModalLancamento({ open, onClose, lancamento, cartoes, categoriasUsadas, onSaved }: ModalLancamentoProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const categoriasCtx = useContext(CategoriasContext);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [status, setStatus] = useState<StatusLancamento>('pago');
  // Para preview do feedback "vai criar N parcelas" / "vai recorrer X"
  const [parcelas, setParcelas] = useState<number>(1);
  const [recorrencia, setRecorrencia] = useState<string>('unica');
  const [duracao, setDuracao] = useState<'sempre' | 'ate' | 'vezes'>('sempre');

  useEffect(() => {
    if (open) {
      if (lancamento) {
        form.setFieldsValue({
          ...lancamento,
          data: lancamento.data ? dayjs(lancamento.data) : dayjs(),
          vencimento: lancamento.vencimento ? dayjs(lancamento.vencimento) : null,
        });
        setMetodo(lancamento.metodo);
        setTipo(lancamento.tipo);
        setStatus(lancamento.status);
        setParcelas(lancamento.parcelas || 1);
        setRecorrencia(lancamento.recorrencia || 'unica');
        setDuracao(lancamento.recorrenciaFim ? 'ate' : 'sempre');
        form.setFieldsValue({
          duracao: lancamento.recorrenciaFim ? 'ate' : 'sempre',
          recFimData: lancamento.recorrenciaFim ? dayjs(lancamento.recorrenciaFim) : null,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          data: dayjs(),
          tipo: 'despesa',
          metodo: 'pix',
          status: 'pago',
          categoria: 'mercado',
          parcelas: 1,
          parcelaAtual: 1,
          recorrencia: 'unica',
          duracao: 'sempre',
        });
        setMetodo('pix');
        setTipo('despesa');
        setStatus('pago');
        setParcelas(1);
        setRecorrencia('unica');
        setDuracao('sempre');
      }
    }
  }, [open, lancamento, form]);

  // Opções pro autocomplete: categorias do catálogo + as que o user já usou
  // (algumas podem ser ad-hoc, não estar no catálogo ainda).
  const opcoesCategoria = useMemo(() => {
    const map: Record<string, { value: string; label: string }> = {};
    for (const c of categoriasCtx) {
      map[c.nome] = { value: c.nome, label: c.emoji ? `${c.emoji} ${c.label}` : c.label };
    }
    for (const nome of categoriasUsadas) {
      if (!map[nome]) map[nome] = { value: nome, label: nome };
    }
    return Object.values(map);
  }, [categoriasUsadas, categoriasCtx]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const dataISO = (v.data as Dayjs).format('YYYY-MM-DD');
      const rec = String(v['recorrencia'] || 'unica');
      let recorrenciaFim = '';
      if (rec !== 'unica') {
        if (v['duracao'] === 'ate' && v['recFimData']) recorrenciaFim = (v['recFimData'] as Dayjs).format('YYYY-MM-DD');
        else if (v['duracao'] === 'vezes' && v['recVezes']) recorrenciaFim = calcRecorrenciaFim(dataISO, rec, Number(v['recVezes']));
      }
      // Tira os campos auxiliares de UI (não-serializáveis / fora do schema).
      const { duracao: _d, recFimData: _f, recVezes: _n, ...limpo } = v;
      void _d; void _f; void _n;
      const payload = {
        ...limpo,
        id: lancamento?.id,
        data: dataISO,
        vencimento: v.vencimento ? (v.vencimento as Dayjs).format('YYYY-MM-DD') : '',
        recorrenciaFim,
      };
      const res = await callServer<ServerResponse<unknown>>('salvarLancamentoPessoal', payload);
      if (res.ok) {
        // Lançamento novo e recorrente: gera já os clones pendentes (mesma regra
        // do cadastro de receita), pra aparecer no mês e nos próximos.
        if (!lancamento && rec !== 'unica') {
          try { await callServer<ServerResponse<unknown>>('gerarRecorrenciasPendentes'); } catch { /* best-effort */ }
        }
        message.success(lancamento ? 'Lançamento atualizado' : 'Lançamento criado');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const isCartao = metodo === 'cartao';
  const isPendente = status === 'pendente' || status === 'agendado';

  return (
    <Modal
      title={lancamento ? 'Editar lançamento' : 'Novo lançamento'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={620}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Radio.Group onChange={(e) => setTipo(e.target.value)} optionType="button" buttonStyle="solid">
              <Radio.Button value="despesa">Despesa</Radio.Button>
              <Radio.Button value="entrada">Entrada</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="data" label="Data" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Descreva o lançamento' }]}>
          <Input placeholder="Ex: Pão na padaria do Tio Zé" autoFocus />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="valor" label="Valor" rules={[{ required: true, type: 'number', min: 0.01, message: 'Informe um valor' }]}>
            <InputNumber
              style={{ width: '100%' }}
              prefix="R$"
              min={0}
              step={0.01}
              decimalSeparator=","
              precision={2}
            />
          </Form.Item>
          <Form.Item name="categoria" label="Categoria" tooltip="Digite livre pra criar nova ou escolha uma já usada">
            <AutoComplete
              options={opcoesCategoria}
              filterOption={(input, opt) => {
                const v = String(opt?.value || '').toLowerCase();
                const l = String(opt?.label || '').toLowerCase();
                return v.includes(input.toLowerCase()) || l.includes(input.toLowerCase());
              }}
              placeholder="Ex: mercado, gasolina, jiu-jitsu…"
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="metodo" label="Método de pagamento">
            <Select onChange={(v) => setMetodo(v)} options={METODOS.map((m) => ({ value: m.value, label: m.label }))} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select
              onChange={(v) => setStatus(v)}
              options={[
                { value: 'pago', label: 'Pago' },
                { value: 'pendente', label: 'Pendente' },
                { value: 'agendado', label: 'Agendado' },
              ]}
            />
          </Form.Item>
        </div>

        {/* Cartão (só aparece se método = cartão) */}
        {isCartao && tipo === 'despesa' && (
          <Form.Item name="cartaoId" label="Cartão">
            <Select
              placeholder="Selecione o cartão"
              options={cartoes.map((c) => ({ value: c.id, label: `${c.apelido || c.nome} (${c.bandeira})` }))}
              allowClear
            />
          </Form.Item>
        )}

        {/* Vencimento (só pendente/agendado) */}
        {isPendente && (
          <Form.Item name="vencimento" label="Data de vencimento">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        )}

        {/* Parcelas (compras parceladas) — só pra cartão + despesa + lançamento novo */}
        {isCartao && tipo === 'despesa' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="parcelas" label="Total de parcelas" tooltip="Ex: 12 pra parcelar em 12x. Gera os lançamentos futuros automaticamente.">
              <InputNumber style={{ width: '100%' }} min={1} max={48} onChange={(v) => setParcelas(Number(v) || 1)} />
            </Form.Item>
            <Form.Item name="parcelaAtual" label="Parcela atual" tooltip="Em qual parcela você está? Ex: 3 se já pagou 1 e 2.">
              <InputNumber style={{ width: '100%' }} min={1} max={48} />
            </Form.Item>
          </div>
        )}

        {/* Recorrência — pra despesa OU entrada (ex.: salário recorrente). Só em
            lançamento novo; a origem se gerencia depois na aba Recorrências. */}
        {!lancamento && (
          <Form.Item name="recorrencia" label="Recorrência" tooltip={`Se mensal/semanal/anual, o sistema gera automaticamente ${tipo === 'entrada' ? 'a próxima entrada' : 'o próximo período'} quando chegar a data.`}>
            <Select onChange={(v) => setRecorrencia(v)}>
              <Select.Option value="unica">Única (não repete)</Select.Option>
              <Select.Option value="mensal">Mensal (toda data)</Select.Option>
              <Select.Option value="semanal">Semanal (todo dia da semana)</Select.Option>
              <Select.Option value="anual">Anual (todo ano)</Select.Option>
            </Select>
          </Form.Item>
        )}

        {/* Duração da recorrência */}
        {!lancamento && recorrencia !== 'unica' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="duracao" label="Repetir por quanto tempo" tooltip="Por padrão repete pra sempre. Você pode limitar por uma data final ou por um número de vezes.">
              <Select
                onChange={(v) => setDuracao(v)}
                options={[
                  { value: 'sempre', label: 'Sempre (até cancelar)' },
                  { value: 'ate', label: 'Até uma data' },
                  { value: 'vezes', label: 'Por um nº de vezes' },
                ]}
              />
            </Form.Item>
            {duracao === 'ate' && (
              <Form.Item name="recFimData" label="Repetir até" rules={[{ required: true, message: 'Escolha a data final' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            )}
            {duracao === 'vezes' && (
              <Form.Item name="recVezes" label="Quantas vezes" rules={[{ required: true, message: 'Informe o nº de vezes' }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={600} placeholder="Ex: 12" />
              </Form.Item>
            )}
          </div>
        )}

        {/* Feedback dinâmico do impacto */}
        {!lancamento && (parcelas > 1 || recorrencia !== 'unica') && (
          <Alert
            type="info"
            showIcon
            icon={parcelas > 1 ? <LayersIcon size={14} /> : <RotateCcw size={14} />}
            message={
              parcelas > 1
                ? `Vai criar ${parcelas} lançamentos (um por mês), agrupados.`
                : `${tipo === 'entrada' ? 'Essa entrada' : 'Esse gasto'} vai recorrer automaticamente (${recorrencia}). Você pode pausar ou concluir depois na aba Recorrências.`
            }
            style={{ marginBottom: 12 }}
          />
        )}

        <Form.Item name="notas" label="Notas (opcional)">
          <Input.TextArea rows={2} placeholder="Observações livres" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Modal: lançar fatura de cartão ───────────────────────────────────────────
// Atalho pra registrar a fatura de um cartão como uma despesa única, sem
// precisar lançar cada compra. Escolhe o cartão + mês, e a gente sugere o valor
// calculado (se houver compras lançadas) — mas você pode digitar qualquer valor
// (fatura inteira ou parcial). Reaproveita salvarLancamentoPessoal no backend.

function ModalFatura({ open, onClose, cartoes, onSaved }: {
  open: boolean;
  onClose: () => void;
  cartoes: CartaoPessoal[];
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [cartaoId, setCartaoId] = useState<string | undefined>();
  const [mesRef, setMesRef] = useState<Dayjs>(dayjs());
  const [faturaCalc, setFaturaCalc] = useState<number | null>(null);
  const [calculando, setCalculando] = useState(false);

  const cartaoSel = cartoes.find((c) => c.id === cartaoId);
  const mesLabel = (m: Dayjs) => m.toDate().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

  useEffect(() => {
    if (open) {
      const c0 = cartoes[0];
      form.resetFields();
      form.setFieldsValue({
        cartaoId: c0?.id,
        mesRef: dayjs(),
        status: 'pendente',
        vencimento: c0 ? dayjs().date(Math.min(c0.diaVencimento || 10, 28)) : dayjs(),
      });
      setCartaoId(c0?.id);
      setMesRef(dayjs());
      setFaturaCalc(null);
    }
  }, [open, cartoes, form]);

  // Sugere o valor da fatura calculada (soma das compras já lançadas na janela).
  useEffect(() => {
    if (!open || !cartaoId) { setFaturaCalc(null); return; }
    setCalculando(true);
    setFaturaCalc(null);
    callServer<ServerResponse<FaturaAberta>>('getFaturaAberta', cartaoId, mesRef.format('YYYY-MM'))
      .then((r) => { if (r.ok && r.data) setFaturaCalc((r.data as FaturaAberta).total); })
      .catch(() => { /* ok */ })
      .finally(() => setCalculando(false));
  }, [open, cartaoId, mesRef]);

  const onCartaoChange = (v: string) => {
    setCartaoId(v);
    const c = cartoes.find((x) => x.id === v);
    if (c) form.setFieldsValue({ vencimento: mesRef.date(Math.min(c.diaVencimento || 10, 28)) });
  };
  const onMesChange = (m: Dayjs | null) => {
    if (!m) return;
    setMesRef(m);
    if (cartaoSel) form.setFieldsValue({ vencimento: m.date(Math.min(cartaoSel.diaVencimento || 10, 28)) });
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const m = v['mesRef'] as Dayjs;
      const venc = v['vencimento'] as Dayjs | undefined;
      const nomeCartao = cartaoSel ? (cartaoSel.apelido || cartaoSel.nome) : 'cartão';
      const payload = {
        tipo: 'despesa',
        metodo: 'cartao',
        cartaoId,
        categoria: 'fatura',
        descricao: (v['descricao'] as string) || `Fatura ${nomeCartao} ${mesLabel(m)}`,
        valor: v['valor'],
        data: m.startOf('month').format('YYYY-MM-DD'),
        vencimento: venc ? venc.format('YYYY-MM-DD') : '',
        status: v['status'],
        recorrencia: 'unica',
      };
      const res = await callServer<ServerResponse<unknown>>('salvarLancamentoPessoal', payload);
      if (res.ok) { message.success('Fatura lançada'); onSaved(); }
      else message.error(res.error || 'Erro ao lançar');
    } catch {
      message.error('Erro ao lançar fatura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Lançar fatura de cartão"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Lançar fatura"
      cancelText="Cancelar"
      width={560}
      destroyOnClose
    >
      {cartoes.length === 0 ? (
        <Empty description="Cadastre um cartão primeiro na aba Cartões." />
      ) : (
        <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <Form.Item name="cartaoId" label="Cartão" rules={[{ required: true, message: 'Escolha o cartão' }]}>
              <Select
                onChange={onCartaoChange}
                options={cartoes.map((c) => ({ value: c.id, label: `${c.apelido || c.nome} (${c.bandeira})` }))}
              />
            </Form.Item>
            <Form.Item name="mesRef" label="Mês de referência" rules={[{ required: true }]}>
              <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} onChange={onMesChange} allowClear={false} />
            </Form.Item>
          </div>

          <Form.Item name="valor" label="Valor da fatura" rules={[{ required: true, type: 'number', min: 0.01, message: 'Informe o valor' }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={0.01} decimalSeparator="," precision={2} placeholder="Ex: 1422,30" />
          </Form.Item>

          {/* Sugestão do valor calculado a partir das compras lançadas */}
          {calculando ? (
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: -8, marginBottom: 12 }}>
              Calculando fatura desse mês…
            </div>
          ) : faturaCalc !== null && faturaCalc > 0 ? (
            <div style={{ marginTop: -8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
                Compras já lançadas nesse mês somam {formatBRL(faturaCalc)}.
              </span>
              <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={() => form.setFieldsValue({ valor: faturaCalc })}>
                usar esse valor
              </Button>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: 'pendente', label: 'A pagar (pendente)' },
                  { value: 'pago', label: 'Já paga' },
                  { value: 'agendado', label: 'Agendada' },
                ]}
              />
            </Form.Item>
            <Form.Item name="vencimento" label="Vencimento">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>

          <Form.Item name="descricao" label="Descrição (opcional)" tooltip="Se vazio, vira 'Fatura {cartão} {mês}'">
            <Input placeholder={cartaoSel ? `Fatura ${cartaoSel.apelido || cartaoSel.nome} ${mesLabel(mesRef)}` : 'Fatura do cartão'} />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="Você pode lançar a fatura inteira ou um valor parcial. Use isso quando preferir registrar só o total da fatura em vez de cada compra."
            style={{ fontSize: 12 }}
          />
        </Form>
      )}
    </Modal>
  );
}

// Calcula a data final (YYYY-MM-DD) de uma recorrência limitada a N ocorrências,
// a partir da data inicial e da periodicidade. n=1 → fim = própria data inicial.
function calcRecorrenciaFim(dataISO: string, rec: string, vezes: number): string {
  if (!dataISO || !vezes || vezes < 1) return '';
  const d = dayjs(dataISO);
  const passos = vezes - 1;
  const fim = rec === 'semanal' ? d.add(passos, 'week')
    : rec === 'anual' ? d.add(passos, 'year')
    : d.add(passos, 'month');
  return fim.format('YYYY-MM-DD');
}

// ─── Modal: cadastrar receita / salário recorrente ────────────────────────────
// Cria uma ENTRADA recorrente (tipo entrada + recorrencia). O motor de
// recorrências materializa todo mês até você cancelar. Alimenta saldo, Norte e
// a aba Receitas.

function ModalReceita({ open, preset, onClose, onSaved }: {
  open: boolean;
  preset: 'salario' | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [recorrencia, setRecorrencia] = useState<string>('mensal');
  const [duracao, setDuracao] = useState<'sempre' | 'ate' | 'vezes'>('sempre');

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        descricao: preset === 'salario' ? 'Salário' : '',
        categoria: preset === 'salario' ? 'salario' : 'renda',
        data: dayjs().date(5),
        metodo: 'transferencia',
        recorrencia: 'mensal',
        duracao: 'sempre',
      });
      setRecorrencia('mensal');
      setDuracao('sempre');
    }
  }, [open, preset, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const rec = String(v['recorrencia'] || 'mensal');
      const dataISO = (v['data'] as Dayjs).format('YYYY-MM-DD');
      let recorrenciaFim = '';
      if (rec !== 'unica') {
        if (v['duracao'] === 'ate' && v['recFimData']) recorrenciaFim = (v['recFimData'] as Dayjs).format('YYYY-MM-DD');
        else if (v['duracao'] === 'vezes' && v['recVezes']) recorrenciaFim = calcRecorrenciaFim(dataISO, rec, Number(v['recVezes']));
      }
      const payload = {
        tipo: 'entrada',
        descricao: String(v['descricao'] || '').trim(),
        valor: v['valor'],
        categoria: String(v['categoria'] || 'renda').trim() || 'renda',
        metodo: String(v['metodo'] || 'transferencia'),
        status: 'pago',
        data: dataISO,
        recorrencia: rec,
        recorrenciaFim,
      };
      const res = await callServer<ServerResponse<unknown>>('salvarLancamentoPessoal', payload);
      if (res.ok) {
        // Materializa os meses já vencidos desde a data de início.
        try { await callServer<ServerResponse<unknown>>('gerarRecorrenciasPendentes'); } catch { /* ok */ }
        message.success('Receita cadastrada — vai entrar todo período automaticamente');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar receita');
    } finally {
      setSaving(false);
    }
  };

  const labelPeriodo = recorrencia === 'semanal' ? 'semana'
    : recorrencia === 'anual' ? 'ano'
    : recorrencia === 'unica' ? '' : 'mês';

  return (
    <Modal
      title={preset === 'salario' ? 'Cadastrar salário' : 'Nova receita'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Cadastrar receita"
      cancelText="Cancelar"
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="descricao" label="Fonte da receita" rules={[{ required: true, message: 'Ex: Salário, Freela, Aluguel…' }]}>
          <Input placeholder="Ex: Salário, Freela, Aluguel, Dividendos…" autoFocus />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="valor" label="Valor" rules={[{ required: true, type: 'number', min: 0.01, message: 'Informe o valor' }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={0.01} decimalSeparator="," precision={2} placeholder="Ex: 5000,00" />
          </Form.Item>
          <Form.Item name="data" label="Primeiro recebimento" tooltip="A partir dessa data o sistema repete todo período." rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="recorrencia" label="Recorrência">
            <Select onChange={(v) => setRecorrencia(v)}>
              <Select.Option value="mensal">Mensal (todo mês)</Select.Option>
              <Select.Option value="semanal">Semanal</Select.Option>
              <Select.Option value="anual">Anual</Select.Option>
              <Select.Option value="unica">Única (não repete)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="metodo" label="Como recebe">
            <Select options={METODOS.map((m) => ({ value: m.value, label: m.label }))} />
          </Form.Item>
        </div>

        {recorrencia !== 'unica' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="duracao" label="Repetir por quanto tempo" tooltip="Por padrão repete pra sempre. Você pode limitar por uma data final ou por um número de vezes.">
              <Select
                onChange={(v) => setDuracao(v)}
                options={[
                  { value: 'sempre', label: 'Sempre (até eu cancelar)' },
                  { value: 'ate', label: 'Até uma data' },
                  { value: 'vezes', label: 'Por um nº de vezes' },
                ]}
              />
            </Form.Item>
            {duracao === 'ate' && (
              <Form.Item name="recFimData" label="Repetir até" rules={[{ required: true, message: 'Escolha a data final' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            )}
            {duracao === 'vezes' && (
              <Form.Item name="recVezes" label="Quantas vezes" rules={[{ required: true, message: 'Informe o nº de vezes' }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={600} placeholder="Ex: 12" />
              </Form.Item>
            )}
          </div>
        )}

        <Form.Item name="categoria" label="Categoria">
          <Input placeholder="Ex: salario, renda, investimentos…" />
        </Form.Item>

        {recorrencia !== 'unica' && (
          <Alert
            type="success"
            showIcon
            icon={<RotateCcw size={14} />}
            message={
              duracao === 'sempre'
                ? `Vai entrar automaticamente todo ${labelPeriodo} até você cancelar (na aba Receitas ou Recorrências).`
                : duracao === 'ate'
                ? `Vai entrar todo ${labelPeriodo} até a data escolhida — depois para sozinho.`
                : `Vai entrar por um número fixo de vezes — depois para sozinho.`
            }
            style={{ fontSize: 12 }}
          />
        )}
      </Form>
    </Modal>
  );
}

// ─── Sub-view: Receitas (entradas recorrentes) ────────────────────────────────
// Casa das suas receitas: salário e outras entradas que se repetem. Mostra o
// total recorrente por mês, a lista com pausar/cancelar e as entradas avulsas
// do mês corrente.

function mensalDaReceita(r: RecorrenciaAtiva): number {
  const v = Number(r.valor || 0);
  const rec = String(r.recorrencia || 'mensal');
  if (rec === 'semanal') return v * 4.33;
  if (rec === 'anual') return v / 12;
  return v;
}

function PainelReceitas({ receitas, lancamentos, onNova, onEditar, onRecarregar }: {
  receitas: RecorrenciaAtiva[];
  lancamentos: LancamentoPessoal[];
  onNova: (preset: 'salario' | null) => void;
  onEditar: (l: LancamentoPessoal) => void;
  onRecarregar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  // Só as ATIVAS entram no total recorrente/mês (pausadas e concluídas ficam de fora).
  const totalMensal = receitas
    .filter((r) => statusDaRecorrencia(r) === 'ativa')
    .reduce((s, r) => s + mensalDaReceita(r), 0);

  // Ids que são origem de alguma recorrência (têm clones apontando). Ex-origens
  // (salário "cancelado" no modelo antigo) viram 'unica' mas continuam sendo
  // recorrências no histórico — não devem aparecer como entrada avulsa.
  const origensComClones = new Set(
    lancamentos.map((l) => String(l.recorrenciaOrigemId || '')).filter(Boolean),
  );
  const avulsas = lancamentos.filter(
    (l) => l.tipo === 'entrada' && String(l.recorrencia || 'unica') === 'unica'
      && !l.recorrenciaOrigemId && !origensComClones.has(String(l.id)),
  );

  const alternar = (id: string, acao: 'pausar' | 'reativar' | 'concluir') => {
    callServer<ServerResponse<unknown>>('alternarRecorrencia', id, acao).then((res) => {
      if (res.ok) {
        message.success(
          acao === 'concluir' ? 'Receita concluída — segue no histórico'
            : acao === 'pausar' ? 'Receita pausada' : 'Receita reativada',
        );
        onRecarregar();
      } else message.error(res.error || 'Erro');
    });
  };

  const removerAvulsa = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarLancamentoPessoal', id).then((res) => {
      if (res.ok) { message.success('Entrada removida'); onRecarregar(); }
      else message.error(res.error || 'Erro ao remover');
    }).catch(() => message.error('Erro ao remover'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero: total recorrente/mês + CTAs */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.sage}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Receita recorrente por mês
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 36, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {formatBRL(totalMensal)}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginTop: 4 }}>
            {receitas.length} fonte(s) recorrente(s) cadastrada(s)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<Banknote size={16} />} onClick={() => onNova('salario')} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
            Cadastrar salário
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => onNova(null)}>
            Nova receita
          </Button>
        </div>
      </div>

      {/* Lista de receitas recorrentes */}
      <Panel title={`Receitas recorrentes${receitas.length > 0 ? ` (${receitas.length})` : ''}`}>
        {receitas.length === 0 ? (
          <Empty description="Nenhuma receita recorrente. Cadastre seu salário pra ele entrar todo mês.">
            <Button type="primary" icon={<Banknote size={14} />} onClick={() => onNova('salario')} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
              Cadastrar salário
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...receitas]
              .sort((a, b) => {
                const ord: Record<string, number> = { ativa: 0, pausada: 1, concluida: 2 };
                return (ord[statusDaRecorrencia(a)] ?? 0) - (ord[statusDaRecorrencia(b)] ?? 0);
              })
              .map((r) => {
              const status = statusDaRecorrencia(r);
              const ativa = status === 'ativa';
              const concluida = status === 'concluida';
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12,
                  opacity: ativa ? 1 : 0.65,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `${t.accents.sage}22`, color: t.accents.sage,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {concluida ? <CheckCircle2 size={20} /> : <TrendingUp size={20} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.descricao}
                      {status === 'pausada' && <Tag color="default" style={{ marginInlineEnd: 0 }}>pausada</Tag>}
                      {concluida && <Tag color="green" style={{ marginInlineEnd: 0 }}>concluída</Tag>}
                    </div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
                      {r.recorrencia} · {r.categoria || 'renda'} · desde {r.data ? dayjs(r.data).format('DD/MM/YYYY') : '—'}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatBRL(Number(r.valor || 0))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Editar">
                      <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => onEditar(r)} />
                    </Tooltip>
                    {concluida ? (
                      <Tooltip title="Reabrir (volta a entrar e projetar nos próximos meses)">
                        <Button size="small" type="primary" icon={<PlayCircle size={14} />} onClick={() => alternar(r.id, 'reativar')}>Reabrir</Button>
                      </Tooltip>
                    ) : ativa ? (
                      <Tooltip title="Pausar temporariamente">
                        <Button size="small" type="text" icon={<PauseCircle size={14} />} onClick={() => alternar(r.id, 'pausar')} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Retomar">
                        <Button size="small" type="text" icon={<PlayCircle size={14} />} onClick={() => alternar(r.id, 'reativar')} />
                      </Tooltip>
                    )}
                    {!concluida && (
                      <Popconfirm title="Concluir essa receita?" description="Para de entrar nos próximos meses, mas continua aqui no histórico (e pode ser reaberta)." onConfirm={() => alternar(r.id, 'concluir')} okText="Concluir" cancelText="Voltar">
                        <Tooltip title="Concluir (encerra, mantém histórico)">
                          <Button size="small" type="text" icon={<CheckCircle2 size={14} />} />
                        </Tooltip>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Entradas avulsas do mês */}
      {avulsas.length > 0 && (
        <Panel title={`Entradas avulsas do mês (${avulsas.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {avulsas.map((l) => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {l.descricao}
                    {String(l.tags || '').indexOf('reembolso-membro') >= 0 && (
                      <Tag bordered={false} style={{ margin: 0, fontSize: 10, background: `${t.accents.peach}1f`, color: t.accents.peach }}>reembolso</Tag>
                    )}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
                    {l.data ? dayjs(l.data).format('DD/MM') : '—'} · {l.categoria}
                  </div>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.accents.sage, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatBRL(Number(l.valor || 0))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Tooltip title="Editar">
                    <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(l)} />
                  </Tooltip>
                  <Popconfirm
                    title="Remover esta entrada?"
                    description={String(l.tags || '').indexOf('reembolso-membro') >= 0 ? 'Como é um reembolso, o saldo a receber do membro será estornado.' : undefined}
                    onConfirm={() => removerAvulsa(l.id)}
                    okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="Remover">
                      <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── Modal: importar fatura (PDF) via IA ──────────────────────────────────────
// Upload do PDF → extrai texto no navegador (pdf.js) → IA estrutura as compras →
// você revisa numa tabela e importa cada compra como um lançamento individual.
// Fallback: colar o texto manualmente (PDFs escaneados/sem camada de texto).

interface ItemRevisao extends FaturaItemIA { incluir: boolean; }

function ModalImportarFatura({ open, onClose, cartoes, cartaoInicial, onSaved, onConcluir }: {
  open: boolean;
  onClose: () => void;
  cartoes: CartaoPessoal[];
  cartaoInicial?: string;
  onSaved: () => void;
  onConcluir?: (status: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<'upload' | 'revisao' | 'importando' | 'concluido'>('upload');
  const [resultado, setResultado] = useState<{ criados: number; total: number; cartaoNome: string; parcelasFuturas: number; gruposNovos: number; duplicados: number; conciliados?: number; cobrancasReorganizadas?: number } | null>(null);
  const [cartaoId, setCartaoId] = useState<string | undefined>();
  const [statusImport, setStatusImport] = useState('pendente');
  // Mês em que ESTA fatura vence (= mês em que você paga). Todos os itens da
  // fatura recebem esse vencimento, então caem juntos nesse mês no painel/visão.
  const [faturaMes, setFaturaMes] = useState<Dayjs>(() => dayjs());
  const [processando, setProcessando] = useState(false);
  // Cronômetro visual durante a leitura/interpretação (Gemini pode levar ~1min).
  const [segundos, setSegundos] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  // Último erro da importação — fica FIXO num alerta (antes era só um toast que
  // sumia, então o usuário via a tela de upload de novo sem entender o porquê).
  const [erroImport, setErroImport] = useState('');
  // Guarda anti-importação dupla: o servidor detectou que ESTE mês já tem uma
  // importação deste cartão. Fica num alerta com ação explícita — importar em
  // duplicidade só acontece se o usuário confirmar de propósito.
  const [avisoDupla, setAvisoDupla] = useState<{ competencia: string; qtd: number; total: number } | null>(null);
  // Sequência da checagem antecipada — descarta resposta atrasada quando o
  // usuário troca cartão/mês antes de a anterior voltar.
  const checagemSeq = useRef(0);
  const [modoTexto, setModoTexto] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [itens, setItens] = useState<ItemRevisao[]>([]);
  const [importando, setImportando] = useState(false);
  const [geminiOn, setGeminiOn] = useState(false);
  // Só liberamos qualquer aviso sobre o Gemini DEPOIS de confirmar o estado no
  // servidor — senão o alerta "Gemini não conectado" pisca por uma fração de
  // segundo antes da checagem voltar (o que o usuário via como um flash chato).
  const [geminiChecado, setGeminiChecado] = useState(false);
  const [fonteUsada, setFonteUsada] = useState('');
  // Total da fatura informado pelo PDF (cabeçalho/rodapé). Usado pra conciliar
  // com a soma dos itens — alerta quando algo escapou (juros, multa, IOF).
  const [totalFatura, setTotalFatura] = useState(0);
  const [periodoFatura, setPeriodoFatura] = useState('');
  // Conciliação automática feita no servidor (camada "viva"): quantas rodadas de
  // auto-correção a IA fez e se a soma bateu com o total da fatura.
  const [conciliacao, setConciliacao] = useState<ConciliacaoFatura | null>(null);

  useEffect(() => {
    if (open) {
      setEtapa('upload');
      setCartaoId(cartaoInicial || cartoes[0]?.id);
      setStatusImport('pendente');
      setFaturaMes(dayjs());
      setProcessando(false);
      setStatusMsg('');
      setErroImport('');
      setModoTexto(false);
      setTextoColado('');
      setNomeArquivo('');
      setItens([]);
      setImportando(false);
      setResultado(null);
      setFonteUsada('');
      setTotalFatura(0);
      setPeriodoFatura('');
      setConciliacao(null);
      setAvisoDupla(null);
      setGeminiChecado(false);
      callServer<boolean>('geminiTemChave')
        .then((v) => setGeminiOn(!!v))
        .catch(() => setGeminiOn(false))
        .finally(() => setGeminiChecado(true));
    }
  }, [open, cartoes, cartaoInicial]);

  // Conta os segundos enquanto está processando; zera ao parar.
  useEffect(() => {
    if (!processando) { setSegundos(0); return; }
    setSegundos(0);
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [processando]);

  // Checagem ANTECIPADA da trava anti-importação dupla: dispara assim que
  // cartão + mês estão escolhidos — ANTES de gastar a leitura da IA (~1min).
  // Best-effort (a trava de verdade fica na gravação, no servidor); resposta
  // atrasada de uma troca anterior de cartão/mês é descartada pela sequência.
  useEffect(() => {
    if (!open || !cartaoId) return;
    const seq = ++checagemSeq.current;
    callServer<ServerResponse<{ jaImportada?: boolean; competencia?: string; qtd?: number; total?: number }>>(
      'verificarImportacaoFatura', cartaoId, faturaMes.format('YYYY-MM'),
    ).then((res) => {
      if (seq !== checagemSeq.current) return;
      const d = res?.ok ? (res.data as { jaImportada?: boolean; competencia?: string; qtd?: number; total?: number } | undefined) : undefined;
      setAvisoDupla(d?.jaImportada
        ? { competencia: d.competencia || '', qtd: d.qtd || 0, total: d.total || 0 }
        : null);
    }).catch(() => { /* aviso cedo é best-effort */ });
  }, [open, cartaoId, faturaMes]);

  const aplicarResultado = (d: FaturaInterpretada) => {
    setItens(d.itens.map((it) => ({ ...it, incluir: true })));
    setFonteUsada(d.fonte || 'proxy');
    setTotalFatura(Number(d.total || 0));
    setPeriodoFatura(String(d.periodo || ''));
    setConciliacao(d.conciliacao || null);
    setEtapa('revisao');
  };

  const interpretar = async (texto: string) => {
    if (texto.trim().length < 20) { setErroImport('Texto muito curto pra interpretar — cole as linhas da fatura.'); return; }
    setProcessando(true);
    setErroImport('');
    setStatusMsg('Interpretando a fatura com a IA… isso leva alguns segundos.');
    try {
      const res = await callServer<ServerResponse<FaturaInterpretada>>('interpretarFaturaIA', texto);
      if (res?.ok && res.data) aplicarResultado(res.data as FaturaInterpretada);
      else setErroImport(res?.error || 'Não consegui interpretar a fatura. Tente de novo ou cole o texto manualmente.');
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : 'Erro ao interpretar a fatura.');
    } finally {
      setProcessando(false);
      setStatusMsg('');
    }
  };

  const processarArquivo = async (file: File) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      message.error('Envie um arquivo PDF.');
      return;
    }
    setNomeArquivo(file.name);
    setProcessando(true);
    setErroImport('');
    try {
      // Caminho primário: Gemini lê o PDF direto (multimodal) — mais preciso e
      // classifica nos centros de custo do plano de contas.
      if (geminiOn) {
        setStatusMsg('Lendo a fatura com o Gemini… pode levar até 1 minuto.');
        const base64 = await arquivoParaBase64(file);
        const res = await callServer<ServerResponse<FaturaInterpretada>>('interpretarFaturaGemini', base64, 'application/pdf');
        if (res?.ok && res.data) { aplicarResultado(res.data as FaturaInterpretada); return; }
        // Falhou no Gemini → tenta o caminho de texto como fallback.
        message.warning((res?.error || 'Gemini falhou.') + ' Tentando leitura por texto…');
      }
      // Fallback: extrai texto no navegador (pdf.js) e manda pro proxy.
      setStatusMsg('Lendo o texto do PDF…');
      const texto = await extrairTextoPdf(file);
      if (texto.trim().length < 20) {
        setErroImport('Esse PDF parece escaneado (sem texto selecionável). Use o modo "colar texto" abaixo.');
        setModoTexto(true);
        return;
      }
      await interpretar(texto);
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : 'Falha ao processar a fatura. Tente de novo ou cole o texto manualmente.');
    } finally {
      setProcessando(false);
      setStatusMsg('');
    }
  };

  // Lote de PRINTS/fotos da mesma fatura (quando o PDF não está disponível).
  // Exige Gemini (multimodal): as imagens vão juntas numa única chamada e o
  // prompt trata como UM documento contínuo, deduplicando linhas na emenda.
  const processarImagens = async (files: File[]) => {
    if (!geminiOn) {
      setErroImport('Ler prints/fotos exige o Gemini conectado — abra Configurações → Google Gemini e cole sua chave. (PDF funciona sem Gemini pelo modo texto; imagem não.)');
      return;
    }
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    if (totalBytes > 14 * 1024 * 1024) {
      setErroImport('Os prints somam mais de 14MB. Envie menos imagens por vez ou reduza a resolução — dá pra importar em duas levas (a trava de duplicidade concilia).');
      return;
    }
    setNomeArquivo(files.length === 1 ? files[0].name : `${files.length} prints da fatura`);
    setProcessando(true);
    setErroImport('');
    try {
      setStatusMsg(`Lendo ${files.length} print(s) com o Gemini… pode levar até 1 minuto.`);
      const lote: Array<{ data: string; mime: string }> = [];
      for (const f of files) lote.push({ data: await arquivoParaBase64(f), mime: f.type || 'image/png' });
      const res = await callServer<ServerResponse<FaturaInterpretada>>('interpretarFaturaGemini', JSON.stringify(lote), 'lote-imagens');
      if (res?.ok && res.data) { aplicarResultado(res.data as FaturaInterpretada); return; }
      setErroImport(res?.error || 'Não consegui ler os prints. Tente imagens mais nítidas (texto legível) ou o modo colar texto.');
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : 'Falha ao processar os prints. Tente de novo.');
    } finally {
      setProcessando(false);
      setStatusMsg('');
    }
  };

  const ehImagem = (f: File) => /^image\//i.test(f.type) || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name);
  const processarSelecao = (files: File[]) => {
    if (files.length === 0) return;
    const imgs = files.filter(ehImagem);
    if (imgs.length === files.length) { void processarImagens(files); return; }
    if (files.length === 1) { void processarArquivo(files[0]); return; }
    message.error('Envie OU um PDF OU um conjunto de prints (imagens) — sem misturar os dois.');
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    processarSelecao(Array.from(e.target.files || []));
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    processarSelecao(Array.from(e.dataTransfer.files || []));
  };

  const setItem = (idx: number, patch: Partial<ItemRevisao>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const incluidos = itens.filter((it) => it.incluir);
  const totalIncluidos = incluidos.reduce((s, it) => s + Number(it.valor || 0), 0);
  // Espelha _detectarParcelaDesc do servidor: "x/y", "parcela x/y" e "x de y".
  // Usado pra mostrar, ANTES de importar, quais compras vão provisionar futuras.
  const parcelaInfo = (desc: string): { atual: number; total: number } | null => {
    const s = String(desc || '');
    const m = s.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/)
      || s.match(/\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i)
      || s.match(/\b(\d{1,2})\s+de\s+(\d{1,2})\b/i);
    if (!m) return null;
    const atual = Number(m[1]); const total = Number(m[2]);
    return total > 1 && atual >= 1 && atual <= total ? { atual, total } : null;
  };
  const provisao = incluidos.reduce((acc, it) => {
    const p = parcelaInfo(it.descricao);
    if (p && p.total > p.atual) { acc.grupos += 1; acc.futuras += (p.total - p.atual); }
    return acc;
  }, { grupos: 0, futuras: 0 });
  // Conciliação: comparar com o total que o PDF informa. Tolerância de R$ 0,02
  // pra arredondamento de centavos. Diferença positiva = faltou item (juros,
  // multa, IOF, anuidade). Diferença negativa = duplicidade / valor maior.
  const diferencaFatura = totalFatura > 0 ? totalFatura - totalIncluidos : 0;
  const concilia = totalFatura > 0 && Math.abs(diferencaFatura) <= 0.02;

  const adicionarLinha = (preset?: Partial<ItemRevisao>) => {
    const hoje = new Date().toISOString().substring(0, 10);
    const novo: ItemRevisao = {
      data: hoje, descricao: '', valor: 0, categoria: 'outros',
      conta: '', grupo: '', incluir: true, ...preset,
    };
    setItens((prev) => [...prev, novo]);
  };

  const lancarDiferencaComoEncargo = () => {
    if (diferencaFatura <= 0) return;
    adicionarLinha({
      descricao: 'Encargos (juros, multa, IOF, anuidade)',
      valor: Number(diferencaFatura.toFixed(2)),
      categoria: 'encargos',
    });
  };

  // Caso simétrico: a soma EXCEDEU o total. Costuma ser um crédito de saldo
  // anterior (você pagou a fatura passada a mais) que a IA não lançou. Adiciona
  // uma linha NEGATIVA pra reconciliar com o total exato da fatura.
  const lancarDiferencaComoAjuste = () => {
    if (diferencaFatura >= 0) return;
    adicionarLinha({
      descricao: 'Crédito de saldo anterior',
      valor: Number(diferencaFatura.toFixed(2)),
      categoria: 'outros',
    });
  };

  const removerLinha = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };

  const importar = async (forcar = false) => {
    if (!cartaoId) { message.error('Escolha o cartão.'); return; }
    if (incluidos.length === 0) { message.error('Marque ao menos um lançamento.'); return; }
    const cartaoNome = cartoes.find((c) => c.id === cartaoId)?.apelido
      || cartoes.find((c) => c.id === cartaoId)?.nome || 'cartão';
    const totalEnviado = totalIncluidos;
    setImportando(true);
    setErroImport('');
    setAvisoDupla(null);
    setEtapa('importando');
    try {
      const payload = incluidos.map((it) => ({ data: it.data, descricao: it.descricao, valor: it.valor, categoria: it.categoria }));
      const res = await callServer<ServerResponse<{ criados: number; parcelasFuturas?: number; gruposNovos?: number; duplicados?: number; conciliados?: number; cobrancasReorganizadas?: number }>>('importarFaturaLancamentos', cartaoId, JSON.stringify(payload), statusImport, faturaMes.format('YYYY-MM'), forcar, totalFatura);
      // `res?.ok` com optional chaining: o google.script.run pode devolver null
      // (resposta truncada/erro silencioso) — sem isso a tela ficava "importando"
      // pra sempre. Agora cai no else e volta pra revisão sem perder os dados.
      if (res?.ok) {
        const d = (res.data as { criados: number; parcelasFuturas?: number; gruposNovos?: number; duplicados?: number; conciliados?: number; cobrancasReorganizadas?: number } | undefined);
        const n = d?.criados ?? incluidos.length;
        setResultado({
          criados: n, total: totalEnviado, cartaoNome,
          parcelasFuturas: d?.parcelasFuturas ?? 0,
          gruposNovos: d?.gruposNovos ?? 0,
          duplicados: d?.duplicados ?? 0,
          conciliados: d?.conciliados ?? 0,
          cobrancasReorganizadas: d?.cobrancasReorganizadas ?? 0,
        });
        setEtapa('concluido');
      } else {
        // Bloqueio consciente do servidor: este mês JÁ foi importado neste
        // cartão. Não é erro — é a trava anti-duplicação. Mostra aviso com
        // ação explícita em vez do alerta vermelho genérico.
        const dupla = (res?.data as { jaImportada?: boolean; competencia?: string; qtd?: number; total?: number } | undefined);
        if (dupla?.jaImportada) {
          setAvisoDupla({ competencia: dupla.competencia || '', qtd: dupla.qtd || 0, total: dupla.total || 0 });
        } else {
          setErroImport(res?.error || 'Erro ao gravar os lançamentos. Seus dados foram mantidos — tente de novo.');
        }
        setEtapa('revisao');
      }
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : 'Erro ao gravar os lançamentos. Seus dados foram mantidos — tente de novo.');
      setEtapa('revisao');
    } finally {
      setImportando(false);
    }
  };

  // Fecha a tela de importação, navega pra seção certa (A pagar se pendente,
  // senão Lançamentos) e recarrega. Cai no onSaved se o pai não passar onConcluir.
  const concluir = () => { if (onConcluir) onConcluir(statusImport); else onSaved(); };

  const mostrarSeletores = etapa === 'upload' || etapa === 'revisao';

  return (
    <Modal
      title="Importar fatura com IA"
      open={open}
      onCancel={onClose}
      maskClosable={etapa !== 'importando'}
      closable={etapa !== 'importando'}
      keyboard={etapa !== 'importando'}
      footer={
        etapa === 'revisao' ? [
          <Button key="voltar" onClick={() => setEtapa('upload')}>Voltar</Button>,
          <Button key="importar" type="primary" loading={importando} onClick={() => importar()} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
            Importar {incluidos.length} lançamento(s)
          </Button>,
        ] : etapa === 'concluido' ? [
          <Button key="ver" type="primary" onClick={concluir} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
            {statusImport === 'pendente' ? 'Ver em A pagar' : 'Ver em Lançamentos'}
          </Button>,
        ] : null
      }
      width={etapa === 'revisao' ? 760 : 560}
      destroyOnClose
    >
      {cartoes.length === 0 ? (
        <Empty description="Cadastre um cartão primeiro na aba Cartões." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cartão de destino + mês da fatura + status (etapas upload/revisão) */}
          {mostrarSeletores && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 6 }}>Cartão de destino</div>
              <Select
                style={{ width: '100%' }}
                value={cartaoId}
                onChange={setCartaoId}
                options={cartoes.map((c) => ({ value: c.id, label: `${c.apelido || c.nome} (${c.bandeira})` }))}
              />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 6 }}>Mês da fatura (vence)</div>
              <DatePicker
                picker="month"
                style={{ width: '100%' }}
                value={faturaMes}
                onChange={(d) => d && setFaturaMes(d)}
                format="MMM/YYYY"
                allowClear={false}
              />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 6 }}>Status</div>
              <Select
                style={{ width: '100%' }}
                value={statusImport}
                onChange={setStatusImport}
                options={[
                  { value: 'pago', label: 'Pago' },
                  { value: 'pendente', label: 'Pendente' },
                ]}
              />
            </div>
          </div>
          )}
          {mostrarSeletores && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: -8 }}>
              Toda a fatura entra no mês de vencimento escolhido — é o mês em que você paga, não o da compra.
            </div>
          )}

          {/* Trava anti-importação dupla: o mês já tem importação deste cartão.
              Bloqueia por padrão; duplicar exige clique explícito. */}
          {avisoDupla && etapa !== 'importando' && (
            <Alert
              type="warning"
              showIcon
              closable
              onClose={() => setAvisoDupla(null)}
              style={{ background: `${t.accents.peach}1f`, border: `1px solid ${t.accents.peach}66` }}
              message={<span style={{ color: t.text, fontWeight: 600 }}>Este mês já tem fatura importada neste cartão</span>}
              description={
                <div style={{ color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>
                    O cartão já tem <b>{avisoDupla.qtd} lançamento(s)</b> importados em <b>{avisoDupla.competencia}</b>,
                    somando <b>{formatBRL(avisoDupla.total)}</b>. Importar de novo vai <b>duplicar</b> a fatura.
                  </span>
                  <span>
                    Se a intenção é reimportar (corrigir), primeiro use <b>“Remover importados do mês”</b> na
                    gaveta do cartão e importe de novo.
                    {etapa === 'upload' && ' Ou confira se o mês escolhido acima é o certo — talvez esta fatura seja de outro mês.'}
                  </span>
                  {etapa === 'revisao' && (
                    <div>
                      <Button size="small" danger onClick={() => importar(true)} loading={importando}>
                        Importar mesmo assim (duplicar)
                      </Button>
                    </div>
                  )}
                </div>
              }
            />
          )}

          {/* Erro fixo — fica visível até a próxima ação (não some como o toast) */}
          {erroImport && etapa !== 'importando' && (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => setErroImport('')}
              style={{ background: `${t.accents.rose}1f`, border: `1px solid ${t.accents.rose}66` }}
              message={<span style={{ color: t.text, fontWeight: 600 }}>Não foi possível concluir</span>}
              description={<span style={{ color: t.textSecondary }}>{erroImport}</span>}
            />
          )}

          {/* Etapa: importando — feedback claro de progresso */}
          {etapa === 'importando' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 20px', textAlign: 'center' }}>
              <Sparkles size={32} color={t.accents.peach} className="forja-spin" />
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text }}>
                Importando {incluidos.length} lançamento(s)…
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary, maxWidth: 360 }}>
                Gravando na sua planilha. Não feche esta janela — leva alguns segundos.
              </div>
            </div>
          )}

          {/* Etapa: concluído — confirmação + total lançado */}
          {etapa === 'concluido' && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: `${t.accents.sage}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={32} color={t.accents.sage} />
              </div>
              <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 500, color: t.text }}>
                Importação concluída
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, maxWidth: 380 }}>
                {resultado.criados} lançamento(s) · <strong>{formatBRL(resultado.total)}</strong> em{' '}
                <strong>{resultado.cartaoNome}</strong> ({statusImport === 'pago' ? 'pagos' : 'pendentes'}).
              </div>
              {resultado.parcelasFuturas > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
                  background: `${t.accents.clay}1f`, border: `1px solid ${t.accents.clay}66`,
                  fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, maxWidth: 400,
                }}>
                  <LayersIcon size={15} color={t.accents.clay} />
                  <span>
                    <strong>{resultado.parcelasFuturas} parcela(s) futura(s)</strong> provisionada(s)
                    {resultado.gruposNovos > 0 ? ` de ${resultado.gruposNovos} compra(s) parcelada(s)` : ''}. Veja em "Próximas faturas" do cartão.
                  </span>
                </div>
              )}
              {(resultado.conciliados ?? 0) > 0 && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, maxWidth: 380 }}>
                  {resultado.conciliados} parcela(s) já provisionada(s) foram conciliadas com esta fatura (sem duplicar).
                </div>
              )}
              {resultado.duplicados > 0 && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, maxWidth: 380 }}>
                  {resultado.duplicados} item(ns) já existiam e foram ignorados (sem duplicar).
                </div>
              )}
              {(resultado.cobrancasReorganizadas ?? 0) > 0 && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, maxWidth: 380 }}>
                  Família atualizada: {resultado.cobrancasReorganizadas} cobrança(s) reorganizada(s) automaticamente.
                </div>
              )}
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, maxWidth: 380 }}>
                {statusImport === 'pendente'
                  ? 'Já aparecem no widget "A pagar" e na fatura do cartão.'
                  : 'Já entraram nos lançamentos e na fatura do cartão.'}
              </div>
            </div>
          )}

          {etapa === 'upload' && (
            <>
              {geminiChecado && !geminiOn && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<Sparkles size={16} />}
                  style={{
                    background: `${t.accents.peach}1f`, border: `1px solid ${t.accents.peach}66`,
                    color: t.text, marginBottom: 4,
                  }}
                  message={<span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Gemini não conectado — usando o proxy</span>}
                  description={
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
                      A leitura vai usar o proxy, que é menos estável e pode ficar sobrecarregado (erro 529).
                      Pra ler o PDF direto com o Gemini (grátis e mais preciso), abra <b>Configurações → Google Gemini</b>,
                      cole sua chave e clique em <b>Salvar Gemini</b>. Depois reabra esta janela.
                    </span>
                  }
                />
              )}
              {!modoTexto ? (
                <div
                  onClick={() => !processando && inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  style={{
                    border: `1.5px dashed ${t.border}`, borderRadius: 14,
                    padding: '36px 20px', textAlign: 'center', cursor: processando ? 'default' : 'pointer',
                    background: t.surfaceMuted, transition: 'border-color 0.15s',
                  }}
                >
                  <input ref={inputRef} type="file" accept="application/pdf,.pdf,image/*" multiple style={{ display: 'none' }} onChange={onFile} />
                  {processando ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                      <Sparkles size={30} color={t.accents.peach} className="forja-spin" />
                      <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text }}>{statusMsg || 'Processando…'}</div>
                      {nomeArquivo && <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>{nomeArquivo}</div>}
                      <div style={{
                        fontFamily: FONTS.mono, fontSize: 22, fontWeight: 600, color: t.accents.peach,
                        fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
                      }}>
                        {String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}
                      </div>
                      <Progress percent={100} status="active" showInfo={false} strokeColor={t.accents.peach} style={{ maxWidth: 240 }} />
                      <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>Não feche a janela — a IA está lendo a fatura.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Upload size={30} color={t.textTertiary} />
                      <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text }}>
                        Arraste o PDF da fatura — ou vários prints dela — ou clique pra escolher
                      </div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, maxWidth: 420 }}>
                        {!geminiChecado
                          ? 'A IA lê as compras e monta a lista pra você revisar.'
                          : geminiOn
                            ? 'O Gemini lê o PDF direto, extrai as compras e já classifica nos seus centros de custo. Sem PDF? Selecione VÁRIOS prints/fotos da fatura de uma vez — a IA junta tudo como um documento só (traga a parcela x/y visível nos prints).'
                            : 'A IA lê as compras e monta a lista pra você revisar. Dica: conecte o Gemini em Configurações pra leitura mais precisa (e pra poder importar por prints/fotos).'}
                      </div>
                      {geminiChecado && (
                        <Tag bordered={false} style={{ marginTop: 2, background: geminiOn ? `${t.accents.sage}22` : `${t.accents.peach}22`, color: geminiOn ? t.accents.sage : t.accents.peach }}>
                          {geminiOn ? '✦ Gemini (leitura direta)' : 'Modo texto (proxy)'}
                        </Tag>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 6 }}>
                    Cole o texto da fatura (copiado do app/extrato do banco)
                  </div>
                  <Input.TextArea
                    rows={8}
                    value={textoColado}
                    onChange={(e) => setTextoColado(e.target.value)}
                    placeholder="Cole aqui as linhas da fatura: data, descrição e valor de cada compra…"
                  />
                  <Button
                    type="primary"
                    icon={<Sparkles size={15} />}
                    loading={processando}
                    onClick={() => void interpretar(textoColado)}
                    style={{ marginTop: 12, background: t.accents.peach, borderColor: t.accents.peach }}
                  >
                    Interpretar com IA
                  </Button>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <Button type="link" size="small" icon={<FileUp size={13} />} onClick={() => { setModoTexto(!modoTexto); setNomeArquivo(''); }}>
                  {modoTexto ? 'Voltar pro upload de PDF' : 'Ou cole o texto manualmente'}
                </Button>
              </div>
            </>
          )}

          {etapa === 'revisao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {incluidos.length} de {itens.length} selecionado(s)
                  {periodoFatura && (
                    <Tag bordered={false} style={{ background: t.surfaceMuted, color: t.textSecondary }}>{periodoFatura}</Tag>
                  )}
                  {fonteUsada && (
                    <Tag bordered={false} style={{ background: fonteUsada === 'gemini' ? `${t.accents.sage}22` : `${t.accents.peach}22`, color: fonteUsada === 'gemini' ? t.accents.sage : t.accents.peach }}>
                      {fonteUsada === 'gemini' ? '✦ lido pelo Gemini' : 'lido por texto'}
                    </Tag>
                  )}
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBRL(totalIncluidos)}
                </div>
              </div>

              {/* Painel de conciliação — só aparece se o PDF declarou um total.
                  Cores explícitas (theme-aware): o tema não usa darkAlgorithm, então
                  o bg padrão do Alert fica claro/"branco" no noturno. */}
              {totalFatura > 0 && (() => {
                const cor = concilia ? t.accents.sage : diferencaFatura > 0 ? t.accents.clay : t.accents.rose;
                const estilo = { background: `${cor}1f`, border: `1px solid ${cor}66`, color: t.text };
                return concilia ? (
                  <Alert
                    type="success"
                    showIcon
                    style={estilo}
                    message={<span style={{ color: t.text }}>Bate com o total da fatura ({formatBRL(totalFatura)}).</span>}
                    description={conciliacao && conciliacao.tentativas > 0
                      ? <span style={{ color: t.textSecondary }}>A IA conferiu a soma, notou a divergência e se corrigiu sozinha em {conciliacao.tentativas} rodada(s) até fechar com o total.</span>
                      : undefined}
                  />
                ) : (
                  <Alert
                    type={diferencaFatura > 0 ? 'warning' : 'error'}
                    showIcon
                    style={estilo}
                    message={<span style={{ color: t.text, fontWeight: 600 }}>{diferencaFatura > 0
                      ? `Faltam ${formatBRL(diferencaFatura)} pra fechar com o total da fatura (${formatBRL(totalFatura)}).`
                      : `Excedeu ${formatBRL(Math.abs(diferencaFatura))} além do total da fatura (${formatBRL(totalFatura)}).`}</span>}
                    description={<span style={{ color: t.textSecondary }}>{diferencaFatura > 0
                      ? 'Provavelmente são encargos (juros, multa, IOF, anuidade ou seguro) que a IA não pegou. Clique pra lançar a diferença como encargo.'
                      : 'Quase sempre é um crédito de saldo anterior (você pagou a fatura passada a mais) — o "Saldo" da fatura já abate esse valor. Pode também ser item duplicado ou estorno que faltou. Lance a diferença como crédito pra fechar com o total, ou edite a linha errada.'}</span>}
                    action={diferencaFatura > 0 ? (
                      <Button size="small" type="primary" onClick={lancarDiferencaComoEncargo} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
                        Lançar {formatBRL(diferencaFatura)} como encargo
                      </Button>
                    ) : (
                      <Button size="small" type="primary" onClick={lancarDiferencaComoAjuste} style={{ background: t.accents.rose, borderColor: t.accents.rose }}>
                        Lançar −{formatBRL(Math.abs(diferencaFatura))} como crédito
                      </Button>
                    )}
                  />
                );
              })()}

              {provisao.futuras > 0 && (
                <Alert
                  type="info"
                  showIcon
                  icon={<RotateCcw size={15} />}
                  style={{ background: `${t.accents.blue}1f`, border: `1px solid ${t.accents.blue}66`, color: t.text }}
                  message={<span style={{ color: t.text }}>
                    <b>{provisao.grupos}</b> compra(s) parcelada(s) vão provisionar <b>{provisao.futuras}</b> parcela(s) futura(s) nos próximos meses.
                  </span>}
                  description={<span style={{ color: t.textSecondary }}>Cada parcela futura entra como pendente no mês correspondente — sem duplicar quando você importar a próxima fatura.</span>}
                />
              )}

              <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {itens.map((it, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '28px 92px 1fr 110px 110px 28px', gap: 8, alignItems: 'center', minWidth: 400,
                    padding: '6px 8px', borderRadius: 8,
                    background: it.incluir ? t.surfaceMuted : 'transparent',
                    border: `1px solid ${t.borderSoft}`, opacity: it.incluir ? 1 : 0.5,
                  }}>
                    <Radio checked={it.incluir} onClick={() => setItem(idx, { incluir: !it.incluir })} />
                    <Input size="small" value={it.data} onChange={(e) => setItem(idx, { data: e.target.value })} placeholder="AAAA-MM-DD" />
                    <div style={{ minWidth: 0 }}>
                      <Input size="small" value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value })} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {(() => {
                          const p = parcelaInfo(it.descricao);
                          if (!p) return null;
                          const futuras = p.total - p.atual;
                          return (
                            <Tag bordered={false} style={{ margin: 0, fontSize: 10, lineHeight: '16px', background: futuras > 0 ? `${t.accents.blue}22` : t.surfaceMuted, color: futuras > 0 ? t.accents.blue : t.textTertiary }}>
                              {futuras > 0 ? `parcela ${p.atual}/${p.total} · +${futuras} futura(s)` : `parcela ${p.atual}/${p.total} (última)`}
                            </Tag>
                          );
                        })()}
                        {(it.grupo || it.conta) && (
                          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.grupo ? `${it.grupo} › ` : ''}{it.conta || ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <Input size="small" value={it.categoria} onChange={(e) => setItem(idx, { categoria: e.target.value })} placeholder="categoria" />
                    <InputNumber size="small" style={{ width: '100%' }} value={it.valor} step={0.01} decimalSeparator="," precision={2} prefix="R$" onChange={(v) => setItem(idx, { valor: Number(v) || 0 })} />
                    <Tooltip title="Remover linha">
                      <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => removerLinha(idx)} />
                    </Tooltip>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" icon={<Plus size={13} />} onClick={() => adicionarLinha()}>
                  Adicionar linha manualmente
                </Button>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textAlign: 'right' }}>
                  Revise datas, descrições e valores. Cada item vira um lançamento no cartão escolhido.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Sub-view: Plano de Contas (centros de custo) ─────────────────────────────
// Estrutura contábil leve (grupo → conta) pra classificar os gastos. O Gemini
// gera um plano sob medida a partir dos seus lançamentos; depois a importação de
// fatura classifica cada compra numa dessas contas.

function PainelPlanoContas({ contas, onRecarregar }: {
  contas: PlanoConta[];
  onRecarregar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message, modal } = AntApp.useApp();
  const [gerando, setGerando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<PlanoConta | null>(null);

  const grupos = useMemo(() => {
    const m: Record<string, PlanoConta[]> = {};
    for (const c of contas) {
      const g = c.grupo || 'Geral';
      if (!m[g]) m[g] = [];
      m[g].push(c);
    }
    return Object.keys(m).map((g) => ({ grupo: g, contas: m[g], cor: m[g][0]?.cor || t.accents.lavender }));
  }, [contas, t]);

  const gerar = (substituir: boolean) => {
    setGerando(true);
    callServer<ServerResponse<unknown>>('gerarPlanoContasIA', substituir)
      .then((res) => {
        if (res.ok) { message.success('Plano de contas gerado pelo Gemini'); onRecarregar(); }
        else message.error(res.error || 'Erro ao gerar');
      })
      .catch(() => message.error('Falha ao gerar (rode no app publicado)'))
      .finally(() => setGerando(false));
  };

  const onGerarClick = () => {
    if (contas.length > 0) {
      modal.confirm({
        title: 'Refazer plano de contas?',
        content: 'A IA vai substituir o plano atual por um novo, baseado nos seus gastos.',
        okText: 'Refazer com IA', cancelText: 'Cancelar',
        onOk: () => gerar(true),
      });
    } else {
      gerar(true);
    }
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarContaPlano', id).then((res) => {
      if (res.ok) { message.success('Conta removida'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.lavender}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: t.text }}>
            Plano de contas
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, marginTop: 4, maxWidth: 520 }}>
            Seus centros de custo organizados por grupo. O Gemini monta um plano sob medida a partir dos seus gastos — e a importação de fatura já classifica cada compra aqui.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<Sparkles size={16} />} loading={gerando} onClick={onGerarClick} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
            {contas.length > 0 ? 'Refazer com IA' : 'Gerar com IA (Gemini)'}
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => { setEditando(null); setModalOpen(true); }}>
            Nova conta
          </Button>
        </div>
      </div>

      {contas.length === 0 ? (
        <Panel title="Plano de contas">
          <Empty description="Nenhuma conta ainda. Gere um plano sob medida com o Gemini ou crie manualmente.">
            <Button type="primary" icon={<Sparkles size={14} />} loading={gerando} onClick={onGerarClick} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
              Gerar com IA (Gemini)
            </Button>
          </Empty>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
          {grupos.map((g) => (
            <Panel key={g.grupo} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: g.cor }} /> {g.grupo}</span>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.contas.map((c) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                  }}>
                    {c.codigo && <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, minWidth: 36 }}>{c.codigo}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.nome}
                        {c.tipo === 'receita' && <Tag bordered={false} style={{ marginInlineEnd: 0, background: `${t.accents.sage}22`, color: t.accents.sage, fontSize: 10 }}>receita</Tag>}
                      </div>
                      {c.descricao && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.descricao}</div>}
                    </div>
                    <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => { setEditando(c); setModalOpen(true); }} />
                    <Popconfirm title="Remover conta?" onConfirm={() => remover(c.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                      <Button size="small" type="text" icon={<Trash2 size={13} />} danger />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <ModalConta
        open={modalOpen}
        conta={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); onRecarregar(); }}
      />
    </div>
  );
}

function ModalConta({ open, conta, onClose, onSaved }: {
  open: boolean;
  conta: PlanoConta | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (conta) form.setFieldsValue(conta);
      else form.setFieldsValue({ tipo: 'despesa', grupo: 'Geral', cor: '#6b7280', ativo: 'sim' });
    }
  }, [open, conta, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<unknown>>('salvarContaPlano', { ...v, id: conta?.id });
      if (res.ok) { message.success(conta ? 'Conta atualizada' : 'Conta criada'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={conta ? 'Editar conta' : 'Nova conta'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={500}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <Form.Item name="codigo" label="Código">
            <Input placeholder="3.01" />
          </Form.Item>
          <Form.Item name="grupo" label="Grupo" rules={[{ required: true, message: 'Informe o grupo' }]}>
            <Input placeholder="Ex: Moradia, Transporte…" />
          </Form.Item>
        </div>
        <Form.Item name="nome" label="Conta" rules={[{ required: true, message: 'Informe o nome da conta' }]}>
          <Input placeholder="Ex: Aluguel, Combustível…" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="tipo" label="Tipo">
            <Select options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]} />
          </Form.Item>
          <Form.Item name="cor" label="Cor (hex)">
            <Input placeholder="#6b7280" />
          </Form.Item>
        </div>
        <Form.Item name="descricao" label="Descrição (opcional)">
          <Input.TextArea rows={2} placeholder="O que entra nessa conta" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Modal: novo/editar cartão ────────────────────────────────────────────────

interface ModalCartaoProps {
  open: boolean;
  onClose: () => void;
  cartao: CartaoPessoal | null;
  onSaved: () => void;
}

function ModalCartao({ open, onClose, cartao, onSaved }: ModalCartaoProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [corSelecionada, setCorSelecionada] = useState<string>(CORES_CARTAO[0]);

  useEffect(() => {
    if (open) {
      if (cartao) {
        form.setFieldsValue(cartao);
        setCorSelecionada(cartao.cor);
      } else {
        form.resetFields();
        form.setFieldsValue({
          bandeira: 'visa',
          limite: 1000,
          diaFechamento: 25,
          diaVencimento: 5,
          cor: CORES_CARTAO[0],
          ativo: 'sim',
        });
        setCorSelecionada(CORES_CARTAO[0]);
      }
    }
  }, [open, cartao, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = { ...v, id: cartao?.id, cor: corSelecionada };
      const res = await callServer<ServerResponse<unknown>>('salvarCartaoPessoal', payload);
      if (res.ok) {
        message.success(cartao ? 'Cartão atualizado' : 'Cartão cadastrado');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={cartao ? 'Editar cartão' : 'Novo cartão'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="nome" label="Nome do banco" rules={[{ required: true }]}>
            <Input placeholder="Ex: Nubank" autoFocus />
          </Form.Item>
          <Form.Item name="apelido" label="Apelido (opcional)">
            <Input placeholder="Ex: Roxinho" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="bandeira" label="Bandeira">
            <Select options={BANDEIRAS} />
          </Form.Item>
          <Form.Item name="limite" label="Limite">
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} precision={2} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="diaFechamento" label="Dia de fechamento" tooltip="Dia do mês que a fatura fecha (1-31)">
            <InputNumber style={{ width: '100%' }} min={1} max={31} />
          </Form.Item>
          <Form.Item name="diaVencimento" label="Dia de vencimento" tooltip="Dia do mês que a fatura vence (1-31)">
            <InputNumber style={{ width: '100%' }} min={1} max={31} />
          </Form.Item>
        </div>
        <Form.Item label="Cor do cartão">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORES_CARTAO.map((c) => (
              <div
                key={c}
                onClick={() => setCorSelecionada(c)}
                style={{
                  width: 32, height: 32, borderRadius: 8, background: c, cursor: 'pointer',
                  border: corSelecionada === c ? `3px solid ${t.text}` : '3px solid transparent',
                  transition: 'all 0.15s', boxShadow: corSelecionada === c ? '0 0 0 2px ' + c + '33' : 'none',
                }}
              />
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Sub-view: orçamentos por categoria ───────────────────────────────────────

interface PainelOrcamentosProps {
  progresso: ProgressoOrcamentos | null;
  categoriasUsadas: string[];
  onRecarregar: () => void;
}

function PainelOrcamentos({ progresso, categoriasUsadas, onRecarregar }: PainelOrcamentosProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const labelCategoria = useLabelCategoria();
  const categoriasCtx = useContext(CategoriasContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<ProgressoOrcamentoItem | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const abrir = (item?: ProgressoOrcamentoItem) => {
    setEditando(item || null);
    if (item) {
      form.setFieldsValue({ categoria: item.categoria, limiteMensal: item.limite });
    } else {
      form.resetFields();
      form.setFieldsValue({ limiteMensal: 500 });
    }
    setModalOpen(true);
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = { ...v, id: editando?.id };
      const res = await callServer<ServerResponse<unknown>>('salvarOrcamento', payload);
      if (res.ok) {
        message.success(editando ? 'Orçamento atualizado' : 'Orçamento criado');
        setModalOpen(false);
        onRecarregar();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarOrcamento', id).then((res) => {
      if (res.ok) { message.success('Orçamento removido'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const itens = progresso?.itens || [];

  // Opções pro AutoComplete: catálogo de categorias + usadas em lançamentos
  const opcoesCategoria = useMemo(() => {
    const map: Record<string, { value: string; label: string }> = {};
    for (const c of categoriasCtx) {
      map[c.nome] = { value: c.nome, label: c.emoji ? `${c.emoji} ${c.label}` : c.label };
    }
    for (const nome of categoriasUsadas) {
      if (!map[nome]) map[nome] = { value: nome, label: nome };
    }
    return Object.values(map);
  }, [categoriasUsadas, categoriasCtx]);

  return (
    <Panel
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} color={t.accents.peach} />
          <span>Orçamentos por categoria</span>
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>{itens.length}</Tag>
        </div>
      }
      extra={
        <Button type="primary" icon={<Plus size={14} />} onClick={() => abrir()}>
          Novo orçamento
        </Button>
      }
      padding={itens.length === 0 ? 32 : 16}
    >
      {itens.length === 0 ? (
        <Empty description="Nenhum orçamento configurado. Crie um pra acompanhar seus limites por categoria.">
          <Button type="primary" icon={<Plus size={14} />} onClick={() => abrir()}>
            Criar primeiro orçamento
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {itens.map((item) => {
            const cor =
              item.status === 'estouro' ? t.accents.rose :
              item.status === 'atencao' ? t.accents.peach :
              t.accents.sage;
            return (
              <div
                key={item.id}
                style={{
                  background: t.surfaceMuted,
                  border: `1px solid ${item.status !== 'ok' ? `${cor}55` : t.borderSoft}`,
                  borderRadius: 12, padding: 14,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>
                      {labelCategoria(item.categoria)}
                    </div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
                      Limite mensal: {formatBRL(item.limite)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Editar">
                      <Button size="small" type="text" icon={<Pencil size={12} />} onClick={() => abrir(item)} />
                    </Tooltip>
                    <Popconfirm title="Remover orçamento?" onConfirm={() => remover(item.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                      <Button size="small" type="text" icon={<Trash2 size={12} />} danger />
                    </Popconfirm>
                  </div>
                </div>
                <Progress
                  percent={Math.min(100, item.pct)}
                  strokeColor={cor}
                  format={() => `${item.pct.toFixed(0)}%`}
                  size="small"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
                  <span>Gasto: <strong style={{ color: cor }}>{formatBRL(item.gasto)}</strong></span>
                  <span>Resta: {formatBRL(item.restante)}</span>
                </div>
                {item.status === 'estouro' && (
                  <Tag color="red" style={{ marginInlineEnd: 0, fontSize: 10 }}>Estourou {formatBRL(item.gasto - item.limite)}</Tag>
                )}
                {item.status === 'atencao' && (
                  <Tag color="orange" style={{ marginInlineEnd: 0, fontSize: 10 }}>Quase estourando</Tag>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={editando ? 'Editar orçamento' : 'Novo orçamento'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Salvar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
          <Form.Item name="categoria" label="Categoria" rules={[{ required: true, message: 'Informe a categoria' }]} tooltip="Digite livre pra nova ou escolha existente">
            <AutoComplete
              options={opcoesCategoria}
              disabled={!!editando}
              placeholder="Ex: mercado, transporte, jiu-jitsu…"
            />
          </Form.Item>
          <Form.Item name="limiteMensal" label="Limite mensal" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} precision={2} placeholder="500,00" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="O sistema soma todos os lançamentos do mês corrente nessa categoria e mostra quanto você já gastou do limite."
            style={{ fontSize: 12 }}
          />
        </Form>
      </Modal>
    </Panel>
  );
}

// ─── Sub-view: recorrências ativas ────────────────────────────────────────────

// Status de ciclo de vida da recorrência (espelha _statusRecorrencia do server,
// com fallback caso o backend antigo não envie statusRecorrencia ainda).
function statusDaRecorrencia(r: RecorrenciaAtiva): 'ativa' | 'pausada' | 'concluida' {
  if (r.statusRecorrencia) return r.statusRecorrencia;
  if (String(r.recorrencia || 'unica') === 'unica') return 'concluida';
  const a = String(r.recorrenciaAtiva || 'sim');
  if (a === 'concluida') return 'concluida';
  if (a === 'nao') return 'pausada';
  return 'ativa';
}

interface PainelRecorrenciasProps {
  recorrencias: RecorrenciaAtiva[];
  cartoes: CartaoPessoal[];
  onEditar: (l: LancamentoPessoal) => void;
  onRecarregar: () => void;
}

function PainelRecorrencias({ recorrencias, cartoes, onEditar, onRecarregar }: PainelRecorrenciasProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const labelCategoria = useLabelCategoria();

  const alternar = (id: string, acao: 'pausar' | 'reativar' | 'concluir') => {
    callServer<ServerResponse<unknown>>('alternarRecorrencia', id, acao).then((res) => {
      if (res.ok) {
        message.success(
          acao === 'pausar' ? 'Recorrência pausada' :
          acao === 'reativar' ? 'Recorrência reativada' :
          'Recorrência concluída — segue no histórico'
        );
        onRecarregar();
      } else {
        message.error(res.error || 'Erro');
      }
    });
  };

  // Ordena: ativas primeiro, depois pausadas, concluídas no fim (histórico).
  const ordemStatus: Record<string, number> = { ativa: 0, pausada: 1, concluida: 2 };
  const recorrenciasOrdenadas = [...recorrencias].sort(
    (a, b) => (ordemStatus[statusDaRecorrencia(a)] ?? 0) - (ordemStatus[statusDaRecorrencia(b)] ?? 0),
  );

  const gerarAgora = () => {
    message.loading('Gerando recorrências pendentes…', 0);
    callServer<ServerResponse<{ criados: number }>>('gerarRecorrenciasPendentes').then((res) => {
      message.destroy();
      if (res.ok && res.data) {
        const n = (res.data as { criados: number }).criados;
        message.success(n > 0 ? `${n} novo(s) lançamento(s) gerado(s)` : 'Tudo em dia, nada novo pra gerar');
        onRecarregar();
      } else {
        message.error(res.error || 'Erro');
      }
    });
  };

  return (
    <Panel
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RotateCcw size={16} color={t.accents.blue} />
          <span>Recorrências ativas</span>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{recorrencias.length}</Tag>
        </div>
      }
      extra={
        <Button icon={<Sparkles size={14} />} onClick={gerarAgora}>
          Gerar pendentes agora
        </Button>
      }
      padding={recorrencias.length === 0 ? 32 : 0}
    >
      {recorrencias.length === 0 ? (
        <Empty
          description={
            <div>
              <div style={{ color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14 }}>
                Sem recorrências configuradas
              </div>
              <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12.5, marginTop: 4 }}>
                Crie um lançamento e escolha <strong>"Mensal"</strong> no campo Recorrência pra que ele se replique automaticamente a cada mês.
              </div>
            </div>
          }
        />
      ) : (
        <div>
          {recorrenciasOrdenadas.map((r, idx) => {
            const status = statusDaRecorrencia(r);
            const ativa = status === 'ativa';
            const concluida = status === 'concluida';
            const periodo =
              r.recorrencia === 'mensal' ? 'mês' :
              r.recorrencia === 'semanal' ? 'semana' :
              r.recorrencia === 'anual' ? 'ano' : 'período';
            const cartao = r.cartaoId ? cartoes.find((c) => c.id === r.cartaoId) : null;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px',
                  borderBottom: idx < recorrenciasOrdenadas.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                  opacity: ativa ? 1 : 0.62,
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: ativa ? `${t.accents.blue}15` : concluida ? `${t.accents.sage}15` : t.surfaceMuted,
                  color: ativa ? t.accents.blue : concluida ? t.accents.sage : t.textTertiary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {concluida ? <CheckCircle2 size={18} /> : <RotateCcw size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.text, fontWeight: 500 }}>
                    {r.descricao}
                    {status === 'pausada' && (
                      <Tag color="default" style={{ marginInlineStart: 8, fontSize: 10 }}>pausada</Tag>
                    )}
                    {concluida && (
                      <Tag color="green" style={{ marginInlineStart: 8, fontSize: 10 }}>concluída</Tag>
                    )}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
                    {formatBRL(r.valor)} todo {periodo} · {labelCategoria(r.categoria)} · {labelMetodo(r.metodo)}
                    {cartao && ` · 💳 ${cartao.apelido || cartao.nome}`}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 4 }}>
                    {r.totalGerados} já lançado(s){r.ultimoGeradoEm && dayjs(r.ultimoGeradoEm).isValid() ? ` · último: ${dayjs(r.ultimoGeradoEm).format('DD/MM/YYYY')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {concluida ? (
                    <Tooltip title="Reabrir recorrência (volta a gerar e projetar nos próximos meses)">
                      <Button size="small" type="primary" icon={<PlayCircle size={14} />} onClick={() => alternar(r.id, 'reativar')}>
                        Reabrir
                      </Button>
                    </Tooltip>
                  ) : ativa ? (
                    <Tooltip title="Pausar temporariamente (para de gerar/projetar; dá pra retomar)">
                      <Button size="small" icon={<PauseCircle size={14} />} onClick={() => alternar(r.id, 'pausar')}>
                        Pausar
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Retomar recorrência pausada">
                      <Button size="small" type="primary" icon={<PlayCircle size={14} />} onClick={() => alternar(r.id, 'reativar')}>
                        Retomar
                      </Button>
                    </Tooltip>
                  )}
                  {!concluida && (
                    <Popconfirm
                      title="Concluir essa recorrência?"
                      description="Para de gerar e projetar nos próximos meses, mas continua aqui no histórico (e pode ser reaberta depois)."
                      onConfirm={() => alternar(r.id, 'concluir')}
                      okText="Concluir"
                      cancelText="Voltar"
                    >
                      <Tooltip title="Concluir (encerra, mantém no histórico)">
                        <Button size="small" type="text" icon={<CheckCircle2 size={14} />}>Concluir</Button>
                      </Tooltip>
                    </Popconfirm>
                  )}
                  <Tooltip title="Editar lançamento original">
                    <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onEditar(r)} />
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Sub-view: gestão de categorias ───────────────────────────────────────────

interface PainelCategoriasProps {
  categorias: CategoriaPessoal[];
  onRecarregar: () => void;
}

// Paleta pré-definida pro picker. Cobre os principais usos sem deixar o user
// perdido com colorpicker completo. Cores são as mesmas do seed padrão +
// variações suaves.
const PALETA_CATEGORIAS = [
  '#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444',
  '#84cc16', '#06b6d4', '#8b5cf6', '#0ea5e9', '#ec4899',
  '#d97706', '#0891b2', '#16a34a', '#22c55e', '#0d9488',
  '#6b7280', '#1e40af', '#7c3aed', '#be123c', '#15803d',
];

function PainelCategorias({ categorias, onRecarregar }: PainelCategoriasProps): React.ReactElement {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<CategoriaPessoal | null>(null);
  const [mesclarModalOpen, setMesclarModalOpen] = useState(false);
  const [mesclarOrigem, setMesclarOrigem] = useState<CategoriaPessoal | null>(null);

  const abrirNovo = () => { setEditando(null); setModalOpen(true); };
  const abrirEditar = (c: CategoriaPessoal) => { setEditando(c); setModalOpen(true); };
  const abrirMesclar = (c: CategoriaPessoal) => { setMesclarOrigem(c); setMesclarModalOpen(true); };

  const remover = (c: CategoriaPessoal) => {
    callServer<ServerResponse<{ lancamentosMovidos: number }>>('deletarCategoriaPessoal', c.id).then((res) => {
      if (res.ok) {
        const movidos = (res.data as { lancamentosMovidos: number })?.lancamentosMovidos || 0;
        message.success(
          movidos > 0
            ? `Categoria removida. ${movidos} lançamento(s) movido(s) pra "outros".`
            : 'Categoria removida.'
        );
        onRecarregar();
      } else {
        message.error(res.error || 'Erro ao remover');
      }
    });
  };

  // Ordena por uso (qtdTotal desc) — mais usadas no topo. Inativas no fim.
  const ordenadas = [...categorias].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo === 'sim' ? -1 : 1;
    return (b.qtdTotal || 0) - (a.qtdTotal || 0);
  });

  return (
    <Panel
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏷️</span>
          <span>Categorias</span>
          <Tag color="cyan" style={{ marginInlineEnd: 0 }}>{categorias.length}</Tag>
        </div>
      }
      extra={
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>
          Nova categoria
        </Button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {ordenadas.map((c) => (
          <CategoriaCard
            key={c.id}
            categoria={c}
            onEditar={() => abrirEditar(c)}
            onMesclar={() => abrirMesclar(c)}
            onRemover={() => remover(c)}
          />
        ))}
      </div>

      <ModalCategoria
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categoria={editando}
        onSaved={() => { setModalOpen(false); onRecarregar(); }}
      />

      <ModalMesclarCategoria
        open={mesclarModalOpen}
        onClose={() => setMesclarModalOpen(false)}
        origem={mesclarOrigem}
        categorias={categorias}
        onSaved={() => { setMesclarModalOpen(false); onRecarregar(); }}
      />
    </Panel>
  );
}

// Card individual de categoria — mostra emoji grande, label, stats, ações.
function CategoriaCard({ categoria, onEditar, onMesclar, onRemover }: {
  categoria: CategoriaPessoal;
  onEditar: () => void;
  onMesclar: () => void;
  onRemover: () => void;
}): React.ReactElement {
  const t = useTokens();
  const inativa = categoria.ativo === 'nao';
  const ehOutros = categoria.nome === 'outros';
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${categoria.cor}33`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
        opacity: inativa ? 0.55 : 1,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Faixa colorida lateral */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: categoria.cor,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <IconeCategoria nome={categoria.icone} cor={categoria.cor} size={20} boxSize={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 500, color: t.text }}>
            {categoria.label}
            {ehOutros && (
              <Tag color="default" style={{ marginInlineStart: 6, fontSize: 9 }}>fallback</Tag>
            )}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary, marginTop: 2 }}>
            {categoria.nome}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary,
        paddingTop: 8, borderTop: `1px dashed ${t.borderSoft}`,
      }}>
        <div>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(categoria.totalMes || 0)}
          </div>
          <div style={{ fontSize: 10.5 }}>gasto no mês</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
            {categoria.qtdTotal || 0}
          </div>
          <div style={{ fontSize: 10.5 }}>lançamento(s)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Tooltip title="Editar categoria">
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={onEditar} />
        </Tooltip>
        <Tooltip title="Mesclar em outra categoria (move todos os lançamentos)">
          <Button size="small" type="text" icon={<ArrowLeftRight size={13} />} onClick={onMesclar} disabled={ehOutros} />
        </Tooltip>
        <Popconfirm
          title="Remover categoria?"
          description="Os lançamentos serão movidos pra 'outros'."
          onConfirm={onRemover}
          okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
          disabled={ehOutros}
        >
          <Tooltip title={ehOutros ? "A categoria 'outros' não pode ser removida" : "Remover categoria"}>
            <Button size="small" type="text" icon={<Trash2 size={13} />} danger disabled={ehOutros} />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}

// Modal de nova/editar categoria com emoji picker + cor picker.
function ModalCategoria({ open, onClose, categoria, onSaved }: {
  open: boolean;
  onClose: () => void;
  categoria: CategoriaPessoal | null;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [iconeSelecionado, setIconeSelecionado] = useState<string>('tag');
  const [corSelecionada, setCorSelecionada] = useState<string>('#6b7280');
  const [labelPreview, setLabelPreview] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (categoria) {
        form.setFieldsValue(categoria);
        setIconeSelecionado(categoria.icone || 'tag');
        setCorSelecionada(categoria.cor);
        setLabelPreview(categoria.label);
      } else {
        form.resetFields();
        form.setFieldsValue({ ordem: 50, ativo: 'sim' });
        setIconeSelecionado('tag');
        setCorSelecionada(PALETA_CATEGORIAS[0]);
        setLabelPreview('');
      }
    }
  }, [open, categoria, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        ...v,
        id: categoria?.id,
        icone: iconeSelecionado,
        cor: corSelecionada,
        // Mantém emoji só pra contextos textuais (toast, alerta). Se for novo,
        // herda do ícone correspondente — vazio é OK também.
        emoji: categoria?.emoji || '',
      };
      const res = await callServer<ServerResponse<unknown>>('salvarCategoriaPessoal', payload);
      if (res.ok) {
        message.success(categoria ? 'Categoria atualizada' : 'Categoria criada');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={categoria ? 'Editar categoria' : 'Nova categoria'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        {/* Preview ao vivo da categoria */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: 14, marginBottom: 16,
          background: `${corSelecionada}10`,
          border: `1px solid ${corSelecionada}30`,
          borderRadius: 10,
        }}>
          <IconeCategoria nome={iconeSelecionado} cor={corSelecionada} size={22} boxSize={48} />
          <div>
            <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>
              {labelPreview || 'Sua categoria'}
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
              Pré-visualização
            </div>
          </div>
        </div>

        <Form.Item name="label" label="Nome exibido" rules={[{ required: true, message: 'Informe o nome' }]} tooltip="Como vai aparecer nas listas (ex: 'Jiu-Jitsu')">
          <Input
            placeholder="Ex: Jiu-Jitsu"
            autoFocus
            onChange={(e) => setLabelPreview(e.target.value)}
          />
        </Form.Item>

        <Form.Item label="Ícone" tooltip="Mesma família dos ícones da sidebar — outline minimalista">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 38px)', gap: 6,
            maxHeight: 220, overflowY: 'auto', padding: 6,
            background: t.surfaceMuted, borderRadius: 8,
            border: `1px solid ${t.borderSoft}`,
          }}>
            {ICONES_DISPONIVEIS.map((nome) => {
              const Ic = getIconeComponente(nome);
              const ativo = iconeSelecionado === nome;
              return (
                <div
                  key={nome}
                  onClick={() => setIconeSelecionado(nome)}
                  title={nome}
                  style={{
                    width: 38, height: 38, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    background: ativo ? `${corSelecionada}18` : t.surface,
                    border: ativo ? `2px solid ${corSelecionada}` : `2px solid transparent`,
                    transition: 'all 0.12s',
                  }}
                >
                  <Ic size={18} color={ativo ? corSelecionada : t.textSecondary} strokeWidth={1.6} />
                </div>
              );
            })}
          </div>
        </Form.Item>

        <Form.Item label="Cor">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PALETA_CATEGORIAS.map((c) => (
              <div
                key={c}
                onClick={() => setCorSelecionada(c)}
                style={{
                  width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer',
                  border: corSelecionada === c ? `3px solid ${t.text}` : '3px solid transparent',
                  transition: 'all 0.15s',
                  boxShadow: corSelecionada === c ? `0 0 0 2px ${c}33` : 'none',
                }}
              />
            ))}
          </div>
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="ordem" label="Ordem" tooltip="Menor número aparece primeiro (ex: 1 antes de 50)">
            <InputNumber style={{ width: '100%' }} min={1} max={99} />
          </Form.Item>
          <Form.Item name="ativo" label="Status">
            <Select
              options={[
                { value: 'sim', label: 'Ativa' },
                { value: 'nao', label: 'Inativa (oculta do AutoComplete)' },
              ]}
            />
          </Form.Item>
        </div>

        {categoria && (
          <Alert
            type="info"
            showIcon
            message="Se você renomear, todos os lançamentos com essa categoria serão atualizados automaticamente."
            style={{ fontSize: 12 }}
          />
        )}
      </Form>
    </Modal>
  );
}

// Modal de mesclar: escolhe categoria destino e re-vincula todos os lançamentos.
function ModalMesclarCategoria({ open, onClose, origem, categorias, onSaved }: {
  open: boolean;
  onClose: () => void;
  origem: CategoriaPessoal | null;
  categorias: CategoriaPessoal[];
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [destinoId, setDestinoId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDestinoId(undefined); }, [open]);

  const mesclar = async () => {
    if (!origem || !destinoId) {
      message.warning('Escolha a categoria destino');
      return;
    }
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<{ lancamentosMovidos: number }>>('mesclarCategorias', origem.id, destinoId);
      if (res.ok) {
        const movidos = (res.data as { lancamentosMovidos: number })?.lancamentosMovidos || 0;
        message.success(`Categorias mescladas. ${movidos} lançamento(s) movido(s).`);
        onSaved();
      } else {
        message.error(res.error || 'Erro ao mesclar');
      }
    } catch {
      message.error('Erro ao mesclar');
    } finally {
      setSaving(false);
    }
  };

  const opcoes = categorias
    .filter((c) => c.id !== origem?.id)
    .map((c) => ({ value: c.id, label: c.label }));

  return (
    <Modal
      title="Mesclar categoria"
      open={open}
      onCancel={onClose}
      onOk={mesclar}
      confirmLoading={saving}
      okText="Mesclar"
      cancelText="Cancelar"
      destroyOnClose
    >
      {origem && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <IconeCategoria nome={origem.icone} cor={origem.cor} size={20} boxSize={44} />
            <div style={{ fontFamily: FONTS.display, fontSize: 14, color: t.text }}>
              <strong>{origem.label}</strong>
            </div>
          </div>
          <Alert
            type="warning"
            showIcon
            message="Todos os lançamentos e orçamentos serão movidos pra categoria destino. A categoria origem será removida — essa ação não tem volta."
            style={{ marginBottom: 16, fontSize: 12.5 }}
          />
          <div style={{ marginBottom: 8, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
            Categoria destino:
          </div>
          <Select
            value={destinoId}
            onChange={setDestinoId}
            options={opcoes}
            placeholder="Escolha uma categoria"
            style={{ width: '100%' }}
            size="large"
          />
          <div style={{ marginTop: 12, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            Use esse recurso pra consertar duplicatas (ex: "gasolina" + "Gasolina") ou consolidar categorias parecidas.
          </div>
        </>
      )}
    </Modal>
  );
}
