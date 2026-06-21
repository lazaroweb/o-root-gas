import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Button, Space, Modal, Form, Input, InputNumber, Select, Row, Col, Tag, Empty, Spin, Segmented, App as AntApp } from 'antd';
import { Plus, Sparkles, Pencil, Lightbulb, Rocket } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { PromoverIdeiaModal } from '../components/IdeiasFaixa';
import type { Ideia, Sistema, ServerResponse } from '../types';

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
  { value: 'descartada', label: 'Descartada' },
];

const MOCK_IDEIAS: Ideia[] = [
  { id: 'i1', titulo: 'App de orçamentos com IA', descricao: 'Gerador de propostas comerciais que usa IA para estimar preços', notaImpacto: 8, notaEsforco: 5, estado: 'nova', tipo: 'sistema' },
  { id: 'i2', titulo: 'Dashboard de métricas unificado', descricao: 'Painel que puxa dados de todos os SaaS em um lugar só', notaImpacto: 7, notaEsforco: 8, estado: 'validando', tipo: 'sistema' },
];

// Normaliza ideias legadas (sem `tipo`) como faísca de sistema novo.
const tipoDe = (i: Ideia): 'sistema' | 'melhoria' => (i.tipo === 'melhoria' ? 'melhoria' : 'sistema');

export default function IdeiasView({ onGenese }: IdeiasViewProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'sistema' | 'melhoria'>('todas');
  const [promovendo, setPromovendo] = useState<Ideia | null>(null);
  const [form] = Form.useForm<FormValues>();
  const tipoForm = Form.useWatch('tipo', form);

  const estadoColor = (e: string): string => ({
    nova: t.accents.blue, validando: t.accents.clay, 'em andamento': t.accents.sage,
    promovida: t.accents.sage, descartada: t.textTertiary,
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
      .then(res => { if (res.ok && res.data) setIdeias(res.data); })
      .catch(() => setIdeias(MOCK_IDEIAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIdeias();
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data); })
      .catch(() => { /* preview */ });
  }, []);

  const handleOpen = (ideia?: Ideia) => {
    if (ideia) {
      setEditingId(ideia.id);
      form.setFieldsValue({ ...ideia, tipo: tipoDe(ideia) });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ tipo: filtro === 'melhoria' ? 'melhoria' : 'sistema' });
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

  // Ordena por prioridade (impacto-esforço) e aplica o filtro de tipo.
  // Ideias "promovida" some da lista (viraram item de backlog).
  const visiveis = useMemo(() => {
    return [...ideias]
      .filter((i) => String(i.estado || '').toLowerCase() !== 'promovida')
      .filter((i) => filtro === 'todas' || tipoDe(i) === filtro)
      .sort((a, b) => (b.notaImpacto - b.notaEsforco) - (a.notaImpacto - a.notaEsforco));
  }, [ideias, filtro]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  const tagPill = (text: string, color: string) => (
    <Tag bordered={false} style={{ background: `${color}1f`, color, fontSize: 11, borderRadius: 999, textTransform: 'capitalize' }}>{text}</Tag>
  );

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1040, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Ideias"
        subtitle="A faísca: produto novo vai pra Gênese; melhoria vai pro Backlog de um sistema."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Nova ideia</Button>}
      />

      <Segmented
        value={filtro}
        onChange={(v) => setFiltro(v as 'todas' | 'sistema' | 'melhoria')}
        options={[
          { label: 'Todas', value: 'todas' },
          { label: 'Novos sistemas', value: 'sistema' },
          { label: 'Melhorias', value: 'melhoria' },
        ]}
        style={{ marginBottom: 20 }}
      />

      {visiveis.length === 0 ? (
        <Empty description={filtro === 'melhoria' ? 'Nenhuma melhoria registrada ainda' : 'Nenhuma ideia registrada ainda'} style={{ marginTop: 48 }} />
      ) : (
        <Row gutter={[18, 18]}>
          {visiveis.map(ideia => {
            const tipo = tipoDe(ideia);
            const prio = getPrioridade(ideia.notaImpacto, ideia.notaEsforco);
            const sistNome = nomeSistema(ideia.sistemaId);
            return (
              <Col xs={24} sm={12} key={ideia.id}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, boxShadow: t.shadowSoft, padding: 20, height: '100%' }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Text strong style={{ color: t.text, fontSize: 15, fontFamily: FONTS.display, fontWeight: 600 }}>{ideia.titulo}</Text>
                      {tagPill(ideia.estado, estadoColor(ideia.estado))}
                    </div>

                    {/* Tipo da faísca: novo sistema vs melhoria (+ a qual sistema) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tipo === 'melhoria' ? (
                        <Tag bordered={false} icon={<Lightbulb size={11} style={{ marginRight: 3, verticalAlign: -1 }} />} style={{ background: `${t.accents.clay}1f`, color: t.accents.clay, fontSize: 11, borderRadius: 999 }}>
                          Melhoria{sistNome ? ` · ${sistNome}` : ' · sem sistema'}
                        </Tag>
                      ) : (
                        <Tag bordered={false} icon={<Rocket size={11} style={{ marginRight: 3, verticalAlign: -1 }} />} style={{ background: `${t.accents.peach}1f`, color: t.accents.peach, fontSize: 11, borderRadius: 999 }}>
                          Novo sistema
                        </Tag>
                      )}
                    </div>

                    {ideia.descricao && <Paragraph style={{ color: t.textSecondary, fontSize: 13, margin: 0 }} ellipsis={{ rows: 2 }}>{ideia.descricao}</Paragraph>}

                    {tipo === 'sistema' && (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: t.textTertiary }}>Impacto <strong style={{ color: t.text }}>{ideia.notaImpacto}</strong></Text>
                        <Text style={{ fontSize: 12, color: t.textTertiary }}>Esforço <strong style={{ color: t.text }}>{ideia.notaEsforco}</strong></Text>
                        {tagPill(prio.label, prio.color)}
                      </div>
                    )}

                    <Space size={8} style={{ marginTop: 4 }}>
                      <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => handleOpen(ideia)}>Editar</Button>
                      {tipo === 'sistema' && ideia.estado !== 'descartada' && ideia.estado !== 'em andamento' && (
                        <Button size="small" icon={<Sparkles size={14} />} onClick={() => onGenese(ideia.id)} style={{ color: t.accents.peach, borderColor: `${t.accents.peach}99` }}>Gênese</Button>
                      )}
                      {tipo === 'melhoria' && ideia.estado !== 'descartada' && (
                        <Button size="small" icon={<Sparkles size={14} />} onClick={() => setPromovendo(ideia)} style={{ color: t.accents.clay, borderColor: `${t.accents.clay}99` }}>
                          {ideia.sistemaId ? 'Promover' : 'Destinar & promover'}
                        </Button>
                      )}
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
