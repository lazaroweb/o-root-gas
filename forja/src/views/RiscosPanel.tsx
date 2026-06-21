import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Space, message, Typography, Card, Tag, Empty, Popconfirm } from 'antd';
import { Plus, Pencil, AlertTriangle, Trash2 } from 'lucide-react';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { Risco, ServerResponse, ServerResult } from '../types';

const { Title, Text, Paragraph } = Typography;

interface RiscosPanelProps {
  sistemaId: string;
  onChanged?: () => void;
}

interface FormValues {
  area: string;
  descricao: string;
  gravidade: string;
  historicoIncidentes: string;
}

type GravTxt = 'alta' | 'media' | 'baixa';

// Normaliza gravidade pra texto. Aceita texto ('alta'/'média'/...) ou número
// legado (1-10): >=8 alta, >=5 média, resto baixa.
function normGrav(g: unknown): GravTxt {
  const s = String(g ?? '').toLowerCase().trim();
  if (s === 'alta') return 'alta';
  if (s === 'media' || s === 'média') return 'media';
  if (s === 'baixa') return 'baixa';
  const n = Number(g);
  if (!Number.isNaN(n) && n > 0) return n >= 8 ? 'alta' : n >= 5 ? 'media' : 'baixa';
  return 'media';
}

const GRAV_LABEL: Record<GravTxt, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const GRAV_COLOR: Record<GravTxt, string> = { alta: '#E85555', media: '#E8A838', baixa: '#52C97F' };
const GRAV_RANK: Record<GravTxt, number> = { alta: 3, media: 2, baixa: 1 };

const MOCK_RISCOS: Risco[] = [
  { id: 'rk1', sistemaId: '', area: 'Autenticação', descricao: 'Token de refresh não rotacionado — sessões podem ser hijacked', gravidade: 'alta', historicoIncidentes: '1 incidente em maio/2026' },
  { id: 'rk2', sistemaId: '', area: 'Rate Limiting', descricao: 'API pública sem rate limit — vulnerável a abuso', gravidade: 'media', historicoIncidentes: '' },
];

export default function RiscosPanel({ sistemaId, onChanged }: RiscosPanelProps): React.ReactElement {
  const t = useTokens();
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadRiscos = () => {
    setLoading(true);
    callServer<ServerResponse<Risco[]>>('getRiscosBySistema', sistemaId)
      .then(res => { if (res.ok && res.data) setRiscos(res.data); })
      .catch(() => setRiscos(MOCK_RISCOS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRiscos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sistemaId]);

  const handleOpen = (risco?: Risco) => {
    if (risco) {
      setEditingId(risco.id);
      form.setFieldsValue({
        area: risco.area,
        descricao: risco.descricao,
        gravidade: normGrav(risco.gravidade),
        historicoIncidentes: risco.historicoIncidentes && String(risco.historicoIncidentes) !== '0' ? risco.historicoIncidentes : '',
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ gravidade: 'media' });
    }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const data = { ...values, gravidade: normGrav(values.gravidade), sistemaId };
      const r = editingId
        ? await callServer<ServerResult>('updateRisco', editingId, data)
        : await callServer<ServerResult>('createRisco', data);
      if (r.ok) {
        message.success(editingId ? 'Risco atualizado!' : 'Risco mapeado!');
        setModalOpen(false);
        loadRiscos();
        onChanged?.();
      } else {
        message.error(r.error || 'Erro ao salvar risco');
      }
    } catch {
      message.error('Erro ao salvar risco');
    } finally {
      setSaving(false);
    }
  };

  const remover = async (id: string) => {
    try {
      const r = await callServer<ServerResult>('deleteRisco', id);
      if (r.ok) { message.success('Risco removido'); loadRiscos(); onChanged?.(); }
      else message.error(r.error || 'Erro ao remover');
    } catch {
      message.error('Erro ao remover risco');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ color: '#8B8D98', fontWeight: 500, margin: 0 }}>
          <AlertTriangle size={16} style={{ marginRight: 8, color: '#E8A838', verticalAlign: 'middle' }} />
          Mapa de Quebra
        </Title>
        <Button size="small" icon={<Plus size={16} />} onClick={() => handleOpen()}>Mapear Risco</Button>
      </div>

      {loading ? null : riscos.length === 0 ? (
        <Empty
          description={
            <span style={{ color: t.textTertiary, fontSize: 13 }}>
              Nenhum risco mapeado.<br />
              Use <strong style={{ color: t.text }}>Auditar com IA</strong> (no topo) pra a Forja
              descobrir riscos automaticamente, ou <strong style={{ color: t.text }}>Mapear Risco</strong> pra registrar manualmente.
            </span>
          }
          style={{ padding: 24 }}
        />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {[...riscos]
            .sort((a, b) => GRAV_RANK[normGrav(b.gravidade)] - GRAV_RANK[normGrav(a.gravidade)])
            .map(risco => {
              const g = normGrav(risco.gravidade);
              const temHistorico = risco.historicoIncidentes && String(risco.historicoIncidentes) !== '0';
              return (
                <Card
                  key={risco.id}
                  size="small"
                  style={{ borderColor: t.border, borderLeft: `3px solid ${GRAV_COLOR[g]}` }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ color: t.text, fontSize: 14 }}>{risco.area}</Text>
                      <Paragraph style={{ color: t.textSecondary, fontSize: 13, margin: '4px 0' }} ellipsis={{ rows: 2 }}>
                        {risco.descricao}
                      </Paragraph>
                      {temHistorico && (
                        <Text style={{ color: t.textTertiary, fontSize: 11 }}>{risco.historicoIncidentes}</Text>
                      )}
                    </div>
                    <Space direction="vertical" align="end" size={6} style={{ flexShrink: 0 }}>
                      <Tag color={GRAV_COLOR[g]} style={{ marginInlineEnd: 0, fontWeight: 600, borderRadius: 999 }}>{GRAV_LABEL[g]}</Tag>
                      <Space size={2}>
                        <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => handleOpen(risco)} />
                        <Popconfirm title="Remover este risco?" onConfirm={() => remover(risco.id)} okText="Sim" cancelText="Não">
                          <Button type="text" size="small" danger icon={<Trash2 size={15} />} />
                        </Popconfirm>
                      </Space>
                    </Space>
                  </div>
                </Card>
              );
            })}
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
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ gravidade: 'media' }}>
          <Form.Item name="area" label="Área / Zona de risco" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Autenticação, Pagamentos, Deploy" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição do risco" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} placeholder="O que pode dar errado? Qual o impacto?" />
          </Form.Item>
          <Form.Item name="gravidade" label="Gravidade" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'alta', label: 'Alta' },
                { value: 'media', label: 'Média' },
                { value: 'baixa', label: 'Baixa' },
              ]}
            />
          </Form.Item>
          <Form.Item name="historicoIncidentes" label="Histórico de incidentes (opcional)">
            <Input.TextArea rows={2} placeholder="Já aconteceu algo? Quando?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
