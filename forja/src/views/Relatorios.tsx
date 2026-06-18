import React, { useEffect, useState, useCallback } from 'react';
import { Button, Select, Switch, App as AntApp, Skeleton, Segmented, Tooltip, Input, Empty } from 'antd';
import {
  Printer, Download, FileText, RefreshCw, Sparkles, Info,
  Database, FileJson, FileSpreadsheet, Calendar, Mail, Send, Wallet, Building2,
  LayoutDashboard, ArrowLeftRight, BarChart3, PieChart, TrendingUp, TrendingDown, FileDown,
  CreditCard, Layers, CalendarRange, Receipt, Repeat,
} from 'lucide-react';
import { Panel } from '../components/ui';
import SubNav from '../components/SubNav';
import type { SubNavItem } from '../components/SubNav';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf, baixarArquivoBase64 } from '../pdf-client';
import type { RelatorioMensal, ServerResult } from '../types';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmtBRL(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}` : String(iso || '');
}

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

// ─── Tipos do relatório financeiro ─────────────────────────────────────────────
interface ExtratoLinha { data: string; descricao: string; categoria: string; metodo: string; cartao: string; parcela: string; status: string; tipo: string; valor: number }
interface RelExtrato { tipo: 'extrato'; mes: string; periodoLabel: string; linhas: ExtratoLinha[]; totais: { despesas: number; entradas: number; saldo: number; qtd: number } }
interface CatLinha { slug: string; categoria: string; valor: number; qtd: number; pct: number; anterior: number; variacao: number }
interface RelCategorias { tipo: 'categorias'; mes: string; periodoLabel: string; mesAnteriorLabel: string; linhas: CatLinha[]; total: number }
interface FluxoMes { comp: string; label: string; entradas: number; despesas: number; saldo: number; acumulado: number }
interface RelFluxo { tipo: 'fluxo'; mes: string; meses: FluxoMes[]; periodoLabel: string; totais: { entradas: number; despesas: number; saldo: number } }
interface CartaoLinha { cartao: string; vencimento: string; faturaMes: number; qtd: number; status: string; futuros: number[] }
interface RelCartoes { tipo: 'cartoes'; mes: string; periodoLabel: string; futurosLabels: string[]; linhas: CartaoLinha[]; totais: { faturaMes: number; futuros: number[] } }
interface ParcelaLinha { descricao: string; cartao: string; parcelas: number; atual: number; restantes: number; valorParcela: number; valorRestante: number; proxima: string }
interface RelParcelas { tipo: 'parcelas'; mes: string; periodoLabel: string; linhas: ParcelaLinha[]; totais: { valorRestante: number; qtdGrupos: number; proxMes: number } }
interface AnualCat { categoria: string; valor: number; pct: number }
interface RelAnual { tipo: 'anual'; ano: string; periodoLabel: string; meses: FluxoMes[]; categorias: AnualCat[]; totais: { entradas: number; despesas: number; saldo: number } }
type RelFin = RelExtrato | RelCategorias | RelFluxo | RelCartoes | RelParcelas | RelAnual;

// Empresa
interface DreLinha { label: string; valor: number; tipo: string }
interface DreApp { nome: string; mrr: number; custo: number; despesa: number; lucro: number }
interface RelDre { tipo: 'dre'; periodoLabel: string; linhas: DreLinha[]; porApp: DreApp[]; totais: { receita: number; custo: number; despesa: number; lucro: number; margem: number } }
interface LivroLinha { data: string; fornecedor: string; descricao: string; categoria: string; sistema: string; status: string; valor: number }
interface RelLivro { tipo: 'livro'; periodoLabel: string; linhas: LivroLinha[]; totais: { total: number; pago: number; pendente: number; qtd: number } }
interface MrrLinha { app: string; plano: string; recorrencia: string; proxima: string; valorMensal: number }
interface RelMrr { tipo: 'mrr'; periodoLabel: string; linhas: MrrLinha[]; totais: { mrr: number; assinaturas: number; canceladas: number } }
type RelEmp = RelDre | RelLivro | RelMrr;

export default function Relatorios(): React.ReactElement {
  const t = useTokens();
  const [secao, setSecao] = useState<'financeiro' | 'empresa' | 'portfolio' | 'exportar'>('financeiro');

  const NAV: SubNavItem<typeof secao>[] = [
    { key: 'financeiro', icon: Wallet, label: 'Financeiro', accent: 'sage', desc: 'Extrato, gastos por categoria e fluxo de caixa — exporte em PDF, CSV e Excel.' },
    { key: 'empresa', icon: Building2, label: 'Empresa', accent: 'blue', desc: 'DRE simplificado, livro-caixa e MRR/assinaturas — com PDF, CSV e Excel.' },
    { key: 'portfolio', icon: LayoutDashboard, label: 'Portfólio', accent: 'peach', desc: 'Snapshot mensal: sistemas, indicadores, alertas e próximas cobranças.' },
    { key: 'exportar', icon: Download, label: 'Exportar', accent: 'lavender', desc: 'Backup completo, CSV por entidade e resumo financeiro por e-mail.' },
  ];

  return (
    <div className="forja-view forja-relatorios" style={{ padding: '36px 40px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: white !important; }
          .forja-no-print, .forja-subnav-grid > nav, .ant-layout-sider, .ant-drawer, .ant-modal-mask, .ant-modal-wrap { display: none !important; }
          .forja-relatorios { padding: 0 !important; max-width: none !important; }
          .forja-subnav-grid { display: block !important; }
          .ant-layout { margin-left: 0 !important; }
          .forja-print-page { box-shadow: none !important; border: none !important; background: white !important; }
        }
      `}</style>

      <div style={{ marginBottom: 20 }} className="forja-no-print">
        <h1 style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 500, margin: 0, color: t.text, letterSpacing: '-0.02em' }}>Relatórios</h1>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary, marginTop: 4 }}>
          Saídas do sistema: relatórios financeiros, snapshot do portfólio e exportação de dados.
        </div>
      </div>

      <SubNav items={NAV} value={secao} onChange={setSecao} ariaLabel="Tipos de relatório">
        {secao === 'financeiro' && <RelatoriosFinanceiro />}
        {secao === 'empresa' && <EmpresaRelatorios />}
        {secao === 'portfolio' && <RelatorioPortfolio />}
        {secao === 'exportar' && <ExportarPanel />}
      </SubNav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Financeiro — Extrato · Por categoria · Fluxo de caixa
