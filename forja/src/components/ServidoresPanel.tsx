// ServidoresPanel — estação "Servidores" do Atelier (v1.146.0).
//
// Cadastro premium pra instâncias que você roda: proxies LLM (LiteLLM, Ollama,
// vLLM), automações (n8n, Node-RED), mística (Stable Diffusion, ComfyUI), DBs
// locais (Postgres, Redis), workers, self-hosted (Plex, Home Assistant).
//
// Princípios de UX (replicando padrão do ContasPanel):
// - Lista escaneável com pill de status colorida; modal de detalhe não empurra layout.
// - Form de cadastro completo dividido em seções (Identidade → Conexão →
//   Operação → Manutenção → Notas), sem deixar a tela pesada.
// - Presets de tipos famosos pra preencher rápido (LiteLLM, Ollama, n8n…).
// - cofreLabel referencia item no Cofre (nunca guarda senha aqui).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Select, Empty, Skeleton, Tooltip, Modal, Form,
  Popconfirm, InputNumber, Segmented,
} from 'antd';
import {
  Plus, Search, Trash2, Pencil, ExternalLink, Cpu, Terminal, ShieldCheck,
  Server as ServerIcon, Database, Box, Activity, Code2, Brain,
  Copy, Hammer, Sparkles, ChevronRight, Cloud, Home, AlertTriangle,
  BookOpen, Tag as TagIcon, Globe, Workflow, Container, Power, Wifi, WifiOff,
  RefreshCcw, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { pingMuitos, pingServidor, urlPingavel, type PingResult } from '../utils/pingServidor';
import type { Servidor, ServidorPath, ServerResult, Sistema, ServerResponse } from '../types';

// ─── Catálogos ────────────────────────────────────────────────────────────────

interface StatusInfo { label: string; cor: string; icon: LucideIcon }
const STATUS: Record<string, StatusInfo> = {
  rodando: { label: 'Rodando', cor: '#3CB371', icon: Activity },
  parado: { label: 'Parado', cor: '#8C8884', icon: Power },
  dev: { label: 'Dev / Teste', cor: '#B59AE0', icon: Hammer },
  erro: { label: 'Com erro', cor: '#E2725B', icon: AlertTriangle },
};

interface AmbienteInfo { label: string; icon: LucideIcon }
const AMBIENTE: Record<string, AmbienteInfo> = {
  local: { label: 'Local', icon: Home },
  vps: { label: 'VPS', icon: ServerIcon },
  cloud: { label: 'Cloud', icon: Cloud },
  edge: { label: 'Edge', icon: Globe },
  outro: { label: 'Outro', icon: Box },
};

// Heurística pra escolher um ícone visual baseado no tipo do servidor.
// Cobre os famosos sem precisar de mapping exaustivo — o user pode botar
// qualquer string em "tipo" e ainda assim ganha um ícone razoável.
function iconePorTipo(tipo: string): LucideIcon {
  const t = String(tipo || '').toLowerCase();
  if (/litellm|ollama|llm|gpt|claude|llama|vllm|mistral|gemini|cohere|embedding/.test(t)) return Brain;
  if (/n8n|node[-_ ]?red|workflow|automat|zapier|make/.test(t)) return Workflow;
  if (/postgres|mysql|sqlite|mongo|redis|elastic|database|db/.test(t)) return Database;
  if (/comfy|stable[-_ ]?diffusion|invokeai|midjourney|flux|sd[ -]?next/.test(t)) return Sparkles;
  if (/docker|container|compose|kubernetes|k8s|swarm/.test(t)) return Container;
  if (/proxy|nginx|caddy|traefik|cloudflare/.test(t)) return Globe;
  if (/worker|queue|cron|scheduler|bull|sidekiq/.test(t)) return Cpu;
  if (/plex|jellyfin|home[-_ ]?assistant|nextcloud|self[-_ ]?host/.test(t)) return Home;
  if (/api|rest|graphql|backend|server/.test(t)) return ServerIcon;
  if (/code|dev|ide/.test(t)) return Code2;
  return Box;
}

// Presets — clica e o form já fica 80% pronto. Cobre o roadmap típico de quem
// faz vibe coding com proxies + agents + mística.
interface Preset {
  tipo: string;
  nome: string;
  descricao: string;
  porta: string;
  url: string; // gera URL local se houver porta default
  tecnologia: string;
  docsUrl: string;
  comandoStart?: string;
}
const PRESETS: Preset[] = [
  { tipo: 'LiteLLM Proxy', nome: 'LiteLLM Proxy', descricao: 'Proxy unificado pra múltiplas LLMs (OpenAI, Claude, local…)', porta: '4000', url: 'http://localhost:4000', tecnologia: 'docker', docsUrl: 'https://docs.litellm.ai/docs/simple_proxy', comandoStart: 'litellm --config config.yaml --port 4000' },
  { tipo: 'Ollama', nome: 'Ollama', descricao: 'Roda LLMs open-source localmente (Llama, Mistral, etc.)', porta: '11434', url: 'http://localhost:11434', tecnologia: 'native', docsUrl: 'https://github.com/ollama/ollama', comandoStart: 'ollama serve' },
  { tipo: 'vLLM', nome: 'vLLM', descricao: 'Serving de LLM de alta throughput', porta: '8000', url: 'http://localhost:8000', tecnologia: 'docker', docsUrl: 'https://docs.vllm.ai/', comandoStart: 'python -m vllm.entrypoints.openai.api_server' },
  { tipo: 'n8n', nome: 'n8n', descricao: 'Automações low-code com integrações', porta: '5678', url: 'http://localhost:5678', tecnologia: 'docker', docsUrl: 'https://docs.n8n.io/', comandoStart: 'docker compose up -d' },
  { tipo: 'ComfyUI', nome: 'ComfyUI', descricao: 'Pipeline visual pra geração de imagens (SDXL/Flux)', porta: '8188', url: 'http://localhost:8188', tecnologia: 'python', docsUrl: 'https://github.com/comfyanonymous/ComfyUI', comandoStart: 'python main.py --listen' },
  { tipo: 'Stable Diffusion', nome: 'A1111 WebUI', descricao: 'WebUI clássico da Automatic1111 pra SD', porta: '7860', url: 'http://localhost:7860', tecnologia: 'python', docsUrl: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', comandoStart: './webui.sh --listen' },
  { tipo: 'Postgres', nome: 'Postgres', descricao: 'Banco relacional', porta: '5432', url: '', tecnologia: 'docker', docsUrl: 'https://www.postgresql.org/docs/', comandoStart: 'docker compose up -d postgres' },
  { tipo: 'Redis', nome: 'Redis', descricao: 'Cache/queue in-memory', porta: '6379', url: '', tecnologia: 'docker', docsUrl: 'https://redis.io/docs/', comandoStart: 'docker compose up -d redis' },
  { tipo: 'Plex', nome: 'Plex', descricao: 'Servidor de mídia (filmes, séries, música)', porta: '32400', url: 'http://localhost:32400/web', tecnologia: 'docker', docsUrl: 'https://support.plex.tv/', comandoStart: 'docker compose up -d plex' },
  { tipo: 'Home Assistant', nome: 'Home Assistant', descricao: 'Automação residencial (IoT)', porta: '8123', url: 'http://localhost:8123', tecnologia: 'docker', docsUrl: 'https://www.home-assistant.io/docs/', comandoStart: 'docker compose up -d homeassistant' },
];

const TECNOLOGIAS = [
  { value: 'docker', label: 'Docker / Compose' },
  { value: 'native', label: 'Nativo / Binário' },
  { value: 'python', label: 'Python (venv/pip)' },
  { value: 'node', label: 'Node (npm/pnpm)' },
  { value: 'systemd', label: 'systemd' },
  { value: 'cloud', label: 'Serviço gerenciado' },
  { value: 'outro', label: 'Outro' },
];

const MOEDAS = ['BRL', 'USD', 'EUR'];

function fmtMoeda(v: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(v);
  } catch {
    return `${moeda} ${v.toFixed(2)}`;
  }
}

// URL exibível: prefere url explícita, senão monta a partir de host + porta.
function urlExibivel(s: Servidor): string {
  if (s.url) return s.url;
  if (s.host || s.porta) {
    const h = s.host || 'localhost';
    return s.porta ? `${h}:${s.porta}` : h;
  }
  return '';
}

// Texto curto de localização: ambiente + tecnologia, separados por bullet.
function localTxt(s: Servidor, ambienteLabel: string, tecLabel: string): string {
  const parts = [ambienteLabel];
  if (tecLabel) parts.push(tecLabel);
  return parts.filter(Boolean).join(' · ');
}

// ─── Display helpers do monitoramento ─────────────────────────────────────────

interface PingDisplay {
  cor: string;
  rotulo: string;
  tooltip: React.ReactNode;
}

function tempoRelativo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'agora';
  if (diff < 60_000) return `há ${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)}min`;
  return `há ${Math.round(diff / 3_600_000)}h`;
}

