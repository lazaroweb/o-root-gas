// FinIR — "Meu Imposto de Renda" (IRPF, pessoa física). Consolida rendimentos do
// ano (pró-labore, lucros, aluguel, autônomo) e deduções (INSS, dependentes,
// saúde, previdência), calcula o carnê-leão mensal (DARF) e projeta o ajuste anual
// da declaração. Importa pró-labore/lucros lançados nas empresas.
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Spin, Empty, Table, Tag, Button, Select, InputNumber, DatePicker, Input, Modal, Form, Popconfirm, Tooltip, App as AntApp } from 'antd';
import { Landmark, PiggyBank, ShieldCheck, Receipt, Scale, Download, Plus, Trash2, TrendingUp, FileDown } from 'lucide-react';
import dayjs from 'dayjs';
import { Panel, formatBRL } from '../components/ui';
import StatCard from '../components/StatCard';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf } from '../pdf-client';
import type { ServerResponse } from '../types';

const TIPOS_RENDIMENTO = [
  { value: 'pro-labore', label: 'Pró-labore', tributavel: true },
  { value: 'distribuicao-lucros', label: 'Distribuição de lucros (isento)', tributavel: false },
  { value: 'aluguel', label: 'Aluguel (de PF)', tributavel: true },
  { value: 'autonomo-pf', label: 'Autônomo (recebido de PF)', tributavel: true },
  { value: 'outros-tributaveis', label: 'Outros tributáveis (carnê-leão)', tributavel: true },
  { value: 'outros-isentos', label: 'Outros isentos', tributavel: false },
];
const TIPOS_DEDUCAO = [
  { value: 'inss', label: 'INSS' },
  { value: 'dependentes', label: 'Dependentes' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'previdencia', label: 'Previdência privada (PGBL)' },
  { value: 'pensao', label: 'Pensão alimentícia' },
  { value: 'outras', label: 'Outras' },
];
const labelTipoRend = (v: string) => TIPOS_RENDIMENTO.find((t) => t.value === v)?.label || v;
const labelTipoDed = (v: string) => TIPOS_DEDUCAO.find((t) => t.value === v)?.label || v;

interface IRMes { competencia: string; label: string; tributavel: number; carneLeao: number; deducoes: number; baseCarne: number; darf: number }
interface IRTotais {
  totalTributavel: number; totalIsento: number; totalRetido: number; totalDeducoes: number;
  baseAnual: number; impostoDevido: number; carneLeaoAno: number; jaPago: number; ajuste: number; aPagar: number; restituir: number;
}
interface IRResumo { ano: number; meses: IRMes[]; totais: IRTotais }
interface Rendimento { id: string; competencia: string; data: string; tipo: string; descricao: string; valor: number; tributavel: boolean; irrfRetido: number; origemDespesaId?: string }
interface Deducao { id: string; competencia: string; tipo: string; descricao: string; valor: number }

