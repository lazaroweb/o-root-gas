// Painel de dívida técnica (v1.147.0) — escaneia repo GitHub procurando
// 4 padrões: TODO, FIXME, HACK (texto livre) + DEBT(area,sev) estruturado.
// Cada item fica linkado ao arquivo:linha e pode ser promovido pra backlog.
// Sync acontece automaticamente ao montar (com cache por commit SHA pra ser barato).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { App as AntApp, Button, Tooltip, Tag, Empty, Spin, Popconfirm, Segmented, Input, Drawer } from 'antd';
import {
  AlertTriangle, ExternalLink, RefreshCw, Bug, Flame, ListChecks, FileCode2,
  CheckCircle2, ArrowUpRight, Search, ShieldAlert, Eye, Hash, GitBranch, Calendar, Copy,
  Trash2, Sparkles,
} from 'lucide-react';
import { Panel } from './ui';
import ProcessoCarregando from './ProcessoCarregando';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type {
  DebitoTecnico, DebitoSyncResult, DebitoTipo, DebitoStatus,
  ServerResult,
} from '../types';

interface Props {
  sistemaId: string;
  repoUrl?: string;
  scriptId?: string; // v1.149.0 — fallback pra GAS sem repoUrl (mesma lógica da auditoria)
  onPromovido?: () => void; // pra dar refresh no badge do Backlog
}

// Visual por tipo: ícone, cor de accent, label curta.
const TIPO_META: Record<DebitoTipo, { Icon: typeof Bug; label: string; corKey: 'rose' | 'peach' | 'lavender' | 'blue' }> = {
  debt:  { Icon: ShieldAlert, label: 'Dívida', corKey: 'rose' },
  fixme: { Icon: Bug,         label: 'FIXME',  corKey: 'rose' },
  hack:  { Icon: Flame,       label: 'HACK',   corKey: 'peach' },
  todo:  { Icon: ListChecks,  label: 'TODO',   corKey: 'blue' },
};

const SEV_META: Record<string, { label: string; corKey: 'rose' | 'peach' | 'sage' }> = {
  alta:  { label: 'alta',  corKey: 'rose' },
  media: { label: 'média', corKey: 'peach' },
  baixa: { label: 'baixa', corKey: 'sage' },
};

// v1.148.8 — contexto do código no entorno do débito (retornado por getDebitoContexto).
interface DebitoContexto {
  fonte: 'github' | 'gas';
  arquivo: string;
  linha: number;
  urlArquivo: string;
  urlLinha: string;
  contextoInicio: number; // número da primeira linha do contexto (1-indexed)
  contextoLinhas: string[]; // ~13 linhas (6 antes + linha + 6 depois)
  linhaDestaqueIdx: number; // índice da linha do débito dentro de contextoLinhas
  linhaCompleta: string; // linha do débito sem truncar (texto integral)
  totalLinhas: number;
  branch: string;
}

