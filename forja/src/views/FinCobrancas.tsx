// FinCobrancas — "Cobranças" (A receber): emissão de boleto + PIX via PSP (Asaas)
// com baixa automática por webhook.
//
// O ciclo: o usuário emite uma cobrança (avulsa ou a partir de uma assinatura);
// o PSP devolve boleto (linha digitável/PDF) e/ou PIX (copia-e-cola + QR); quando
// o cliente paga, o webhook (doPost) dá baixa sozinho, registra o Recebimento e
// rola a próxima cobrança da assinatura. Segredos do PSP ficam no servidor
// (PropertiesService) — aqui só configuramos chave/ambiente e exibimos a URL de
// webhook pra colar no painel do provedor.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Modal, Form, Input, Select, Table, Tag, App as AntApp, Popconfirm,
  InputNumber, Empty, Tooltip, DatePicker, Segmented, Alert, Spin,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  Plus, Trash2, Copy, QrCode, FileText, RefreshCw, Settings, Barcode,
  CircleDollarSign, Clock, CheckCircle2, XCircle, Filter, Link2, Check,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type {
  EmpresaCobranca, CobrancaConfig, CobrancaMetodo, Sistema, Pessoa, Receita, ServerResponse,
} from '../types';

const METODOS = [
  { value: 'ambos', label: 'Boleto + PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
];

function metodoLabel(v?: string): string {
  return METODOS.find((m) => m.value === v)?.label || 'Boleto + PIX';
}

export default function FinCobrancas({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [cobrancas, setCobrancas] = useState<EmpresaCobranca[]>([]);
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [config, setConfig] = useState<CobrancaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<EmpresaCobranca | null>(null);
  const [marcarPaga, setMarcarPaga] = useState<EmpresaCobranca | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [busy, setBusy] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<EmpresaCobranca[]>>('cobrancasList', {}),
      callServer<ServerResponse<Pessoa[]>>('getPessoas'),
      callServer<ServerResponse<Receita[]>>('getReceitas'),
      callServer<ServerResponse<CobrancaConfig>>('cobrancaConfigGet'),
    ])
      .then(([coR, peR, reR, cfR]) => {
        if (coR.ok && coR.data) setCobrancas(coR.data as EmpresaCobranca[]);
        if (peR.ok && peR.data) setClientes(peR.data as Pessoa[]);
        if (reR.ok && reR.data) setReceitas(reR.data as Receita[]);
        if (cfR.ok && cfR.data) setConfig(cfR.data as CobrancaConfig);
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const cobrancasFiltradas = useMemo(() => {
    if (statusFiltro === 'todos') return cobrancas;
    return cobrancas.filter((c) => c.status === statusFiltro);
  }, [cobrancas, statusFiltro]);

  const totais = useMemo(() => {
    let aberto = 0, recebido = 0, qtdAberto = 0, qtdPaga = 0;
    for (const c of cobrancas) {
      if (c.status === 'paga') { recebido += Number(c.valorPago || c.valor || 0); qtdPaga++; }
      else if (c.status === 'emitida' || c.status === 'pendente' || c.status === 'vencida') { aberto += Number(c.valor || 0); qtdAberto++; }
    }
    return { aberto, recebido, qtdAberto, qtdPaga };
  }, [cobrancas]);

  const copiar = (txt: string, rotulo: string) => {
    if (!txt) { message.warning('Nada pra copiar ainda.'); return; }
    navigator.clipboard?.writeText(txt)
      .then(() => message.success(`${rotulo} copiado`))
      .catch(() => message.error('Não consegui copiar'));
  };

  const cancelar = (id: string) => {
    setBusy(id);
    callServer<ServerResponse<unknown>>('cobrancaCancelar', id)
      .then((res) => { if (res.ok) { message.success('Cobrança cancelada'); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao cancelar'))
      .finally(() => setBusy(''));
  };

  const reSync = (id: string) => {
    setBusy(id);
    callServer<ServerResponse<EmpresaCobranca>>('cobrancaReenviar', id)
      .then((res) => { if (res.ok) { message.success('Dados atualizados'); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao sincronizar'))
      .finally(() => setBusy(''));
  };

  const naoConfigurado = !!config && !config.configurado;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.sage}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Cobranças em aberto
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {formatBRL(totais.aberto)}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
            {totais.qtdAberto} em aberto · {formatBRL(totais.recebido)} recebido ({totais.qtdPaga})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button icon={<Settings size={16} />} onClick={() => setConfigOpen(true)}>Configurar PSP</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setEmitirOpen(true)} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
            Emitir cobrança
          </Button>
        </div>
      </div>

      {naoConfigurado && (
        <Alert
          type="warning" showIcon
          message="PSP não configurado"
          description="Pra emitir boleto/PIX com baixa automática, configure a chave do provedor (Asaas) e cadastre a URL de webhook no painel dele."
          action={<Button size="small" onClick={() => setConfigOpen(true)}>Configurar agora</Button>}
        />
      )}

      <Panel title="Cobranças" padding={8}>
        <div style={{ padding: '8px 12px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${t.borderSoft}`, marginBottom: 4 }}>
          <Filter size={14} style={{ color: t.textTertiary }} />
          <Segmented
            size="small"
            value={statusFiltro}
            onChange={(v) => setStatusFiltro(String(v))}
            options={[
              { value: 'todos', label: 'Todas' },
              { value: 'emitida', label: 'Em aberto' },
              { value: 'paga', label: 'Pagas' },
              { value: 'vencida', label: 'Vencidas' },
              { value: 'cancelada', label: 'Canceladas' },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={cobrancasFiltradas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhuma cobrança emitida' }}
          columns={[
            { title: 'Cliente', dataIndex: 'pessoaNome', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v || '—'}</span> },
            { title: 'Descrição', dataIndex: 'descricao', render: (v: string) => <span style={{ color: t.textSecondary }}>{v || '—'}</span> },
            { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ color: t.accents.sage, fontFamily: FONTS.mono }}>{formatBRL(Number(v || 0))}</span> },
            { title: 'Método', dataIndex: 'metodo', render: (v: string) => <span style={{ color: t.textSecondary, fontSize: 12.5 }}>{metodoLabel(v)}</span> },
            { title: 'Vencimento', dataIndex: 'vencimento', render: (v: string) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{v || '—'}</span> },
            { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
            {
              title: '', key: 'acoes', align: 'right', width: 190, render: (_: unknown, c: EmpresaCobranca) => (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  <Tooltip title="Ver boleto / PIX">
                    <Button type="text" size="small" icon={<QrCode size={15} />} style={{ color: t.accents.blue }} onClick={() => setDetalhe(c)} />
                  </Tooltip>
                  {c.linhaDigitavel && (
                    <Tooltip title="Copiar linha digitável">
                      <Button type="text" size="small" icon={<Barcode size={15} />} onClick={() => copiar(c.linhaDigitavel || '', 'Linha digitável')} />
                    </Tooltip>
                  )}
                  {c.pixCopiaCola && (
                    <Tooltip title="Copiar PIX copia-e-cola">
                      <Button type="text" size="small" icon={<Copy size={15} />} style={{ color: t.accents.sage }} onClick={() => copiar(c.pixCopiaCola || '', 'PIX')} />
                    </Tooltip>
                  )}
                  {c.urlBoleto && (
                    <Tooltip title="Abrir boleto (PDF)">
                      <Button type="text" size="small" icon={<FileText size={15} />} onClick={() => window.open(c.urlBoleto, '_blank')} />
                    </Tooltip>
                  )}
                  {c.status !== 'paga' && c.status !== 'cancelada' && (
                    <>
                      <Tooltip title="Marcar como paga (baixa manual)">
                        <Button type="text" size="small" icon={<Check size={16} />} style={{ color: t.accents.sage }} onClick={() => setMarcarPaga(c)} />
                      </Tooltip>
                      <Tooltip title="Re-sincronizar dados">
                        <Button type="text" size="small" icon={<RefreshCw size={14} />} loading={busy === c.id} style={{ color: t.textTertiary }} onClick={() => reSync(c.id)} />
                      </Tooltip>
                      <Popconfirm title="Cancelar cobrança?" onConfirm={() => cancelar(c.id)} okText="Cancelar cobrança" cancelText="Voltar" okButtonProps={{ danger: true }}>
                        <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                      </Popconfirm>
                    </>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <ModalEmitir
        open={emitirOpen}
        clientes={clientes}
        receitas={receitas}
        sistemas={sistemas}
        onClose={() => setEmitirOpen(false)}
        onEmitida={(c) => { setEmitirOpen(false); load(); setDetalhe(c); }}
      />

      <ModalConfig
        open={configOpen}
        config={config}
        onClose={() => setConfigOpen(false)}
        onSaved={(cfg) => { setConfig(cfg); load(); }}
      />

      <ModalDetalhe cobranca={detalhe} onClose={() => setDetalhe(null)} onCopiar={copiar} />

      <ModalMarcarPaga cobranca={marcarPaga} onClose={() => setMarcarPaga(null)} onSaved={() => { setMarcarPaga(null); load(); }} />
    </div>
  );
}

// ─── Modal: marcar como paga (baixa manual) ──────────────────────────────────

function ModalMarcarPaga({ cobranca, onClose, onSaved }: {
  cobranca: EmpresaCobranca | null; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cobranca) form.setFieldsValue({ valor: Number(cobranca.valor || 0), data: dayjs() });
  }, [cobranca, form]);

  const salvar = async (v: Record<string, unknown>) => {
    if (!cobranca) return;
    setSaving(true);
    try {
      const data = (v.data as Dayjs | null)?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD');
      const res = await callServer<ServerResponse<unknown>>('cobrancaMarcarPaga', cobranca.id, { valor: v.valor, data });
      if (res.ok) { message.success('Baixa registrada · entrou no caixa'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao dar baixa'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Marcar como paga" open={!!cobranca} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose okText="Confirmar baixa">
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 14 }}>{cobranca?.pessoaNome} · {cobranca?.descricao}</div>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor pago (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} decimalSeparator="," />
          </Form.Item>
          <Form.Item name="data" label="Data do pagamento" rules={[{ required: true, message: 'Informe a data' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <div style={{ fontSize: 11.5, color: t.textTertiary }}>
          A baixa gera um recebimento (entra no "Recebido no mês"). Se a cobrança estiver vinculada a uma assinatura, a próxima cobrança é rolada.
        </div>
      </Form>
    </Modal>
  );
}

// ─── Badge de status ───────────────────────────────────────────────────────────

function StatusTag({ status }: { status: string }): React.ReactElement {
  const t = useTokens();
  const map: Record<string, { cor: string; label: string; icon: React.ReactNode }> = {
    emitida: { cor: t.accents.blue, label: 'Em aberto', icon: <Clock size={11} /> },
    pendente: { cor: t.accents.peach, label: 'Pendente', icon: <Clock size={11} /> },
    paga: { cor: t.accents.sage, label: 'Paga', icon: <CheckCircle2 size={11} /> },
    vencida: { cor: t.accents.rose, label: 'Vencida', icon: <XCircle size={11} /> },
    cancelada: { cor: t.textTertiary, label: 'Cancelada', icon: <XCircle size={11} /> },
  };
  const m = map[status] || map.emitida;
  return (
    <Tag bordered={false} style={{ background: `${m.cor}22`, color: m.cor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {m.icon} {m.label}
    </Tag>
  );
}

// ─── Modal: emitir cobrança ─────────────────────────────────────────────────────

function ModalEmitir({ open, clientes, receitas, sistemas, onClose, onEmitida }: {
  open: boolean; clientes: Pessoa[]; receitas: Receita[]; sistemas: Sistema[];
  onClose: () => void; onEmitida: (c: EmpresaCobranca) => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [pessoaId, setPessoaId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ metodo: 'ambos', vencimento: dayjs().add(3, 'day') });
    setPessoaId(undefined);
  }, [open, form]);

  const pessoa = clientes.find((c) => c.id === pessoaId);
  const semDoc = !!pessoa && !pessoa.cnpj && !pessoa.cpf;

  // Assinaturas do cliente escolhido (pra pré-preencher valor/descrição).
  const receitasDoCliente = receitas.filter((r) => r.pessoaId === pessoaId);

  const aplicarReceita = (receitaId: string) => {
    const r = receitas.find((x) => x.id === receitaId);
    if (!r) return;
    const app = sistemas.find((s) => s.id === r.sistemaId)?.nome || '';
    form.setFieldsValue({
      receitaId,
      sistemaId: r.sistemaId,
      valor: Number(r.valor || 0),
      descricao: `${r.plano || 'Assinatura'}${app ? ` · ${app}` : ''}`,
      vencimento: r.proximaCobranca ? dayjs(r.proximaCobranca) : dayjs().add(3, 'day'),
    });
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const vencimento = (v.vencimento as Dayjs | null)?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD');
      const res = await callServer<ServerResponse<EmpresaCobranca>>('cobrancaEmitir', {
        pessoaId: v.pessoaId,
        receitaId: v.receitaId || '',
        sistemaId: v.sistemaId || '',
        descricao: v.descricao,
        valor: v.valor,
        vencimento,
        metodo: v.metodo,
      });
      if (res.ok && res.data) { message.success('Cobrança emitida'); onEmitida(res.data as EmpresaCobranca); }
      else message.error(res.error || 'Erro ao emitir');
    } catch { message.error('Erro ao emitir cobrança'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Emitir cobrança" open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose okText="Emitir" width={520}>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="pessoaId" label="Cliente" rules={[{ required: true, message: 'Escolha o cliente' }]}>
          <Select
            showSearch optionFilterProp="label" placeholder="Quem vai pagar"
            onChange={(v) => setPessoaId(v)}
            options={clientes.map((p) => ({ value: p.id, label: p.empresa || p.nome }))}
          />
        </Form.Item>

        {semDoc && (
          <Alert type="warning" showIcon style={{ marginBottom: 14 }}
            message="Cliente sem CPF/CNPJ"
            description="Boleto registrado exige CPF/CNPJ e endereço do pagador. Edite o cliente em Pessoas antes de emitir." />
        )}

        {receitasDoCliente.length > 0 && (
          <Form.Item label="A partir de uma assinatura" tooltip="Pré-preenche valor, descrição e vencimento a partir de uma assinatura do cliente.">
            <Select
              allowClear placeholder="Opcional — usar dados de uma assinatura"
              options={receitasDoCliente.map((r) => ({ value: r.id, label: `${r.plano || 'Assinatura'} · ${formatBRL(Number(r.valor || 0))}` }))}
              onChange={(v) => v && aplicarReceita(v)}
            />
          </Form.Item>
        )}
        <Form.Item name="receitaId" hidden><Input /></Form.Item>
        <Form.Item name="sistemaId" hidden><Input /></Form.Item>

        <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Descreva a cobrança' }]}>
          <Input placeholder="Ex.: Assinatura Pro · Maio/2026" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0,00" decimalSeparator="," />
          </Form.Item>
          <Form.Item name="vencimento" label="Vencimento" rules={[{ required: true, message: 'Informe o vencimento' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <Form.Item name="metodo" label="Método de pagamento">
          <Select options={METODOS} />
        </Form.Item>
        <div style={{ fontSize: 11.5, color: t.textTertiary }}>
          Após emitir, o boleto (linha digitável) e/ou o PIX (copia-e-cola + QR) aparecem pra você enviar ao cliente. A baixa é automática quando o pagamento é confirmado.
        </div>
      </Form>
    </Modal>
  );
}

// ─── Modal: configurar PSP ───────────────────────────────────────────────────

function ModalConfig({ open, config, onClose, onSaved }: {
  open: boolean; config: CobrancaConfig | null; onClose: () => void; onSaved: (cfg: CobrancaConfig) => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [provider, setProvider] = useState<'asaas' | 'mercadopago'>('asaas');

  useEffect(() => {
    if (!open) return;
    const prov = config?.provider || 'asaas';
    setProvider(prov);
    form.setFieldsValue({ provider: prov, env: config?.env || 'sandbox', apiKey: '' });
    setWebhookUrl(config?.webhookUrl || '');
  }, [open, config, form]);

  const isMP = provider === 'mercadopago';
  // Cada provedor tem sua própria chave salva — sabemos se já há uma configurada.
  const provConfigurado = isMP ? !!config?.mpConfigurado : !!config?.asaasConfigurado;
  const chaveAtual = config?.provider === provider ? config?.chaveMascarada : '';

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<CobrancaConfig>>('cobrancaConfigSalvar', {
        provider, env: v.env, apiKey: v.apiKey,
      });
      if (res.ok && res.data) {
        const cfg = res.data as CobrancaConfig;
        message.success('Configuração salva');
        setWebhookUrl(cfg.webhookUrl || '');
        onSaved(cfg);
      } else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const copiarWebhook = () => {
    if (!webhookUrl) { message.warning('Salve a configuração pra gerar a URL de webhook.'); return; }
    navigator.clipboard?.writeText(webhookUrl).then(() => message.success('URL de webhook copiada'));
  };

  return (
    <Modal title="Configurar provedor de cobrança" open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose okText="Salvar" width={560}>
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 14 }}>
        Apenas provedores por <strong>token</strong> funcionam no Google Apps Script (sem mTLS). Nubank e C6 Bank exigem certificado e não dá pra integrar direto.
      </div>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item label="Provedor (PSP)">
          <Segmented
            block
            value={provider}
            onChange={(v) => { const p = v as 'asaas' | 'mercadopago'; setProvider(p); form.setFieldsValue({ provider: p, apiKey: '' }); }}
            options={[
              { value: 'asaas', label: `Asaas${config?.asaasConfigurado ? ' ✓' : ''}` },
              { value: 'mercadopago', label: `Mercado Pago${config?.mpConfigurado ? ' ✓' : ''}` },
            ]}
          />
        </Form.Item>
        <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: -8, marginBottom: 12 }}>
          {isMP
            ? 'Mercado Pago: PIX e boleto como pagamento direto; "Boleto + PIX" gera um link de checkout. Tarifa por % da transação.'
            : 'Asaas: boleto + PIX na mesma cobrança, tarifa flat baixa. Recomendado pra SaaS PME.'}
        </div>
        <Form.Item name="env" label="Ambiente" extra={isMP ? 'No Mercado Pago, o ambiente é definido pelo tipo do token (TEST- vs APP_USR-).' : undefined}>
          <Select options={[{ value: 'sandbox', label: 'Sandbox (testes)' }, { value: 'producao', label: 'Produção' }]} />
        </Form.Item>
        <Form.Item name="provider" hidden><Input /></Form.Item>
        <Form.Item
          name="apiKey"
          label={isMP ? 'Access Token (Bearer)' : 'Chave de API (access_token)'}
          extra={provConfigurado ? `Chave atual: ${chaveAtual || '••••'} — deixe em branco pra manter.` : (isMP ? 'Cole o Access Token das suas credenciais no painel do Mercado Pago.' : 'Cole a API key gerada no painel do Asaas.')}
        >
          <Input.Password placeholder={provConfigurado ? '•••• (manter atual)' : (isMP ? 'APP_USR-... ou TEST-...' : '$aact_...')} autoComplete="off" />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 8, padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 6 }}>
          <Link2 size={14} color={t.accents.blue} /> URL de webhook
        </div>
        <div style={{ fontSize: 11.5, color: t.textTertiary, marginBottom: 8 }}>
          {isMP
            ? 'Cadastre esta URL no painel do Mercado Pago (Suas integrações → Webhooks, evento "Pagamentos"). Já vem com o token de segurança embutido.'
            : 'Cadastre esta URL no painel do Asaas (Notificações → Webhooks). Já vem com o token de segurança embutido.'} A baixa automática depende dela.
        </div>
        {webhookUrl ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input readOnly value={webhookUrl} style={{ fontFamily: FONTS.mono, fontSize: 11.5 }} />
            <Button icon={<Copy size={14} />} onClick={copiarWebhook}>Copiar</Button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: t.textTertiary }}>Salve a configuração pra gerar a URL.</div>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal: detalhe (boleto + PIX) ──────────────────────────────────────────

function ModalDetalhe({ cobranca, onClose, onCopiar }: {
  cobranca: EmpresaCobranca | null; onClose: () => void; onCopiar: (txt: string, rotulo: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const c = cobranca;
  const temBoleto = !!(c && (c.linhaDigitavel || c.urlBoleto));
  const temPix = !!(c && (c.pixCopiaCola || c.pixQrCodeImg));
  // Checkout hospedado (ex.: Mercado Pago "ambos") — só um link, pagador escolhe lá.
  const soCheckout = !!(c && c.urlFatura && !temBoleto && !temPix);

  return (
    <Modal title="Cobrança" open={!!c} onCancel={onClose} footer={<Button onClick={onClose}>Fechar</Button>} destroyOnClose width={480}>
      {c && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{c.pessoaNome || '—'}</div>
            <div style={{ fontSize: 12.5, color: t.textSecondary }}>{c.descricao}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 18, color: t.accents.sage }}>{formatBRL(Number(c.valor || 0))}</span>
              <StatusTag status={c.status} />
              <span style={{ fontSize: 12, color: t.textTertiary }}>vence {c.vencimento}</span>
            </div>
          </div>

          {soCheckout && (
            <div style={{ padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                <QrCode size={15} color={t.accents.blue} /> Página de pagamento
              </div>
              <div style={{ fontSize: 11.5, color: t.textTertiary, marginBottom: 8 }}>
                O cliente escolhe pagar por PIX ou boleto na página segura do provedor.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" icon={<FileText size={14} />} onClick={() => window.open(c.urlFatura, '_blank')}>Abrir página</Button>
                <Button icon={<Copy size={14} />} onClick={() => onCopiar(c.urlFatura || '', 'Link de pagamento')}>Copiar link</Button>
              </div>
            </div>
          )}

          {!temBoleto && !temPix && !soCheckout && (
            <div style={{ padding: 16, textAlign: 'center', color: t.textTertiary }}>
              <Spin size="small" /> <span style={{ marginLeft: 8 }}>Boleto/PIX ainda sendo gerado — use "Re-sincronizar" em instantes.</span>
            </div>
          )}

          {temBoleto && (
            <div style={{ padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                <Barcode size={15} color={t.accents.blue} /> Boleto
              </div>
              {c.linhaDigitavel && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Input readOnly value={c.linhaDigitavel} style={{ fontFamily: FONTS.mono, fontSize: 11.5 }} />
                  <Button icon={<Copy size={14} />} onClick={() => onCopiar(c.linhaDigitavel || '', 'Linha digitável')}>Copiar</Button>
                </div>
              )}
              {c.urlBoleto && (
                <Button size="small" icon={<FileText size={14} />} onClick={() => window.open(c.urlBoleto, '_blank')}>Abrir boleto (PDF)</Button>
              )}
            </div>
          )}

          {temPix && (
            <div style={{ padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                <QrCode size={15} color={t.accents.sage} /> PIX
              </div>
              {c.pixQrCodeImg && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <img
                    src={c.pixQrCodeImg.indexOf('data:') === 0 ? c.pixQrCodeImg : `data:image/png;base64,${c.pixQrCodeImg}`}
                    alt="QR Code PIX"
                    style={{ width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 6 }}
                  />
                </div>
              )}
              {c.pixCopiaCola && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input readOnly value={c.pixCopiaCola} style={{ fontFamily: FONTS.mono, fontSize: 11 }} />
                  <Button icon={<Copy size={14} />} onClick={() => onCopiar(c.pixCopiaCola || '', 'PIX copia-e-cola')}>Copiar</Button>
                </div>
              )}
            </div>
          )}

          {c.status === 'paga' && (
            <Alert type="success" showIcon icon={<CircleDollarSign size={16} />}
              message={`Paga em ${c.pagaEm || '—'} · ${formatBRL(Number(c.valorPago || c.valor || 0))}`} />
          )}
        </div>
      )}
    </Modal>
  );
}
