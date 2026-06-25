// FinCofre — cofre de SEGREDOS por empresa. Senha do certificado digital,
// gov.br/e-CAC, tokens, senhas de banco. O valor secreto vive só no Script
// Properties do app (não na planilha, não no Drive, nunca em log). Aqui só
// mostramos metadados + valor mascarado, com revelar/copiar sob demanda.
// Escopado pela empresa selecionada no topo.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Select, DatePicker, Input, Modal, Form, Popconfirm, Empty, Tooltip, Alert, App as AntApp } from 'antd';
import { Plus, Trash2, KeyRound, Eye, EyeOff, Copy, AlertTriangle, Pencil, Building2, Layers, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface Segredo {
  id: string; empresaId: string; nome: string; categoria: string;
  validade: string; notas: string; ultimos: string; criadoEm: string; empresaNome?: string;
}

// Copia texto pra área de transferência. Dentro do iframe do Apps Script o
// navigator.clipboard às vezes é bloqueado — daí o fallback com textarea.
function copiar(texto: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(texto).then(() => true).catch(() => fallbackCopy(texto));
  }
  return Promise.resolve(fallbackCopy(texto));
}
function fallbackCopy(texto: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export default function FinCofre(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [segredos, setSegredos] = useState<Segredo[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCor, setEmpresaCor] = useState('#8b5cf6');
  const [consolidado, setConsolidado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  // valores revelados em memória (id -> valor), some ao fechar/atualizar
  const [revelados, setRevelados] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setRevelados({});
    callServer<ServerResponse<{ segredos: Segredo[]; categorias: string[]; consolidado: boolean; empresaAtivaNome: string; empresaAtivaCor: string }>>('getSegredos')
      .then((res) => {
        if (res.ok && res.data) {
          const d = res.data as { segredos: Segredo[]; categorias: string[]; consolidado: boolean; empresaAtivaNome: string; empresaAtivaCor: string };
          setSegredos(d.segredos || []);
          setCategorias(d.categorias || []);
          setConsolidado(!!d.consolidado);
          setEmpresaNome(d.empresaAtivaNome || '');
          setEmpresaCor(d.empresaAtivaCor || '#8b5cf6');
        }
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const abrirNovo = () => { setEditId(null); form.resetFields(); form.setFieldsValue({ categoria: 'Senha do certificado digital' }); setOpen(true); };
  const abrirEdit = (s: Segredo) => {
    setEditId(s.id);
    form.resetFields();
    form.setFieldsValue({ nome: s.nome, categoria: s.categoria, validade: s.validade ? dayjs(s.validade) : null, notas: s.notas, valor: '' });
    setOpen(true);
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const validade = (v['validade'] as dayjs.Dayjs | null)?.format('YYYY-MM-DD') || '';
      const payload = { id: editId || undefined, nome: v['nome'], categoria: v['categoria'], valor: v['valor'], validade, notas: v['notas'] };
      const res = await callServer<ServerResponse<unknown>>('salvarSegredo', payload);
      if (res.ok) { message.success(editId ? 'Segredo atualizado' : 'Segredo guardado'); setOpen(false); load(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const remover = (s: Segredo) => callServer<ServerResponse<unknown>>('excluirSegredo', s.id).then((r) => { if (r.ok) { message.success('Removido'); load(); } else message.error(r.error || 'Erro'); });

  const revelar = async (s: Segredo) => {
    if (revelados[s.id] !== undefined) { setRevelados((r) => { const c = { ...r }; delete c[s.id]; return c; }); return; }
    const res = await callServer<ServerResponse<{ valor: string }>>('revelarSegredo', s.id);
    if (res.ok && res.data) setRevelados((r) => ({ ...r, [s.id]: (res.data as { valor: string }).valor }));
    else message.error(res.error || 'Erro ao revelar');
  };

  const copiarSegredo = async (s: Segredo) => {
    let valor = revelados[s.id];
    if (valor === undefined) {
      const res = await callServer<ServerResponse<{ valor: string }>>('revelarSegredo', s.id);
      if (!res.ok || !res.data) { message.error(res.error || 'Erro ao copiar'); return; }
      valor = (res.data as { valor: string }).valor;
    }
    const ok = await copiar(valor);
    message[ok ? 'success' : 'error'](ok ? 'Copiado pra área de transferência' : 'Não consegui copiar');
  };

  const hoje = dayjs();
  const venceProx = (validade: string) => validade && dayjs(validade).isBefore(hoje.add(30, 'day'));

  const colEmpresa = {
    title: 'Empresa', dataIndex: 'empresaNome', width: 160, ellipsis: true,
    render: (v: string) => <span style={{ color: t.textSecondary, fontSize: 12.5 }}>{v || '—'}</span>,
  };
  const cols = [
    {
      title: 'Segredo', dataIndex: 'nome', ellipsis: true,
      render: (v: string, s: Segredo) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <KeyRound size={14} style={{ color: t.textTertiary, flexShrink: 0 }} />
          <span style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        </div>
      ),
    },
    { title: 'Categoria', dataIndex: 'categoria', width: 200, ellipsis: true, render: (v: string) => <Tag>{v}</Tag> },
    ...(consolidado ? [colEmpresa] : []),
    {
      title: 'Valor', key: 'valor', width: 220,
      render: (_: unknown, s: Segredo) => {
        const aberto = revelados[s.id] !== undefined;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12.5, color: aberto ? t.text : t.textTertiary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {aberto ? (revelados[s.id] || '(vazio)') : `••••••${s.ultimos || ''}`}
            </span>
            <Tooltip title={aberto ? 'Ocultar' : 'Mostrar'}><Button type="text" size="small" icon={aberto ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => revelar(s)} /></Tooltip>
            <Tooltip title="Copiar"><Button type="text" size="small" icon={<Copy size={14} />} onClick={() => copiarSegredo(s)} /></Tooltip>
          </div>
        );
      },
    },
    {
      title: 'Validade', dataIndex: 'validade', width: 124,
      render: (v: string) => v
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: venceProx(v) ? t.accents.rose : t.textSecondary }}>{venceProx(v) && <AlertTriangle size={13} />}{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span style={{ color: t.textTertiary }}>—</span>,
    },
    {
      title: 'Ações', key: 'acoes', align: 'right' as const, width: 100,
      render: (_: unknown, s: Segredo) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Tooltip title="Editar"><Button size="small" icon={<Pencil size={14} />} onClick={() => abrirEdit(s)} /></Tooltip>
          <Popconfirm title="Excluir segredo?" description="O valor é apagado em definitivo." okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => remover(s)}>
            <Button size="small" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        type="success" showIcon icon={<ShieldCheck size={16} />}
        message="Cofre seguro"
        description="Os valores ficam guardados na área protegida do app (Script Properties) — não na planilha, não no Drive, e nunca em log. Guarde aqui a senha do certificado digital, gov.br/e-CAC e tokens. O arquivo .pfx do certificado você sobe direto no Asaas — não precisa ficar no app."
      />

      {/* Barra de contexto: deixa explícito de QUAL empresa são os segredos. */}
      {consolidado ? (
        <Alert
          type="warning" showIcon icon={<Layers size={16} />}
          message="Você está no Consolidado (todas as empresas)"
          description="A lista mostra os segredos de todas as empresas. Para guardar um novo, selecione uma empresa específica no seletor do topo."
        />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 12, padding: '10px 14px',
        }}>
          <Building2 size={16} style={{ color: t.textTertiary }} />
          <span style={{ color: t.textSecondary, fontSize: 13 }}>Cofre de</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, color: t.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: empresaCor, display: 'inline-block' }} />
            {empresaNome || 'empresa selecionada'}
          </span>
          <span style={{ color: t.textTertiary, fontSize: 12.5 }}>· troque a empresa no seletor do topo</span>
          <div style={{ flex: 1 }} />
          <Button type="primary" icon={<Plus size={15} />} onClick={abrirNovo}>Guardar segredo</Button>
        </div>
      )}

      <Panel title={`Segredos (${segredos.length})`} padding={8}>
        <Table
          rowKey="id"
          dataSource={segredos}
          loading={loading}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum segredo guardado — comece pela senha do certificado digital." /> }}
          columns={cols}
        />
      </Panel>

      <Modal
        title={editId ? 'Editar segredo' : 'Guardar segredo'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editId ? 'Salvar' : 'Guardar'}
        confirmLoading={saving}
        destroyOnClose
      >
        {!consolidado && !editId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 12px',
          }}>
            <Building2 size={15} style={{ color: t.textTertiary }} />
            <span style={{ color: t.textSecondary, fontSize: 12.5 }}>Será guardado no cofre de</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: t.text }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: empresaCor, display: 'inline-block' }} />
              {empresaNome || 'empresa selecionada'}
            </span>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false} style={{ marginTop: 4 }}>
          <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Dê um nome' }]}>
            <Input placeholder="Ex.: Senha do certificado A1 2026" autoFocus />
          </Form.Item>
          <Form.Item name="categoria" label="Categoria" rules={[{ required: true }]}>
            <Select options={(categorias.length ? categorias : ['Outros']).map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item
            name="valor"
            label={editId ? 'Novo valor (deixe vazio pra manter)' : 'Valor'}
            rules={editId ? [] : [{ required: true, message: 'Informe o valor' }]}
          >
            <Input.Password placeholder={editId ? '•••••• (inalterado)' : 'Cole aqui a senha/token'} autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="validade" label="Validade (opcional)" tooltip="Pro certificado A1 (vence em ~1 ano) — alerta quando perto de vencer.">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} placeholder="Ex.: onde foi emitido, titular…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
