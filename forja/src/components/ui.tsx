import React, { useEffect, useRef, useState } from 'react';
import { Typography, Button, App as AntApp } from 'antd';
import { Copy, Check } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

const { Text } = Typography;

// ─── copiar para a área de transferência (com fallback p/ iframe do GAS) ──────

export function copyText(texto: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(() => resolve(true)).catch(() => resolve(fallbackCopy(texto)));
        return;
      }
    } catch { /* usa fallback */ }
    resolve(fallbackCopy(texto));
  });
}

function fallbackCopy(texto: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// ─── CopyBlock — bloco de texto monoespaçado com botão copiar ─────────────────

interface CopyBlockProps {
  text: string;
  label?: string;
  maxHeight?: number;
  mono?: boolean;
}

export function CopyBlock({ text, label, maxHeight = 320, mono = true }: CopyBlockProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(text);
    if (ok) { setCopied(true); message.success('Copiado'); setTimeout(() => setCopied(false), 1600); }
    else message.error('Não foi possível copiar');
  };

  return (
    <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderRadius: 12, background: t.surfaceMuted }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${t.borderSoft}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{label}</span>
          <Button size="small" type="text" icon={copied ? <Check size={14} color={t.accents.sage} /> : <Copy size={14} />} onClick={onCopy}>{copied ? 'Copiado' : 'Copiar'}</Button>
        </div>
      )}
      {!label && (
        <Button size="small" type="text" icon={copied ? <Check size={14} color={t.accents.sage} /> : <Copy size={14} />} onClick={onCopy} style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }} />
      )}
      <pre style={{ margin: 0, padding: '14px 16px', maxHeight, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: mono ? FONTS.mono : FONTS.ui, fontSize: 12.5, lineHeight: 1.6, color: t.text }}>{text}</pre>
    </div>
  );
}

// ─── PageHeader — título serifado premium + subtítulo + ações ─────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 30, lineHeight: 1.1, margin: 0, color: t.text, letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {subtitle && (
          <Text style={{ color: t.textSecondary, fontSize: 14, display: 'block', marginTop: 6 }}>{subtitle}</Text>
        )}
      </div>
      {extra && <div className="forja-pageheader-extra" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{extra}</div>}
    </div>
  );
}

// ─── Panel — superfície base com borda fina e sombra suave ────────────────────

interface PanelProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

