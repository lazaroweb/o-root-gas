import React, { useEffect, useState } from 'react';
import { Drawer, Skeleton, Empty, Tag, Button, App as AntApp, Tooltip } from 'antd';
import {
  User, Boxes, AlertCircle, Calendar, MessageSquare, Sparkles, TrendingUp, TrendingDown,
  Printer, ExternalLink, Phone, Mail, Briefcase, Wallet,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface ClienteSnapshotPayload {
  pessoa: { id: string; nome: string; contato: string; papel: string; notas: string };
  kpis: {
    mrrCliente: number; custoMensalAlocado: number; lucroMensal: number; margem: number;
    sistemasAtivos: number; receitasAtivas: number; oportunidadesAbertas: number;
    entrevistas: number; alertas30d: number;
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
  geradoEm: string;
}

interface Props {
  pessoaId: string | null;
  pessoaNome?: string;
  onClose: () => void;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export default function ClienteSnapshotDrawer({ pessoaId, pessoaNome, onClose }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClienteSnapshotPayload | null>(null);

  useEffect(() => {
    if (!pessoaId) { setData(null); return; }
    setLoading(true);
    callServer<ServerResult>('snapshotCliente', pessoaId)
      .then((r) => { if (r.ok && r.data) setData(r.data as ClienteSnapshotPayload); else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Falha ao carregar snapshot'))
      .finally(() => setLoading(false));
  }, [pessoaId, message]);

  const imprimir = () => {
    // Marca a página com classe pra CSS imprimir só o drawer
    document.body.classList.add('forja-print-cliente-snapshot');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('forja-print-cliente-snapshot');
    }, 100);
  };

  const baixarMd = () => {
    if (!data) return;
    const md = gerarMarkdown(data);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = data.pessoa.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url; a.download = `cliente-${slug}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.success('Snapshot baixado');
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
            <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>
              {data?.pessoa.nome || pessoaNome || 'Cliente'}
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>Snapshot completo</div>
          </div>
        </span>
      }
      extra={
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="Imprimir / salvar como PDF (use a opção do navegador)">
            <Button icon={<Printer size={14} />} onClick={imprimir} disabled={!data}>Imprimir</Button>
          </Tooltip>
          <Tooltip title="Baixar como .md (Markdown)">
            <Button icon={<ExternalLink size={14} />} onClick={baixarMd} disabled={!data}>Baixar .md</Button>
          </Tooltip>
        </div>
      }
      classNames={{ wrapper: 'forja-cliente-snapshot-print' }}
    >
      {loading ? (
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

function Section({ icon, cor, titulo, children }: { icon: React.ReactNode; cor: string; titulo: string; children: React.ReactNode }): React.ReactElement {
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

function KpiCard({ cor, icon, label, valor, subtitulo }: { cor: string; icon: React.ReactNode; label: string; valor: string; subtitulo?: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ padding: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: cor }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {subtitulo && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{subtitulo}</div>}
    </div>
  );
}

// Gera versão markdown do snapshot pra baixar / colar em outro lugar
function gerarMarkdown(d: ClienteSnapshotPayload): string {
  const linhas: string[] = [];
  linhas.push(`# Snapshot — ${d.pessoa.nome}`);
  linhas.push('');
  linhas.push(`_Gerado em ${new Date(d.geradoEm).toLocaleString('pt-BR')} pela Forja_`);
  linhas.push('');
  linhas.push('## Identidade');
  linhas.push(`- **Papel:** ${d.pessoa.papel || '—'}`);
  linhas.push(`- **Contato:** ${d.pessoa.contato || '—'}`);
  if (d.pessoa.notas) linhas.push(`- **Notas:** ${d.pessoa.notas}`);
  linhas.push('');
  linhas.push('## Financeiro');
  linhas.push(`- **MRR:** ${brl(d.kpis.mrrCliente)}`);
  linhas.push(`- **Custo alocado:** ${brl(d.kpis.custoMensalAlocado)}`);
  linhas.push(`- **Lucro mensal:** ${brl(d.kpis.lucroMensal)} (margem ${d.kpis.margem}%)`);
  linhas.push('');
  if (d.sistemas.length > 0) {
    linhas.push(`## Sistemas (${d.sistemas.length})`);
    for (const s of d.sistemas) {
      linhas.push(`- **${s.nome}** _(${s.estagio})_ — ${brl(s.mrr)} MRR · custo ${brl(s.custo)} · lucro ${brl(s.lucro)}${s.urlProd ? ` · <${s.urlProd}>` : ''}`);
    }
    linhas.push('');
  }
  if (d.proximasCobrancas.length > 0) {
    linhas.push('## Próximos 45 dias');
    for (const c of d.proximasCobrancas.slice(0, 15)) {
      linhas.push(`- ${c.tipo === 'receita' ? '+' : '−'} **${c.nome}** — ${brl(Math.abs(c.valor))} em ${c.data} (em ${c.dias}d)`);
    }
    linhas.push('');
  }
  if (d.oportunidades.length > 0) {
    linhas.push(`## Oportunidades (${d.oportunidades.length})`);
    for (const o of d.oportunidades) {
      linhas.push(`- **${o.titulo}** _(${o.estado})_ — ${brl(o.valorEstimado)}`);
      if (o.proximoPasso) linhas.push(`  - próximo passo: ${o.proximoPasso}`);
    }
    linhas.push('');
  }
  if (d.entrevistas.length > 0) {
    linhas.push(`## Entrevistas (${d.kpis.entrevistas})`);
    for (const e of d.entrevistas.slice(0, 5)) {
      linhas.push(`- **${e.data}** (${e.tipo || 'discovery'})`);
      if (e.resumoIA) linhas.push(`  ${e.resumoIA.slice(0, 300)}${e.resumoIA.length > 300 ? '…' : ''}`);
    }
    linhas.push('');
  }
  if (d.alertas.length > 0) {
    linhas.push(`## Alertas (últimos 30 dias)`);
    for (const a of d.alertas.slice(0, 10)) {
      linhas.push(`- **[${a.severidade}]** ${a.titulo} — ${a.mensagem}`);
    }
    linhas.push('');
  }
  return linhas.join('\n');
}
