import React, { useMemo } from 'react';
import { useTokens } from '../themeContext';

interface BrasaIndicatorProps {
  saudeMedia?: number; // 0-100 — usado só quando marca=false (cor por saúde)
  // Tamanho do NÚCLEO (a bola) em px. O halo é derivado (~1.6x).
  size?: number;
  // marca=true → usa a cor da brasa (peach) fixa, IGUAL à landing/abertura.
  // Garante que o efeito do sidebar seja o mesmo da página de entrada.
  marca?: boolean;
  qtdFagulhas?: number;
}

interface Fagulha {
  id: number;
  left: number;
  s: number;
  delay: number;
  dur: number;
  drift: number;
}

export default function BrasaIndicator({
  saudeMedia = 100, size = 9, marca = false, qtdFagulhas = 10,
}: BrasaIndicatorProps): React.ReactElement {
  const t = useTokens();
  // Na marca, a brasa é sempre peach (mesma cor da abertura). Sem marca,
  // a cor reflete a saúde média (verde/pêssego/rosa).
  const color = marca
    ? t.accents.peach
    : saudeMedia >= 75 ? t.accents.sage : saudeMedia >= 45 ? t.accents.peach : t.accents.rose;

  // Halo maior que o núcleo — mesma proporção da landing (22/14 ≈ 1.6).
  const halo = Math.round(size * 1.6);

  // Fagulhas com posição/tempo/deriva randomizados — orgânico, nunca repete.
  const fagulhas = useMemo<Fagulha[]>(
    () => Array.from({ length: qtdFagulhas }, (_, i) => ({
      id: i,
      left: Math.random() * 14 - 7,
      s: 1 + Math.random() * 1.7,
      delay: Math.random() * 3.6,
      dur: 2.2 + Math.random() * 1.8,
      drift: Math.random() * 14 - 7,
    })),
    [qtdFagulhas],
  );

  return (
    <span
      style={{
        position: 'relative',
        width: halo,
        height: halo,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* halo pulsante */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          width: halo,
          height: halo,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.4,
          animation: 'brasaPulse 2.4s ease-in-out infinite',
        }}
      />
      {/* núcleo: a bola da brasa, respirando, com glow */}
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 ${size * 1.2}px ${color}, 0 0 ${size * 2.4}px ${color}aa`,
          animation: 'forjaEmberBreath 3.2s ease-in-out infinite',
        }}
      />
      {/* fagulhas subindo da brasa */}
      {fagulhas.map((f) => (
        <span
          key={f.id}
          aria-hidden
          style={{
            position: 'absolute',
            bottom: halo / 2,
            left: '50%',
            width: f.s,
            height: f.s,
            marginLeft: f.left,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${f.s * 2}px ${color}`,
            // @ts-expect-error CSS custom property
            '--drift': `${f.drift}px`,
            animation: `forjaSparkMini ${f.dur}s ease-out ${f.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </span>
  );
}