export function Panel({ children, title, extra, padding = 22, style, bodyStyle }: PanelProps): React.ReactElement {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        boxShadow: t.shadowSoft,
        ...style,
      }}
    >
      {(title || extra) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${t.borderSoft}` }}>
          <span style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 17, color: t.text }}>{title}</span>
          {extra}
        </div>
      )}
      <div style={{ padding, ...bodyStyle }}>{children}</div>
    </div>
  );
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

export function StatusDot({ color }: { color: string }): React.ReactElement {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

// ─── AreaChart — gráfico de área SVG leve (sem libs externas) ─────────────────

interface AreaChartProps {
  data: number[];
  labels?: string[];
  color: string;
  height?: number;
  showAxis?: boolean;
  animated?: boolean;
}

export function AreaChart({ data, labels, color, height = 200, showAxis = false, animated = true }: AreaChartProps): React.ReactElement {
  const t = useTokens();
  const w = 600;
  const h = height;
  const padX = showAxis ? 44 : 4;
  const padY = 12;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (w - padX - 8) / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${h - padY} L${points[0][0].toFixed(1)},${h - padY} Z`;
  const gid = `grad-${color.replace('#', '')}-${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block', animation: animated ? 'forjaReveal 0.9s cubic-bezier(0.22,1,0.36,1)' : undefined }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {showAxis && [0, 0.5, 1].map((f) => {
        const y = padY + f * (h - padY * 2);
        return <line key={f} x1={padX} y1={y} x2={w - 4} y2={y} stroke={t.borderSoft} strokeWidth="1" />;
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 3.5 : 0} fill={color} />
      ))}
      {showAxis && labels && labels.map((lb, i) => (
        <text key={i} x={padX + i * stepX} y={h - 1} fontSize="10" fill={t.textTertiary} textAnchor="middle" fontFamily={FONTS.ui}>{lb}</text>
      ))}
    </svg>
  );
}

// ─── Sparkline — mini gráfico para KPIs ───────────────────────────────────────

export function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }): React.ReactElement {
  return <AreaChart data={data.length ? data : [0, 0]} color={color} height={height} />;
}

export function formatBRL(v: number): string {
  // 2 casas decimais (padrão de moeda). Antes usava maximumFractionDigits: 0,
  // o que arredondava R$ 91,96 pra "R$ 92" e escondia os centavos — gerava
  // confusão ao atribuir (o valor "exato" aparecia diferente do exibido).
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── RingProgress — anel de progresso SVG (saúde, conclusão) ──────────────────

export function RingProgress({ value, size = 132, stroke = 11, color, label, sublabel }: { value: number; size?: number; stroke?: number; color: string; label?: string; sublabel?: string }): React.ReactElement {
  const t = useTokens();
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - v / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surfaceMuted} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONTS.display, fontSize: size * 0.26, fontWeight: 600, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{label ?? `${Math.round(v)}%`}</span>
        {sublabel && <span style={{ fontSize: 11.5, color: t.textTertiary, marginTop: 4 }}>{sublabel}</span>}
      </div>
    </div>
  );
}

// ─── Skeleton — bloco shimmer para estados de carregamento ────────────────────

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }): React.ReactElement {
  const t = useTokens();
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${t.surfaceMuted} 25%, ${t.border} 37%, ${t.surfaceMuted} 63%)`,
        backgroundSize: '200% 100%',
        animation: 'forjaShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ height = 132 }: { height?: number }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, height }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <Skeleton width={84} height={13} />
        <Skeleton width={30} height={30} radius={9} />
      </div>
      <Skeleton width={120} height={26} radius={6} />
      <div style={{ height: 14 }} />
      <Skeleton width="100%" height={30} />
    </div>
  );
}

// ─── CountUp — anima do 0 ao valor com ease-out cubic (não vibra no mount) ────

export function useCountUp(end: number, duration = 750): number {
  const [v, setV] = useState(end);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(end)) { setV(end); return; }
    startTimeRef.current = null;
    startValueRef.current = v;
    let raf = 0;
    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const t = Math.min(1, (now - startTimeRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(startValueRef.current + (end - startValueRef.current) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // intencional: animar quando o destino muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, duration]);
  return v;
}

export function CountBRL({ value, duration = 800 }: { value: number; duration?: number }): React.ReactElement {
  const v = useCountUp(value, duration);
  return <>{formatBRL(Math.round(v))}</>;
}

export function CountNumber({ value, duration = 700, suffix = '' }: { value: number; duration?: number; suffix?: string }): React.ReactElement {
  const v = useCountUp(value, duration);
  return <>{Math.round(v).toLocaleString('pt-BR')}{suffix}</>;
}

// ─── LiveDot — bolinha com anel de pulse (só "vive" quando online) ────────────

export function LiveDot({ color, live = true, size = 9 }: { color: string; live?: boolean; size?: number }): React.ReactElement {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {live && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: color, opacity: 0.55,
          animation: 'forjaPulseRing 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
        }} />
      )}
      <span style={{ width: size, height: size, borderRadius: '50%', background: color, position: 'relative' }} />
    </span>
  );
}

// ─── EmptyArt — vazio com personalidade: ícone grande pastel + frase + CTA ────

export function EmptyArt({ icon, titulo, descricao, acao }: { icon: React.ReactNode; titulo: string; descricao: string; acao?: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
        background: `linear-gradient(135deg, ${t.accents.peach}22, ${t.accents.sage}18)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: t.accents.clay,
      }}>{icon}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 500, color: t.text, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: t.textSecondary, maxWidth: 340, margin: '0 auto 14px' }}>{descricao}</div>
      {acao}
    </div>
  );
}