function formatarData(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias}d`;
  if (dias < 30) return `há ${Math.floor(dias / 7)}sem`;
  if (dias < 365) return `há ${Math.floor(dias / 30)}m`;
  return `há ${Math.floor(dias / 365)}a`;
}

export default function DividaTecnicaPanel({ sistemaId, repoUrl, scriptId, onPromovido }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [itens, setItens] = useState<DebitoTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<DebitoSyncResult | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'debt' | 'todo_fixme_hack' | 'promovidos' | 'pagos'>('todos');
  const [busca, setBusca] = useState('');

  // v1.148.8 — drawer de detalhes (contexto do código no entorno + ações).
  const [aberto, setAberto] = useState<DebitoTecnico | null>(null);
  const [contexto, setContexto] = useState<DebitoContexto | null>(null);
  const [carregandoCtx, setCarregandoCtx] = useState(false);
  const [erroCtx, setErroCtx] = useState<string>('');
  // v1.148.11 — prompt pronto pra IA (usado tanto pelo Drawer quanto pelo card).
  const [prompt, setPrompt] = useState<string>('');
  const [carregandoPrompt, setCarregandoPrompt] = useState(false);

  // Aceita qualquer fonte de código que a auditoria também aceita:
  // GitHub (repoUrl) ou Google Apps Script (scriptId).
  const temRepo = !!(repoUrl && repoUrl.trim());
  const temScript = !!(scriptId && scriptId.trim());
  const temCodigo = temRepo || temScript;
  const fonteLabel = temRepo ? 'GitHub' : temScript ? 'Apps Script' : '';

  const carregarLista = () => {
    setLoading(true);
    callServer<ServerResult>('getDebitosTecnicos', sistemaId)
      .then((r) => {
        if (r && r.ok && Array.isArray(r.data)) setItens(r.data as DebitoTecnico[]);
        else setItens([]);
      })
      .catch(() => setItens([]))
      .finally(() => setLoading(false));
  };

  // Auto-sync ao abrir: faz a sincronia em background depois do carregamento inicial.
  // Backend faz HEAD check barato e devolve `semMudanca` se nada mudou.
  const sincronizar = (forcar = false) => {
    if (!temCodigo) return;
    setSincronizando(true);
    callServer<ServerResult>('sincronizarDebitos', sistemaId, forcar)
      .then((r) => {
        if (r && r.ok && r.data) {
          const result = r.data as DebitoSyncResult;
          setUltimoSync(result);
          setItens(result.itensAtuais);
          if (!result.semMudanca && (result.novos > 0 || result.pagosAuto > 0)) {
            const partes: string[] = [];
            if (result.novos > 0) partes.push(`${result.novos} novo(s)`);
            if (result.pagosAuto > 0) partes.push(`${result.pagosAuto} pago(s) auto`);
            message.success(`Sincronizado · ${partes.join(' · ')}`);
          } else if (forcar) {
            message.success('Tudo em dia — sem mudanças no código.');
          }
        } else if (r && r.error) {
          message.error(r.error);
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Erro ao sincronizar'))
      .finally(() => setSincronizando(false));
  };

  useEffect(() => {
    carregarLista();
    // Auto-sync com pequeno delay pra UI montar primeiro (sensação de fresco
    // sem bloquear o render). Se HEAD não mudou, backend devolve cache instant.
    if (temCodigo) {
      const tid = setTimeout(() => sincronizar(false), 250);
      return () => clearTimeout(tid);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId, temCodigo]);

  // Filtro + busca aplicados.
  const filtrados = useMemo(() => {
    let lista = itens;
    if (filtroTipo === 'debt') lista = lista.filter((d) => d.status === 'ativo' && d.tipo === 'debt');
    else if (filtroTipo === 'todo_fixme_hack') lista = lista.filter((d) => d.status === 'ativo' && d.tipo !== 'debt');
    else if (filtroTipo === 'promovidos') lista = lista.filter((d) => d.status === 'promovido');
    else if (filtroTipo === 'pagos') lista = lista.filter((d) => d.status === 'pago');
    else lista = lista.filter((d) => d.status === 'ativo');
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((d) =>
        d.descricao.toLowerCase().includes(q)
        || d.arquivo.toLowerCase().includes(q)
        || (d.area || '').toLowerCase().includes(q),
      );
    }
    return lista;
  }, [itens, filtroTipo, busca]);

  // Resumo por tipo dos ATIVOS (pros segmented counts).
  // v1.148.9 — `fantasmas` = pagos que nunca foram promovidos (típico falso positivo
  // limpo automaticamente pelo scan — provável lixo, não trabalho real).
  const resumo = useMemo(() => {
    const ativos = itens.filter((d) => d.status === 'ativo');
    const pagos = itens.filter((d) => d.status === 'pago');
    return {
      total: ativos.length,
      debts: ativos.filter((d) => d.tipo === 'debt').length,
      livres: ativos.filter((d) => d.tipo !== 'debt').length,
      promovidos: itens.filter((d) => d.status === 'promovido').length,
      pagos: pagos.length,
      pagosReais: pagos.filter((d) => d.promovidoEm).length,
      fantasmas: pagos.filter((d) => !d.promovidoEm).length,
      alta: ativos.filter((d) => d.severidade === 'alta').length,
    };
  }, [itens]);

  const promover = async (d: DebitoTecnico) => {
    try {
      const r = await callServer<ServerResult>('promoverDebitoParaBacklog', d.id);
      if (r && r.ok) {
        message.success('Promovido pra Backlog — card criado em "A fazer".');
        carregarLista();
        if (onPromovido) onPromovido();
      } else {
        message.error((r && r.error) || 'Erro ao promover');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const marcarPago = async (d: DebitoTecnico) => {
    try {
      const r = await callServer<ServerResult>('marcarDebitoComoPago', d.id);
      if (r && r.ok) {
        message.success('Marcado como pago.');
        carregarLista();
        if (aberto?.id === d.id) setAberto(null);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  // v1.148.9 — apaga DEFINITIVAMENTE um débito (sem virar histórico).
  // Pensado pra falsos positivos do scan (bug de regex, exemplos em doc, etc).
  const apagar = async (d: DebitoTecnico) => {
    try {
      const r = await callServer<ServerResult>('apagarDebito', d.id);
      if (r && r.ok) {
        message.success('Débito apagado definitivamente.');
        carregarLista();
        if (aberto?.id === d.id) setAberto(null);
      } else {
        message.error((r && r.error) || 'Erro ao apagar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  // v1.148.9 — Limpeza em massa: apaga todos os 'pago' que nunca foram promovidos
  // (típico fantasma deixado pelo bug do regex v1.148.7 que foi corrigido em v1.148.8).
  const [limpandoFantasmas, setLimpandoFantasmas] = useState(false);
  const limparFantasmas = async () => {
    setLimpandoFantasmas(true);
    try {
      const r = await callServer<ServerResult>('apagarDebitosPagosSemPromocao', sistemaId);
      if (r && r.ok && r.data) {
        const n = (r.data as { apagados: number }).apagados;
        if (n === 0) message.info('Nenhum fantasma pra apagar — todos os pagos têm rastro real de promoção.');
        else message.success(`${n} fantasma(s) apagado(s) definitivamente.`);
        carregarLista();
      } else {
        message.error((r && r.error) || 'Erro ao limpar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLimpandoFantasmas(false);
    }
  };

  const abrirDetalhe = useCallback((d: DebitoTecnico) => {
    setAberto(d);
    setContexto(null);
    setErroCtx('');
    setPrompt('');
    setCarregandoCtx(true);
    setCarregandoPrompt(true);
    // Busca contexto do código + prompt pra IA em paralelo (2 RPCs independentes).
    callServer<ServerResult>('getDebitoContexto', d.id)
      .then((r) => {
        if (r && r.ok && r.data) setContexto(r.data as DebitoContexto);
        else setErroCtx((r && r.error) || 'Não foi possível buscar o contexto.');
      })
      .catch((e) => setErroCtx(e instanceof Error ? e.message : 'Erro de rede'))
      .finally(() => setCarregandoCtx(false));
    callServer<ServerResult>('getPromptIADebito', d.id)
      .then((r) => {
        if (r && r.ok && r.data) setPrompt(String((r.data as { prompt?: string }).prompt || ''));
      })
      .catch(() => { /* drawer não bloqueia se prompt falhar */ })
      .finally(() => setCarregandoPrompt(false));
  }, []);

  if (!temCodigo) {
    return (
      <Panel padding={28}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sistema sem código auditável</div>
              <div>Cadastre o <code>repoUrl</code> (GitHub) ou <code>scriptId</code> (Google Apps Script) na ficha do sistema pra a Forja escanear TODO/FIXME/HACK/DEBT.</div>
            </div>
          }
        />
      </Panel>
    );
  }

  // Mensagem de etapa baseada na fonte — informa o usuário o que está rolando.
  const etapaSincronia = temRepo
    ? 'GitHub · baixando árvore + arquivos + parseando'
    : 'Apps Script · baixando projeto e parseando comentários';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* v1.148.4 — feedback visual obrigatório pra operação que demora.
          Sincronizar com GitHub pode levar 2-15s; o user precisa SABER que
          não travou. Aparece como banner inline acima do conteúdo. */}
      <ProcessoCarregando
        mostrar={sincronizando}
        mensagem={`Sincronizando dívida técnica com ${fonteLabel}…`}
        etapa={etapaSincronia}
        subtexto="pode levar alguns segundos na primeira vez · cache será reutilizado nas próximas"
      />

      {/* Header: contadores + ações */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: '12px 16px', boxShadow: t.shadowSoft,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{resumo.total}</span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>itens ativos</span>
        </div>
        <span style={{ width: 1, height: 28, background: t.borderSoft }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {resumo.debts > 0 && (
            <Tag bordered={false} style={{ background: `${t.accents.rose}1a`, color: t.accents.rose, fontWeight: 600 }}>
              <ShieldAlert size={11} style={{ marginRight: 4, verticalAlign: 'text-top' }} />
              {resumo.debts} dívida{resumo.debts > 1 ? 's' : ''}
            </Tag>
          )}
          {resumo.livres > 0 && (
            <Tag bordered={false} style={{ background: `${t.accents.blue}14`, color: t.accents.blue, fontWeight: 600 }}>
              <ListChecks size={11} style={{ marginRight: 4, verticalAlign: 'text-top' }} />
              {resumo.livres} TODO/FIXME/HACK
            </Tag>
          )}
          {resumo.alta > 0 && (
            <Tooltip title="Itens estruturados com severidade ALTA — atacar primeiro.">
              <Tag bordered={false} style={{ background: `${t.accents.rose}22`, color: t.accents.rose, fontWeight: 700 }}>
                <Flame size={11} style={{ marginRight: 4, verticalAlign: 'text-top' }} />
                {resumo.alta} alta
              </Tag>
            </Tooltip>
          )}
          {resumo.promovidos > 0 && (
            <Tag bordered={false} style={{ background: `${t.accents.lavender}14`, color: t.accents.lavender, fontWeight: 600 }}>
              <ArrowUpRight size={11} style={{ marginRight: 4, verticalAlign: 'text-top' }} />
              {resumo.promovidos} no backlog
            </Tag>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {ultimoSync && !sincronizando && (
            <Tooltip title={ultimoSync.semMudanca
              ? `${temRepo ? 'HEAD' : 'Snapshot'} continua em ${ultimoSync.scanSha} — não precisou re-escanear.`
              : `${ultimoSync.novos} novo(s) · ${ultimoSync.pagosAuto} pago(s) auto · ${ultimoSync.inalterados} mantido(s)`}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>
                {fonteLabel.toLowerCase()} {ultimoSync.scanSha}{ultimoSync.semMudanca ? ' · em dia' : ''}
              </span>
            </Tooltip>
          )}
          <Tooltip title="Re-escaneia o repositório agora (força mesmo se HEAD não mudou).">
            <Button
              size="small"
              icon={<RefreshCw size={13} className={sincronizando ? 'forja-spin' : undefined} />}
              loading={sincronizando}
              onClick={() => sincronizar(true)}
            >
              Sincronizar
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Segmented
          size="small"
          value={filtroTipo}
          onChange={(v) => setFiltroTipo(v as typeof filtroTipo)}
          options={[
            { value: 'todos', label: `Ativos (${resumo.total})` },
            { value: 'debt', label: `Dívida (${resumo.debts})` },
            { value: 'todo_fixme_hack', label: `TODO/FIXME (${resumo.livres})` },
            { value: 'promovidos', label: `Promovidos (${resumo.promovidos})` },
            { value: 'pagos', label: `Pagos (${resumo.pagos})` },
          ]}
        />
        <Input
          size="small"
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por arquivo, descrição, área…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      {/* v1.148.9 — Banner contextual quando há fantasmas (pagos sem promoção).
          Aparece SÓ na aba "Pagos" pra não poluir as outras visões. Princípio
          "alertas com ação": botão direto pra limpar em massa. */}
      {filtroTipo === 'pagos' && resumo.fantasmas > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: `${t.accents.peach}10`, border: `1px solid ${t.accents.peach}33`,
          borderRadius: 12, padding: '12px 16px',
        }}>
          <Sparkles size={18} color={t.accents.peach} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 600, marginBottom: 2 }}>
              {resumo.fantasmas} fantasma{resumo.fantasmas > 1 ? 's' : ''} detectado{resumo.fantasmas > 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
              {resumo.fantasmas === resumo.pagos ? 'Todos' : `${resumo.fantasmas} de ${resumo.pagos}`} pagos nunca passaram por promoção pra backlog —
              são típicos falsos positivos limpos automaticamente pelo scan
              (regex pegou bobeira ou comentário não era débito real).
              {resumo.pagosReais > 0 && ` Os outros ${resumo.pagosReais} foram trabalho de verdade e ficam preservados.`}
            </div>
          </div>
          <Popconfirm
            title={`Apagar ${resumo.fantasmas} fantasma${resumo.fantasmas > 1 ? 's' : ''}?`}
            description="Eles somem do banco pra sempre. Pagos que vieram de promoção real ficam preservados."
            okText="Apagar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={limparFantasmas}
          >
            <Button
              danger
              type="primary"
              size="small"
              icon={<Trash2 size={13} />}
              loading={limpandoFantasmas}
            >
              Limpar {resumo.fantasmas}
            </Button>
          </Popconfirm>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <Spin style={{ display: 'block', margin: '40px auto' }} />
      ) : filtrados.length === 0 ? (
        <Panel padding={28}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 13 }}>
                {/* v1.148.12 — texto antes era uma string literal contendo `// TODO:`,
                    `// FIXME:` e `// DEBT(...)`. Isso disparava o próprio scanner de
                    débito como falso positivo. Agora os marcadores estão em <code>
                    fora da string TS, defensivo contra qualquer regex de comentário. */}
                {resumo.total === 0
                  ? (
                    <>
                      Nenhuma dívida detectada — seu código está limpo. Marque com{' '}
                      <code style={{ fontFamily: 'inherit' }}>{'/'}{'/ '}TODO:</code>,{' '}
                      <code style={{ fontFamily: 'inherit' }}>{'/'}{'/ '}FIXME:</code> ou{' '}
                      <code style={{ fontFamily: 'inherit' }}>{'/'}{'/ '}DEBT(area,sev): ...</code> pra acompanhar aqui.
                    </>
                  )
                  : 'Nenhum item bate com o filtro/busca.'}
              </span>
            }
          />
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map((d) => (
            <DebitoCard
              key={d.id}
              d={d}
              repoUrl={repoUrl || ''}
              scriptId={scriptId || ''}
              onPromover={() => promover(d)}
              onPago={() => marcarPago(d)}
              onApagar={() => apagar(d)}
              onAbrir={() => abrirDetalhe(d)}
            />
          ))}
        </div>
      )}

      {aberto && (
        <DebitoDrawer
          d={aberto}
          contexto={contexto}
          carregando={carregandoCtx}
          erro={erroCtx}
          prompt={prompt}
          carregandoPrompt={carregandoPrompt}
          temRepo={temRepo}
          temScript={temScript}
          onClose={() => setAberto(null)}
          onPromover={() => promover(aberto)}
          onPago={() => marcarPago(aberto)}
          onApagar={() => apagar(aberto)}
        />
      )}
    </div>
  );
}

