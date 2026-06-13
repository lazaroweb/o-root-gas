import React, { useState, useEffect } from 'react';
import { Typography, Button, Card, Space, Modal, Form, Input, InputNumber, Select, Row, Col, Tag, Empty, Spin, message } from 'antd';
import { PlusOutlined, BulbOutlined, ThunderboltOutlined, EditOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Ideia, ServerResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

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

const ESTADO_COLORS: Record<string, string> = {
  nova: '#4A9EFF',
  validando: '#E8A838',
  'em andamento': '#52C97F',
  descartada: '#5C5E6A',
};

const MOCK_IDEIAS: Ideia[] = [
  { id: 'i1', titulo: 'App de orçamentos com IA', descricao: 'Gerador de propostas comerciais que usa IA para estimar preços', notaImpacto: 8, notaEsforco: 5, estado: 'nova' },
  { id: 'i2', titulo: 'Dashboard de métricas unificado', descricao: 'Painel que puxa dados de todos os SaaS em um lugar só', notaImpacto: 7, notaEsforco: 8, estado: 'validando' },
];

function getPrioridade(impacto: number, esforco: number): { score: number; label: string; color: string } {
  const score = impacto - esforco;
  if (score >= 4) return { score, label: 'Alta', color: '#52C97F' };
  if (score >= 1) return { score, label: 'Média', color: '#E8A838' };
  return { score, label: 'Baixa', color: '#5C5E6A' };
}

export default function IdeiasView({ onGenese }: IdeiasViewProps): React.ReactElement {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadIdeias = () => {
    setLoading(true);
    callServer<ServerResponse<Ideia[]>>('getIdeias')
      .then(res => { if (res.ok && res.data) setIdeias(res.data); })
      .catch(() => setIdeias(MOCK_IDEIAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadIdeias(); }, []);

  const handleOpen = (ideia?: Ideia) => {
    if (ideia) {
      setEditingId(ideia.id);
      form.setFieldsValue(ideia);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      if (editingId) {
        await callServer('updateIdeia', editingId, values);
      } else {
        await callServer('createIdeia', { ...values, estado: values.estado || 'nova' });
      }
      message.success(editingId ? 'Ideia atualizada!' : 'Ideia registrada!');
      setModalOpen(false);
      loadIdeias();
    } catch {
      message.error('Erro ao salvar ideia');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  const sorted = [...ideias].sort((a, b) => {
    const pa = a.notaImpacto - a.notaEsforco;
    const pb = b.notaImpacto - b.notaEsforco;
    return pb - pa;
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          <BulbOutlined style={{ marginRight: 10, color: '#E8A838' }} />
          Ideias
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Nova Ideia</Button>
      </div>

      {sorted.length === 0 ? (
        <Empty description="Nenhuma ideia registrada ainda" style={{ marginTop: 48 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {sorted.map(ideia => {
            const prio = getPrioridade(ideia.notaImpacto, ideia.notaEsforco);
            return (
              <Col xs={24} sm={12} key={ideia.id}>
                <Card
                  style={{ borderColor: '#2A2D35', height: '100%' }}
                  styles={{ body: { padding: '16px 20px' } }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text strong style={{ color: '#E8E8ED', fontSize: 15 }}>{ideia.titulo}</Text>
                      <Tag color={ESTADO_COLORS[ideia.estado]}>{ideia.estado}</Tag>
                    </div>
                    <Paragraph style={{ color: '#8B8D98', fontSize: 13, margin: 0 }} ellipsis={{ rows: 2 }}>
                      {ideia.descricao}
                    </Paragraph>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#5C5E6A' }}>Impacto: <strong style={{ color: '#E8E8ED' }}>{ideia.notaImpacto}</strong></Text>
                      <Text style={{ fontSize: 11, color: '#5C5E6A' }}>Esforço: <strong style={{ color: '#E8E8ED' }}>{ideia.notaEsforco}</strong></Text>
                      <Tag color={prio.color} style={{ fontSize: 10 }}>{prio.label}</Tag>
                    </div>
                    <Space size={8} style={{ marginTop: 4 }}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleOpen(ideia)}>Editar</Button>
                      {ideia.estado !== 'descartada' && ideia.estado !== 'em andamento' && (
                        <Button size="small" icon={<ThunderboltOutlined />} style={{ color: '#D4A853', borderColor: '#D4A853' }} onClick={() => onGenese(ideia.id)}>
                          Gênese
                        </Button>
                      )}
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        title={editingId ? 'Editar Ideia' : 'Nova Ideia'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ notaImpacto: 5, notaEsforco: 5, estado: 'nova' }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Nome curto da ideia" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="O que é? Qual problema resolve?" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="notaImpacto" label="Impacto (1-10)">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notaEsforco" label="Esforço (1-10)">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="estado" label="Estado">
                <Select options={ESTADO_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}