import React from 'react';
import { Typography } from 'antd';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

const { Text } = Typography;

interface ComingSoonProps {
  icon: React.ReactNode;
  title: string;
  fase: string;
  descricao: string;
  itens: string[];
}

export default function ComingSoon({ icon, title, fase, descricao, itens }: ComingSoonProps): React.ReactElement {
  const t = useTokens();
  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 760, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 18,
          boxShadow: t.shadowSoft,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 18, background: `${t.accents.peach}1f`, color: t.accents.peach, marginBottom: 20 }}>
          {icon}
        </span>
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 28, margin: 0, color: t.text }}>{title}</h1>
        <div style={{ display: 'inline-block', marginTop: 10, padding: '3px 12px', borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary, fontSize: 12, fontWeight: 500 }}>{fase}</div>
        <Text style={{ display: 'block', color: t.textSecondary, fontSize: 15, marginTop: 16, maxWidth: 480, marginInline: 'auto', lineHeight: 1.6 }}>{descricao}</Text>

        <div style={{ marginTop: 28, textAlign: 'left', maxWidth: 440, marginInline: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {itens.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: t.surfaceMuted, color: t.text, fontSize: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accents.peach, flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