// ═══════════════════════════════════════════════════════════════════════════════

type TipoFin = 'extrato' | 'categorias' | 'fluxo' | 'cartoes' | 'parcelas' | 'anual';

function RelatoriosFinanceiro(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const hoje = new Date();
  const [tipo, setTipo] = useState<TipoFin>('extrato');
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [janela, setJanela] = useState<number>(12);
  const soAno = tipo === 'anual';
  const [data, setData] = useState<RelFin | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [exportando, setExportando] = useState<string>('');

  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('getRelatorioFinanceiro', tipo, mesStr, janela)
      .then((r) => {
        if (r.ok && r.data) setData(r.data as RelFin);
        else message.error(r.error || 'Erro ao gerar relatório');
      })
      .catch(() => message.warning('Relatório só roda no app publicado'))
      .finally(() => setLoading(false));
  }, [tipo, mesStr, janela, message]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixarPdf = async () => {
    setExportando('pdf');
    try {
      await gerarEbaixarPdf('gerarRelatorioFinanceiroPdf', tipo, mesStr, janela);
      message.success('PDF gerado');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setExportando(''); }
  };

  const exportar = async (formato: 'csv' | 'xlsx') => {
    setExportando(formato);
    try {
      const r = await callServer<ServerResult>('exportarRelatorioFinanceiro', tipo, mesStr, janela, formato);
      if (r.ok && r.data) {
        const d = r.data as { filename: string; csv?: string; base64?: string; mime: string };
        if (formato === 'csv' && d.csv != null) downloadFile(d.filename, d.csv, d.mime);
        else if (d.base64) baixarArquivoBase64(d.filename, d.base64, d.mime);
        message.success(`${formato.toUpperCase()} gerado`);
      } else message.error(r.error || 'Erro ao exportar');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao exportar'); }
    finally { setExportando(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmented
        value={tipo}
        onChange={(v) => setTipo(v as TipoFin)}
        options={[
          { value: 'extrato', label: pill(<ArrowLeftRight size={14} />, 'Extrato') },
          { value: 'categorias', label: pill(<PieChart size={14} />, 'Por categoria') },
          { value: 'fluxo', label: pill(<BarChart3 size={14} />, 'Fluxo de caixa') },
          { value: 'cartoes', label: pill(<CreditCard size={14} />, 'Faturas de cartão') },
          { value: 'parcelas', label: pill(<Layers size={14} />, 'Parcelas em aberto') },
          { value: 'anual', label: pill(<CalendarRange size={14} />, 'Fechamento anual') },
        ]}
      />

      {/* Barra de filtros + ações */}
      <Panel padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Calendar size={16} color={t.textTertiary} />
          {tipo === 'fluxo' ? (
            <>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>Janela:</span>
              <Select value={janela} onChange={setJanela} style={{ minWidth: 130 }} options={[6, 12, 24].map((n) => ({ value: n, label: `${n} meses` }))} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>até</span>
            </>
          ) : (
            <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>{soAno ? 'Ano:' : 'Mês:'}</span>
          )}
          {!soAno && <Select value={mes} onChange={setMes} style={{ minWidth: 130 }} options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />}
          <Select value={ano} onChange={setAno} style={{ minWidth: 96 }} options={[hoje.getFullYear() - 2, hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => ({ value: y, label: String(y) }))} />
          <div style={{ flex: 1, minWidth: 8 }} />
          <Tooltip title="Atualizar"><Button icon={<RefreshCw size={14} />} onClick={carregar} loading={loading} /></Tooltip>
          <Button icon={<FileText size={14} />} loading={exportando === 'pdf'} onClick={baixarPdf}>PDF</Button>
          <Button icon={<FileSpreadsheet size={14} />} loading={exportando === 'csv'} onClick={() => exportar('csv')}>CSV</Button>
          <Button type="primary" icon={<FileDown size={14} />} loading={exportando === 'xlsx'} onClick={() => exportar('xlsx')} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>Excel</Button>
        </div>
      </Panel>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : data ? (
        <div className="forja-print-page" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22, boxShadow: t.shadowSoft }}>
          {data.tipo === 'extrato' && <PreviewExtrato d={data} />}
          {data.tipo === 'categorias' && <PreviewCategorias d={data} />}
          {data.tipo === 'fluxo' && <PreviewFluxo d={data} />}
          {data.tipo === 'cartoes' && <PreviewCartoes d={data} />}
          {data.tipo === 'parcelas' && <PreviewParcelas d={data} />}
          {data.tipo === 'anual' && <PreviewAnual d={data} />}
        </div>
      ) : null}
    </div>
  );
}

