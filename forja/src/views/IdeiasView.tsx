// IdeiasView — banco unificado de ideias (v1.143.0: fundido com Centelha).
//
// Filosofia: uma só caixa pra tudo. Capturada bruta no Inbox → triagem rica
// (categoria, prioridade, sistema, score) → vira ativa, concluída, arquivada,
// descartada, vai pra Gênese (sistema novo) ou Backlog (item acionável de
// sistema existente). Lifecycle completo, captura zero-fricção, modo foco
// pra batch, ações ao hover.
//
// Inspirações: Notion (tipografia + hierarquia), Linear (hotkeys + speed),
// Things 3 (inbox + revisão), Superhuman (modo foco).
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Typography, Button, Modal, Form, Input, Select,
  Tag, Empty, Spin, Segmented, App as AntApp, Tooltip, Popconfirm,
  Dropdown,
} from 'antd';
import type { InputRef } from 'antd';
import {
  Plus, Sparkles, Pencil, Lightbulb, Rocket, Check, Trash2, Archive,
  RotateCcw, MoreHorizontal, XCircle, Clock, Flame, Inbox, Target,
  CheckCheck, Box, Filter, Zap, ListChecks,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import IdeiaTriagemDrawer from '../components/IdeiaTriagemDrawer';
import IdeiaTriagemBatch from '../components/IdeiaTriagemBatch';
import type { Ideia, Sistema, IdeiaCategoria, ServerResponse, ServerResult } from '../types';

const { Text, Paragraph } = Typography;

interface IdeiasViewProps {
  onGenese: (ideiaId: string) => void;
}

type Visao = 'inbox' | 'foco' | 'ativas' | 'concluidas' | 'arquivo';

const VISAO_META: Record<Visao, { label: string; icon: React.ReactNode; descricao: string }> = {
  inbox: { label: 'Inbox', icon: <Inbox size={13} />, descricao: 'Capturadas brutas, sem categoria nem sistema. Triar com calma.' },
  foco: { label: 'Foco', icon: <Target size={13} />, descricao: 'Alta prioridade ou criadas nos últimos 3 dias. Atenção primeiro.' },
  ativas: { label: 'Ativas', icon: <Flame size={13} />, descricao: 'Todas em movimento (nova/validando/em andamento) já triadas.' },
  concluidas: { label: 'Concluídas', icon: <CheckCheck size={13} />, descricao: 'Histórico do que virou realidade. Orgulho.' },
  arquivo: { label: 'Arquivo', icon: <Box size={13} />, descricao: 'Arquivadas + descartadas. Memória sem ação.' },
};

const CATEGORIA_LABEL: Record<string, string> = {
  feature: 'Feature', bug: 'Bug', melhoria: 'Melhoria',
  sistema_novo: 'Sistema novo', processo: 'Processo', pessoal: 'Pessoal',
};

const CATEGORIA_COR = (t: ReturnType<typeof useTokens>): Record<string, string> => ({
  feature: t.accents.blue,
  bug: t.accents.rose,
  melhoria: t.accents.clay,
  sistema_novo: t.accents.peach,
  processo: t.accents.lavender,
  pessoal: t.accents.sage,
});

const ESTADO_LABEL: Record<string, string> = {
  nova: 'Nova', validando: 'Validando', 'em andamento': 'Em andamento',
  concluida: 'Concluída', promovida: 'Promovida', arquivada: 'Arquivada',
  descartada: 'Descartada',
};

const ATIVAS = new Set(['nova', 'validando', 'em andamento', '']);

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

function grupoTempo(iso?: string): string {
  if (!iso) return 'Sem data';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Sem data';
  const agora = Date.now();
  const diff = agora - t;
  const dia = 86400000;
  if (diff < dia) return 'Hoje';
  if (diff < 2 * dia) return 'Ontem';
  if (diff < 7 * dia) return 'Esta semana';
  if (diff < 30 * dia) return 'Este mês';
  if (diff < 90 * dia) return 'Últimos 3 meses';
  return 'Antigas';
}

// Normaliza ideias legadas (sem `tipo`) como faísca de sistema novo.
const tipoDe = (i: Ideia): 'sistema' | 'melhoria' => (i.tipo === 'melhoria' ? 'melhoria' : 'sistema');

const ehBruta = (i: Ideia): boolean => {
  const cat = String(i.categoria || '').trim();
  const sis = String(i.sistemaId || '').trim();
  const est = String(i.estado || 'nova').toLowerCase();
  return ATIVAS.has(est) && !cat && !sis;
};

const ehFoco = (i: Ideia): boolean => {
  const est = String(i.estado || 'nova').toLowerCase();
  if (!ATIVAS.has(est)) return false;
  if (i.prioridade === 'alta') return true;
  if (!i.criadoEm) return false;
  const dias = (Date.now() - new Date(i.criadoEm).getTime()) / 86400000;
  return dias <= 3 && dias >= 0;
};

export default function IdeiasView({ onGenese }: IdeiasViewProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [visao, setVisao] = useState<Visao>('inbox');
  const [triando, setTriando] = useState<Ideia | null>(null);
  const [modoFoco, setModoFoco] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [salvandoQuick, setSalvandoQuick] = useState(false);
  const [novaModalOpen, setNovaModalOpen] = useState(false);
  const [savingNova, setSavingNova] = useState(false);
  const [form] = Form.useForm<{
    titulo: string;
    descricao?: string;
    tipo?: 'sistema' | 'melhoria';
    sistemaId?: string;
    categoria?: IdeiaCategoria;
  }>();
  const tipoForm = Form.useWatch('tipo', form);
  const inputRef = useRef<InputRef>(null);

  const categoriaCor = useMemo(() => CATEGORIA_COR(t), [t]);

  const loadIdeias = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<Ideia[]>>('getIdeias')
      .then((res) => { if (res.ok && res.data) setIdeias(res.data); })
      .catch(() => setIdeias([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadIdeias();
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((res) => { if (res.ok && res.data) setSistemas(res.data); })
      .catch(() => { /* preview */ });
  }, [loadIdeias]);

  // Captura quick inline: Enter salva e mantém foco (rajada).
  const capturarQuick = async () => {
    const tit = novoTitulo.trim();
    if (!tit) return;
    setSalvandoQuick(true);
    try {
      const r = await callServer<ServerResult>('createIdeia', {
        titulo: tit,
        estado: 'nova',
        criadoEm: new Date().toISOString(),
      });
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      setNovoTitulo('');
      loadIdeias();
      setTimeout(() => inputRef.current?.focus(), 30);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvandoQuick(false);
    }
  };

  const acaoSimples = async (fn: string, id: string, sucesso: string) => {
    try {
      const r = await callServer<ServerResult>(fn, id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success(sucesso);
      loadIdeias();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const concluir = (id: string) => acaoSimples('concluirIdeia', id, 'Concluída ✓');
  const reabrir = (id: string) => acaoSimples('reabrirIdeia', id, 'Reaberta');
  const arquivar = (id: string) => acaoSimples('arquivarIdeia', id, 'Arquivada');
  const descartar = (id: string) => acaoSimples('descartarIdeia', id, 'Descartada');
  const remover = (id: string) => acaoSimples('deleteIdeia', id, 'Apagada');

  // Filtragem pela visão escolhida (inbox/foco/ativas/concluidas/arquivo).
  const matchVisao = useCallback((i: Ideia, v: Visao): boolean => {
    const est = String(i.estado || 'nova').toLowerCase();
    if (est === 'promovida') return false; // promovida não aparece em lugar nenhum (virou backlog/sistema)
    switch (v) {
      case 'inbox': return ehBruta(i);
      case 'foco': return ehFoco(i);
      case 'ativas': return ATIVAS.has(est) && !ehBruta(i);
      case 'concluidas': return est === 'concluida';
      case 'arquivo': return est === 'arquivada' || est === 'descartada';
    }
  }, []);

  const visiveis = useMemo(() => {
    const lista = ideias.filter((i) => matchVisao(i, visao));
    // Ordenação por visão. Inbox/foco/ativas: prioridade primeiro (impacto - esforço).
    // Concluídas: por concluidaEm desc. Arquivo: arquivadaEm desc.
    return lista.sort((a, b) => {
      if (visao === 'concluidas') return String(b.concluidaEm || '').localeCompare(String(a.concluidaEm || ''));
      if (visao === 'arquivo') return String(b.arquivadaEm || b.atualizadoEm || '').localeCompare(String(a.arquivadaEm || a.atualizadoEm || ''));
      // Prioridade declarada bate primeiro, depois score impacto - esforço.
      const prioRank = (p?: string) => p === 'alta' ? 3 : p === 'media' ? 2 : p === 'baixa' ? 1 : 0;
      const dp = prioRank(b.prioridade) - prioRank(a.prioridade);
      if (dp !== 0) return dp;
      return (b.notaImpacto - b.notaEsforco) - (a.notaImpacto - a.notaEsforco);
    });
  }, [ideias, visao, matchVisao]);

  // Agrupamento por tempo (somente em arquivo / concluídas — pra dar referência
  // histórica). Inbox/foco/ativas listam sem agrupar (atenção é o eixo, não o tempo).
  const agrupadas = useMemo(() => {
    if (visao !== 'concluidas' && visao !== 'arquivo') {
      return [{ label: '', itens: visiveis }];
    }
    const campoData = (i: Ideia) => visao === 'concluidas' ? i.concluidaEm : (i.arquivadaEm || i.atualizadoEm);
    const buckets = new Map<string, Ideia[]>();
    for (const it of visiveis) {
      const g = grupoTempo(campoData(it));
      const arr = buckets.get(g) || [];
      arr.push(it);
      buckets.set(g, arr);
    }
    const ordem = ['Hoje', 'Ontem', 'Esta semana', 'Este mês', 'Últimos 3 meses', 'Antigas', 'Sem data'];
    return ordem
      .filter((o) => buckets.has(o))
      .map((label) => ({ label, itens: buckets.get(label) || [] }));
  }, [visiveis, visao]);

  // Contagens pra os badges das visões.
  const contagens = useMemo(() => {
    const c = { inbox: 0, foco: 0, ativas: 0, concluidas: 0, arquivo: 0 };
    for (const i of ideias) {
      const est = String(i.estado || 'nova').toLowerCase();
      if (est === 'promovida') continue;
      if (matchVisao(i, 'inbox')) c.inbox++;
      if (matchVisao(i, 'foco')) c.foco++;
      if (matchVisao(i, 'ativas')) c.ativas++;
      if (est === 'concluida') c.concluidas++;
      if (est === 'arquivada' || est === 'descartada') c.arquivo++;
    }
    return c;
  }, [ideias, matchVisao]);

  // Lista pro modo Foco: pega o que tá na visão atual SE for inbox, foco ou ativas.
  // Senão, abre o batch sobre o inbox (que é o caso de uso natural).
  const filaModoFoco = useMemo(() => {
    if (visao === 'concluidas' || visao === 'arquivo') {
      return ideias.filter((i) => matchVisao(i, 'inbox'));
    }
    return visiveis;
  }, [ideias, visao, visiveis, matchVisao]);

  const nomeSistema = (id?: string) => {
    if (!id) return '';
    const s = sistemas.find((x) => x.id === id);
    return s ? s.nome : '';
  };

  // Cor do estado pra faixa lateral / pill.
  const estadoColor = (e: string): string => ({
    nova: t.accents.blue,
    validando: t.accents.clay,
    'em andamento': t.accents.lavender,
    concluida: t.accents.sage,
    arquivada: t.textTertiary,
    descartada: t.accents.rose,
  } as Record<string, string>)[e] || t.accents.blue;

  const getPrioridade = (impacto: number, esforco: number) => {
    const score = impacto - esforco;
    if (score >= 4) return { label: 'Alta', color: t.accents.sage };
    if (score >= 1) return { label: 'Média', color: t.accents.clay };
    return { label: 'Baixa', color: t.textTertiary };
  };

  const handleNova = async (values: { titulo: string; descricao?: string; tipo?: 'sistema' | 'melhoria'; sistemaId?: string; categoria?: IdeiaCategoria }) => {
    setSavingNova(true);
    try {
      const r = await callServer<ServerResult>('createIdeia', {
        titulo: values.titulo,
        descricao: values.descricao || '',
        tipo: values.tipo || '',
        sistemaId: values.tipo === 'melhoria' ? (values.sistemaId || '') : '',
        categoria: values.categoria || '',
        estado: 'nova',
        notaImpacto: 5,
        notaEsforco: 5,
        criadoEm: new Date().toISOString(),
      });
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Ideia registrada');
      setNovaModalOpen(false);
      form.resetFields();
      loadIdeias();
    } finally { setSavingNova(false); }
  };

  const tagPill = (text: string, color: string, opacity = 1) => (
    <Tag
      bordered={false}
      style={{
        background: `${color}1f`, color, fontSize: 11, borderRadius: 999,
        textTransform: 'capitalize', margin: 0, opacity,
      }}
    >
      {text}
    </Tag>
  );

  const labelComBadge = (visaoKey: Visao) => {
    const n = contagens[visaoKey];
    const meta = VISAO_META[visaoKey];
    const bg = visaoKey === 'inbox' && n > 0 ? t.accents.peach : t.surfaceMuted;
    const cor = visaoKey === 'inbox' && n > 0 ? '#fff' : t.textSecondary;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {meta.icon}
        {meta.label}
        {n > 0 && (
          <span style={{
            background: bg, color: cor, fontSize: 10, fontWeight: 600,
            padding: '1px 7px', borderRadius: 999, fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.4,
          }}>{n}</span>
        )}
      </span>
    );
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1040, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Ideias"
        subtitle="Caixa única: captura zero-fricção, triagem rica, lifecycle completo. Aperte g+x de qualquer tela pra capturar rápido."
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {contagens.inbox >= 3 && (
              <Tooltip title="Despacha o inbox em modo foco — 1 ideia por vez, decide com 1 tecla">
                <Button
                  icon={<Zap size={14} />}
                  onClick={() => { setVisao('inbox'); setModoFoco(true); }}
                  style={{ background: `${t.accents.peach}1f`, color: t.accents.peach, borderColor: `${t.accents.peach}77` }}
                >
                  Triar {contagens.inbox} no Foco
                </Button>
              </Tooltip>
            )}
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); setNovaModalOpen(true); }}>
              Nova ideia
            </Button>
          </div>
        }
      />

      {/* Captura inline sticky no topo — só aparece quando NÃO estamos olhando histórico */}
      {(visao === 'inbox' || visao === 'foco' || visao === 'ativas') && (
        <div style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 20,
          boxShadow: t.shadowSoft,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Sparkles size={18} color={t.accents.peach} />
          <Input
            ref={inputRef}
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onPressEnter={capturarQuick}
            placeholder="Capture uma faísca rapidinho — Enter salva e mantém o foco pra próxima"
            size="large"
            disabled={salvandoQuick}
            maxLength={240}
            style={{
              border: 'none', boxShadow: 'none',
              background: 'transparent',
              fontSize: 15, fontFamily: FONTS.display,
              padding: 0,
            }}
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={capturarQuick}
            loading={salvandoQuick}
            disabled={!novoTitulo.trim()}
          >
            Capturar
          </Button>
        </div>
      )}

      {/* Visões inteligentes (Segmented com badges) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Segmented
          value={visao}
          onChange={(v) => setVisao(v as Visao)}
          options={[
            { label: labelComBadge('inbox'), value: 'inbox' },
            { label: labelComBadge('foco'), value: 'foco' },
            { label: labelComBadge('ativas'), value: 'ativas' },
            { label: labelComBadge('concluidas'), value: 'concluidas' },
            { label: labelComBadge('arquivo'), value: 'arquivo' },
          ]}
        />
        <div style={{ flex: 1 }} />
        {visao === 'inbox' && contagens.inbox > 0 && (
          <Tooltip title="Modo Foco — uma ideia por vez, decide com 1 tecla (C/A/D/G/T)">
            <Button
              size="middle"
              icon={<Target size={13} />}
              onClick={() => setModoFoco(true)}
              type="dashed"
            >
              Modo Foco
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Descrição contextual da visão */}
      <div style={{
        fontSize: 12, color: t.textTertiary,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Filter size={11} /> {VISAO_META[visao].descricao}
      </div>

      {visiveis.length === 0 ? (
        <Empty
          description={
            visao === 'inbox'
              ? 'Inbox vazio. Capture algo no campo acima ou aperte g+x em qualquer tela.'
              : visao === 'foco'
              ? 'Nenhuma ideia em foco no momento. Coloque prioridade "alta" em algo ou capture algo novo.'
              : visao === 'ativas'
              ? 'Sem ideias ativas triadas. Tria algo do Inbox pra aparecer aqui.'
              : visao === 'concluidas'
              ? 'Nenhuma concluída ainda. Marque uma ideia como "concluída" pra construir histórico.'
              : 'Nenhuma ideia no arquivo.'
          }
          style={{ marginTop: 60 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {agrupadas.map((grupo) => (
            <div key={grupo.label || 'tudo'}>
              {grupo.label && (
                <div style={{
                  fontSize: 11, fontWeight: 600, color: t.textTertiary,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  marginBottom: 10, paddingLeft: 4,
                }}>
                  {grupo.label} · {grupo.itens.length}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {grupo.itens.map((ideia) => (
                  <IdeiaCard
                    key={ideia.id}
                    ideia={ideia}
                    sistemaNome={nomeSistema(ideia.sistemaId)}
                    estadoColor={estadoColor}
                    categoriaCor={categoriaCor}
                    getPrioridade={getPrioridade}
                    onTriar={() => setTriando(ideia)}
                    onConcluir={() => concluir(ideia.id)}
                    onReabrir={() => reabrir(ideia.id)}
                    onArquivar={() => arquivar(ideia.id)}
                    onDescartar={() => descartar(ideia.id)}
                    onApagar={() => remover(ideia.id)}
                    onGenese={() => onGenese(ideia.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <IdeiaTriagemDrawer
        ideia={triando}
        open={!!triando}
        onClose={() => setTriando(null)}
        onChanged={loadIdeias}
        onGenese={onGenese}
        sistemas={sistemas}
      />

      <IdeiaTriagemBatch
        ideias={filaModoFoco}
        sistemas={sistemas}
        open={modoFoco}
        onClose={() => { setModoFoco(false); loadIdeias(); }}
        onChanged={loadIdeias}
        onGenese={onGenese}
      />

      {/* Modal "Nova ideia" — captura rica (vs quick inline). Pra quem já sabe
          o destino e quer salvar com tipo/sistema/categoria de uma vez. */}
      <Modal
        title="Nova ideia"
        open={novaModalOpen}
        onCancel={() => setNovaModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={savingNova}
        destroyOnClose
        okText="Capturar"
      >
        <Form form={form} layout="vertical" onFinish={handleNova} initialValues={{ tipo: 'sistema' }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Nome curto da ideia" autoFocus />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição (opcional)">
            <Input.TextArea rows={3} placeholder="O que é? Qual problema resolve?" />
          </Form.Item>
          <Form.Item name="tipo" label="Tipo">
            <Select options={[
              { value: 'sistema', label: 'Novo sistema (vai pra Gênese)' },
              { value: 'melhoria', label: 'Melhoria de um sistema existente' },
            ]} />
          </Form.Item>
          {tipoForm === 'melhoria' && (
            <Form.Item name="sistemaId" label="Sistema" extra="Opcional — pode destinar depois.">
              <Select allowClear showSearch optionFilterProp="label"
                options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
            </Form.Item>
          )}
          <Form.Item name="categoria" label="Categoria (opcional)">
            <Select
              allowClear placeholder="Classifica a natureza"
              options={Object.entries(CATEGORIA_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Card de ideia (extraído pra isolar estado de hover) ─────────────────────

interface IdeiaCardProps {
  ideia: Ideia;
  sistemaNome: string;
  estadoColor: (e: string) => string;
  categoriaCor: Record<string, string>;
  getPrioridade: (i: number, e: number) => { label: string; color: string };
  onTriar: () => void;
  onConcluir: () => void;
  onReabrir: () => void;
  onArquivar: () => void;
  onDescartar: () => void;
  onApagar: () => void;
  onGenese: () => void;
}

function IdeiaCard({
  ideia, sistemaNome, estadoColor, categoriaCor, getPrioridade,
  onTriar, onConcluir, onReabrir, onArquivar, onDescartar, onApagar, onGenese,
}: IdeiaCardProps): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);

  const tipo = tipoDe(ideia);
  const prio = getPrioridade(ideia.notaImpacto || 0, ideia.notaEsforco || 0);
  const estado = (ideia.estado || 'nova').toLowerCase();
  const concluida = estado === 'concluida';
  const arquivada = estado === 'arquivada';
  const descartada = estado === 'descartada';
  const inativa = arquivada || descartada;
  const bruta = ehBruta(ideia);
  const corEstado = estadoColor(estado);

  // Mini-barra visual impacto/esforço.
  const impactoBar = '■'.repeat(Math.min(10, Math.max(0, ideia.notaImpacto || 0))) + '░'.repeat(10 - Math.min(10, Math.max(0, ideia.notaImpacto || 0)));

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onTriar}
      style={{
        background: t.surface,
        border: `1px solid ${hover ? t.border : t.borderSoft}`,
        borderRadius: 14,
        boxShadow: hover ? t.shadow : t.shadowSoft,
        padding: '16px 18px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        opacity: inativa ? 0.7 : 1,
        minHeight: 130,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Faixa lateral colorida no estado */}
      <div style={{
        position: 'absolute', left: 0, top: 18, bottom: 18, width: 3,
        background: corEstado, borderRadius: 999,
      }} />

      {/* Linha 1: título + estado (pill) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Text strong style={{
          color: t.text,
          fontSize: 15,
          fontFamily: FONTS.display,
          fontWeight: 600,
          lineHeight: 1.3,
          textDecoration: concluida ? 'line-through' : 'none',
        }}>
          {bruta && <Inbox size={13} color={t.accents.peach} style={{ marginRight: 6, verticalAlign: -1 }} />}
          {ideia.titulo}
        </Text>
        <Tag bordered={false} style={{
          background: `${corEstado}1f`, color: corEstado, fontSize: 10,
          borderRadius: 999, margin: 0, textTransform: 'capitalize', fontWeight: 600,
        }}>
          {concluida && <Check size={10} style={{ verticalAlign: -1, marginRight: 3 }} />}
          {ESTADO_LABEL[estado] || estado}
        </Tag>
      </div>

      {/* Linha 2: tags semânticas (categoria, tipo, sistema) */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {ideia.categoria && categoriaCor[ideia.categoria] && (
          <Tag bordered={false} style={{
            background: `${categoriaCor[ideia.categoria]}1f`,
            color: categoriaCor[ideia.categoria],
            fontSize: 10, borderRadius: 999, margin: 0, fontWeight: 500,
          }}>
            {CATEGORIA_LABEL[ideia.categoria] || ideia.categoria}
          </Tag>
        )}
        {tipo === 'melhoria' && (
          <Tag bordered={false} icon={<Lightbulb size={10} style={{ marginRight: 3, verticalAlign: -1 }} />}
            style={{ background: `${t.accents.clay}1f`, color: t.accents.clay, fontSize: 10, borderRadius: 999, margin: 0 }}>
            Melhoria{sistemaNome ? ` · ${sistemaNome}` : ''}
          </Tag>
        )}
        {tipo === 'sistema' && !ideia.categoria && (
          <Tag bordered={false} icon={<Rocket size={10} style={{ marginRight: 3, verticalAlign: -1 }} />}
            style={{ background: `${t.accents.peach}1f`, color: t.accents.peach, fontSize: 10, borderRadius: 999, margin: 0 }}>
            Sistema
          </Tag>
        )}
        {ideia.prioridade && (
          <Tag bordered={false} style={{
            background: `${ideia.prioridade === 'alta' ? t.accents.rose : ideia.prioridade === 'media' ? t.accents.clay : t.accents.blue}1f`,
            color: ideia.prioridade === 'alta' ? t.accents.rose : ideia.prioridade === 'media' ? t.accents.clay : t.accents.blue,
            fontSize: 10, borderRadius: 999, margin: 0, textTransform: 'capitalize', fontWeight: 500,
          }}>
            {ideia.prioridade}
          </Tag>
        )}
      </div>

      {/* Descrição */}
      {ideia.descricao && (
        <Paragraph style={{
          color: t.textSecondary,
          fontSize: 13,
          margin: 0,
          textDecoration: concluida ? 'line-through' : 'none',
        }} ellipsis={{ rows: 2 }}>
          {ideia.descricao}
        </Paragraph>
      )}

      {/* Score visual (mini-barra impacto/esforço) — só pra sistema/quando tem score */}
      {tipo === 'sistema' && !inativa && !concluida && (ideia.notaImpacto > 0 || ideia.notaEsforco > 0) && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: t.textTertiary }}>
          <Tooltip title={`Impacto ${ideia.notaImpacto || 0}/10 · Esforço ${ideia.notaEsforco || 0}/10`}>
            <span style={{ fontFamily: FONTS.mono, color: prio.color }}>
              {impactoBar.slice(0, Math.max(0, (ideia.notaImpacto || 0) - (ideia.notaEsforco || 0) + 5))}
            </span>
          </Tooltip>
          <span>{prio.label}</span>
        </div>
      )}

      {/* Rodapé: tempo + ações ao hover */}
      <div style={{
        marginTop: 'auto', paddingTop: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        borderTop: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{ fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
          {concluida && ideia.concluidaEm ? (
            <Tooltip title={new Date(ideia.concluidaEm).toLocaleString('pt-BR')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Check size={11} /> concluída {tempoRelativo(ideia.concluidaEm)}
              </span>
            </Tooltip>
          ) : ideia.criadoEm ? (
            <Tooltip title={`Criada em ${new Date(ideia.criadoEm).toLocaleString('pt-BR')}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} /> {tempoRelativo(ideia.criadoEm)}
              </span>
            </Tooltip>
          ) : null}
        </div>

        {/* Ações ao hover */}
        <div
          style={{
            display: 'flex', gap: 2,
            opacity: hover ? 1 : 0,
            transition: 'opacity 0.18s ease',
            pointerEvents: hover ? 'auto' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!inativa && !concluida && (
            <Tooltip title="Marcar como concluída">
              <Button size="small" type="text" icon={<Check size={13} />} onClick={onConcluir} style={{ color: t.accents.sage }} />
            </Tooltip>
          )}
          {(concluida || inativa) && (
            <Tooltip title="Reabrir">
              <Button size="small" type="text" icon={<RotateCcw size={13} />} onClick={onReabrir} />
            </Tooltip>
          )}
          {tipo === 'sistema' && !concluida && !inativa && (
            <Tooltip title="Levar pra Gênese (virar sistema)">
              <Button size="small" type="text" icon={<Sparkles size={13} />} onClick={onGenese} style={{ color: t.accents.peach }} />
            </Tooltip>
          )}
          <Tooltip title="Triar / editar">
            <Button size="small" type="text" icon={<Pencil size={13} />} onClick={onTriar} />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                !arquivada && !concluida && {
                  key: 'arquivar',
                  icon: <Archive size={13} />,
                  label: 'Arquivar (mantém histórico)',
                  onClick: onArquivar,
                },
                !descartada && {
                  key: 'descartar',
                  icon: <XCircle size={13} />,
                  label: 'Descartar',
                  onClick: onDescartar,
                },
                { type: 'divider' as const },
                {
                  key: 'apagar',
                  icon: <Trash2 size={13} />,
                  danger: true,
                  label: (
                    <Popconfirm
                      title="Apagar permanentemente?"
                      description="Diferente de descartar, isso some sem histórico."
                      onConfirm={onApagar}
                      okText="Apagar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                    >
                      <span>Apagar permanentemente</span>
                    </Popconfirm>
                  ),
                },
              ].filter(Boolean) as Array<{ key: string }>,
            }}
            trigger={['click']}
          >
            <Button size="small" type="text" icon={<MoreHorizontal size={13} />} />
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
