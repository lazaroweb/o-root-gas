import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message } from 'antd';
import AppSidebar from './components/AppSidebar';
import SearchModal from './components/SearchModal';
import Bancada from './views/Bancada';
import SistemaForm from './views/SistemaForm';
import SistemaDetail from './views/SistemaDetail';
import IdeiasView from './views/IdeiasView';
import OportunidadesView from './views/OportunidadesView';
import PessoasView from './views/PessoasView';
import GeneseWizard from './views/GeneseWizard';
import callServer from './gas-client';
import type { ViewName, Sistema, DashboardStats, ServerResponse } from './types';

const { Content } = Layout;

// Mock data para preview local
const MOCK_SISTEMAS: Sistema[] = [
  { id: '1', nome: 'FORJA', codinome: 'forja', estagio: 'forja', proposito: 'Central de comando e governança de sistemas', stack: 'GAS, React, TypeScript, Ant Design', urlProd: '', scoreSaude: 85 },
  { id: '2', nome: 'ClientFlow', codinome: 'cflow', estagio: 'tempera', proposito: 'CRM simplificado para freelancers', stack: 'Next.js, Supabase, Vercel', urlProd: 'https://clientflow.app', scoreSaude: 92 },
  { id: '3', nome: 'QuoteForge', codinome: 'qforge', estagio: 'faisca', proposito: 'Gerador de propostas comerciais com IA', stack: '', urlProd: '', scoreSaude: 0 },
];

const MOCK_STATS: DashboardStats = {
  totalSistemas: 3,
  ativos: 2,
  saudeMedia: 88,
  custoMensal: 45,
};

interface InitData {
  sistemas: Sistema[];
  stats: DashboardStats;
}

export default function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<ViewName>('bancada');
  const [selectedSistemaId, setSelectedSistemaId] = useState<string | null>(null);
  const [selectedIdeiaId, setSelectedIdeiaId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalSistemas: 0, ativos: 0, saudeMedia: 0, custoMensal: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Atalho ⌘K / Ctrl+K para busca global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    callServer<ServerResponse<InitData>>('initApp')
      .then(res => {
        if (res.ok && res.data) {
          setSistemas(res.data.sistemas);
          setStats(res.data.stats);
        } else {
          setError(res.error || 'Erro ao carregar dados');
        }
      })
      .catch(() => {
        setSistemas(MOCK_SISTEMAS);
        setStats(MOCK_STATS);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigate = (view: ViewName) => {
    setCurrentView(view);
    if (view !== 'sistema-detail' && view !== 'genese') {
      setSelectedSistemaId(null);
      setSelectedIdeiaId(null);
    }
  };

  const handleSelectSistema = (id: string) => {
    setSelectedSistemaId(id);
    setCurrentView('sistema-detail');
  };

  const handleEditSistema = (id: string) => {
    setSelectedSistemaId(id);
    setCurrentView('sistema-form');
  };

  const handleSaved = () => {
    message.success('Dados salvos com sucesso!');
    loadData();
    setCurrentView('bancada');
    setSelectedSistemaId(null);
  };

  const handleBack = () => {
    setCurrentView('bancada');
    setSelectedSistemaId(null);
  };

  const handleGenese = (ideiaId: string) => {
    setSelectedIdeiaId(ideiaId);
    setCurrentView('genese');
  };

  const handleSearchSelect = (tipo: string, id: string) => {
    switch (tipo) {
      case 'sistema':
        setSelectedSistemaId(id);
        setCurrentView('sistema-detail');
        break;
      case 'ideia':
        setCurrentView('ideias');
        break;
      case 'pessoa':
        setCurrentView('pessoas');
        break;
      case 'oportunidade':
        setCurrentView('oportunidades');
        break;
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'bancada':
        return (
          <Bancada
            sistemas={sistemas}
            stats={stats}
            loading={loading}
            error={error}
            onSelectSistema={handleSelectSistema}
            onNewSistema={() => handleNavigate('sistema-form')}
          />
        );
      case 'sistema-form':
        return (
          <SistemaForm
            sistemaId={selectedSistemaId}
            onBack={handleBack}
            onSaved={handleSaved}
          />
        );
      case 'sistema-detail':
        return selectedSistemaId ? (
          <SistemaDetail
            sistemaId={selectedSistemaId}
            onBack={handleBack}
            onEdit={handleEditSistema}
          />
        ) : (
          <Bancada
            sistemas={sistemas}
            stats={stats}
            loading={loading}
            error={error}
            onSelectSistema={handleSelectSistema}
            onNewSistema={() => handleNavigate('sistema-form')}
          />
        );
      case 'ideias':
        return <IdeiasView onGenese={handleGenese} />;
      case 'oportunidades':
        return <OportunidadesView />;
      case 'pessoas':
        return <PessoasView />;
      case 'genese':
        return selectedIdeiaId ? (
          <GeneseWizard ideiaId={selectedIdeiaId} onBack={() => handleNavigate('ideias')} />
        ) : (
          <IdeiasView onGenese={handleGenese} />
        );
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppSidebar
        currentView={currentView}
        saudeMedia={stats.saudeMedia}
        onNavigate={handleNavigate}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <Layout style={{ marginLeft: 220 }}>
        <Content>{renderView()}</Content>
      </Layout>
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
    </Layout>
  );
}
