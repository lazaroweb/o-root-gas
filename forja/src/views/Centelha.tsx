// Centelha — caixa global de captura zero-fricção (Inbox/GTD-style).
//
// Filosofia (do usuário): "Eu estou trabalhando e vem várias coisas que preciso
// fazer que são pendências... pensei em ter uma sessão onde eu possa cadastrar
// todas as minhas ideias e isso possa de alguma forma depois ser refinada e
// entrar ou não para um backlog, um conceito de caixa onde coloco tudo e
// depois classifico e até inicio dentro de um kanban".
//
// Implementação: 1 input grande no topo + Enter = salva. Lista abaixo com
// 3 visões (Capturadas / Triadas / Resolvidas). Cada item abre o
// CentelhaTriagemModal pra decidir destino.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Input, Tag, Empty, Spin, Tooltip, App as AntApp,
  Segmented, Popconfirm, Badge,
} from 'antd';
import {
  Sparkles, Plus, Trash2, Archive, ArrowRight, Lightbulb, ListChecks,
  Flame, Clock, CheckCheck, Filter,
} from 'lucide-react';
import { PageHeader, Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import CentelhaTriagemModal from '../components/CentelhaTriagemModal';
import type { Centelha, CentelhaEstado, ServerResponse, ServerResult, Sistema } from '../types';

type Visao = 'capturadas' | 'triadas' | 'resolvidas';

const CATEGORIA_LABEL: Record<string, string> = {
  feature: 'Feature', bug: 'Bug', melhoria: 'Melhoria',
  sistema_novo: 'Sistema novo', processo: 'Processo', pessoal: 'Pessoal',
};

const PRIO_COR: Record<string, string> = {
  alta: '#E85555', media: '#E8A838', baixa: '#3B82F6',
};

function tempoRelativo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const me = Math.floor(d / 30);
  return `há ${me}mes${me > 1 ? 'es' : ''}`;
}