function pill(icon: React.ReactNode, texto: string): React.ReactNode {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 13 }}>{icon}{texto}</span>;
}

function KpiMini({ label, valor, cor }: { label: string; valor: string; cor?: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '12px 16px', minWidth: 130 }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 600, color: cor || t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
}

function HeaderRelatorio({ titulo, periodo }: { titulo: string; periodo: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ borderBottom: `2px solid ${t.accents.peach}`, paddingBottom: 14, marginBottom: 18 }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.textTertiary }}>FORJA — Relatório financeiro</div>
      <h2 style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 500, margin: '4px 0 0', color: t.text }}>
        {titulo} <span style={{ color: t.textTertiary, fontWeight: 400 }}>{periodo}</span>
      </h2>
    </div>
  );
}

function PreviewExtrato({ d }: { d: RelExtrato }): React.ReactElement {
  const t = useTokens();
  return (
    <>
      <HeaderRelatorio titulo="Extrato mensal" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="Despesas" valor={fmtBRL(d.totais.despesas)} cor={t.accents.rose} />
        <KpiMini label="Entradas" valor={fmtBRL(d.totais.entradas)} cor={t.accents.sage} />
        <KpiMini label="Saldo" valor={fmtBRL(d.totais.saldo)} cor={d.totais.saldo >= 0 ? t.accents.sage : t.accents.rose} />
        <KpiMini label="Lançamentos" valor={String(d.totais.qtd)} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Nenhum lançamento neste mês." />
      ) : (
        <div className="forja-scroll-y" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Data', 'Descrição', 'Categoria', 'Pagamento', 'Valor'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '8px 6px', position: 'sticky', top: 0, background: t.surface, color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l, i) => {
                const ent = l.tipo === 'entrada';
                return (
                  <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                    <td style={{ padding: '8px 6px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{fmtDataBR(l.data)}</td>
                    <td style={{ padding: '8px 6px', color: t.text }}>{l.descricao}{l.parcela ? <span style={{ color: t.textTertiary }}> ({l.parcela})</span> : ''}</td>
                    <td style={{ padding: '8px 6px', color: t.textSecondary }}>{l.categoria}</td>
                    <td style={{ padding: '8px 6px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{l.metodo}{l.cartao ? ` · ${l.cartao}` : ''}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: ent ? t.accents.sage : t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{ent ? '+' : ''}{fmtBRL(l.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PreviewCategorias({ d }: { d: RelCategorias }): React.ReactElement {
  const t = useTokens();
  const max = d.linhas.reduce((m, l) => Math.max(m, l.valor), 1);
  return (
    <>
      <HeaderRelatorio titulo="Gastos por categoria" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="Total do mês" valor={fmtBRL(d.total)} />
        <KpiMini label="Categorias" valor={String(d.linhas.length)} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Sem despesas neste mês." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {d.linhas.map((l) => {
            const up = l.variacao > 0.005;
            const down = l.variacao < -0.005;
            return (
              <div key={l.slug}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>{l.categoria} <span style={{ color: t.textTertiary, fontSize: 11 }}>· {l.qtd}</span></span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    {(up || down) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: up ? t.accents.rose : t.accents.sage }}>
                        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{fmtBRL(Math.abs(l.variacao))}
                      </span>
                    )}
                    <span style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(l.valor)}</span>
                    <span style={{ fontSize: 11, color: t.textTertiary, minWidth: 32, textAlign: 'right' }}>{l.pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: t.surfaceMuted, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(l.valor / max) * 100}%`, background: t.accents.peach, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 4 }}>
            Variação comparada a {d.mesAnteriorLabel}.
          </div>
        </div>
      )}
    </>
  );
}

function PreviewFluxo({ d }: { d: RelFluxo }): React.ReactElement {
  const t = useTokens();
  const max = d.meses.reduce((m, x) => Math.max(m, x.entradas, x.despesas), 1);
  return (
    <>
      <HeaderRelatorio titulo="Fluxo de caixa" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiMini label="Entradas" valor={fmtBRL(d.totais.entradas)} cor={t.accents.sage} />
        <KpiMini label="Despesas" valor={fmtBRL(d.totais.despesas)} cor={t.accents.rose} />
        <KpiMini label="Saldo do período" valor={fmtBRL(d.totais.saldo)} cor={d.totais.saldo >= 0 ? t.accents.sage : t.accents.rose} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {d.meses.map((m) => (
          <div key={m.comp} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>{m.label}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 9, background: t.surfaceMuted, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(m.entradas / max) * 100}%`, background: t.accents.sage, borderRadius: 5 }} />
              </div>
              <div style={{ height: 9, background: t.surfaceMuted, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(m.despesas / max) * 100}%`, background: t.accents.rose, borderRadius: 5 }} />
              </div>
            </div>
            <span style={{ fontFamily: FONTS.display, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.saldo >= 0 ? t.accents.sage : t.accents.rose }}>{fmtBRL(m.saldo)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: t.accents.sage }} /> Entradas</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: t.accents.rose }} /> Despesas</span>
        <span style={{ marginLeft: 'auto' }}>Coluna à direita = saldo do mês</span>
      </div>
    </>
  );
}

function PreviewCartoes({ d }: { d: RelCartoes }): React.ReactElement {
  const t = useTokens();
  const corStatus = (s: string) => s === 'Paga' ? t.accents.sage : s === 'Aberta' ? t.accents.peach : t.textTertiary;
  const totFut = (d.totais.futuros || []).reduce((s, v) => s + v, 0);
  return (
    <>
      <HeaderRelatorio titulo="Faturas de cartão" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="Fatura do mês" valor={fmtBRL(d.totais.faturaMes)} />
        <KpiMini label="Próximas (provisão)" valor={fmtBRL(totFut)} cor={t.accents.lavender} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Nenhuma fatura neste mês." />
      ) : (
        <div className="forja-scroll-x" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr>
                {['Cartão', 'Venc.', 'Status', 'Fatura do mês', ...d.futurosLabels].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', padding: '8px 8px', color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                  <td style={{ padding: '8px 8px', color: t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{l.cartao}</td>
                  <td style={{ padding: '8px 8px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{l.vencimento ? fmtDataBR(l.vencimento) : '—'}</td>
                  <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}><span style={{ color: corStatus(l.status), fontWeight: 500 }}>{l.status}</span></td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtBRL(l.faturaMes)}</td>
                  {l.futuros.map((v, j) => (
                    <td key={j} style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v > 0 ? t.textSecondary : t.textTertiary, whiteSpace: 'nowrap' }}>{v > 0 ? fmtBRL(v) : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 12 }}>
        As colunas dos próximos meses são a provisão das parcelas já lançadas (compras parceladas).
      </div>
    </>
  );
}

function PreviewParcelas({ d }: { d: RelParcelas }): React.ReactElement {
  const t = useTokens();
  return (
    <>
      <HeaderRelatorio titulo="Parcelas em aberto" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="Falta pagar (total)" valor={fmtBRL(d.totais.valorRestante)} cor={t.accents.rose} />
        <KpiMini label="Compras parceladas" valor={String(d.totais.qtdGrupos)} />
        <KpiMini label="Próximo mês" valor={fmtBRL(d.totais.proxMes)} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Nenhuma parcela em aberto a partir deste mês." />
      ) : (
        <div className="forja-scroll-y" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Compra', 'Cartão', 'Parcela', 'Restam', 'Valor parcela', 'Falta pagar', 'Próxima'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', padding: '8px 6px', position: 'sticky', top: 0, background: t.surface, color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                  <td style={{ padding: '8px 6px', color: t.text }}>{l.descricao}</td>
                  <td style={{ padding: '8px 6px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{l.cartao}</td>
                  <td style={{ padding: '8px 6px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{l.atual}/{l.parcelas}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: t.textSecondary }}>{l.restantes}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.textSecondary, whiteSpace: 'nowrap' }}>{fmtBRL(l.valorParcela)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtBRL(l.valorRestante)}</td>
                  <td style={{ padding: '8px 6px', color: t.textTertiary, whiteSpace: 'nowrap' }}>{l.proxima || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PreviewAnual({ d }: { d: RelAnual }): React.ReactElement {
  const t = useTokens();
  const max = d.meses.reduce((m, x) => Math.max(m, x.entradas, x.despesas), 1);
  return (
    <>
      <HeaderRelatorio titulo="Fechamento anual" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiMini label="Entradas no ano" valor={fmtBRL(d.totais.entradas)} cor={t.accents.sage} />
        <KpiMini label="Despesas no ano" valor={fmtBRL(d.totais.despesas)} cor={t.accents.rose} />
        <KpiMini label="Saldo do ano" valor={fmtBRL(d.totais.saldo)} cor={d.totais.saldo >= 0 ? t.accents.sage : t.accents.rose} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {d.meses.map((m) => (
          <div key={m.comp} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 110px', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>{m.label}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 8, background: t.surfaceMuted, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(m.entradas / max) * 100}%`, background: t.accents.sage }} /></div>
              <div style={{ height: 8, background: t.surfaceMuted, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(m.despesas / max) * 100}%`, background: t.accents.rose }} /></div>
            </div>
            <span style={{ fontFamily: FONTS.display, fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.saldo >= 0 ? t.accents.sage : t.accents.rose }}>{fmtBRL(m.saldo)}</span>
          </div>
        ))}
      </div>
      {d.categorias.length > 0 && (
        <>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Categorias do ano</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.categorias.map((c) => (
              <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, padding: '4px 0', borderBottom: `1px dashed ${t.borderSoft}` }}>
                <span>{c.categoria}</span>
                <span style={{ display: 'inline-flex', gap: 12 }}>
                  <span style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.valor)}</span>
                  <span style={{ color: t.textTertiary, minWidth: 32, textAlign: 'right' }}>{c.pct.toFixed(0)}%</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Empresa — DRE · Livro-caixa · MRR
// ═══════════════════════════════════════════════════════════════════════════════

type TipoEmp = 'dre' | 'livro' | 'mrr';

function EmpresaRelatorios(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const hoje = new Date();
  const [tipo, setTipo] = useState<TipoEmp>('dre');
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [data, setData] = useState<RelEmp | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [exportando, setExportando] = useState<string>('');
  const semMes = tipo === 'mrr';
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('getRelatorioFinanceiro', tipo, mesStr, 0)
      .then((r) => {
        if (r.ok && r.data) setData(r.data as RelEmp);
        else message.error(r.error || 'Erro ao gerar relatório');
      })
      .catch(() => message.warning('Relatório só roda no app publicado'))
      .finally(() => setLoading(false));
  }, [tipo, mesStr, message]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixarPdf = async () => {
    setExportando('pdf');
    try { await gerarEbaixarPdf('gerarRelatorioFinanceiroPdf', tipo, mesStr, 0); message.success('PDF gerado'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setExportando(''); }
  };

  const exportar = async (formato: 'csv' | 'xlsx') => {
    setExportando(formato);
    try {
      const r = await callServer<ServerResult>('exportarRelatorioFinanceiro', tipo, mesStr, 0, formato);
      if (r.ok && r.data) {
        const dd = r.data as { filename: string; csv?: string; base64?: string; mime: string };
        if (formato === 'csv' && dd.csv != null) downloadFile(dd.filename, dd.csv, dd.mime);
        else if (dd.base64) baixarArquivoBase64(dd.filename, dd.base64, dd.mime);
        message.success(`${formato.toUpperCase()} gerado`);
      } else message.error(r.error || 'Erro ao exportar');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao exportar'); }
    finally { setExportando(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmented
        value={tipo}
        onChange={(v) => setTipo(v as TipoEmp)}
        options={[
          { value: 'dre', label: pill(<BarChart3 size={14} />, 'DRE') },
          { value: 'livro', label: pill(<Receipt size={14} />, 'Livro-caixa') },
          { value: 'mrr', label: pill(<Repeat size={14} />, 'MRR / assinaturas') },
        ]}
      />
      <Panel padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Calendar size={16} color={t.textTertiary} />
          {semMes ? (
            <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>Assinaturas ativas (foto atual)</span>
          ) : (
            <>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>Mês:</span>
              <Select value={mes} onChange={setMes} style={{ minWidth: 130 }} options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
              <Select value={ano} onChange={setAno} style={{ minWidth: 96 }} options={[hoje.getFullYear() - 2, hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => ({ value: y, label: String(y) }))} />
            </>
          )}
          <div style={{ flex: 1, minWidth: 8 }} />
          <Tooltip title="Atualizar"><Button icon={<RefreshCw size={14} />} onClick={carregar} loading={loading} /></Tooltip>
          <Button icon={<FileText size={14} />} loading={exportando === 'pdf'} onClick={baixarPdf}>PDF</Button>
          <Button icon={<FileSpreadsheet size={14} />} loading={exportando === 'csv'} onClick={() => exportar('csv')}>CSV</Button>
          <Button type="primary" icon={<FileDown size={14} />} loading={exportando === 'xlsx'} onClick={() => exportar('xlsx')} style={{ background: t.accents.blue, borderColor: t.accents.blue }}>Excel</Button>
        </div>
      </Panel>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : data ? (
        <div className="forja-print-page" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22, boxShadow: t.shadowSoft }}>
          {data.tipo === 'dre' && <PreviewDre d={data} />}
          {data.tipo === 'livro' && <PreviewLivro d={data} />}
          {data.tipo === 'mrr' && <PreviewMrr d={data} />}
        </div>
      ) : null}
    </div>
  );
}

function PreviewDre({ d }: { d: RelDre }): React.ReactElement {
  const t = useTokens();
  return (
    <>
      <HeaderRelatorio titulo="DRE simplificado" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiMini label="Resultado do mês" valor={fmtBRL(d.totais.lucro)} cor={d.totais.lucro >= 0 ? t.accents.sage : t.accents.rose} />
        <KpiMini label="Margem" valor={`${Math.round(d.totais.margem)}%`} />
      </div>
      <div style={{ marginBottom: 24 }}>
        {d.linhas.map((l, i) => {
          const forte = l.tipo === 'resultado';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: forte ? `2px solid ${t.border}` : `1px dashed ${t.borderSoft}`, fontWeight: forte ? 600 : 400 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text }}>{l.label}</span>
              <span style={{ fontFamily: FONTS.display, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: l.valor >= 0 ? t.accents.sage : t.accents.rose }}>{fmtBRL(l.valor)}</span>
            </div>
          );
        })}
      </div>
      {d.porApp.length > 0 && (
        <>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Por app</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['App', 'MRR', 'Custo', 'Despesa', 'Lucro'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '8px 6px', color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.porApp.map((a, i) => (
                <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                  <td style={{ padding: '8px 6px', color: t.text }}>{a.nome}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(a.mrr)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(a.custo)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(a.despesa)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: a.lucro >= 0 ? t.accents.sage : t.accents.rose }}>{fmtBRL(a.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function PreviewLivro({ d }: { d: RelLivro }): React.ReactElement {
  const t = useTokens();
  return (
    <>
      <HeaderRelatorio titulo="Livro-caixa" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="Total" valor={fmtBRL(d.totais.total)} />
        <KpiMini label="Pago" valor={fmtBRL(d.totais.pago)} cor={t.accents.sage} />
        <KpiMini label="Pendente" valor={fmtBRL(d.totais.pendente)} cor={t.accents.rose} />
        <KpiMini label="Lançamentos" valor={String(d.totais.qtd)} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Nenhuma despesa neste mês." />
      ) : (
        <div className="forja-scroll-y" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Data', 'Fornecedor', 'Categoria', 'App', 'Status', 'Valor'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 5 ? 'right' : 'left', padding: '8px 6px', position: 'sticky', top: 0, background: t.surface, color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                  <td style={{ padding: '8px 6px', color: t.textSecondary, whiteSpace: 'nowrap' }}>{fmtDataBR(l.data)}</td>
                  <td style={{ padding: '8px 6px', color: t.text }}>{l.fornecedor || l.descricao}</td>
                  <td style={{ padding: '8px 6px', color: t.textSecondary }}>{l.categoria}</td>
                  <td style={{ padding: '8px 6px', color: t.textSecondary }}>{l.sistema || '—'}</td>
                  <td style={{ padding: '8px 6px', textTransform: 'capitalize', color: l.status === 'pago' ? t.accents.sage : t.accents.peach }}>{l.status}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtBRL(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PreviewMrr({ d }: { d: RelMrr }): React.ReactElement {
  const t = useTokens();
  return (
    <>
      <HeaderRelatorio titulo="MRR — assinaturas" periodo={d.periodoLabel} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <KpiMini label="MRR" valor={fmtBRL(d.totais.mrr)} cor={t.accents.sage} />
        <KpiMini label="Assinaturas ativas" valor={String(d.totais.assinaturas)} />
        <KpiMini label="Canceladas" valor={String(d.totais.canceladas)} />
      </div>
      {d.linhas.length === 0 ? (
        <Empty description="Nenhuma assinatura ativa." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 12.5 }}>
          <thead>
            <tr>
              {['App', 'Plano', 'Recorrência', 'Próx. cobrança', 'Valor mensal'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '8px 6px', color: t.textTertiary, fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.linhas.map((l, i) => (
              <tr key={i} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                <td style={{ padding: '8px 6px', color: t.text }}>{l.app}</td>
                <td style={{ padding: '8px 6px', color: t.textSecondary }}>{l.plano || '—'}</td>
                <td style={{ padding: '8px 6px', color: t.textSecondary, textTransform: 'capitalize' }}>{l.recorrencia}</td>
                <td style={{ padding: '8px 6px', color: t.textTertiary, whiteSpace: 'nowrap' }}>{l.proxima ? fmtDataBR(l.proxima) : '—'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtBRL(l.valorMensal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Portfólio — snapshot mensal (relatório original)
// ═══════════════════════════════════════════════════════════════════════════════

function RelatorioPortfolio(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const hoje = new Date();
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [incluirIA, setIncluirIA] = useState<boolean>(false);
  const [data, setData] = useState<RelatorioMensal | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('gerarRelatorioMensal', mes, ano, incluirIA)
      .then((r) => {
        if (r.ok && r.data) setData(r.data as RelatorioMensal);
        else message.error(r.error || 'Erro ao gerar relatório');
      })
      .catch(() => message.warning('Relatório só roda no app publicado'))
      .finally(() => setLoading(false));
  }, [mes, ano, incluirIA, message]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixarPdf = async () => {
    setBaixandoPdf(true);
    try {
      await gerarEbaixarPdf('gerarRelatorioPdf', mes, ano, incluirIA);
      message.success('PDF gerado');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar PDF'); }
    finally { setBaixandoPdf(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="forja-no-print">
        <Panel padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Calendar size={16} color={t.textTertiary} />
            <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>Período:</span>
            <Select value={mes} onChange={setMes} style={{ minWidth: 130 }} options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
            <Select value={ano} onChange={setAno} style={{ minWidth: 96 }} options={[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => ({ value: y, label: String(y) }))} />
            <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color={t.accents.peach} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>Resumo IA:</span>
              <Switch checked={incluirIA} onChange={setIncluirIA} size="small" />
              <Tooltip title="Pede pra Forja IA escrever um resumo executivo no topo. Custa 1 chamada de LLM.">
                <Info size={12} color={t.textTertiary} />
              </Tooltip>
            </span>
            <div style={{ flex: 1, minWidth: 8 }} />
            <Button icon={<RefreshCw size={14} />} onClick={carregar} loading={loading}>Atualizar</Button>
            <Button icon={<Printer size={14} />} onClick={() => window.print()} disabled={!data}>Imprimir</Button>
            <Button type="primary" icon={<Download size={14} />} onClick={baixarPdf} loading={baixandoPdf} disabled={!data} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>Baixar PDF</Button>
          </div>
        </Panel>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : data ? (
        <div className="forja-print-page" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, padding: 36, boxShadow: t.shadowSoft }}>
          <ReportContent data={data} />
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exportar — backup, CSV por entidade, e-mail
// ═══════════════════════════════════════════════════════════════════════════════

function ExportarPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [entidades, setEntidades] = useState<string[]>([]);
  const [exportando, setExportando] = useState<string>('');

  useEffect(() => {
    callServer<ServerResult>('listarEntidadesExportaveis')
      .then((r) => { if (r.ok && r.data) setEntidades(r.data as string[]); })
      .catch(() => { /* preview */ });
  }, []);

  const exportarCSV = async (entidade: string) => {
    setExportando(entidade);
    try {
      const r = await callServer<ServerResult>('exportarCSV', entidade);
      if (r.ok && r.data) {
        const d = r.data as { entidade: string; rows: number; csv: string };
        if (!d.csv) { message.info(`Nenhum registro em ${entidade}`); return; }
        downloadFile(`forja-${entidade.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, d.csv, 'text/csv');
        message.success(`${d.rows} linha(s) de ${entidade} exportada(s)`);
      } else message.error(r.error || 'Erro');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setExportando(''); }
  };

  const exportarBackup = async () => {
    setExportando('backup');
    try {
      const r = await callServer<ServerResult>('exportarBackupJSON');
      if (r.ok && r.data) {
        const d = r.data as { json: string; entidades: number };
        downloadFile(`forja-backup-${new Date().toISOString().slice(0, 10)}.json`, d.json, 'application/json');
        message.success(`Backup completo (${d.entidades} entidades) baixado`);
      } else message.error(r.error || 'Erro');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setExportando(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ResumoEmailPanel />

      <Panel padding={20} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileJson size={17} color={t.accents.blue} /> Backup completo</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Baixa um JSON único com <strong>todas</strong> as entidades da Forja (sistemas, clientes, ideias, custos, receitas, APIs, alertas, stacks, decisões, riscos, timeline, oportunidades). Use pra arquivar uma cópia local ou subir pro Git.
        </p>
        <Button type="primary" icon={<Download size={14} />} loading={exportando === 'backup'} onClick={exportarBackup}>Baixar backup.json</Button>
      </Panel>

      <Panel padding={20} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileSpreadsheet size={17} color={t.accents.sage} /> Exportar entidade em CSV</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Baixe qualquer planilha individual em CSV pra abrir no Excel/Sheets ou processar com script.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entidades.map((e) => (
            <Button key={e} icon={<Database size={13} />} loading={exportando === e} onClick={() => exportarCSV(e)}>{e}</Button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Componentes do relatório de portfólio (mantidos)
// ═══════════════════════════════════════════════════════════════════════════════

function ReportContent({ data }: { data: RelatorioMensal }): React.ReactElement {
  const t = useTokens();
  const sevIcon = (s: string) =>
    s === 'critico' ? <span style={{ color: t.accents.rose }}>●</span> :
    s === 'aviso' ? <span style={{ color: t.accents.peach }}>●</span> :
    <span style={{ color: t.accents.blue }}>●</span>;

  return (
    <>
      <div style={{ borderBottom: `1px solid ${t.borderSoft}`, paddingBottom: 24, marginBottom: 28 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 4 }}>FORJA — Relatório Mensal</div>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 38, color: t.text, margin: '4px 0 8px', letterSpacing: '-0.02em' }}>
          {data.periodo.mesNome} <span style={{ color: t.textTertiary, fontWeight: 400 }}>{data.periodo.ano}</span>
        </h1>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
          Gerado em {new Date(data.geradoEm).toLocaleString('pt-BR')}
        </div>
      </div>

      {data.resumoIA && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, color: t.text, margin: '0 0 14px' }}>Resumo executivo</h2>
          <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '18px 22px', fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
            {data.resumoIA}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, color: t.text, margin: '0 0 14px' }}>Indicadores</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <KpiCard label="Sistemas" value={String(data.kpis.totalSistemas)} />
          <KpiCard label="Clientes" value={String(data.kpis.totalClientes)} />
          <KpiCard label="Ideias" value={String(data.kpis.totalIdeias)} />
          <KpiCard label="Saúde média" value={`${data.kpis.saudeMedia}%`} />
          <KpiCard label="MRR" value={fmtBRL(data.kpis.mrr)} />
          <KpiCard label="Custos mensais" value={fmtBRL(data.kpis.custoMensal)} />
          <KpiCard label="Lucro estimado" value={fmtBRL(data.kpis.lucro)} highlight={data.kpis.lucro > 0} />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, color: t.text, margin: '0 0 14px' }}>Sistemas ({data.sistemas.length})</h2>
        {data.sistemas.length === 0 ? (
          <p style={{ color: t.textTertiary, fontStyle: 'italic' }}>Nenhum sistema cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTS.ui, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                {['Nome', 'Estágio', 'Stack', 'Saúde', 'Custo', 'Incid.'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', padding: '8px 6px', color: t.textTertiary, fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sistemas.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px dashed ${t.borderSoft}` }}>
                  <td style={{ padding: '10px 6px', color: t.text }}>
                    <div style={{ fontWeight: 500 }}>{s.nome}</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>{s.codinome}</div>
                  </td>
                  <td style={{ padding: '10px 6px', color: t.textSecondary, textTransform: 'capitalize' }}>{s.estagio || '—'}</td>
                  <td style={{ padding: '10px 6px', color: t.textSecondary }}>{s.stack || '—'}</td>
                  <td style={{ padding: '10px 6px', color: s.scoreSaude >= 70 ? t.accents.sage : s.scoreSaude >= 40 ? t.accents.peach : t.accents.rose, textAlign: 'right', fontWeight: 500 }}>{s.scoreSaude}%</td>
                  <td style={{ padding: '10px 6px', color: t.textSecondary, textAlign: 'right' }}>{s.custoMensal > 0 ? fmtBRL(s.custoMensal) : '—'}</td>
                  <td style={{ padding: '10px 6px', color: s.incidentes > 0 ? t.accents.rose : t.textTertiary, textAlign: 'right' }}>{s.incidentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, color: t.text, margin: '0 0 14px' }}>Alertas em {data.periodo.mesNome} ({data.alertas.length})</h2>
        {data.alertas.length === 0 ? (
          <p style={{ color: t.textTertiary, fontStyle: 'italic' }}>Nenhum alerta no período.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.alertas.map((a, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, padding: '8px 12px', background: t.surfaceMuted, borderRadius: 8 }}>
                <span style={{ marginTop: 4 }}>{sevIcon(a.severidade)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: t.text }}>{a.titulo}</div>
                  <div style={{ marginTop: 2 }}>{a.mensagem}</div>
                  <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 4 }}>{new Date(a.criadoEm).toLocaleString('pt-BR')}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, color: t.text, margin: '0 0 14px' }}>Próximas cobranças (30 dias)</h2>
        {data.proximasContas.length === 0 ? (
          <p style={{ color: t.textTertiary, fontStyle: 'italic' }}>Nada vence nos próximos 30 dias.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.proximasContas.map((c, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, padding: '6px 0', borderBottom: `1px dashed ${t.borderSoft}` }}>
                <span>{c.fornecedor}</span>
                <span style={{ display: 'inline-flex', gap: 14 }}>
                  <span style={{ color: t.textTertiary }}>{new Date(c.proximaCobranca).toLocaleDateString('pt-BR')}</span>
                  <span style={{ color: t.text, fontWeight: 500, minWidth: 90, textAlign: 'right' }}>{fmtBRL(c.valor)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div style={{ borderTop: `1px solid ${t.borderSoft}`, paddingTop: 16, marginTop: 32, display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
        <span>FORJA · gerado automaticamente</span>
        <span>{data.periodo.mesNome} {data.periodo.ano}</span>
      </div>
    </>
  );
}

function ResumoEmailPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [email, setEmail] = useState<string>('');
  const [placeholder, setPlaceholder] = useState<string>('seu@example.com');
  const [ativo, setAtivo] = useState<boolean>(false);
  const [hora, setHora] = useState<number>(8);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);

  useEffect(() => {
    callServer<ServerResult>('getConfigResumoFinanceiro')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { email: string; ativo: boolean; hora: number; emailEfetivo: string };
          setEmail(d.email || '');
          setAtivo(!!d.ativo);
          setHora(typeof d.hora === 'number' ? d.hora : 8);
          if (d.emailEfetivo) setPlaceholder(d.emailEfetivo);
        }
      })
      .catch(() => { /* preview */ });
  }, []);

  const enviarAgora = async () => {
    setEnviando(true);
    try {
      const r = await callServer<ServerResult>('enviarResumoFinanceiroEmail', email);
      if (r.ok) {
        const d = r.data as { enviadoPara: string; vazio: boolean };
        message.success(`Resumo enviado para ${d.enviadoPara}${d.vazio ? ' (sem pendências no momento)' : ''}`);
      } else message.error(r.error || 'Erro ao enviar');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setEnviando(false); }
  };

  const toggleDiario = async (checked: boolean) => {
    setSalvando(true);
    try {
      const fn = checked ? 'ativarResumoFinanceiroDiario' : 'desativarResumoFinanceiroDiario';
      const r = checked
        ? await callServer<ServerResult>(fn, hora, email)
        : await callServer<ServerResult>(fn);
      if (r.ok) { setAtivo(checked); message.success(checked ? `Resumo diário ativado (${hora}h)` : 'Resumo diário desativado'); }
      else message.error(r.error || 'Erro');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  };

  const salvarHora = async (h: number) => {
    setHora(h);
    if (ativo) { await callServer<ServerResult>('ativarResumoFinanceiroDiario', h, email).catch(() => undefined); }
    else await callServer<ServerResult>('salvarConfigResumoFinanceiro', { hora: h }).catch(() => undefined);
  };

  return (
    <Panel padding={20} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={17} color={t.accents.peach} /> Resumo financeiro por e-mail</span>}>
      <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
        Um digest com <strong>cobranças a receber</strong>, <strong>atrasadas</strong>, <strong>contas a pagar</strong> e <strong>despesas pendentes</strong>. Envie na hora ou agende um envio diário.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} style={{ maxWidth: 280 }} prefix={<Mail size={14} color={t.textTertiary} />} />
        <Button type="primary" icon={<Send size={14} />} loading={enviando} onClick={enviarAgora}>Enviar agora</Button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <Switch checked={ativo} loading={salvando} onChange={toggleDiario} />
        <span style={{ fontSize: 13, color: t.textSecondary }}>Enviar todo dia às</span>
        <Select value={hora} onChange={salvarHora} style={{ width: 100 }} options={Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))} />
        <Tooltip title="Usa o e-mail acima; se vazio, usa o e-mail da sua conta Google.">
          <Info size={13} color={t.textTertiary} />
        </Tooltip>
      </div>
    </Panel>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: highlight ? t.accents.sage : t.text, letterSpacing: '-0.015em' }}>{value}</div>
    </div>
  );
}