export default function FinIR(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const anoBase = new Date().getFullYear();
  const [ano, setAno] = useState(anoBase);
  const [resumo, setResumo] = useState<IRResumo | null>(null);
  const [rendimentos, setRendimentos] = useState<Rendimento[]>([]);
  const [deducoes, setDeducoes] = useState<Deducao[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [rendOpen, setRendOpen] = useState(false);
  const [dedOpen, setDedOpen] = useState(false);
  const [rendForm] = Form.useForm();
  const [dedForm] = Form.useForm();
  const [savingR, setSavingR] = useState(false);
  const [savingD, setSavingD] = useState(false);
  const [pdf, setPdf] = useState(false);

  const baixarPdf = async () => {
    setPdf(true);
    try { await gerarEbaixarPdf('gerarPdfIR', ano); message.success('PDF gerado'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setPdf(false); }
  };

  const load = useCallback((a: number) => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<IRResumo>>('getIRResumo', a),
      callServer<ServerResponse<Rendimento[]>>('getIRRendimentos', a),
      callServer<ServerResponse<Deducao[]>>('getIRDeducoes', a),
    ]).then(([r, rd, dd]) => {
      if (r.ok && r.data) setResumo(r.data as IRResumo);
      if (rd.ok && rd.data) setRendimentos(rd.data as Rendimento[]);
      if (dd.ok && dd.data) setDeducoes(dd.data as Deducao[]);
    }).catch(() => { /* preview */ }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(ano); }, [ano, load]);

  const importar = () => {
    setImportando(true);
    callServer<ServerResponse<{ importados: number }>>('irImportarProLabore', ano)
      .then((res) => {
        if (res.ok) { const n = (res.data as { importados: number }).importados; message.success(n ? `${n} lançamento(s) importado(s)` : 'Nada novo pra importar'); load(ano); }
        else message.error(res.error || 'Erro');
      })
      .catch(() => message.error('Erro ao importar'))
      .finally(() => setImportando(false));
  };

  const abrirRend = () => { rendForm.resetFields(); rendForm.setFieldsValue({ data: dayjs(), tipo: 'pro-labore' }); setRendOpen(true); };
  const abrirDed = () => { dedForm.resetFields(); dedForm.setFieldsValue({ competencia: dayjs(), tipo: 'inss' }); setDedOpen(true); };

  const salvarRend = async (v: Record<string, unknown>) => {
    setSavingR(true);
    try {
      const tipo = String(v['tipo']);
      const payload = {
        data: (v['data'] as dayjs.Dayjs)?.format('YYYY-MM-DD'),
        tipo, descricao: v['descricao'], valor: v['valor'], irrfRetido: v['irrfRetido'] || 0,
        tributavel: TIPOS_RENDIMENTO.find((x) => x.value === tipo)?.tributavel,
      };
      const res = await callServer<ServerResponse<unknown>>('salvarIRRendimento', payload);
      if (res.ok) { message.success('Rendimento salvo'); setRendOpen(false); load(ano); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSavingR(false); }
  };

  const salvarDed = async (v: Record<string, unknown>) => {
    setSavingD(true);
    try {
      const payload = {
        competencia: (v['competencia'] as dayjs.Dayjs)?.format('YYYY-MM'),
        tipo: v['tipo'], descricao: v['descricao'], valor: v['valor'],
      };
      const res = await callServer<ServerResponse<unknown>>('salvarIRDeducao', payload);
      if (res.ok) { message.success('Dedução salva'); setDedOpen(false); load(ano); }
      else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSavingD(false); }
  };

  const removerRend = (id: string) => callServer<ServerResponse<unknown>>('deletarIRRendimento', id).then((r) => { if (r.ok) { message.success('Removido'); load(ano); } else message.error(r.error || 'Erro'); });
  const removerDed = (id: string) => callServer<ServerResponse<unknown>>('deletarIRDeducao', id).then((r) => { if (r.ok) { message.success('Removido'); load(ano); } else message.error(r.error || 'Erro'); });

  if (loading && !resumo) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  const tot = resumo?.totais;
  const anos = [anoBase + 1, anoBase, anoBase - 1, anoBase - 2, anoBase - 3];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Select value={ano} onChange={setAno} options={anos.map((a) => ({ value: a, label: `Ano ${a}` }))} style={{ width: 130 }} />
        <Tooltip title="Lê pró-labore e distribuição de lucros lançados nas empresas (livro-caixa) e traz como rendimentos.">
          <Button icon={<Download size={15} />} loading={importando} onClick={importar}>Importar das empresas</Button>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Button icon={<FileDown size={15} />} loading={pdf} onClick={baixarPdf}>Gerar PDF</Button>
        <Button icon={<Plus size={15} />} onClick={abrirDed}>Dedução</Button>
        <Button type="primary" icon={<Plus size={15} />} onClick={abrirRend}>Rendimento</Button>
        {loading && <Spin size="small" />}
      </div>

      {tot && (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6}><StatCard label="Rend. tributáveis" value={formatBRL(tot.totalTributavel)} icon={<TrendingUp size={16} strokeWidth={1.8} />} accent={t.accents.sage} hint="base do ano" /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Isentos" value={formatBRL(tot.totalIsento)} icon={<ShieldCheck size={16} strokeWidth={1.8} />} accent={t.accents.blue} hint="lucros, etc." /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Retido na fonte" value={formatBRL(tot.totalRetido)} icon={<Landmark size={16} strokeWidth={1.8} />} accent={t.accents.lavender} hint="IRRF" /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Deduções" value={formatBRL(tot.totalDeducoes)} icon={<Receipt size={16} strokeWidth={1.8} />} accent={t.accents.clay} hint="INSS, saúde…" /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Carnê-leão (ano)" value={formatBRL(tot.carneLeaoAno)} icon={<PiggyBank size={16} strokeWidth={1.8} />} accent={t.accents.peach} hint="DARF mensal" /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Imposto devido" value={formatBRL(tot.impostoDevido)} icon={<Scale size={16} strokeWidth={1.8} />} accent={t.accents.clay} hint={`base ${formatBRL(tot.baseAnual)}`} /></Col>
          <Col xs={12} sm={8} md={6}><StatCard label="Já pago" value={formatBRL(tot.jaPago)} icon={<ShieldCheck size={16} strokeWidth={1.8} />} accent={t.accents.sage} hint="retido + carnê-leão" /></Col>
          <Col xs={12} sm={8} md={6}>
            <StatCard
              label={tot.ajuste >= 0 ? 'A pagar (ajuste)' : 'A restituir'}
              value={formatBRL(tot.ajuste >= 0 ? tot.aPagar : tot.restituir)}
              icon={<FileDown size={16} strokeWidth={1.8} />}
              accent={tot.ajuste > 0 ? t.accents.rose : t.accents.sage}
              hint="na declaração"
            />
          </Col>
        </Row>
      )}

      <Panel title="Carnê-leão mês a mês" padding={8}>
        <Table
          rowKey="competencia"
          dataSource={resumo?.meses || []}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="middle"
          columns={[
            { title: 'Mês', dataIndex: 'label', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v}</span> },
            { title: 'Tributável', dataIndex: 'tributavel', align: 'right', render: (v: number) => <span style={{ color: t.textSecondary, fontFamily: FONTS.mono }}>{v ? formatBRL(v) : '—'}</span> },
            { title: 'Base carnê-leão', dataIndex: 'baseCarne', align: 'right', render: (v: number, r: IRMes) => <Tooltip title={`Recebido de PF ${formatBRL(r.carneLeao)} − deduções ${formatBRL(r.deducoes)}`}><span style={{ color: t.textSecondary, fontFamily: FONTS.mono }}>{v ? formatBRL(v) : '—'}</span></Tooltip> },
            { title: 'DARF (0190)', dataIndex: 'darf', align: 'right', render: (v: number) => <span style={{ color: v > 0 ? t.text : t.textTertiary, fontFamily: FONTS.mono, fontWeight: v > 0 ? 700 : 400 }}>{v > 0 ? formatBRL(v) : '—'}</span> },
          ]}
        />
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel title={`Rendimentos (${rendimentos.length})`} padding={8}>
          <Table
            rowKey="id"
            dataSource={rendimentos}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem rendimentos" /> }}
            columns={[
              { title: 'Comp.', dataIndex: 'competencia', render: (v: string) => <span style={{ color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 12 }}>{v}</span> },
              { title: 'Tipo', dataIndex: 'tipo', render: (v: string, r: Rendimento) => <span><Tag color={r.tributavel ? 'gold' : 'green'} style={{ marginInlineEnd: 4 }}>{r.tributavel ? 'Trib.' : 'Isento'}</Tag>{labelTipoRend(v)}</span> },
              { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ fontFamily: FONTS.mono, color: t.text }}>{formatBRL(v)}</span> },
              { title: '', key: 'x', align: 'right', width: 40, render: (_: unknown, r: Rendimento) => <Popconfirm title="Excluir?" okText="Sim" cancelText="Não" onConfirm={() => removerRend(r.id)}><Button size="small" type="text" danger icon={<Trash2 size={13} />} /></Popconfirm> },
            ]}
          />
        </Panel>
        <Panel title={`Deduções (${deducoes.length})`} padding={8}>
          <Table
            rowKey="id"
            dataSource={deducoes}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem deduções" /> }}
            columns={[
              { title: 'Comp.', dataIndex: 'competencia', render: (v: string) => <span style={{ color: t.textSecondary, fontFamily: FONTS.mono, fontSize: 12 }}>{v}</span> },
              { title: 'Tipo', dataIndex: 'tipo', render: (v: string) => labelTipoDed(v) },
              { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number) => <span style={{ fontFamily: FONTS.mono, color: t.text }}>{formatBRL(v)}</span> },
              { title: '', key: 'x', align: 'right', width: 40, render: (_: unknown, r: Deducao) => <Popconfirm title="Excluir?" okText="Sim" cancelText="Não" onConfirm={() => removerDed(r.id)}><Button size="small" type="text" danger icon={<Trash2 size={13} />} /></Popconfirm> },
            ]}
          />
        </Panel>
      </div>

      <div style={{ color: t.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        Carnê-leão (DARF 0190) incide sobre rendimentos tributáveis recebidos de pessoa física/exterior (aluguel, autônomo),
        já abatidas as deduções do mês. Pró-labore é tributado na fonte (IRRF) e lucros distribuídos são isentos.
        Estimativa de gestão — confirme com sua contabilidade antes de declarar.
      </div>

      {/* Modal rendimento */}
      <Modal title="Novo rendimento" open={rendOpen} onCancel={() => setRendOpen(false)} onOk={() => rendForm.submit()} okText="Salvar" confirmLoading={savingR} destroyOnClose>
        <Form form={rendForm} layout="vertical" onFinish={salvarRend} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
              <Select options={TIPOS_RENDIMENTO.map((x) => ({ value: x.value, label: x.label }))} />
            </Form.Item>
            <Form.Item name="data" label="Data do recebimento" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="descricao" label="Descrição"><Input placeholder="Ex.: pró-labore junho" /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} decimalSeparator="," style={{ width: '100%' }} controls={false} prefix="R$" />
            </Form.Item>
            <Form.Item name="irrfRetido" label="IRRF retido (R$)" tooltip="Imposto já retido na fonte (típico do pró-labore).">
              <InputNumber min={0} step={0.01} decimalSeparator="," style={{ width: '100%' }} controls={false} prefix="R$" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal dedução */}
      <Modal title="Nova dedução" open={dedOpen} onCancel={() => setDedOpen(false)} onOk={() => dedForm.submit()} okText="Salvar" confirmLoading={savingD} destroyOnClose>
        <Form form={dedForm} layout="vertical" onFinish={salvarDed} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
              <Select options={TIPOS_DEDUCAO} />
            </Form.Item>
            <Form.Item name="competencia" label="Competência" rules={[{ required: true }]}>
              <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="descricao" label="Descrição"><Input placeholder="Ex.: plano de saúde" /></Form.Item>
          <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} decimalSeparator="," style={{ width: '100%' }} controls={false} prefix="R$" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