export default function Centelha(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [centelhas, setCentelhas] = useState<Centelha[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [visao, setVisao] = useState<Visao>('capturadas');
  const [triando, setTriando] = useState<Centelha | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<Centelha[]>>('getCentelhas')
      .then((r) => { if (r.ok && r.data) setCentelhas(r.data); })
      .catch(() => setCentelhas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((r) => { if (r.ok && r.data) setSistemas(r.data); })
      .catch(() => { /* preview */ });
  }, [carregar]);

  useEffect(() => {
    // Foco no input ao montar a tela — captura é prioridade visual e ergonômica.
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  const adicionar = async () => {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('createCentelha', { titulo });
      if (!r.ok) {
        message.error(r.error || 'Erro ao capturar');
        return;
      }
      setNovoTitulo('');
      carregar();
      // Mantém o foco pro próximo Enter — ergonomia de captura em rajada.
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao capturar');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    const r = await callServer<ServerResult>('deleteCentelha', id);
    if (!r.ok) { message.error(r.error || 'Erro'); return; }
    carregar();
  };

  // Filtra por visão. "resolvidas" agrupa promovidas+arquivadas+descartadas
  // pra evitar 3 abas com pouco dado cada — o filtro fino vem dos chips.
  const filtradas = useMemo(() => {
    const matchVisao = (c: Centelha) => {
      const e = c.estado || 'capturada';
      if (visao === 'capturadas') return e === 'capturada';
      if (visao === 'triadas') return e === 'triada';
      return e === 'promovida' || e === 'arquivada' || e === 'descartada';
    };
    return centelhas.filter(matchVisao);
  }, [centelhas, visao]);

  const contagens = useMemo(() => {
    const cap = centelhas.filter((c) => (c.estado || 'capturada') === 'capturada').length;
    const tri = centelhas.filter((c) => c.estado === 'triada').length;
    const res = centelhas.filter((c) => c.estado === 'promovida' || c.estado === 'arquivada' || c.estado === 'descartada').length;
    return { cap, tri, res };
  }, [centelhas]);

  const nomeSistema = (id?: string) => sistemas.find((s) => s.id === id)?.nome || '';

  const resumoPromovidaPara = (s?: string) => {
    if (!s) return '';
    const [tipo] = s.split(':');
    if (tipo === 'ideia') return 'Virou Ideia';
    if (tipo === 'decisao') return 'Virou item de Backlog';
    return '';
  };

  const visoesSegOptions = [
    { value: 'capturadas', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flame size={13} /> Capturadas <Badge count={contagens.cap} style={{ backgroundColor: t.accents.peach, marginLeft: 4 }} showZero={false} /></span> },
    { value: 'triadas', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={13} /> Triadas <Badge count={contagens.tri} style={{ backgroundColor: t.accents.blue, marginLeft: 4 }} showZero={false} /></span> },
    { value: 'resolvidas', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCheck size={13} /> Resolvidas <Badge count={contagens.res} style={{ backgroundColor: t.textTertiary, marginLeft: 4 }} showZero={false} /></span> },
  ];

  return (
    <div>
      <PageHeader
        title="Centelha"
        subtitle="Caixa de captura zero-fricção. Joga tudo aqui sem amarra — depois você tria com calma."
      />

      {/* Captura inline — input gigante, Enter salva e mantém foco. */}
      <Panel padding={20} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Sparkles size={20} color={t.accents.peach} />
          <Input
            ref={inputRef as unknown as React.Ref<typeof Input>}
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onPressEnter={adicionar}
            placeholder="Qual a faísca? Escreve e aperta Enter."
            size="large"
            disabled={salvando}
            style={{ border: 'none', boxShadow: 'none', fontSize: 16, fontFamily: FONTS.display, background: 'transparent' }}
            maxLength={240}
          />
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={adicionar}
            loading={salvando}
            disabled={!novoTitulo.trim()}
          >
            Capturar
          </Button>
        </div>
        <div style={{ marginTop: 8, marginLeft: 32, color: t.textTertiary, fontSize: 12 }}>
          Atalho: <code style={{ fontFamily: FONTS.mono, background: t.surfaceAlt, padding: '1px 6px', borderRadius: 4 }}>g</code> depois <code style={{ fontFamily: FONTS.mono, background: t.surfaceAlt, padding: '1px 6px', borderRadius: 4 }}>x</code> em qualquer tela pra vir aqui rápido
        </div>
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Segmented
          value={visao}
          onChange={(v) => setVisao(v as Visao)}
          options={visoesSegOptions}
        />
        <div style={{ color: t.textTertiary, fontSize: 12 }}>
          {centelhas.length} centelha{centelhas.length !== 1 ? 's' : ''} no total
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div>
      ) : filtradas.length === 0 ? (
        <Empty
          description={
            visao === 'capturadas' ? 'Inbox vazio. Capture algo no input acima.' :
            visao === 'triadas' ? 'Nada triado ainda. Quando triar uma centelha (mas não promover), ela aparece aqui.' :
            'Sem centelhas resolvidas. Promovidas, arquivadas e descartadas aparecerão aqui.'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map((c) => {
            const estado = (c.estado || 'capturada') as CentelhaEstado;
            const naoTriada = estado === 'capturada';
            const sistemaNome = nomeSistema(c.sistemaId);
            const promovido = resumoPromovidaPara(c.promovidaPara);
            return (
              <Panel key={c.id} padding={14}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ paddingTop: 4 }}>
                    {estado === 'capturada' && <Flame size={16} color={t.accents.peach} />}
                    {estado === 'triada' && <Clock size={16} color={t.accents.blue} />}
                    {estado === 'promovida' && <ArrowRight size={16} color={t.accents.sage} />}
                    {estado === 'arquivada' && <Archive size={16} color={t.textTertiary} />}
                    {estado === 'descartada' && <Trash2 size={16} color={t.textTertiary} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, color: t.text, marginBottom: 4 }}>
                      {c.titulo}
                    </div>
                    {c.contexto && (
                      <div style={{ color: t.textSecondary, fontSize: 13, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                        {c.contexto}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {c.categoria && (
                        <Tag color="default" style={{ margin: 0 }}>{CATEGORIA_LABEL[c.categoria] || c.categoria}</Tag>
                      )}
                      {c.prioridade && (
                        <Tag color={PRIO_COR[c.prioridade]} style={{ margin: 0, border: 'none', color: '#fff' }}>
                          {c.prioridade}
                        </Tag>
                      )}
                      {sistemaNome && (
                        <Tag style={{ margin: 0 }}>
                          {sistemaNome}
                        </Tag>
                      )}
                      {promovido && (
                        <Tag color="green" style={{ margin: 0 }}>{promovido}</Tag>
                      )}
                      {c.tags && c.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4).map((tag) => (
                        <Tag key={tag} style={{ margin: 0, fontSize: 11 }}>#{tag}</Tag>
                      ))}
                      <span style={{ color: t.textTertiary, fontSize: 12, marginLeft: 'auto' }}>
                        {tempoRelativo(c.criadoEm)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    {estado !== 'promovida' && estado !== 'descartada' && (
                      <Tooltip title={naoTriada ? 'Triar e decidir destino' : 'Editar triagem'}>
                        <Button
                          size="small"
                          type={naoTriada ? 'primary' : 'default'}
                          icon={<Filter size={12} />}
                          onClick={() => setTriando(c)}
                        >
                          {naoTriada ? 'Triar' : 'Editar'}
                        </Button>
                      </Tooltip>
                    )}
                    <Popconfirm
                      title="Apagar permanentemente?"
                      description="Diferente de 'descartar', isso some sem histórico."
                      onConfirm={() => remover(c.id)}
                      okText="Apagar"
                      cancelText="Cancelar"
                    >
                      <Tooltip title="Apagar (sem histórico)">
                        <Button size="small" type="text" icon={<Trash2 size={12} />} danger />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <CentelhaTriagemModal
        centelha={triando}
        open={!!triando}
        onClose={() => setTriando(null)}
        onChanged={carregar}
      />
    </div>
  );
}
