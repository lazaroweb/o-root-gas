import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import App from './App';
import { getForjaTheme, getForjaTokens } from './theme';
import type { ThemeMode } from './theme';
import { ForjaThemeProvider } from './themeContext';
import callServer from './gas-client';
import type { ServerResponse } from './types';

const STORAGE_KEY = 'forja_theme';

function readStoredMode(): ThemeMode | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'luz' || v === 'noturno') return v;
  } catch { /* localStorage indisponível no sandbox */ }
  return null;
}

function writeStoredMode(mode: ThemeMode): void {
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignora */ }
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }
  render() {
    if (this.state.erro) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Algo travou na tela</div>
            <p style={{ color: '#8A847C', fontSize: 14, lineHeight: 1.6 }}>
              Recarregue a página. Se persistir, me mande este detalhe:
            </p>
            <pre style={{ textAlign: 'left', background: '#F6F3EE', border: '1px solid #ECE7DF', borderRadius: 10, padding: 12, fontSize: 12, overflow: 'auto', maxHeight: 180, color: '#8A4A3C' }}>
              {String(this.state.erro?.message || this.state.erro)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 14, border: 'none', background: '#D99B73', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root(): React.ReactElement {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode() || 'luz');
  const ready = useRef<boolean>(readStoredMode() !== null);
  const toggle = useCallback(() => setMode(m => (m === 'luz' ? 'noturno' : 'luz')), []);

  // Aplica cores base no body sempre que o tema muda.
  useEffect(() => {
    const t = getForjaTokens(mode);
    document.body.style.background = t.appBg;
    document.body.style.color = t.text;
  }, [mode]);

  // Na primeira carga, se não havia preferência local, busca a salva no servidor.
  useEffect(() => {
    if (ready.current) return;
    callServer<ServerResponse<string>>('getThemeMode')
      .then(res => {
        const v = res.ok ? res.data : '';
        if (v === 'luz' || v === 'noturno') { setMode(v); writeStoredMode(v); }
      })
      .catch(() => { /* preview local */ })
      .finally(() => { ready.current = true; });
  }, []);

  // Persiste a preferência (local + servidor) quando o usuário troca o tema.
  useEffect(() => {
    if (!ready.current) return;
    writeStoredMode(mode);
    callServer('saveThemeMode', mode).catch(() => { /* ignora offline */ });
  }, [mode]);

  return (
    <ConfigProvider theme={getForjaTheme(mode)} locale={ptBR}>
      <ForjaThemeProvider mode={mode} toggle={toggle}>
        <AntApp>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AntApp>
      </ForjaThemeProvider>
    </ConfigProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(<Root />);
