import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import {
  AppstoreOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { DashboardStats } from '../types';

interface QuickStatsProps {
  stats: DashboardStats;
  loading?: boolean;
}

export default function QuickStats({ stats, loading }: QuickStatsProps): React.ReactElement {
  const items = [
    { title: 'Sistemas', value: stats.totalSistemas, icon: <AppstoreOutlined />, color: '#E8E8ED' },
    { title: 'Ativos', value: stats.ativos, icon: <ThunderboltOutlined />, color: '#D4A853' },
    { title: 'Saúde Média', value: stats.saudeMedia, suffix: '%', icon: <HeartOutlined />, color: '#52C97F' },
    { title: 'Custo Mensal', value: stats.custoMensal, prefix: 'R$', icon: <DollarOutlined />, color: '#4A9EFF' },
  ];

  return (
    <Row gutter={[16, 16]}>
      {items.map(item => (
        <Col xs={12} sm={6} key={item.title}>
          <Card
            style={{ borderColor: '#2A2D35' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title={
                <span style={{ color: '#8B8D98', fontSize: 12 }}>
                  <span style={{ marginRight: 6, color: item.color }}>{item.icon}</span>
                  {item.title}
                </span>
              }
              value={item.value}
              prefix={item.prefix}
              suffix={item.suffix}
              loading={loading}
              valueStyle={{ color: item.color, fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
