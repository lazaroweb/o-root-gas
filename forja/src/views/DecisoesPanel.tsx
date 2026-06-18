import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Space, message, Typography, Timeline as AntTimeline, Tag, Empty } from 'antd';
import { Plus, Pencil } from 'lucide-react';
const PlusOutlined = (p: any) => <Plus size={16} {...p} />;
const EditOutlined = (p: any) => <Pencil size={16} {...p} />;
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { Decisao, ServerResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

interface DecisoesPanelProps {
  sistemaId: string;
}

interface FormValues {
  titulo: string;
  decisao: string;
  justificativa: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'revista', label: 'Revista' },
  { value: 'revertida', label: 'Revertida' },
];

const STATUS_COLORS: Record<string, string> = {
  ativa: '#52C97F',
  revista: '#E8A838',
  revertida: '#E85555',
};

// Mock para preview local
const MOCK_DECISOES: Decisao[] = [
  { id: 'd1', sistemaId: '', data: '2026-06-01', titulo: 'Usar Supabase ao invés de Firebase', decisao: 'Supabase como backend principal', justificativa: 'PostgreSQL nativo, melhor para queries complexas, pricing previsível', status: 'ativa' },
  { id: 'd2', sistemaId: '', data: '2026-05-20', titulo: 'Deploy na Vercel ao invés de Netlify', decisao: 'Vercel como plataforma de deploy', justificativa: 'Integração nativa com Next.js, edge functions mais rápidas', status: 'ativa' },
];

export default function DecisoesPanel({ sistemaId }: DecisoesPanelProps): React.ReactElement {
  const t = useTokens();
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadDecisoes = () => {
    setLoading(true);
    callServer<ServerResponse<Decisao[]>>('getDecisoesBySistema', sistemaId)
      .then(res => {
        if (res.ok && res.data) setDecisoes(res.data);
      })
      .catch(() => setDecisoes(MOCK_DECISOES))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDecisoes(); }, [sistemaId]);

  const handleOpen = (decisao?: Decisao) => {
    if (decisao) {
      setEditingId(decisao.id);
      form.setFieldsValue(decisao);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const data = { ...values, sistemaId, data: new Date().toISOString().split('T')[0] };
      if (editingId) {
        await callServer('updateDecisao', editingId, data);
      } else {
        await callServer('createDecisao', data);
      }
      message.success(editingId ? 'Decisão atualizada!' : 'Decisão registrada!');
      setModalOpen(false);
      loadDecisoes();
    } catch {
      message.error('Erro ao salvar decisão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ color: '#8B8D98', fontWeight: 500, margin: 0 }}>Decisões Técnicas</Title>
        <Button size="small" icon={<PlusOutlined />} onClick={() => handleOpen()}>Registrar</Button>
      </div>

      {loading ? null : decisoes.length === 0 ? (
        <Empty description="Nenhuma decisão registrada" style={{ padding: 24 }} />
      ) : (
        <AntTimeline
          items={decisoes.map(d => ({
            color: STATUS_COLORS[d.status] || '#5C5E6A',
            children: (
              <div
                style={{
                  background: t.surfaceMuted,
                  borderRadius: 10,
                  padding: '12px 16px',
                  border: `1px solid ${t.border}`,
                  cursor: 'pointer',
                }}
                onClick={() => handleOpen(d)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text strong style={{ color: t.text, fontSize: 14 }}>{d.titulo}</Text>
                  <Space size={8}>
                    <Tag color={STATUS_COLORS[d.status]} style={{ fontSize: 11 }}>{d.status}</Tag>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleOpen(d); }} />
                  </Space>
                </div>
                <Text style={{ color: t.textTertiary, fontSize: 11 }}>{d.data}</Text>
                <Paragraph style={{ color: t.textSecondary, fontSize: 13, margin: '8px 0 4px' }} ellipsis={{ rows: 2 }}>
                  <strong>Decisão:</strong> {d.decisao}
                </Paragraph>
                <Paragraph style={{ color: t.textTertiary, fontSize: 12, margin: 0 }} ellipsis={{ rows: 2 }}>
                  <strong>Justificativa:</strong> {d.justificativa}
                </Paragraph>
              </div>
            ),
          }))}
        />
      )}

      <Modal
        title={editingId ? 'Editar Decisão' : 'Registrar Decisão'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ status: 'ativa' }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Usar Supabase ao invés de Firebase" />
          </Form.Item>
          <Form.Item name="decisao" label="O que foi decidido" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={2} placeholder="Descreva a decisão tomada" />
          </Form.Item>
          <Form.Item name="justificativa" label="Por quê?" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="Qual o raciocínio por trás? O que seria perdido com outra escolha?" />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
