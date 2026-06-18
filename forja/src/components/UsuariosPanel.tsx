import React, { useEffect, useState, useCallback } from 'react';
import { Button, Input, Select, Tag, Popconfirm, App as AntApp, Modal, Form, Switch, Spin } from 'antd';
import { ShieldCheck, UserPlus, Trash2, Pencil, Crown, Mail } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse, UsuarioAcesso } from '../types';

const PAPEL_INFO: Record<string, { label: string; cor: (t: ReturnType<typeof useTokens>) => string; desc: string }> = {
  admin: { label: 'Admin', cor: (t) => t.accents.peach, desc: 'Acesso total: financeiro, configurações, usuários e exclusões.' },
  operacional: { label: 'Operacional', cor: (t) => t.accents.blue, desc: 'Operação do dia a dia. Sem financeiro, configurações ou usuários.' },
  leitor: { label: 'Leitor', cor: (t) => t.accents.sage, desc: 'Somente leitura. Não cria, edita nem exclui.' },
};

export default function UsuariosPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioAcesso | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<UsuarioAcesso[]>>('getUsuarios')
      .then((r) => { if (r.ok && r.data) setUsuarios(r.data as UsuarioAcesso[]); else message.error(r.error || 'Erro ao carregar usuários'); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ papel: 'operacional', ativo: true }); setModalOpen(true); };
  const abrirEditar = (u: UsuarioAcesso) => { setEditing(u); form.setFieldsValue({ email: u.email, nome: u.nome, papel: u.papel, ativo: u.ativo }); setModalOpen(true); };

  const salvar = (v: Record<string, unknown>) => {
    setSalvando(true);
    callServer<ServerResponse<unknown>>('salvarUsuario', {
      email: v.email, nome: v.nome, papel: v.papel, ativo: v.ativo,
    })
      .then((r) => {
        if (r.ok) { message.success(editing ? 'Usuário atualizado' : 'Usuário adicionado'); setModalOpen(false); carregar(); }
        else message.error((r.error || 'Erro').replace('PERMISSAO_NEGADA::', ''));
      })
      .catch(() => message.error('Erro ao salvar'))
      .finally(() => setSalvando(false));
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('removerUsuario', id)
      .then((r) => { if (r.ok) { message.success('Usuário removido'); carregar(); } else message.error((r.error || 'Erro').replace('PERMISSAO_NEGADA::', '')); })
      .catch(() => message.error('Erro ao remover'));
  };

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} strokeWidth={1.6} color={t.accents.peach} /> Usuários & acesso</span>}
      extra={<Button type="primary" icon={<UserPlus size={15} />} onClick={abrirNovo}>Adicionar usuário</Button>}
    >
      <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.7 }}>
        Controle quem acessa a Forja e o que cada um pode fazer. Papéis: <b style={{ color: PAPEL_INFO.admin.cor(t) }}>Admin</b> (tudo),{' '}
        <b style={{ color: PAPEL_INFO.operacional.cor(t) }}>Operacional</b> (dia a dia, sem financeiro/config) e{' '}
        <b style={{ color: PAPEL_INFO.leitor.cor(t) }}>Leitor</b> (somente leitura). O owner é sempre Admin.
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '24px auto' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.map((u) => {
            const info = PAPEL_INFO[u.papel] || PAPEL_INFO.operacional;
            const cor = info.cor(t);
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.surface, opacity: u.ativo ? 1 : 0.55 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: `${cor}22`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 600, fontSize: 15, flexShrink: 0 }}>
                  {(u.nome || u.email).charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: t.text, fontWeight: 500, fontSize: 14 }}>{u.nome || '(sem nome)'}</span>
                    {u.isOwner && (
                      <Tag bordered={false} style={{ background: `${t.accents.peach}1f`, color: t.accents.peach, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Crown size={9} /> Owner
                      </Tag>
                    )}
                    {!u.ativo && <Tag bordered={false} style={{ fontSize: 10, color: t.textTertiary }}>inativo</Tag>}
                  </div>
                  <div style={{ color: t.textTertiary, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {u.email}</div>
                </div>
                <Tag bordered={false} style={{ background: `${cor}1a`, color: cor, fontWeight: 600 }}>{info.label}</Tag>
                {!u.isOwner && (
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => abrirEditar(u)} />
                    <Popconfirm title={`Remover ${u.nome || u.email}?`} description="Ele perde o acesso à Forja." okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => remover(u.id)}>
                      <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                    </Popconfirm>
                  </span>
                )}
              </div>
            );
          })}
          {usuarios.length === 0 && <div style={{ color: t.textTertiary, fontSize: 13, padding: '8px 2px' }}>Nenhum usuário cadastrado ainda.</div>}
        </div>
      )}

      <Modal
        title={editing ? 'Editar usuário' : 'Adicionar usuário'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? 'Salvar' : 'Adicionar'}
        cancelText="Cancelar"
        confirmLoading={salvando}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="email" label="E-mail (conta Google)" rules={[{ required: true, message: 'Informe o e-mail' }, { type: 'email', message: 'E-mail inválido' }]}>
            <Input placeholder="colaborador@example.com" disabled={!!editing} autoComplete="off" />
          </Form.Item>
          <Form.Item name="nome" label="Nome">
            <Input placeholder="Nome do colaborador" autoComplete="off" />
          </Form.Item>
          <Form.Item name="papel" label="Papel" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'admin', label: 'Admin — acesso total' },
                { value: 'operacional', label: 'Operacional — dia a dia (sem financeiro/config)' },
                { value: 'leitor', label: 'Leitor — somente leitura' },
              ]}
            />
          </Form.Item>
          <Form.Item name="ativo" label="Ativo" valuePropName="checked" extra="Desative para suspender o acesso sem remover.">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}
