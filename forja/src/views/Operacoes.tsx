import React, { useState, useEffect } from 'react';
import { Activity, Server, GitBranch, Radar, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '../components/ui';
import SubNav, { type SubNavItem } from '../components/SubNav';
import OpsVisaoGeral from './OpsVisaoGeral';
import OpsStatus from './OpsStatus';
import OpsAplicacoes from './OpsAplicacoes';
import OpsGitHub from './OpsGitHub';
import OpsMonitor from './OpsMonitor';
import callServer from '../gas-client';
import type { Sistema, ServerResponse, ViewName } from '../types';

type OpsTab = 'geral' | 'status' | 'apps' | 'github' | 'monitor';

interface OperacoesProps {
  // Caminhos de tratativa: linhas FALHA/Fora do ar precisam abrir o lugar certo
  // (sistema, configurações). Princípio "alerta sem ação proibido".
  onAbrirSistema?: (id: string) => void;
  onIrPara?: (view: ViewName) => void;
  // Deep-link pro hub de Conexões em Configurações (seção específica).
  onIrParaConfigSecao?: (secao: string) => void;
}

// Mesmo padrão de seções do Atelier/Configurações: trilho lateral (sticky) com
// ícone + descrição por área, no lugar das tabs horizontais que ficavam secas.
const SECOES: SubNavItem<OpsTab>[] = [
  { key: 'geral', icon: LayoutDashboard, label: 'Visão geral', accent: 'peach', desc: 'Saúde de tudo num relance e o que precisa de atenção agora.' },
  { key: 'status', icon: Activity, label: 'Conexões', accent: 'blue', desc: 'Saúde de IA, GitHub e endpoints de API em tempo real.' },
  { key: 'apps', icon: Server, label: 'Aplicações', accent: 'sage', desc: 'Apps no ar, deploys e ambientes de cada sistema.' },
  { key: 'github', icon: GitBranch, label: 'GitHub', accent: 'lavender', desc: 'Repositórios, branches e atividade recente dos projetos.' },
  { key: 'monitor', icon: Radar, label: 'Monitoramento', accent: 'clay', desc: 'Verificações automáticas e alertas de disponibilidade.' },
];

export default function Operacoes({ onAbrirSistema, onIrPara, onIrParaConfigSecao }: OperacoesProps = {}): React.ReactElement {
  const irConfig = (secao: string) => {
    if (onIrParaConfigSecao) onIrParaConfigSecao(secao);
    else if (onIrPara) onIrPara('configuracoes');
  };
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tab, setTab] = useState<OpsTab>('geral');

  useEffect(() => {
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); })
      .catch(() => setSistemas([]));
  }, []);

  // Só a seção ativa é montada — equivale ao destroyInactiveTabPane das tabs.
  const renderConteudo = (): React.ReactNode => {
    switch (tab) {
      case 'geral': return (
        <OpsVisaoGeral
          onIrParaStatus={() => setTab('status')}
          onIrParaApps={() => setTab('apps')}
          onIrParaGitHub={() => setTab('github')}
          onIrParaMonitor={() => setTab('monitor')}
          onAbrirSistema={onAbrirSistema}
          onIrParaConfigSecao={irConfig}
        />
      );
      case 'status': return <OpsStatus sistemas={sistemas} onIrParaConfig={() => irConfig('ia')} onGerenciarApis={() => irConfig('apis')} />;
      case 'apps': return <OpsAplicacoes onAbrirSistema={onAbrirSistema} />;
      case 'github': return <OpsGitHub />;
      case 'monitor': return <OpsMonitor onIrParaStatus={() => setTab('status')} onIrParaApps={() => setTab('apps')} />;
      default: return null;
    }
  };

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Ao vivo" subtitle="O pulso de tudo que você roda: saúde em tempo real, apps no ar, repositórios e monitoramento." />
      <SubNav<OpsTab> items={SECOES} value={tab} onChange={setTab} ariaLabel="Áreas do Ao vivo">
        {renderConteudo()}
      </SubNav>
    </div>
  );
}
