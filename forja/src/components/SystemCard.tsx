import React from 'react';
import { Card, Typography, Space, Progress } from 'antd';
import StageBadge from './StageBadge';
import type { Sistema } from '../types';

const { Text, Paragraph } = Typography;

interface SystemCardProps {
  sistema: Sistema;
  onClick: (id: string) => void;
}

export default function SystemCard({ sistema, onClick }: SystemCardProps): React.ReactElement {
  const stackTags = sistema.stack
    ? sistema.stack.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <Card
      hoverable
      onClick={() => onClick(sistema.id)}
      style={{
        borderColor: '#2A2D35',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      styles={{ body: { padding: '20px' } }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#D4A853';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(212, 168, 83, 0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#2A2D35';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Header: nome + estágio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Text strong style={{ fontSize: 16, color: '#E8E8ED', display: 'block' }}>
              {sistema.nome}
            </Text>
            <Text
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
                color: '#5C5E6A',
              }}
            >
              {sistema.codinome}
            </Text>
          </div>
          <StageBadge estagio={sistema.estagio} />
        </div>

        {/* Propósito */}
        {sistema.proposito && (
          <Paragraph
            style={{ color: '#8B8D98', fontSize: 13, margin: 0 }}
            ellipsis={{ rows: 2 }}
          >
            {sistema.proposito}
          </Paragraph>
        )}

        {/* Stack tags */}
        {stackTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {stackTags.slice(0, 4).map(tag => (
              <span
                key={tag}
                style={{
                  background: '#1E2028',
                  border: '1px solid #2A2D35',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: '#8B8D98',
                }}
              >
                {tag}
              </span>
            ))}
            {stackTags.length > 4 && (
              <span style={{ fontSize: 11, color: '#5C5E6A' }}>+{stackTags.length - 4}</span>
            )}
          </div>
        )}

        {/* Saúde */}
        {sistema.scoreSaude > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#5C5E6A' }}>Saúde</Text>
              <Text style={{ fontSize: 11, color: '#8B8D98' }}>{sistema.scoreSaude}%</Text>
            </div>
            <Progress
              percent={sistema.scoreSaude}
              showInfo={false}
              size="small"
              strokeColor={sistema.scoreSaude >= 80 ? '#52C97F' : sistema.scoreSaude >= 50 ? '#E8A838' : '#E85555'}
              trailColor="#2A2D35"
            />
          </div>
        )}
      </Space>
    </Card>
  );
}
