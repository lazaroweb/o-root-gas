import React, { useState } from 'react';
import { Typography, Tooltip } from 'antd';
import { Info, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useTokens } from '../themeContext';
import { Sparkline } from './ui';
import { FONTS } from '../theme';

const { Text } = Typography;

export interface StatDelta {
  pct: number;        // variação percentual (pode ser negativa)
  positivo: boolean;  // se a variação é "boa" para este KPI
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  series?: number[];
  hint?: string;
  tooltip?: string;
  delta?: StatDelta | null;
}

export default function StatCard({ label, value, icon, accent, series, hint, tooltip, delta }: StatCardProps): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);

  const deltaColor = !delta ? t.textTertiary : delta.positivo ? t.accents.sage : t.accents.rose;
  const DeltaIcon = !delta || delta.pct === 0 ? Minus : delta.pct > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: `linear-gradient(140deg, ${accent}14 0%, ${accent}05 22%, ${t.surface} 48%)`,
        border: `1px solid ${hover ? `${accent}55` : t.border}`,
        borderRadius: 16,
        boxShadow: hover ? t.shadow : t.shadowSoft,
        padding: 20,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* fio de luz no topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)`, opacity: hover ? 0.9 : 0.45, transition: 'opacity 0.2s ease' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: 500 }}>{label}</Text>
          {tooltip && (
            <Tooltip title={tooltip} placement="top">
              <Info size={13} strokeWidth={1.8} color={t.textTertiary} style={{ cursor: 'help', display: 'block' }} />
            </Tooltip>
          )}
        </span>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 9, background: `${accent}1f`, color: accent,
          }}
        >
          {icon}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 500, color: t.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {delta && (
          <Tooltip title="Comparado ao mês anterior">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: deltaColor, background: `${deltaColor}16`, borderRadius: 999, padding: '2px 7px' }}>
              <DeltaIcon size={12} strokeWidth={2.2} />
              {Math.abs(delta.pct)}%
            </span>
          </Tooltip>
        )}
      </div>

      <div style={{ marginTop: 'auto' }}>
        {series && series.length > 1 ? (
          <Sparkline data={series} color={accent} height={36} />
        ) : (
          hint && <Text style={{ color: t.textTertiary, fontSize: 12 }}>{hint}</Text>
        )}
      </div>
    </div>
  );
}
