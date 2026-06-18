import type { ThemeConfig } from 'antd';

// ─── FORJA — Premium Minimal Design System ───────────────────────────────────
// Conceito: quiet luxury. Pastéis suaves, muito respiro, contornos finos.
// Regra: no máximo 1 cor de destaque por tela. Tipografia serifada (Fraunces)
// nos títulos, Inter na interface, JetBrains Mono em IDs/código.

export type ThemeMode = 'luz' | 'noturno';

// Acentos pastéis (mesma família nos dois temas, levemente ajustados)
export const ACCENTS = {
  sage: '#7FA98B', // verde sálvia
  blue: '#7E9DC4', // azul-poeira
  lavender: '#9B8FC4', // lavanda
  peach: '#D99B73', // pêssego/terracota (a brasa)
  rose: '#C98AA0', // rosa empoeirado
  clay: '#C2A37A', // argila
} as const;

export const ACCENTS_NOTURNO = {
  sage: '#8FBF9C',
  blue: '#8DAEDA',
  lavender: '#AEA2D6',
  peach: '#E0A87E',
  rose: '#D89BAE',
  clay: '#D2B388',
} as const;

export const FONTS = {
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

// Paleta neutra por tema — usada por componentes custom via useForjaTokens()
export const PALETTE = {
  luz: {
    appBg: '#FAF8F5',
    sidebarBg: '#FBF9F6',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F3EE',
    text: '#2A2724',
    textSecondary: '#8A847C',
    textTertiary: '#B4ADA3',
    border: '#ECE7DF',
    borderSoft: '#F2EEE7',
    shadow: '0 1px 2px rgba(42,39,36,0.04), 0 8px 24px rgba(42,39,36,0.06)',
    shadowSoft: '0 1px 2px rgba(42,39,36,0.04)',
    accents: ACCENTS,
  },
  noturno: {
    appBg: '#1B1C1F',
    sidebarBg: '#161719',
    surface: '#232427',
    surfaceMuted: '#1F2023',
    text: '#EAE7E1',
    textSecondary: '#9B968D',
    textTertiary: '#6B675F',
    border: '#2E2F33',
    borderSoft: '#27282B',
    shadow: '0 1px 2px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.35)',
    shadowSoft: '0 1px 2px rgba(0,0,0,0.3)',
    accents: ACCENTS_NOTURNO,
  },
} as const;

export type ForjaTokens = (typeof PALETTE)[ThemeMode];

export function getForjaTokens(mode: ThemeMode): ForjaTokens {
  return PALETTE[mode];
}

function buildTheme(mode: ThemeMode): ThemeConfig {
  const p = PALETTE[mode];
  const primary = p.accents.peach; // a brasa é o destaque da marca
  return {
    token: {
      colorPrimary: primary,
      colorInfo: p.accents.blue,
      colorLink: p.accents.blue,

      colorBgBase: p.appBg,
      colorBgLayout: p.appBg,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,

      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      colorTextTertiary: p.textTertiary,
      colorTextQuaternary: p.textTertiary,

      colorBorder: p.border,
      colorBorderSecondary: p.borderSoft,

      colorSuccess: p.accents.sage,
      colorWarning: p.accents.clay,
      colorError: p.accents.rose,

      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,

      fontFamily: FONTS.ui,
      fontFamilyCode: FONTS.mono,
      fontSize: 14,

      boxShadow: p.shadow,
      boxShadowSecondary: p.shadow,
      boxShadowTertiary: p.shadowSoft,

      controlHeight: 38,
      lineWidth: 1,
      wireframe: false,

      motionDurationMid: '0.2s',
      motionDurationSlow: '0.28s',
    },
    components: {
      Layout: {
        headerBg: p.surface,
        siderBg: p.sidebarBg,
        bodyBg: p.appBg,
        footerBg: p.appBg,
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: p.textSecondary,
        itemSelectedColor: p.text,
        itemSelectedBg: mode === 'luz' ? '#F1ECE3' : '#26282C',
        itemHoverColor: p.text,
        itemHoverBg: mode === 'luz' ? '#F5F1EA' : '#212327',
        itemHeight: 42,
        itemBorderRadius: 10,
        iconSize: 18,
        activeBarWidth: 0,
        activeBarBorderWidth: 0,
      },
      Card: {
        colorBgContainer: p.surface,
        colorBorderSecondary: p.border,
        boxShadowTertiary: p.shadow,
        borderRadiusLG: 16,
        paddingLG: 22,
      },
      Button: {
        borderRadius: 10,
        controlHeight: 38,
        primaryShadow: 'none',
        defaultShadow: 'none',
        fontWeight: 500,
      },
      Input: {
        colorBgContainer: mode === 'luz' ? '#FFFFFF' : '#1F2023',
        borderRadius: 10,
        controlHeight: 38,
      },
      Select: {
        colorBgContainer: mode === 'luz' ? '#FFFFFF' : '#1F2023',
        borderRadius: 10,
        controlHeight: 38,
        // ─── Dropdown contrast fix ────────────────────────────────────────
        // No noturno o item selecionado vinha quase invisível (cinza/teal
        // fraco no fundo escuro). Forçamos um bg sólido com bom contraste +
        // borda lateral peach pra ser inequivocamente "este é o selecionado".
        optionSelectedBg: mode === 'luz' ? '#F1ECE3' : '#2F2A24',
        optionSelectedColor: p.text,
        optionSelectedFontWeight: 600,
        optionActiveBg: mode === 'luz' ? '#F5F1EA' : '#26282C',
        colorBgElevated: p.surface, // bg do popup do dropdown
      },
      Modal: {
        contentBg: p.surface,
        headerBg: p.surface,
        borderRadiusLG: 18,
      },
      Table: {
        colorBgContainer: p.surface,
        headerBg: 'transparent',
        headerColor: p.textSecondary,
        rowHoverBg: p.surfaceMuted,
        borderColor: p.borderSoft,
        cellPaddingBlock: 14,
      },
      Segmented: {
        trackBg: p.surfaceMuted,
        itemSelectedBg: p.surface,
        itemSelectedColor: p.text,
        borderRadius: 10,
        controlHeight: 36,
      },
      Tag: {
        borderRadiusSM: 8,
      },
      Statistic: {
        contentFontSize: 28,
      },
      Tabs: {
        inkBarColor: primary,
        itemSelectedColor: p.text,
        itemColor: p.textSecondary,
      },
      // ─── Alert contrast fix (noturno) ───────────────────────────────────
      // O app NÃO usa o darkAlgorithm do antd — o tema escuro é montado à mão.
      // Sem isso, o Alert herda os fundos pastel CLAROS do algoritmo padrão e
      // vira uma "caixa branca" ilegível no noturno. Aqui derivamos os fundos,
      // bordas, ícones e textos da própria paleta, em ambos os temas.
      Alert: {
        colorInfoBg: `${p.accents.blue}1f`,
        colorInfoBorder: `${p.accents.blue}55`,
        colorInfo: p.accents.blue,
        colorSuccessBg: `${p.accents.sage}1f`,
        colorSuccessBorder: `${p.accents.sage}55`,
        colorSuccess: p.accents.sage,
        colorWarningBg: `${p.accents.clay}1f`,
        colorWarningBorder: `${p.accents.clay}55`,
        colorWarning: p.accents.clay,
        colorErrorBg: `${p.accents.rose}1f`,
        colorErrorBorder: `${p.accents.rose}55`,
        colorError: p.accents.rose,
        colorText: p.textSecondary,
        colorTextHeading: p.text,
      },
    },
  };
}

export const forjaLight = buildTheme('luz');
export const forjaDark = buildTheme('noturno');

export function getForjaTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'luz' ? forjaLight : forjaDark;
}
