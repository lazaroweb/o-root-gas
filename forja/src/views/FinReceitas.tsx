// FinReceitas — "A receber" como painel de RECEITA RECORRENTE (SaaS).
//
// Core do negócio: cada app é vendido como um plano de assinatura mensal (com
// espaço pra vendas avulsas/personalizadas). Esta aba mostra o negócio pela
// lente certa: MRR/ARR, assinantes, ARPU, novo MRR e churn do mês, MRR por app,
// próximas cobranças, e um catálogo de planos por app que acelera o cadastro.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Modal, Form, Input, Select, Table, Tag, App as AntApp, Popconfirm,
  InputNumber, Drawer, Empty, Tooltip, DatePicker, Dropdown,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  Plus, Pencil, Trash2, TrendingUp, Repeat, DollarSign, Layers as LayersIcon,
  CalendarClock, Package, UserPlus, Boxes, CircleDollarSign, AlertCircle, Check,
  FileText, Building2, Download,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf } from '../pdf-client';
import type { Receita, Sistema, Pessoa, ResumoReceitas, PlanoApp, ServerResponse } from '../types';

const RECORRENCIAS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'avulsa', label: 'Avulsa (venda única)' },
];
const STATUS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
];

function recLabel(v: string): string {
  return RECORRENCIAS.find((r) => r.value === v)?.label || v || 'mensal';
}
function ehAvulsa(v?: string): boolean {
  const r = String(v || '').toLowerCase();
  return r.indexOf('avuls') >= 0 || r.indexOf('unic') >= 0;
}

