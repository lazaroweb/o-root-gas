// FinProjecao — "Projeção de caixa" (Empresa): visão pra frente, mês a mês.
// Consolida cobranças em aberto + assinaturas projetadas (entradas) contra
// custos recorrentes + despesas pendentes (saídas), com saldo acumulado a partir
// de um saldo inicial e alerta de runway (mês em que o caixa fica negativo).
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Spin, Empty, Table, InputNumber, Segmented, Alert, Tooltip } from 'antd';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Coins } from 'lucide-react';
import { Panel, AreaChart, formatBRL } from '../components/ui';
import StatCard from '../components/StatCard';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface MesProjecao {
  mes: string; label: string;
  entradas: number; saidas: number;
  cobrancas: number; assinaturas: number; custos: number; despesas: number;
  saldoMes: number; acumulado: number;
}
interface Projecao {
  meses: MesProjecao[];
  saldoInicial: number;
  totalEntradas: number; totalSaidas: number;
  saldoProjetado: number; menorAcumulado: number; mesNegativo: string;
  janela: number;
}

export default function FinProjecao(): React.ReactElement {
  const t = useTokens();
  const [data, setData] = useState<Projecao | null>(null);
  const [loading, setLoading] = useState(true);
  const [janela, setJanela] = useState(6);
  const [saldoInicial, setSaldoInicial] = useState(0);

  const load = useCallback((meses: number, saldo: number) => {
    setLoading(true);
    callServer<ServerResponse<Projecao>>('getProjecaoCaixa', meses, saldo)
      .then((res) => { if (res.ok && res.data) setData(res.data as Projecao); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tmr = setTimeout(() => load(janela, saldoInicial), 350);
    return () => clearTimeout(tmr);
  }, [janela, saldoInicial, load]);

  if (loading && !data) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem dados (rode no app publicado)" style={{ marginTop: 40 }} />;

  const labels = data.meses.map((m) => m.label);
  const acumuladoSerie = data.meses.map((m) => m.acumulado);
  const corSaldo = data.saldoProjetado >= 0 ? t.accents.sage : t.accents.rose;
  const temRisco = !!data.mesNegativo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: t.textTertiary, fontSize: 12.5 }}>Saldo inicial em caixa</span>
          <InputNumber
            value={saldoInicial}
            onChange={(v) => setSaldoInicial(Number(v || 0))}
            prefix="R$"
            decimalSeparator=","
            style={{ width: 150 }}
            controls={false}
          />
        </div>
        <Segmented
          value={janela}
          onChange={(v) => setJanela(Number(v))}
          options={[{ value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]}
        />
        {loading && <Spin size="small" />}
      </div>

      {temRisco && (
        <Alert
          type="warning" showIcon icon={<AlertTriangle size={16} />}
          message={`Atenção ao caixa em ${data.mesNegativo}`}
          description={`Pela projeção, o saldo acumulado fica negativo a partir de ${data.mesNegativo} (mínimo de ${formatBRL(data.menorAcumulado)}). Antecipe recebíveis ou reduza saídas.`}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><StatCard label="Entradas previstas" value={formatBRL(data.totalEntradas)} icon={<TrendingUp size={16} strokeWidth={1.8} />} accent={t.accents.sage} hint={`${data.janela} meses`} /></Col>
        <Col xs={12} sm={6}><StatCard label="Saídas previstas" value={formatBRL(data.totalSaidas)} icon={<TrendingDown size={16} strokeWidth={1.8} />} accent={t.accents.clay} hint={`${data.janela} meses`} /></Col>
        <Col xs={12} sm={6}><StatCard label="Saldo projetado" value={formatBRL(data.saldoProjetado)} icon={<Wallet size={16} strokeWidth={1.8} />} accent={corSaldo} hint={`fim do período · início ${formatBRL(data.saldoInicial)}`} /></Col>
        <Col xs={12} sm={6}><StatCard label="Menor caixa" value={formatBRL(data.menorAcumulado)} icon={<Coins size={16} strokeWidth={1.8} />} accent={data.menorAcumulado >= 0 ? t.accents.blue : t.accents.rose} hint={temRisco ? `negativo em ${data.mesNegativo}` : 'sempre positivo'} /></Col>
      </Row>

      <Panel title="Saldo acumulado projetado">
        <AreaChart data={acumuladoSerie} labels={labels} color={corSaldo} height={220} showAxis />
        <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingLeft: 6, flexWrap: 'wrap' }}>
          <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: t.accents.sage, fontWeight: 600 }}>Entradas:</span> {formatBRL(data.totalEntradas)}</span>
          <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: t.accents.clay, fontWeight: 600 }}>Saídas:</span> {formatBRL(data.totalSaidas)}</span>
          <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: corSaldo, fontWeight: 600 }}>Saldo ao fim:</span> {formatBRL(data.saldoProjetado)}</span>
        </div>
      </Panel>

      <Panel title="Mês a mês" padding={8}>
        <Table
          rowKey="mes"
          dataSource={data.meses}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="middle"
          columns={[
            { title: 'Mês', dataIndex: 'label', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v}</span> },
            {
              title: 'Entradas', dataIndex: 'entradas', align: 'right',
              render: (v: number, r: MesProjecao) => (
                <Tooltip title={`Cobranças ${formatBRL(r.cobrancas)} · Assinaturas ${formatBRL(r.assinaturas)}`}>
                  <span style={{ color: t.accents.sage, fontFamily: FONTS.mono }}>{formatBRL(v)}</span>
                </Tooltip>
              ),
            },
            {
              title: 'Saídas', dataIndex: 'saidas', align: 'right',
              render: (v: number, r: MesProjecao) => (
                <Tooltip title={`Custos ${formatBRL(r.custos)} · Despesas ${formatBRL(r.despesas)}`}>
                  <span style={{ color: t.accents.clay, fontFamily: FONTS.mono }}>{v ? formatBRL(v) : '—'}</span>
                </Tooltip>
              ),
            },
            { title: 'Saldo do mês', dataIndex: 'saldoMes', align: 'right', render: (v: number) => <span style={{ color: v >= 0 ? t.accents.sage : t.accents.rose, fontFamily: FONTS.mono, fontWeight: 600 }}>{formatBRL(v)}</span> },
            { title: 'Acumulado', dataIndex: 'acumulado', align: 'right', render: (v: number) => <span style={{ color: v >= 0 ? t.text : t.accents.rose, fontFamily: FONTS.mono, fontWeight: 700 }}>{formatBRL(v)}</span> },
          ]}
        />
      </Panel>

      <div style={{ color: t.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        Entradas = cobranças em aberto (por vencimento) + assinaturas ativas projetadas pela recorrência.
        Saídas = custos recorrentes projetados + despesas pendentes. Vencidos/atrasados entram no mês atual.
        O saldo acumulado parte do saldo inicial que você informar.
      </div>
    </div>
  );
}
