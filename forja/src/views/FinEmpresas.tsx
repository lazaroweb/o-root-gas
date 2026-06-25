// FinEmpresas — cadastro e gestão das empresas (multi-empresa). Modal acionado
// pelo seletor de empresa no topo do Financeiro. Cada empresa carrega CNPJ,
// regime e dados fiscais; uma é marcada como "padrão" (recebe o histórico e os
// lançamentos quando a visão ativa é Consolidado).
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Table, Button, Form, Input, Select, InputNumber, Tag, Popconfirm, App as AntApp, ColorPicker } from 'antd';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { Empresa, ServerResponse } from '../types';

const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Outro'];
const ANEXOS = [
  { value: '', label: '—' },
  { value: 'I', label: 'Anexo I (Comércio)' },
  { value: 'II', label: 'Anexo II (Indústria)' },
  { value: 'III', label: 'Anexo III (Serviços)' },
  { value: 'IV', label: 'Anexo IV (Serviços)' },
  { value: 'V', label: 'Anexo V (Serviços)' },
];

export default function FinEmpresas({ open, onClose, onChange, abrirNovo }: {
  open: boolean; onClose: () => void; onChange?: () => void; abrirNovo?: boolean;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<{ empresas: Empresa[] }>>('getEmpresas')
      .then((res) => { if (res.ok && res.data) setEmpresas((res.data as { empresas: Empresa[] }).empresas || []); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  const abrir = useCallback((e?: Empresa) => {
    if (e) { setEditingId(e.id); form.setFieldsValue({ ...e }); }
    else { setEditingId(null); form.resetFields(); form.setFieldsValue({ regime: 'Simples Nacional', cor: '#8b5cf6', anexo: '' }); }
    setFormOpen(true);
  }, [form]);

  useEffect(() => { if (open) load(); }, [open, load]);
  // Atalho "Nova empresa" vindo do seletor: abre já no formulário em branco.
  useEffect(() => { if (open && abrirNovo) abrir(); }, [open, abrirNovo, abrir]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const cor = typeof v['cor'] === 'object' && v['cor'] ? (v['cor'] as { toHexString?: () => string }).toHexString?.() : v['cor'];
      const payload = { ...v, cor: cor || '#8b5cf6', id: editingId || undefined };
      const res = await callServer<ServerResponse<unknown>>('salvarEmpresa', payload);
      if (res.ok) { message.success(editingId ? 'Empresa atualizada' : 'Empresa cadastrada'); setFormOpen(false); load(); onChange?.(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const tornarPadrao = (e: Empresa) => {
    callServer<ServerResponse<unknown>>('salvarEmpresa', { ...e, padrao: true })
      .then((res) => { if (res.ok) { message.success(`${e.nomeFantasia || e.razaoSocial} é a empresa padrão`); load(); onChange?.(); } else message.error(res.error || 'Erro'); });
  };

  const remover = (e: Empresa) => {
    callServer<ServerResponse<unknown>>('deletarEmpresa', e.id)
      .then((res) => { if (res.ok) { message.success('Empresa excluída'); load(); onChange?.(); } else message.error(res.error || 'Erro'); });
  };

  return (
    <>
      <Modal title="Empresas" open={open} onCancel={onClose} footer={null} width={920} style={{ top: 40 }} destroyOnClose>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => abrir()}>Nova empresa</Button>
        </div>
        <Table
          rowKey="id"
          dataSource={empresas}
          loading={loading}
          pagination={false}
          size="middle"
          tableLayout="fixed"
          columns={[
            {
              title: 'Empresa', dataIndex: 'nomeFantasia', ellipsis: true,
              render: (_: string, e: Empresa) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: e.cor || '#8b5cf6', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nomeFantasia || e.razaoSocial}</span>
                  {e.padrao && <Tag color="gold" style={{ marginInlineStart: 4, flexShrink: 0 }}>Padrão</Tag>}
                </div>
              ),
            },
            { title: 'CNPJ', dataIndex: 'cnpj', width: 180, ellipsis: true, render: (v: string) => <span style={{ color: t.textSecondary }}>{v || '—'}</span> },
            { title: 'Regime', dataIndex: 'regime', width: 200, ellipsis: true, render: (v: string, e: Empresa) => <span style={{ color: t.textSecondary }}>{v}{e.anexo ? ` · Anexo ${e.anexo}` : ''}</span> },
            {
              title: 'Ações', key: 'acoes', align: 'right', width: 160,
              render: (_: unknown, e: Empresa) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {!e.padrao && (
                    <Popconfirm title="Tornar esta a empresa padrão?" okText="Sim" cancelText="Não" onConfirm={() => tornarPadrao(e)}>
                      <Button size="small" icon={<Star size={14} />} />
                    </Popconfirm>
                  )}
                  <Button size="small" icon={<Pencil size={14} />} onClick={() => abrir(e)} />
                  <Popconfirm title="Excluir empresa?" description="O histórico financeiro dela não é apagado." okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => remover(e)}>
                    <Button size="small" danger icon={<Trash2 size={14} />} disabled={e.padrao} />
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={editingId ? 'Editar empresa' : 'Nova empresa'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        okText="Salvar"
        confirmLoading={saving}
        width={620}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={salvar} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Form.Item name="razaoSocial" label="Razão social" rules={[{ required: true, message: 'Informe a razão social' }]}>
              <Input placeholder="Ex.: Lazaro Tech Ltda" />
            </Form.Item>
            <Form.Item name="cor" label="Cor">
              <ColorPicker />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="nomeFantasia" label="Nome fantasia">
              <Input placeholder="Como aparece nos seletores" />
            </Form.Item>
            <Form.Item name="cnpj" label="CNPJ">
              <Input placeholder="00.000.000/0000-00" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="regime" label="Regime">
              <Select options={REGIMES.map((r) => ({ value: r, label: r }))} />
            </Form.Item>
            <Form.Item name="anexo" label="Anexo (Simples)">
              <Select options={ANEXOS} />
            </Form.Item>
            <Form.Item name="rbt12" label="RBT12 (R$)" tooltip="Receita bruta dos últimos 12 meses — base da alíquota efetiva.">
              <InputNumber min={0} step={1000} decimalSeparator="," style={{ width: '100%' }} controls={false} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="inscricaoMunicipal" label="Inscrição municipal">
              <Input />
            </Form.Item>
            <Form.Item name="inscricaoEstadual" label="Inscrição estadual">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="E-mail">
              <Input type="email" />
            </Form.Item>
            <Form.Item name="telefone" label="Telefone">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="logradouro" label="Logradouro"><Input /></Form.Item>
            <Form.Item name="numero" label="Número"><Input /></Form.Item>
            <Form.Item name="cep" label="CEP"><Input /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 12 }}>
            <Form.Item name="bairro" label="Bairro"><Input /></Form.Item>
            <Form.Item name="cidade" label="Cidade"><Input /></Form.Item>
            <Form.Item name="uf" label="UF"><Input maxLength={2} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
