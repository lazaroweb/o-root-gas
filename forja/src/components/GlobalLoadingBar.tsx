// GlobalLoadingBar — barra fininha no topo que acende sempre que há qualquer
// chamada RPC em andamento (via gas-client). Dá o sinal de "carregando" em
// TODAS as seções sem precisar instrumentar cada tela. É proposital ter um
// pequeno atraso pra não piscar em chamadas instantâneas.
import React, { useEffect, useState } from 'react';
import { subscribeLoading } from '../gas-client';
import { useTokens } from '../themeContext';

export default function GlobalLoadingBar(): React.ReactElement | null {
  const t = useTokens();
  const [carregando, setCarregando] = useState(false);
  const [render, setRender] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => subscribeLoading(setCarregando), []);

  useEffect(() => {
    let showT: ReturnType<typeof setTimeout> | undefined;
    let hideT: ReturnType<typeof setTimeout> | undefined;
    if (carregando) {
      // só mostra se a chamada passar de ~120ms (evita flicker)
      showT = setTimeout(() => { setRender(true); requestAnimationFrame(() => setVisivel(true)); }, 120);
    } else {
      setVisivel(false);
      hideT = setTimeout(() => setRender(false), 280);
    }
    return () => { if (showT) clearTimeout(showT); if (hideT) clearTimeout(hideT); };
  }, [carregando]);

  if (!render) return null;
  const cor = t.accents.peach;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 4000,
        pointerEvents: 'none', opacity: visivel ? 1 : 0, transition: 'opacity .25s ease',
      }}
    >
      <style>{`@keyframes forjaLoadSlide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}`}</style>
      <div style={{
        position: 'absolute', top: 0, height: '100%', width: '38%', borderRadius: 3,
        background: `linear-gradient(90deg, transparent, ${cor}, transparent)`,
        boxShadow: `0 0 8px ${cor}88`,
        animation: 'forjaLoadSlide 1.05s ease-in-out infinite',
      }} />
    </div>
  );
}
