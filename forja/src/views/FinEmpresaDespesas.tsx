// FinEmpresaDespesas — livro-caixa MENSAL de despesas da empresa.
//
// Espelha a estrutura do Financeiro Pessoal (mês de referência no topo + KPIs do
// mês + tabela de lançamentos), mas pro lado do negócio: contas, boletos, notas e
// recibos avulsos. Inclui importação de PDF/imagem de conta/recibo via Gemini
// (multimodal), que extrai fornecedor + data + valor (e itens, quando houver).
// Os custos RECORRENTES continuam em "A pagar" — aqui é o mês a mês de despesas.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Select, DatePicker, Table, Tag,
  App as AntApp, Popconfirm, Tooltip, Checkbox, Segmented, Empty,
} from 'antd';
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Sparkles, Upload,
  Receipt, TrendingDown, CheckCircle2, Clock, FileText, CircleDashed, FileDown,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Panel, AreaChart, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf } from '../pdf-client';
import type {
  Sistema, DespesaEmpresa, ResumoDespesasEmpresa, ReciboInterpretado,
  StatusDespesa, ServerResponse,
} from '../types';

const CATEGORIAS = ['Hospedagem', 'API/LLM', 'Domínio', 'Banco de dados', 'Ferramenta', 'Marketing', 'Serviços', 'Impostos', 'Outro'];
const STATUS_OPCOES: Array<{ value: StatusDespesa; label: string }> = [
  { value: 'pago', label: 'Pago' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'agendado', label: 'Agendado' },
];

