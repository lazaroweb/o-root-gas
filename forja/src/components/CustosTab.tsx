import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm, App as AntApp } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Custo, ServerResponse, ServerResult } from '../types';

interface CustosTabProps {
  sistemaId: string;
  // Chamado após qualquer mudança (add/remover) pra o pai recalcular a saúde.
  onChanged?: () => void;
}

const RECORRENCIAS = ['mensal', 'anual', 'trimestral', 'único'];

function fmtBRL(v: number): string {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

export default function CustosTab({ sistemaId, onChanged }: CustosTabProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResponse<Custo[]>>('getCustosBySistema', sistemaId)
      .then((r) => { if (r.ok && r.data) setCustos(r.data); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sistemaId]);

  const abrirNovo = () => {
    form.resetFields();
    form.setFieldsValue({ recorrencia: 'mensal', valor: 0 });
    setModalOpen(true);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const payload = {
        sistemaId,
        fornecedor: String(v.fornecedor || '').trim(),
        valor: Number(v.valor || 0),
        recorrencia: String(v.recorrencia || 'mensal'),
        categoria: String(v.categoria || '').trim(),
        proximaCobranca: v.proximaCobranca ? dayjs(v.proximaCobranca).format('YYYY-MM-DD') : '',
      };
      const r = await callServer<ServerResult>('createCusto', payload);
      if (r.ok) {
        message.success('Custo adicionado');
        setModalOpen(false);
        carregar();
        onChanged?.();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } catch (e) {
      if (e && (e as { errorFields?: unknown }).errorFields) return; // validação
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const remover = async (id: string) => {
    try {
      const r = await callServer<ServerResult>('deleteCusto', id);
      if (r.ok) { message.success('Custo removido'); carregar(); onChanged?.(); }
      else message.error(r.error || 'Erro ao remover');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const columns = [
    { title: 'Fornecedor', dataIndex: 'fornecedor', key: 'fornecedor' },
    { title: 'Valor', dataIndex: 'valor', key: 'valor', width: 110, render: (v: number) => fmtBRL(v) },
    { title: 'Recorrência', dataIndex: 'recorrencia', key: 'recorrencia', width: 110 },
    { title: 'Categoria', dataIndex: 'categoria', key: 'categoria', render: (c: string) => c || '—' },
    { title: 'Próxima cobrança', dataIndex: 'proximaCobranca', key: 'proximaCobranca', width: 140, render: (d: string) => d || '—' },
    {
      title: '', key: 'actions', width: 50,
      render: (_: unknown, rec: Custo) => (
        <Popconfirm title="Remover este custo?" onConfirm={() => remover(rec.id)} okText="Sim" cancelText="Não">
          <Button type="text" size="small" danger icon={<Trash2 size={15} />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button size="small" icon={<Plus size={15} />} onClick={abrirNovo}>Adicionar custo</Button>
      </div>

      <Table
        columns={columns}
        dataSource={custos}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Nenhum custo registrado ainda.' }}
      />

      <Modal
        title="Adicionar custo recorrente"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={salvar}
        confirmLoading={saving}
        okText="Salvar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="fornecedor" label="Fornecedor / serviço" rules={[{ required: true, message: 'Informe o fornecedor' }]}>
            <Input placeholder="Ex.: Google Workspace, OpenAI, domínio .com.br" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]} style={{ flex: 1 }}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0,00" />
            </Form.Item>
            <Form.Item name="recorrencia" label="Recorrência" style={{ flex: 1 }}>
              <Select options={RECORRENCIAS.map((r) => ({ value: r, label: r }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="categoria" label="Categoria (opcional)" style={{ flex: 1 }}>
              <Input placeholder="hospedagem, LLM, domínio…" />
            </Form.Item>
            <Form.Item name="proximaCobranca" label="Próxima cobrança (opcional)" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
          <p style={{ fontSize: 12, color: t.textTertiary, fontFamily: FONTS.ui, margin: 0 }}>
            Cadastrar ao menos 1 custo destrava o fator "Custos cadastrados" na Saúde.
          </p>
        </Form>
      </Modal>
    </div>
  );
}