export default function FinReceitas({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [resumo, setResumo] = useState<ResumoReceitas | null>(null);
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  const [planos, setPlanos] = useState<PlanoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Receita | null>(null);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [receber, setReceber] = useState<{ id: string; valor: number; rotulo: string } | null>(null);
  const [emissorOpen, setEmissorOpen] = useState(false);
  const [gerando, setGerando] = useState<string>('');

  const nomeApp = (id?: string) => sistemas.find((s) => s.id === id)?.nome || '—';
  const nomeCliente = (id?: string) => clientes.find((p) => p.id === id)?.nome || '';

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Receita[]>>('getReceitas'),
      callServer<ServerResponse<ResumoReceitas>>('getResumoReceitas'),
      callServer<ServerResponse<Pessoa[]>>('getPessoas'),
      callServer<ServerResponse<PlanoApp[]>>('getPlanosApp'),
    ])
      .then(([rcR, resR, peR, plR]) => {
        if (rcR.ok && rcR.data) setReceitas(rcR.data as Receita[]);
        if (resR.ok && resR.data) setResumo(resR.data as ResumoReceitas);
        if (peR.ok && peR.data) setClientes(peR.data as Pessoa[]);
        if (plR.ok && plR.data) setPlanos(plR.data as PlanoApp[]);
      })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const abrir = (r?: Receita) => { setEditing(r || null); setOpen(true); };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deleteReceita', id).then((res) => {
      if (res.ok) { message.success('Removida'); load(); } else message.error(res.error || 'Erro');
    });
  };

  const statusCor = (s: string) => s === 'ativa' ? t.accents.sage : s === 'pausada' ? t.accents.clay : t.textTertiary;
  const maxMrr = Math.max(1, ...(resumo?.porApp || []).map((a) => a.mrr));

  const abrirReceber = (r: Receita) => setReceber({ id: r.id, valor: Number(r.valor || 0), rotulo: `${nomeApp(r.sistemaId)}${nomeCliente(r.pessoaId) ? ` · ${nomeCliente(r.pessoaId)}` : ''}` });

  const gerarDoc = async (receitaId: string, tipo: 'recibo' | 'fatura', recebimentoId?: string) => {
    const chave = `${tipo}-${receitaId}`;
    setGerando(chave);
    try {
      await gerarEbaixarPdf('gerarDocumentoReceitaPdf', receitaId, tipo, recebimentoId || '');
      message.success(`${tipo === 'recibo' ? 'Recibo' : 'Fatura'} gerado(a)`);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setGerando(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero: MRR + métricas de assinatura */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.sage}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            MRR · Receita recorrente mensal
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {formatBRL(resumo?.mrr || 0)}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            <MiniStat label="ARR (12m)" valor={formatBRL(resumo?.arr || 0)} cor={t.accents.sage} />
            <DivV t={t} />
            <MiniStat label="Assinaturas" valor={String(resumo?.assinaturasAtivas ?? 0)} cor={t.text} />
            <DivV t={t} />
            <MiniStat label="Clientes" valor={String(resumo?.clientesAtivos ?? 0)} cor={t.text} />
            <DivV t={t} />
            <MiniStat label="ARPU" valor={formatBRL(resumo?.arpu || 0)} cor={t.accents.blue} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button icon={<Building2 size={16} />} onClick={() => setEmissorOpen(true)}>Emissor</Button>
          <Button icon={<Boxes size={16} />} onClick={() => setCatalogoOpen(true)}>Catálogo de planos</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => abrir()} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
            Nova assinatura
          </Button>
        </div>
      </div>

      {/* Faixa de variação do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <MetricCard icon={<CircleDollarSign size={18} />} label="Recebido no mês" valor={formatBRL(resumo?.recebidoMes || 0)} cor={t.accents.sage} sub={resumo ? `${resumo.recebimentosMesQtd} recebimento(s)` : ''} />
        <MetricCard icon={<AlertCircle size={18} />} label="Em atraso" valor={formatBRL(resumo?.inadimplenciaValor || 0)} cor={t.accents.rose} sub={resumo ? `${resumo.inadimplenciaQtd} cobrança(s) vencida(s)` : ''} highlight={!!resumo && resumo.inadimplenciaValor > 0} />
        <MetricCard icon={<TrendingUp size={18} />} label="Novo MRR no mês" valor={formatBRL(resumo?.novoMrrMes || 0)} cor={t.accents.blue} sub={resumo ? `${resumo.novasAssinaturasMes} nova(s) assinatura(s)` : ''} />
        <MetricCard icon={<Repeat size={18} />} label="Churn do mês" valor={formatBRL(resumo?.churnMrr || 0)} cor={t.accents.clay} sub={resumo ? `${resumo.churnQtd} cancelada(s)` : ''} sinal={resumo && resumo.churnMrr > 0 ? '-' : ''} />
        <MetricCard icon={<DollarSign size={18} />} label="Avulsas no mês" valor={formatBRL(resumo?.avulsasMesValor || 0)} cor={t.accents.lavender} sub={resumo ? `${resumo.avulsasMesQtd} venda(s) única(s)` : ''} />
        <MetricCard icon={<CalendarClock size={18} />} label="A receber (45 dias)" valor={formatBRL(resumo?.aReceber45 || 0)} cor={t.accents.peach} sub={resumo ? `${resumo.proximas.length} cobrança(s)` : ''} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 16 }}>
        {/* MRR por app */}
        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><LayersIcon size={16} /> MRR por app</span>}>
          {(resumo?.porApp || []).length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem assinaturas ativas" style={{ padding: 16 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(resumo?.porApp || []).map((a) => (
                <div key={a.sistemaId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: t.text, fontWeight: 500, fontSize: 13.5 }}>{a.nome}</span>
                    <span style={{ fontFamily: FONTS.mono, color: t.accents.sage, fontSize: 13.5 }}>{formatBRL(a.mrr)}<span style={{ color: t.textTertiary, fontSize: 11 }}>/mês</span></span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((a.mrr / maxMrr) * 100)}%`, background: t.accents.sage, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 3 }}>
                    {a.assinaturas} assinatura(s) · {a.clientes} cliente(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Próximas cobranças */}
        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarClock size={16} /> Próximas cobranças (45 dias)</span>}>
          {(resumo?.proximas || []).length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma cobrança próxima" style={{ padding: 16 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {(resumo?.proximas || []).map((p) => {
                const atrasada = p.dias < 0;
                const corDia = atrasada ? t.accents.rose : p.dias <= 7 ? t.accents.peach : t.textTertiary;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 11px', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: t.text, fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.app}{p.cliente ? ` · ${p.cliente}` : ''}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textTertiary }}>{p.plano || recLabel(p.recorrencia)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FONTS.mono, color: t.accents.sage, fontSize: 13 }}>{formatBRL(p.valor)}</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: corDia }}>
                        {atrasada ? `atrasada ${Math.abs(p.dias)}d` : p.dias === 0 ? 'hoje' : `em ${p.dias}d`}
                      </div>
                    </div>
                    <Tooltip title="Registrar recebimento">
                      <Button
                        type="text" size="small" icon={<Check size={16} />}
                        style={{ color: t.accents.sage }}
                        onClick={() => setReceber({ id: p.id, valor: p.valor, rotulo: `${p.app}${p.cliente ? ` · ${p.cliente}` : ''}` })}
                      />
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Tabela de assinaturas */}
      <Panel title="Assinaturas" padding={8}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={receitas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhuma assinatura cadastrada' }}
          columns={[
            { title: 'Aplicação', dataIndex: 'sistemaId', render: (id: string) => <span style={{ color: t.text, fontWeight: 500 }}>{nomeApp(id)}</span> },
            { title: 'Cliente', dataIndex: 'pessoaId', render: (id: string) => <span style={{ color: t.textSecondary }}>{nomeCliente(id) || '—'}</span> },
            { title: 'Plano', dataIndex: 'plano', render: (v: string, r: Receita) => (
              <span style={{ color: t.textSecondary }}>
                {v || '—'}{ehAvulsa(r.recorrencia) && <Tag bordered={false} style={{ marginLeft: 6, background: `${t.accents.lavender}22`, color: t.accents.lavender, fontSize: 10 }}>avulsa</Tag>}
              </span>
            ) },
            { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ color: t.accents.sage, fontFamily: FONTS.mono }}>{formatBRL(Number(v || 0))}</span> },
            { title: 'Recorrência', dataIndex: 'recorrencia', render: (v: string) => <span style={{ color: t.textSecondary }}>{recLabel(v)}</span> },
            { title: 'Próx. cobrança', dataIndex: 'proximaCobranca', render: (v: string) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{v || '—'}</span> },
            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag bordered={false} style={{ background: `${statusCor(s || 'ativa')}22`, color: statusCor(s || 'ativa'), textTransform: 'capitalize' }}>{s || 'ativa'}</Tag> },
            {
              title: '', key: 'acoes', align: 'right', width: 150, render: (_: unknown, r: Receita) => (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  {String(r.status || 'ativa') === 'ativa' && (
                    <Tooltip title="Registrar recebimento">
                      <Button type="text" size="small" icon={<CircleDollarSign size={15} />} style={{ color: t.accents.sage }} onClick={() => abrirReceber(r)} />
                    </Tooltip>
                  )}
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'fatura', icon: <FileText size={14} />, label: 'Gerar fatura (a cobrar)' },
                        { key: 'recibo', icon: <Download size={14} />, label: 'Gerar recibo (último pago)' },
                      ],
                      onClick: ({ key }) => gerarDoc(r.id, key as 'recibo' | 'fatura'),
                    }}
                  >
                    <Tooltip title="Recibo / Fatura em PDF">
                      <Button type="text" size="small" icon={<FileText size={15} />} loading={gerando.endsWith(`-${r.id}`)} style={{ color: t.accents.blue }} />
                    </Tooltip>
                  </Dropdown>
                  <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => abrir(r)} />
                  <Popconfirm title="Remover assinatura?" onConfirm={() => remover(r.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <ModalAssinatura
        open={open}
        receita={editing}
        sistemas={sistemas}
        clientes={clientes}
        planos={planos}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); load(); }}
        onClientesMudou={load}
      />

      <DrawerCatalogo
        open={catalogoOpen}
        sistemas={sistemas}
        planos={planos}
        onClose={() => setCatalogoOpen(false)}
        onMudou={load}
      />

      <ModalRecebimento
        dados={receber}
        onClose={() => setReceber(null)}
        onSaved={(receitaId, recebimentoId) => {
          setReceber(null);
          load();
          if (receitaId && recebimentoId) {
            Modal.confirm({
              title: 'Recebimento registrado',
              content: 'Quer baixar o recibo em PDF deste recebimento?',
              okText: 'Baixar recibo',
              cancelText: 'Agora não',
              onOk: () => gerarDoc(receitaId, 'recibo', recebimentoId),
            });
          }
        }}
      />

      <ModalEmissor open={emissorOpen} onClose={() => setEmissorOpen(false)} />
    </div>
  );
}

// ─── Modal: registrar recebimento ─────────────────────────────────────────────

function ModalRecebimento({ dados, onClose, onSaved }: {
  dados: { id: string; valor: number; rotulo: string } | null;
  onClose: () => void; onSaved: (receitaId?: string, recebimentoId?: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dados) form.setFieldsValue({ valor: dados.valor, data: dayjs(), notas: '' });
  }, [dados, form]);

  const salvar = async (v: Record<string, unknown>) => {
    if (!dados) return;
    setSaving(true);
    try {
      const data = (v['data'] as Dayjs | null)?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD');
      const res = await callServer<ServerResponse<{ recebimento?: { id?: string } }>>('registrarRecebimento', dados.id, { valor: v['valor'], data, notas: v['notas'] });
      if (res.ok) {
        message.success('Recebimento registrado · próxima cobrança rolada');
        const rid = (res.data as { recebimento?: { id?: string } } | undefined)?.recebimento?.id;
        onSaved(dados.id, rid);
      } else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao registrar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Registrar recebimento" open={!!dados} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose okText="Registrar">
      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 14 }}>{dados?.rotulo}</div>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor recebido (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} decimalSeparator="," />
          </Form.Item>
          <Form.Item name="data" label="Data do recebimento" rules={[{ required: true, message: 'Informe a data' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <Form.Item name="notas" label="Notas (opcional)">
          <Input.TextArea rows={2} placeholder="Ex.: Pix, comprovante nº…" />
        </Form.Item>
        <div style={{ fontSize: 11.5, color: t.textTertiary }}>
          Ao registrar, a <strong>próxima cobrança</strong> desta assinatura é rolada automaticamente pro próximo ciclo.
        </div>
      </Form>
    </Modal>
  );
}

// ─── Modal: dados do emissor (cabeçalho dos recibos/faturas) ──────────────────

function ModalEmissor({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    callServer<ServerResponse<Record<string, unknown>>>('getEmpresaPerfil')
      .then((res) => { if (res.ok && res.data) form.setFieldsValue(res.data); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, [open, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<unknown>>('salvarEmpresaPerfil', v);
      if (res.ok) { message.success('Dados do emissor salvos'); onClose(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Dados do emissor" open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose okText="Salvar">
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 14 }}>
        Aparecem no cabeçalho dos recibos e faturas em PDF.
      </div>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false} disabled={loading}>
        <Form.Item name="nome" label="Nome / Razão social" rules={[{ required: true, message: 'Informe o nome' }]}>
          <Input placeholder="Ex.: Lázaro Dev · Soluções" autoFocus />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="documento" label="Documento (CNPJ/CPF)"><Input placeholder="00.000.000/0001-00" /></Form.Item>
          <Form.Item name="pix" label="Chave PIX"><Input placeholder="email/telefone/aleatória" /></Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="email" label="E-mail"><Input placeholder="contato@example.com" /></Form.Item>
          <Form.Item name="telefone" label="Telefone"><Input placeholder="(00) 90000-0000" /></Form.Item>
        </div>
        <Form.Item name="endereco" label="Endereço (opcional)"><Input placeholder="Cidade · UF" /></Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Mini componentes ─────────────────────────────────────────────────────────

function MiniStat({ label, valor, cor }: { label: string; valor: string; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
}

function DivV({ t }: { t: ReturnType<typeof useTokens> }): React.ReactElement {
  return <div style={{ width: 1, alignSelf: 'stretch', background: t.borderSoft }} />;
}

function MetricCard({ icon, label, valor, cor, sub, sinal, highlight }: {
  icon: React.ReactNode; label: string; valor: string; cor: string; sub?: string; sinal?: string; highlight?: boolean;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${highlight ? `${cor}66` : t.border}`, borderRadius: 14, padding: '14px 16px', boxShadow: t.shadowSoft, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {sinal}{valor}
      </div>
      {sub && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{sub}</div>}
    </div>
  );
}

