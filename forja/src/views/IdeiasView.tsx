import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Modal, Form, Input, InputNumber, Select, Row, Col, Tag, Empty, Spin, App as AntApp } from 'antd';
import { Plus, Sparkles, Pencil } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Ideia, ServerResponse } from '../types';

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
}

const ESTADO_OPTIONS = [
  { value: 'nova', label: 'Nova' },
  { value: 'validando', label: 'Validando' },
  { value: 'em andamento', label: 'Em andamento' },
  { value: 'descartada', label: 'Descartada' },
];

const MOCK_IDEIAS: Ideia[] = [
  { id: 'i1', titulo: 'App de orçamentos com IA', descricao: 'Gerador de propostas comerciais que usa IA para estimar preços', notaImpacto: 8, notaEsforco: 5, estado: 'nova' },
  { id: 'i2', titulo: 'Dashboard de métricas unificado', descricao: 'Painel que puxa dados de todos os SaaS em um lugar só', notaImpacto: 7, notaEsforco: 8, estado: 'validando' },
];

export default function IdeiasView({ onGenese }: IdeiasViewProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const estadoColor = (e: string): string => ({
    nova: t.accents.blue, validando: t.accents.clay, 'em andamento': t.accents.sage, descartada: t.textTertiary,
  } as Record<string, string>)[e] || t.accents.blue;

  const getPrioridade = (impacto: number, esforco: number) => {
    const score = impacto - esforco;
    if (score >= 4) return { label: 'Alta', color: t.accents.sage };
    if (score >= 1) return { label: 'Média', color: t.accents.clay };
    return { label: 'Baixa', color: t.textTertiary };
  };

  const loadIdeias = () => {
    setLoading(true);
    callServer<ServerResponse<Ideia[]>>('getIdeias')
      .then(res => { if (res.ok && res.data) setIdeias(res.data); })
      .catch(() => setIdeias(MOCK_IDEIAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadIdeias(); }, []);

  const handleOpen = (ideia?: Ideia) => {
    if (ideia) { setEditingId(ideia.id); form.setFieldsValue(ideia); }
    else { setEditingId(null); form.resetFields(); }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      if (editingId) await callServer('updateIdeia', editingId, values);
      else await callServer('createIdeia', { ...values, estado: values.estado || 'nova' });
      message.success(editingId ? 'Ideia atualizada' : 'Ideia registrada');
      setModalOpen(false);
      loadIdeias();
    } catch { message.error('Erro ao salvar ideia'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  const sorted = [...ideias].sort((a, b) => (b.notaImpacto - b.notaEsforco) - (a.notaImpacto - a.notaEsforco));

  const tagPill = (text: string, color: string) => (
    <Tag bordered={false} style={{ background: `${color}1f`, color, fontSize: 11, borderRadius: 999, textTransform: 'capitalize' }}>{text}</Tag>
  );

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1040, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Ideias"
        subtitle="A faísca: capture, priorize e leve para a Gênese."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Nova ideia</Button>}
      />

      {sorted.length === 0 ? (
        <Empty description="Nenhuma ideia registrada ainda" style={{ marginTop: 48 }} />
      ) : (
        <Row gutter={[18, 18]}>
          {sorted.map(ideia => {
            const prio = getPrioridade(ideia.notaImpacto, ideia.notaEsforco);
            return (
              <Col xs={24} sm={12} key={ideia.id}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, boxShadow: t.shadowSoft, padding: 20, height: '100%' }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Text strong style={{ color: t.text, fontSize: 15, fontFamily: FONTS.display, fontWeight: 600 }}>{ideia.titulo}</Text>
                      {tagPill(ideia.estado, estadoColor(ideia.estado))}
                    </div>
                    <Paragraph style={{ color: t.textSecondary, fontSize: 13, margin: 0 }} ellipsis={{ rows: 2 }}>{ideia.descricao}</Paragraph>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: t.textTertiary }}>Impacto <strong style={{ color: t.text }}>{ideia.notaImpacto}</strong></Text>
                      <Text style={{ fontSize: 12, color: t.textTertiary }}>Esforço <strong style={{ color: t.text }}>{ideia.notaEsforco}</strong></Text>
                      {tagPill(prio.label, prio.color)}
                    </div>
                    <Space size={8} style={{ marginTop: 4 }}>
                      <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => handleOpen(ideia)}>Editar</Button>
                      {ideia.estado !== 'descartada' && ideia.estado !== 'em andamento' && (
                        <Button size="small" icon={<Sparkles size={14} />} onClick={() => onGenese(ideia.id)} style={{ color: t.accents.peach, borderColor: `${t.accents.peach}99` }}>Gênese</Button>
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
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ notaImpacto: 5, notaEsforco: 5, estado: 'nova' }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Nome curto da ideia" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="O que é? Qual problema resolve?" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="notaImpacto" label="Impacto (1-10)"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="notaEsforco" label="Esforço (1-10)"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="estado" label="Estado"><Select options={ESTADO_OPTIONS} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
