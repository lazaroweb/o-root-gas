import React, { useEffect, useMemo } from 'react';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useForja } from '../themeContext';
import { FONTS } from '../theme';
import { FORJA_VERSION } from '../version';

interface LandingPageProps {
  onEnter: () => void;
}

// Slogan principal da marca. "Forja" = onde o metal bruto vira ferramenta;
// aqui, onde a ideia bruta vira software. A brasa (peach) é o calor que dá forma.
const SLOGAN = 'Onde ideias ganham forma';
const TAGLINE = 'da fagulha à entrega';

// Cada fagulha sobe da brasa com posição/tempo/deriva randomizados, pra dar
// a sensação orgânica de faíscas do metal sendo malhado. Calculadas uma vez.
interface Spark {
  id: number;
  left: number;   // offset horizontal em relação ao centro da brasa (px)
  size: number;   // diâmetro (px)
  delay: number;  // atraso inicial (s)
  dur: number;    // duração do ciclo (s)
  drift: number;  // deriva lateral no topo (px)
}

export default function LandingPage({ onEnter }: LandingPageProps): React.ReactElement {
  const { mode, toggle, tokens: t } = useForja();
  const dark = mode === 'noturno';
  const ember = t.accents.peach;

  const sparks = useMemo<Spark[]>(
    () => Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 140 - 70,
      size: 1.5 + Math.random() * 3,
      delay: Math.random() * 4.5,
      dur: 2.8 + Math.random() * 2.6,
      drift: Math.random() * 60 - 30,
    })),
    [],
  );

  // Enter / Espaço também entram na forja — sensação de "porta da frente".
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnter]);

  // Fundo: no escuro, near-black com leve calor no centro (a forja na penumbra).
  // No claro, creme quente. O gradiente concentra a "luz da brasa" no centro.
  const bg = dark
    ? 'radial-gradient(circle at 50% 40%, #25201B 0%, #17181A 46%, #121315 100%)'
    : 'radial-gradient(circle at 50% 40%, #FFF6EC 0%, #FAF8F5 48%, #F3EEE6 100%)';

  const corTexto = t.text;
  const corSub = t.textSecondary;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* Toggle de tema — discreto no canto */}
      <button
        onClick={toggle}
        aria-label="Alternar tema"
        style={{
          position: 'absolute', top: 22, right: 22,
          width: 38, height: 38, borderRadius: 10,
          border: `1px solid ${t.border}`, background: 'transparent',
          color: t.textSecondary, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.18s ease, color 0.18s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = t.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.textSecondary; }}
      >
        {dark ? <Sun size={17} strokeWidth={1.7} /> : <Moon size={17} strokeWidth={1.7} />}
      </button>

      {/* Palco da brasa — wordmark + fagulhas + glow */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Glow ambiente de calor atrás de tudo */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 520, height: 520,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${ember}33 0%, ${ember}14 35%, transparent 68%)`,
            filter: 'blur(8px)',
            animation: 'forjaEmberGlow 5s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Wordmark com a brasa */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, zIndex: 2 }}>
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 'clamp(48px, 9vw, 96px)',
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: corTexto,
              paddingLeft: '0.18em', // compensa o letter-spacing pra centralizar
              animation: 'forjaWordIn 1.1s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            FORJA
          </span>

          {/* A BRASA — coração da marca: brasa que respira, com fagulhas */}
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
            {/* halo */}
            <span
              aria-hidden
              style={{
                position: 'absolute', width: 22, height: 22, borderRadius: '50%',
                background: ember, opacity: 0.4,
                animation: 'brasaPulse 2.4s ease-in-out infinite',
              }}
            />
            {/* núcleo */}
            <span
              aria-hidden
              style={{
                position: 'relative', width: 14, height: 14, borderRadius: '50%',
                background: ember,
                boxShadow: `0 0 16px ${ember}, 0 0 32px ${ember}aa`,
                animation: 'forjaEmberBreath 3.2s ease-in-out infinite',
              }}
            />
            {/* fagulhas subindo da brasa */}
            {sparks.map((s) => (
              <span
                key={s.id}
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: 6,
                  left: '50%',
                  width: s.size,
                  height: s.size,
                  marginLeft: s.left,
                  borderRadius: '50%',
                  background: ember,
                  boxShadow: `0 0 ${s.size * 2}px ${ember}`,
                  // @ts-expect-error CSS custom property
                  '--drift': `${s.drift}px`,
                  animation: `forjaSpark ${s.dur}s ease-out ${s.delay}s infinite`,
                  pointerEvents: 'none',
                }}
              />
            ))}
          </span>
        </div>

        {/* Filete dourado — ancora a marca e separa o wordmark do slogan,
            tratamento "Opção B" aplicado consistentemente em todas as superfícies */}
        <div
          aria-hidden
          style={{
            marginTop: 24,
            height: 2,
            width: 'clamp(90px, 14vw, 160px)',
            background: `linear-gradient(90deg, transparent, ${ember}, ${ember}99 78%, transparent)`,
            borderRadius: 2,
            animation: 'forjaSloganIn 0.9s ease 0.4s both',
            zIndex: 2,
            boxShadow: `0 0 12px ${ember}55`,
          }}
        />

        {/* Slogan */}
        <div
          style={{
            marginTop: 18,
            fontFamily: FONTS.display,
            fontStyle: 'italic',
            fontSize: 'clamp(17px, 2.6vw, 24px)',
            fontWeight: 400,
            color: corSub,
            letterSpacing: '0.01em',
            animation: 'forjaSloganIn 0.9s ease 0.55s both',
            zIndex: 2,
          }}
        >
          {SLOGAN}
        </div>

        {/* Tagline mono */}
        <div
          style={{
            marginTop: 10,
            fontFamily: FONTS.mono,
            fontSize: 11.5,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: t.textTertiary,
            animation: 'forjaSloganIn 0.9s ease 0.7s both',
            zIndex: 2,
          }}
        >
          {TAGLINE}
        </div>

        {/* Botão entrar */}
        <button
          onClick={onEnter}
          style={{
            marginTop: 44,
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '13px 28px',
            border: 'none', borderRadius: 12,
            background: ember,
            color: dark ? '#1B1C1F' : '#FFFFFF',
            fontFamily: FONTS.ui, fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 6px 24px ${ember}55`,
            animation: 'forjaSloganIn 0.9s ease 0.9s both',
            transition: 'transform 0.14s ease, box-shadow 0.2s ease',
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 10px 32px ${ember}77`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 6px 24px ${ember}55`;
          }}
        >
          Entrar na forja
          <ArrowRight size={17} strokeWidth={2} />
        </button>
      </div>

      {/* Rodapé discreto */}
      <div
        style={{
          position: 'absolute', bottom: 22,
          fontFamily: FONTS.mono, fontSize: 10.5,
          color: t.textTertiary, letterSpacing: '0.12em',
          opacity: 0.7,
          animation: 'forjaSloganIn 0.9s ease 1.1s both',
        }}
      >
        v{FORJA_VERSION} · pressione Enter pra começar
      </div>
    </div>
  );
}
