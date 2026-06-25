// FinImpostos — "Impostos" (Empresa): provisão e acompanhamento do DAS/Simples.
// Base de cálculo = receita bruta REALIZADA do mês (ledger Recebimentos) × alíquota
// efetiva que você informa (sua faixa do Simples). Gera a guia por competência,
// recomenda a reserva e, ao pagar, lança a saída no livro-caixa (categoria Impostos).
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Spin, Empty, Table, Tag, Button, Select, InputNumber, Segmented, Alert, Tooltip, Popconfirm, Modal, Form, DatePicker, App as AntApp } from 'antd';
import { Landmark, PiggyBank, CalendarClock, CheckCircle2, FilePlus2, Check, Trash2, Settings2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Panel, formatBRL } from '../components/ui';
import StatCard from '../components/StatCard';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface ImpLinha {
  competencia: string; label: string;
  base: number; aliquota: number; valor: number;
  vencimento: string; status: string; dataPagamento: string;
  guiaId: string; baseLive: number;
}
interface ImpConfig { regime: string; aliquota: number; diaVencimento: number }
interface ImpResumo {
  config: ImpConfig; linhas: ImpLinha[];
  provisaoMesAtual: number; reservaRecomendada: number; pagoAno: number; aPagar: number;
}

const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Outro'];

const STATUS_META: Record<string, { cor: string; texto: string }> = {
  provisao: { cor: 'default', texto: 'Provisão' },
  pendente: { cor: 'gold', texto: 'A pagar' },
  pago: { cor: 'green', texto: 'Pago' },
};

