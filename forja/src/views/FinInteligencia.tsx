// FinInteligencia ("Norte") — a parte inteligente do Financeiro Pessoal.
//
// Une análise determinística (rápida, confiável, grátis) com um plano profundo
// via IA sob demanda. Visão premium e minimalista, em 3 camadas:
//   • Geral    — score de saúde, renda x fixas x sobra, comprometimento
//   • Detalhada— plano de redução, despesas fixas por cartão/categoria, reserva
//   • Longo prazo — projeção 12 meses + caminho de 5 anos pra abundância
//
// Dados vêm de getInteligenciaFinanceira (server agrega recorrências +
// assinaturas + renda). Config (renda declarada, meta de reserva, reserva
// atual, rendimento) em getConfigFinanceira/salvarConfigFinanceira.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Modal, Form, InputNumber, Segmented, App as AntApp, Tooltip, Tag, Empty,
} from 'antd';
import {
  Compass, Sparkles, TrendingUp, Wallet, PiggyBank, Target, ShieldCheck,
  Scissors, Lightbulb, AlertTriangle, CheckCircle2, Info, Settings2, CreditCard,
  Gem, Layers,
} from 'lucide-react';
import { Panel, formatBRL, RingProgress, AreaChart } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type {
  InteligenciaFinanceira, ConfigFinanceira, PlanoIA, PlanoReducaoItem,
  InsightFinanceiro, ServerResponse,
} from '../types';

// ─── Render leve de markdown (sem dep nova) ───────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderMarkdown(md: string): string {
  let html = escapeHtml(md)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(127,127,127,0.14);padding:1px 6px;border-radius:4px;font-size:0.92em">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:13.5px;font-weight:600;margin:14px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:600;margin:18px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:17px;font-weight:600;margin:18px 0 10px">$1</h1>')
    .replace(/^\s*[-*] (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li style="margin:4px 0">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>(?:\s*<li[\s\S]*?<\/li>)*)/g, '<ul style="margin:6px 0;padding-left:20px">$1</ul>');
  html = html.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return html;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FinInteligencia(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [intel, setIntel] = useState<InteligenciaFinanceira | null>(null);
  const [config, setConfig] = useState<ConfigFinanceira | null>(null);
  const [loading, setLoading] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [planoIA, setPlanoIA] = useState<PlanoIA | null>(null);
  const [gerando, setGerando] = useState(false);
  const [horizonte, setHorizonte] = useState<'12m' | '5anos'>('12m');

  const recarregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<InteligenciaFinanceira>>('getInteligenciaFinanceira'),
      callServer<ServerResponse<ConfigFinanceira>>('getConfigFinanceira'),
      callServer<ServerResponse<PlanoIA | null>>('getUltimoPlanoIA'),
    ])
      .then(([iR, cR, pR]) => {
        if (iR.ok && iR.data) setIntel(iR.data as InteligenciaFinanceira);
        if (cR.ok && cR.data) setConfig(cR.data as ConfigFinanceira);
        if (pR.ok && pR.data) setPlanoIA(pR.data as PlanoIA);
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(recarregar, [recarregar]);

  const gerarIA = () => {
    setGerando(true);
    message.loading({ content: 'Forja IA analisando suas finanças…', key: 'planoia', duration: 0 });
    callServer<ServerResponse<PlanoIA>>('gerarPlanoReducaoIA')
      .then((res) => {
        message.destroy('planoia');
        if (res.ok && res.data) {
          setPlanoIA(res.data as PlanoIA);
          message.success('Plano gerado!');
        } else {
          message.error(res.error || 'Erro ao gerar plano');
        }
      })
      .catch(() => { message.destroy('planoia'); message.error('Erro ao gerar plano'); })
      .finally(() => setGerando(false));
  };

  if (loading && !intel) {
    return <Panel padding={40}><div style={{ textAlign: 'center', color: t.textTertiary }}>Carregando inteligência…</div></Panel>;
  }

  // Onboarding: sem renda detectável
  if (intel && !intel.configurado) {
    return (
      <>
        <Onboarding onConfigurar={() => setCfgOpen(true)} />
        <ModalConfig open={cfgOpen} onClose={() => setCfgOpen(false)} config={config} onSaved={() => { setCfgOpen(false); recarregar(); }} />
      </>
    );
  }

  if (!intel) {
    return <Panel padding={40}><Empty description="Sem dados ainda" /></Panel>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroSaude intel={intel} onConfig={() => setCfgOpen(true)} />

      <Comprometimento intel={intel} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Reserva intel={intel} onConfig={() => setCfgOpen(true)} />
        <Projecoes intel={intel} horizonte={horizonte} setHorizonte={setHorizonte} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <DespesasFixas intel={intel} />
        <DespesasVariaveis intel={intel} />
      </div>

      <PlanoReducao intel={intel} planoIA={planoIA} gerando={gerando} onGerar={gerarIA} />

      <InsightsPanel insights={intel.insights} />

      <Guia />

      <ModalConfig open={cfgOpen} onClose={() => setCfgOpen(false)} config={config} onSaved={() => { setCfgOpen(false); recarregar(); }} />
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function Onboarding({ onConfigurar }: { onConfigurar: () => void }): React.ReactElement {
  const t = useTokens();
  return (
    <Panel padding={0}>
      <div style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px',
          background: `${t.accents.peach}18`, color: t.accents.peach,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Compass size={32} strokeWidth={1.6} />
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: t.text, marginBottom: 8 }}>
          Seu Norte financeiro
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
          Aqui a Forja analisa <strong>tudo</strong> que você cadastrou — despesas fixas (recorrências
          e assinaturas), cartões e renda — e monta um plano pra reduzir gastos, construir sua
          reserva de emergência e te levar rumo à <strong>abundância</strong>.
          <br /><br />
          Pra começar, me diz quanto você ganha por mês.
        </div>
        <Button type="primary" size="large" icon={<Settings2 size={16} />} onClick={onConfigurar} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
          Configurar minha renda
        </Button>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 16 }}>
          Dica: cadastre suas contas fixas como <strong>lançamentos recorrentes</strong> e suas
          streams na aba <strong>Assinaturas</strong> — elas viram a base da análise.
        </div>
      </div>
    </Panel>
  );
}