function DebitoCard({ d, repoUrl, scriptId, onPromover, onPago, onApagar, onAbrir }: {
  d: DebitoTecnico; repoUrl: string; scriptId: string; onPromover: () => void; onPago: () => void; onApagar: () => void; onAbrir: () => void;
}): React.ReactElement {
  const t = useTokens();
  const meta = TIPO_META[d.tipo] || TIPO_META.todo;
  const corTipo = t.accents[meta.corKey];
  const Icon = meta.Icon;
  const [hover, setHover] = useState(false);

  // Monta link adequado pra fonte: GitHub permalink (arquivo:linha) quando tem
  // repo; editor do Apps Script (sem âncora de linha — GAS não suporta) quando
  // é só scriptId. Ordem espelha a prioridade do scan (GitHub > GAS).
  const linkExterno = useMemo(() => {
    if (repoUrl) {
      const cleaned = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '');
      return { url: `${cleaned}/blob/HEAD/${d.arquivo}#L${d.linha}`, tooltip: 'Abrir no GitHub (arquivo:linha)' };
    }
    if (scriptId) {
      // GAS não tem deep-link pra linha específica; abre o editor no projeto.
      return { url: `https://script.google.com/d/${scriptId}/edit`, tooltip: 'Abrir no editor do Apps Script' };
    }
    return null;
  }, [repoUrl, scriptId, d.arquivo, d.linha]);

  const sev = d.severidade ? SEV_META[d.severidade] : null;
  const corSev = sev ? t.accents[sev.corKey] : t.textTertiary;

  // Estados de status: pago / promovido ficam visualmente apagados.
  const ehAtivo = d.status === 'ativo';
  const opacity = ehAtivo ? 1 : 0.65;

  // v1.148.8 — clique no card abre drawer de detalhes (com contexto de código).
  // Botões de ação param a propagação pra não disparar a abertura junto.
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAbrir();
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? t.surfaceMuted : t.surface,
        border: `1px solid ${ehAtivo ? `${corTipo}${hover ? '55' : '33'}` : t.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        opacity,
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}>
      {/* Ícone do tipo */}
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: `${corTipo}1f`, color: corTipo,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={15} strokeWidth={1.8} />
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{
            fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700,
            color: corTipo, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {meta.label}
          </span>
          {d.area && (
            <Tag bordered={false} style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10.5, marginInlineEnd: 0 }}>
              {d.area}
            </Tag>
          )}
          {sev && (
            <Tag bordered={false} style={{ background: `${corSev}1a`, color: corSev, fontSize: 10.5, fontWeight: 600, marginInlineEnd: 0 }}>
              {sev.label}
            </Tag>
          )}
          {d.status === 'promovido' && (
            <Tag bordered={false} style={{ background: `${t.accents.lavender}1a`, color: t.accents.lavender, fontSize: 10.5, fontWeight: 600, marginInlineEnd: 0 }}>
              <ArrowUpRight size={10} style={{ marginRight: 3, verticalAlign: 'text-top' }} />
              no backlog
            </Tag>
          )}
          {d.status === 'pago' && (
            <Tag bordered={false} style={{ background: `${t.accents.sage}1a`, color: t.accents.sage, fontSize: 10.5, fontWeight: 600, marginInlineEnd: 0 }}>
              <CheckCircle2 size={10} style={{ marginRight: 3, verticalAlign: 'text-top' }} />
              pago
            </Tag>
          )}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, lineHeight: 1.5, marginBottom: 4 }}>
          {d.descricao}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>
          <FileCode2 size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.arquivo}:{d.linha}
          </span>
        </div>
      </div>

      {/* Ações — stopPropagation evita disparar o onAbrir do card */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <Tooltip title="Ver detalhes — código no entorno + metadados">
          <Button size="small" type="text" icon={<Eye size={13} />} onClick={onAbrir} />
        </Tooltip>
        {linkExterno && (
          <Tooltip title={linkExterno.tooltip}>
            <Button size="small" type="text" icon={<ExternalLink size={13} />} href={linkExterno.url} target="_blank" />
          </Tooltip>
        )}
        {ehAtivo && (
          <>
            <Tooltip title="Promover pra Backlog — cria um card em 'A fazer' linkado a este débito.">
              <Button size="small" type="text" icon={<ArrowUpRight size={13} />} onClick={onPromover}>
                Promover
              </Button>
            </Tooltip>
            <Popconfirm
              title="Marcar como pago?"
              description="Use quando você já resolveu mas o scan não detectou (refator fora do branch default, por ex)."
              okText="Marcar"
              cancelText="Cancelar"
              onConfirm={onPago}
            >
              <Tooltip title="Marcar como pago manualmente">
                <Button size="small" type="text" icon={<CheckCircle2 size={13} />} />
              </Tooltip>
            </Popconfirm>
          </>
        )}
        {/* v1.148.9 — Apagar definitivamente. Mostra só em status pago/promovido pra
            não confundir com "Marcar como pago" no fluxo de débito ativo. */}
        {(d.status === 'pago' || d.status === 'promovido') && (
          <Popconfirm
            title="Apagar definitivamente?"
            description={d.status === 'promovido' && d.backlogId
              ? 'Atenção: este débito tem card no backlog — vai falhar. Apague o card primeiro.'
              : 'Remove do banco pra sempre. Use pra limpar falsos positivos do scan.'}
            okText="Apagar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={onApagar}
          >
            <Tooltip title="Apagar definitivamente do banco">
              <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
            </Tooltip>
          </Popconfirm>
        )}
      </div>
    </div>
  );
}

// v1.148.8 — Drawer de detalhes do débito.
// Mostra contexto do código (6 linhas antes + linha + 6 depois) com a linha
// do débito destacada, descrição não-truncada, metadados (criado/atualizado),
// e botões de ação (Promover, Abrir no editor, Marcar pago, Copiar linha).
// Solução pro feedback do user (v1.148.8): "não vejo detalhes dos débitos
// técnicos, só mostra essa descrição".
function DebitoDrawer({ d, contexto, carregando, erro, prompt, carregandoPrompt, temRepo, temScript, onClose, onPromover, onPago, onApagar }: {
  d: DebitoTecnico;
  contexto: DebitoContexto | null;
  carregando: boolean;
  erro: string;
  prompt: string;
  carregandoPrompt: boolean;
  temRepo: boolean;
  temScript: boolean;
  onClose: () => void;
  onPromover: () => void;
  onPago: () => void;
  onApagar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const meta = TIPO_META[d.tipo] || TIPO_META.todo;
  const corTipo = t.accents[meta.corKey];
  const Icon = meta.Icon;
  const sev = d.severidade ? SEV_META[d.severidade] : null;
  const corSev = sev ? t.accents[sev.corKey] : t.textTertiary;
  const ehAtivo = d.status === 'ativo';

  const copiar = (texto: string, label: string) => {
    try {
      navigator.clipboard.writeText(texto);
      message.success(`${label} copiado`);
    } catch { message.error('Não foi possível copiar'); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={680}
      destroyOnClose
      styles={{ body: { padding: 0, background: t.bg } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${corTipo}22`, color: corTipo,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={16} strokeWidth={1.8} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, lineHeight: 1.2 }}>
              {meta.label}
              {d.area && <span style={{ fontWeight: 400, color: t.textTertiary, marginLeft: 8 }}>· {d.area}</span>}
              {sev && (
                <Tag bordered={false} style={{ background: `${corSev}1f`, color: corSev, fontSize: 10.5, fontWeight: 600, marginLeft: 8 }}>
                  {sev.label}
                </Tag>
              )}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.arquivo}:{d.linha}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Descrição completa (sem truncar como no card) */}
        <section>
          <SectionLabel>Descrição</SectionLabel>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 14, color: t.text, lineHeight: 1.6,
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px',
          }}>
            {d.descricao || <span style={{ color: t.textTertiary, fontStyle: 'italic' }}>(sem descrição)</span>}
          </div>
        </section>

        {/* Contexto do código */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionLabel>Código no entorno</SectionLabel>
            {contexto && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {contexto.branch && (
                  <Tag bordered={false} style={{ fontSize: 10.5, color: t.textSecondary, background: t.surfaceMuted, marginInlineEnd: 0 }}>
                    <GitBranch size={10} style={{ marginRight: 3, verticalAlign: 'text-top' }} />
                    {contexto.branch}
                  </Tag>
                )}
                <Tooltip title="Copiar a linha exata do débito">
                  <Button size="small" type="text" icon={<Copy size={12} />} onClick={() => copiar(contexto.linhaCompleta, 'Linha')} />
                </Tooltip>
              </div>
            )}
          </div>
          {carregando ? (
            <div style={{ padding: 28, textAlign: 'center' }}><Spin size="small" /> <span style={{ marginLeft: 8, color: t.textTertiary, fontSize: 12 }}>buscando o arquivo…</span></div>
          ) : erro ? (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 13, color: t.accents.peach,
              background: `${t.accents.peach}10`, border: `1px solid ${t.accents.peach}33`,
              borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Não consegui carregar o contexto</div>
                <div style={{ color: t.textSecondary, fontSize: 12 }}>{erro}</div>
              </div>
            </div>
          ) : contexto ? (
            <CodigoSnippet contexto={contexto} corDestaque={corTipo} />
          ) : null}
        </section>

        {/* Metadados */}
        <section>
          <SectionLabel>Histórico</SectionLabel>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14,
          }}>
            <Meta icon={<Calendar size={12} />} label="Detectado pela 1ª vez" valor={formatarData(d.criadoEm)} hint={relTempo(d.criadoEm)} t={t} />
            <Meta icon={<RefreshCw size={12} />} label="Última verificação" valor={formatarData(d.atualizadoEm)} hint={relTempo(d.atualizadoEm)} t={t} />
            <Meta icon={<Hash size={12} />} label="Hash do débito" valor={d.hash || '—'} mono t={t} />
            <Meta icon={<FileCode2 size={12} />} label="Tipo" valor={`${meta.label}${d.severidade ? ` · severidade ${d.severidade}` : ''}${d.area ? ` · área ${d.area}` : ''}`} t={t} />
            {d.promovidoEm && (
              <Meta icon={<ArrowUpRight size={12} />} label="Promovido pra backlog" valor={formatarData(d.promovidoEm)} hint={relTempo(d.promovidoEm)} t={t} />
            )}
            {d.pagoEm && (
              <Meta icon={<CheckCircle2 size={12} />} label="Pago em" valor={formatarData(d.pagoEm)} hint={relTempo(d.pagoEm)} t={t} />
            )}
          </div>
        </section>

        {/* v1.148.11 — Prompt pronto pra colar em agente de IA.
            Resposta ao user: "ele leva o que pro backlog, qual minha ação lá
            dentro, eu copio é um prompt, eu levo isso pra AI que está
            desenvolvendo o app?". RESPOSTA: SIM. E agora vem formatado. */}
        {ehAtivo && (
          <PromptIASection prompt={prompt} carregando={carregandoPrompt} d={d} contexto={contexto} />
        )}

        {/* v1.148.10 — Seção explicativa "O que acontece" antes das ações.
            Resposta ao feedback do user: "eu promovo para backlog ele leva o que
            especificamente, o que acontece, como funciona esse processo, poderia
            ter uma instrução não?". Mostra preview do card + fluxo em 4 passos. */}
        {ehAtivo && (
          <PromocaoPreview d={d} />
        )}

        {/* Estado quando já está promovido: mostra info do card no backlog */}
        {d.status === 'promovido' && d.backlogId && (
          <div style={{
            background: `${t.accents.lavender}0d`,
            border: `1px solid ${t.accents.lavender}33`,
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ArrowUpRight size={14} color={t.accents.lavender} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>
                Já está no Backlog
              </span>
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
              Este débito foi promovido pra Backlog em <strong>{formatarData(d.promovidoEm || '')}</strong> ({relTempo(d.promovidoEm || '')}).
              O card vive lá com sua própria régua (status, gravidade, comentários).
              Quando você apagar o comentário do código E commitar, o débito vira <code>pago</code> automaticamente na próxima sincronização.
            </div>
          </div>
        )}

        {/* Ações */}
        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
          {contexto && (
            <Button
              type="primary"
              icon={<ExternalLink size={14} />}
              href={contexto.urlLinha}
              target="_blank"
            >
              {contexto.fonte === 'github' ? 'Abrir no GitHub' : 'Abrir no editor'}
            </Button>
          )}
          {ehAtivo && (
            <>
              <Popconfirm
                title="Promover pra Backlog agora?"
                description={
                  <div style={{ maxWidth: 320, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
                    Cria card em "A fazer" com título <strong>[{(TIPO_META[d.tipo] || TIPO_META.todo).label}] {d.descricao.slice(0, 60)}{d.descricao.length > 60 ? '…' : ''}</strong> e move este débito pra status "promovido".
                  </div>
                }
                okText="Promover"
                cancelText="Cancelar"
                onConfirm={onPromover}
              >
                <Button type="primary" ghost icon={<ArrowUpRight size={14} />}>
                  Promover pra Backlog
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Marcar como pago?"
                description="Use quando você já resolveu mas o scan não detectou (refator fora do branch default, por ex)."
                okText="Marcar"
                cancelText="Cancelar"
                onConfirm={onPago}
              >
                <Button icon={<CheckCircle2 size={14} />}>
                  Marcar como pago
                </Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="Apagar definitivamente?"
            description={d.status === 'promovido' && d.backlogId
              ? 'Atenção: este débito tem card no backlog — vai falhar. Apague o card primeiro.'
              : 'Remove do banco pra sempre. Use pra limpar falso positivo do scan.'}
            okText="Apagar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={onApagar}
          >
            <Button danger icon={<Trash2 size={14} />}>
              Apagar
            </Button>
          </Popconfirm>
        </section>

        {/* Dica de remoção */}
        {ehAtivo && (
          <div style={{
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5,
            background: `${t.accents.lavender}0d`, border: `1px solid ${t.accents.lavender}26`,
            borderRadius: 10, padding: '10px 12px',
          }}>
            <strong style={{ color: t.text }}>Como fechar este débito:</strong> apague o comentário <code style={{ background: t.surfaceMuted, padding: '1px 5px', borderRadius: 4, fontFamily: FONTS.mono, fontSize: 11 }}>{TIPO_META[d.tipo]?.label}</code> da linha <code style={{ background: t.surfaceMuted, padding: '1px 5px', borderRadius: 4, fontFamily: FONTS.mono, fontSize: 11 }}>{d.linha}</code> do arquivo, faça commit
            {temRepo ? ' (push pro branch default) ' : ' '}
            e rode <em>Sincronizar</em>. A Forja detecta a remoção e marca como "pago" automaticamente.
          </div>
        )}
      </div>
    </Drawer>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8,
      textTransform: 'uppercase', color: t.textTertiary, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Meta({ icon, label, valor, hint, mono, t }: {
  icon: React.ReactNode; label: string; valor: string; hint?: string; mono?: boolean; t: ReturnType<typeof useTokens>;
}): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: t.textTertiary, fontSize: 11, fontFamily: FONTS.ui, marginBottom: 3 }}>
        {icon} <span>{label}</span>
      </div>
      <div style={{ fontFamily: mono ? FONTS.mono : FONTS.ui, fontSize: 12.5, color: t.text, lineHeight: 1.35 }}>
        {valor}
      </div>
      {hint && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>{hint}</div>
      )}
    </div>
  );
}

// v1.148.11 — Seção dedicada ao prompt pra agente de IA.
// Resposta direta ao user: "ele leva o que pro backlog, qual minha ação lá
// dentro, eu copio é um prompt, eu levo isso pra AI que está desenvolvendo
// o app?". RESPOSTA: SIM — e agora o prompt vem pronto, com link permalink,
// instruções pra IA, critério de aceite e promessa do ciclo (commit fecha
// automaticamente). Cole no Cursor / Claude Code / Codex / Windsurf.
function PromptIASection({ prompt, carregando, d, contexto }: {
  prompt: string;
  carregando: boolean;
  d: DebitoTecnico;
  contexto: DebitoContexto | null;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const cor = t.accents.peach;
  const [expandido, setExpandido] = useState(false);

  // Versão "enriquecida": prompt + trecho de código quando contexto carregou.
  // Pra IAs que NÃO têm acesso ao filesystem (ex: chat direto), o snippet
  // economiza um "abra o arquivo X" inicial.
  const promptComCodigo = useMemo(() => {
    if (!contexto || !prompt) return prompt;
    const lang = d.arquivo.match(/\.(\w+)$/)?.[1] || '';
    const snippet = contexto.contextoLinhas
      .map((l, i) => `${String(contexto.contextoInicio + i).padStart(4, ' ')} | ${l}`)
      .join('\n');
    return prompt.replace(
      '## Tarefas',
      `## Código no entorno (linhas ${contexto.contextoInicio}-${contexto.contextoInicio + contexto.contextoLinhas.length - 1})\n\n\`\`\`${lang}\n${snippet}\n\`\`\`\n\n## Tarefas`,
    );
  }, [prompt, contexto, d.arquivo]);

  const copiar = (texto: string, label: string) => {
    if (!texto) { message.warning('Prompt ainda não está pronto.'); return; }
    try {
      navigator.clipboard.writeText(texto);
      message.success(`${label} copiado — cole no seu agente de IA`);
    } catch { message.error('Não foi possível copiar'); }
  };

  return (
    <section>
      <SectionLabel>Prompt pra agente de IA</SectionLabel>
      <div style={{
        background: `${cor}08`,
        border: `1px solid ${cor}33`,
        borderRadius: 10, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
          <strong style={{ color: t.text }}>Sim — é um prompt acionável.</strong> Cole direto no <strong>Cursor</strong>, <strong>Claude Code</strong>, <strong>Codex</strong>, <strong>Windsurf</strong> ou qualquer agente de IA que esteja trabalhando neste projeto.
          O prompt traz <em>permalink, arquivo:linha, marcador do código, critério de aceite</em> e explica o ciclo de fechamento automático.
        </div>

        {/* Preview do prompt (clamped + expandível) */}
        {carregando ? (
          <div style={{ padding: 14, textAlign: 'center', fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
            <Spin size="small" /> <span style={{ marginLeft: 8 }}>gerando prompt…</span>
          </div>
        ) : prompt ? (
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: 0, overflow: 'hidden',
          }}>
            <pre style={{
              fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary,
              padding: '10px 12px', margin: 0,
              maxHeight: expandido ? 'none' : 180,
              overflow: 'auto', whiteSpace: 'pre-wrap',
              borderBottom: `1px solid ${t.borderSoft}`,
              background: t.surface,
            }}>
              {expandido ? promptComCodigo : prompt}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: t.surfaceMuted }}>
              <Button size="small" type="text" onClick={() => setExpandido((v) => !v)} style={{ fontSize: 11, color: t.textTertiary }}>
                {expandido ? 'recolher' : `ver completo (${prompt.split('\n').length} linhas)`}
              </Button>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tooltip title="Copia só o prompt (sem incluir o trecho de código). Use quando a IA tem acesso ao filesystem (Cursor, Claude Code, Windsurf etc).">
                  <Button size="small" icon={<Copy size={12} />} onClick={() => copiar(prompt, 'Prompt')}>
                    Copiar prompt
                  </Button>
                </Tooltip>
                {contexto && (
                  <Tooltip title="Copia o prompt incluindo o trecho de código no entorno (6 linhas antes + linha do débito + 6 depois). Use quando a IA NÃO tem acesso ao filesystem (chat direto)." >
                    <Button size="small" type="primary" icon={<Sparkles size={12} />} onClick={() => copiar(promptComCodigo, 'Prompt + código')}>
                      Copiar com código
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 10, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
            Prompt indisponível.
          </div>
        )}

        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.5 }}>
          💡 <strong style={{ color: t.textSecondary }}>Mesmo prompt vai pro card</strong> quando você clicar "Promover pra Backlog" abaixo. Você pode trabalhar de 3 jeitos:
          <br /><span style={{ marginLeft: 18 }}>① <strong>Copiar e ir direto</strong> pra IA sem criar card (resolve agora)</span>
          <br /><span style={{ marginLeft: 18 }}>② <strong>Promover</strong> pra rastrear depois (vira card no kanban)</span>
          <br /><span style={{ marginLeft: 18 }}>③ <strong>Os dois</strong> — promove agora, copia o prompt do card depois quando for atacar</span>
        </div>
      </div>
    </section>
  );
}

// v1.148.10 — Preview do que acontece ao clicar "Promover pra Backlog".
// Resposta ao feedback do user (v1.148.10): "eu promovo para backlog ele leva
// o que especificamente, o que acontece, como funciona esse processo, poderia
// ter uma instrução não?". Mostra título exato do card que será criado +
// fluxo numerado em 4 passos, ZERO ambiguidade.
function PromocaoPreview({ d }: { d: DebitoTecnico }): React.ReactElement {
  const t = useTokens();
  const meta = TIPO_META[d.tipo] || TIPO_META.todo;
  const cor = t.accents.lavender;

  // Espelha exatamente a lógica do backend `promoverDebitoParaBacklog`:
  // título = `[<tipoLabel>] <descricao truncada em 80 chars>`
  const tituloCard = `[${meta.label}] ${d.descricao.slice(0, 80)}${d.descricao.length > 80 ? '…' : ''}`;

  return (
    <section>
      <SectionLabel>O que acontece se você promover pra Backlog</SectionLabel>
      <div style={{
        background: `${cor}08`,
        border: `1px solid ${cor}26`,
        borderRadius: 10, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Preview do card */}
        <div>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
            textTransform: 'uppercase', color: t.textTertiary, marginBottom: 6,
          }}>
            ✦ Card que será criado em "A fazer"
          </div>
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '10px 12px',
          }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.4, marginBottom: 6 }}>
              {tituloCard}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag bordered={false} style={{ background: `${t.accents.peach}1a`, color: t.accents.peach, fontSize: 10.5, marginInlineEnd: 0 }}>
                coluna: A fazer
              </Tag>
              {d.area && (
                <Tag bordered={false} style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10.5, marginInlineEnd: 0 }}>
                  área: {d.area}
                </Tag>
              )}
              <Tag bordered={false} style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10.5, marginInlineEnd: 0 }}>
                gravidade: {d.severidade || 'media'}
              </Tag>
              <Tag bordered={false} style={{ background: t.surfaceMuted, color: t.textSecondary, fontSize: 10.5, marginInlineEnd: 0 }}>
                link: {d.arquivo}:{d.linha}
              </Tag>
            </div>
          </div>
        </div>

        {/* Fluxo numerado: 4 passos do que acontece */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FluxoPasso n={1} cor={cor}>
            <strong>Card novo em <em>Decisões → Backlog → A fazer</em></strong> com a descrição completa, arquivo+linha de origem e instrução de fechamento.
          </FluxoPasso>
          <FluxoPasso n={2} cor={cor}>
            Este débito muda de <code style={pillStyle(t.accents.rose, t)}>ativo</code> pra <code style={pillStyle(cor, t)}>promovido</code> e <strong>some da lista de ativos</strong> (vai aparecer só na aba "Promovidos").
          </FluxoPasso>
          <FluxoPasso n={3} cor={cor}>
            Os dois ficam <strong>linkados pelo hash do débito</strong> (<code style={pillStyle(t.textTertiary, t)}>{d.hash}</code>). Próximas sincronizações respeitam isso: <em>não vai recriar este débito</em> enquanto o card existir.
          </FluxoPasso>
          <FluxoPasso n={4} cor={cor}>
            Quando você <strong>apagar o comentário do código</strong> e fizer commit, a próxima sincronização detecta a remoção e marca como <code style={pillStyle(t.accents.sage, t)}>pago</code> automaticamente. O card no backlog você fecha por lá.
          </FluxoPasso>
        </div>
      </div>
    </section>
  );
}

