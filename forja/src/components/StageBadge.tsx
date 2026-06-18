import React from 'react';
import { Tag } from 'antd';
import { useTokens } from '../themeContext';
import type { Estagio } from '../types';

interface StageBadgeProps {
  estagio: Estagio;
}

const LABELS: Record<Estagio, string> = {
  faisca: 'Faísca',
  forja: 'Forja',
  tempera: 'Têmpera',
  prateleira: 'Prateleira',
};

export default function StageBadge({ estagio }: StageBadgeProps): React.ReactElement {
  const t = useTokens();
  const colorMap: Record<Estagio, string> = {
    faisca: t.accents.clay,
    forja: t.accents.peach,
    tempera: t.accents.sage,
    prateleira: t.textTertiary,
  };
  const color = colorMap[estagio] || t.accents.peach;
  return (
    <Tag
      bordered={false}
      style={{
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.04em',
        background: `${color}1f`,
        color,
        paddingInline: 10,
      }}
    >
      {LABELS[estagio] || 'Faísca'}
    </Tag>
  );
}
