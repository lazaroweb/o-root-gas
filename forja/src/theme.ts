import type { ThemeConfig } from 'antd';

// ─── FORJA Dark Premium Theme ────────────────────────────────────────────────
// Paleta: slate/zinc escuro + ouro polido como acento + azul-aço secundário
// Regra: máximo 1 elemento vibrante por tela, whitespace generoso

const forjaTheme: ThemeConfig = {
  token: {
    // Cores de fundo
    colorBgBase: '#0F1114',
    colorBgContainer: '#16181D',
    colorBgElevated: '#1E2028',
    colorBgLayout: '#0F1114',

    // Acento principal — ouro polido
    colorPrimary: '#D4A853',
    colorPrimaryHover: '#E0B96A',
    colorPrimaryActive: '#B8923F',

    // Secundário — azul-aço
    colorInfo: '#4A9EFF',
    colorLink: '#4A9EFF',

    // Texto
    colorText: '#E8E8ED',
    colorTextSecondary: '#8B8D98',
    colorTextTertiary: '#5C5E6A',
    colorTextQuaternary: '#3A3C45',

    // Bordas e divisores
    colorBorder: '#2A2D35',
    colorBorderSecondary: '#1F2129',

    // Status
    colorSuccess: '#52C97F',
    colorWarning: '#E8A838',
    colorError: '#E85555',

    // Forma
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Tipografia
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
    fontFamilyCode: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: 14,

    // Sombras (sutis)
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.4)',

    // Espaçamento
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    margin: 16,
    marginLG: 24,
    marginSM: 12,

    // Motion
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
  },
  components: {
    Layout: {
      headerBg: '#16181D',
      siderBg: '#12141A',
      bodyBg: '#0F1114',
      footerBg: '#0F1114',
    },
    Menu: {
      darkItemBg: '#12141A',
      darkItemSelectedBg: '#1E2028',
      darkItemColor: '#8B8D98',
      darkItemSelectedColor: '#D4A853',
      darkItemHoverColor: '#E8E8ED',
    },
    Card: {
      colorBgContainer: '#16181D',
      colorBorderSecondary: '#2A2D35',
    },
    Button: {
      borderRadius: 8,
    },
    Input: {
      colorBgContainer: '#1E2028',
      colorBorder: '#2A2D35',
    },
    Select: {
      colorBgContainer: '#1E2028',
      colorBorder: '#2A2D35',
    },
    Modal: {
      contentBg: '#1E2028',
      headerBg: '#1E2028',
    },
    Table: {
      colorBgContainer: '#16181D',
      headerBg: '#1A1C22',
      rowHoverBg: '#1E2028',
    },
  },
  algorithm: undefined, // Usamos tokens manuais ao invés do algorithm dark
};

export default forjaTheme;
