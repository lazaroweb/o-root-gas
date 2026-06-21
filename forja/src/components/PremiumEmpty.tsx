import React from 'react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
}

/**
 * Estado vazio premium: ícone com brilho ambiente, título em Fraunces e um
 * subtítulo curto. Substitui o <Empty> genérico dando uma cara acolhedora.
 */
export default function PremiumEmpty({ icon, title, subtitle, accent, action }: Props): React.ReactElement {
  const t = useTokens();
  const cor = accent || t.accents.peach;
  return (
    <div style={{ textAlign: 'center', padding: '44px 24px' }}>
      <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 16 }}>
        <span aria-hidden style={{ position: 'absolute', inset: -18, borderRadius: '50%', background: `radial-gradient(circle, ${cor}, transparent 66%)`, opacity: 0.16, filter: 'blur(18px)' }} />
        <span style={{ position: 'relative', width: 56, height: 56, borderRadius: 17, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${cor}26, ${cor}10)`, border: `1px solid ${cor}3a`, color: cor, boxShadow: t.shadowSoft }}>
          {icon}
        </span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text, marginBottom: 6, letterSpacing: '-0.01em' }}>{title}</div>
      {subtitle && <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, maxWidth: 440, margin: '0 auto', lineHeight: 1.55 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
