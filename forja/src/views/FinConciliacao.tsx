// FinConciliacao — "Conciliação bancária" (Empresa): importa extrato OFX e casa
// cada transação com o sistema. Créditos → cobranças em aberto; débitos →
// despesas pendentes / custos. Ao conciliar, dá a baixa correspondente.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Table, Tag, App as AntApp, Segmented, Empty, Tooltip, Popconfirm,
  Modal, Select, Spin, Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  Upload as UploadIcon, ArrowUpRight, ArrowDownRight, Check, X, RotateCcw, Trash2, Link2,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface Sugestao { vinculoTipo: string; vinculoId: string; label: string }
interface Transacao {
  id: string; fitid: string; data: string; descricao: string; valor: number;
  tipo: 'credito' | 'debito'; status: 'pendente' | 'conciliada' | 'ignorada';
  vinculoTipo?: string; vinculoId?: string; banco?: string; sugestao?: Sugestao | null;
}
interface ItemMatch { value: string; label: string; valor: number }

export default function FinConciliacao(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [filtro, setFiltro] = useState('pendente');
  const [busy, setBusy] = useState('');
  const [matchTx, setMatchTx] = useState<Transacao | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<{ transacoes: Transacao[] }>>('conciliacaoList', 'todos')
      .then((res) => { if (res.ok && res.data) setTransacoes((res.data as { transacoes: Transacao[] }).transacoes || []); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return transacoes;
    return transacoes.filter((x) => x.status === filtro);
  }, [transacoes, filtro]);

  const totais = useMemo(() => {
    let pend = 0, cred = 0, deb = 0;
    for (const x of transacoes) {
      if (x.status === 'pendente') { pend++; if (x.tipo === 'credito') cred += x.valor; else deb += x.valor; }
    }
    return { pend, cred, deb };
  }, [transacoes]);

  const importar = (conteudo: string) => {
    setImportando(true);
    callServer<ServerResponse<{ importadas: number; duplicadas: number; total: number }>>('importarOFX', conteudo, '')
      .then((res) => {
        if (res.ok) {
          const d = res.data as { importadas: number; duplicadas: number };
          message.success(`${d.importadas} importada(s)${d.duplicadas ? ` · ${d.duplicadas} duplicada(s) ignorada(s)` : ''}`);
          load();
        } else message.error(res.error || 'Erro ao importar');
      })
      .catch(() => message.error('Erro ao importar'))
      .finally(() => setImportando(false));
  };

  const uploadProps: UploadProps = {
    accept: '.ofx,.txt',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = () => importar(String(reader.result || ''));
      reader.onerror = () => message.error('Não consegui ler o arquivo');
      reader.readAsText(file);
      return false;
    },
  };

  const conciliar = (id: string, vinculoTipo: string, vinculoId: string) => {
    setBusy(id);
    callServer<ServerResponse<unknown>>('conciliarTransacao', id, vinculoTipo, vinculoId)
      .then((res) => { if (res.ok) { message.success('Conciliada · baixa aplicada'); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao conciliar'))
      .finally(() => setBusy(''));
  };

  const acao = (rpc: string, id: string, ok: string) => {
    setBusy(id);
    callServer<ServerResponse<unknown>>(rpc, id)
      .then((res) => { if (res.ok) { message.success(ok); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro'))
      .finally(() => setBusy(''));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero / import */}
      <div style={{
        background: `linear-gradient(135deg, ${t.accents.blue}1f, ${t.surface})`,
        border: `1px solid ${t.borderSoft}`, borderRadius: 16, padding: 22,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Transações pendentes
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
            {totais.pend}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
            <span style={{ color: t.accents.sage }}>+{formatBRL(totais.cred)}</span> entradas · <span style={{ color: t.accents.clay }}>−{formatBRL(totais.deb)}</span> saídas a conciliar
          </div>
        </div>
        <Upload {...uploadProps}>
          <Button type="primary" icon={<UploadIcon size={16} />} loading={importando} style={{ background: t.accents.blue, borderColor: t.accents.blue }}>
            Importar extrato (OFX)
          </Button>
        </Upload>
      </div>

      <Panel title="Transações do extrato" padding={8}>
        <div style={{ padding: '8px 12px 12px', borderBottom: `1px solid ${t.borderSoft}`, marginBottom: 4 }}>
          <Segmented
            size="small"
            value={filtro}
            onChange={(v) => setFiltro(String(v))}
            options={[
              { value: 'pendente', label: 'Pendentes' },
              { value: 'conciliada', label: 'Conciliadas' },
              { value: 'ignorada', label: 'Ignoradas' },
              { value: 'todos', label: 'Todas' },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtradas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Importe um arquivo OFX do seu banco pra começar" /> }}
          columns={[
            { title: 'Data', dataIndex: 'data', width: 100, render: (v: string) => <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 12.5 }}>{v || '—'}</span> },
            {
              title: 'Descrição', dataIndex: 'descricao',
              render: (v: string, r: Transacao) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: r.tipo === 'credito' ? t.accents.sage : t.accents.clay, display: 'inline-flex' }}>
                    {r.tipo === 'credito' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  </span>
                  <span style={{ color: t.text }}>{v || '—'}</span>
                </span>
              ),
            },
            { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v: number, r: Transacao) => <span style={{ color: r.tipo === 'credito' ? t.accents.sage : t.accents.clay, fontFamily: FONTS.mono, fontWeight: 600 }}>{r.tipo === 'credito' ? '+' : '−'}{formatBRL(v)}</span> },
            {
              title: 'Status / sugestão', key: 'status',
              render: (_: unknown, r: Transacao) => {
                if (r.status === 'conciliada') return <Tag bordered={false} color="green">conciliada</Tag>;
                if (r.status === 'ignorada') return <Tag bordered={false}>ignorada</Tag>;
                if (r.sugestao) return (
                  <Tooltip title="Sugestão automática de casamento">
                    <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue }} icon={<Link2 size={11} style={{ display: 'inline', marginRight: 3 }} />}>{r.sugestao.label}</Tag>
                  </Tooltip>
                );
                return <span style={{ color: t.textTertiary, fontSize: 12.5 }}>sem sugestão</span>;
              },
            },
            {
              title: '', key: 'acoes', align: 'right', width: 180,
              render: (_: unknown, r: Transacao) => {
                if (r.status === 'pendente') return (
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {r.sugestao && (
                      <Tooltip title={`Conciliar com: ${r.sugestao.label}`}>
                        <Button type="text" size="small" icon={<Check size={16} />} loading={busy === r.id} style={{ color: t.accents.sage }}
                          onClick={() => conciliar(r.id, r.sugestao!.vinculoTipo, r.sugestao!.vinculoId)} />
                      </Tooltip>
                    )}
                    <Tooltip title="Casar manualmente">
                      <Button type="text" size="small" icon={<Link2 size={15} />} style={{ color: t.accents.blue }} onClick={() => setMatchTx(r)} />
                    </Tooltip>
                    <Tooltip title="Ignorar">
                      <Button type="text" size="small" icon={<X size={15} />} style={{ color: t.textTertiary }} onClick={() => acao('conciliacaoIgnorar', r.id, 'Ignorada')} />
                    </Tooltip>
                    <Popconfirm title="Excluir transação?" onConfirm={() => acao('conciliacaoExcluir', r.id, 'Excluída')} okText="Excluir" cancelText="Voltar" okButtonProps={{ danger: true }}>
                      <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                    </Popconfirm>
                  </span>
                );
                return (
                  <Tooltip title="Voltar para pendente">
                    <Button type="text" size="small" icon={<RotateCcw size={14} />} style={{ color: t.textTertiary }} onClick={() => acao('conciliacaoDesfazer', r.id, 'Voltou pra pendente')} />
                  </Tooltip>
                );
              },
            },
          ]}
        />
      </Panel>

      <div style={{ color: t.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        Conciliar uma transação dá a baixa no item casado: crédito → cobrança vira <b>paga</b> (entra no caixa);
        débito → despesa vira <b>paga</b> ou registra o <b>pagamento do custo</b>. A dedupe é por FITID, então
        reimportar o mesmo extrato não duplica.
      </div>

      <ModalMatch tx={matchTx} onClose={() => setMatchTx(null)} onMatched={(vt, vi) => { if (matchTx) conciliar(matchTx.id, vt, vi); setMatchTx(null); }} />
    </div>
  );
}

// ─── Modal: casar manualmente ────────────────────────────────────────────────

function ModalMatch({ tx, onClose, onMatched }: {
  tx: Transacao | null; onClose: () => void; onMatched: (vinculoTipo: string, vinculoId: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const [tipo, setTipo] = useState<string>('cobranca');
  const [itens, setItens] = useState<ItemMatch[]>([]);
  const [sel, setSel] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const credito = tx?.tipo === 'credito';

  useEffect(() => {
    if (!tx) return;
    setTipo(credito ? 'cobranca' : 'despesa');
    setSel('');
  }, [tx, credito]);

  useEffect(() => {
    if (!tx) return;
    setLoading(true);
    setSel('');
    const carregar = async () => {
      try {
        if (tipo === 'cobranca') {
          const r = await callServer<ServerResponse<{ transacoes?: unknown }>>('cobrancasList', {});
          const arr = (r.ok && Array.isArray(r.data) ? r.data : []) as Array<Record<string, unknown>>;
          setItens(arr.filter((c) => ['emitida', 'vencida'].includes(String(c['status'])))
            .map((c) => ({ value: String(c['id']), label: `${String(c['pessoaNome'] || c['descricao'] || 'Cobrança')} · ${formatBRL(Number(c['valor'] || 0))}`, valor: Number(c['valor'] || 0) })));
        } else if (tipo === 'despesa') {
          const r = await callServer<ServerResponse<unknown>>('getDespesasEmpresa');
          const arr = (r.ok && Array.isArray(r.data) ? r.data : []) as Array<Record<string, unknown>>;
          setItens(arr.filter((d) => String(d['status'] || '') !== 'pago')
            .map((d) => ({ value: String(d['id']), label: `${String(d['descricao'] || d['fornecedor'] || 'Despesa')} · ${formatBRL(Number(d['valor'] || 0))}`, valor: Number(d['valor'] || 0) })));
        } else {
          const r = await callServer<ServerResponse<unknown>>('getCustos');
          const arr = (r.ok && Array.isArray(r.data) ? r.data : []) as Array<Record<string, unknown>>;
          setItens(arr.map((c) => ({ value: String(c['id']), label: `${String(c['fornecedor'] || 'Custo')} · ${formatBRL(Number(c['valor'] || 0))}`, valor: Number(c['valor'] || 0) })));
        }
      } catch { setItens([]); }
      finally { setLoading(false); }
    };
    carregar();
  }, [tipo, tx]);

  const tipos = credito
    ? [{ value: 'cobranca', label: 'Cobrança' }]
    : [{ value: 'despesa', label: 'Despesa' }, { value: 'custo', label: 'Custo / contrato' }];

  return (
    <Modal title="Casar transação manualmente" open={!!tx} onCancel={onClose} okText="Conciliar"
      okButtonProps={{ disabled: !sel }} onOk={() => sel && onMatched(tipo, sel)} destroyOnClose>
      {tx && (
        <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 14 }}>
          {tx.data} · {tx.descricao} · <b style={{ color: tx.tipo === 'credito' ? t.accents.sage : t.accents.clay }}>{tx.tipo === 'credito' ? '+' : '−'}{formatBRL(tx.valor)}</b>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Segmented block value={tipo} onChange={(v) => setTipo(String(v))} options={tipos} />
        {loading ? <Spin style={{ display: 'block', margin: '16px auto' }} /> : (
          <Select
            showSearch optionFilterProp="label" placeholder="Escolha o item pra casar"
            value={sel || undefined} onChange={setSel} options={itens}
            notFoundContent="Nenhum item em aberto" style={{ width: '100%' }}
          />
        )}
      </div>
    </Modal>
  );
}
