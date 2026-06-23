// Painel de dívida técnica (v1.147.0) — escaneia repo GitHub procurando
// 4 padrões: TODO, FIXME, HACK (texto livre) + DEBT(area,sev) estruturado.
// Cada item fica linkado ao arquivo:linha e pode ser promovido pra backlog.
// Sync acontece automaticamente ao montar (com cache por commit SHA pra ser barato).
import React, { useState, useEffect, useMemo } from 'react';
import { App as AntApp, Button, Tooltip, Tag, Empty, Spin, Popconfirm, Segmented, Input } from 'antd';
import {
  AlertTriangle, ExternalLink, RefreshCw, Bug, Wrench, Flame, ListChecks, FileCode2,
  CheckCircle2, ArrowUpRight, Search, ShieldAlert,
} from 'lucide-react';
import { Panel } from './ui';
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

export default function DividaTecnicaPanel({ sistemaId, repoUrl, onPromovido }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [itens, setItens] = useState<DebitoTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<DebitoSyncResult | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'debt' | 'todo_fixme_hack' | 'promovidos' | 'pagos'>('todos');
  const [busca, setBusca] = useState('');

  const temRepo = !!(repoUrl && repoUrl.trim());

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
    if (!temRepo) return;
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
    if (temRepo) {
      const tid = setTimeout(() => sincronizar(false), 250);
      return () => clearTimeout(tid);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId, temRepo]);

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
  const resumo = useMemo(() => {
    const ativos = itens.filter((d) => d.status === 'ativo');
    return {
      total: ativos.length,
      debts: ativos.filter((d) => d.tipo === 'debt').length,
      livres: ativos.filter((d) => d.tipo !== 'debt').length,
      promovidos: itens.filter((d) => d.status === 'promovido').length,
      pagos: itens.filter((d) => d.status === 'pago').length,
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
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  if (!temRepo) {
    return (
      <Panel padding={28}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sistema sem repositório GitHub</div>
              <div>Cadastre o <code>repoUrl</code> na ficha do sistema pra a Forja escanear TODO/FIXME/HACK/DEBT do código.</div>
            </div>
          }
        />
      </Panel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              ? `HEAD continua em ${ultimoSync.scanSha} — não precisou re-escanear.`
              : `${ultimoSync.novos} novo(s) · ${ultimoSync.pagosAuto} pago(s) auto · ${ultimoSync.inalterados} mantido(s)`}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>
                commit {ultimoSync.scanSha}{ultimoSync.semMudanca ? ' · em dia' : ''}
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

      {/* Lista */}
      {loading ? (
        <Spin style={{ display: 'block', margin: '40px auto' }} />
      ) : filtrados.length === 0 ? (
        <Panel padding={28}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 13 }}>
                {resumo.total === 0
                  ? 'Nenhuma dívida detectada — seu código está limpo. Marque com `// TODO:`, `// FIXME:` ou `// DEBT(area,sev): ...` pra acompanhar aqui.'
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
              onPromover={() => promover(d)}
              onPago={() => marcarPago(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DebitoCard({ d, repoUrl, onPromover, onPago }: {
  d: DebitoTecnico; repoUrl: string; onPromover: () => void; onPago: () => void;
}): React.ReactElement {
  const t = useTokens();
  const meta = TIPO_META[d.tipo] || TIPO_META.todo;
  const corTipo = t.accents[meta.corKey];
  const Icon = meta.Icon;

  // Monta link permanente do GitHub pro arquivo:linha (branch default).
  const ghLink = useMemo(() => {
    if (!repoUrl) return null;
    const cleaned = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '');
    return `${cleaned}/blob/HEAD/${d.arquivo}#L${d.linha}`;
  }, [repoUrl, d.arquivo, d.linha]);

  const sev = d.severidade ? SEV_META[d.severidade] : null;
  const corSev = sev ? t.accents[sev.corKey] : t.textTertiary;

  // Estados de status: pago / promovido ficam visualmente apagados.
  const ehAtivo = d.status === 'ativo';
  const opacity = ehAtivo ? 1 : 0.65;

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${ehAtivo ? `${corTipo}33` : t.border}`,
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      opacity,
      transition: 'opacity 0.15s',
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

      {/* Ações */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {ghLink && (
          <Tooltip title="Abrir no GitHub (arquivo:linha)">
            <Button size="small" type="text" icon={<ExternalLink size={13} />} href={ghLink} target="_blank" />
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
      </div>
    </div>
  );
}