// Converte um PingResult numa representação visual coerente com o tema.
// Centralizado pra usar igual no card, no detalhe e — quando der — no widget.
function pingDisplay(ping: PingResult | undefined, t: ReturnType<typeof useTokens>): PingDisplay {
  if (!ping) {
    return { cor: t.textTertiary, rotulo: 'não verificado', tooltip: 'Clique pra pingar este servidor agora.' };
  }
  switch (ping.status) {
    case 'online':
      return {
        cor: t.accents.sage,
        rotulo: 'online',
        tooltip: (
          <div>
            <strong>Online</strong> · respondeu em {ping.latenciaMs}ms<br />
            Verificado {tempoRelativo(ping.verificadoEm)}
          </div>
        ),
      };
    case 'offline':
      return {
        cor: t.accents.rose,
        rotulo: 'offline',
        tooltip: (
          <div>
            <strong>Sem resposta</strong><br />
            {ping.erro || 'O endpoint não respondeu.'}<br />
            <span style={{ opacity: 0.7 }}>Verificado {tempoRelativo(ping.verificadoEm)}</span>
          </div>
        ),
      };
    case 'bloqueado_mixed':
      return {
        cor: t.accents.clay,
        rotulo: 'bloqueado',
        tooltip: ping.erro || 'Mixed content: o Forja em HTTPS não consegue pingar HTTP. Abra o servidor manualmente.',
      };
    case 'sem_url':
      return { cor: t.textTertiary, rotulo: 'sem URL', tooltip: 'Sem URL ou host:porta cadastrado — não é possível monitorar.' };
    case 'verificando':
    default:
      return { cor: t.accents.lavender, rotulo: 'verificando…', tooltip: 'Pingando o endpoint…' };
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ServidoresPanel({ onAbrirCofre }: { onAbrirCofre?: (label?: string) => void } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroAmbiente, setFiltroAmbiente] = useState<string>('todos');

  const [detalhe, setDetalhe] = useState<Servidor | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Servidor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  // Monitoramento — estado volátil (não persiste), atualizado a cada ping.
  // id → resultado do ping. Servidores ausentes do mapa = nunca pingados.
  const [pings, setPings] = useState<Record<string, PingResult>>({});
  const [verificandoTodos, setVerificandoTodos] = useState(false);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('servidoresList')
      .then((r) => { if (r.ok && r.data) setServidores(r.data as Servidor[]); })
      .catch(() => { /* preview offline */ })
      .finally(() => setLoading(false));
  };

  // Pinga todos os servidores em paralelo (helper com cap de concorrência).
  // Marca como 'verificando' antes pra UI dar feedback visual instantâneo.
  const verificarTodos = useCallback(async (lista: Servidor[]) => {
    if (lista.length === 0) return;
    setVerificandoTodos(true);
    setPings((prev) => {
      const next = { ...prev };
      for (const s of lista) {
        next[s.id] = { status: 'verificando', verificadoEm: Date.now() };
      }
      return next;
    });
    const mapa = await pingMuitos(lista, 5000, 6);
    setPings((prev) => {
      const next = { ...prev };
      mapa.forEach((r, id) => { next[id] = r; });
      return next;
    });
    setVerificandoTodos(false);
  }, []);

  const verificarUm = useCallback(async (s: Servidor) => {
    setPings((prev) => ({ ...prev, [s.id]: { status: 'verificando', verificadoEm: Date.now() } }));
    const r = await pingServidor(s, 5000);
    setPings((prev) => ({ ...prev, [s.id]: r }));
  }, []);

  useEffect(() => {
    carregar();
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((r) => { if (r.ok && r.data) setSistemas(r.data); })
      .catch(() => { /* preview */ });
  }, []);

  // Auto-ping ao carregar a lista pela primeira vez (UX: já mostra status sem
  // o user precisar clicar). Só roda quando a lista REALMENTE chega.
  useEffect(() => {
    if (!loading && servidores.length > 0 && Object.keys(pings).length === 0) {
      verificarTodos(servidores);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, servidores.length]);

  const copiarTexto = (txt: string) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt)
      .then(() => message.success('Copiado'))
      .catch(() => { /* clipboard indisponível */ });
  };

  const abrirNova = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'rodando',
      ambiente: 'local',
      tecnologia: 'docker',
      moeda: 'BRL',
      custoMensal: 0,
      paths: [],
    });
    setModalAberto(true);
  };

  const abrirEditar = (s: Servidor) => {
    setEditando(s);
    form.setFieldsValue({
      nome: s.nome,
      tipo: s.tipo,
      descricao: s.descricao,
      status: s.status || 'rodando',
      host: s.host,
      porta: s.porta,
      url: s.url,
      ambiente: s.ambiente || 'local',
      tecnologia: s.tecnologia || '',
      sistemaId: s.sistemaId || undefined,
      comandoStart: s.comandoStart,
      paths: Array.isArray(s.paths) ? s.paths : [],
      dependencias: s.dependencias,
      recursos: s.recursos,
      custoMensal: s.custoMensal || 0,
      moeda: s.moeda || 'BRL',
      docsUrl: s.docsUrl,
      cofreLabel: s.cofreLabel,
      tags: s.tags,
      notas: s.notas,
    });
    setModalAberto(true);
  };

  const aplicarPreset = (p: Preset) => {
    form.setFieldsValue({
      nome: p.nome,
      tipo: p.tipo,
      descricao: p.descricao,
      porta: p.porta,
      url: p.url,
      tecnologia: p.tecnologia,
      docsUrl: p.docsUrl,
      comandoStart: p.comandoStart || '',
    });
    message.success(`Preset "${p.nome}" aplicado — ajuste o que precisar`);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const payload = {
        id: editando?.id,
        nome: v.nome,
        tipo: v.tipo || '',
        descricao: v.descricao || '',
        status: v.status || 'rodando',
        host: v.host || '',
        porta: v.porta ? String(v.porta) : '',
        url: v.url || '',
        ambiente: v.ambiente || 'local',
        tecnologia: v.tecnologia || '',
        sistemaId: v.sistemaId || '',
        comandoStart: v.comandoStart || '',
        paths: Array.isArray(v.paths) ? v.paths : [],
        dependencias: v.dependencias || '',
        recursos: v.recursos || '',
        custoMensal: v.custoMensal || 0,
        moeda: v.moeda || 'BRL',
        docsUrl: v.docsUrl || '',
        cofreLabel: v.cofreLabel || '',
        tags: v.tags || '',
        notas: v.notas || '',
      };
      const r = await callServer<ServerResult>('servidoresSave', payload);
      if (r.ok) {
        message.success(editando ? 'Servidor atualizado' : 'Servidor cadastrado');
        setModalAberto(false);
        setEditando(null);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  const remover = async (id: string) => {
    const r = await callServer<ServerResult>('servidoresDelete', id);
    if (r.ok) { message.success('Servidor removido'); setServidores((cs) => cs.filter((c) => c.id !== id)); }
    else message.error(r.error || 'Erro');
  };

  // ─── Derivados ─────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return servidores.filter((s) => {
      if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false;
      if (filtroAmbiente !== 'todos' && s.ambiente !== filtroAmbiente) return false;
      if (!q) return true;
      return (
        s.nome.toLowerCase().indexOf(q) >= 0 ||
        (s.tipo || '').toLowerCase().indexOf(q) >= 0 ||
        (s.descricao || '').toLowerCase().indexOf(q) >= 0 ||
        (s.tags || '').toLowerCase().indexOf(q) >= 0 ||
        (s.host || '').toLowerCase().indexOf(q) >= 0 ||
        urlExibivel(s).toLowerCase().indexOf(q) >= 0
      );
    });
  }, [servidores, busca, filtroStatus, filtroAmbiente]);

  const resumo = useMemo(() => {
    const total = servidores.length;
    const rodando = servidores.filter((s) => s.status === 'rodando').length;
    const erro = servidores.filter((s) => s.status === 'erro').length;
    // Contagens do monitoramento ao vivo (ping). Servidores sem URL não entram
    // no denominador "monitoráveis" — não dá pra pingar sem alvo.
    let online = 0;
    let offline = 0;
    let monitoraveis = 0;
    for (const s of servidores) {
      if (!urlPingavel(s)) continue;
      monitoraveis++;
      const p = pings[s.id];
      if (p?.status === 'online') online++;
      else if (p?.status === 'offline' || p?.status === 'bloqueado_mixed') offline++;
    }
    const porMoeda: Record<string, number> = {};
    for (const s of servidores) {
      const v = s.custoMensal || 0;
      if (v > 0) porMoeda[s.moeda || 'BRL'] = (porMoeda[s.moeda || 'BRL'] || 0) + v;
    }
    return { total, rodando, erro, porMoeda, online, offline, monitoraveis };
  }, [servidores, pings]);

  const custoTxt = Object.keys(resumo.porMoeda).length
    ? Object.entries(resumo.porMoeda).map(([m, v]) => fmtMoeda(v, m)).join(' + ')
    : '—';

  const nomeSistema = (id?: string) => {
    if (!id) return '';
    const s = sistemas.find((x) => x.id === id);
    return s ? s.nome : '';
  };

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 24 }} />;

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      {/* Banner contextual — explica o que entra aqui (não confundir com Hospedagem) */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: `${t.accents.sage}10`, border: `1px solid ${t.accents.sage}33`,
        borderRadius: 12, padding: 14, marginBottom: 16,
      }}>
        <ServerIcon size={16} color={t.accents.sage} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6 }}>
          Inventário das <strong style={{ color: t.text }}>instâncias que você roda</strong>: proxies LLM (LiteLLM, Ollama), automações (n8n),
          mística (ComfyUI, SD), bancos (Postgres, Redis), workers, self-hosted (Plex, Home Assistant).
          Senhas e API keys vão pro <strong style={{ color: t.text }}>Cofre</strong> — aqui ficam só os metadados.
        </div>
      </div>

      {/* Header + ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
          {resumo.total} {resumo.total === 1 ? 'servidor cadastrado' : 'servidores cadastrados'}
          {resumo.monitoraveis > 0 && (
            <span> · {resumo.online}/{resumo.monitoraveis} online ao vivo</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {resumo.monitoraveis > 0 && (
            <Tooltip title="Re-pinga todos os servidores com URL ou host:porta no browser. Localhost só funciona se você abrir o app na mesma máquina onde rodam.">
              <Button
                icon={<RefreshCcw size={14} className={verificandoTodos ? 'forja-spin' : ''} />}
                loading={verificandoTodos}
                onClick={() => verificarTodos(servidores)}
              >
                Verificar todos
              </Button>
            </Tooltip>
          )}
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Adicionar servidor</Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatTile titulo="Total" valor={String(resumo.total)} sub={`${resumo.rodando} marcados como rodando`} icon={<ServerIcon size={16} />} cor={t.accents.lavender} />
        <StatTile
          titulo="Online ao vivo"
          valor={resumo.monitoraveis > 0 ? `${resumo.online}/${resumo.monitoraveis}` : '—'}
          sub={resumo.monitoraveis === 0 ? 'cadastre uma URL pra pingar' : resumo.online === resumo.monitoraveis ? 'tudo no ar agora' : `${resumo.offline} sem resposta`}
          icon={resumo.online === resumo.monitoraveis && resumo.monitoraveis > 0 ? <Wifi size={16} /> : <WifiOff size={16} />}
          cor={resumo.monitoraveis === 0 ? t.textTertiary : resumo.online === resumo.monitoraveis ? t.accents.sage : t.accents.rose}
        />
        <StatTile titulo="Com erro" valor={String(resumo.erro)} sub={resumo.erro === 0 ? 'tudo tranquilo' : 'precisa olhar'} icon={<AlertTriangle size={16} />} cor={resumo.erro > 0 ? t.accents.rose : t.accents.sage} />
        <StatTile titulo="Custo mensal" valor={custoTxt} sub="instâncias pagas (recorrentes)" icon={<Cpu size={16} />} cor={t.accents.peach} />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por nome, tipo, host, tag…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 200 }}
        />
        <Select
          value={filtroAmbiente}
          onChange={setFiltroAmbiente}
          style={{ width: 160 }}
          options={[
            { value: 'todos', label: 'Todos ambientes' },
            ...Object.entries(AMBIENTE).map(([k, v]) => ({ value: k, label: v.label })),
          ]}
        />
        <Segmented
          value={filtroStatus}
          onChange={(v) => setFiltroStatus(v as string)}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'rodando', label: 'Rodando' },
            { value: 'dev', label: 'Dev' },
            { value: 'parado', label: 'Parado' },
            { value: 'erro', label: 'Erro' },
          ]}
        />
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: t.textSecondary, fontFamily: FONTS.ui }}>
              {servidores.length === 0
                ? 'Nenhum servidor cadastrado ainda. Comece pelo seu proxy LLM, automação ou banco local.'
                : 'Nenhum servidor combina com os filtros.'}
            </span>
          }
        >
          {servidores.length === 0 && (
            <Button type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Adicionar servidor</Button>
          )}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12 }}>
          {filtrados.map((s) => (
            <ServidorCard
              key={s.id}
              servidor={s}
              sistemaNome={nomeSistema(s.sistemaId)}
              ping={pings[s.id]}
              onAbrir={() => setDetalhe(s)}
              onPingar={() => verificarUm(s)}
            />
          ))}
        </div>
      )}

      {/* Modal de detalhe (visão limpa, sem empurrar a lista) */}
      <Modal
        open={!!detalhe}
        onCancel={() => setDetalhe(null)}
        footer={null}
        width={620}
        title={detalhe ? (() => {
          const st = STATUS[detalhe.status] || STATUS.parado;
          const IconeTipo = iconePorTipo(detalhe.tipo);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingRight: 28 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: `${t.accents.sage}1f`, color: t.accents.sage, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconeTipo size={18} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detalhe.nome}
                </div>
                {detalhe.tipo && (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{detalhe.tipo}</div>
                )}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: `${st.cor}1a`, color: st.cor, borderRadius: 999, padding: '4px 11px', fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />
                {st.label}
              </span>
            </div>
          );
        })() : null}
      >
        {detalhe && (
          <ServidorDetalhe
            servidor={detalhe}
            sistemaNome={nomeSistema(detalhe.sistemaId)}
            ping={pings[detalhe.id]}
            onPingar={() => verificarUm(detalhe)}
            onCopiar={copiarTexto}
            onEditar={() => { setDetalhe(null); abrirEditar(detalhe); }}
            onRemover={() => { remover(detalhe.id); setDetalhe(null); }}
            onAbrirCofre={onAbrirCofre ? (label?: string) => { onAbrirCofre(label); setDetalhe(null); } : undefined}
          />
        )}
      </Modal>

      {/* Modal cadastro/edição */}
      <Modal
        open={modalAberto}
        onCancel={() => { setModalAberto(false); setEditando(null); }}
        onOk={salvar}
        okText={editando ? 'Salvar alterações' : 'Cadastrar servidor'}
        cancelText="Cancelar"
        confirmLoading={salvando}
        title={editando ? `Editar: ${editando.nome}` : 'Novo servidor'}
        width={700}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          {/* Presets — só na criação */}
          {!editando && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
                Atalho — escolha um tipo pra preencher automático:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 102, overflowY: 'auto' }}>
                {PRESETS.map((p) => {
                  const Ic = iconePorTipo(p.tipo);
                  return (
                    <button
                      key={p.nome}
                      onClick={() => aplicarPreset(p)}
                      type="button"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                        background: `${t.accents.sage}10`, border: `1px solid ${t.accents.sage}33`,
                        color: t.text, fontFamily: FONTS.ui, fontSize: 12,
                      }}
                    >
                      <Ic size={13} color={t.accents.sage} strokeWidth={1.8} />
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção: Identidade */}
          <SecaoForm titulo="Identidade" icon={<Sparkles size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
              <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
                <Input placeholder="ex.: LiteLLM Proxy Local" />
              </Form.Item>
              <Form.Item name="tipo" label="Tipo / categoria">
                <Input placeholder="ex.: LiteLLM, Ollama, n8n…" />
              </Form.Item>
            </div>
            <Form.Item name="descricao" label="Descrição (o que faz, pra que serve)">
              <Input.TextArea rows={2} placeholder="Resumo curto do papel desse servidor" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Form.Item name="status" label="Status">
                <Select options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
              <Form.Item name="ambiente" label="Ambiente">
                <Select options={Object.entries(AMBIENTE).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
              <Form.Item name="tecnologia" label="Tecnologia">
                <Select allowClear options={TECNOLOGIAS} />
              </Form.Item>
            </div>
            <Form.Item name="sistemaId" label="Vinculado a sistema (opcional)" extra="Se este servidor é usado por um app da Forja, vincule pra ver junto.">
              <Select allowClear showSearch optionFilterProp="label"
                options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
            </Form.Item>
          </SecaoForm>

          {/* Seção: Conexão */}
          <SecaoForm titulo="Conexão" icon={<Globe size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 12 }}>
              <Form.Item name="host" label="Host">
                <Input placeholder="localhost, 192.168.0.10, api.dominio.com" />
              </Form.Item>
              <Form.Item name="porta" label="Porta">
                <Input placeholder="4000" />
              </Form.Item>
            </div>
            <Form.Item name="url" label="URL completa (opcional)" extra="Se preencher, sobrescreve host:porta nos botões 'Abrir'.">
              <Input placeholder="http://localhost:4000" />
            </Form.Item>
          </SecaoForm>

          {/* Seção: Operação */}
          <SecaoForm titulo="Operação" icon={<Terminal size={13} />}>
            <Form.Item name="comandoStart" label="Comando para subir" extra="O que você roda no terminal pra dar start. Vai ter botão de copiar no detalhe.">
              <Input.TextArea rows={2} placeholder="docker compose up -d   ou   ollama serve" style={{ fontFamily: FONTS.mono, fontSize: 12 }} />
            </Form.Item>
            <Form.List name="paths">
              {(fields, { add, remove }) => (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, marginBottom: 6 }}>
                    Paths importantes
                    <span style={{ color: t.textTertiary, fontWeight: 400 }}> — config, logs, dados, etc.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fields.map((field) => (
                      <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.6fr auto', gap: 8, alignItems: 'start' }}>
                        <Form.Item {...field} key={`${field.key}-label`} name={[field.name, 'label']} style={{ marginBottom: 0 }}>
                          <Input placeholder="rótulo (config, logs…)" />
                        </Form.Item>
                        <Form.Item {...field} key={`${field.key}-valor`} name={[field.name, 'valor']} style={{ marginBottom: 0 }}>
                          <Input placeholder="~/litellm/config.yaml" style={{ fontFamily: FONTS.mono, fontSize: 12 }} />
                        </Form.Item>
                        <Tooltip title="Remover">
                          <Button type="text" icon={<Trash2 size={14} />} danger onClick={() => remove(field.name)} />
                        </Tooltip>
                      </div>
                    ))}
                    <Button type="dashed" icon={<Plus size={14} />} onClick={() => add({ label: '', valor: '' })} style={{ alignSelf: 'flex-start' }}>
                      Adicionar path
                    </Button>
                  </div>
                </div>
              )}
            </Form.List>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="dependencias" label="Dependências" extra="separe por vírgula">
                <Input placeholder="Redis, Postgres, Ollama" />
              </Form.Item>
              <Form.Item name="recursos" label="Recursos" extra="ex.: 4 vCPU, 8GB RAM, 20GB SSD">
                <Input placeholder="4 vCPU, 8GB RAM" />
              </Form.Item>
            </div>
          </SecaoForm>

          {/* Seção: Custo & Manutenção */}
          <SecaoForm titulo="Custo & manutenção" icon={<Hammer size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 1.3fr', gap: 12 }}>
              <Form.Item name="custoMensal" label="Custo mensal">
                <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
              <Form.Item name="moeda" label="Moeda">
                <Select options={MOEDAS.map((m) => ({ value: m, label: m }))} />
              </Form.Item>
              <Form.Item name="docsUrl" label="Docs / referência">
                <Input placeholder="https://docs.litellm.ai/…" />
              </Form.Item>
            </div>
            <Form.Item name="cofreLabel" label="Label do segredo no Cofre" extra="Se este servidor tem API key/senha, anote aqui o label que você usou no Cofre.">
              <Input placeholder="ex.: LiteLLM master key" />
            </Form.Item>
          </SecaoForm>

          {/* Seção: Notas */}
          <SecaoForm titulo="Tags & notas" icon={<TagIcon size={13} />}>
            <Form.Item name="tags" label="Tags" extra="separe por vírgula">
              <Input placeholder="proxy, ia, producao" />
            </Form.Item>
            <Form.Item name="notas" label="Notas livres" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={3} placeholder="Truques, problemas conhecidos, atalhos…" />
            </Form.Item>
          </SecaoForm>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub: card de servidor ────────────────────────────────────────────────────
function ServidorCard({ servidor, sistemaNome, ping, onAbrir, onPingar }: {
  servidor: Servidor;
  sistemaNome: string;
  ping?: PingResult;
  onAbrir: () => void;
  onPingar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);
  const st = STATUS[servidor.status] || STATUS.parado;
  const amb = AMBIENTE[servidor.ambiente] || AMBIENTE.outro;
  const tecLabel = TECNOLOGIAS.find((x) => x.value === servidor.tecnologia)?.label || '';
  const IconeTipo = iconePorTipo(servidor.tipo);
  const url = urlExibivel(servidor);
  const monitoravel = !!urlPingavel(servidor);
  const pingInfo = pingDisplay(ping, t);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${hover ? `${st.cor}55` : t.border}`,
        borderRadius: 14, padding: '14px 16px',
        background: t.surface,
        boxShadow: hover ? t.shadow : t.shadowSoft,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 138,
      }}
    >
      {/* fio de cor no topo na cor do status — sinal sutil */}
      <span aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${st.cor}00, ${st.cor}cc, ${st.cor}00)`,
        opacity: 0.7,
      }} />

      {/* topo: ícone + nome + status pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${t.accents.sage}1f`, color: t.accents.sage,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <IconeTipo size={18} strokeWidth={1.7} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {servidor.nome}
          </div>
          {servidor.tipo && (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {servidor.tipo}
            </div>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: `${st.cor}1a`, color: st.cor, borderRadius: 999,
          padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.cor }} />
          {st.label}
        </span>
      </div>

      {/* descrição */}
      {servidor.descricao && (
        <div style={{
          fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {servidor.descricao}
        </div>
      )}

      {/* URL (se houver) — destacado em mono, com bolinha ao vivo se monitorável */}
      {url && (
        <Tooltip
          title={
            monitoravel
              ? pingInfo.tooltip
              : 'Sem URL ou host:porta — adicione pra monitorar online/offline.'
          }
          placement="top"
        >
          <div style={{
            fontFamily: FONTS.mono, fontSize: 11.5, color: t.textSecondary,
            background: t.surfaceMuted, border: `1px solid ${monitoravel ? `${pingInfo.cor}33` : t.borderSoft}`,
            borderRadius: 7, padding: '4px 9px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {monitoravel ? (
              <span
                aria-hidden
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: pingInfo.cor, flexShrink: 0,
                  boxShadow: ping?.status === 'online' ? `0 0 0 3px ${pingInfo.cor}22` : 'none',
                  animation: ping?.status === 'verificando' ? 'forjaPulse 1.2s ease-in-out infinite' : 'none',
                }}
              />
            ) : (
              <Globe size={11} color={t.textTertiary} style={{ flexShrink: 0 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{url}</span>
            {monitoravel && (
              <Button
                type="text"
                size="small"
                icon={<RefreshCcw size={10} className={ping?.status === 'verificando' ? 'forja-spin' : ''} />}
                onClick={(e) => { e.stopPropagation(); onPingar(); }}
                style={{ width: 18, height: 18, padding: 0, color: t.textTertiary }}
              />
            )}
          </div>
        </Tooltip>
      )}

      {/* rodapé: ambiente + tecnologia + custo, ou sistema vinculado */}
      <div style={{
        marginTop: 'auto', paddingTop: 8,
        borderTop: `1px solid ${t.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
          <amb.icon size={11} />
          {localTxt(servidor, amb.label, tecLabel)}
        </span>
        {sistemaNome && (
          <Tooltip title={`Usado por: ${sistemaNome}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, background: `${t.accents.blue}10`, border: `1px solid ${t.accents.blue}33`, padding: '1px 7px', borderRadius: 999 }}>
              <Box size={10} color={t.accents.blue} />
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sistemaNome}</span>
            </span>
          </Tooltip>
        )}
        <span style={{ flex: 1 }} />
        {servidor.custoMensal > 0 && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {fmtMoeda(servidor.custoMensal, servidor.moeda)}<span style={{ color: t.textTertiary }}>/mês</span>
          </span>
        )}
        <ChevronRight size={14} color={t.textTertiary} style={{ opacity: hover ? 1 : 0.4, transform: hover ? 'translateX(2px)' : 'none', transition: 'all 0.15s' }} />
      </div>
    </div>
  );
}

