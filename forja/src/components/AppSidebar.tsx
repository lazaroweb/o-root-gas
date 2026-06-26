import React from 'react';
import { Tooltip } from 'antd';
import { FORJA_VERSION } from '../version';
import {
  LayoutDashboard,
  Users,
  Lightbulb,
  Boxes,
  Activity,
  Wallet,
  Sparkles,
  FileText,
  Settings,
  Search,
  Compass,
  Keyboard,
  Gem,
  Bell,
  Sun,
  Moon,
  GraduationCap,
} from 'lucide-react';
import BrasaIndicator from './BrasaIndicator';
import { useForja } from '../themeContext';
import { FONTS } from '../theme';
import type { ViewName, PapelAcesso, MeuAcesso } from '../types';

interface AppSidebarProps {
  currentView: ViewName;
  saudeMedia: number;
  papel?: PapelAcesso | null;
  usuario?: MeuAcesso | null;
  onNavigate: (view: ViewName) => void;
  onLogoClick?: () => void;
  onSearchOpen?: () => void;
  onGuideOpen?: () => void;
  onShortcutsOpen?: () => void;
  onAlertsOpen?: () => void;
  // No desktop, Guia/Alertas/Atalhos/Configurações ficam no menu de perfil
  // (canto superior direito), então o rodapé da sidebar esconde esses itens.
  // No mobile (sidebar dentro do drawer), eles continuam aqui.
  footerMenu?: boolean;
  naoLidos?: number;
  // v1.147 — badge na Ideias mostra inbox count (princípio "alerta sem ação proibido":
  // contagem visível convida a triar; sem ela, inbox acumula esquecido).
  ideiasInbox?: number;
}

