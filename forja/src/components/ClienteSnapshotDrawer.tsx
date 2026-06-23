import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Skeleton, Empty, Tag, Button, App as AntApp, Tooltip, Segmented, Select } from 'antd';
import {
  User, Boxes, AlertCircle, Calendar, MessageSquare, Sparkles, TrendingUp, TrendingDown,
  Download, Phone, Mail, Briefcase, Wallet, Compass, Coins, History, AlertTriangle,
  CheckCircle2, Clock,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import Discovery from '../views/Discovery';
import type { ServerResult, DiscoveryForm, DiscoveryResposta, ServerResponse } from '../types';

export type SaudeCliente = 'em_dia' | 'atencao' | 'inadimplente' | 'sem_historico';

export interface HistoricoCobranca {
  receitaId: string;
  plano: string;
  sistemaId: string;
  data: string;
  valor: number;
  recorrencia: string;
  status: 'paga' | 'atrasada' | 'futura';
}

interface ClienteSnapshotPayload {
  pessoa: { id: string; nome: string; contato: string; papel: string; notas: string };
  kpis: {
    mrrCliente: number; custoMensalAlocado: number; lucroMensal: number; margem: number;
    sistemasAtivos: number; receitasAtivas: number; oportunidadesAbertas: number;
    entrevistas: number; alertas30d: number;
    // Novos KPIs (FASE 1 — histórico financeiro estimado)
    ltvEstimado: number;
    ticketMedio: number;
    clienteDesde: string;
    pendenciasQtd: number;
    pendenciasValor: number;
    saude: SaudeCliente;
  };
  sistemas: Array<{
    id: string; nome: string; codinome: string; estagio: string; urlProd: string;
    scoreSaude: number; mrr: number; custo: number; lucro: number;
    ultimoStatus: number | null; latenciaMs: number | null;
  }>;
  receitas: Array<{ id: string; sistemaId: string; plano: string; valor: number; recorrencia: string; status: string; inicio: string; proximaCobranca: string }>;
  entrevistas: Array<{ id: string; data: string; tipo: string; resumoIA: string; requisitos: string }>;
  oportunidades: Array<{ id: string; titulo: string; valorEstimado: number; estado: string; proximoPasso: string }>;
  alertas: Array<{ id: string; tipo: string; severidade: string; titulo: string; mensagem: string; criadoEm: string; sistemaId: string }>;
  proximasCobrancas: Array<{ tipo: string; nome: string; valor: number; data: string; dias: number }>;
  historicoCobrancas: HistoricoCobranca[];
  geradoEm: string;
}

interface Props {
  pessoaId: string | null;
  pessoaNome?: string;
  onClose: () => void;
  initialTab?: 'snapshot' | 'discovery';
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export default function ClienteSnapshotDrawer({ pessoaId, pessoaNome, onClose, initialTab = 'snapshot' }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClienteSnapshotPayload | null>(null);
  const [aba, setAba] = useState<'snapshot' | 'discovery'>(initialTab);

  useEffect(() => {
    if (!pessoaId) { setData(null); return; }
    setAba(initialTab);
    setLoading(true);
    callServer<ServerResult>('snapshotCliente', pessoaId)
      .then((r) => { if (r.ok && r.data) setData(r.data as ClienteSnapshotPayload); else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Falha ao carregar snapshot'))
      .finally(() => setLoading(false));
  }, [pessoaId, message, initialTab]);

  const [baixandoBriefing, setBaixandoBriefing] = useState(false);

  const baixarBriefing = async () => {
    if (!data || !pessoaId) return;
    setBaixandoBriefing(true);
    try {
      // Busca discoveries e respostas em paralelo pra incluir no briefing.
      const [rf, rr] = await Promise.all([
        callServer<ServerResponse<DiscoveryForm[]>>('getDiscoveryForms').catch(() => ({ ok: false } as ServerResponse<DiscoveryForm[]>)),
        callServer<ServerResponse<DiscoveryResposta[]>>('getRespostasDiscovery').catch(() => ({ ok: false } as ServerResponse<DiscoveryResposta[]>)),
      ]);
      const forms = (rf.ok && rf.data ? rf.data : []).filter((f) => f.pessoaId === pessoaId);
      const respostas = (rr.ok && rr.data ? rr.data : []).filter((r) => r.pessoaId === pessoaId);
      const md = gerarBriefing(data, forms, respostas);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = data.pessoa.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      a.href = url; a.download = `briefing-${slug}-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.success('Briefing baixado');
    } catch { message.error('Falha ao gerar briefing'); }
    finally { setBaixandoBriefing(false); }
  };

  return (
    <Drawer
      open={!!pessoaId}
      onClose={onClose}
      width={880}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: `${t.accents.blue}22`, color: t.accents.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={16} strokeWidth={1.7} />
          </span>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
                {data?.pessoa.nome || pessoaNome || 'Cliente'}
              </span>
              {data?.kpis.saude && <SaudeBadgeHeader saude={data.kpis.saude} qtd={data.kpis.pendenciasQtd} valor={data.kpis.pendenciasValor} />}
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>Ficha completa · Snapshot + Discovery</div>
          </div>
        </span>
      }
      extra={
        <Tooltip title="Baixa um .md completo: snapshot + roteiros de discovery + respostas do cliente. Ideal pra colar numa IA quando for construir o app.">
          <Button type="primary" icon={<Download size={14} />} onClick={baixarBriefing} loading={baixandoBriefing} disabled={!data}>
            Baixar briefing
          </Button>
        </Tooltip>
      }
    >
      <div className="forja-snapshot-tabs" style={{ marginBottom: 18 }}>
        <Segmented
          value={aba}
          onChange={(v) => setAba(v as 'snapshot' | 'discovery')}
          options={[
            { value: 'snapshot', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><User size={13} /> Snapshot</span> },
            { value: 'discovery', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Compass size={13} /> Discovery</span> },
          ]}
        />
      </div>

      {aba === 'discovery' ? (
        <Discovery pessoaId={pessoaId || undefined} pessoaNome={data?.pessoa.nome || pessoaNome} />
      ) : loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !data ? (
        <Empty description="Sem dados pra este cliente" />
      ) : (
        <>
          {/* Bio */}
          <Section icon={<User size={14} />} cor={t.accents.blue} titulo="Identidade">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <InfoRow icon={<Briefcase size={12} />} label="Papel" valor={data.pessoa.papel || '—'} />
              <InfoRow icon={data.pessoa.contato.includes('@') && !data.pessoa.contato.startsWith('@') ? <Mail size={12} /> : <Phone size={12} />} label="Contato" valor={data.pessoa.contato || '—'} />
            </div>
            {data.pessoa.notas && (
              <div style={{ marginTop: 10, padding: 10, background: t.surfaceMuted, borderRadius: 8, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
                {data.pessoa.notas}
              </div>
            )}
          </Section>

          {/* KPIs financeiros */}
          <Section icon={<Wallet size={14} />} cor={t.accents.sage} titulo="Financeiro com este cliente">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <KpiCard cor={t.accents.sage} icon={<TrendingUp size={14} />} label="MRR (mensal equiv.)" valor={brl(data.kpis.mrrCliente)} />
              <KpiCard cor={t.accents.peach} icon={<TrendingDown size={14} />} label="Custo alocado" valor={brl(data.kpis.custoMensalAlocado)} />
              <KpiCard cor={data.kpis.lucroMensal >= 0 ? t.accents.sage : t.accents.rose} icon={<Wallet size={14} />} label="Lucro mensal" valor={brl(data.kpis.lucroMensal)} subtitulo={`${data.kpis.margem}% margem`} />
              <KpiCard cor={t.accents.blue} icon={<Boxes size={14} />} label="Sistemas ativos" valor={String(data.kpis.sistemasAtivos)} />
            </div>
          </Section>

          {/* Histórico financeiro estimado — FASE 1 */}
          <HistoricoFinanceiroSection data={data} />

          {/* Sistemas */}
          {data.sistemas.length > 0 && (
            <Section icon={<Boxes size={14} />} cor={t.accents.peach} titulo={`Sistemas (${data.sistemas.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.sistemas.map((s) => (
                  <div key={s.id} style={{ padding: 12, border: `1px solid ${t.borderSoft}`, borderRadius: 10, background: t.surface }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>{s.nome}</span>
                          {s.codinome && <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>{s.codinome}</span>}
                          <Tag color="default" style={{ fontSize: 10 }}>{s.estagio}</Tag>
                          {s.ultimoStatus !== null && (
                            <Tag color={s.ultimoStatus >= 200 && s.ultimoStatus < 400 ? 'success' : 'error'} style={{ fontSize: 10 }}>
                              {s.ultimoStatus} {s.latenciaMs ? `· ${s.latenciaMs}ms` : ''}
                            </Tag>
                          )}
                        </div>
                        {s.urlProd && (
                          <a href={s.urlProd} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.accents.blue, textDecoration: 'none' }}>
                            {s.urlProd}
                          </a>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: s.lucro >= 0 ? t.accents.sage : t.accents.rose }}>
                          {brl(s.lucro)}/mês
                        </div>
                        <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>
                          {brl(s.mrr)} − {brl(s.custo)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Próximas cobranças */}
          {data.proximasCobrancas.length > 0 && (
            <Section icon={<Calendar size={14} />} cor={t.accents.clay} titulo="Próximos 45 dias">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.proximasCobrancas.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 6, fontFamily: FONTS.ui, fontSize: 12 }}>
                    <span>
                      <Tag color={c.tipo === 'receita' ? 'green' : 'orange'} style={{ marginRight: 6, fontSize: 10 }}>{c.tipo === 'receita' ? '+' : '−'}</Tag>
                      {c.nome}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: t.textTertiary, fontSize: 11 }}>{c.dias === 0 ? 'hoje' : `em ${c.dias}d`}</span>
                      <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: c.valor >= 0 ? t.accents.sage : t.accents.rose }}>
                        {brl(Math.abs(c.valor))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Entrevistas */}
          {data.entrevistas.length > 0 && (
            <Section icon={<MessageSquare size={14} />} cor={t.accents.lavender} titulo={`Entrevistas (${data.kpis.entrevistas})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.entrevistas.slice(0, 5).map((e) => (
                  <div key={e.id} style={{ padding: 10, background: t.surfaceMuted, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Tag style={{ fontSize: 10, marginInlineEnd: 0 }}>{e.tipo || 'discovery'}</Tag>
                      <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{e.data}</span>
                    </div>
                    {e.resumoIA && (
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
                        {e.resumoIA.length > 200 ? e.resumoIA.slice(0, 200) + '…' : e.resumoIA}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Oportunidades */}
          {data.oportunidades.length > 0 && (
            <Section icon={<Sparkles size={14} />} cor={t.accents.peach} titulo={`Oportunidades (${data.oportunidades.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.oportunidades.map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{o.titulo}</div>
                      {o.proximoPasso && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>→ {o.proximoPasso}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag>{o.estado}</Tag>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: t.accents.sage }}>{brl(o.valorEstimado)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Alertas recentes */}
          {data.alertas.length > 0 && (
            <Section icon={<AlertCircle size={14} />} cor={t.accents.rose} titulo={`Alertas dos últimos 30 dias (${data.alertas.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.alertas.slice(0, 8).map((a) => {
                  const cor = a.severidade === 'critico' ? t.accents.rose : a.severidade === 'aviso' ? t.accents.peach : t.accents.blue;
                  return (
                    <div key={a.id} style={{ padding: '8px 12px', borderLeft: `3px solid ${cor}`, background: t.surfaceMuted, borderRadius: 4 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text }}>{a.titulo}</div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{a.mensagem}</div>
                    </div>
                  );
                })}
              </div>
              {/* Tratativa: orienta o user pro caminho real (sino de alertas no topo do app). */}
              <div style={{ marginTop: 8, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, fontStyle: 'italic' }}>
                Pra gerenciar (marcar lido, dispensar): clique no <strong>sino de alertas</strong> no canto superior direito do app.
              </div>
            </Section>
          )}

          <div style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textAlign: 'center' }}>
            Snapshot gerado em {new Date(data.geradoEm).toLocaleString('pt-BR')} · Forja
          </div>
        </>
      )}
    </Drawer>
  );
}

function Section({ icon, cor, titulo, children }: { icon: React.ReactNode; cor: string; titulo: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: cor }}>{icon}</span>
        <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 13, color: t.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>{titulo}</span>
        <div style={{ flex: 1, height: 1, background: t.borderSoft }} />
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: t.textTertiary, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
      </div>
    </div>
  );
}

function KpiCard({ cor, icon, label, valor, subtitulo, onClick, hint }: { cor: string; icon: React.ReactNode; label: string; valor: string; subtitulo?: string; onClick?: () => void; hint?: string }): React.ReactElement {
  const t = useTokens();
  const card = (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        padding: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = t.shadowSoft; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: cor }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {subtitulo && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: onClick ? cor : t.textTertiary, marginTop: 2, fontWeight: onClick ? 600 : 400 }}>
        {subtitulo}{onClick ? ' →' : ''}
      </div>}
    </div>
  );
  return onClick && hint ? <Tooltip title={hint}>{card}</Tooltip> : card;
}

// Badge compacto de saúde financeira pra header do drawer. Tem a mesma cor
// e semântica do badge usado em PessoasView, mas em formato mais leve pro
// título do drawer (sem retângulo de fundo cheio).
function SaudeBadgeHeader({ saude, qtd, valor }: { saude: SaudeCliente; qtd: number; valor: number }): React.ReactElement | null {
  const t = useTokens();
  if (saude === 'sem_historico') return null;

  const map: Record<SaudeCliente, { cor: string; label: string; icon: React.ReactNode }> = {
    em_dia: { cor: t.accents.sage, label: 'Em dia', icon: <CheckCircle2 size={12} /> },
    atencao: { cor: t.accents.peach, label: `${qtd} em atraso`, icon: <Clock size={12} /> },
    inadimplente: { cor: t.accents.rose, label: `${qtd} em atraso (${brl(valor)})`, icon: <AlertTriangle size={12} /> },
    sem_historico: { cor: t.textTertiary, label: 'Sem hist.', icon: null },
  };
  const v = map[saude];
  return (
    <Tooltip
      title={saude === 'em_dia'
        ? 'Cliente sem cobranças atrasadas.'
        : saude === 'atencao'
          ? `${qtd} cobrança(s) atrasada(s), no máximo 15 dias.`
          : `${qtd} cobrança(s) atrasada(s) somando ${brl(valor)}; pelo menos uma com mais de 15 dias.`}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: `${v.cor}1f`,
        color: v.cor,
        fontFamily: FONTS.ui,
        fontWeight: 600,
        fontSize: 11,
        lineHeight: '16px',
      }}>
        {v.icon}
        {v.label}
      </span>
    </Tooltip>
  );
}

// ─── Histórico financeiro do cliente — FASE 1 ─────────────────────────────────
// Mostra: 4 KPIs (LTV est., ticket médio, cliente desde, pendências) + uma
// lista de cobranças filtráveis por status (todas/pagas/atrasadas/futuras) e
// por ano. Tudo marcado como "estimado" porque o schema atual não loga eventos
// de pagamento — derivamos a timeline de inicio + recorrencia + canceladaEm.
function HistoricoFinanceiroSection({ data }: { data: ClienteSnapshotPayload }): React.ReactElement | null {
  const t = useTokens();
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'paga' | 'atrasada' | 'futura'>('todas');
  const [filtroAno, setFiltroAno] = useState<string>('todos');

  const hist = data.historicoCobrancas || [];
  if (hist.length === 0 && data.receitas.length === 0) return null;

  const anos = useMemo(() => {
    const set = new Set<string>();
    for (const h of hist) {
      const a = h.data.slice(0, 4);
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [hist]);

  const filtradas = useMemo(() => {
    return hist.filter((h) => {
      if (filtroStatus !== 'todas' && h.status !== filtroStatus) return false;
      if (filtroAno !== 'todos' && !h.data.startsWith(filtroAno)) return false;
      return true;
    });
  }, [hist, filtroStatus, filtroAno]);

  const fmtData = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmtClienteDesde = (iso: string): string => {
    if (!iso) return 'Sem histórico';
    const inicio = new Date(iso);
    if (Number.isNaN(inicio.getTime())) return iso;
    const meses = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (30.44 * 86400000)));
    if (meses === 0) return 'há menos de 1 mês';
    if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(meses / 12);
    const restoMeses = meses % 12;
    if (restoMeses === 0) return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    return `há ${anos}a ${restoMeses}m`;
  };

  const corStatus = (s: 'paga' | 'atrasada' | 'futura'): string => {
    if (s === 'paga') return t.accents.sage;
    if (s === 'atrasada') return t.accents.rose;
    return t.accents.blue;
  };
  const iconStatus = (s: 'paga' | 'atrasada' | 'futura'): React.ReactNode => {
    if (s === 'paga') return <CheckCircle2 size={12} />;
    if (s === 'atrasada') return <AlertTriangle size={12} />;
    return <Clock size={12} />;
  };
  const labelStatus = (s: 'paga' | 'atrasada' | 'futura'): string => {
    if (s === 'paga') return 'paga';
    if (s === 'atrasada') return 'atrasada';
    return 'futura';
  };

  const titulo = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      Histórico financeiro
      <Tooltip title="Calculado a partir do início, recorrência e cancelamento das assinaturas. Não é o registro real de pagamentos — é uma projeção do que deveria ter sido cobrado.">
        <Tag style={{ fontSize: 9, marginRight: 0, padding: '0 5px', lineHeight: '16px', borderRadius: 3, color: t.textTertiary, background: t.surfaceMuted, borderColor: t.borderSoft }}>
          estimado
        </Tag>
      </Tooltip>
    </span>
  );

  return (
    <Section icon={<History size={14} />} cor={t.accents.clay} titulo={titulo}>
      {/* 4 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KpiCard cor={t.accents.sage} icon={<Coins size={14} />} label="LTV estimado" valor={brl(data.kpis.ltvEstimado)} subtitulo={data.historicoCobrancas.filter((h) => h.status === 'paga').length + ' cobranças'} />
        <KpiCard cor={t.accents.peach} icon={<TrendingUp size={14} />} label="Ticket médio" valor={brl(data.kpis.ticketMedio)} />
        <KpiCard cor={t.accents.blue} icon={<Calendar size={14} />} label="Cliente desde" valor={data.kpis.clienteDesde ? fmtData(data.kpis.clienteDesde) : '—'} subtitulo={fmtClienteDesde(data.kpis.clienteDesde)} />
        <KpiCard
          cor={data.kpis.pendenciasQtd > 0 ? t.accents.rose : t.accents.sage}
          icon={data.kpis.pendenciasQtd > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          label="Pendências"
          valor={data.kpis.pendenciasQtd > 0 ? brl(data.kpis.pendenciasValor) : 'Em dia'}
          subtitulo={data.kpis.pendenciasQtd > 0 ? `${data.kpis.pendenciasQtd} ${data.kpis.pendenciasQtd === 1 ? 'cobrança' : 'cobranças'} atrasada${data.kpis.pendenciasQtd === 1 ? '' : 's'}` : 'sem atrasos'}
          onClick={data.kpis.pendenciasQtd > 0 ? () => setFiltroStatus('atrasada') : undefined}
          hint="Filtra a lista de cobranças mostrando só as atrasadas."
        />
      </div>

      {/* Filtros + lista */}
      {hist.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Segmented
              size="small"
              value={filtroStatus}
              onChange={(v) => setFiltroStatus(v as typeof filtroStatus)}
              options={[
                { value: 'todas', label: `Todas (${hist.length})` },
                { value: 'paga', label: `Pagas (${hist.filter((h) => h.status === 'paga').length})` },
                { value: 'atrasada', label: `Atrasadas (${hist.filter((h) => h.status === 'atrasada').length})` },
                { value: 'futura', label: `Futuras (${hist.filter((h) => h.status === 'futura').length})` },
              ]}
            />
            {anos.length > 1 && (
              <Select
                size="small"
                value={filtroAno}
                onChange={setFiltroAno}
                style={{ minWidth: 100 }}
                options={[{ value: 'todos', label: 'Todos os anos' }, ...anos.map((a) => ({ value: a, label: a }))]}
              />
            )}
            <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>
              {filtradas.length} {filtradas.length === 1 ? 'cobrança' : 'cobranças'}
            </span>
          </div>

          <div style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: `1px solid ${t.borderSoft}`,
            borderRadius: 10,
            background: t.surface,
          }}>
            {filtradas.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textTertiary, fontSize: 12 }}>Nenhuma cobrança neste filtro</span>} style={{ padding: 20 }} />
            ) : (
              filtradas.map((h, i) => (
                <div
                  key={`${h.receitaId}-${h.data}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: i < filtradas.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                    fontFamily: FONTS.ui,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span style={{ color: corStatus(h.status), display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: FONTS.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
                      {iconStatus(h.status)}
                      {labelStatus(h.status)}
                    </span>
                    <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.plano || 'Assinatura'}</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, minWidth: 88, textAlign: 'right' }}>{fmtData(h.data)}</span>
                    <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: t.text, minWidth: 84, textAlign: 'right' }}>
                      {brl(h.valor)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Section>
  );
}

// Briefing completo do cliente: snapshot + roteiros de discovery + respostas.
// Foco: dar à IA tudo que ela precisa pra propor / construir o app do cliente.
function gerarBriefing(
  d: ClienteSnapshotPayload,
  forms: DiscoveryForm[],
  respostas: DiscoveryResposta[],
): string {
  const linhas: string[] = [];
  const stamp = new Date().toLocaleString('pt-BR');
  linhas.push(`# Briefing do cliente — ${d.pessoa.nome}`);
  linhas.push('');
  linhas.push(`_Gerado em ${stamp} pela Forja · Inteligência de Negócios_`);
  linhas.push('');
  linhas.push('> Este documento é uma fotografia completa do cliente: identidade, situação financeira, sistemas em uso, e — o mais importante — o que a Forja descobriu na fase de Discovery (roteiros aplicados e respostas do próprio cliente). Use como base para propor e construir o app sob medida.');
  linhas.push('');

  linhas.push('## 1. Identidade');
  linhas.push(`- **Papel:** ${d.pessoa.papel || '—'}`);
  linhas.push(`- **Contato:** ${d.pessoa.contato || '—'}`);
  if (d.pessoa.notas) linhas.push(`- **Notas:** ${d.pessoa.notas}`);
  linhas.push('');

  linhas.push('## 2. Financeiro com a Forja');
  linhas.push(`- **MRR:** ${brl(d.kpis.mrrCliente)}`);
  linhas.push(`- **Custo alocado:** ${brl(d.kpis.custoMensalAlocado)}`);
  linhas.push(`- **Lucro mensal:** ${brl(d.kpis.lucroMensal)} (margem ${d.kpis.margem}%)`);
  linhas.push('');

  if (d.sistemas.length > 0) {
    linhas.push(`## 3. Sistemas em operação (${d.sistemas.length})`);
    for (const s of d.sistemas) {
      linhas.push(`- **${s.nome}** _(${s.estagio})_ — ${brl(s.mrr)} MRR · custo ${brl(s.custo)} · lucro ${brl(s.lucro)}${s.urlProd ? ` · <${s.urlProd}>` : ''}`);
    }
    linhas.push('');
  }

  if (d.proximasCobrancas.length > 0) {
    linhas.push('## 4. Próximos 45 dias');
    for (const c of d.proximasCobrancas.slice(0, 15)) {
      linhas.push(`- ${c.tipo === 'receita' ? '+' : '−'} **${c.nome}** — ${brl(Math.abs(c.valor))} em ${c.data} (em ${c.dias}d)`);
    }
    linhas.push('');
  }

  if (d.oportunidades.length > 0) {
    linhas.push(`## 5. Oportunidades em aberto (${d.oportunidades.length})`);
    for (const o of d.oportunidades) {
      linhas.push(`- **${o.titulo}** _(${o.estado})_ — ${brl(o.valorEstimado)}`);
      if (o.proximoPasso) linhas.push(`  - próximo passo: ${o.proximoPasso}`);
    }
    linhas.push('');
  }

  if (d.entrevistas.length > 0) {
    linhas.push(`## 6. Entrevistas registradas (${d.kpis.entrevistas})`);
    for (const e of d.entrevistas.slice(0, 5)) {
      linhas.push(`- **${e.data}** (${e.tipo || 'discovery'})`);
      if (e.resumoIA) linhas.push(`  ${e.resumoIA.slice(0, 400)}${e.resumoIA.length > 400 ? '…' : ''}`);
    }
    linhas.push('');
  }

  // ─── Discovery: roteiros + respostas (parte mais rica pra construir o app) ────
  if (forms.length > 0 || respostas.length > 0) {
    linhas.push(`## 7. Discovery — roteiros aplicados e respostas`);
    linhas.push('');

    if (forms.length > 0) {
      linhas.push(`### 7.1 Roteiros (${forms.length})`);
      for (const f of forms) {
        linhas.push('');
        linhas.push(`#### ${f.titulo || 'Roteiro'} _(${f.status})_`);
        const meta: string[] = [];
        if (f.criadoEm) meta.push(`criado em ${new Date(f.criadoEm).toLocaleString('pt-BR')}`);
        if (f.publicadoEm) meta.push(`publicado em ${new Date(f.publicadoEm).toLocaleString('pt-BR')}`);
        if (f.segmento) meta.push(`segmento: ${f.segmento}`);
        if (meta.length) linhas.push(`_${meta.join(' · ')}_`);
        linhas.push('');
        for (const bloco of (f.blocos || [])) {
          linhas.push(`**${bloco.tema || 'Bloco'}**`);
          for (const p of (bloco.perguntas || [])) {
            const texto = typeof p === 'string' ? p : (p && (p as { texto?: string }).texto) || '';
            if (texto) linhas.push(`- ${texto}`);
          }
          linhas.push('');
        }
      }
    }

    if (respostas.length > 0) {
      linhas.push(`### 7.2 Respostas do cliente (${respostas.length})`);
      linhas.push('');
      // Ordena por score decrescente — a melhor oportunidade primeiro.
      const ordenadas = [...respostas].sort((a, b) => (b.score || 0) - (a.score || 0));
      for (const r of ordenadas) {
        linhas.push(`#### Resposta — score ${r.score}/100`);
        const cab: string[] = [];
        if (r.nome) cab.push(`**${r.nome}**`);
        if (r.emailRespondente) cab.push(`<${r.emailRespondente}>`);
        if (r.criadoEm) cab.push(`em ${new Date(r.criadoEm).toLocaleString('pt-BR')}`);
        if (cab.length) linhas.push(cab.join(' · '));
        if (r.querAmostra) linhas.push(`- **Quer amostra:** sim${r.agendaPref ? ` (${r.agendaPref})` : ''}`);
        if (r.ferramentas && r.ferramentas.length > 0) linhas.push(`- **Ferramentas em uso:** ${r.ferramentas.join(', ')}`);
        linhas.push('');
        // Respostas pergunta-a-pergunta: tenta casar com o roteiro pra ter o enunciado.
        const formDaResposta = forms.find((f) => f.id === r.formId);
        const indice: Record<string, string> = {};
        if (formDaResposta) {
          for (const b of (formDaResposta.blocos || [])) {
            for (const p of (b.perguntas || [])) {
              const obj = (typeof p === 'object' && p) ? p as { id?: string; texto?: string } : null;
              if (obj && obj.id) indice[obj.id] = obj.texto || '';
            }
          }
        }
        const respObj = (r.respostas && typeof r.respostas === 'object') ? r.respostas as Record<string, unknown> : {};
        const chaves = Object.keys(respObj);
        if (chaves.length > 0) {
          linhas.push('**Respostas:**');
          for (const k of chaves) {
            const pergunta = indice[k] || k;
            const v = respObj[k];
            const valorTxt = Array.isArray(v) ? v.join('; ') : String(v ?? '');
            if (valorTxt.trim()) {
              linhas.push(`- _${pergunta}_`);
              linhas.push(`  → ${valorTxt}`);
            }
          }
        }
        linhas.push('');
      }
    }
  }

  if (d.alertas.length > 0) {
    linhas.push(`## 8. Alertas (últimos 30 dias)`);
    for (const a of d.alertas.slice(0, 10)) {
      linhas.push(`- **[${a.severidade}]** ${a.titulo} — ${a.mensagem}`);
    }
    linhas.push('');
  }

  linhas.push('---');
  linhas.push('');
  linhas.push('### Como usar este briefing');
  linhas.push('Cole este documento no chat da IA que vai construir o app sob medida. Os blocos 7.1 e 7.2 são a base mais rica: roteiros aplicados ao cliente e respostas literais que ele deu — use-os para definir telas, fluxos e funcionalidades do novo sistema.');
  linhas.push('');
  return linhas.join('\n');
}