// ─── Sub: detalhe (modal aberto) ──────────────────────────────────────────────
function ServidorDetalhe({ servidor, sistemaNome, ping, onPingar, onCopiar, onEditar, onRemover, onAbrirCofre }: {
  servidor: Servidor;
  sistemaNome: string;
  ping?: PingResult;
  onPingar: () => void;
  onCopiar: (s: string) => void;
  onEditar: () => void;
  onRemover: () => void;
  onAbrirCofre?: (label?: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const amb = AMBIENTE[servidor.ambiente] || AMBIENTE.outro;
  const tecLabel = TECNOLOGIAS.find((x) => x.value === servidor.tecnologia)?.label || '';
  const url = urlExibivel(servidor);
  const fullUrl = servidor.url || (url ? (url.startsWith('http') ? url : `http://${url}`) : '');
  const monitoravel = !!urlPingavel(servidor);
  const pingInfo = pingDisplay(ping, t);
  const verificando = ping?.status === 'verificando';

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner do status ao vivo — primeira coisa que o user vê */}
      {monitoravel && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: `${pingInfo.cor}10`, border: `1px solid ${pingInfo.cor}44`,
          borderRadius: 11, padding: '10px 14px',
        }}>
          <span
            aria-hidden
            style={{
              width: 10, height: 10, borderRadius: '50%', background: pingInfo.cor,
              flexShrink: 0,
              boxShadow: ping?.status === 'online' ? `0 0 0 4px ${pingInfo.cor}22` : 'none',
              animation: verificando ? 'forjaPulse 1.2s ease-in-out infinite' : 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: pingInfo.cor, textTransform: 'capitalize' }}>
              {pingInfo.rotulo}
              {ping?.status === 'online' && ping.latenciaMs !== undefined && (
                <span style={{ marginLeft: 8, color: t.textTertiary, fontWeight: 400 }}>
                  · {ping.latenciaMs}ms
                </span>
              )}
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
              {ping ? `Verificado ${tempoRelativo(ping.verificadoEm)}` : 'Ainda não verificado'}
              {ping?.erro && ping.status !== 'online' && (
                <span style={{ marginLeft: 6 }}>· {ping.erro}</span>
              )}
            </div>
          </div>
          <Button
            size="small"
            icon={<RefreshCcw size={12} className={verificando ? 'forja-spin' : ''} />}
            onClick={onPingar}
            loading={verificando}
          >
            Pingar agora
          </Button>
        </div>
      )}

      {!monitoravel && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: t.surfaceMuted, border: `1px dashed ${t.border}`,
          borderRadius: 11, padding: '10px 14px',
          fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary,
        }}>
          <HelpCircle size={14} color={t.textTertiary} />
          Cadastre uma URL ou host + porta pra monitorar online/offline.
        </div>
      )}

      {/* descrição */}
      {servidor.descricao && (
        <div style={{
          fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6,
          borderLeft: `2px solid ${t.accents.sage}66`, paddingLeft: 11,
        }}>
          {servidor.descricao}
        </div>
      )}

      {/* URL com botão copiar/abrir */}
      {url && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: t.surfaceMuted, border: `1px solid ${t.border}`,
          borderRadius: 10, padding: '8px 11px',
        }}>
          <Globe size={14} color={t.accents.sage} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 12.5, color: t.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {url}
          </span>
          <Tooltip title="Copiar URL">
            <Button size="small" type="text" icon={<Copy size={13} />} onClick={() => onCopiar(url)} />
          </Tooltip>
          {fullUrl && (
            <Tooltip title="Abrir no navegador">
              <Button size="small" type="text" icon={<ExternalLink size={13} />} href={fullUrl} target="_blank" rel="noopener noreferrer" />
            </Tooltip>
          )}
        </div>
      )}

      {/* Grade de metadados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
        <Campo label="Ambiente" valor={amb.label} icon={<amb.icon size={11} />} />
        <Campo label="Tecnologia" valor={tecLabel || '—'} />
        <Campo label="Host" valor={servidor.host || '—'} mono />
        <Campo label="Porta" valor={servidor.porta || '—'} mono />
        {sistemaNome && <Campo label="Sistema vinculado" valor={sistemaNome} />}
        {servidor.custoMensal > 0 && <Campo label="Custo / mês" valor={fmtMoeda(servidor.custoMensal, servidor.moeda)} />}
      </div>

      {/* Comando start */}
      {servidor.comandoStart && (
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Terminal size={11} /> Comando para subir
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#16181C', border: `1px solid ${t.borderSoft}`,
            borderRadius: 9, padding: '10px 12px',
          }}>
            <code style={{
              flex: 1, fontFamily: FONTS.mono, fontSize: 12.5, color: '#E8E5DF',
              lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {servidor.comandoStart}
            </code>
            <Tooltip title="Copiar">
              <Button size="small" type="text" icon={<Copy size={13} />} onClick={() => onCopiar(servidor.comandoStart)} style={{ color: '#E8E5DF' }} />
            </Tooltip>
          </div>
        </div>
      )}

      {/* Paths */}
      {Array.isArray(servidor.paths) && servidor.paths.length > 0 && (
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
            Paths importantes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {servidor.paths.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: FONTS.mono, fontSize: 12, color: t.textSecondary,
                background: t.surfaceMuted, borderRadius: 7, padding: '5px 10px',
              }}>
                {p.label && (
                  <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, color: t.accents.sage, background: `${t.accents.sage}14`, padding: '1px 7px', borderRadius: 999, flexShrink: 0 }}>
                    {p.label}
                  </span>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.valor}</span>
                <Tooltip title="Copiar"><Button size="small" type="text" icon={<Copy size={12} />} onClick={() => onCopiar(p.valor)} /></Tooltip>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependências + recursos */}
      {(servidor.dependencias || servidor.recursos) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {servidor.dependencias && (
            <div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>Dependências</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {servidor.dependencias.split(',').map((x) => x.trim()).filter(Boolean).map((d) => (
                  <span key={d} style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '2px 8px' }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {servidor.recursos && (
            <div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>Recursos</div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text }}>{servidor.recursos}</div>
            </div>
          )}
        </div>
      )}

      {/* Notas */}
      {servidor.notas && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, borderLeft: `2px solid ${t.borderSoft}`, paddingLeft: 11 }}>{servidor.notas}</div>
      )}

      {/* Tags */}
      {servidor.tags && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {servidor.tags.split(',').map((x) => x.trim()).filter(Boolean).map((tag) => (
            <span key={tag} style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: '2px 7px' }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: `1px solid ${t.borderSoft}` }}>
        {fullUrl && (
          <Button size="small" icon={<ExternalLink size={13} />} href={fullUrl} target="_blank" rel="noopener noreferrer">Abrir</Button>
        )}
        {servidor.docsUrl && (
          <Button size="small" icon={<BookOpen size={13} />} href={servidor.docsUrl} target="_blank" rel="noopener noreferrer">Docs</Button>
        )}
        {servidor.cofreLabel && onAbrirCofre && (
          <Tooltip title={`Ver no Cofre: ${servidor.cofreLabel}`}>
            <Button size="small" icon={<ShieldCheck size={13} />} onClick={() => onAbrirCofre(servidor.cofreLabel)}>Cofre</Button>
          </Tooltip>
        )}
        <Button size="small" icon={<Pencil size={13} />} onClick={onEditar}>Editar</Button>
        <span style={{ flex: 1 }} />
        <Popconfirm title="Remover este servidor?" onConfirm={onRemover} okText="Remover" cancelText="Cancelar">
          <Button size="small" danger icon={<Trash2 size={13} />}>Remover</Button>
        </Popconfirm>
      </div>
    </div>
  );
}

