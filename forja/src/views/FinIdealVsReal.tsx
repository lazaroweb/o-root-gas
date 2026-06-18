// FinIdealVsReal — a seção que CRUZA o Perfil ideal com o gasto real.
//
// Premium e leve, em dois recortes (pílulas):
//   • Comparáveis  — categorias que têm alvo no ideal: real × alvo, com status.
//   • Fora do ideal — gastos sem alvo: cada um com um "de-para" (mapear pra uma
//     categoria do ideal, cortar, ou manter fora). A IA sugere tudo isso.
//
// A comparação só acontece no que é equivalente ao ideal; o resto fica explícito
// como "fora do ideal" pra você cortar ou adequar.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Select, App as AntApp, Empty, Tag, Tooltip,
} from 'antd';
import {
  Scale, Sparkles, Target, Scissors, ArrowRight, CheckCircle2, Wand2, Home,
  Route, PiggyBank, TrendingDown,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type {
  IdealComparativo, IdealComparavelLinha, IdealForaLinha, IdealAnaliseIA,
  PlanoIdealResumo, OfensorIdeal, PlanoIdealRegistro,
  CategoriaPessoal, ServerResponse,
} from '../types';

// Render leve de markdown (negrito + listas) sem dependência.
function renderRich(content: string, t: ReturnType<typeof useTokens>): React.ReactNode {
  return content.split('\n').map((linha, i) => {
    const inline = (txt: string) => txt.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p) ? <strong key={j}>{p.slice(2, -2)}</strong> : <React.Fragment key={j}>{p}</React.Fragment>);
    if (/^\s*[-*]\s+/.test(linha)) {
      return <div key={i} style={{ display: 'flex', gap: 8, margin: '2px 0' }}><span style={{ color: t.accents.peach }}>•</span><span>{inline(linha.replace(/^\s*[-*]\s+/, ''))}</span></div>;
    }
    if (!linha.trim()) return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ margin: '2px 0' }}>{inline(linha)}</div>;
  });
}

