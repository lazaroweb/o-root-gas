import React, { useState, useEffect } from 'react';
import { Typography, Button, Table, Modal, Form, Input, Select, Space, Tag, message, Spin } from 'antd';
import { PlusOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Pessoa, ServerResponse } from '../types';

const { Title } = Typography;

interface FormValues {
  nome: string;
  contato: string;
  papel: 'cliente' | 'parceiro';
  notas: string;
}

const PAPEL_OPTIONS = [
  { value: 'cliente', label: '👤 Cliente' },
  { value: 'parceiro', label: '🤝 Parceiro' },
];

const MOCK_PESSOAS: Pessoa[] = [
  { id: 'p1', nome: 'João Silva', contato: 'joao@empresa.com', papel: 'cliente', notas: 'Empresa de logística, quer dashboard' },
  { id: 'p2', nome: 'Ana Rodrigues', contato: '@ana_dev', papel: 'parceiro', notas: 'Dev frontend, parceira em projetos' },
];

export default function PessoasView(): React.ReactElement {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const loadPessoas = () => {
    setLoading(true);
    callServer<ServerResponse<Pessoa[]>>('getPessoas')
      .then(res => { if (res.ok && res.data) setPessoas(res.data); })
      .catch(() => setPessoas(MOCK_PESSOAS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPessoas(); }, []);

  const handleOpen = (pessoa?: Pessoa) => {
    if (pessoa) {
      setEditingId(pessoa.id);
      form.setFieldsValue(pessoa);
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
        await callServer('updatePessoa', editingId, values);
      } else {
        await callServer('createPessoa', values);
      }
      message.success(editingId ? 'Contato atualizado!' : 'Contato adicionado!');
      setModalOpen(false);
      loadPessoas();
    } catch {
      message.error('Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Nome', dataIndex: 'nome', key: 'nome', render: (t: string) => <strong style={{ color: '#E8E8ED' }}>{t}</strong> },
    { title: 'Contato', dataIndex: 'contato', key: 'contato', render: (t: string) => <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{t}</span> },
    {
      title: 'Papel',
      dataIndex: 'papel',
      key: 'papel',
      render: (papel: string) => <Tag color={papel === 'cliente' ? '#4A9EFF' : '#52C97F'}>{papel}</Tag>,
    },
    { title: 'Notas', dataIndex: 'notas', key: 'notas', ellipsis: true },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: Pessoa) => (
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)} />
      ),
    },
  ];

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          <TeamOutlined style={{ marginRight: 10, color: '#4A9EFF' }} />
          Pessoas
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Novo Contato</Button>
      </div>

      <Table
        columns={columns}
        dataSource={pessoas}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: 'Nenhum contato registrado' }}
      />

      <Modal
        title={editingId ? 'Editar Contato' : 'Novo Contato'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ papel: 'cliente' }}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Nome completo" />
          </Form.Item>
          <Form.Item name="contato" label="Contato" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Email, telefone ou @usuario" />
          </Form.Item>
          <Form.Item name="papel" label="Papel">
            <Select options={PAPEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} placeholder="Informações adicionais sobre esta pessoa" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}