import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, InputNumber, Space, message, Typography, Card, Progress, Empty } from 'antd';
import { PlusOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Risco, ServerResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

interface RiscosPanelProps {
  sistemaId: string;
}

interface FormValues {
  area: string;
  descricao: string;
  gravidade: number;
  historicoIncidentes: string;
}

// Mock para preview local
const MOCK_RISCOS: Risco[] = [
  { id: 'rk1', sistemaId: '', area: 'Autenticação', descricao: 'Token de refresh não rotacionado — sessões podem ser hijacked', gravidade: 8, historicoIncidentes: '1 incidente em maio/2026' },
  { id: 'rk2', sistemaId: '', area: 'Rate Limiting', descricao: 'API pública sem rate limit — vulnerável a abuso', gravidade: 6, historicoIncidentes: '' },
];

function getGravidadeColor(g: number): string {
  if (g >= 8) return '#E85555';
  if (g >= 5) return '#E8A838';
  return '#52C97F';
}

export default function RiscosPanel({ sistemaId }: RiscosPanelProps): React.ReactElement {
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadRiscos = () => {
    setLoading(true);
    callServer<ServerResponse<Risco[]>>('getRiscosBySistema', sistemaId)
      .then(res => {
        if (res.ok && res.data) setRiscos(res.data);
      })
      .catch(() => setRiscos(MOCK_RISCOS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRiscos(); }, [sistemaId]);

  const handleOpen = (risco?: Risco) => {
    if (risco) {
      setEditingId(risco.id);
      form.setFieldsValue(risco);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const data = { ...values, sistemaId };
      if (editingId) {
        await callServer('updateRisco', editingId, data);
      } else {
        await callServer('createRisco', data);
      }
      message.success(editingId ? 'Risco atualizado!' : 'Risco mapeado!');
      setModalOpen(false);
      loadRiscos();
    } catch {
      message.error('Erro ao salvar risco');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ color: '#8B8D98', fontWeight: 500, margin: 0 }}>
          <WarningOutlined style={{ marginRight: 8, color: '#E8A838' }} />
          Mapa de Quebra
        </Title>
        <Button size="small" icon={<PlusOutlined />} onClick={() => handleOpen()}>Mapear Risco</Button>
      </div>

      {loading ? null : riscos.length === 0 ? (
        <Empty description="Nenhum risco mapeado — ótimo sinal!" style={{ padding: 24 }} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {riscos
            .sort((a, b) => b.gravidade - a.gravidade)
            .map(risco => (
              <Card
                key={risco.id}
                size="small"
                style={{ borderColor: '#2A2D35', borderLeft: `3px solid ${getGravidadeColor(risco.gravidade)}` }}
                styles={{ body: { padding: '12px 16px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ color: '#E8E8ED', fontSize: 14 }}>{risco.area}</Text>
                    <Paragraph style={{ color: '#8B8D98', fontSize: 13, margin: '4px 0' }} ellipsis={{ rows: 2 }}>
                      {risco.descricao}
                    </Paragraph>
                    {risco.historicoIncidentes && (
                      <Text style={{ color: '#5C5E6A', fontSize: 11 }}>📋 {risco.historicoIncidentes}</Text>
                    )}
                  </div>
                  <Space direction="vertical" align="end" size={4} style={{ minWidth: 80 }}>
                    <Progress
                      type="circle"
                      size={36}
                      percent={risco.gravidade * 10}
                      format={() => `${risco.gravidade}`}
                      strokeColor={getGravidadeColor(risco.gravidade)}
                      trailColor="#2A2D35"
                    />
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpen(risco)} />
                  </Space>
                </div>
              </Card>
            ))}
        </Space>
      )}

      <Modal
        title={editingId ? 'Editar Risco' : 'Mapear Novo Risco'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ gravidade: 5 }}>
          <Form.Item name="area" label="Área / Zona de risco" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Autenticação, Pagamentos, Deploy" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição do risco" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="O que pode dar errado? Qual o impacto?" />
          </Form.Item>
          <Form.Item name="gravidade" label="Gravidade (1-10)" rules={[{ required: true }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="historicoIncidentes" label="Histórico de incidentes (opcional)">
            <Input.TextArea rows={2} placeholder="Já aconteceu algo? Quando?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
