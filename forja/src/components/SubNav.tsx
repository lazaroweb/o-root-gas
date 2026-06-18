// SubNav — sub-navegação vertical reutilizável (padrão "list-detail" /
// "sidebar navigation", estilo configurações do Linear/Notion).
//
// Resolve o problema das tabs horizontais que estouram/cortam quando há muitos
// itens ou rótulos longos. Em vez de uma barra que quebra em 2 linhas, usa uma
// coluna lateral fixa (sticky) com ícone + rótulo + contador + destaque por cor,
// e um cabeçalho contextual com a descrição da área ativa.
//
// Usado em: Atelier, Financeiro › Empresa, Financeiro › Pessoal.
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useForja, useTokens } from '../themeContext';
import { FONTS } from '../theme';

type AccentKey = keyof ReturnType<typeof useTokens>['accents'];

export interface SubNavItem<K extends string = string> {
  key: K;
  icon: LucideIcon;
  label: string;
  desc?: string;
  count?: number;
  accent?: AccentKey;
  badge?: string; // texto curto, ex: "novo"
  ia?: boolean; // mostra um ✦ ao lado do rótulo (features com IA)
  group?: string; // rótulo do grupo — quando muda, renderiza um cabeçalho leve
}

interface SubNavProps<K extends string> {
  items: SubNavItem<K>[];
  value: K;
  onChange: (key: K) => void;
  children: React.ReactNode; // conteúdo da área ativa (detail)
  width?: number;
  showHeader?: boolean;
  ariaLabel?: string;
}

export default function SubNav<K extends string>({
  items, value, onChange, children, width = 212, showHeader = true, ariaLabel = 'Navegação',
}: SubNavProps<K>): React.ReactElement {
  const t = useTokens();
  const { mode } = useForja();
  const ativa = items.find((i) => i.key === value) ?? items[0];
  const accentDe = (a?: AccentKey) => t.accents[a || 'peach'];

  return (
    <div className="forja-subnav-grid" style={{ display: 'grid', gridTemplateColumns: `${width}px 1fr`, gap: 22, alignItems: 'start' }}>
      <nav
        aria-label={ariaLabel}
        style={{
          position: 'sticky', top: 16,
          display: 'flex', flexDirection: 'column', gap: 2, padding: 6,
          background: mode === 'luz' ? '#FBF8F2' : '#1B1D21',
          border: `1px solid ${t.borderSoft}`, borderRadius: 14,
        }}
      >
        {items.map((n, idx) => {
          const active = n.key === value;
          const accentColor = accentDe(n.accent);
          const Icon = n.icon;
          // Cabeçalho de grupo: aparece quando o grupo muda em relação ao item anterior.
          const grupoAnterior = idx > 0 ? items[idx - 1].group : undefined;
          const mostraGrupo = !!n.group && n.group !== grupoAnterior;
          return (
            <React.Fragment key={n.key}>
            {mostraGrupo && (
              <div style={{
                fontFamily: FONTS.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: t.textTertiary,
                padding: idx === 0 ? '4px 11px 4px' : '12px 11px 4px',
              }}>
                {n.group}
              </div>
            )}
            <button
              onClick={() => onChange(n.key)}
              title={n.desc}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 11px', border: 'none', borderRadius: 10, cursor: 'pointer',
                background: active ? (mode === 'luz' ? '#F1ECE3' : '#26282C') : 'transparent',
                color: active ? t.text : t.textSecondary,
                fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: active ? 600 : 500,
                textAlign: 'left', transition: 'background 0.18s, color 0.18s',
              }}
              onMouseEnter={(ev) => { if (!active) ev.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
              onMouseLeave={(ev) => { if (!active) ev.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ display: 'inline-flex', color: active ? accentColor : t.textTertiary, transition: 'color 0.18s' }}>
                <Icon size={17} strokeWidth={active ? 1.9 : 1.6} />
              </span>
              <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>
                {n.ia && <span style={{ color: accentColor, fontSize: 11, lineHeight: 1 }}>✦</span>}
              </span>
              {n.badge && (
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.08em',
                  padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase',
                  background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`,
                }}>
                  {n.badge}
                </span>
              )}
              {typeof n.count === 'number' && n.count > 0 && (
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 11, color: active ? t.text : t.textTertiary,
                  background: active ? `${accentColor}22` : (mode === 'luz' ? '#EFEAE1' : '#26282C'),
                  borderRadius: 999, padding: '1px 7px', minWidth: 20, textAlign: 'center',
                }}>
                  {n.count}
                </span>
              )}
            </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div style={{ minWidth: 0 }}>
        {showHeader && ativa && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ color: accentDe(ativa.accent), display: 'inline-flex' }}>
                <ativa.icon size={18} strokeWidth={1.9} />
              </span>
              <h2 style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 500, margin: 0, color: t.text, letterSpacing: '-0.01em' }}>
                {ativa.label}{ativa.ia ? ' ✦' : ''}
              </h2>
            </div>
            {ativa.desc && (
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, paddingLeft: 28 }}>
                {ativa.desc}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
