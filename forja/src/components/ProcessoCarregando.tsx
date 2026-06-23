// v1.148.4 — padrão Forja de feedback visual pra operações que demoram.
// Princípio: "Nenhuma operação > 600ms pode rodar silenciosa." O usuário tem
// que SABER que está acontecendo coisa (não que travou).
//
// Casos típicos:
// - Sincronização com GitHub (baixar tree + blobs + parsear) — 2-15s
// - Auditoria com IA (chamadas LLM) — 5-60s
// - Recálculo de saúde — 1-5s
// - Carregamento inicial de view pesada — 500ms-3s
//
// Variantes:
// - 'inline'    → banner no topo do conteúdo, não bloqueia (default — uso geral)
// - 'overlay'   → cobre o conteúdo do painel atual, bloqueia interação
// - 'fullscreen'→ cobre a view inteira, bloqueia tudo (pra primeira carga só)
//
// Visual: spinner premium minimal + mensagem + (opcional) subtexto/etapa.
// Animação fade-in suave + spinner com brasa-pulse (forjaSpin).
import React from 'react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';

interface Props {
  mostrar: boolean;
  mensagem: string;
  subtexto?: string;
  etapa?: string;      // ex: "Baixando 47 arquivos do GitHub"
  variante?: 'inline' | 'overlay' | 'fullscreen';
}

export default function ProcessoCarregando({
  mostrar,
  mensagem,
  subtexto,
  etapa,
  variante = 'inline',
}: Props): React.ReactElement | null {
  const t = useTokens();
  if (!mostrar) return null;

  const conteudo = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: FONTS.ui,
    }}>
      <SpinnerForja cor={t.accents.peach} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: t.text }}>
          {mensagem}
        </div>
        {(subtexto || etapa) && (
          <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
            {etapa && <span style={{ fontFamily: FONTS.mono, color: t.accents.lavender }}>{etapa}</span>}
            {etapa && subtexto && <span style={{ color: t.textTertiary }}> · </span>}
            {subtexto}
          </div>
        )}
      </div>
    </div>
  );

  if (variante === 'inline') {
    return (
      <div style={{
        background: t.surface,
        border: `1px solid ${t.accents.peach}40`,
        borderLeft: `3px solid ${t.accents.peach}`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 12,
        animation: 'forjaFadeIn 0.25s ease',
        boxShadow: t.shadowSoft,
      }}>
        {conteudo}
      </div>
    );
  }

  if (variante === 'overlay') {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        borderRadius: 'inherit',
        animation: 'forjaFadeIn 0.18s ease',
      }}>
        <div style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '18px 22px',
          minWidth: 260,
          maxWidth: 380,
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        }}>
          {conteudo}
        </div>
      </div>
    );
  }

  // fullscreen
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(250, 248, 245, 0.92)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'forjaFadeIn 0.2s ease',
    }}>
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: '24px 30px',
        minWidth: 320,
        boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
      }}>
        {conteudo}
      </div>
    </div>
  );
}

// Spinner brasa — círculo girando com gradiente sutil da brasa Forja.
// SVG nativo (não depende de antd Spin) pra controlar fina o estilo.
function SpinnerForja({ cor, tamanho = 22 }: { cor: string; tamanho?: number }): React.ReactElement {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      style={{ animation: 'forjaSpin 0.95s linear infinite', flexShrink: 0 }}
      aria-label="Carregando"
    >
      <circle cx="12" cy="12" r="9" stroke={cor + '20'} strokeWidth="2.5" fill="none" />
      <path
        d="M 12 3 A 9 9 0 0 1 21 12"
        stroke={cor}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
