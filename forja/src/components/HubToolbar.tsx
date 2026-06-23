// HubToolbar — v1.153.0
// Primitivos premium pra barra de ações dos hubs (Skills / Agents): chips de
// filtro com estado on/off claro e grupos de ação rotulados (dão "respiro" e
// dizem ao usuário o que cada cluster faz). Reaproveitado nos dois hubs.
import React from 'react';
import { Tooltip } from 'antd';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

// Chip de filtro de visualização (toggle). Estado ativo pinta com o accent.
export function FiltroChip({ active, onClick, icon, label, accent, title, fill }: {
  active: boolean;
  onClick: () => void;
  icon: (cor: string, filled: boolean) => React.ReactNode;
  label: string;
  accent: string;
  title?: string;
  fill?: boolean;
}): React.ReactElement {
  const t = useTokens();
  const cor = active ? accent : t.textSecondary;
  const btn = (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
        fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600,
        color: cor,
        background: active ? t.surface : 'transparent',
        border: `1px solid ${active ? `${accent}66` : 'transparent'}`,
        boxShadow: active ? t.shadowSoft : 'none',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon(cor, !!fill && active)}
      {label}
    </button>
  );
  return title ? <Tooltip title={title}>{btn}</Tooltip> : btn;
}

// Container dos chips (fundo discreto que agrupa visualmente os filtros).
export function ChipGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3,
      background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 11,
    }}>
      {children}
    </div>
  );
}

// Grupo de ações com rótulo em cima (discoverability + respiro). `accent`
// opcional pinta o rótulo pra destacar grupos especiais (ex.: Curadoria IA).
export function GrupoAcoes({ label, children, accent, icon }: {
  label: string;
  children: React.ReactNode;
  accent?: string;
  icon?: React.ReactNode;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: FONTS.ui, fontSize: 9.5, fontWeight: 700,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: accent || t.textTertiary, paddingLeft: 2,
      }}>
        {icon}
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  );
}

// Separador vertical sutil entre grupos.
export function GrupoDivisor(): React.ReactElement {
  const t = useTokens();
  return <div style={{ alignSelf: 'stretch', width: 1, background: t.borderSoft, margin: '0 2px' }} />;
}

// Casca do "command bar" (fundo + borda + respiro) que contém os grupos.
export function CommandBar({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap',
      padding: '14px 16px', borderRadius: 14,
      background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowSoft,
    }}>
      {children}
    </div>
  );
}
