// IdeiasView — banco maduro de ideias (vs Centelha que é o Inbox bruto).
//
// Cada ideia tem ciclo de vida: Nova → Validando → Em andamento → Concluída
// → (Arquivada / Descartada). Pode virar sistema (Gênese) se for tipo 'sistema'
// ou item de Backlog se for 'melhoria'.
//
// v1.142.0 (lifecycle completo):
// - Botão deletar com confirmação
// - Botão concluir (estado 'concluida' + carimbo concluidaEm pra histórico)
// - Botão reabrir (volta pra 'em andamento')
// - Botão arquivar (preserva histórico, some das ativas)
// - Filtro por estado: Ativas / Concluídas / Arquivadas / Descartadas / Todas
// - Cards repaginados com indicador visual de concluída + timestamps relativos
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Button, Space, Modal, Form, Input, InputNumber, Select,
  Row, Col, Tag, Empty, Spin, Segmented, App as AntApp, Tooltip, Popconfirm, Dropdown,
} from 'antd';
import {
  Plus, Sparkles, Pencil, Lightbulb, Rocket, Check, Trash2, Archive,
  RotateCcw, MoreHorizontal, XCircle, Clock,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { PromoverIdeiaModal } from '../components/IdeiasFaixa';
import type { Ideia, Sistema, ServerResponse, ServerResult } from '../types';

const { Text, Paragraph } = Typography;

interface IdeiasViewProps {
  onGenese: (ideiaId: string) => void;
}

interface FormValues {
  titulo: string;
  descricao: string;
  notaImpacto: number;
  notaEsforco: number;
  estado: string;
  tipo: 'sistema' | 'melhoria';
  sistemaId?: string;
}

const ESTADO_OPTIONS = [
  { value: 'nova', label: 'Nova' },
  { value: 'validando', label: 'Validando' },
  { value: 'em andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'arquivada', label: 'Arquivada' },
  { value: 'descartada', label: 'Descartada' },
];

const ESTADO_LABEL: Record<string, string> = {
  nova: 'Nova', validando: 'Validando', 'em andamento': 'Em andamento',
  concluida: 'Concluída', promovida: 'Promovida', arquivada: 'Arquivada',
  descartada: 'Descartada',
};

const MOCK_IDEIAS: Ideia[] = [
  { id: 'i1', titulo: 'App de orçamentos com IA', descricao: 'Gerador de propostas comerciais que usa IA para estimar preços', notaImpacto: 8, notaEsforco: 5, estado: 'nova', tipo: 'sistema' },
  { id: 'i2', titulo: 'Dashboard de métricas unificado', descricao: 'Painel que puxa dados de todos os SaaS em um lugar só', notaImpacto: 7, notaEsforco: 8, estado: 'validando', tipo: 'sistema' },
];

// Normaliza ideias legadas (sem `tipo`) como faísca de sistema novo.
const tipoDe = (i: Ideia): 'sistema' | 'melhoria' => (i.tipo === 'melhoria' ? 'melhoria' : 'sistema');

type FiltroEstado = 'ativas' | 'concluidas' | 'arquivadas' | 'descartadas' | 'todas';
type FiltroTipo = 'todas' | 'sistema' | 'melhoria';

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

export default function IdeiasView({ onGenese }: IdeiasViewProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('ativas');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [promovendo, setPromovendo] = useState<Ideia | null>(null);
  const [form] = Form.useForm<FormValues>();
  const tipoForm = Form.useWatch('tipo', form);

  const estadoColor = (e: string): string => ({
    nova: t.accents.blue,
    validando: t.accents.clay,
    'em andamento': t.accents.lavender,
    concluida: t.accents.sage,
    promovida: t.accents.sage,
    arquivada: t.textTertiary,
    descartada: t.accents.rose,
  } as Record<string, string>)[e] || t.accents.blue;

  const getPrioridade = (impacto: number, esforco: number) => {
    const score = impacto - esforco;
    if (score >= 4) return { label: 'Alta', color: t.accents.sage };
    if (score >= 1) return { label: 'Média', color: t.accents.clay };
    return { label: 'Baixa', color: t.textTertiary };
  };

  const nomeSistema = (id?: string): string => {
    if (!id) return '';
    const s = sistemas.find((x) => x.id === id);
    return s ? s.nome : '';
  };

  const loadIdeias = () => {
    setLoading(true);
    callServer<ServerResponse<Ideia[]>>('getIdeias')
      .then((res) => { if (res.ok && res.data) setIdeias(res.data); })
      .catch(() => setIdeias(MOCK_IDEIAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIdeias();
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((res) => { if (res.ok && res.data) setSistemas(res.data); })
      .catch(() => { /* preview */ });
  }, []);

  const handleOpen = (ideia?: Ideia) => {
    if (ideia) {
      setEditingId(ideia.id);
      form.setFieldsValue({ ...ideia, tipo: tipoDe(ideia) });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ tipo: filtroTipo === 'melhoria' ? 'melhoria' : 'sistema' });
    }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...values,
        sistemaId: values.tipo === 'melhoria' ? (values.sistemaId || '') : '',
      };
      if (editingId) {
        await callServer('updateIdeia', editingId, payload);
      } else {
        await callServer('createIdeia', { ...payload, estado: values.estado || 'nova', criadoEm: new Date().toISOString() });
      }
      message.success(editingId ? 'Ideia atualizada' : 'Ideia registrada');
      setModalOpen(false);
      loadIdeias();
    } catch { message.error('Erro ao salvar ideia'); }
    finally { setSaving(false); }
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

  const concluir = (id: string) => acaoSimples('concluirIdeia', id, 'Ideia concluída ✓');
  const reabrir = (id: string) => acaoSimples('reabrirIdeia', id, 'Ideia reaberta');
  const arquivar = (id: string) => acaoSimples('arquivarIdeia', id, 'Ideia arquivada');
  const descartar = (id: string) => acaoSimples('descartarIdeia', id, 'Ideia descartada');
  const remover = (id: string) => acaoSimples('deleteIdeia', id, 'Ideia apagada');

  // Filtragem em dois eixos (estado + tipo). "Promovida" some das listas — virou
  // item de backlog noutro lugar; quem quiser vê em Sistemas > Backlog.
  const visiveis = useMemo(() => {
    const matchEstado = (e: string) => {
      const est = (e || '').toLowerCase();
      if (est === 'promovida') return false;
      switch (filtroEstado) {
        case 'ativas': return ATIVAS.has(est);
        case 'concluidas': return est === 'concluida';
        case 'arquivadas': return est === 'arquivada';
        case 'descartadas': return est === 'descartada';
        case 'todas': return true;
      }
    };
    return [...ideias]
      .filter((i) => matchEstado(i.estado))
      .filter((i) => filtroTipo === 'todas' || tipoDe(i) === filtroTipo)
      .sort((a, b) => {
        // Concluídas/arquivadas/descartadas: por concluidaEm/atualizadoEm desc.
        // Ativas: por prioridade (impacto - esforço) desc.
        const aFinal = a.concluidaEm || a.atualizadoEm || a.criadoEm || '';
        const bFinal = b.concluidaEm || b.atualizadoEm || b.criadoEm || '';
        if (filtroEstado !== 'ativas') return bFinal.localeCompare(aFinal);
        return (b.notaImpacto - b.notaEsforco) - (a.notaImpacto - a.notaEsforco);
      });
  }, [ideias, filtroEstado, filtroTipo]);

  // Contagens pra mostrar nos badges dos filtros.
  const contagens = useMemo(() => {
    const c = { ativas: 0, concluidas: 0, arquivadas: 0, descartadas: 0, todas: 0 };
    ideias.forEach((i) => {
      const est = (i.estado || '').toLowerCase();
      if (est === 'promovida') return;
      c.todas++;
      if (ATIVAS.has(est)) c.ativas++;
      else if (est === 'concluida') c.concluidas++;
      else if (est === 'arquivada') c.arquivadas++;
      else if (est === 'descartada') c.descartadas++;
    });
    return c;
  }, [ideias]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  const tagPill = (text: string, color: string) => (
    <Tag bordered={false} style={{ background: `${color}1f`, color, fontSize: 11, borderRadius: 999, textTransform: 'capitalize' }}>{text}</Tag>
  );

  const labelComBadge = (label: string, n: number) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label}
      <span style={{
        background: t.surfaceAlt, color: t.textSecondary, fontSize: 10,
        padding: '1px 6px', borderRadius: 999, fontVariantNumeric: 'tabular-nums',
      }}>{n}</span>
    </span>
  );

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1040, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Ideias"
        subtitle="Banco de ideias maduro: nova → validando → em andamento → concluída. Pra captura bruta zero-fricção, use a Centelha."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Nova ideia</Button>}
      />

      {/* 2 filtros: estado (lifecycle) e tipo (sistema/melhoria) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <Segmented
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as FiltroEstado)}
          options={[
            { label: labelComBadge('Ativas', contagens.ativas), value: 'ativas' },
            { label: labelComBadge('Concluídas', contagens.concluidas), value: 'concluidas' },
            { label: labelComBadge('Arquivadas', contagens.arquivadas), value: 'arquivadas' },
            { label: labelComBadge('Descartadas', contagens.descartadas), value: 'descartadas' },
            { label: labelComBadge('Todas', contagens.todas), value: 'todas' },
          ]}
        />
        <Segmented
          value={filtroTipo}
          onChange={(v) => setFiltroTipo(v as FiltroTipo)}
          options={[
            { label: 'Tudo', value: 'todas' },
            { label: 'Sistemas', value: 'sistema' },
            { label: 'Melhorias', value: 'melhoria' },
          ]}
        />
      </div>

      {visiveis.length === 0 ? (
        <Empty
          description={
            filtroEstado === 'ativas' ? 'Sem ideias ativas. Capture algo no botão acima ou na Centelha.' :
            filtroEstado === 'concluidas' ? 'Nenhuma ideia concluída ainda.' :
            filtroEstado === 'arquivadas' ? 'Nada arquivado.' :
            filtroEstado === 'descartadas' ? 'Nenhuma ideia descartada.' :
            'Nenhuma ideia registrada ainda.'
          }
          style={{ marginTop: 48 }}
        />
      ) : (
        <Row gutter={[18, 18]}>
          {visiveis.map((ideia) => {
            const tipo = tipoDe(ideia);
            const prio = getPrioridade(ideia.notaImpacto, ideia.notaEsforco);
            const sistNome = nomeSistema(ideia.sistemaId);
            const estado = (ideia.estado || 'nova').toLowerCase();
            const concluida = estado === 'concluida';
            const arquivada = estado === 'arquivada';
            const descartada = estado === 'descartada';
            const inativa = arquivada || descartada;

            return (
              <Col xs={24} sm={12} key={ideia.id}>
                <div style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  boxShadow: t.shadowSoft,
                  padding: 20,
                  height: '100%',
                  opacity: inativa ? 0.7 : 1,
                  position: 'relative',
                }}>
                  {/* Faixa lateral colorida no estado pra leitura rápida */}
                  <div style={{
                    position: 'absolute', left: 0, top: 16, bottom: 16, width: 3,
                    background: estadoColor(estado), borderRadius: 999,
                  }} />

                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Text strong style={{
                        color: t.text,
                        fontSize: 15,
                        fontFamily: FONTS.display,
                        fontWeight: 600,
                        textDecoration: concluida ? 'line-through' : 'none',
                      }}>
                        {ideia.titulo}
                      </Text>
                      <Space size={4}>
                        {concluida && <Check size={14} color={t.accents.sage} />}
                        {tagPill(ESTADO_LABEL[estado] || estado, estadoColor(estado))}
                      </Space>
                    </div>

                    {/* Tipo da faísca: novo sistema vs melhoria (+ a qual sistema) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {tipo === 'melhoria' ? (
                        <Tag bordered={false} icon={<Lightbulb size={11} style={{ marginRight: 3, verticalAlign: -1 }} />} style={{ background: `${t.accents.clay}1f`, color: t.accents.clay, fontSize: 11, borderRadius: 999 }}>
                          Melhoria{sistNome ? ` · ${sistNome}` : ' · sem sistema'}
                        </Tag>
                      ) : (
                        <Tag bordered={false} icon={<Rocket size={11} style={{ marginRight: 3, verticalAlign: -1 }} />} style={{ background: `${t.accents.peach}1f`, color: t.accents.peach, fontSize: 11, borderRadius: 999 }}>
                          Novo sistema
                        </Tag>
                      )}
                      {/* Timestamps relevantes (histórico) */}
                      {concluida && ideia.concluidaEm && (
                        <Tooltip title={new Date(ideia.concluidaEm).toLocaleString('pt-BR')}>
                          <span style={{ color: t.textTertiary, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check size={11} /> concluída {tempoRelativo(ideia.concluidaEm)}
                          </span>
                        </Tooltip>
                      )}
                      {!concluida && ideia.criadoEm && (
                        <Tooltip title={`Criada em ${new Date(ideia.criadoEm).toLocaleString('pt-BR')}`}>
                          <span style={{ color: t.textTertiary, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} /> {tempoRelativo(ideia.criadoEm)}
                          </span>
                        </Tooltip>
                      )}
                    </div>

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

                    {tipo === 'sistema' && !inativa && !concluida && (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: t.textTertiary }}>Impacto <strong style={{ color: t.text }}>{ideia.notaImpacto}</strong></Text>
                        <Text style={{ fontSize: 12, color: t.textTertiary }}>Esforço <strong style={{ color: t.text }}>{ideia.notaEsforco}</strong></Text>
                        {tagPill(prio.label, prio.color)}
                      </div>
                    )}

                    <Space size={6} wrap style={{ marginTop: 4 }}>
                      {/* Ações primárias: variam pelo estado */}
                      {!concluida && !inativa && (
                        <Tooltip title="Marcar como concluída (vai pro histórico)">
                          <Button size="small" icon={<Check size={14} />} onClick={() => concluir(ideia.id)} style={{ color: t.accents.sage, borderColor: `${t.accents.sage}99` }}>
                            Concluir
                          </Button>
                        </Tooltip>
                      )}
                      {(concluida || inativa) && (
                        <Tooltip title="Voltar pra 'em andamento'">
                          <Button size="small" icon={<RotateCcw size={14} />} onClick={() => reabrir(ideia.id)}>
                            Reabrir
                          </Button>
                        </Tooltip>
                      )}

                      {/* Gênese/Promover: só faz sentido enquanto ativa */}
                      {tipo === 'sistema' && !concluida && !inativa && (
                        <Button size="small" icon={<Sparkles size={14} />} onClick={() => onGenese(ideia.id)} style={{ color: t.accents.peach, borderColor: `${t.accents.peach}99` }}>
                          Gênese
                        </Button>
                      )}
                      {tipo === 'melhoria' && !concluida && !inativa && (
                        <Button size="small" icon={<Sparkles size={14} />} onClick={() => setPromovendo(ideia)} style={{ color: t.accents.clay, borderColor: `${t.accents.clay}99` }}>
                          {ideia.sistemaId ? 'Promover' : 'Destinar & promover'}
                        </Button>
                      )}

                      <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => handleOpen(ideia)}>
                        Editar
                      </Button>

                      {/* Menu "mais": arquivar, descartar, apagar — destrutivos ficam aqui */}
                      <Dropdown
                        menu={{
                          items: [
                            !arquivada && !concluida && {
                              key: 'arquivar',
                              icon: <Archive size={13} />,
                              label: 'Arquivar (mantém histórico)',
                              onClick: () => arquivar(ideia.id),
                            },
                            !descartada && {
                              key: 'descartar',
                              icon: <XCircle size={13} />,
                              label: 'Descartar (não vai acontecer)',
                              onClick: () => descartar(ideia.id),
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
                                  onConfirm={() => remover(ideia.id)}
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
                        <Button size="small" type="text" icon={<MoreHorizontal size={14} />} />
                      </Dropdown>
                    </Space>
                  </Space>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal title={editingId ? 'Editar ideia' : 'Nova ideia'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ notaImpacto: 5, notaEsforco: 5, estado: 'nova', tipo: 'sistema' }}>
          <Form.Item name="tipo" label="Tipo de faísca">
            <Select
              options={[
                { value: 'sistema', label: '🚀 Novo sistema (vai pra Gênese)' },
                { value: 'melhoria', label: '💡 Melhoria de um sistema (vai pro Backlog)' },
              ]}
            />
          </Form.Item>
          {tipoForm === 'melhoria' && (
            <Form.Item name="sistemaId" label="Sistema" extra="Pode deixar em branco e destinar depois.">
              <Select allowClear placeholder="Qual sistema esta melhoria afeta?" options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
            </Form.Item>
          )}
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Nome curto da ideia" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={3} placeholder="O que é? Qual problema resolve?" />
          </Form.Item>
          {tipoForm !== 'melhoria' && (
            <Row gutter={16}>
              <Col span={8}><Form.Item name="notaImpacto" label="Impacto (1-10)"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="notaEsforco" label="Esforço (1-10)"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="estado" label="Estado"><Select options={ESTADO_OPTIONS} /></Form.Item></Col>
            </Row>
          )}
          {tipoForm === 'melhoria' && (
            <Form.Item name="estado" label="Estado"><Select options={ESTADO_OPTIONS} /></Form.Item>
          )}
        </Form>
      </Modal>

      <PromoverIdeiaModal
        ideia={promovendo}
        open={!!promovendo}
        onClose={() => setPromovendo(null)}
        onPromovido={() => { setPromovendo(null); loadIdeias(); }}
      />
    </div>
  );
}
