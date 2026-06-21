import React from 'react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

export interface ContextCardOption {
  value: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}

interface Props {
  options: ContextCardOption[];
  value: string;
  onChange: (v: string) => void;
  /** Largura mínima de cada card antes de quebrar linha. */
  minWidth?: number;
}

/**
 * Seletor de contexto em cartões: cada opção mostra ícone + título + uma linha
 * explicando o que ela faz, pra que a pessoa entenda a feature antes de escolher.
 * O cartão selecionado acende no accent (borda + tint + ícone preenchido).
 */
export default function ContextCards({ options, value, onChange, minWidth = 160 }: Props): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: 10 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={sel}
            style={{
              textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '11px 13px',
              borderRadius: 13,
              cursor: 'pointer',
              background: sel ? `${o.accent}14` : t.surface,
              border: `1.5px solid ${sel ? `${o.accent}99` : t.border}`,
              boxShadow: sel ? `0 4px 14px ${o.accent}26` : t.shadowSoft,
              transition: 'border-color 0.16s, transform 0.16s, box-shadow 0.16s, background 0.16s',
            }}
            onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = `${o.accent}66`; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'none'; } }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: sel ? o.accent : `${o.accent}1f`, color: sel ? '#fff' : o.accent, transition: 'background 0.16s, color 0.16s' }}>
                {o.icon}
              </span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: sel ? t.text : t.textSecondary }}>{o.label}</span>
            </span>
            <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, lineHeight: 1.45, color: t.textTertiary }}>{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
