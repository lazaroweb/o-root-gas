import React from 'react';
import { Tag } from 'antd';
import type { Estagio } from '../types';

interface StageBadgeProps {
  estagio: Estagio;
}

const STAGE_CONFIG: Record<Estagio, { label: string; color: string }> = {
  faisca: { label: 'Faísca', color: '#E8A838' },
  forja: { label: 'Forja', color: '#D4A853' },
  tempera: { label: 'Têmpera', color: '#52C97F' },
  prateleira: { label: 'Prateleira', color: '#5C5E6A' },
};

export default function StageBadge({ estagio }: StageBadgeProps): React.ReactElement {
  const config = STAGE_CONFIG[estagio] || STAGE_CONFIG.faisca;
  return (
    <Tag
      color={config.color}
      style={{
        borderRadius: 4,
        fontWeight: 500,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {config.label}
    </Tag>
  );
}