function corStatus(t: ReturnType<typeof useTokens>, s: string): string {
  if (s === 'pago') return t.accents.sage;
  if (s === 'agendado') return t.accents.blue;
  return t.accents.peach;
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelDoMes(comp: string): string {
  const [y, m] = comp.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

export default function FinEmpresaDespesas({ sistemas }: { sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [mes, setMes] = useState<string>(mesAtual());
  const [despesas, setDespesas] = useState<DespesaEmpresa[]>([]);
  const [resumo, setResumo] = useState<ResumoDespesasEmpresa | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<DespesaEmpresa | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const nomeApp = (id?: string) => sistemas.find((s) => s.id === id)?.nome || '';

  const recarregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<DespesaEmpresa[]>>('getDespesasEmpresa', mes),
      callServer<ServerResponse<ResumoDespesasEmpresa>>('getResumoDespesasEmpresa', mes),
    ])
      .then(([dR, rR]) => {
        if (dR.ok && dR.data) setDespesas(dR.data as DespesaEmpresa[]);
        if (rR.ok && rR.data) setResumo(rR.data as ResumoDespesasEmpresa);
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(recarregar, [recarregar]);

  const navegarMes = (delta: number) => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const abrirNova = () => { setEditando(null); setModalOpen(true); };
  const abrirEditar = (d: DespesaEmpresa) => { setEditando(d); setModalOpen(true); };

  const togglePago = (d: DespesaEmpresa) => {
    callServer<ServerResponse<unknown>>('marcarDespesaEmpresaPaga', d.id, d.status !== 'pago').then((res) => {
      if (res.ok) recarregar(); else message.error(res.error || 'Erro');
    });
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarDespesaEmpresa', id).then((res) => {
      if (res.ok) { message.success('Despesa removida'); recarregar(); } else message.error(res.error || 'Erro');
    });
  };

  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const baixarRelatorioPdf = async () => {
    setBaixandoPdf(true);
    try { await gerarEbaixarPdf('gerarRelatorioDespesasPdf', mes); message.success('PDF gerado'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setBaixandoPdf(false); }
  };

  const [gerandoComp, setGerandoComp] = useState('');
  const baixarComprovante = async (id: string) => {
    setGerandoComp(id);
    try { await gerarEbaixarPdf('gerarComprovanteDespesaPdf', id); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar comprovante'); }
    finally { setGerandoComp(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header: mês de referência + ações */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: '14px 18px', boxShadow: t.shadowSoft,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => navegarMes(-1)} />
          <div style={{ minWidth: 180, textAlign: 'center', fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>
            {labelDoMes(mes)}
          </div>
          <Button size="small" icon={<ChevronRight size={14} />} onClick={() => navegarMes(1)} />
          <Button size="small" type="text" onClick={() => setMes(mesAtual())} style={{ marginLeft: 4, fontSize: 12, color: t.textTertiary }}>
            hoje
          </Button>
        </div>
        <div style={{ flex: 1 }} />
        <Button icon={<FileDown size={16} />} onClick={baixarRelatorioPdf} loading={baixandoPdf} disabled={!resumo || resumo.qtd === 0}>Baixar PDF</Button>
        <Button icon={<Sparkles size={16} />} onClick={() => setImportOpen(true)}>Importar conta/recibo</Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={abrirNova} style={{ background: t.accents.clay, borderColor: t.accents.clay }}>
          Nova despesa
        </Button>
      </div>

      {/* KPIs do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard icon={<TrendingDown size={20} />} label="Total do mês" valor={resumo?.total || 0} cor={t.accents.clay} subtitle={resumo ? `${resumo.qtd} lançamento(s)` : ''} delta={resumo?.deltaPct ?? undefined} />
        <KpiCard icon={<CheckCircle2 size={20} />} label="Pago" valor={resumo?.pago || 0} cor={t.accents.sage} />
        <KpiCard icon={<Clock size={20} />} label="A pagar" valor={resumo?.pendente || 0} cor={t.accents.peach} highlight={!!resumo && resumo.pendente > 0} />
        <KpiCard icon={<Receipt size={20} />} label="Maior categoria" valorTexto={resumo && resumo.porCategoria[0] ? resumo.porCategoria[0].categoria : '—'} subtitle={resumo && resumo.porCategoria[0] ? formatBRL(resumo.porCategoria[0].total) : ''} cor={t.accents.lavender} />
      </div>

      {/* Tabela de despesas do mês */}
      <Panel title={`Despesas — ${labelDoMes(mes)}`} padding={8}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={despesas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhuma despesa neste mês. Lance uma ou importe uma conta/recibo.' }}
          columns={[
            { title: 'Data', dataIndex: 'data', width: 92, render: (v: string) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{v ? dayjs(v).format('DD/MM') : '—'}</span> },
            {
              title: 'Despesa', key: 'desc', render: (_: unknown, d: DespesaEmpresa) => (
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: t.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descricao || '—'}</div>
                  {d.fornecedor && <div style={{ color: t.textTertiary, fontSize: 12 }}>{d.fornecedor}</div>}
                </div>
              ),
            },
            { title: 'Categoria', dataIndex: 'categoria', width: 130, render: (v: string) => <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue }}>{v || 'Outro'}</Tag> },
            { title: 'Aplicação', dataIndex: 'sistemaId', width: 130, render: (id: string) => <span style={{ color: t.textSecondary, fontSize: 12.5 }}>{nomeApp(id) || '—'}</span> },
            { title: 'Valor', dataIndex: 'valor', align: 'right', width: 110, render: (v: number) => <span style={{ color: t.accents.clay, fontFamily: FONTS.mono }}>{formatBRL(Number(v || 0))}</span> },
            {
              title: 'Status', dataIndex: 'status', width: 110, render: (s: string, d: DespesaEmpresa) => (
                <Tooltip title={s === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}>
                  <Tag
                    onClick={() => togglePago(d)}
                    bordered={false}
                    style={{ cursor: 'pointer', background: `${corStatus(t, s)}1f`, color: corStatus(t, s), textTransform: 'capitalize' }}
                  >
                    {s === 'pago' ? <CheckCircle2 size={11} style={{ marginRight: 4, verticalAlign: -1 }} /> : <CircleDashed size={11} style={{ marginRight: 4, verticalAlign: -1 }} />}
                    {s || 'pendente'}
                  </Tag>
                </Tooltip>
              ),
            },
            {
              title: '', key: 'acoes', align: 'right', width: 116, render: (_: unknown, d: DespesaEmpresa) => (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  <Tooltip title="Comprovante em PDF">
                    <Button type="text" size="small" icon={<FileText size={15} />} loading={gerandoComp === d.id} style={{ color: t.accents.blue }} onClick={() => baixarComprovante(d.id)} />
                  </Tooltip>
                  <Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => abrirEditar(d)} />
                  <Popconfirm title="Remover despesa?" onConfirm={() => remover(d.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      {/* Análise: por categoria, por app e evolução */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 16 }}>
        <Panel title="Despesas por categoria">
          {!resumo || resumo.porCategoria.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem despesas neste mês" style={{ padding: 16 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {resumo.porCategoria.map((c) => {
                const max = Math.max(1, ...resumo.porCategoria.map((x) => x.total));
                const pct = resumo.total > 0 ? Math.round((c.total / resumo.total) * 100) : 0;
                return (
                  <div key={c.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ color: t.text, fontWeight: 500, fontSize: 13.5 }}>{c.categoria}</span>
                      <span style={{ fontFamily: FONTS.mono, color: t.accents.clay, fontSize: 13.5 }}>{formatBRL(c.total)} <span style={{ color: t.textTertiary, fontSize: 11 }}>{pct}%</span></span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((c.total / max) * 100)}%`, background: t.accents.clay, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Evolução (6 meses)">
          {!resumo || resumo.serie.length === 0 || resumo.serie.every((s) => s.total === 0) ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem histórico ainda" style={{ padding: 16 }} />
          ) : (
            <>
              <AreaChart data={resumo.serie.map((s) => s.total)} labels={resumo.serie.map((s) => s.label)} color={t.accents.clay} height={200} showAxis />
              {resumo.deltaPct !== null && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: t.textSecondary }}>
                  <span style={{ color: resumo.deltaPct > 0 ? t.accents.rose : t.accents.sage, fontWeight: 600, fontFamily: FONTS.mono }}>
                    {resumo.deltaPct > 0 ? '+' : ''}{resumo.deltaPct}%
                  </span> vs. mês anterior
                </div>
              )}
            </>
          )}
        </Panel>

        {!!resumo && resumo.porApp.length > 0 && resumo.porApp.some((a) => a.sistemaId) && (
          <Panel title="Despesa por app">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {resumo.porApp.map((a) => {
                const max = Math.max(1, ...resumo.porApp.map((x) => x.total));
                return (
                  <div key={a.sistemaId || 'sem'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ color: a.sistemaId ? t.text : t.textTertiary, fontWeight: 500, fontSize: 13.5 }}>{a.nome}</span>
                      <span style={{ fontFamily: FONTS.mono, color: t.accents.lavender, fontSize: 13.5 }}>{formatBRL(a.total)}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((a.total / max) * 100)}%`, background: t.accents.lavender, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>

      <ModalDespesa
        open={modalOpen}
        despesa={editando}
        mes={mes}
        sistemas={sistemas}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recarregar(); }}
      />

      <ModalImportarRecibo
        open={importOpen}
        sistemas={sistemas}
        onClose={() => setImportOpen(false)}
        onSaved={() => { setImportOpen(false); recarregar(); }}
      />
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, valor, valorTexto, cor, subtitle, delta, highlight }: {
  icon: React.ReactNode; label: string; valor?: number; valorTexto?: string;
  cor: string; subtitle?: string; delta?: number; highlight?: boolean;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      background: t.surface, border: `1px solid ${highlight ? `${cor}66` : t.border}`,
      borderRadius: 14, padding: '14px 16px', boxShadow: t.shadowSoft,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
        {typeof delta === 'number' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: FONTS.mono, color: delta > 0 ? t.accents.rose : t.accents.sage }}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: valorTexto ? 18 : 24, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valorTexto !== undefined ? valorTexto : formatBRL(valor || 0)}
      </div>
      {subtitle && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{subtitle}</div>}
    </div>
  );
}

// ─── Modal: nova/editar despesa ───────────────────────────────────────────────

function ModalDespesa({ open, despesa, mes, sistemas, onClose, onSaved }: {
  open: boolean; despesa: DespesaEmpresa | null; mes: string;
  sistemas: Sistema[]; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (despesa) {
      form.setFieldsValue({ ...despesa, data: despesa.data ? dayjs(despesa.data) : null });
    } else {
      // Default: dia de hoje se o mês selecionado for o atual; senão dia 1 do mês.
      const hoje = dayjs();
      const inicioMes = dayjs(`${mes}-01`);
      const dataDefault = hoje.format('YYYY-MM') === mes ? hoje : inicioMes;
      form.setFieldsValue({ status: 'pendente', categoria: 'Outro', data: dataDefault });
    }
  }, [open, despesa, mes, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const data = (v['data'] as Dayjs | null)?.format('YYYY-MM-DD') || '';
      const res = await callServer<ServerResponse<unknown>>('salvarDespesaEmpresa', { ...v, data, id: despesa?.id });
      if (res.ok) { message.success(despesa ? 'Despesa atualizada' : 'Despesa criada'); onSaved(); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={despesa ? 'Editar despesa' : 'Nova despesa'} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="descricao" label="Descrição" rules={[{ required: true, message: 'Informe a descrição' }]}>
          <Input placeholder="Ex.: Conta de energia, Nota fiscal nº 123" autoFocus />
        </Form.Item>
        <Form.Item name="fornecedor" label="Fornecedor">
          <Input placeholder="Ex.: Enel, Vercel, Contador" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0,00" decimalSeparator="," />
          </Form.Item>
          <Form.Item name="data" label="Data" rules={[{ required: true, message: 'Informe a data' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Form.Item name="categoria" label="Categoria">
            <Select options={CATEGORIAS.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={STATUS_OPCOES} />
          </Form.Item>
        </div>
        <Form.Item name="sistemaId" label="Aplicação (opcional)">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Vincular a um app" options={sistemas.map((s) => ({ value: s.id, label: s.nome }))} />
        </Form.Item>
        <Form.Item name="formaPagamento" label="Forma de pagamento (opcional)">
          <Input placeholder="Boleto, Pix, cartão…" />
        </Form.Item>
        <Form.Item name="notas" label="Notas (opcional)">
          <Input.TextArea rows={2} placeholder="Observações" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Modal: importar conta/recibo (PDF/imagem) via Gemini ─────────────────────

interface ItemRevisao {
  data: string; fornecedor: string; descricao: string; valor: number; categoria: string; incluir: boolean;
}

function ModalImportarRecibo({ open, sistemas, onClose, onSaved }: {
  open: boolean; sistemas: Sistema[]; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<'upload' | 'revisao'>('upload');
  const [processando, setProcessando] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [itens, setItens] = useState<ItemRevisao[]>([]);
  const [statusImport, setStatusImport] = useState<StatusDespesa>('pendente');
  const [sistemaId, setSistemaId] = useState<string | undefined>();
  const [importando, setImportando] = useState(false);
  const [geminiOn, setGeminiOn] = useState(false);

  useEffect(() => {
    if (open) {
      setEtapa('upload'); setProcessando(false); setStatusMsg(''); setNomeArquivo('');
      setItens([]); setStatusImport('pendente'); setSistemaId(undefined); setImportando(false);
      callServer<boolean>('geminiTemChave').then((v) => setGeminiOn(!!v)).catch(() => setGeminiOn(false));
    }
  }, [open]);

  const processarArquivo = async (file: File) => {
    if (!file) return;
    const ehPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    const ehImg = /^image\//i.test(file.type) || /\.(png|jpe?g|webp|heic)$/i.test(file.name);
    if (!ehPdf && !ehImg) { message.error('Envie um PDF ou uma imagem (foto) da conta/recibo.'); return; }
    if (!geminiOn) { message.error('Configure a chave do Gemini em Configurações pra ler contas por PDF/foto.'); return; }
    setNomeArquivo(file.name);
    setProcessando(true);
    setStatusMsg('Lendo a conta com o Gemini…');
    try {
      const base64 = await arquivoParaBase64(file);
      const mime = ehPdf ? 'application/pdf' : (file.type || 'image/jpeg');
      const res = await callServer<ServerResponse<ReciboInterpretado>>('interpretarReciboGemini', base64, mime);
      if (res.ok && res.data) {
        const d = res.data as ReciboInterpretado;
        setItens(d.itens.map((it) => ({ ...it, incluir: true })));
        setEtapa('revisao');
      } else {
        message.error(res.error || 'Não consegui ler a conta.');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Falha ao processar a conta.');
    } finally {
      setProcessando(false); setStatusMsg('');
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processarArquivo(f);
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void processarArquivo(f);
  };

  const setItem = (idx: number, patch: Partial<ItemRevisao>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const incluidos = itens.filter((it) => it.incluir);
  const totalIncluidos = incluidos.reduce((s, it) => s + Number(it.valor || 0), 0);

  const importar = async () => {
    if (incluidos.length === 0) { message.error('Marque ao menos uma despesa.'); return; }
    setImportando(true);
    try {
      const payload = incluidos.map((it) => ({
        data: it.data, fornecedor: it.fornecedor, descricao: it.descricao,
        valor: it.valor, categoria: it.categoria, sistemaId: sistemaId || '',
      }));
      const res = await callServer<ServerResponse<{ criados: number }>>('importarDespesasEmpresa', JSON.stringify(payload), statusImport, nomeArquivo);
      if (res.ok) {
        const n = (res.data as { criados: number } | undefined)?.criados ?? incluidos.length;
        message.success(`${n} despesa(s) importada(s)`);
        onSaved();
      } else {
        message.error(res.error || 'Erro ao importar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao importar');
    } finally {
      setImportando(false);
    }
  };

  return (
    <Modal
      title="Importar conta / recibo"
      open={open}
      onCancel={onClose}
      width={760}
      destroyOnClose
      footer={etapa === 'revisao' ? [
        <Button key="voltar" onClick={() => setEtapa('upload')}>Voltar</Button>,
        <Button key="import" type="primary" loading={importando} onClick={importar} style={{ background: t.accents.clay, borderColor: t.accents.clay }}>
          Importar {incluidos.length} despesa(s) · {formatBRL(totalIncluidos)}
        </Button>,
      ] : null}
    >
      {etapa === 'upload' && (
        <div>
          {!geminiOn && (
            <div style={{ marginBottom: 12, padding: '10px 12px', background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}44`, borderRadius: 8, fontSize: 12.5, color: t.textSecondary }}>
              Configure a chave do <strong>Gemini</strong> em Configurações pra ler contas direto do PDF ou da foto.
            </div>
          )}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: `1.5px dashed ${t.border}`, borderRadius: 12, padding: '40px 20px',
              textAlign: 'center', cursor: 'pointer', background: t.surfaceMuted,
            }}
          >
            <input ref={inputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={onFile} />
            {processando ? (
              <div style={{ color: t.textSecondary }}>
                <Sparkles size={28} style={{ color: t.accents.clay }} />
                <div style={{ marginTop: 10, fontFamily: FONTS.ui }}>{statusMsg || 'Processando…'}</div>
              </div>
            ) : (
              <div style={{ color: t.textSecondary }}>
                <Upload size={28} style={{ color: t.textTertiary }} />
                <div style={{ marginTop: 10, fontFamily: FONTS.display, fontSize: 15, color: t.text }}>Arraste o PDF/foto ou clique pra escolher</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: t.textTertiary }}>Conta de luz, água, internet, boleto, nota fiscal, recibo…</div>
              </div>
            )}
          </div>
        </div>
      )}

      {etapa === 'revisao' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: t.textSecondary }}>
              <FileText size={14} /> {nomeArquivo}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: t.textTertiary }}>Status:</span>
            <Segmented
              size="small"
              value={statusImport}
              onChange={(v) => setStatusImport(v as StatusDespesa)}
              options={STATUS_OPCOES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <Select
              size="small" allowClear placeholder="App (opcional)" style={{ minWidth: 150 }}
              value={sistemaId} onChange={setSistemaId} showSearch optionFilterProp="label"
              options={sistemas.map((s) => ({ value: s.id, label: s.nome }))}
            />
          </div>

          <Table
            rowKey={(_, i) => String(i)}
            dataSource={itens}
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
            columns={[
              { title: '', dataIndex: 'incluir', width: 40, render: (v: boolean, _r, i: number) => <Checkbox checked={v} onChange={(e) => setItem(i, { incluir: e.target.checked })} /> },
              { title: 'Data', dataIndex: 'data', width: 130, render: (v: string, _r, i: number) => (
                <DatePicker size="small" value={v ? dayjs(v) : null} format="DD/MM/YY" style={{ width: '100%' }} onChange={(d) => setItem(i, { data: d ? d.format('YYYY-MM-DD') : '' })} />
              ) },
              { title: 'Descrição', dataIndex: 'descricao', render: (v: string, _r, i: number) => (
                <Input size="small" value={v} onChange={(e) => setItem(i, { descricao: e.target.value })} />
              ) },
              { title: 'Categoria', dataIndex: 'categoria', width: 140, render: (v: string, _r, i: number) => (
                <Select size="small" value={CATEGORIAS.includes(v) ? v : 'Outro'} style={{ width: '100%' }} options={CATEGORIAS.map((c) => ({ value: c, label: c }))} onChange={(val) => setItem(i, { categoria: val })} />
              ) },
              { title: 'Valor', dataIndex: 'valor', width: 110, align: 'right', render: (v: number, _r, i: number) => (
                <InputNumber size="small" min={0} value={v} decimalSeparator="," style={{ width: '100%' }} onChange={(val) => setItem(i, { valor: Number(val || 0) })} />
              ) },
            ]}
          />
          <div style={{ marginTop: 10, fontSize: 12.5, color: t.textSecondary, textAlign: 'right' }}>
            {incluidos.length} de {itens.length} selecionada(s) · total {formatBRL(totalIncluidos)}
          </div>
        </div>
      )}
    </Modal>
  );
}
