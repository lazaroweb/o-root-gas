import React from 'react';
import { Layout, Menu, Typography, Input } from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  BulbOutlined,
  RocketOutlined,
  TeamOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import BrasaIndicator from './BrasaIndicator';
import type { ViewName } from '../types';

const { Sider } = Layout;
const { Text } = Typography;

interface AppSidebarProps {
  currentView: ViewName;
  saudeMedia: number;
  onNavigate: (view: ViewName) => void;
  onSearchOpen?: () => void;
}

export default function AppSidebar({ currentView, saudeMedia, onNavigate, onSearchOpen }: AppSidebarProps): React.ReactElement {
  const menuItems = [
    { key: 'bancada', icon: <AppstoreOutlined />, label: 'Bancada' },
    { key: 'sistema-form', icon: <PlusOutlined />, label: 'Novo Sistema' },
    { type: 'divider' as const },
    { key: 'ideias', icon: <BulbOutlined />, label: 'Ideias' },
    { key: 'oportunidades', icon: <RocketOutlined />, label: 'Oportunidades' },
    { key: 'pessoas', icon: <TeamOutlined />, label: 'Pessoas' },
  ];

  return (
    <Sider
      width={220}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        borderRight: '1px solid #1F2129',
      }}
    >
      {/* Logo + Brasa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '20px 24px',
          borderBottom: '1px solid #1F2129',
        }}
      >
        <BrasaIndicator saudeMedia={saudeMedia} />
        <Text
          strong
          style={{
            fontSize: 18,
            color: '#D4A853',
            letterSpacing: '2px',
            fontWeight: 700,
          }}
        >
          FORJA
        </Text>
      </div>

      {/* Busca */}
      <div style={{ padding: '12px 16px' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#5C5E6A' }} />}
          placeholder="Buscar... ⌘K"
          readOnly
          onClick={onSearchOpen}
          style={{ background: '#1E2028', borderColor: '#2A2D35', cursor: 'pointer' }}
          size="small"
        />
      </div>

      {/* Menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[currentView]}
        onClick={({ key }) => onNavigate(key as ViewName)}
        items={menuItems}
        style={{ borderInlineEnd: 'none', marginTop: 8 }}
      />

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <Text style={{ fontSize: 10, color: '#3A3C45' }}>
          v3.0 — Fases 1-3
        </Text>
      </div>
    </Sider>
  );
}
