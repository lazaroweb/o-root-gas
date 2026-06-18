// Controle do canto superior direito (desktop): menu de conta. O cartão de
// perfil é um menu (dropdown) que concentra Guia de início, Alertas e
// Configurações. Tema e Atalhos ficam no rodapé da barra lateral.
import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Compass, Bell, Settings, ChevronDown } from 'lucide-react';
import { useForja } from '../themeContext';
import { FONTS } from '../theme';
import type { MeuAcesso, PapelAcesso } from '../types';

const PAPEL_LABEL: Record<PapelAcesso, string> = {
  admin: 'Admin',
  operacional: 'Operacional',
  leitor: 'Leitor',
};

interface ProfileMenuProps {
  usuario: MeuAcesso;
  naoLidos: number;
  isAdmin: boolean;
  onGuide: () => void;
  onAlerts: () => void;
  onConfig: () => void;
}

function ProfilePill({ usuario, naoLidos, isAdmin, onGuide, onAlerts, onConfig }: ProfileMenuProps): React.ReactElement {
  const { tokens: t } = useForja();
  const [imgErro, setImgErro] = React.useState(false);
  const [aberto, setAberto] = React.useState(false);
  const nome = usuario.nome || (usuario.email ? usuario.email.split('@')[0] : 'Você');
  const iniciais = nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'F';
  const temFoto = !!usuario.foto && !imgErro;
  const papelLabel = usuario.papel ? PAPEL_LABEL[usuario.papel] : null;

  const itemLabel = (texto: string, badge?: number) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150, justifyContent: 'space-between' }}>
      <span>{texto}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: t.accents.rose, color: '#fff', fontSize: 10.5, fontWeight: 700,
          fontFamily: FONTS.ui, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </span>
  );

  const items: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div style={{ padding: '2px 0 6px' }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{nome}</div>
          {usuario.email && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{usuario.email}</div>}
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'guia', icon: <Compass size={15} strokeWidth={1.7} />, label: itemLabel('Guia de início') },
    { key: 'alertas', icon: <Bell size={15} strokeWidth={1.7} />, label: itemLabel('Alertas', naoLidos) },
    ...(isAdmin ? [{ type: 'divider' as const }, { key: 'config', icon: <Settings size={15} strokeWidth={1.7} />, label: itemLabel('Configurações') }] : []),
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    setAberto(false);
    if (key === 'guia') onGuide();
    else if (key === 'alertas') onAlerts();
    else if (key === 'config') onConfig();
  };

  return (
    <Dropdown
      open={aberto}
      onOpenChange={setAberto}
      trigger={['click']}
      placement="bottomRight"
      menu={{ items, onClick }}
    >
      <button
        aria-label="Sua conta"
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '5px 8px 5px 6px', borderRadius: 999,
          background: t.surface, border: `1px solid ${t.border}`,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)', maxWidth: 250, cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${t.accents.peach}80`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          {temFoto ? (
            <img
              src={usuario.foto}
              alt={nome}
              referrerPolicy="no-referrer"
              onError={() => setImgErro(true)}
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${t.accents.peach}26`, color: t.accents.peach,
              fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600,
            }}>{iniciais}</div>
          )}
          {naoLidos > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: t.accents.rose, color: '#fff',
              fontSize: 10, fontWeight: 700, fontFamily: FONTS.ui,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              border: `2px solid ${t.surface}`,
            }}>{naoLidos > 99 ? '99+' : naoLidos}</span>
          )}
        </span>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nome}
          </span>
          {papelLabel && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {papelLabel}
            </span>
          )}
        </div>
        <ChevronDown size={15} strokeWidth={1.8} style={{ color: t.textTertiary, flexShrink: 0, transition: 'transform 0.18s', transform: aberto ? 'rotate(180deg)' : 'none' }} />
      </button>
    </Dropdown>
  );
}

interface TopRightControlsProps {
  usuario?: MeuAcesso | null;
  naoLidos?: number;
  isAdmin?: boolean;
  onGuide: () => void;
  onAlerts: () => void;
  onConfig: () => void;
}

export default function TopRightControls({ usuario, naoLidos = 0, isAdmin = true, onGuide, onAlerts, onConfig }: TopRightControlsProps): React.ReactElement {
  return (
    <div style={{
      position: 'fixed', top: 14, right: 22, zIndex: 30,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {usuario && usuario.autenticado && (
        <ProfilePill
          usuario={usuario}
          naoLidos={naoLidos}
          isAdmin={isAdmin}
          onGuide={onGuide}
          onAlerts={onAlerts}
          onConfig={onConfig}
        />
      )}
    </div>
  );
}
