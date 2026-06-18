import React, { useState, useEffect } from 'react';
import { Row, Col, Spin, Empty, Table } from 'antd';
import { Wallet, TrendingDown, PiggyBank, Receipt, Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Panel, AreaChart, formatBRL } from '../components/ui';
import StatCard from '../components/StatCard';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Financeiro, ServerResponse } from '../types';

export default function FinResumo(): React.ReactElement {
  const t = useTokens();
  const [data, setData] = useState<Financeiro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callServer<ServerResponse<Financeiro>>('getFinanceiro')
      .then(res => { if (res.ok && res.data) setData(res.data as Financeiro); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem dados (rode no app publicado)" style={{ marginTop: 40 }} />;

  const { kpis, porApp, serie, vencimentos } = data;
  const mrrSerie = serie.map(s => s.mrr);
  const despesaSerie = serie.map(s => s.despesa);
  const labels = serie.map(s => s.label);

  return (
    <div>
      {/* Fluxos: entrada recorrente vs. saídas (recorrente + variável) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><StatCard label="MRR · entrada" value={formatBRL(kpis.mrr)} icon={<Wallet size={16} strokeWidth={1.8} />} accent={t.accents.sage} series={mrrSerie} hint={`${kpis.assinaturasAtivas} assinaturas`} /></Col>
        <Col xs={12} sm={8}><StatCard label="Custo recorrente" value={formatBRL(kpis.custoMensal)} icon={<TrendingDown size={16} strokeWidth={1.8} />} accent={t.accents.clay} hint="contratos · A pagar" /></Col>
        <Col xs={12} sm={8}><StatCard label="Despesas (mês)" value={formatBRL(kpis.despesasMes)} icon={<Receipt size={16} strokeWidth={1.8} />} accent={t.accents.peach} series={despesaSerie} hint="livro-caixa" /></Col>
      </Row>

      {/* Resultados: margem recorrente (do modelo) vs. resultado de caixa (real do mês) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><StatCard label="Margem recorrente" value={formatBRL(kpis.lucro)} icon={<PiggyBank size={16} strokeWidth={1.8} />} accent={kpis.lucro >= 0 ? t.accents.lavender : t.accents.rose} hint={`${kpis.margemRecorrente}% · MRR − custo recorrente`} /></Col>
        <Col xs={24} sm={12}><StatCard label="Resultado de caixa (mês)" value={formatBRL(kpis.resultadoMes)} icon={<Coins size={16} strokeWidth={1.8} />} accent={kpis.resultadoMes >= 0 ? t.accents.blue : t.accents.rose} hint={`${kpis.margem}% · saída total ${formatBRL(kpis.saidaMes)}`} /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Panel title="Entrada × saída (6 meses)">
            <AreaChart data={mrrSerie} labels={labels} color={t.accents.sage} height={220} showAxis />
            <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingLeft: 6, flexWrap: 'wrap' }}>
              <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: t.accents.sage, fontWeight: 600 }}>MRR:</span> {formatBRL(kpis.mrr)}</span>
              <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: t.accents.clay, fontWeight: 600 }}>Custo:</span> {formatBRL(kpis.custoMensal)}/mês</span>
              <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: t.accents.peach, fontWeight: 600 }}>Despesas:</span> {formatBRL(kpis.despesasMes)}</span>
              <span style={{ color: t.textSecondary, fontSize: 13 }}><span style={{ color: kpis.resultadoMes >= 0 ? t.accents.lavender : t.accents.rose, fontWeight: 600 }}>Resultado:</span> {formatBRL(kpis.resultadoMes)}</span>
            </div>
          </Panel>

          <div style={{ height: 16 }} />

          <Panel title="Lucro por aplicação" padding={8}>
            {porApp.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem receitas ou custos" style={{ padding: 24 }} />
            ) : (
              <Table
                rowKey="sistemaId"
                dataSource={porApp}
                pagination={false}
                scroll={{ x: 'max-content' }}
                size="middle"
                columns={[
                  { title: 'Aplicação', dataIndex: 'nome', render: (v: string) => <span style={{ color: t.text, fontWeight: 500 }}>{v}</span> },
                  { title: 'MRR', dataIndex: 'mrr', align: 'right', render: (v: number) => <span style={{ color: t.accents.sage, fontFamily: FONTS.mono }}>{formatBRL(v)}</span> },
                  { title: 'Custo', dataIndex: 'custo', align: 'right', render: (v: number) => <span style={{ color: t.accents.clay, fontFamily: FONTS.mono }}>{formatBRL(v)}</span> },
                  { title: 'Despesa', dataIndex: 'despesa', align: 'right', render: (v: number) => <span style={{ color: t.accents.peach, fontFamily: FONTS.mono }}>{v ? formatBRL(v) : '—'}</span> },
                  { title: 'Lucro', dataIndex: 'lucro', align: 'right', render: (v: number) => <span style={{ color: v >= 0 ? t.accents.sage : t.accents.rose, fontFamily: FONTS.mono, fontWeight: 600 }}>{formatBRL(v)}</span> },
                ]}
              />
            )}
          </Panel>
        </Col>

        <Col xs={24} lg={10}>
          <Panel
            title="Próximos vencimentos"
            extra={<span style={{ fontSize: 12, color: t.textTertiary }}>45 dias</span>}
            padding={8}
          >
            <div style={{ display: 'flex', gap: 12, padding: '10px 14px 14px' }}>
              <div style={{ flex: 1, background: `${t.accents.sage}14`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: t.textTertiary, fontSize: 12 }}>A receber</div>
                <div style={{ color: t.accents.sage, fontWeight: 700, fontFamily: FONTS.mono }}>{formatBRL(kpis.aReceber45)}</div>
              </div>
              <div style={{ flex: 1, background: `${t.accents.clay}14`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: t.textTertiary, fontSize: 12 }}>A pagar</div>
                <div style={{ color: t.accents.clay, fontWeight: 700, fontFamily: FONTS.mono }}>{formatBRL(kpis.aPagar45)}</div>
              </div>
            </div>
            {vencimentos.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada nos próximos 45 dias" style={{ padding: 24 }} />
            ) : vencimentos.map((v, i) => {
              const cor = v.tipo === 'receber' ? t.accents.sage : t.accents.clay;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: `1px solid ${t.borderSoft}` }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `${cor}22`, color: cor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {v.tipo === 'receber' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</div>
                    <div style={{ color: t.textTertiary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.descricao}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: t.text, fontSize: 13, fontFamily: FONTS.mono }}>{formatBRL(v.valor)}</div>
                    <div style={{ color: v.dias <= 3 ? t.accents.rose : t.textTertiary, fontSize: 11 }}>{v.dias === 0 ? 'hoje' : `${v.dias} dias`}</div>
                  </div>
                </div>
              );
            })}
          </Panel>
        </Col>
      </Row>
    </div>
  );
}