export default function FinIdealVsReal({ categorias, aba }: {
  categorias: CategoriaPessoal[];
  aba: 'comparaveis' | 'fora' | 'plano';
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<IdealComparativo | null>(null);
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState<IdealAnaliseIA | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const recarregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<IdealComparativo>>('getIdealComparativo')
      .then((r) => { if (r.ok && r.data) setData(r.data as IdealComparativo); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(recarregar, [recarregar]);

  const catLabel = useCallback((slug: string): string => {
    const c = categorias.find((x) => x.nome === slug);
    if (c) return c.label;
    return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Outros';
  }, [categorias]);

  const setDestino = (categoriaReal: string, destino: string) => {
    callServer<ServerResponse<unknown>>('salvarDeParaIdeal', categoriaReal, destino)
      .then((r) => { if (r.ok) recarregar(); else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Erro ao classificar'));
  };

  const analisar = () => {
    setAnalisando(true);
    setAnalise(null);
    message.loading({ content: 'A IA está relacionando suas categorias…', key: 'ia', duration: 0 });
    callServer<ServerResponse<IdealAnaliseIA>>('analisarIdealIA')
      .then((r) => {
        message.destroy('ia');
        if (r.ok && r.data) setAnalise(r.data as IdealAnaliseIA);
        else message.error(r.error || 'Erro ao analisar');
      })
      .catch(() => { message.destroy('ia'); message.error('Erro ao analisar (rode no app publicado)'); })
      .finally(() => setAnalisando(false));
  };

  const aplicarSugestoes = () => {
    if (!analise) return;
    setAplicando(true);
    callServer<ServerResponse<unknown>>('salvarDeParaIdealLote', analise.mapeamentos)
      .then((r) => { if (r.ok) { message.success('Sugestões aplicadas'); setAnalise(null); recarregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Erro ao aplicar'))
      .finally(() => setAplicando(false));
  };

  if (loading && !data) {
    return <Panel padding={40}><div style={{ textAlign: 'center', color: t.textTertiary }}>Carregando comparação…</div></Panel>;
  }
  if (!data) return <Panel padding={40}><Empty description="Sem dados ainda" /></Panel>;

  if (!data.temIdeal) {
    return (
      <Panel padding={0}>
        <div style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 18px', background: `${t.accents.sage}18`, color: t.accents.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home size={28} strokeWidth={1.6} />
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 500, color: t.text, marginBottom: 8 }}>Monte seu Perfil ideal primeiro</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
            A comparação só faz sentido quando você já definiu o destino. Volte na aba <strong>Meu ideal</strong>,
            construa seu orçamento-alvo e retorne aqui — a IA cruza tudo e mostra o que regular.
          </div>
        </div>
      </Panel>
    );
  }

  const opcoesDestino = [
    ...data.idealCategorias.map((c) => ({ value: c, label: `→ ${catLabel(c)}` })),
    { value: 'cortar', label: '✂ Cortar (não-estrutural)' },
    { value: 'fora', label: 'Manter fora do ideal' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {aba !== 'plano' && <Hero data={data} onAnalisar={analisar} analisando={analisando} />}

      {aba !== 'plano' && analise && (
        <Panel padding={18} title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wand2 size={15} color={t.accents.lavender} /><span>Sugestão da IA</span></div>}
          extra={<Button type="primary" size="small" icon={<CheckCircle2 size={14} />} loading={aplicando} onClick={aplicarSugestoes} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>Aplicar {analise.mapeamentos.length} sugestão(ões)</Button>}>
          {analise.resumo && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, lineHeight: 1.6, marginBottom: analise.mapeamentos.length ? 14 : 0 }}>
              {renderRich(analise.resumo, t)}
            </div>
          )}
          {analise.mapeamentos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {analise.mapeamentos.map((m, i) => {
                const cortar = m.destino === 'cortar';
                const fora = m.destino === 'fora';
                const cor = cortar ? t.accents.rose : fora ? t.textTertiary : t.accents.sage;
                return (
                  <Tooltip key={i} title={m.motivo}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                      {catLabel(m.categoriaReal)} <ArrowRight size={12} color={cor} /> <span style={{ color: cor }}>{cortar ? 'cortar' : fora ? 'fora' : catLabel(m.destino)}</span>
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {aba === 'plano' ? (
        <PlanoIdeal catLabel={catLabel} />
      ) : aba === 'comparaveis' ? (
        <Panel padding={18} title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={15} color={t.accents.sage} /><span>Real × alvo</span></div>}
          extra={<span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>barra = real · marca = alvo</span>}>
          {data.comparaveis.length === 0 ? (
            <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 13 }}>Nada pra comparar ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.comparaveis.map((l) => <LinhaComparavel key={l.categoria} l={l} catLabel={catLabel} />)}
            </div>
          )}
        </Panel>
      ) : (
        <Panel padding={18} title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scissors size={15} color={t.accents.rose} /><span>Fora do ideal</span></div>}
          extra={data.totalCortar > 0 ? <Tag color="red" style={{ marginInlineEnd: 0 }}>a cortar: {formatBRL(data.totalCortar)}/mês</Tag> : null}>
          {data.foraDoIdeal.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 13 }}>
              <CheckCircle2 size={16} color={t.accents.sage} /> Todo o seu gasto já está mapeado no ideal. 👏
            </div>
          ) : (
            <>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 12 }}>
                Pra cada gasto sem alvo, diga o destino: mapear numa categoria do ideal, cortar, ou manter fora.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.foraDoIdeal.map((f) => <LinhaFora key={f.categoriaReal} f={f} catLabel={catLabel} opcoes={opcoesDestino} onChange={setDestino} />)}
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ data, onAnalisar, analisando }: { data: IdealComparativo; onAnalisar: () => void; analisando: boolean }): React.ReactElement {
  const t = useTokens();
  const diff = data.totalRealComparavel - data.totalIdeal;
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, padding: '20px 24px', boxShadow: t.shadowSoft, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <Stat icon={<Target size={16} />} label="Alvo (ideal)" valor={formatBRL(data.totalIdeal)} cor={t.accents.sage} />
      <DivV />
      <Stat icon={<Scale size={16} />} label="Real comparável" valor={formatBRL(data.totalRealComparavel)} cor={diff <= 0 ? t.accents.sage : t.accents.peach}
        sub={diff <= 0 ? `${formatBRL(Math.abs(diff))} abaixo do alvo` : `${formatBRL(diff)} acima do alvo`} />
      <DivV />
      <Stat icon={<Scissors size={16} />} label="Fora do ideal" valor={formatBRL(data.totalFora)} cor={t.accents.rose}
        sub={`${data.qtdFora} categoria(s)${data.totalCortar > 0 ? ` · cortar ${formatBRL(data.totalCortar)}` : ''}`} />
      <div style={{ flex: 1, minWidth: 12 }} />
      <Button type="primary" icon={<Sparkles size={15} />} loading={analisando} onClick={onAnalisar} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>
        Analisar com IA
      </Button>
    </div>
  );
}

function Stat({ icon, label, valor, sub, cor }: { icon: React.ReactNode; label: string; valor: string; sub?: string; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ color: cor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, letterSpacing: 0.3, color: t.textTertiary, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DivV(): React.ReactElement {
  const t = useTokens();
  return <div style={{ width: 1, alignSelf: 'stretch', minHeight: 40, background: t.borderSoft }} />;
}

// ─── Linhas ───────────────────────────────────────────────────────────────────

function statusInfo(status: string, t: ReturnType<typeof useTokens>): { cor: string; rotulo: string } {
  switch (status) {
    case 'dentro': return { cor: t.accents.sage, rotulo: 'Dentro do alvo' };
    case 'atencao': return { cor: t.accents.peach, rotulo: 'Pouco acima' };
    case 'acima': return { cor: t.accents.rose, rotulo: 'Acima do alvo' };
    case 'sem_gasto': return { cor: t.textTertiary, rotulo: 'Ainda sem gasto' };
    default: return { cor: t.textTertiary, rotulo: status };
  }
}

function LinhaComparavel({ l, catLabel }: { l: IdealComparavelLinha; catLabel: (s: string) => string }): React.ReactElement {
  const t = useTokens();
  const { cor, rotulo } = statusInfo(l.status, t);
  const escala = Math.max(l.ideal, l.real, 1);
  const pctReal = (l.real / escala) * 100;
  const pctIdeal = (l.ideal / escala) * 100;
  const fontesExtra = l.fontes.filter((f) => f.categoriaReal !== l.categoria);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
          {catLabel(l.categoria)}
          <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: cor }}>· {rotulo}</span>
          {fontesExtra.length > 0 && (
            <Tooltip title={`Inclui: ${fontesExtra.map((f) => catLabel(f.categoriaReal)).join(', ')}`}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, background: t.surfaceMuted, padding: '0 6px', borderRadius: 6 }}>+{fontesExtra.length}</span>
            </Tooltip>
          )}
        </span>
        <span style={{ fontFamily: FONTS.display, fontSize: 12.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
          {formatBRL(l.real)} <span style={{ color: t.textTertiary, fontSize: 11 }}>/ alvo {formatBRL(l.ideal)}</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 9, background: t.surfaceMuted, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, pctReal)}%`, background: cor, opacity: 0.85, borderRadius: 5 }} />
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `calc(${Math.min(100, pctIdeal)}% - 1px)`, width: 2, background: t.text, opacity: 0.55 }} title={`Alvo: ${formatBRL(l.ideal)}`} />
      </div>
    </div>
  );
}

// ─── Plano do real ao ideal ───────────────────────────────────────────────────

function tipoOfensor(tipo: string, t: ReturnType<typeof useTokens>): { cor: string; rotulo: string } {
  switch (tipo) {
    case 'cortar': return { cor: t.accents.rose, rotulo: 'Cortar' };
    case 'adequar': return { cor: t.accents.peach, rotulo: 'Adequar' };
    case 'extra': return { cor: t.accents.clay, rotulo: 'Extra' };
    case 'rever': return { cor: t.accents.blue, rotulo: 'Classificar' };
    default: return { cor: t.textTertiary, rotulo: tipo };
  }
}

function PlanoIdeal({ catLabel }: { catLabel: (s: string) => string }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [resumo, setResumo] = useState<PlanoIdealResumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [plano, setPlano] = useState<PlanoIdealRegistro | null>(null);

  const recarregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<PlanoIdealResumo>>('getPlanoIdealResumo')
      .then((r) => { if (r.ok && r.data) { const d = r.data as PlanoIdealResumo; setResumo(d); setPlano(d.ultimoPlano); } })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(recarregar, [recarregar]);

  const gerar = () => {
    setGerando(true);
    message.loading({ content: 'A IA está montando seu roteiro…', key: 'plano', duration: 0 });
    callServer<ServerResponse<PlanoIdealRegistro>>('gerarPlanoIdealIA')
      .then((r) => {
        message.destroy('plano');
        if (r.ok && r.data) { setPlano(r.data as PlanoIdealRegistro); message.success('Plano gerado!'); }
        else message.error(r.error || 'Erro ao gerar plano');
      })
      .catch(() => { message.destroy('plano'); message.error('Erro ao gerar (rode no app publicado)'); })
      .finally(() => setGerando(false));
  };

  if (loading && !resumo) {
    return <Panel padding={40}><div style={{ textAlign: 'center', color: t.textTertiary }}>Calculando distância até o ideal…</div></Panel>;
  }
  if (!resumo) return <Panel padding={40}><Empty description="Sem dados" /></Panel>;

  const pct = Math.round(resumo.pctAlinhado * 100);
  const noIdeal = resumo.gap <= 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Resumo determinístico */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, padding: '20px 24px', boxShadow: t.shadowSoft, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 220 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `conic-gradient(${t.accents.sage} 0 ${pct}%, ${t.surfaceMuted} ${pct}% 100%)`, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text }}>{pct}%</div>
          </div>
          <div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.5, color: t.textTertiary, textTransform: 'uppercase' }}>Alinhado ao ideal</div>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: noIdeal ? t.accents.sage : t.text, lineHeight: 1.2, marginTop: 2 }}>
              {noIdeal ? 'No ideal 🎯' : 'Em ajuste'}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <Stat icon={<TrendingDown size={16} />} label="Distância até o ideal" valor={formatBRL(resumo.gap)} cor={resumo.gap > 0 ? t.accents.rose : t.accents.sage} sub="por mês" />
          <DivV />
          <Stat icon={<Scissors size={16} />} label="Economia potencial" valor={formatBRL(resumo.economiaPotencial)} cor={t.accents.peach} sub={`${formatBRL(resumo.economiaPotencial * 12)}/ano`} />
          <DivV />
          <Stat icon={<PiggyBank size={16} />} label="Sobra no ideal" valor={resumo.rendaConfigurada ? formatBRL(resumo.sobraNoIdeal) : '—'} cor={resumo.sobraNoIdeal >= 0 ? t.accents.sage : t.accents.rose} sub={resumo.rendaConfigurada ? 'por mês' : 'configure a renda na Norte'} />
        </div>
      </div>

      {/* Maiores ofensores */}
      <Panel padding={18} title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={15} color={t.accents.peach} /><span>Maiores ofensores</span></div>}>
        {resumo.ofensores.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 13 }}>
            <CheckCircle2 size={16} color={t.accents.sage} /> Você já está no ideal — nada a regular. 👏
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resumo.ofensores.slice(0, 8).map((o) => <LinhaOfensor key={o.categoria + o.tipo} o={o} catLabel={catLabel} />)}
          </div>
        )}
      </Panel>

      {/* Plano IA */}
      <Panel padding={18}
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Route size={15} color={t.accents.lavender} /><span>Roteiro por fases (IA)</span></div>}
        extra={<Button type="primary" size="small" icon={<Sparkles size={14} />} loading={gerando} disabled={resumo.ofensores.length === 0} onClick={gerar} style={{ background: t.accents.lavender, borderColor: t.accents.lavender }}>{plano ? 'Gerar de novo' : 'Gerar plano'}</Button>}>
        {!plano ? (
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
            A IA sequencia os cortes e ajustes em fases mensais realistas (quick wins primeiro) até você chegar no ideal. Clique em <strong>Gerar plano</strong>.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text, lineHeight: 1.65 }}>{renderRich(plano.texto, t)}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary, marginTop: 12 }}>
              {plano.modelo} · {new Date(plano.criadoEm).toLocaleString('pt-BR')}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function LinhaOfensor({ o, catLabel }: { o: OfensorIdeal; catLabel: (s: string) => string }): React.ReactElement {
  const t = useTokens();
  const { cor, rotulo } = tipoOfensor(o.tipo, t);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
      <span style={{ fontFamily: FONTS.ui, fontSize: 10, fontWeight: 600, color: cor, background: `${cor}1c`, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{rotulo}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text }}>{catLabel(o.categoria)}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
          {o.tipo === 'adequar' ? `gasta ${formatBRL(o.atual)} · alvo ${formatBRL(o.alvo)}` : `gasta ${formatBRL(o.atual)}`}
        </div>
      </div>
      <span style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.accents.sage, fontVariantNumeric: 'tabular-nums' }}>−{formatBRL(o.economia)}<span style={{ fontSize: 11, color: t.textTertiary }}>/mês</span></span>
    </div>
  );
}

function LinhaFora({ f, catLabel, opcoes, onChange }: {
  f: IdealForaLinha; catLabel: (s: string) => string;
  opcoes: Array<{ value: string; label: string }>; onChange: (cr: string, destino: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const corBorda = f.destino === 'cortar' ? t.accents.rose : t.borderSoft;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: t.surfaceMuted, border: `1px solid ${corBorda}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text }}>{catLabel(f.categoriaReal)}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
          {f.destino === 'cortar' ? 'marcado pra cortar' : f.destino === 'fora' ? 'mantido fora do ideal' : 'sem destino — classifique'}
        </div>
      </div>
      <span style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(f.real)}<span style={{ fontSize: 11, color: t.textTertiary }}>/mês</span></span>
      <Select
        size="small"
        style={{ width: 210 }}
        placeholder="Destino…"
        value={f.destino || undefined}
        options={opcoes}
        onChange={(v) => onChange(f.categoriaReal, String(v))}
        allowClear
        onClear={() => onChange(f.categoriaReal, '')}
      />
    </div>
  );
}
