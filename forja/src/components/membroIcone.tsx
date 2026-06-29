// Ícones de membro da Família — set de contorno (estilo Tabler Icons, MIT), com
// foco em pessoas/gênero que o lucide não cobre bem (mulher, homem, criança,
// bebê, casal). Embutidos como SVG inline pra não adicionar dependência nova.
//
// O campo `emoji` do membro guarda uma CHAVE de ícone (ex.: 'woman'). Para
// compatibilidade, membros antigos com emoji de verdade continuam aparecendo
// como texto; sem nada, cai na inicial do nome. Chaves legadas têm alias.
import React from 'react';

export type MembroIconComp = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  color?: string;
}>;

// Fábrica: transforma uma lista de paths num componente compatível com a forma
// como os ícones lucide eram chamados (size / strokeWidth / style / color).
function makeIcon(paths: string[]): MembroIconComp {
  return function Icon({ size = 24, strokeWidth = 2, style, color }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color || 'currentColor'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      >
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    );
  };
}

const Icones = {
  user: makeIcon([
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
    'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
  ]),
  woman: makeIcon([
    'M10 16v5', 'M14 16v5', 'M8 16h8l-2 -7h-4l-2 7',
    'M5 11c1.667 -1.333 3.333 -2 5 -2', 'M19 11c-1.667 -1.333 -3.333 -2 -5 -2',
    'M10 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ]),
  man: makeIcon([
    'M10 16v5', 'M14 16v5', 'M9 9h6l-1 7h-4l-1 -7',
    'M5 11c1.333 -1.333 2.667 -2 4 -2', 'M19 11c-1.333 -1.333 -2.667 -2 -4 -2',
    'M10 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ]),
  kid: makeIcon([
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M9 10l.01 0', 'M15 10l.01 0',
    'M9.5 15a3.5 3.5 0 0 0 5 0', 'M12 3a2 2 0 0 0 0 4',
  ]),
  baby: makeIcon([
    'M6 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M16 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6',
    'M6 9h14', 'M9 17l1 -3', 'M16 14l1 3',
  ]),
  couple: makeIcon([
    'M5 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M5 22v-5l-1 -1v-4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4l-1 1v5',
    'M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M15 22v-4h-2l2 -6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1l2 6h-2v4',
  ]),
  heart: makeIcon([
    'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    'M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25',
    'M12.5 15.5l2 2', 'M15 13l2 2',
  ]),
  users: makeIcon([
    'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85',
  ]),
  grad: makeIcon([
    'M22 9l-10 -4l-10 4l10 4l10 -4v6',
    'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4',
  ]),
  work: makeIcon([
    'M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9',
    'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2',
    'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0',
  ]),
  home: makeIcon([
    'M5 12l-2 0l9 -9l9 9l-2 0',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
    'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  ]),
  star: makeIcon([
    'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245',
  ]),
  crown: makeIcon([
    'M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6',
  ]),
  dog: makeIcon([
    'M11 5h2',
    'M19 12c-.667 5.333 -2.333 8 -5 8h-4c-2.667 0 -4.333 -2.667 -5 -8',
    'M11 16c0 .667 .333 1 1 1s1 -.333 1 -1h-2', 'M12 18v2',
    'M10 11v.01', 'M14 11v.01',
    'M5 4l6 .97l-6.238 6.688a1.021 1.021 0 0 1 -1.41 .111a.953 .953 0 0 1 -.327 -.954l1.975 -6.815',
    'M19 4l-6 .97l6.238 6.688c.358 .408 .989 .458 1.41 .111a.953 .953 0 0 0 .327 -.954l-1.975 -6.815',
  ]),
  cat: makeIcon([
    'M20 3v10a8 8 0 1 1 -16 0v-10l3.432 3.432a7.963 7.963 0 0 1 4.568 -1.432c1.769 0 3.403 .574 4.728 1.546l3.272 -3.546',
    'M2 16h5l-4 4', 'M22 16h-5l4 4',
    'M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M9 11v.01', 'M15 11v.01',
  ]),
  paw: makeIcon([
    'M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538',
    'M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0',
    'M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267',
    'M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267',
    'M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082',
  ]),
};

// Chaves mostradas no seletor (ordem). Cobre o que o usuário pediu (mulher,
// homem, menina/criança) + relações comuns de família.
export const MEMBRO_ICONE_KEYS: string[] = [
  'user', 'woman', 'man', 'kid', 'baby', 'couple', 'heart', 'users',
  'grad', 'work', 'home', 'star', 'crown', 'dog', 'cat', 'paw',
];

// Mapa de resolução: chaves do seletor + aliases de versões antigas.
export const MEMBRO_ICONES: Record<string, MembroIconComp> = {
  ...Icones,
  // aliases (chaves legadas → ícone mais próximo)
  smile: Icones.kid,
  game: Icones.star,
  gem: Icones.crown,
  flower: Icones.heart,
};

// Paleta de cores dos membros — DEVE espelhar `_PALETA_MEMBROS` no server.ts, que
// é quem atribui a cor padrão na criação. Mantê-las iguais garante que o seletor
// do editor ofereça exatamente as cores que o backend distribui.
export const PALETA_MEMBROS: string[] = [
  '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a855f7',
];

export function membroIconeComponent(valor?: string): MembroIconComp | null {
  if (!valor) return null;
  return MEMBRO_ICONES[valor] || null;
}

interface MembroLike {
  emoji?: string;
  nome: string;
  cor?: string;
}

// Avatar quadrado/arredondado com fundo suave na cor do membro.
export function MembroAvatar({ membro, size = 38, radius = 12 }: { membro: MembroLike; size?: number; radius?: number }): React.ReactElement {
  const cor = membro.cor || '#9B8FC4';
  const Icone = membroIconeComponent(membro.emoji);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `${cor}22`, color: cor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.48),
    }}>
      {Icone
        ? <Icone size={Math.round(size * 0.52)} strokeWidth={1.8} />
        : (membro.emoji || (membro.nome ? membro.nome.charAt(0).toUpperCase() : '?'))}
    </div>
  );
}

// Versão circular pequena (sobre fundo sólido na cor do membro), usada em chips
// e empilhamentos de avatares na atribuição.
export function MembroChipAvatar({ membro, size = 20, style }: { membro: MembroLike; size?: number; style?: React.CSSProperties }): React.ReactElement {
  const Icone = membroIconeComponent(membro.emoji);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: membro.cor || '#bbb',
      color: '#fff', fontSize: Math.round(size * 0.55), lineHeight: `${size}px`, textAlign: 'center',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1.5px solid #fff', flexShrink: 0, ...style,
    }}>
      {Icone
        ? <Icone size={Math.round(size * 0.6)} strokeWidth={2} color="#fff" />
        : (membro.emoji || (membro.nome ? membro.nome.charAt(0).toUpperCase() : '?'))}
    </span>
  );
}