// ─── Hero: score de saúde ─────────────────────────────────────────────────────

function corScore(score: number, t: ReturnType<typeof useTokens>): string {
  return score >= 70 ? t.accents.sage : score >= 45 ? t.accents.peach : t.accents.rose;
}
function rotuloScore(score: number): string {
  return score >= 80 ? 'Excelente' : score >= 70 ? 'Saudável' : score >= 45 ? 'Atenção' : 'Crítico';
}

function HeroSaude({ intel, onConfig }: { intel: InteligenciaFinanceira; onConfig: () => void }): React.ReactElement {
  const t = useTokens();
  const score = intel.score ?? 0;
  const cor = corScore(score, t);
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
      padding: '24px 28px', boxShadow: t.shadowSoft,
      display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 240 }}>
        <RingProgress value={score} size={116} stroke={10} color={cor} label={`${score}`} sublabel="saúde" />
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.5, color: t.textTertiary, textTransform: 'uppercase' }}>
            Saúde financeira
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 500, color: cor, lineHeight: 1.2, marginTop: 2 }}>
            {rotuloScore(score)}
          </div>
          <button
            onClick={onConfig}
            style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8,
              padding: '5px 10px', cursor: 'pointer', color: t.textSecondary,
              fontFamily: FONTS.ui, fontSize: 12,
            }}
          >
            <Settings2 size={13} /> Ajustar premissas
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 12 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
        <StatHero icon={<Wallet size={16} />} label="Renda mensal" valor={formatBRL(intel.rendaMensal)} cor={t.accents.sage}
          sub={intel.rendaFonte === 'declarada' ? 'declarada' : 'estimada dos lançamentos'} />
        <DivV />
        <StatHero icon={<Layers size={16} />} label="Despesas fixas" valor={formatBRL(intel.totalFixasMensal)} cor={t.accents.peach}
          sub={`${(intel.comprometimento * 100).toFixed(0)}% da renda`} />
        <DivV />
        <StatHero icon={<Wallet size={16} />} label="Despesas variáveis" valor={formatBRL(intel.despesasVariaveisMedia)} cor={t.accents.clay}
          sub={intel.rendaMensal > 0 ? `${((intel.despesasVariaveisMedia / intel.rendaMensal) * 100).toFixed(0)}% da renda` : 'média/mês'} />
        <DivV />
        <StatHero icon={<PiggyBank size={16} />} label="Sobra p/ poupar" valor={formatBRL(intel.capacidadePoupanca)}
          cor={intel.capacidadePoupanca >= 0 ? t.accents.blue : t.accents.rose}
          sub={`${(intel.taxaPoupanca * 100).toFixed(0)}% da renda`} />
      </div>
    </div>
  );
}

