import React, { useEffect, useState } from 'react';
import { Switch, Tooltip } from 'antd';
import { BookOpen } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, CodexPreview } from '../types';

// ─── CodexToggle ─────────────────────────────────────────────────────────────
// Componente reutilizável pra ativar/desativar a injeção do Códex no contexto
// da IA. Carrega o preview pra mostrar quantos cards/tokens vão entrar, dando
// transparência ao usuário sobre o "peso" da decisão.
//
// Uso:
//   const [usarCodex, setUsarCodex] = useState(true);
//   <CodexToggle value={usarCodex} onChange={setUsarCodex} />
//   // E no payload do gerador:
//   callServer('gerarBlueprint', { ...payload, usarCodex });

interface CodexToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  // Tamanho compacto pra usar em headers/toolbars
  compact?: boolean;
}

export default function CodexToggle({ value, onChange, compact = false }: CodexToggleProps): React.ReactElement {
  const t = useTokens();
  const [preview, setPreview] = useState<CodexPreview | null>(null);

  useEffect(() => {
    let mounted = true;
    callServer<ServerResult>('previewCodexContext')
      .then((r) => { if (mounted && r.ok) setPreview(r.data as CodexPreview); })
      .catch(() => { /* preview opcional */ });
    return () => { mounted = false; };
  }, []);

  const cards = preview ? (preview.texto.match(/^- \*\*/gm) || []).length : 0;

  return (
    <Tooltip
      title={
        <div style={{ maxWidth: 280 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Códex do Atelier</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            {value
              ? `Injetando ${cards} padrão${cards !== 1 ? 'ões' : ''} pessoal${cards !== 1 ? 'is' : ''} no contexto da IA (~${preview?.tokens || 0} tokens). A IA respeitará seu DNA de desenvolvimento.`
              : 'A IA vai gerar genérico, sem considerar seus padrões pessoais.'}
          </div>
        </div>
      }
      placement="top"
    >
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: compact ? '4px 10px' : '6px 12px',
        background: value ? `${t.accents.sage}10` : 'transparent',
        border: `1px solid ${value ? t.accents.sage + '44' : t.borderSoft}`,
        borderRadius: 999,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.18s',
      }}>
        <BookOpen size={compact ? 12 : 14} color={value ? t.accents.sage : t.textTertiary} strokeWidth={1.7} />
        <span style={{
          fontFamily: FONTS.ui, fontSize: compact ? 11.5 : 12.5,
          color: value ? t.text : t.textSecondary,
          fontWeight: value ? 500 : 400,
        }}>
          Códex
          {cards > 0 && (
            <span style={{
              fontFamily: FONTS.mono, fontSize: compact ? 9.5 : 10.5,
              color: t.textTertiary, marginLeft: 5,
            }}>
              · {cards}
            </span>
          )}
        </span>
        <Switch checked={value} onChange={onChange} size="small" />
      </label>
    </Tooltip>
  );
}
