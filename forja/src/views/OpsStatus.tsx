import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Tag, Empty, Spin, Popconfirm, App as AntApp, Tooltip } from 'antd';
import { Plus, Activity, Trash2, Pencil, Zap, ExternalLink, Sparkles, GitBranch, RefreshCw, Server, Settings as SettingsIcon } from 'lucide-react';
import { Panel, StatusDot } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ApiEndpoint, Sistema, StatusGeral, ServerResponse } from '../types';

interface FormValues {
  nome: string;
  provider: string;
  categoria: string;
  baseUrl: string;
  healthUrl: string;
  modelo: string;
  chaveRef: string;
  sistemaId: string;
}

const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (nativo)' },
  { value: 'openai', label: 'OpenAI (nativo)' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'outro', label: 'Outro' },
];

const SEM_APP = '__sem_app__';

interface OpsStatusProps {
  sistemas: Sistema[];
  // Callback pra levar o user direto em Configurações quando IA ou GitHub
  // estão desconectados (princípio: alerta sem ação proibido).
  onIrParaConfig?: () => void;
}

export default function OpsStatus({ sistemas, onIrParaConfig }: OpsStatusProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [apis, setApis] = useState<ApiEndpoint[]>([]);
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const validar = () => {
    setValidating(true);
    callServer<ServerResponse<StatusGeral>>('getStatusGeral')
      .then(res => { if (res.ok && res.data) setStatus(res.data as StatusGeral); })
      .catch(() => { /* preview local não valida */ })
      .finally(() => setValidating(false));
  };

  const load = () => {
    setLoading(true);
    callServer<ServerResponse<ApiEndpoint[]>>('getApis')
      .then(a => { if (a.ok && a.data) setApis(a.data as ApiEndpoint[]); })
      .catch(() => setApis([]))
      .finally(() => { setLoading(false); validar(); });
  };

  useEffect(load, []);

  const handleOpen = (api?: ApiEndpoint) => {
    if (api) { setEditingId(api.id); form.setFieldsValue({ ...api, sistemaId: api.sistemaId || '' }); }
    else { setEditingId(null); form.resetFields(); form.setFieldsValue({ provider: 'proxy', categoria: 'proxy' }); }
    setModalOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      if (editingId) await callServer('updateApi', editingId, values);
      else await callServer('createApi', { ...values, ultimoStatus: 0, latenciaMs: 0 });
      message.success(editingId ? 'API atualizada' : 'API cadastrada');
      setModalOpen(false);
      load();
    } catch { message.error('Erro ao salvar API'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    callServer<ServerResponse<unknown>>('deleteApi', id)
      .then(res => { if (res.ok) { setApis(a => a.filter(x => x.id !== id)); validar(); message.success('API removida'); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao remover'));
  };

  const handleTest = (id: string) => {
    setTesting(id);
    callServer<ServerResponse<{ ultimoStatus: number; latenciaMs: number; conectado: boolean }>>('testApiEndpoint', id)
      .then(res => {
        if (res.ok && res.data) {
          setApis(a => a.map(x => x.id === id ? { ...x, ultimoStatus: res.data!.ultimoStatus, latenciaMs: res.data!.latenciaMs } : x));
          setStatus(prev => prev ? { ...prev, apis: prev.apis.map(r => r.id === id ? { ...r, status: res.data!.ultimoStatus, latenciaMs: res.data!.latenciaMs, conectado: res.data!.conectado } : r) } : prev);
          message.success(res.data.conectado ? `Conectado (HTTP ${res.data.ultimoStatus}, ${res.data.latenciaMs}ms)` : `Desconectado (HTTP ${res.data.ultimoStatus || 'sem resposta'})`);
        } else message.error(res.error || 'Falha no teste');
      })
      .catch(() => message.error('Teste só funciona no app publicado'))
      .finally(() => setTesting(null));
  };

  const apiStatusOf = (id: string) => status?.apis.find(r => r.id === id);

  const conexaoTag = (conectado: boolean, configurado = true) => {
    if (!configurado) return <Tag bordered={false} style={{ background: `${t.textTertiary}22`, color: t.textTertiary }}>Não configurado</Tag>;
    return (
      <Tag bordered={false} style={{ background: conectado ? `${t.accents.sage}22` : `${t.accents.rose}22`, color: conectado ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>
        {conectado ? 'Conectado' : 'Desconectado'}
      </Tag>
    );
  };

  const statusRow = (icon: React.ReactNode, nome: string, detalhe: string, conectado: boolean, configurado: boolean, latencia?: number) => {
    // Tratativa: linha vai pra Configurações quando há problema (sem config ou desconectada).
    const precisaAjuste = !configurado || !conectado;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${t.borderSoft}` }}>
        <StatusDot color={!configurado ? t.textTertiary : conectado ? t.accents.sage : t.accents.rose} />
        <span style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t.surfaceMuted, color: t.textSecondary }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{nome}</div>
          <div style={{ color: t.textTertiary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detalhe}{latencia ? ` · ${latencia}ms` : ''}</div>
        </div>
        {conexaoTag(conectado, configurado)}
        {precisaAjuste && onIrParaConfig && (
          <Tooltip title={!configurado ? 'Cadastre a chave/token em Configurações.' : 'Verifique a chave/token em Configurações — pode ter expirado ou mudado de endpoint.'}>
            <Button size="small" type="text" icon={<SettingsIcon size={13} />} onClick={onIrParaConfig}>
              {!configurado ? 'Configurar' : 'Revisar'}
            </Button>
          </Tooltip>
        )}
      </div>
    );
  };

  const statusInfo = (api: ApiEndpoint) => {
    const live = apiStatusOf(api.id);
    const code = live ? live.status : Number(api.ultimoStatus || 0);
    const conectado = live ? live.conectado : (code > 0 && code < 500);
    if (!code) return { color: t.textTertiary, conectado: false, label: 'Sem resposta' };
    return { color: conectado ? t.accents.sage : t.accents.rose, conectado, label: `HTTP ${code}` };
  };

  const grupos: { key: string; nome: string; itens: ApiEndpoint[] }[] = [];
  const byApp: Record<string, ApiEndpoint[]> = {};
  apis.forEach(a => { const k = a.sistemaId || SEM_APP; (byApp[k] = byApp[k] || []).push(a); });
  Object.keys(byApp).forEach(k => {
    const nome = k === SEM_APP ? 'Sem aplicação vinculada' : (sistemas.find(s => s.id === k)?.nome || 'Aplicação removida');
    grupos.push({ key: k, nome, itens: byApp[k] });
  });
  grupos.sort((a, b) => (a.key === SEM_APP ? 1 : b.key === SEM_APP ? -1 : a.nome.localeCompare(b.nome)));

  const resumo = status?.resumo;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 }}>
        <Button icon={<RefreshCw size={15} />} loading={validating} onClick={validar}>Revalidar tudo</Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => handleOpen()}>Cadastrar API</Button>
      </div>

      <Panel
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Activity size={18} strokeWidth={1.6} color={t.accents.sage} /> Central de Status</span>}
        extra={resumo ? <Tag bordered={false} style={{ background: resumo.online === resumo.total ? `${t.accents.sage}22` : `${t.accents.clay}22`, color: resumo.online === resumo.total ? t.accents.sage : t.accents.clay, fontWeight: 600 }}>{resumo.online}/{resumo.total} online</Tag> : (validating ? <Spin size="small" /> : null)}
        padding={8}
      >
        {!status && validating && <Spin style={{ display: 'block', margin: '24px auto' }} />}
        {!status && !validating && <div style={{ padding: 20, color: t.textTertiary, fontSize: 13 }}>A validação automática roda no app publicado. Clique em “Revalidar tudo”.</div>}
        {status && (
          <div>
            {statusRow(<Sparkles size={16} strokeWidth={1.7} />, 'IA — Proxy principal', status.llm.detalhe, status.llm.conectado, status.llm.configurado, status.llm.latenciaMs)}
            {statusRow(<GitBranch size={16} strokeWidth={1.7} />, 'GitHub', status.github.detalhe, status.github.conectado, status.github.configurado, status.github.latenciaMs)}
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 18 }}>
        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Server size={18} strokeWidth={1.6} color={t.accents.peach} /> Endpoints por aplicação</span>} padding={8}>
          {loading ? (
            <Spin style={{ display: 'block', margin: '40px auto' }} />
          ) : apis.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma API cadastrada" style={{ padding: 32 }} />
          ) : (
            grupos.map(grupo => (
              <div key={grupo.key} style={{ marginBottom: 8 }}>
                <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: 15, color: t.text, fontWeight: 600 }}>{grupo.nome}</span>
                  <span style={{ color: t.textTertiary, fontSize: 12 }}>· {grupo.itens.length} endpoint{grupo.itens.length > 1 ? 's' : ''}</span>
                </div>
                {grupo.itens.map(api => {
                  const si = statusInfo(api);
                  return (
                    <div key={api.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderBottom: `1px solid ${t.borderSoft}` }}>
                      <StatusDot color={si.color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{api.nome}</span>
                          <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue, fontSize: 11, textTransform: 'capitalize' }}>{api.provider}</Tag>
                        </div>
                        <div style={{ color: t.textTertiary, fontSize: 12, fontFamily: FONTS.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{api.baseUrl || api.healthUrl || '—'}{api.modelo ? ` · ${api.modelo}` : ''}</div>
                      </div>
                      <div style={{ minWidth: 130, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        {conexaoTag(si.conectado)}
                        <span style={{ color: t.textTertiary, fontSize: 11, fontFamily: FONTS.mono }}>{si.label}{api.latenciaMs ? ` · ${api.latenciaMs}ms` : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Button type="text" size="small" icon={<Zap size={15} />} loading={testing === api.id} onClick={() => handleTest(api.id)} title="Testar" />
                        {api.baseUrl && <Button type="text" size="small" icon={<ExternalLink size={15} />} href={api.baseUrl} target="_blank" />}
                        <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => handleOpen(api)} />
                        <Popconfirm title="Remover API?" onConfirm={() => handleDelete(api.id)} okText="Remover" cancelText="Cancelar">
                          <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16, color: t.textTertiary, fontSize: 12.5, paddingLeft: 4 }}>
        Conectado = o endpoint respondeu (mesmo 401/404). Desconectado = sem resposta ou erro de servidor (5xx).
      </div>

      <Modal title={editingId ? 'Editar API' : 'Cadastrar API'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose width={560}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="Ex: Claude Sonnet (proxy)" />
          </Form.Item>
          <Form.Item name="sistemaId" label="Aplicação" extra="Vincule este endpoint a um app que foi pro ar (opcional).">
            <Select allowClear placeholder="Sem aplicação vinculada" options={sistemas.map(s => ({ value: s.id, label: s.nome }))} />
          </Form.Item>
          <Form.Item name="provider" label="Provedor"><Select options={PROVIDER_OPTIONS} /></Form.Item>
          <Form.Item name="baseUrl" label="Base URL">
            <Input placeholder="https://..." style={{ fontFamily: FONTS.mono }} />
          </Form.Item>
          <Form.Item name="healthUrl" label="URL de health check (opcional)" extra="Usada para validar status/latência. Se vazia, usamos a Base URL.">
            <Input placeholder="https://.../health" style={{ fontFamily: FONTS.mono }} />
          </Form.Item>
          <Form.Item name="modelo" label="Modelo (opcional)">
            <Input placeholder="ex: claude-3-5-sonnet / gpt-4o" />
          </Form.Item>
          <Form.Item name="chaveRef" label="Referência da chave (opcional)" extra="Apenas onde a chave está guardada (ex: 'Vault/LLM'). Nunca cole o valor real aqui.">
            <Input placeholder="ex: Vault, .env PROD, 1Password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