function StatHero({ icon, label, valor, sub, cor }: { icon: React.ReactNode; label: string; valor: string; sub?: string; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, letterSpacing: 0.3, color: t.textTertiary, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 21, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DivV(): React.ReactElement {
  const t = useTokens();
  return <div style={{ width: 1, alignSelf: 'stretch', minHeight: 44, background: t.borderSoft }} />;
}

// ─── Comprometimento de renda (barra empilhada) ───────────────────────────────

function Comprometimento({ intel }: { intel: InteligenciaFinanceira }): React.ReactElement {
  const t = useTokens();
  const renda = Math.max(intel.rendaMensal, intel.custoMensalTotal, 1);
  const pFixas = (intel.totalFixasMensal / renda) * 100;
  const pVar = (intel.despesasVariaveisMedia / renda) * 100;
  const pSobra = Math.max(0, (intel.capacidadePoupanca / renda) * 100);
  const estourou = intel.capacidadePoupanca < 0;

  return (
    <Panel padding={18}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 500, color: t.text }}>Pra onde vai sua renda</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>base: {formatBRL(intel.rendaMensal)}/mês</span>
      </div>
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: t.surfaceMuted }}>
        <div style={{ width: `${pFixas}%`, background: t.accents.peach }} title={`Fixas: ${formatBRL(intel.totalFixasMensal)}`} />
        <div style={{ width: `${pVar}%`, background: t.accents.clay }} title={`Variáveis: ${formatBRL(intel.despesasVariaveisMedia)}`} />
        {!estourou && <div style={{ width: `${pSobra}%`, background: t.accents.sage }} title={`Sobra: ${formatBRL(intel.capacidadePoupanca)}`} />}
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
        <Legenda cor={t.accents.peach} label="Despesas fixas" valor={formatBRL(intel.totalFixasMensal)} pct={pFixas} />
        <Legenda cor={t.accents.clay} label="Variáveis (média)" valor={formatBRL(intel.despesasVariaveisMedia)} pct={pVar} />
        <Legenda cor={t.accents.sage} label={estourou ? 'Déficit' : 'Sobra p/ poupar'} valor={formatBRL(Math.abs(intel.capacidadePoupanca))} pct={pSobra} />
      </div>
    </Panel>
  );
}

