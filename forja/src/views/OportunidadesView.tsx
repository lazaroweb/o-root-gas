import React, { useState, useEffect } from 'react';
import { Typography, Button, Card, Modal, Form, Input, InputNumber, Select, Space, Tag, Row, Col, Empty, Spin, Statistic, message } from 'antd';
import { PlusOutlined, EditOutlined, RocketOutlined, DollarOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Oportunidade, Pessoa, ServerResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

interface FormValues {
  titulo: string;
  pessoaId: string;
  valorEstimado: number;
  estado: string;
  proximoPasso: string;
}

const ESTADO_OPTIONS = [
  { value: 'prospectando', label: '🔍 Prospectando' },
  { value: 'negociando', label: '🤝 Negociando' },
  { value: 'proposta enviada', label: '📧 Proposta Enviada' },
  { value: 'fechada', label: '✅ Fechada' },
  { value: 'perdida', label: '❌ Perdida' },
];

const ESTADO_COLORS: Record<string, string> = {
  prospectando: '#4A9EFF',
  negociando: '#E8A838',
  'proposta enviada': '#D4A853',
  fechada: '#52C97F',
  perdida: '#5C5E6A',
};

const MOCK_OPORTUNIDADES: Oportunidade[] = [
  { id: 'o1', titulo: 'Dashboard para Logística XYZ', pessoaId: 'p1', valorEstimado: 5000, estado: 'negociando', proximoPasso: 'Enviar proposta até sexta' },
  { id: 'o2', titulo: 'Automação de relatórios', pessoaId: 'p1', valorEstimado: 2500, estado: 'prospectando', proximoPasso: 'Agendar call de discovery' },
];

const MOCK_PESSOAS: Pessoa[] = [
  { id: 'p1', nome: 'João Silva', contato: 'joao@empresa.com', papel: 'cliente', notas: '' },
];

export default function OportunidadesView(): React.ReactElement {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Oportunidade[]>>('getOportunidades'),
      callServer<ServerResponse<Pessoa[]>>('getPessoas'),
    ])
      .then(([oRes, pRes]) => {
        if (oRes.ok && oRes.data) setOportunidades(oRes.data);
        if (pRes.ok && pRes.data) setPessoas(pRes.data);
      })
      .catch(() => {
        setOportunidades(MOCK_OPORTUNIDADES);
        setPessoas(MOCK_PESSOAS);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleOpen = (op?: Oportunidade) => {
    if (op) {
      setEditingId(op.id);
      form.setFieldsValue(op);
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
        await callServer('updateOportunidade', editingId, values);
      } else {
        await callServer('createOportunidade', { ...values, estado: values.estado || 'prospectando' });
      }
      message.success(editingId ? 'Oportunidade atualizada!' : 'Oportunidade criada!');
      setModalOpen(false);
      loadData();
    } catch {
      message.error('Erro ao salvar oportunidade');
    } finally {
      setSaving(false);
    }
  };

  const getPessoaNome = (id: string): string => {
    const p = pessoas.find(x => x.id === id);
    return p ? p.nome : '—';
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  const pipeline = oportunidades.filter(o => o.estado !== 'perdida');
  const totalPipeline = pipeline.reduce((sum, o) => sum + Number(o.valorEstimado || 0), 0);
  const fechadas = oportunidades.filter(o => o.estado === 'fechada');
  const totalFechado = fechadas.reduce((sum, o) => sum + Number(o.valorEstimado || 0), 0);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          <RocketOutlined style={{ marginRight: 10, color: '#D4A853' }} />
          Oportunidades
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Nova Oportunidade</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card style={{ borderColor: '#2A2D35' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title={<span style={{ color: '#8B8D98', fontSize: 12 }}>Pipeline</span>} value={totalPipeline} prefix="R$" valueStyle={{ color: '#D4A853', fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderColor: '#2A2D35' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title={<span style={{ color: '#8B8D98', fontSize: 12 }}>Fechado</span>} value={totalFechado} prefix="R$" valueStyle={{ color: '#52C97F', fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderColor: '#2A2D35' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic title={<span style={{ color: '#8B8D98', fontSize: 12 }}><DollarOutlined /> Ativas</span>} value={pipeline.length} valueStyle={{ color: '#4A9EFF', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {oportunidades.length === 0 ? (
        <Empty description="Nenhuma oportunidade registrada" style={{ marginTop: 48 }} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {oportunidades.map(op => (
            <Card
              key={op.id}
              hoverable
              onClick={() => handleOpen(op)}
              style={{ borderColor: '#2A2D35', cursor: 'pointer' }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ color: '#E8E8ED', fontSize: 15 }}>{op.titulo}</Text>
                    <Tag color={ESTADO_COLORS[op.estado]}>{op.estado}</Tag>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                    <Text style={{ color: '#5C5E6A', fontSize: 12 }}>👤 {getPessoaNome(op.pessoaId)}</Text>
                    <Text style={{ color: '#5C5E6A', fontSize: 12 }}>📋 {op.proximoPasso || '—'}</Text>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ color: '#D4A853', fontSize: 16 }}>R$ {Number(op.valorEstimado || 0).toLocaleString()}</Text>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      )}

      <Modal
        title={editingId ? 'Editar Oportunidade' : 'Nova Oportunidade'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ estado: 'prospectando', valorEstimado: 0 }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Dashboard para Empresa XYZ" />
          </Form.Item>
          <Form.Item name="pessoaId" label="Pessoa vinculada">
            <Select
              placeholder="Selecione um contato"
              allowClear
              options={pessoas.map(p => ({ value: p.id, label: `${p.nome} (${p.papel})` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="valorEstimado" label="Valor estimado (R$)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estado" label="Estado">
                <Select options={ESTADO_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="proximoPasso" label="Próximo passo">
            <Input placeholder="O que fazer agora para avançar?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}