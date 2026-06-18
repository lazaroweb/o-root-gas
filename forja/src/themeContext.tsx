import React, { createContext, useContext } from 'react';
import { getForjaTokens } from './theme';
import type { ThemeMode, ForjaTokens } from './theme';

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  tokens: ForjaTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  mode: ThemeMode;
  toggle: () => void;
  children: React.ReactNode;
}

export function ForjaThemeProvider({ mode, toggle, children }: ThemeProviderProps): React.ReactElement {
  const value: ThemeContextValue = { mode, toggle, tokens: getForjaTokens(mode) };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useForja(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useForja precisa estar dentro de ForjaThemeProvider');
  return ctx;
}

export function useTokens(): ForjaTokens {
  return useForja().tokens;
}
