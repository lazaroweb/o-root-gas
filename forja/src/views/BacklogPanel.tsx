// BacklogPanel — Kanban visual de Decisões/Backlog por sistema.
//
// Filosofia: a tabela "Decisoes" do SheetDB serve hoje como backlog acionável.
// Itens criados pela auditoria da IA entram em "backlog"; o usuário arrasta
// pra "fazendo" quando começa a codar e pra "feito" quando termina.
//
// O painel também expõe um botão "Exportar prompt" que serializa todo o
// backlog em markdown com instruções pra colar direto no Cursor/Claude —
// fechando o ciclo Forja → IA externa → Forja.
import React, { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Form, Input, Select, App as AntApp, Tag, Empty, Tooltip, Popconfirm, Drawer, Space, Typography, Segmented } from 'antd';
import { Plus, Download, Copy, Edit3, Trash2, ArrowRight, ArrowLeft, Sparkles, GripVertical, Layers, RefreshCw, Bug } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Decisao, ServerResult } from '../types';

const { Text, Paragraph } = Typography;

interface BacklogPanelProps {
  sistemaId: string;
  sistemaNome?: string;
}

// Definição visual das colunas do Kanban. A ordem importa — define o flow.
// `corKey` é referência ao tema (usado pra topbar colorida da coluna).
// Aliases legados ('ativa', 'revista', 'revertida') são mapeados pra colunas
// equivalentes pra dados antigos não ficarem órfãos.
const COLUNAS: Array<{ id: string; label: string; subtitulo: string; aceita: string[]; emoji: string; corKey: 'peach' | 'blue' | 'sage' | 'rose' | 'textTertiary' }> = [
  { id: 'backlog', label: 'A fazer', subtitulo: 'Itens registrados, sem trabalho ainda', aceita: ['backlog', 'ativa', ''], emoji: '📥', corKey: 'peach' },
  { id: 'fazendo', label: 'Fazendo', subtitulo: 'Em execução agora', aceita: ['fazendo'], emoji: '🔨', corKey: 'blue' },
  { id: 'pausado', label: 'Pausado', subtitulo: 'Aguardando algo externo', aceita: ['pausado', 'revista'], emoji: '⏸️', corKey: 'textTertiary' },
  { id: 'feito', label: 'Feito', subtitulo: 'Concluído', aceita: ['feito'], emoji: '✅', corKey: 'sage' },
  { id: 'cancelado', label: 'Cancelado', subtitulo: 'Descartado, não vai acontecer', aceita: ['cancelado', 'revertida'], emoji: '🚫', corKey: 'rose' },
];

const PRIO_CFG: Record<string, { cor: string; label: string; dot: string }> = {
  alta: { cor: '#E85555', label: 'Alta', dot: '●' },
  media: { cor: '#E8A838', label: 'Média', dot: '●' },
  baixa: { cor: '#3B82F6', label: 'Baixa', dot: '●' },
};

interface FormValues {
  titulo: string;
  decisao: string;
  justificativa?: string;
  status: string;
  prioridade: string;
  tags?: string;
  estimativa?: string;
}

