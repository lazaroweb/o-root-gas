// EstrelasQualidade — v1.152.0
// Nota global de qualidade 0-5 (dada pela Lume ou manual). Reutilizado em Skills
// e Agents. Modo display (compacto, no card) e modo editável (no drawer).
import React from 'react';
import { Rate, Tooltip } from 'antd';
import { Sparkles } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

interface Props {
  valor: number;             // 0-5
  motivo?: string;           // justificativa da Lume (tooltip)
  avaliadaEm?: string;       // ISO (tooltip)
  size?: number;             // tamanho da estrela
  editavel?: boolean;        // se true, permite clicar pra ajustar
  onChange?: (n: number) => void;
  mostrarVazio?: boolean;    // se false, não renderiza nada quando valor=0 e não editável
}

export default function EstrelasQualidade({
  valor, motivo, avaliadaEm, size = 13, editavel = false, onChange, mostrarVazio = false,
}: Props): React.ReactElement | null {
  const t = useTokens();
  const n = Math.max(0, Math.min(5, Math.round(valor || 0)));

  if (!editavel && n === 0 && !mostrarVazio) return null;

  const corpo = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Rate
        value={n}
        count={5}
        disabled={!editavel}
        allowHalf={false}
        onChange={editavel ? onChange : undefined}
        style={{ fontSize: size, color: t.accents.peach, lineHeight: 1 }}
      />
      {!editavel && n > 0 && (
        <span style={{ fontFamily: FONTS.ui, fontSize: size - 2, fontWeight: 600, color: t.accents.peach }}>
          {n}.0
        </span>
      )}
    </span>
  );

  if (editavel) return corpo;

  const dica = (
    <span style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Sparkles size={11} /> Nota da Lume: {n}/5
      </strong>
      {motivo && <div style={{ marginTop: 2 }}>{motivo}</div>}
      {avaliadaEm && (
        <div style={{ marginTop: 2, opacity: 0.7 }}>
          Avaliada em {new Date(avaliadaEm).toLocaleDateString('pt-BR')}
        </div>
      )}
    </span>
  );

  return <Tooltip title={dica}>{corpo}</Tooltip>;
}
