// BacklogDrawer — wraps BacklogPanel num Drawer full-screen.
//
// O painel inline dentro do SistemaDetail fica espremido pelo container do
// sistema (sidebar + paddings). Pra um Kanban funcionar bem precisa de espaço
// horizontal pras 5 colunas respirarem. Esse Drawer abre em 96% da viewport
// e oferece a experiência completa de gestão de backlog.
import React from 'react';
import { Drawer, Tag } from 'antd';
import { Layers } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import BacklogPanel from '../views/BacklogPanel';

interface BacklogDrawerProps {
  sistemaId: string;
  sistemaNome: string;
  open: boolean;
  onClose: () => void;
}

export default function BacklogDrawer({ sistemaId, sistemaNome, open, onClose }: BacklogDrawerProps): React.ReactElement {
  const t = useTokens();
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={18} color={t.accents.peach} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Backlog Kanban</span>
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>{sistemaNome}</Tag>
        </div>
      }
      open={open}
      onClose={onClose}
      width="96vw"
      placement="right"
      // Padding interno menor pra dar mais espaço ao Kanban
      styles={{ body: { padding: '20px 24px 40px' } }}
      destroyOnClose
    >
      <BacklogPanel sistemaId={sistemaId} sistemaNome={sistemaNome} />
    </Drawer>
  );
}