// ─── Modal: nova/editar assinatura ────────────────────────────────────────────

function ModalAssinatura({ open, receita, sistemas, clientes, planos, onClose, onSaved, onClientesMudou }: {
  open: boolean; receita: Receita | null; sistemas: Sistema[]; clientes: Pessoa[]; planos: PlanoApp[];
  onClose: () => void; onSaved: () => void; onClientesMudou: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [sistemaId, setSistemaId] = useState<string | undefined>();
  const [novoCliente, setNovoCliente] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (receita) {
      form.setFieldsValue(receita);
      setSistemaId(receita.sistemaId);
    } else {
      form.setFieldsValue({ recorrencia: 'mensal', status: 'ativa' });
      setSistemaId(undefined);
    }
    setNovoCliente(false);
  }, [open, receita, form]);

  const planosDoApp = planos.filter((p) => p.sistemaId === sistemaId && String(p.ativo || 'sim') !== 'nao');

  const aplicarPlano = (planoId: string) => {
    const p = planos.find((x) => x.id === planoId);
    if (p) form.setFieldsValue({ plano: p.nome, valor: p.valor, recorrencia: p.recorrencia });
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (receita) await callServer('updateReceita', receita.id, v);
      else await callServer('createReceita', v);
      message.success(receita ? 'Assinatura atualizada' : 'Assinatura criada');
      onSaved();
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={receita ? 'Editar assinatura' : 'Nova assinatura'} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="sistemaId" label="Aplicação" rules={[{ required: true, message: 'Selecione o app' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Qual app" options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} onChange={(v) => { setSistemaId(v); }} />
        </Form.Item>

        {planosDoApp.length > 0 && (
          <Form.Item label="Plano do catálogo" tooltip="Escolha um plano cadastrado pra preencher nome, valor e recorrência automaticamente.">
            <Select
              allowClear placeholder="Aplicar um plano pronto"
              options={planosDoApp.map((p) => ({ value: p.id, label: `${p.nome} · ${formatBRL(p.valor)}/${recLabel(p.recorrencia).toLowerCase()}` }))}
              onChange={(v) => v && aplicarPlano(v)}
            />
          </Form.Item>
        )}

        {/* Cliente: seleção ou criação rápida */}
        {!novoCliente ? (
          <Form.Item label="Cliente">
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="pessoaId" noStyle>
                <Select allowClear showSearch optionFilterProp="label" placeholder="Quem assina" style={{ flex: 1 }} options={clientes.map((p) => ({ value: p.id, label: p.nome }))} />
              </Form.Item>
              <Tooltip title="Criar cliente">
                <Button icon={<UserPlus size={15} />} onClick={() => setNovoCliente(true)} />
              </Tooltip>
            </div>
          </Form.Item>
        ) : (
          <ClienteRapido onCriado={(id) => { setNovoCliente(false); onClientesMudou(); form.setFieldsValue({ pessoaId: id }); }} onCancelar={() => setNovoCliente(false)} />
        )}

        <Form.Item name="plano" label="Plano"><Input placeholder="Ex.: Pro, Básico, Enterprise" /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0,00" decimalSeparator="," />
          </Form.Item>
          <Form.Item name="recorrencia" label="Recorrência"><Select options={RECORRENCIAS} /></Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="inicio" label="Início"><Input type="date" /></Form.Item>
          <Form.Item name="proximaCobranca" label="Próxima cobrança"><Input type="date" /></Form.Item>
        </div>
        <Form.Item name="status" label="Status"><Select options={STATUS} /></Form.Item>
        <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: -6 }}>
          Recorrência <strong>Avulsa</strong> entra no faturamento do mês, mas fica fora do MRR.
        </div>
      </Form>
    </Modal>
  );
}

