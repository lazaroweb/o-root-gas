import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Typography, Tag, Popconfirm, Tooltip } from 'antd';
import { Plus, Trash2, Wifi, RefreshCw } from 'lucide-react';
const PlusOutlined = (p: any) => <Plus size={16} {...p} />;
const DeleteOutlined = (p: any) => <Trash2 size={16} {...p} />;
const WifiOutlined = (p: any) => <Wifi size={16} {...p} />;
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { Pulso, ServerResponse } from '../types';

const { Title } = Typography;

interface PulsosPanelProps {
  sistemaId: string;
}

interface FormValues {
  urlCheck: string;
}

const MOCK_PULSOS: Pulso[] = [
  { id: 'pu1', sistemaId: '', urlCheck: 'https://clientflow.app', ultimoStatus: 200, latenciaMs: 145 },
  { id: 'pu2', sistemaId: '', urlCheck: 'https://api.clientflow.app/health', ultimoStatus: 200, latenciaMs: 89 },
];

// Trunca no meio (início + fim), igual exibição de chaves de API, pra liberar
// espaço pras colunas de status/latência. A URL completa fica no tooltip.
function truncMeio(url: string, inicio = 26, fim = 12): string {
  if (url.length <= inicio + fim + 1) return url;
  return `${url.slice(0, inicio)}…${url.slice(-fim)}`;
}

function getStatusTag(status: number): React.ReactElement {
  if (status === 0) return <Tag color="#5C5E6A">Sem dados</Tag>;
  if (status >= 200 && status < 300) return <Tag color="#52C97F">{status} OK</Tag>;
  if (status >= 300 && status < 400) return <Tag color="#4A9EFF">{status} Redirect</Tag>;
  if (status >= 400 && status < 500) return <Tag color="#E8A838">{status} Client Error</Tag>;
  return <Tag color="#E85555">{status} Server Error</Tag>;
}

export default function PulsosPanel({ sistemaId }: PulsosPanelProps): React.ReactElement {
  const t = useTokens();
  const [pulsos, setPulsos] = useState<Pulso[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadPulsos = () => {
    setLoading(true);
    callServer<ServerResponse<Pulso[]>>('getPulsosBySistema', sistemaId)
      .then(res => { if (res.ok && res.data) setPulsos(res.data); })
      .catch(() => setPulsos(MOCK_PULSOS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPulsos(); }, [sistemaId]);

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      await callServer('createPulso', { ...values, sistemaId, ultimoStatus: 0, latenciaMs: 0 });
      message.success('URL adicionada ao monitoramento!');
      setModalOpen(false);
      form.resetFields();
      loadPulsos();
    } catch {
      message.error('Erro ao adicionar URL');
    } finally {
      setSaving(false);
    }
  };

  const verificarAgora = async () => {
    if (pulsos.length === 0) { message.info('Adicione uma URL antes de verificar.'); return; }
    setVerificando(true);
    try {
      const r = await callServer<ServerResponse<Pulso[]>>('verificarPulsosSistema', sistemaId);
      if (r.ok && r.data) { setPulsos(r.data); message.success('Verificação concluída'); }
      else message.error('Erro ao verificar');
    } catch {
      message.error('Erro ao verificar');
    } finally {
      setVerificando(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await callServer('deletePulso', id);
      message.success('URL removida');
      loadPulsos();
    } catch {
      message.error('Erro ao remover');
    }
  };

  const columns = [
    {
      title: 'URL',
      dataIndex: 'urlCheck',
      key: 'urlCheck',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#4A9EFF', whiteSpace: 'nowrap' }}>
            {truncMeio(url)}
          </a>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'ultimoStatus',
      key: 'ultimoStatus',
      width: 130,
      render: (status: number) => getStatusTag(status),
    },
    {
      title: 'Latência',
      dataIndex: 'latenciaMs',
      key: 'latenciaMs',
      width: 100,
      render: (ms: number) => ms > 0 ? (
        <span style={{ color: ms < 300 ? '#52C97F' : ms < 1000 ? '#E8A838' : '#E85555', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
          {ms}ms
        </span>
      ) : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: Pulso) => (
        <Popconfirm title="Remover monitoramento?" onConfirm={() => handleDelete(record.id)} okText="Sim" cancelText="Não">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ color: '#8B8D98', fontWeight: 500, margin: 0 }}>
          <WifiOutlined style={{ marginRight: 8 }} />
          Monitoramento de Pulso
        </Title>
        <Space size={6}>
          <Button size="small" icon={<RefreshCw size={14} className={verificando ? 'forja-spin' : undefined} />} loading={verificando} onClick={verificarAgora}>Verificar agora</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Monitorar URL</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={pulsos}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Nenhuma URL monitorada — adicione para rastrear uptime' }}
      />

      <div style={{ marginTop: 12, padding: '10px 14px', background: t.surfaceMuted, borderRadius: 10 }}>
        <span style={{ color: t.textSecondary, fontSize: 12 }}>
          URLs são verificadas automaticamente a cada 15 minutos via trigger. Ative os triggers nas configurações.
        </span>
      </div>

      <Modal
        title="Monitorar Nova URL"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="urlCheck" label="URL para monitorar" rules={[{ required: true, message: 'URL obrigatória' }, { type: 'url', message: 'URL inválida' }]}>
            <Input placeholder="https://meuapp.com/health" style={{ fontFamily: '"JetBrains Mono", monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}