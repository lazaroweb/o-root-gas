import React, { useState, useEffect } from 'react';
import { Typography, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, Row, Col, Empty, Spin, App as AntApp } from 'antd';
import { Plus } from 'lucide-react';
import { PageHeader, Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Oportunidade, Pessoa, ServerResponse } from '../types';

const { Text } = Typography;

interface FormValues {
  titulo: string;
  pessoaId: string;
  valorEstimado: number;
  estado: string;
  proximoPasso: string;
}

const ESTADO_OPTIONS = [
  { value: 'prospectando', label: 'Prospectando' },
  { value: 'negociando', label: 'Negociando' },
  { value: 'proposta enviada', label: 'Proposta enviada' },
  { value: 'fechada', label: 'Fechada' },
  { value: 'perdida', label: 'Perdida' },
];

export default function OportunidadesView(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const estadoColor = (e: string): string => ({
    prospectando: t.accents.blue, negociando: t.accents.clay, 'proposta enviada': t.accents.peach, fechada: t.accents.sage, perdida: t.textTertiary,
  } as Record<string, string>)[e] || t.accents.blue;

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
      .catch(() => { setOportunidades([]); setPessoas([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleOpen = (op?: Oportunidade) => {
    if (op) { setEditingId(op.id); form.setFieldsValue(op); }
    else { setEditingId(null); form.resetFields(); }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      if (editingId) await callServer('updateOportunidade', editingId, values);
      else await callServer('createOportunidade', { ...values, estado: values.estado || 'prospectando' });
      message.success(editingId ? 'Oportunidade atualizada' : 'Oportunidade criada');
      setModalOpen(false);
      loadData();
    } catch { message.error('Erro ao salvar oportunidade'); }
    finally { setSaving(false); }
  };

  const getPessoaNome = (id: string): string => pessoas.find(x => x.id === id)?.nome || '—';

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  const pipeline = oportunidades.filter(o => o.estado !== 'perdida');
  const totalPipeline = pipeline.reduce((sum, o) => sum + Number(o.valorEstimado || 0), 0);
  const totalFechado = oportunidades.filter(o => o.estado === 'fechada').reduce((sum, o) => sum + Number(o.valorEstimado || 0), 0);

  const miniStat = (label: string, value: string, color: string) => (
    <Panel padding={16} style={{ flex: 1 }}>
      <Text style={{ color: t.textSecondary, fontSize: 12 }}>{label}</Text>
      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color, marginTop: 4 }}>{value}</div>
    </Panel>
  );

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1040, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Oportunidades"
        subtitle="Seu pipeline comercial, do primeiro contato ao fechamento."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Nova oportunidade</Button>}
      />

      <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
        {miniStat('Pipeline', formatBRL(totalPipeline), t.accents.peach)}
        {miniStat('Fechado', formatBRL(totalFechado), t.accents.sage)}
        {miniStat('Ativas', String(pipeline.length), t.accents.blue)}
      </div>

      {oportunidades.length === 0 ? (
        <Empty description="Nenhuma oportunidade registrada" style={{ marginTop: 48 }} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {oportunidades.map(op => (
            <div
              key={op.id}
              onClick={() => handleOpen(op)}
              style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadowSoft, padding: '16px 20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ color: t.text, fontSize: 15 }}>{op.titulo}</Text>
                    <Tag bordered={false} style={{ background: `${estadoColor(op.estado)}1f`, color: estadoColor(op.estado), borderRadius: 999, textTransform: 'capitalize' }}>{op.estado}</Tag>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                    <Text style={{ color: t.textTertiary, fontSize: 12 }}>{getPessoaNome(op.pessoaId)}</Text>
                    <Text style={{ color: t.textTertiary, fontSize: 12 }}>{op.proximoPasso || '—'}</Text>
                  </div>
                </div>
                <Text strong style={{ color: t.accents.peach, fontSize: 16, fontFamily: FONTS.mono }}>{formatBRL(Number(op.valorEstimado || 0))}</Text>
              </div>
            </div>
          ))}
        </Space>
      )}

      <Modal title={editingId ? 'Editar oportunidade' : 'Nova oportunidade'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose width={520}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ estado: 'prospectando', valorEstimado: 0 }}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Dashboard para Empresa XYZ" />
          </Form.Item>
          <Form.Item name="pessoaId" label="Pessoa vinculada">
            <Select placeholder="Selecione um contato" allowClear options={pessoas.map(p => ({ value: p.id, label: `${p.nome} (${p.papel})` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="valorEstimado" label="Valor estimado (R$)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="estado" label="Estado"><Select options={ESTADO_OPTIONS} /></Form.Item></Col>
          </Row>
          <Form.Item name="proximoPasso" label="Próximo passo"><Input placeholder="O que fazer agora para avançar?" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