function FluxoPasso({ n, cor, children }: { n: number; cor: string; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: `${cor}1f`, color: cor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700,
        flexShrink: 0, marginTop: 1,
      }}>{n}</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function pillStyle(cor: string, t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: `${cor}1a`, color: cor,
    padding: '1px 6px', borderRadius: 4,
    fontFamily: FONTS.mono, fontSize: 10.5, fontWeight: 600,
    border: `1px solid ${cor}26`,
  };
}

// Renderiza o snippet de código com gutter de linhas e destaque na linha do débito.
function CodigoSnippet({ contexto, corDestaque }: { contexto: DebitoContexto; corDestaque: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
      overflow: 'hidden', fontFamily: FONTS.mono, fontSize: 12, lineHeight: 1.6,
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {contexto.contextoLinhas.map((linhaTexto, i) => {
              const numLinha = contexto.contextoInicio + i;
              const ehDestaque = i === contexto.linhaDestaqueIdx;
              return (
                <tr
                  key={numLinha}
                  style={{
                    background: ehDestaque ? `${corDestaque}1a` : 'transparent',
                    borderLeft: ehDestaque ? `3px solid ${corDestaque}` : '3px solid transparent',
                  }}
                >
                  <td style={{
                    color: ehDestaque ? corDestaque : t.textTertiary,
                    padding: '2px 12px 2px 10px',
                    textAlign: 'right',
                    userSelect: 'none',
                    fontWeight: ehDestaque ? 700 : 400,
                    borderRight: `1px solid ${t.borderSoft}`,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}>
                    {numLinha}
                  </td>
                  <td style={{
                    padding: '2px 14px',
                    whiteSpace: 'pre',
                    color: ehDestaque ? t.text : t.textSecondary,
                    fontWeight: ehDestaque ? 500 : 400,
                  }}>
                    {linhaTexto || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
