import React from 'react';
import { Modal } from 'antd';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Atalho {
  keys: string[];
  label: string;
}

interface Grupo {
  titulo: string;
  itens: Atalho[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Navegação',
    itens: [
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'C'], label: 'Clientes' },
      { keys: ['G', 'I'], label: 'Ideias' },
      { keys: ['G', 'X'], label: 'Captura rápida de ideia (modal flutuante)' },
      { keys: ['G', 'S'], label: 'Sistemas' },
      { keys: ['G', 'O'], label: 'Operações' },
      { keys: ['G', 'F'], label: 'Financeiro' },
      { keys: ['G', 'A'], label: 'Forja AI' },
      { keys: ['G', 'R'], label: 'Relatórios' },
      { keys: ['G', 'V'], label: 'Atelier (skills, hospedagem, cofre)' },
      { keys: ['G', 'K'], label: 'Skills (modal de acesso rápido)' },
      { keys: ['G', ','], label: 'Configurações' },
    ],
  },
  {
    titulo: 'Geral',
    itens: [
      { keys: ['⌘', 'K'], label: 'Buscar / paleta de comandos' },
      { keys: ['?'], label: 'Abrir esta lista de atalhos' },
      { keys: ['N'], label: 'Criar novo (depende da tela)' },
      { keys: ['Esc'], label: 'Fechar modais' },
    ],
  },
];

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps): React.ReactElement {
  const t = useTokens();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      centered
      styles={{
        body: { padding: 0 },
        content: { background: t.surface, borderRadius: 18, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ padding: '28px 28px 4px' }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 24, margin: 0, color: t.text, letterSpacing: '-0.015em' }}>
          Atalhos de teclado
        </h2>
        <p style={{ color: t.textSecondary, marginTop: 8, marginBottom: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Aperte qualquer combinação pra navegar mais rápido. Pra ir a uma tela, segure <kbd style={kbdStyle(t)}>G</kbd> e depois a letra (ex.: <kbd style={kbdStyle(t)}>G</kbd> <kbd style={kbdStyle(t)}>D</kbd> → Dashboard).
        </p>
      </div>
      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 10 }}>
              {g.titulo}
            </div>
            {g.itens.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: `1px dashed ${t.borderSoft}`,
                }}
              >
                <span style={{ color: t.text, fontSize: 13 }}>{item.label}</span>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {item.keys.map((k, i) => (
                    <kbd key={i} style={kbdStyle(t)}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function kbdStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 24, height: 22, padding: '0 7px', borderRadius: 6,
    background: t.surfaceMuted, border: `1px solid ${t.border}`,
    fontFamily: FONTS.mono, fontSize: 11.5, color: t.textSecondary,
    boxShadow: `inset 0 -1px 0 ${t.border}`,
  };
}