function ClienteRapido({ onCriado, onCancelar }: { onCriado: (id: string) => void; onCancelar: () => void }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!nome.trim()) { message.error('Informe o nome do cliente.'); return; }
    setSalvando(true);
    try {
      const res = await callServer<ServerResponse<{ id: string }>>('createPessoa', { nome: nome.trim(), contato: contato.trim(), papel: 'cliente', notas: '' });
      if (res.ok && res.data) { message.success('Cliente criado'); onCriado(String((res.data as { id: string }).id)); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao criar cliente'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 8, fontWeight: 500 }}>Novo cliente</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <Input placeholder="Contato (email, telefone)" value={contato} onChange={(e) => setContato(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onCancelar}>Cancelar</Button>
          <Button size="small" type="primary" loading={salvando} onClick={criar}>Criar e usar</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer: catálogo de planos por app ───────────────────────────────────────

function DrawerCatalogo({ open, sistemas, planos, onClose, onMudou }: {
  open: boolean; sistemas: Sistema[]; planos: PlanoApp[]; onClose: () => void; onMudou: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<PlanoApp | null>(null);

  const nomeApp = (id: string) => sistemas.find((s) => s.id === id)?.nome || 'Sem app';
  const porApp: Record<string, PlanoApp[]> = {};
  for (const p of planos) { (porApp[p.sistemaId] = porApp[p.sistemaId] || []).push(p); }

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarPlanoApp', id).then((res) => {
      if (res.ok) { message.success('Plano removido'); onMudou(); } else message.error(res.error || 'Erro');
    });
  };

  return (
    <Drawer
      title="Catálogo de planos por app"
      open={open}
      onClose={onClose}
      width={520}
      extra={<Button type="primary" icon={<Plus size={15} />} onClick={() => { setEditando(null); setModalOpen(true); }}>Novo plano</Button>}
    >
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 16 }}>
        Defina os planos de cada app. Ao criar uma assinatura, basta escolher o app e o plano — valor e recorrência entram sozinhos.
      </div>
      {planos.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum plano cadastrado">
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditando(null); setModalOpen(true); }}>Criar primeiro plano</Button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.keys(porApp).map((sid) => (
            <div key={sid}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: t.text, fontWeight: 600, fontSize: 13.5 }}>
                <Package size={15} color={t.accents.sage} /> {nomeApp(sid)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {porApp[sid].map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: t.text, fontWeight: 500, fontSize: 13 }}>{p.nome}{String(p.ativo || 'sim') === 'nao' && <Tag bordered={false} style={{ marginLeft: 6, fontSize: 10 }}>inativo</Tag>}</div>
                      {p.descricao && <div style={{ fontSize: 11.5, color: t.textTertiary }}>{p.descricao}</div>}
                    </div>
                    <div style={{ fontFamily: FONTS.mono, color: t.accents.sage, fontSize: 13 }}>{formatBRL(p.valor)}<span style={{ color: t.textTertiary, fontSize: 11 }}>/{recLabel(p.recorrencia).toLowerCase()}</span></div>
                    <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => { setEditando(p); setModalOpen(true); }} />
                    <Popconfirm title="Remover plano?" onConfirm={() => remover(p.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                      <Button type="text" size="small" icon={<Trash2 size={14} />} style={{ color: t.textTertiary }} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalPlano
        open={modalOpen}
        plano={editando}
        sistemas={sistemas}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); onMudou(); }}
      />
    </Drawer>
  );
}

