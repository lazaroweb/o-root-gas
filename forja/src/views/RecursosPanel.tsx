import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Typography, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, DatabaseOutlined, KeyOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Recurso, ServerResponse } from '../types';

const { Title } = Typography;

interface RecursosPanelProps {
  sistemaId: string;
}

const TIPO_OPTIONS = [
  { value: 'endpoint', label: '🔌 Endpoint / API' },
  { value: 'db', label: '🗄️ Banco de Dados' },
  { value: 'env', label: '🔑 Variável de Ambiente' },
];

const TIPO_ICON: Record<string, React.ReactNode> = {
  endpoint: <ApiOutlined style={{ color: '#4A9EFF' }} />,
  db: <DatabaseOutlined style={{ color: '#52C97F' }} />,
  env: <KeyOutlined style={{ color: '#E8A838' }} />,
};

interface FormValues {
  tipo: 'endpoint' | 'db' | 'env';
  chave: string;
  descricao: string;
  link: string;
}

// Mock para preview local
const MOCK_RECURSOS: Recurso[] = [
  { id: 'r1', sistemaId: '', tipo: 'endpoint', chave: 'POST /api/users', descricao: 'Cria novo usuário', link: 'https://docs.api.com/users' },
  { id: 'r2', sistemaId: '', tipo: 'db', chave: 'Supabase PostgreSQL', descricao: 'Banco principal', link: 'https://app.supabase.com/project/xyz' },
  { id: 'r3', sistemaId: '', tipo: 'env', chave: 'SUPABASE_URL', descricao: 'URL de conexão do Supabase', link: '' },
];

export default function RecursosPanel({ sistemaId }: RecursosPanelProps): React.ReactElement {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadRecursos = () => {
    setLoading(true);
    callServer<ServerResponse<Recurso[]>>('getRecursosBySistema', sistemaId)
      .then(res => {
        if (res.ok && res.data) setRecursos(res.data);
      })
      .catch(() => setRecursos(MOCK_RECURSOS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRecursos(); }, [sistemaId]);

  const handleOpen = (recurso?: Recurso) => {
    if (recurso) {
      setEditingId(recurso.id);
      form.setFieldsValue(recurso);
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
        await callServer('updateRecurso', editingId, { ...values, sistemaId });
      } else {
        await callServer('createRecurso', { ...values, sistemaId });
      }
      message.success(editingId ? 'Recurso atualizado!' : 'Recurso criado!');
      setModalOpen(false);
      loadRecursos();
    } catch {
      message.error('Erro ao salvar recurso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await callServer('deleteRecurso', id);
      message.success('Recurso removido');
      loadRecursos();
    } catch {
      message.error('Erro ao remover recurso');
    }
  };

  const columns = [
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 50,
      render: (tipo: string) => TIPO_ICON[tipo] || null,
    },
    {
      title: 'Chave',
      dataIndex: 'chave',
      key: 'chave',
      render: (text: string) => (
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13 }}>{text}</span>
      ),
    },
    { title: 'Descrição', dataIndex: 'descricao', key: 'descricao', ellipsis: true },
    {
      title: 'Link',
      dataIndex: 'link',
      key: 'link',
      render: (link: string) => link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#4A9EFF' }}>↗</a>
      ) : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Recurso) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)} />
          <Popconfirm title="Remover recurso?" onConfirm={() => handleDelete(record.id)} okText="Sim" cancelText="Não">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ color: '#8B8D98', fontWeight: 500, margin: 0 }}>Recursos</Title>
        <Button size="small" icon={<PlusOutlined />} onClick={() => handleOpen()}>Adicionar</Button>
      </div>

      <Table
        columns={columns}
        dataSource={recursos}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Nenhum recurso registrado' }}
      />

      <Modal
        title={editingId ? 'Editar Recurso' : 'Novo Recurso'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ tipo: 'endpoint' }}>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={TIPO_OPTIONS} />
          </Form.Item>
          <Form.Item name="chave" label="Chave / Identificador" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: POST /api/users, DATABASE_URL, Supabase" style={{ fontFamily: '"JetBrains Mono", monospace' }} />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} placeholder="O que é este recurso?" />
          </Form.Item>
          <Form.Item name="link" label="Link (opcional)">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