export default function FinImpostos(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<ImpResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [janela, setJanela] = useState(6);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgForm] = Form.useForm();
  const [savingCfg, setSavingCfg] = useState(false);
  const [pagar, setPagar] = useState<ImpLinha | null>(null);
  const [pagForm] = Form.useForm();
  const [pagando, setPagando] = useState(false);
  const [acao, setAcao] = useState<string>('');

  const load = useCallback((meses: number) => {
    setLoading(true);
    callServer<ServerResponse<ImpResumo>>('getImpostosResumo', meses)
      .then((res) => { if (res.ok && res.data) setData(res.data as ImpResumo); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(janela); }, [janela, load]);

  const abrirConfig = () => {
    if (data) cfgForm.setFieldsValue(data.config);
    setCfgOpen(true);
  };

  const salvarConfig = async (v: Record<string, unknown>) => {
    setSavingCfg(true);
    try {
      const res = await callServer<ServerResponse<ImpConfig>>('impostosConfigSalvar', v);
      if (res.ok) { message.success('Configuração salva'); setCfgOpen(false); load(janela); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); }
    finally { setSavingCfg(false); }
  };

  const gerarGuia = (l: ImpLinha) => {
    setAcao(l.competencia);
    callServer<ServerResponse<unknown>>('impostoGerarGuia', l.competencia)
      .then((res) => { if (res.ok) { message.success(`Guia de ${l.label} gerada`); load(janela); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao gerar guia'))
      .finally(() => setAcao(''));
  };

  const abrirPagar = (l: ImpLinha) => {
    setPagar(l);
    pagForm.setFieldsValue({ data: dayjs(), valor: l.valor });
  };

  const confirmarPagamento = async (v: Record<string, unknown>) => {
    if (!pagar) return;
    setPagando(true);
    try {
      const payload = { data: (v['data'] as dayjs.Dayjs)?.format('YYYY-MM-DD'), valor: v['valor'] };
      const res = await callServer<ServerResponse<unknown>>('impostoRegistrarPagamento', pagar.guiaId, payload);
      if (res.ok) { message.success('Pagamento registrado e lançado no caixa'); setPagar(null); load(janela); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao registrar'); }
    finally { setPagando(false); }
  };

  const excluirGuia = (l: ImpLinha) => {
    callServer<ServerResponse<unknown>>('impostoExcluirGuia', l.guiaId)
      .then((res) => { if (res.ok) { message.success('Guia excluída'); load(janela); } else message.error(res.error || 'Erro'); });
  };

  if (loading && !data) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem dados (rode no app publicado)" style={{ marginTop: 40 }} />;

  const cfg = data.config;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Tag color="default" style={{ fontSize: 12.5, padding: '2px 10px' }}>
          {cfg.regime} · alíquota {cfg.aliquota}% · vence dia {cfg.diaVencimento}
        </Tag>
        <Button size="small" icon={<Settings2 size={14} />} onClick={abrirConfig}>Configurar</Button>
        <div style={{ flex: 1 }} />
        <Segmented
          value={janela}
          onChange={(v) => setJanela(Number(v))}
          options={[{ value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]}
        />
        {loading && <Spin size="small" />}
      </div>

      <Alert
        type="info" showIcon
        message="Como calculamos"
        description={`A base é a receita bruta realizada do mês (seus recebimentos) × ${cfg.aliquota}% (alíquota efetiva que você configura). "Gerar guia" congela o valor do mês; ao registrar o pagamento, a saída entra no livro-caixa (categoria Impostos).`}
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><StatCard label="Provisão do mês" value={formatBRL(data.provisaoMesAtual)} icon={<Landmark size={16} strokeWidth={1.8} />} accent={t.accents.clay} hint="competência atual" /></Col>
        <Col xs={12} sm={6}><StatCard label="Reserva recomendada" value={formatBRL(data.reservaRecomendada)} icon={<PiggyBank size={16} strokeWidth={1.8} />} accent={t.accents.blue} hint="provisões + guias em aberto" /></Col>
        <Col xs={12} sm={6}><StatCard label="A pagar (guias)" value={formatBRL(data.aPagar)} icon={<CalendarClock size={16} strokeWidth={1.8} />} accent={t.accents.rose} hint="guias geradas pendentes" /></Col>
        <Col xs={12} sm={6}><StatCard label="Pago no ano" value={formatBRL(data.pagoAno)} icon={<CheckCircle2 size={16} strokeWidth={1.8} />} accent={t.accents.sage} hint={String(new Date().getFullYear())} /></Col>
      </Row>

      <Panel title="Mês a mês" padding={8}>
        <Table
          rowKey="competencia"
          dataSource={data.linhas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="middle"
          columns={[
            { title: 'Competência', dataIndex: 'label', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v}</span> },
            {
              title: 'Receita bruta', dataIndex: 'base', align: 'right',
              render: (v: number, r: ImpLinha) => (
                <Tooltip title={r.status === 'provisao' ? 'Recebimentos do mês (ao vivo)' : `Congelada na guia · ao vivo hoje: ${formatBRL(r.baseLive)}`}>
                  <span style={{ color: t.textSecondary, fontFamily: FONTS.mono }}>{formatBRL(v)}</span>
                </Tooltip>
              ),
            },
            { title: 'Alíquota', dataIndex: 'aliquota', align: 'right', render: (v: number) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono }}>{v}%</span> },
            { title: 'Imposto (DAS)', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ color: t.text, fontFamily: FONTS.mono, fontWeight: 700 }}>{formatBRL(v)}</span> },
            { title: 'Vencimento', dataIndex: 'vencimento', align: 'center', render: (v: string) => v ? <span style={{ color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{dayjs(v).format('DD/MM/YY')}</span> : <span style={{ color: t.textTertiary }}>—</span> },
            { title: 'Status', dataIndex: 'status', align: 'center', render: (v: string, r: ImpLinha) => { const m = STATUS_META[v] || STATUS_META.provisao; return <Tag color={m.cor}>{m.texto}{v === 'pago' && r.dataPagamento ? ` · ${dayjs(r.dataPagamento).format('DD/MM')}` : ''}</Tag>; } },
            {
              title: 'Ações', key: 'acoes', align: 'right', width: 220,
              render: (_: unknown, r: ImpLinha) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {r.status === 'provisao' && (
                    <Button size="small" icon={<FilePlus2 size={14} />} loading={acao === r.competencia} onClick={() => gerarGuia(r)} disabled={r.valor <= 0}>Gerar guia</Button>
                  )}
                  {r.status === 'pendente' && (
                    <>
                      <Button size="small" type="primary" icon={<Check size={14} />} onClick={() => abrirPagar(r)}>Pagar</Button>
                      <Popconfirm title="Excluir esta guia?" okText="Excluir" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => excluirGuia(r)}>
                        <Button size="small" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </>
                  )}
                  {r.status === 'pago' && <span style={{ color: t.accents.sage, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Quitado</span>}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <div style={{ color: t.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        A alíquota efetiva varia conforme seu faturamento acumulado (RBT12) na tabela do Simples — ajuste em "Configurar"
        sempre que mudar de faixa. Este módulo é uma ferramenta de provisão/gestão de caixa, não substitui sua contabilidade.
      </div>

      {/* Config */}
      <Modal
        title="Configurar impostos"
        open={cfgOpen}
        onCancel={() => setCfgOpen(false)}
        onOk={() => cfgForm.submit()}
        okText="Salvar"
        confirmLoading={savingCfg}
        destroyOnClose
      >
        <Form form={cfgForm} layout="vertical" onFinish={salvarConfig} initialValues={cfg} style={{ marginTop: 8 }}>
          <Form.Item name="regime" label="Regime tributário" rules={[{ required: true }]}>
            <Select options={REGIMES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item name="aliquota" label="Alíquota efetiva (%)" rules={[{ required: true }]} extra="Da sua faixa do Simples (ex.: 6, 11.2, 14.93).">
            <InputNumber min={0} max={100} step={0.01} decimalSeparator="," style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item name="diaVencimento" label="Dia do vencimento (mês seguinte)" rules={[{ required: true }]} extra="DAS do Simples normalmente vence dia 20.">
            <InputNumber min={1} max={28} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Registrar pagamento */}
      <Modal
        title={pagar ? `Pagar imposto · ${pagar.label}` : 'Pagar imposto'}
        open={!!pagar}
        onCancel={() => setPagar(null)}
        onOk={() => pagForm.submit()}
        okText="Registrar pagamento"
        confirmLoading={pagando}
        destroyOnClose
      >
        <Form form={pagForm} layout="vertical" onFinish={confirmarPagamento} style={{ marginTop: 8 }}>
          <Form.Item name="data" label="Data do pagamento" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="valor" label="Valor pago" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} decimalSeparator="," style={{ width: '100%' }} prefix="R$" controls={false} />
          </Form.Item>
          <div style={{ color: t.textTertiary, fontSize: 12, lineHeight: 1.5 }}>
            Vamos marcar a guia como paga e lançar uma saída no livro-caixa (categoria <b>Impostos</b>).
          </div>
        </Form>
      </Modal>
    </div>
  );
}