// ─── Sub: seção do form (header + container coeso) ────────────────────────────
function SecaoForm({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ color: t.accents.sage, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          {titulo}
        </span>
        <span style={{ flex: 1, height: 1, background: t.borderSoft, marginLeft: 4 }} />
      </div>
      {children}
    </div>
  );
}

// ─── Sub: campo label/valor (modal detalhe) ──────────────────────────────────
function Campo({ label, valor, mono, icon }: { label: string; valor: string; mono?: boolean; icon?: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}{label}
      </div>
      <div style={{
        fontFamily: mono ? FONTS.mono : FONTS.ui, fontSize: mono ? 12.5 : 13,
        color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {valor}
      </div>
    </div>
  );
}

// ─── Sub: stat tile (igual ao do ContasPanel pra coerência visual) ────────────
function StatTile({ titulo, valor, sub, icon, cor }: {
  titulo: string; valor: string; sub: string; icon: React.ReactNode; cor: string;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div
      className="forja-lift"
      style={{
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px',
        background: t.surface, boxShadow: t.shadowSoft,
        display: 'flex', flexDirection: 'column', gap: 11,
      }}
    >
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${cor}00, ${cor}cc, ${cor}00)`, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{titulo}</span>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${cor}1f`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontFamily: FONTS.display, fontSize: 23, fontWeight: 600, color: t.text, lineHeight: 1.1, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}