function ModalPlano({ open, plano, sistemas, onClose, onSaved }: {
  open: boolean; plano: PlanoApp | null; sistemas: Sistema[]; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (plano) form.setFieldsValue(plano);
    else form.setFieldsValue({ recorrencia: 'mensal', ativo: 'sim' });
  }, [open, plano, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<unknown>>('salvarPlanoApp', { ...v, id: plano?.id });
      if (res.ok) { message.success(plano ? 'Plano atualizado' : 'Plano criado'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={plano ? 'Editar plano' : 'Novo plano'} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="sistemaId" label="Aplicação" rules={[{ required: true, message: 'Selecione o app' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Qual app" options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
        </Form.Item>
        <Form.Item name="nome" label="Nome do plano" rules={[{ required: true, message: 'Informe o nome' }]}>
          <Input placeholder="Ex.: Básico, Pro, Enterprise" autoFocus />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0,00" decimalSeparator="," />
          </Form.Item>
          <Form.Item name="recorrencia" label="Recorrência">
            <Select options={RECORRENCIAS.filter((r) => r.value !== 'avulsa')} />
          </Form.Item>
        </div>
        <Form.Item name="descricao" label="Descrição (opcional)">
          <Input placeholder="O que está incluso no plano" />
        </Form.Item>
        <Form.Item name="ativo" label="Status">
          <Select options={[{ value: 'sim', label: 'Ativo' }, { value: 'nao', label: 'Inativo' }]} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
