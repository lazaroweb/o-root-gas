import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: {
          fontFamily: "'Inter', -apple-system, sans-serif",
          colorPrimary: '#2A2724',
          borderRadius: 10,
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
