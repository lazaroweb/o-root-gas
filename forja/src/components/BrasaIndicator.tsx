import React from 'react';

interface BrasaIndicatorProps {
  saudeMedia: number; // 0-100
}

function getColor(saude: number): string {
  if (saude >= 80) return '#52C97F'; // verde — saudável
  if (saude >= 50) return '#E8A838'; // âmbar — atenção
  return '#E85555'; // vermelho — crítico
}

export default function BrasaIndicator({ saudeMedia }: BrasaIndicatorProps): React.ReactElement {
  const color = getColor(saudeMedia);

  return (
    <div
      style={{
        position: 'relative',
        width: 12,
        height: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Glow pulsante */}
      <div
        style={{
          position: 'absolute',
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.4,
          animation: 'brasaPulse 2s ease-in-out infinite',
        }}
      />
      {/* Core sólido */}
      <div
        style={{
          position: 'relative',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <style>{`
        @keyframes brasaPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.6); opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