export default function BacklogPanel({ sistemaId, sistemaNome }: BacklogPanelProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [drawerItem, setDrawerItem] = useState<Decisao | null>(null);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [exportandoPrompt, setExportandoPrompt] = useState(false);
  const [form] = Form.useForm<FormValues>();

  // O id do item sendo arrastado fica em estado pra HTML5 drag funcionar com
  // typesafe entre todos os handlers (dataTransfer perde tipos em React).
  const [arrastando, setArrastando] = useState<string | null>(null);

  // Quantidade de decisões/riscos órfãos detectadas no portfólio (sistemaId
  // vazio ou inválido). Quando > 0, oferecemos recuperação na empty state.
  const [orfas, setOrfas] = useState<{ decisoesOrfas: number; riscosOrfos: number } | null>(null);
  // Quantidade do sumário (vem do mesmo agregador que alimenta os badges).
  // Se sumario > 0 mas decisoes.length === 0, temos uma discrepância e
  // ativamos o painel de diagnóstico abaixo.
  const [sumarioCount, setSumarioCount] = useState<number>(0);
  // Resultado bruto do diagnóstico — só preenchido quando o user clica.
  const [diagnostico, setDiagnostico] = useState<Record<string, unknown> | null>(null);

  const carregar = () => {
    setLoading(true);
    setDecisoes([]); // reset pra refletir o estado novo
    // Usa o endpoint "rico" novo que aplica o MESMO critério do sumário —
    // garante consistência entre o badge (que vem do sumário) e a lista.
    callServer<ServerResult>('getBacklogItensSistema', sistemaId)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { itens: Decisao[]; total: number; sistemaIdConsultado: string; totalNaPlanilha: number };
          setDecisoes(d.itens || []);
        } else if (!r.ok) {
          message.error('getBacklogItensSistema: ' + (r.error || 'erro'));
        }
      })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
    // Em paralelo, checa órfãos pra eventual recuperação
    callServer<ServerResult>('diagnosticarDecisoesOrfas', {}).then((r) => {
      if (r.ok && r.data) {
        const d = r.data as { decisoesOrfas: number; riscosOrfos: number };
        if ((d.decisoesOrfas || 0) + (d.riscosOrfos || 0) > 0) setOrfas(d);
        else setOrfas(null);
      }
    }).catch(() => { /* não bloqueia */ });
    // Lê o sumário pra comparar com a query direta
    callServer<ServerResult>('getBacklogSumario').then((r) => {
      if (r.ok && r.data) {
        const tudo = r.data as Record<string, { aFazer: number; fazendo: number; total: number }>;
        const meu = tudo[sistemaId];
        setSumarioCount(meu ? (meu.aFazer + meu.fazendo) : 0);
      }
    }).catch(() => { /* segue */ });
  };

  const [diagOpen, setDiagOpen] = useState(false);

  const rodarDiagnostico = async () => {
    setDiagOpen(true);
    setDiagnostico(null);
    try {
      const r = await callServer<ServerResult>('diagnosticarBacklogSistema', sistemaId);
      if (r.ok && r.data) setDiagnostico(r.data as Record<string, unknown>);
      else {
        message.error(r.error || 'Erro no diagnóstico');
        setDiagnostico({ erro: r.error || 'erro desconhecido' });
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
      setDiagnostico({ erro: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => { carregar(); }, [sistemaId]);

  const recuperarOrfas = async () => {
    try {
      const r = await callServer<ServerResult>('diagnosticarDecisoesOrfas', { sistemaIdDestino: sistemaId });
      if (r.ok && r.data) {
        const d = r.data as { decisoesCorrigidas: number; riscosCorrigidos: number };
        message.success(`Recuperado: ${d.decisoesCorrigidas} decisão(ões) e ${d.riscosCorrigidos} risco(s) amarrados a este sistema`);
        setOrfas(null);
        carregar();
      } else {
        message.error(r.error || 'Erro ao recuperar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  // Agrupa decisões por coluna. Items com status desconhecido caem em
  // "backlog" pra não sumirem da view.
  const porColuna = useMemo(() => {
    const mapa: Record<string, Decisao[]> = {};
    for (const c of COLUNAS) mapa[c.id] = [];
    for (const d of decisoes) {
      if (filtroPrioridade !== 'todas' && String(d.prioridade || 'media') !== filtroPrioridade) continue;
      const status = String(d.status || '').toLowerCase();
      const coluna = COLUNAS.find((c) => c.aceita.includes(status)) || COLUNAS[0];
      mapa[coluna.id].push(d);
    }
    // Ordena por prioridade dentro de cada coluna
    const ord: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    for (const k of Object.keys(mapa)) {
      mapa[k].sort((a, b) => (ord[String(a.prioridade || 'media').toLowerCase()] ?? 1) - (ord[String(b.prioridade || 'media').toLowerCase()] ?? 1));
    }
    return mapa;
  }, [decisoes, filtroPrioridade]);

  const abrirNovo = (statusInicial: string = 'backlog') => {
    setEditandoId(null);
    form.resetFields();
    form.setFieldsValue({ status: statusInicial, prioridade: 'media' });
    setModalOpen(true);
  };

  const abrirEditar = (d: Decisao) => {
    setEditandoId(d.id);
    form.setFieldsValue({
      titulo: d.titulo,
      decisao: d.decisao,
      justificativa: d.justificativa,
      status: d.status || 'backlog',
      prioridade: d.prioridade || 'media',
      tags: d.tags || '',
      estimativa: d.estimativa || '',
    });
    setModalOpen(true);
  };

  const salvar = async (v: FormValues) => {
    setSalvando(true);
    try {
      const payload = { ...v, sistemaId, data: new Date().toISOString().slice(0, 10) };
      if (editandoId) {
        await callServer('updateDecisao', editandoId, payload);
        message.success('Item atualizado');
      } else {
        await callServer('createDecisao', payload);
        message.success('Item adicionado ao backlog');
      }
      setModalOpen(false);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const mover = async (id: string, novoStatus: string) => {
    // Update otimista pra arrastar parecer instantâneo
    setDecisoes((cur) => cur.map((d) => (d.id === id ? { ...d, status: novoStatus } : d)));
    try {
      const r = await callServer<ServerResult>('moverDecisaoStatus', { id, status: novoStatus });
      if (!r.ok) {
        message.error(r.error || 'Não consegui mover');
        carregar();
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
      carregar();
    }
  };

  const remover = async (id: string) => {
    try {
      const r = await callServer<ServerResult>('deleteDecisao', id);
      if (r.ok) {
        message.success('Removido');
        setDrawerItem(null);
        carregar();
      } else {
        message.error(r.error || 'Não consegui remover');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const baixarPrompt = async () => {
    setExportandoPrompt(true);
    try {
      const r = await callServer<ServerResult>('gerarPromptBacklog', sistemaId);
      if (r.ok && r.data) {
        const d = r.data as { markdown: string; total: number };
        const blob = new Blob([d.markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backlog-${(sistemaNome || sistemaId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 200);
        message.success(`Backlog baixado (${d.total} item(s))`);
      } else {
        message.error(r.error || 'Erro ao gerar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setExportandoPrompt(false);
    }
  };

  const copiarPrompt = async () => {
    setExportandoPrompt(true);
    try {
      const r = await callServer<ServerResult>('gerarPromptBacklog', sistemaId);
      if (r.ok && r.data) {
        const d = r.data as { markdown: string; total: number };
        await navigator.clipboard.writeText(d.markdown);
        message.success(`Prompt copiado (${d.total} item(s)) — cole no Cursor ou Claude`);
      } else {
        message.error(r.error || 'Erro');
      }
    } catch {
      message.error('Não consegui copiar — tente baixar como .md');
    } finally {
      setExportandoPrompt(false);
    }
  };

  const totalItens = decisoes.length;
  const totalBacklog = porColuna.backlog?.length || 0;
  const totalFazendo = porColuna.fazendo?.length || 0;
  const totalFeito = porColuna.feito?.length || 0;

  return (
    <div>
      {/* Header com resumo + ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Layers size={18} color={t.accents.peach} />
            <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text }}>Backlog</span>
            <Tag color="default" style={{ fontFamily: FONTS.mono, marginInlineEnd: 0 }}>{totalItens} item(s)</Tag>
          </div>
          <Text style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, lineHeight: 1.5 }}>
            Itens vindos da auditoria da IA e do seu próprio registro. Arraste entre colunas, clique em qualquer card pra ver detalhes, ou exporte tudo como prompt pra colar no Cursor / Claude.
          </Text>
          <div style={{ marginTop: 8, display: 'flex', gap: 14, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
            <span>📥 {totalBacklog} a fazer</span>
            <span>🔨 {totalFazendo} fazendo</span>
            <span>✅ {totalFeito} feito</span>
          </div>
        </div>
        <Space wrap>
          <Segmented
            size="small"
            value={filtroPrioridade}
            onChange={(v) => setFiltroPrioridade(v as string)}
            options={[
              { label: 'Todas', value: 'todas' },
              { label: 'Alta', value: 'alta' },
              { label: 'Média', value: 'media' },
              { label: 'Baixa', value: 'baixa' },
            ]}
          />
          <Tooltip title="Atualizar lista do servidor">
            <Button size="small" icon={<RefreshCw size={13} />} onClick={carregar} loading={loading} />
          </Tooltip>
          <Tooltip title="Diagnóstico: mostra exatamente o que tem na planilha de Decisões. Use quando o badge da tab mostra contagem mas o painel está vazio.">
            <Button size="small" icon={<Bug size={13} />} onClick={rodarDiagnostico}>Debug</Button>
          </Tooltip>
          <Tooltip title="Copia todo o backlog (a fazer + fazendo) como prompt pronto pra colar no Cursor ou Claude">
            <Button size="small" icon={<Copy size={13} />} onClick={copiarPrompt} loading={exportandoPrompt}>Copiar prompt</Button>
          </Tooltip>
          <Tooltip title="Baixa o backlog como arquivo markdown">
            <Button size="small" icon={<Download size={13} />} onClick={baixarPrompt} loading={exportandoPrompt}>Baixar .md</Button>
          </Tooltip>
          <Button type="primary" size="small" icon={<Plus size={13} />} onClick={() => abrirNovo()}>Adicionar item</Button>
        </Space>
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>Carregando…</div>
      ) : totalItens === 0 ? (
        <Empty
          description={
            <div style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
              <Text style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, display: 'block', marginBottom: 6 }}>
                Backlog vazio.
              </Text>
              <Text style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.55 }}>
                Rode uma <strong>Auditoria Forja IA</strong> lá em cima — cada achado vira um item aqui que você pode arrastar entre colunas. Ou clique em <strong>Adicionar item</strong> pra registrar manualmente.
              </Text>

              {/* DISCREPÂNCIA CRÍTICA: badge na tab diz que existem N itens mas a
                  query direta retornou 0. Mostra diagnóstico cirúrgico inline. */}
              {sumarioCount > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: `${t.accents.rose}15`, border: `1px solid ${t.accents.rose}55`, borderRadius: 10, textAlign: 'left' }}>
                  <Text style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.text, display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    ⚠️ Discrepância detectada
                  </Text>
                  <Text style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 10, lineHeight: 1.5 }}>
                    O sumário diz que existem <strong>{sumarioCount} item(s)</strong> com este sistemaId, mas a busca direta voltou vazia. Provavelmente o sistemaId tem espaço/quebra de linha no Sheets. Clica abaixo pra eu te mostrar o que tem na planilha.
                  </Text>
                  <Button size="small" type="primary" danger onClick={rodarDiagnostico}>
                    Rodar diagnóstico
                  </Button>
                  {diagnostico && (
                    <pre
                      style={{
                        marginTop: 10, padding: 10, background: t.surface, border: `1px solid ${t.borderSoft}`,
                        borderRadius: 8, fontFamily: FONTS.mono, fontSize: 10.5, color: t.textSecondary,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 320, overflow: 'auto', textAlign: 'left',
                      }}
                    >
                      {JSON.stringify(diagnostico, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Recuperação automática: detecta decisões/riscos órfãos (sistemaId vazio
                  ou inválido — vinha da IA mandando "<ID>" placeholder) e oferece
                  amarrar tudo a este sistema. Resolve registros que sumiram. */}
              {orfas && (orfas.decisoesOrfas + orfas.riscosOrfos) > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: `${t.accents.peach}15`, border: `1px solid ${t.accents.peach}55`, borderRadius: 10, textAlign: 'left' }}>
                  <Text style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.text, display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    🔎 Detectei {orfas.decisoesOrfas} decisão(ões) e {orfas.riscosOrfos} risco(s) órfãos no portfólio
                  </Text>
                  <Text style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 10, lineHeight: 1.5 }}>
                    Provavelmente foram criados pela auditoria da IA sem amarrar ao sistema certo (bug de versão anterior). Quer vincular tudo a <strong>{sistemaNome || 'este sistema'}</strong> agora?
                  </Text>
                  <Button size="small" type="primary" onClick={recuperarOrfas} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
                    Vincular {orfas.decisoesOrfas + orfas.riscosOrfos} item(ns) a este sistema
                  </Button>
                </div>
              )}

              {/* Atalho contextual: só mostra pro próprio sistema Forja, semeia o roadmap v2.0 */}
              {(sistemaNome || '').toLowerCase().includes('forja') && (
                <div style={{ marginTop: 16, padding: 12, background: t.surfaceMuted, border: `1px dashed ${t.borderSoft}`, borderRadius: 10 }}>
                  <Text style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, display: 'block', marginBottom: 8 }}>
                    Detectei que este é o próprio sistema <strong>Forja</strong>. Quer semear o roadmap v2.0 que a gente registrou durante o desenvolvimento?
                  </Text>
                  <Button
                    size="small"
                    icon={<Sparkles size={13} />}
                    onClick={async () => {
                      try {
                        const r = await callServer<ServerResult>('seedForjaV2Backlog', sistemaId);
                        if (r.ok && r.data) {
                          const d = r.data as { criados: number; mensagem: string };
                          message.success(d.mensagem || `${d.criados} itens adicionados`);
                          carregar();
                        } else {
                          message.error(r.error || 'Erro ao semear');
                        }
                      } catch (e) {
                        message.error(e instanceof Error ? e.message : 'Erro');
                      }
                    }}
                  >
                    Semear roadmap Forja v2.0
                  </Button>
                </div>
              )}
            </div>
          }
          style={{ padding: '40px 0' }}
        />
      ) : (
        // Kanban com scroll horizontal quando a tela é estreita demais pra 5
        // colunas. Em telas largas as colunas se expandem pra ocupar o espaço.
        // Cada coluna tem uma barrinha colorida no topo pra identidade visual.
        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(196px, 1fr)',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollSnapType: 'x mandatory',
          }}
        >
          {COLUNAS.map((coluna) => {
            const itens = porColuna[coluna.id] || [];
            const corColuna = coluna.corKey === 'textTertiary' ? t.textTertiary : t.accents[coluna.corKey];
            return (
              <div
                key={coluna.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = arrastando || e.dataTransfer.getData('text/decisao-id');
                  if (id) void mover(id, coluna.id);
                  setArrastando(null);
                }}
                style={{
                  background: t.surfaceMuted,
                  border: `1px solid ${t.borderSoft}`,
                  borderRadius: 12,
                  padding: 0,
                  minHeight: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  scrollSnapAlign: 'start',
                  transition: 'background 0.15s',
                }}
              >
                {/* Barra colorida + header da coluna */}
                <div
                  style={{
                    background: `linear-gradient(90deg, ${corColuna}33, ${corColuna}0d)`,
                    borderBottom: `1px solid ${t.borderSoft}`,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: corColuna,
                    }}
                  />
                  <span style={{ fontSize: 14, marginLeft: 4 }}>{coluna.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, letterSpacing: '0.02em' }}>
                        {coluna.label}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 18, height: 18, padding: '0 5px',
                          borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: corColuna,
                          color: '#fff',
                          fontFamily: FONTS.ui,
                          opacity: itens.length > 0 ? 1 : 0.4,
                        }}
                      >
                        {itens.length}
                      </span>
                    </div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, lineHeight: 1.3, marginTop: 1 }}>{coluna.subtitulo}</div>
                  </div>
                  <Tooltip title={`Adicionar direto em ${coluna.label}`}>
                    <Button type="text" size="small" icon={<Plus size={12} />} onClick={() => abrirNovo(coluna.id)} />
                  </Tooltip>
                </div>

                {/* Conteúdo da coluna — scrollável quando muito cheio */}
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
                  {itens.length === 0 && (
                    <div
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: t.textTertiary, fontSize: 10.5, fontFamily: FONTS.ui,
                        opacity: 0.5, padding: '24px 8px', textAlign: 'center',
                        border: `1px dashed ${t.borderSoft}`, borderRadius: 8,
                        minHeight: 80,
                      }}
                    >
                      arraste cards aqui
                    </div>
                  )}

                  {itens.map((item) => (
                    <CardKanban
                      key={item.id}
                      item={item}
                      onClick={() => setDrawerItem(item)}
                      onDragStart={() => setArrastando(item.id)}
                      onDragEnd={() => setArrastando(null)}
                      onAvancar={() => {
                        const idx = COLUNAS.findIndex((c) => c.id === coluna.id);
                        const proximo = COLUNAS[idx + 1];
                        if (proximo) void mover(item.id, proximo.id);
                      }}
                      onVoltar={() => {
                        const idx = COLUNAS.findIndex((c) => c.id === coluna.id);
                        const anterior = COLUNAS[idx - 1];
                        if (anterior) void mover(item.id, anterior.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criar/editar */}
      <Modal
        title={editandoId ? 'Editar item do backlog' : 'Adicionar item ao backlog'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        destroyOnClose
        width={560}
        okText={editandoId ? 'Salvar' : 'Adicionar'}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={salvar} initialValues={{ status: 'backlog', prioridade: 'media' }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Criar página de login" />
          </Form.Item>
          <Form.Item name="decisao" label="O que precisa ser feito" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="Descreva o que esse item resolve / o que tem que ser implementado" />
          </Form.Item>
          <Form.Item name="justificativa" label="Por quê / contexto">
            <Input.TextArea rows={3} placeholder="Opcional. Por que isso importa? Qual o problema?" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="status" label="Coluna">
              <Select options={COLUNAS.map((c) => ({ value: c.id, label: c.emoji + ' ' + c.label }))} />
            </Form.Item>
            <Form.Item name="prioridade" label="Prioridade">
              <Select options={[
                { value: 'alta', label: 'Alta' },
                { value: 'media', label: 'Média' },
                { value: 'baixa', label: 'Baixa' },
              ]} />
            </Form.Item>
            <Form.Item name="estimativa" label="Estimativa">
              <Input placeholder="Ex: 2h, 1d" />
            </Form.Item>
          </div>
          <Form.Item name="tags" label="Tags" extra="Separe por vírgula. Ex: auditoria, performance, ux">
            <Input placeholder="auditoria, performance" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de diagnóstico — mostra os campos brutos da planilha pra
          identificar por que itens não aparecem mesmo quando o sumário diz
          que existem. Sempre acessível via botão "Debug" no header. */}
      <Modal
        title="🔍 Diagnóstico do Backlog"
        open={diagOpen}
        onCancel={() => setDiagOpen(false)}
        footer={
          <Space>
            <Button onClick={() => {
              if (diagnostico) {
                void navigator.clipboard.writeText(JSON.stringify(diagnostico, null, 2));
                message.success('JSON copiado');
              }
            }}>Copiar JSON</Button>
            <Button type="primary" onClick={() => setDiagOpen(false)}>Fechar</Button>
          </Space>
        }
        width={720}
      >
        {!diagnostico ? (
          <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary }}>Carregando diagnóstico…</div>
        ) : (
          <div>
            <Text style={{ fontSize: 12, color: t.textTertiary, display: 'block', marginBottom: 10 }}>
              Compara o sistemaId esperado com o que está armazenado em cada linha da aba Decisoes. Se <strong>batemTrim</strong> &gt; 0 mas <strong>batemEstrito</strong> = 0, tem espaço/quebra de linha no Sheets.
            </Text>
            <pre
              style={{
                padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                borderRadius: 8, fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 480, overflow: 'auto',
              }}
            >
              {JSON.stringify(diagnostico, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* Drawer de detalhes do card */}
      <Drawer
        title={drawerItem?.titulo || 'Detalhes'}
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        width={520}
        extra={
          drawerItem && (
            <Space>
              <Button size="small" icon={<Edit3 size={13} />} onClick={() => { abrirEditar(drawerItem); setDrawerItem(null); }}>Editar</Button>
              <Popconfirm title="Remover este item?" onConfirm={() => remover(drawerItem.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<Trash2 size={13} />}>Remover</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {drawerItem && <DrawerConteudo item={drawerItem} mover={(s) => { void mover(drawerItem.id, s); setDrawerItem({ ...drawerItem, status: s }); }} />}
      </Drawer>
    </div>
  );
}

// ─── Card visual dentro de uma coluna do Kanban ─────────────────────────────
function CardKanban({
  item, onClick, onDragStart, onDragEnd, onAvancar, onVoltar,
}: {
  item: Decisao;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAvancar: () => void;
  onVoltar: () => void;
}): React.ReactElement {
  const t = useTokens();
  const prio = PRIO_CFG[String(item.prioridade || 'media').toLowerCase()] || PRIO_CFG.media;
  const tags = String(item.tags || '').split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/decisao-id', item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="forja-kanban-card"
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: '10px 12px 9px',
        cursor: 'grab',
        boxShadow: t.shadowSoft,
        position: 'relative',
        transition: 'transform 0.14s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${prio.cor}66`;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = t.shadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = t.shadowSoft;
      }}
    >
      {/* Faixinha de prioridade no topo do card (mais sutil que a borda lateral grossa) */}
      <span style={{ position: 'absolute', left: 10, right: 10, top: 0, height: 2, background: prio.cor, borderRadius: 999 }} />

      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 500, color: t.text, lineHeight: 1.45, marginBottom: 8, marginTop: 2 }}>
        {item.titulo}
      </div>

      {/* Linha de metadados */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: prio.cor, fontWeight: 600 }}>
          <span style={{ fontSize: 7 }}>●</span>{prio.label}
        </span>
        {item.estimativa && <span style={{ color: t.textTertiary }}>· {item.estimativa}</span>}
        {tags.length > 0 && (
          <span style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
            {tags.slice(0, 2).map((tag, i) => (
              <span key={i} style={{ background: t.surfaceMuted, padding: '0 5px', borderRadius: 999, fontSize: 9.5, color: t.textSecondary }}>
                {tag}
              </span>
            ))}
            {tags.length > 2 && <span style={{ fontSize: 9.5 }}>+{tags.length - 2}</span>}
          </span>
        )}
      </div>

      {/* Controles compactos (só aparecem on hover via CSS .forja-kanban-card:hover) */}
      <div className="forja-card-actions" style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
        <Tooltip title="Mover pra coluna anterior" mouseEnterDelay={0.6}>
          <button
            onClick={(e) => { e.stopPropagation(); onVoltar(); }}
            style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, cursor: 'pointer', color: t.textTertiary, width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <ArrowLeft size={11} />
          </button>
        </Tooltip>
        <Tooltip title="Mover pra próxima coluna" mouseEnterDelay={0.6}>
          <button
            onClick={(e) => { e.stopPropagation(); onAvancar(); }}
            style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 6, cursor: 'pointer', color: t.textTertiary, width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <ArrowRight size={11} />
          </button>
        </Tooltip>
      </div>

      {/* GripVertical sutil no fundo direito pra mostrar arrastabilidade */}
      <GripVertical
        size={10}
        color={t.textTertiary}
        style={{ position: 'absolute', bottom: 6, right: 8, opacity: 0.25, pointerEvents: 'none' }}
      />
    </div>
  );
}

// ─── Conteúdo do Drawer de detalhes ─────────────────────────────────────────
function DrawerConteudo({ item, mover }: { item: Decisao; mover: (s: string) => void }): React.ReactElement {
  const t = useTokens();
  const prio = PRIO_CFG[String(item.prioridade || 'media').toLowerCase()] || PRIO_CFG.media;
  const tags = String(item.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const colunaAtual = COLUNAS.find((c) => c.aceita.includes(String(item.status || '').toLowerCase())) || COLUNAS[0];

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color={prio.cor} style={{ fontWeight: 700 }}>{prio.label}</Tag>
        <Tag>{colunaAtual.emoji} {colunaAtual.label}</Tag>
        {item.estimativa && <Tag style={{ background: t.surfaceMuted }}>⏱ {item.estimativa}</Tag>}
        {item.data && <Tag style={{ background: t.surfaceMuted }}>📅 {item.data}</Tag>}
      </Space>

      <Section titulo="O que precisa ser feito">
        <Paragraph style={{ color: t.textSecondary, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {item.decisao || '—'}
        </Paragraph>
      </Section>

      {item.justificativa && (
        <Section titulo="Por quê / Contexto">
          <Paragraph style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {item.justificativa}
          </Paragraph>
        </Section>
      )}

      {tags.length > 0 && (
        <Section titulo="Tags">
          <Space wrap>
            {tags.map((tag, i) => (
              <Tag key={i} style={{ background: t.surfaceMuted, color: t.textSecondary }}>{tag}</Tag>
            ))}
          </Space>
        </Section>
      )}

      <Section titulo="Mover pra coluna">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
          {COLUNAS.map((c) => {
            const ativa = c.id === colunaAtual.id;
            return (
              <Button
                key={c.id}
                size="small"
                type={ativa ? 'primary' : 'default'}
                disabled={ativa}
                onClick={() => mover(c.id)}
                style={{ fontSize: 11 }}
              >
                {c.emoji} {c.label}
              </Button>
            );
          })}
        </div>
      </Section>

      <Section titulo="Prompt pronto pra esta tarefa" hint="Copie e cole no Cursor/Claude pra IA externa executar só este item">
        <PromptDoCard item={item} />
      </Section>
    </div>
  );
}

function PromptDoCard({ item }: { item: Decisao }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const prompt = `Tarefa do backlog:\n\n**${item.titulo}**\n\nO que fazer:\n${item.decisao}\n\n${item.justificativa ? 'Por quê / contexto:\n' + item.justificativa + '\n' : ''}\nPrioridade: ${String(item.prioridade || 'media').toUpperCase()}\n${item.estimativa ? 'Estimativa: ' + item.estimativa : ''}\n\nAntes de codar:\n1. Resuma o que entendeu em 2 linhas e pergunte se está correto.\n2. Se faltar contexto, peça antes de assumir.\n3. Ao concluir, diga "concluído" pra eu mover no kanban.`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      message.success('Prompt copiado');
    } catch {
      message.error('Não consegui copiar');
    }
  };

  return (
    <div>
      <div
        style={{
          background: t.surfaceMuted,
          border: `1px dashed ${t.borderSoft}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontFamily: FONTS.mono,
          fontSize: 11.5,
          lineHeight: 1.55,
          color: t.textSecondary,
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflowY: 'auto',
          marginBottom: 8,
        }}
      >
        {prompt}
      </div>
      <Button size="small" icon={<Copy size={13} />} onClick={copiar}>Copiar prompt</Button>
    </div>
  );
}

function Section({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Sparkles size={11} color={t.textTertiary} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{titulo}</span>
        {hint && (
          <Tooltip title={hint}>
            <span style={{ color: t.textTertiary, fontSize: 11, cursor: 'help' }}>·</span>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}