function Legenda({ cor, label, valor, pct }: { cor: string; label: string; valor: string; pct: number }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0 }} />
      <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>{label}</span>
      <span style={{ fontFamily: FONTS.display, fontSize: 12.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
      <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>· {pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── Fundo de reserva ─────────────────────────────────────────────────────────

function Reserva({ intel, onConfig }: { intel: InteligenciaFinanceira; onConfig: () => void }): React.ReactElement {
  const t = useTokens();
  const r = intel.reserva;
  const pct = Math.round(r.progressoReserva * 100);
  const cor = pct >= 100 ? t.accents.sage : pct >= 50 ? t.accents.blue : t.accents.peach;
  return (
    <Panel
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={15} color={t.accents.blue} /><span>Fundo de reserva</span></div>}
      extra={<Tooltip title="Ajustar meta e valor guardado"><Button size="small" type="text" icon={<Settings2 size={14} />} onClick={onConfig} /></Tooltip>}
      padding={18}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <RingProgress value={pct} size={108} stroke={9} color={cor} label={`${pct}%`} sublabel={`${r.metaMeses}m`} />
        <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LinhaReserva label="Meta" valor={formatBRL(r.metaValor)} sub={`${r.metaMeses} meses de custo`} />
          <LinhaReserva label="Guardado" valor={formatBRL(r.reservaAtual)} cor={t.accents.sage} />
          <LinhaReserva label="Faltam" valor={formatBRL(r.faltaReserva)} cor={r.faltaReserva > 0 ? t.accents.peach : t.accents.sage} />
          {r.mesesParaMeta !== null && r.faltaReserva > 0 && intel.capacidadePoupanca > 0 && (
            <div style={{
              marginTop: 2, padding: '8px 12px', borderRadius: 10,
              background: `${cor}12`, border: `1px solid ${cor}30`,
              fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
            }}>
              No ritmo de {formatBRL(intel.capacidadePoupanca)}/mês, meta atingida em{' '}
              <strong style={{ color: cor }}>{r.mesesParaMeta} {r.mesesParaMeta === 1 ? 'mês' : 'meses'}</strong>.
            </div>
          )}
          {intel.capacidadePoupanca <= 0 && r.faltaReserva > 0 && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.rose }}>
              Sem sobra mensal não dá pra avançar na reserva — comece pelo plano de redução.
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function LinhaReserva({ label, valor, sub, cor }: { label: string; valor: string; sub?: string; cor?: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>{label}{sub && <span style={{ fontSize: 11 }}> · {sub}</span>}</span>
      <span style={{ fontFamily: FONTS.display, fontSize: 14, color: cor || t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}

// ─── Projeções (12 meses + 5 anos) ────────────────────────────────────────────

function Projecoes({ intel, horizonte, setHorizonte }: {
  intel: InteligenciaFinanceira; horizonte: '12m' | '5anos'; setHorizonte: (h: '12m' | '5anos') => void;
}): React.ReactElement {
  const t = useTokens();
  const dados12 = intel.proj12.map((p) => p.saldo);
  const labels12 = intel.proj12.map((p) => p.label);
  const fim12 = intel.proj12.length ? intel.proj12[intel.proj12.length - 1].saldo : 0;
  const fim5 = intel.projLongo.length ? intel.projLongo[intel.projLongo.length - 1] : null;
  const maxPat = Math.max(...intel.projLongo.map((p) => p.patrimonio), 1);

  return (
    <Panel
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={15} color={t.accents.sage} /><span>Projeção</span></div>}
      extra={
        <Segmented
          size="small"
          value={horizonte}
          onChange={(v) => setHorizonte(v as '12m' | '5anos')}
          options={[{ value: '12m', label: '12 meses' }, { value: '5anos', label: '5 anos' }]}
        />
      }
      padding={18}
    >
      {horizonte === '12m' ? (
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 4 }}>
            Saldo acumulado em 12 meses
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 500, color: fim12 >= 0 ? t.accents.sage : t.accents.rose, fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
            {formatBRL(fim12)}
          </div>
          <AreaChart data={dados12} labels={labels12} color={fim12 >= 0 ? t.accents.sage : t.accents.rose} height={140} />
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 4 }}>
            Patrimônio projetado em 5 anos <span style={{ opacity: 0.7 }}>(aporte + {intel.rendimentoAnual}% a.a.)</span>
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 500, color: t.accents.sage, fontVariantNumeric: 'tabular-nums', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gem size={18} color={t.accents.lavender} /> {fim5 ? formatBRL(fim5.patrimonio) : '—'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {intel.projLongo.map((p) => (
              <div key={p.ano}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Ano {p.ano}</span>
                  <span style={{ fontFamily: FONTS.display, fontSize: 12.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(p.patrimonio)}</span>
                </div>
                <div style={{ height: 7, background: t.surfaceMuted, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(p.aportado / maxPat) * 100}%`, background: `${t.accents.clay}66` }} title={`Aportado: ${formatBRL(p.aportado)}`} />
                  <div style={{ position: 'absolute', inset: 0, width: `${(p.patrimonio / maxPat) * 100}%`, background: t.accents.lavender, opacity: 0.85, mixBlendMode: 'normal' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: t.accents.lavender }} /> Com rendimento
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: `${t.accents.clay}66` }} /> Só aportes
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Plano de redução ─────────────────────────────────────────────────────────

function corSeveridade(sev: string, t: ReturnType<typeof useTokens>): string {
  return sev === 'alta' ? t.accents.rose : sev === 'media' ? t.accents.peach : t.accents.blue;
}

function PlanoReducao({ intel, planoIA, gerando, onGerar }: {
  intel: InteligenciaFinanceira; planoIA: PlanoIA | null; gerando: boolean; onGerar: () => void;
}): React.ReactElement {
  const t = useTokens();
  return (
    <Panel
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scissors size={15} color={t.accents.peach} /><span>Plano de redução de despesas</span></div>}
      extra={
        intel.economiaPotencialMes > 0 ? (
          <Tag color="green" style={{ marginInlineEnd: 0, fontFamily: FONTS.ui }}>
            economia potencial: {formatBRL(intel.economiaPotencialMes)}/mês
          </Tag>
        ) : null
      }
      padding={18}
    >
      {intel.plano.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 13 }}>
          <CheckCircle2 size={16} color={t.accents.sage} />
          Nenhum corte óbvio detectado — suas despesas fixas estão enxutas. 👏
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {intel.plano.map((item) => <PlanoCard key={item.id} item={item} />)}
        </div>
      )}

      {/* CTA IA */}
      <div style={{
        marginTop: 16, padding: 16, borderRadius: 14,
        background: `linear-gradient(135deg, ${t.accents.lavender}10, ${t.accents.peach}10)`,
        border: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: `${t.accents.lavender}1f`, color: t.accents.lavender,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 500, color: t.text }}>Plano profundo com a Forja IA</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
            Análise personalizada: diagnóstico, cortes priorizados, estratégia de reserva e caminho pra abundância.
          </div>
        </div>
        <Button
          type="primary"
          icon={<Sparkles size={15} />}
          loading={gerando}
          onClick={onGerar}
          style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}
        >
          {planoIA ? 'Gerar de novo' : 'Gerar plano com IA'}
        </Button>
      </div>

      {planoIA && (
        <div style={{ marginTop: 14, padding: 18, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
              <Sparkles size={13} color={t.accents.lavender} /> Plano gerado pela Forja IA
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>
              {planoIA.modelo} · {new Date(planoIA.criadoEm).toLocaleString('pt-BR')}
            </span>
          </div>
          <div
            style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(planoIA.texto) }}
          />
        </div>
      )}
    </Panel>
  );
}

function PlanoCard({ item }: { item: PlanoReducaoItem }): React.ReactElement {
  const t = useTokens();
  const cor = corSeveridade(item.severidade, t);
  const Icon = item.tipo === 'alerta' ? AlertTriangle : item.tipo === 'habito' ? Lightbulb : Scissors;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 14, borderRadius: 12,
      background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: `${cor}18`, color: cor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 13.5, fontWeight: 500, color: t.text }}>{item.titulo}</span>
          {item.economiaEstimadaMes > 0 && (
            <span style={{ fontFamily: FONTS.display, fontSize: 13, color: t.accents.sage, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              −{formatBRL(item.economiaEstimadaMes)}/mês
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginTop: 3, lineHeight: 1.5 }}>{item.descricao}</div>
      </div>
    </div>
  );
}

// ─── Despesas fixas (por cartão + categoria) ──────────────────────────────────

function DespesasFixas({ intel }: { intel: InteligenciaFinanceira }): React.ReactElement {
  const t = useTokens();
  const cats = Object.entries(intel.porCategoria).sort((a, b) => b[1] - a[1]);
  return (
    <Panel
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={15} color={t.accents.lavender} /><span>Despesas fixas por cartão</span><Tag style={{ marginInlineEnd: 0 }}>{intel.qtdFixas}</Tag></div>}
      padding={18}
    >
      {intel.qtdFixas === 0 ? (
        <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>
          Nenhuma despesa fixa detectada. Cadastre lançamentos recorrentes ou assinaturas pra elas aparecerem aqui.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: cats.length ? 16 : 0 }}>
            {intel.porCartao.filter((c) => c.totalFixoMes > 0).map((c) => (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c.cor }} />
                    {c.nome} <span style={{ color: t.textTertiary, fontSize: 11 }}>· {c.qtdItens} item(s)</span>
                  </span>
                  <span style={{ fontFamily: FONTS.display, fontSize: 13, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(c.totalFixoMes)}/mês</span>
                </div>
                {c.limite > 0 && (
                  <div style={{ height: 5, background: t.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, c.pctLimite)}%`, background: c.cor, opacity: 0.8 }} />
                  </div>
                )}
              </div>
            ))}
            {intel.semCartao > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
                <span>Outros métodos (Pix, débito, boleto)</span>
                <span style={{ fontFamily: FONTS.display, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(intel.semCartao)}/mês</span>
              </div>
            )}
          </div>

          {cats.length > 0 && (
            <div style={{ paddingTop: 14, borderTop: `1px dashed ${t.borderSoft}` }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.3, color: t.textTertiary, textTransform: 'uppercase', marginBottom: 8 }}>Por categoria</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cats.map(([cat, valor]) => (
                  <span key={cat} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 8, background: t.surfaceMuted,
                    border: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
                  }}>
                    {cat} <strong style={{ color: t.text }}>{formatBRL(valor)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ─── Despesas variáveis (por categoria) ───────────────────────────────────────

function DespesasVariaveis({ intel }: { intel: InteligenciaFinanceira }): React.ReactElement {
  const t = useTokens();
  const cats = Object.entries(intel.variaveisPorCategoria || {}).sort((a, b) => b[1] - a[1]);
  const total = intel.despesasVariaveisMedia || 0;
  const baseTxt = !intel.variaveisMesesBase
    ? ''
    : intel.variaveisMesesBase === 1
      ? 'média do mês'
      : `média de ${intel.variaveisMesesBase} meses`;
  return (
    <Panel
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={15} color={t.accents.clay} /><span>Despesas variáveis por categoria</span></div>}
      extra={total > 0 ? <Tag style={{ marginInlineEnd: 0, fontFamily: FONTS.ui }}>{formatBRL(total)}/mês</Tag> : null}
      padding={18}
    >
      {cats.length === 0 ? (
        <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>
          Sem despesas variáveis nos últimos meses. Lançamentos avulsos (compras de cartão, mercado, lazer) aparecem aqui automaticamente.
        </div>
      ) : (
        <>
          {baseTxt && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginBottom: 12 }}>
              Base: {baseTxt} · gasto livre médio por mês
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {cats.map(([cat, valor]) => {
              const pct = total > 0 ? (valor / total) * 100 : 0;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>{cat}</span>
                    <span style={{ fontFamily: FONTS.display, fontSize: 13, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                      {formatBRL(valor)}<span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}> · {pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: t.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: t.accents.clay, opacity: 0.85 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function InsightsPanel({ insights }: { insights: InsightFinanceiro[] }): React.ReactElement {
  const t = useTokens();
  const cor = (tipo: string) => tipo === 'positivo' ? t.accents.sage : tipo === 'alerta' ? t.accents.rose : t.accents.blue;
  const ico = (tipo: string) => tipo === 'positivo' ? <CheckCircle2 size={15} /> : tipo === 'alerta' ? <AlertTriangle size={15} /> : <Info size={15} />;
  return (
    <Panel title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lightbulb size={15} color={t.accents.peach} /><span>Insights</span></div>} padding={18}>
      {insights.length === 0 ? (
        <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>Cadastre mais dados pra gerar insights.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: cor(ins.tipo), display: 'inline-flex', marginTop: 1, flexShrink: 0 }}>{ico(ins.tipo)}</span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{ins.texto}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Guia ─────────────────────────────────────────────────────────────────────

function Guia(): React.ReactElement {
  const t = useTokens();
  const dicas = [
    { icon: <Layers size={15} />, titulo: 'O que conta como despesa fixa', texto: 'Lançamentos marcados como recorrentes (mensal/semanal/anual) + assinaturas ativas. Cadastre-os direito e a análise fica precisa.' },
    { icon: <CreditCard size={15} />, titulo: 'Relacione com seus cartões', texto: 'Ao lançar uma despesa fixa no cartão, selecione o cartão. Assim você vê quanto de cada fatura já está comprometido.' },
    { icon: <Target size={15} />, titulo: 'Regra 50/30/20', texto: 'Mire ~50% em essenciais (fixas), 30% em desejos (variáveis) e 20% poupança. O comprometimento acima mostra onde você está.' },
    { icon: <ShieldCheck size={15} />, titulo: 'Reserva primeiro', texto: 'Antes de investir, monte 3 a 6 meses de custo guardados. É seu colchão contra imprevistos.' },
    { icon: <Gem size={15} />, titulo: 'Depois, faça render', texto: 'Com a reserva pronta, direcione a sobra pra investimentos. A projeção de 5 anos mostra o poder dos juros compostos.' },
  ];
  return (
    <Panel title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Compass size={15} color={t.accents.peach} /><span>Guia rápido — como usar o Norte</span></div>} padding={18}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {dicas.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: `${t.accents.peach}15`, color: t.accents.peach,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{d.icon}</div>
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 500, color: t.text, marginBottom: 2 }}>{d.titulo}</div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.5 }}>{d.texto}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Modal de config (premissas) ──────────────────────────────────────────────

function ModalConfig({ open, onClose, config, onSaved }: {
  open: boolean; onClose: () => void; config: ConfigFinanceira | null; onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        rendaMensal: config?.rendaMensal || undefined,
        metaReservaMeses: config?.metaReservaMeses || 6,
        reservaAtual: config?.reservaAtual || 0,
        rendimentoAnual: config?.rendimentoAnual ?? 10,
      });
    }
  }, [open, config, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<ConfigFinanceira>>('salvarConfigFinanceira', v);
      if (res.ok) { message.success('Premissas atualizadas'); onSaved(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Premissas do seu Norte" open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} okText="Salvar" cancelText="Cancelar" destroyOnClose>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="rendaMensal" label="Renda mensal" tooltip="Quanto você recebe líquido por mês. Se deixar vazio, a Forja estima pelos seus lançamentos de entrada." rules={[{ type: 'number', min: 0 }]}>
          <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={100} decimalSeparator="," precision={2} placeholder="Ex: 8000,00" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="metaReservaMeses" label="Meta de reserva (meses)" tooltip="Quantos meses de custo você quer ter guardados. 6 é o padrão recomendado.">
            <InputNumber style={{ width: '100%' }} min={1} max={36} />
          </Form.Item>
          <Form.Item name="reservaAtual" label="Já tenho guardado" tooltip="Quanto você já tem de reserva hoje.">
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={100} decimalSeparator="," precision={2} />
          </Form.Item>
        </div>
        <Form.Item name="rendimentoAnual" label="Rendimento esperado (% ao ano)" tooltip="Usado na projeção de patrimônio de 5 anos. Ex: 10% a.a. (renda fixa conservadora).">
          <InputNumber style={{ width: '100%' }} min={0} max={50} step={0.5} decimalSeparator="," precision={1} addonAfter="% a.a." />
        </Form.Item>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 4 }}>
          Tudo fica salvo só no seu app. A renda é a base de todos os cálculos — capriche nela.
        </div>
      </Form>
    </Modal>
  );
}
