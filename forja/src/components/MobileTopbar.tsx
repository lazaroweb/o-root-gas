import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';
import BrasaIndicator from './BrasaIndicator';
import { useForja } from '../themeContext';
import { FONTS } from '../theme';
import type { MeuAcesso } from '../types';

interface MobileTopbarProps {
  saudeMedia: number;
  naoLidos: number;
  usuario?: MeuAcesso | null;
  onMenuOpen: () => void;
  onSearchOpen: () => void;
  onAlertsOpen: () => void;
  onLogoClick?: () => void;
}

export const TOPBAR_HEIGHT = 56;

function TopbarAvatar({ usuario, onClick }: { usuario: MeuAcesso; onClick: () => void }): React.ReactElement {
  const { tokens: t } = useForja();
  const [imgErro, setImgErro] = React.useState(false);
  const nome = usuario.nome || (usuario.email ? usuario.email.split('@')[0] : 'Você');
  const iniciais = nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'F';
  const temFoto = !!usuario.foto && !imgErro;
  return (
    <button onClick={onClick} aria-label="Sua conta" style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', display: 'inline-flex' }}>
      {temFoto ? (
        <img
          src={usuario.foto}
          alt={nome}
          referrerPolicy="no-referrer"
          onError={() => setImgErro(true)}
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${t.border}` }}
        />
      ) : (
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${t.accents.peach}26`, color: t.accents.peach,
          fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600,
        }}>{iniciais}</span>
      )}
    </button>
  );
}

export default function MobileTopbar({ saudeMedia, naoLidos, usuario, onMenuOpen, onSearchOpen, onAlertsOpen, onLogoClick }: MobileTopbarProps): React.ReactElement {
  const { tokens: t } = useForja();
  const btn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, border: 'none',
    background: 'transparent', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: t.text,
  };
  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: TOPBAR_HEIGHT,
        background: t.sidebarBg, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', padding: '0 8px 0 4px',
        zIndex: 20,
      }}
    >
      <button onClick={onMenuOpen} style={btn} aria-label="Menu">
        <Menu size={22} strokeWidth={1.6} />
      </button>
      <button
        onClick={onLogoClick}
        title="Voltar pra página de abertura"
        style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px', flex: 1,
          border: 'none', background: 'transparent', cursor: onLogoClick ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, letterSpacing: '0.22em', color: t.text }}>FORJA</span>
        <BrasaIndicator marca size={8} qtdFagulhas={8} />
      </button>
      <button onClick={onSearchOpen} style={btn} aria-label="Buscar">
        <Search size={20} strokeWidth={1.6} />
      </button>
      <button onClick={onAlertsOpen} style={{ ...btn, position: 'relative' }} aria-label="Alertas">
        <Bell size={20} strokeWidth={1.6} />
        {naoLidos > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: t.accents.rose, color: '#fff',
            fontSize: 10, fontWeight: 700, fontFamily: FONTS.ui,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>{naoLidos > 99 ? '99+' : naoLidos}</span>
        )}
      </button>
      {usuario && usuario.autenticado && <TopbarAvatar usuario={usuario} onClick={onMenuOpen} />}
    </header>
  );
}