const ITEMS: Array<{ key: ViewName; icon: React.ReactNode; label: string }> = [
  { key: 'dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.6} />, label: 'Dashboard' },
  { key: 'clientes', icon: <Users size={18} strokeWidth={1.6} />, label: 'Clientes' },
  // Ideias (v1.143.0): caixa única — fundiu Centelha (inbox bruto) com banco
  // maduro. Captura zero-fricção, triagem rica, lifecycle completo, modo foco.
  { key: 'ideias', icon: <Lightbulb size={18} strokeWidth={1.6} />, label: 'Ideias' },
  { key: 'sistemas', icon: <Boxes size={18} strokeWidth={1.6} />, label: 'Sistemas' },
  { key: 'operacoes', icon: <Activity size={18} strokeWidth={1.6} />, label: 'Ao vivo' },
  { key: 'financeiro', icon: <Wallet size={18} strokeWidth={1.6} />, label: 'Financeiro' },
  { key: 'forja-ia', icon: <Sparkles size={18} strokeWidth={1.6} />, label: 'Forja IA' },
  { key: 'atelier', icon: <Gem size={18} strokeWidth={1.6} />, label: 'Atelier' },
  { key: 'estudos', icon: <GraduationCap size={18} strokeWidth={1.6} />, label: 'Estudos' },
  { key: 'relatorios', icon: <FileText size={18} strokeWidth={1.6} />, label: 'Relatórios' },
];

export const SIDEBAR_WIDTH = 232;

export default function AppSidebar({ currentView, saudeMedia, papel, onNavigate, onLogoClick, onSearchOpen, onGuideOpen, onShortcutsOpen, onAlertsOpen, footerMenu = true, naoLidos = 0, ideiasInbox = 0 }: AppSidebarProps): React.ReactElement {
  const { mode, toggle, tokens: t } = useForja();
  // Enquanto o papel não chegou (null), assume admin (o owner é sempre admin).
  const isAdmin = papel ? papel === 'admin' : true;
  // Financeiro é sensível: visível só para Admin.
  const itensVisiveis = ITEMS.filter((it) => it.key !== 'financeiro' || isAdmin);

  const renderItem = (item: { key: ViewName; icon: React.ReactNode; label: string }) => {
    const active = currentView === item.key || (item.key === 'sistemas' && (currentView === 'sistema-detail' || currentView === 'sistema-form'));
    return (
      <button
        key={item.key}
        onClick={() => onNavigate(item.key)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '10px 12px',
          marginBottom: 2,
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          background: active ? (mode === 'luz' ? '#F1ECE3' : '#26282C') : 'transparent',
          color: active ? t.text : t.textSecondary,
          fontFamily: FONTS.ui,
          fontSize: 14,
          fontWeight: active ? 600 : 500,
          transition: 'background 0.18s, color 0.18s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span className={item.key === 'operacoes' ? 'forja-live-icon' : item.key === 'atelier' ? 'forja-gem-icon' : undefined} style={{ display: 'inline-flex', color: active ? t.accents.peach : t.textTertiary }}>{item.icon}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.key === 'ideias' && ideiasInbox > 0 && (
          <span
            title={`${ideiasInbox} ideia(s) no inbox aguardando triagem`}
            style={{
              minWidth: 18, height: 18, paddingInline: 6, borderRadius: 9,
              background: t.accents.peach, color: '#FFFFFF',
              fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ideiasInbox > 99 ? '99+' : ideiasInbox}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        width: SIDEBAR_WIDTH,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: t.sidebarBg,
        borderRight: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px 16px',
        zIndex: 10,
      }}
    >
      {/* Marca — wordmark editorial + filete dourado + brasa viva.
          Tratamento "Opção B": tipografia como herói, filete em gradiente
          peach→ember separa o wordmark da assinatura. Clicar no FORJA volta
          pra abertura. A brasa permanece como indicador vivo (atividade).
          Padding inferior generoso (36px) pra dar respiro entre a assinatura
          e o campo de busca — quietude antes do conteúdo começar. */}
      <div style={{ padding: '4px 8px 36px' }}>
        <button
          onClick={onLogoClick}
          title="Voltar pra página de abertura"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            border: 'none', background: 'transparent', padding: 0, margin: 0,
            cursor: onLogoClick ? 'pointer' : 'default',
          }}
        >
          <span
            style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, letterSpacing: '0.08em', color: t.text, transition: 'opacity 0.18s ease', lineHeight: 1 }}
            onMouseEnter={(e) => { if (onLogoClick) e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            FORJA
          </span>
          <BrasaIndicator marca size={9} qtdFagulhas={10} />
        </button>
        <div
          aria-hidden
          style={{
            height: 1.5,
            width: 60,
            background: `linear-gradient(90deg, ${t.accents.peach}, ${t.accents.peach}66 70%, transparent)`,
            borderRadius: 1,
            marginTop: 11,
          }}
        />
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: t.textTertiary,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            marginTop: 10,
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          Inteligência de Negócios
        </div>
      </div>

      {/* Busca */}
      <button
        onClick={onSearchOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', marginBottom: 16,
          border: `1px solid ${t.border}`, borderRadius: 10, cursor: 'pointer',
          background: mode === 'luz' ? '#FFFFFF' : '#1F2023', color: t.textTertiary, fontSize: 13,
        }}
      >
        <Search size={16} strokeWidth={1.6} />
        <span style={{ flex: 1, textAlign: 'left' }}>Buscar</span>
        <kbd style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, border: `1px solid ${t.border}`, borderRadius: 5, padding: '1px 5px' }}>⌘K</kbd>
      </button>

      {/* Navegação */}
      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {itensVisiveis.map(renderItem)}
      </nav>

      {/* Rodapé. Tema e Atalhos ficam SEMPRE aqui (desktop + mobile). No
          desktop (footerMenu=false), Guia/Alertas/Configurações vivem no menu
          de perfil (canto superior direito — ver TopRightControls); no mobile,
          a sidebar mora no drawer, então também aparecem aqui. */}
      <div style={{ borderTop: `1px solid ${t.borderSoft}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {footerMenu && (
          <>
            <button
              onClick={onGuideOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
                border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent',
                color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14, fontWeight: 500, textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ display: 'inline-flex', color: t.textTertiary }}><Compass size={18} strokeWidth={1.6} /></span>
              Guia de início
            </button>
            <button
              onClick={onAlertsOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
                border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent',
                color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14, fontWeight: 500, textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ display: 'inline-flex', position: 'relative', color: t.textTertiary }}>
                <Bell size={18} strokeWidth={1.6} />
                {naoLidos > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -5, minWidth: 16, height: 16, padding: '0 4px',
                    borderRadius: 8, background: t.accents.rose, color: '#fff',
                    fontSize: 10, fontWeight: 700, fontFamily: FONTS.ui,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>{naoLidos > 99 ? '99+' : naoLidos}</span>
                )}
              </span>
              <span style={{ flex: 1 }}>Alertas</span>
            </button>
          </>
        )}

        <Tooltip title="Atalhos de teclado" placement="right">
          <button
            onClick={onShortcutsOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
              border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent',
              color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14, fontWeight: 500, textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'inline-flex', color: t.textTertiary }}><Keyboard size={18} strokeWidth={1.6} /></span>
            <span style={{ flex: 1 }}>Atalhos</span>
            <kbd style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, border: `1px solid ${t.border}`, borderRadius: 5, padding: '1px 5px' }}>?</kbd>
          </button>
        </Tooltip>

        <button
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
            border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent',
            color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14, fontWeight: 500, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ display: 'inline-flex', color: t.textTertiary }}>
            {mode === 'luz' ? <Moon size={18} strokeWidth={1.6} /> : <Sun size={18} strokeWidth={1.6} />}
          </span>
          <span style={{ flex: 1 }}>{mode === 'luz' ? 'Modo noturno' : 'Modo claro'}</span>
        </button>

        {footerMenu && isAdmin && renderItem({ key: 'configuracoes', icon: <Settings size={18} strokeWidth={1.6} />, label: 'Configurações' })}

        {/* ─── Versão do app (discreto) ─────────────────────────────────────
            Indica em qual versão o user está. Útil pra reports de bug e pra
            saber se vale dar refresh depois de um deploy. Mostra v + numero,
            tooltip com link mental pro CHANGELOG. */}
        <Tooltip
          title={`Versão atual do app. Pra rollback: npm run rollback -- <numero>`}
          placement="right"
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              color: t.textTertiary,
              padding: '6px 12px 2px',
              letterSpacing: 0.3,
              opacity: 0.6,
              userSelect: 'all',
              cursor: 'default',
            }}
          >
            v{FORJA_VERSION}
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
