import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, Tag, Spin, App as AntApp, Tooltip } from 'antd';
import { Plus, Pencil, FileText } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import ClienteSnapshotDrawer from '../components/ClienteSnapshotDrawer';
import type { Pessoa, ServerResponse } from '../types';

interface FormValues {
  nome: string;
  contato: string;
  papel: 'cliente' | 'parceiro';
  notas: string;
}

const PAPEL_OPTIONS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'parceiro', label: 'Parceiro' },
];

const MOCK_PESSOAS: Pessoa[] = [
  { id: 'p1', nome: 'João Silva', contato: 'joao@example.com', papel: 'cliente', notas: 'Empresa de logística, quer dashboard' },
  { id: 'p2', nome: 'Ana Rodrigues', contato: '@ana_dev', papel: 'parceiro', notas: 'Dev frontend, parceira em projetos' },
];

export default function PessoasView({ embedded = false }: { embedded?: boolean } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snapshotPessoa, setSnapshotPessoa] = useState<{ id: string; nome: string } | null>(null);
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
    if (pessoa) { setEditingId(pessoa.id); form.setFieldsValue(pessoa); }
    else { setEditingId(null); form.resetFields(); }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      if (editingId) await callServer('updatePessoa', editingId, values);
      else await callServer('createPessoa', values);
      message.success(editingId ? 'Contato atualizado' : 'Contato adicionado');
      setModalOpen(false);
      loadPessoas();
    } catch { message.error('Erro ao salvar contato'); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: 'Nome', dataIndex: 'nome', key: 'nome', render: (v: string) => <strong style={{ color: t.text }}>{v}</strong> },
    { title: 'Contato', dataIndex: 'contato', key: 'contato', render: (v: string) => <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textSecondary }}>{v}</span> },
    {
      title: 'Papel', dataIndex: 'papel', key: 'papel',
      render: (papel: string) => {
        const c = papel === 'cliente' ? t.accents.blue : t.accents.sage;
        return <Tag bordered={false} style={{ background: `${c}1f`, color: c, borderRadius: 999, textTransform: 'capitalize' }}>{papel}</Tag>;
      },
    },
    { title: 'Notas', dataIndex: 'notas', key: 'notas', ellipsis: true, render: (v: string) => <span style={{ color: t.textSecondary }}>{v}</span> },
    {
      title: '', key: 'actions', width: 96,
      render: (_: unknown, record: Pessoa) => (
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Snapshot do cliente (sistemas, financeiro, alertas)">
            <Button type="text" size="small" icon={<FileText size={15} />} onClick={() => setSnapshotPessoa({ id: record.id, nome: record.nome })} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => handleOpen(record)} />
          </Tooltip>
        </div>
      ),
    },
  ];

  const snapshotDrawer = (
    <ClienteSnapshotDrawer
      pessoaId={snapshotPessoa?.id || null}
      pessoaNome={snapshotPessoa?.nome}
      onClose={() => setSnapshotPessoa(null)}
    />
  );

  const modal = (
    <Modal title={editingId ? 'Editar contato' : 'Novo contato'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ papel: 'cliente' }}>
        <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
          <Input placeholder="Nome completo" />
        </Form.Item>
        <Form.Item name="contato" label="Contato" rules={[{ required: true, message: 'Obrigatório' }]}>
          <Input placeholder="Email, telefone ou @usuario" />
        </Form.Item>
        <Form.Item name="papel" label="Papel"><Select options={PAPEL_OPTIONS} /></Form.Item>
        <Form.Item name="notas" label="Notas"><Input.TextArea rows={2} placeholder="Informações adicionais" /></Form.Item>
      </Form>
    </Modal>
  );

  if (embedded) {
    return (
      <div style={{ animation: 'forjaFadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Novo contato</Button>
        </div>
        {loading
          ? <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
          : <Table columns={columns} dataSource={pessoas} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} locale={{ emptyText: 'Nenhum contato registrado' }} />}
        {modal}
        {snapshotDrawer}
      </div>
    );
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1000, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Clientes"
        subtitle="Seu mini-CRM: quem traz as oportunidades e os projetos."
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Novo contato</Button>}
      />

      <Table columns={columns} dataSource={pessoas} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} locale={{ emptyText: 'Nenhum contato registrado' }} />

      {modal}
      {snapshotDrawer}
    </div>
  );
}
