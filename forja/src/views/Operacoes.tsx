import React, { useState, useEffect } from 'react';
import { Activity, Server, GitBranch, Radar } from 'lucide-react';
import { PageHeader } from '../components/ui';
import SubNav, { type SubNavItem } from '../components/SubNav';
import OpsStatus from './OpsStatus';
import OpsAplicacoes from './OpsAplicacoes';
import OpsGitHub from './OpsGitHub';
import OpsMonitor from './OpsMonitor';
import callServer from '../gas-client';
import type { Sistema, ServerResponse } from '../types';

type OpsTab = 'status' | 'apps' | 'github' | 'monitor';

// Mesmo padrão de seções do Atelier/Configurações: trilho lateral (sticky) com
// ícone + descrição por área, no lugar das tabs horizontais que ficavam secas.
const SECOES: SubNavItem<OpsTab>[] = [
  { key: 'status', icon: Activity, label: 'Status & APIs', accent: 'blue', desc: 'Saúde dos endpoints e integrações monitoradas em tempo real.' },
  { key: 'apps', icon: Server, label: 'Aplicações', accent: 'sage', desc: 'Apps no ar, deploys e ambientes de cada sistema.' },
  { key: 'github', icon: GitBranch, label: 'GitHub', accent: 'lavender', desc: 'Repositórios, branches e atividade recente dos projetos.' },
  { key: 'monitor', icon: Radar, label: 'Monitoramento', accent: 'peach', desc: 'Verificações automáticas e alertas de disponibilidade.' },
];

export default function Operacoes(): React.ReactElement {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tab, setTab] = useState<OpsTab>('status');

  useEffect(() => {
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); })
      .catch(() => setSistemas([]));
  }, []);

  // Só a seção ativa é montada — equivale ao destroyInactiveTabPane das tabs.
  const renderConteudo = (): React.ReactNode => {
    switch (tab) {
      case 'status': return <OpsStatus sistemas={sistemas} />;
      case 'apps': return <OpsAplicacoes />;
      case 'github': return <OpsGitHub />;
      case 'monitor': return <OpsMonitor />;
      default: return null;
    }
  };

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Operações" subtitle="Status ao vivo, aplicações no ar, repositórios e monitoramento automático." />
      <SubNav<OpsTab> items={SECOES} value={tab} onChange={setTab} ariaLabel="Áreas de Operações">
        {renderConteudo()}
      </SubNav>
    </div>
  );
}
