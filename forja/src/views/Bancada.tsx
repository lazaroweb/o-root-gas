import React, { useState, useMemo } from 'react';
import { Typography, Segmented, Button, Row, Col, Spin, Alert, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import SystemCard from '../components/SystemCard';
import QuickStats from '../components/QuickStats';
import type { Sistema, DashboardStats, Estagio } from '../types';

const { Title } = Typography;

interface BancadaProps {
  sistemas: Sistema[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
  onSelectSistema: (id: string) => void;
  onNewSistema: () => void;
}

type FilterOption = 'todos' | Estagio;

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'todos' },
  { label: '🔥 Faísca', value: 'faisca' },
  { label: '⚒️ Forja', value: 'forja' },
  { label: '🛡️ Têmpera', value: 'tempera' },
  { label: '📦 Prateleira', value: 'prateleira' },
];

export default function Bancada({
  sistemas,
  stats,
  loading,
  error,
  onSelectSistema,
  onNewSistema,
}: BancadaProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterOption>('todos');

  const filtered = useMemo(() => {
    if (filter === 'todos') return sistemas;
    return sistemas.filter(s => s.estagio === filter);
  }, [sistemas, filter]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (error) {
    return <Alert type="error" message={error} showIcon style={{ margin: 24 }} />;
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          Bancada
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewSistema}
          size="middle"
        >
          Novo Sistema
        </Button>
      </div>

      {/* Quick Stats */}
      <div style={{ marginBottom: 28 }}>
        <QuickStats stats={stats} />
      </div>

      {/* Filtro por estágio */}
      <div style={{ marginBottom: 24 }}>
        <Segmented
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(val) => setFilter(val as FilterOption)}
          style={{ background: '#16181D' }}
        />
      </div>

      {/* Grid de sistemas */}
      {filtered.length === 0 ? (
        <Empty
          description="Nenhum sistema neste estágio"
          style={{ marginTop: 48 }}
        />
      ) : (
        <Row gutter={[20, 20]}>
          {filtered.map(sistema => (
            <Col xs={24} sm={12} lg={8} key={sistema.id}>
              <SystemCard sistema={sistema} onClick={onSelectSistema} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
