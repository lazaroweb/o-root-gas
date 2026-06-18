import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Table, Tag, App as AntApp, Popconfirm, InputNumber } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Custo, Sistema, ServerResponse } from '../types';

const RECORRENCIAS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];
const CATEGORIAS = [
  { value: 'Hospedagem', label: 'Hospedagem' },
  { value: 'API/LLM', label: 'API/LLM' },
  { value: 'Domínio', label: 'Domínio' },
  { value: 'Banco de dados', label: 'Banco de dados' },
  { value: 'Ferramenta', label: 'Ferramenta' },
  { value: 'Outro', label: 'Outro' },
];

export default function FinCustos({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const nomeDe = (id?: string) => sistemas.find(s => s.id === id)?.nome || 'Sem app';

  const load = () => {
    setLoading(true);
    callServer<ServerResponse<Custo[]>>('getCustos')
      .then(res => { if (res.ok && res.data) setCustos(res.data as Custo[]); })
      .catch(() => setCustos([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const abrir = (c?: Custo) => {
    if (c) { setEditingId(c.id); form.setFieldsValue(c); }
    else { setEditingId(null); form.resetFields(); form.setFieldsValue({ recorrencia: 'mensal', categoria: 'Hospedagem' }); }
    setOpen(true);
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingId) await callServer('updateCusto', editingId, v);
      else await callServer('createCusto', v);
      message.success(editingId ? 'Custo atualizado' : 'Custo criado');
      setOpen(false); load();
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deleteCusto', id)
      .then(res => { if (res.ok) { setCustos(c => c.filter(x => x.id !== id)); message.success('Removido'); } else message.error(res.error || 'Erro'); });
  };

  return (
    <div>
      <Panel
        title="Contas a pagar (custos)"
        extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => abrir()}>Novo custo</Button>}
        padding={8}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={custos}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhum custo cadastrado' }}
          columns={[
            { title: 'Fornecedor', dataIndex: 'fornecedor', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v || '—'}</span> },
            { title: 'Categoria', dataIndex: 'categoria', render: (v: string) => <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue }}>{v || 'Outro'}</Tag> },
            { title: 'Aplicação', dataIndex: 'sistemaId', render: (id: string) => <span style={{ color: t.textSecondary }}>{nomeDe(id)}</span> },
            { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ color: t.accents.clay, fontFamily: FONTS.mono }}>{formatBRL(Number(v || 0))}</span> },
            { title: 'Recorrência', dataIndex: 'recorrencia', render: (v: string) => <span style={{ color: t.textSecondary, textTransform: 'capitalize' }}>{v || 'mensal'}</span> },
            { title: 'Próx. cobrança', dataIndex: 'proximaCobranca', render: (v: string) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{v || '—'}</span> },
            {
              title: '', key: 'acoes', align: 'right', width: 90, render: (_: unknown, c: Custo) => (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => abrir(c)} />
                  <Popconfirm title="Remover custo?" onConfirm={() => remover(c.id)} okText="Remover" cancelText="Cancelar">
                    <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Modal title={editingId ? 'Editar custo' : 'Novo custo'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="fornecedor" label="Fornecedor" rules={[{ required: true, message: 'Informe o fornecedor' }]}>
            <Input placeholder="Ex.: Vercel, Supabase, Anthropic" />
          </Form.Item>
          <Form.Item name="categoria" label="Categoria"><Select options={CATEGORIAS} /></Form.Item>
          <Form.Item name="sistemaId" label="Aplicação (opcional)">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Vincular a um app" options={sistemas.map(s => ({ value: s.id, label: s.nome }))} />
          </Form.Item>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="recorrencia" label="Recorrência"><Select options={RECORRENCIAS} /></Form.Item>
          <Form.Item name="proximaCobranca" label="Próxima cobrança"><Input type="date" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
