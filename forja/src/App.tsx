import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, App as AntApp, Drawer } from 'antd';
import AppSidebar, { SIDEBAR_WIDTH } from './components/AppSidebar';
import TopRightControls from './components/TopRightControls';
import MobileTopbar, { TOPBAR_HEIGHT } from './components/MobileTopbar';
import AlertsBell from './components/AlertsBell';
import LumeAssistant from './components/LumeAssistant';
import SearchModal from './components/SearchModal';
import Onboarding from './components/Onboarding';
import ShortcutsModal from './components/ShortcutsModal';
import ImportGASModal from './components/ImportGASModal';
import SkillsHubModal from './components/SkillsHubModal';
import Atelier from './views/Atelier';
import Estudos from './views/Estudos';
import { useIsMobile } from './useResponsive';
import Dashboard from './views/Dashboard';
import Configuracoes from './views/Configuracoes';
import Operacoes from './views/Operacoes';
import Financeiro from './views/Financeiro';
import ForjaIA from './views/ForjaIA';
import Relatorios from './views/Relatorios';
import Bancada from './views/Bancada';
import SistemaForm from './views/SistemaForm';
import SistemaDetail from './views/SistemaDetail';
import IdeiasView from './views/IdeiasView';
import IdeiaCapturaQuick from './components/IdeiaCapturaQuick';
import OportunidadesView from './views/OportunidadesView';
import Clientes from './views/Clientes';
import GeneseWizard from './views/GeneseWizard';
import LandingPage from './views/LandingPage';
import { useTokens } from './themeContext';
import callServer from './gas-client';
import type { ViewName, DashboardData, ServerResponse, MeuAcesso } from './types';

const { Content } = Layout;

// Rótulo amigável de cada seção — passado pra Lume saber "onde" o usuário está.
const VIEW_LABELS: Record<ViewName, string> = {
  dashboard: 'Dashboard', clientes: 'Clientes', ideias: 'Ideias',
  sistemas: 'Sistemas (Bancada)',
  operacoes: 'Operações', financeiro: 'Financeiro', 'forja-ia': 'Forja IA', relatorios: 'Relatórios',
  atelier: 'Atelier', estudos: 'Estudos', configuracoes: 'Configurações', 'sistema-form': 'Criar/editar sistema',
  'sistema-detail': 'Detalhe do sistema', oportunidades: 'Oportunidades', genese: 'Gênese (kickoff)',
};

// A landing aparece uma vez por sessão do navegador. Durante o trabalho, F5
// não re-exibe (chato). Sessão nova (fechou/reabriu) → vê a porta da frente.
const ENTERED_KEY = 'forja_entered_session';
function readEntered(): boolean {
  try { return window.sessionStorage.getItem(ENTERED_KEY) === '1'; } catch { return false; }
}

// Persistência da navegação: em GAS a URL roda em iframe e não dá pra usar
// rotas reais, então guardamos a tela atual no localStorage. Assim um F5
// (ou reabrir o app) volta pra onde o usuário estava, não pra home.
const NAV_STATE_KEY = 'forja_nav_state';
interface NavState { view: ViewName; sistemaId: string | null; ideiaId: string | null }

function readNavState(): NavState | null {
  try {
    const raw = window.localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<NavState>;
    if (!o || !o.view) return null;
    return { view: o.view as ViewName, sistemaId: o.sistemaId ?? null, ideiaId: o.ideiaId ?? null };
  } catch { return null; }
}

// Sanitiza: telas que dependem de um id (detalhe/edição de sistema) caem na
// lista se o id não veio, evitando uma tela quebrada após o reload.
function sanitizeNav(n: NavState | null): NavState {
  if (!n) return { view: 'dashboard', sistemaId: null, ideiaId: null };
  if ((n.view === 'sistema-detail' || n.view === 'sistema-form') && !n.sistemaId) {
    return { view: 'sistemas', sistemaId: null, ideiaId: null };
  }
  if (n.view === 'genese' && !n.sistemaId && !n.ideiaId) {
    return { view: 'ideias', sistemaId: null, ideiaId: null };
  }
  return n;
}

export default function App(): React.ReactElement {
  const { message } = AntApp.useApp();
  const t = useTokens();
  const [showLanding, setShowLanding] = useState<boolean>(() => !readEntered());
  const [currentView, setCurrentView] = useState<ViewName>(() => sanitizeNav(readNavState()).view);
  const [selectedSistemaId, setSelectedSistemaId] = useState<string | null>(() => sanitizeNav(readNavState()).sistemaId);
  const [selectedIdeiaId, setSelectedIdeiaId] = useState<string | null>(() => sanitizeNav(readNavState()).ideiaId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importGASOpen, setImportGASOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  // Captura quick (v1.143.0): modal flutuante global aberto pelo hotkey g+x
  // (substitui a view antiga Centelha — agora fundida em Ideias).
  const [capturaQuickOpen, setCapturaQuickOpen] = useState(false);
  const [sistemasRefresh, setSistemasRefresh] = useState(0);
  // Tab inicial do Atelier — Dashboard pode pular direto pra estação Servidores
  // ao clicar na linha de monitoramento no widget Conexões.
  const [atelierInitialTab, setAtelierInitialTab] = useState<import('./views/Atelier').AtelierTab>('guia');
  const [saudeMedia, setSaudeMedia] = useState(0);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [naoLidos, setNaoLidos] = useState(0);
  const [acesso, setAcesso] = useState<MeuAcesso | null>(null);
  const isMobile = useIsMobile();
  // Enquanto carrega, assume admin (o owner é sempre admin) pra não esconder
  // itens dele. Após carregar, respeita o papel real.
  const isAdmin = acesso ? acesso.papel === 'admin' : true;
  const currentViewRef = useRef<ViewName>(currentView);
  currentViewRef.current = currentView;

  useEffect(() => {
    const pendingG = { active: false, timer: 0 as ReturnType<typeof setTimeout> | 0 };
    const clearPending = () => { if (pendingG.timer) clearTimeout(pendingG.timer as ReturnType<typeof setTimeout>); pendingG.active = false; pendingG.timer = 0; };
    const isInput = (target: EventTarget | null) => {
      if (!target) return false;
      const el = target as HTMLElement;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const navMap: Record<string, ViewName> = {
      d: 'dashboard', c: 'clientes', i: 'ideias', s: 'sistemas',
      o: 'operacoes', f: 'financeiro', a: 'forja-ia', r: 'relatorios',
      v: 'atelier', e: 'estudos', ',': 'configuracoes',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
        return;
      }
      if (isInput(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }

      const k = e.key.toLowerCase();
      if (pendingG.active) {
        if (k === 'k') {
          // g + k → Skills modal (atalho de quick-access; o caminho completo é Atelier)
          e.preventDefault();
          setSkillsOpen(true);
        } else if (k === 'x') {
          // g + x → Captura rápida de ideia (modal flutuante global).
          // v1.143.0: substitui a antiga view Centelha (fundida em Ideias).
          e.preventDefault();
          setCapturaQuickOpen(true);
        } else if (navMap[k]) {
          e.preventDefault();
          setCurrentView(navMap[k]);
          setSelectedSistemaId(null);
          setSelectedIdeiaId(null);
        }
        clearPending();
        return;
      }
      if (k === 'g') {
        pendingG.active = true;
        pendingG.timer = setTimeout(clearPending, 1200);
        return;
      }
      if (k === 'n') {
        const v = currentViewRef.current;
        if (v === 'sistemas') { e.preventDefault(); setCurrentView('sistema-form'); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearPending(); };
  }, []);

  useEffect(() => {
    let visto = '1';
    try { visto = window.localStorage.getItem('forja_onboarding_done') || ''; } catch { /* sandbox */ }
    if (!visto) setOnboardingOpen(true);
  }, []);

  // Salva a navegação a cada mudança pra sobreviver ao F5 / reabertura.
  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_STATE_KEY, JSON.stringify({
        view: currentView, sistemaId: selectedSistemaId, ideiaId: selectedIdeiaId,
      }));
    } catch { /* sandbox/quota — segue sem persistir */ }
  }, [currentView, selectedSistemaId, selectedIdeiaId]);

  const loadSaude = useCallback(() => {
    callServer<ServerResponse<DashboardData>>('getDashboardData')
      .then(res => { if (res.ok && res.data) setSaudeMedia(res.data.kpis.saudeMedia); })
      .catch(() => setSaudeMedia(88));
  }, []);

  useEffect(loadSaude, [loadSaude]);

  useEffect(() => {
    callServer<ServerResponse<MeuAcesso>>('getMeuAcesso')
      .then((res) => { if (res.ok && res.data) setAcesso(res.data as MeuAcesso); })
      .catch(() => { /* preview local: mantém admin */ });
  }, []);

  const handleImported = useCallback(() => {
    setSistemasRefresh((n) => n + 1);
    setCurrentView('sistemas');
    loadSaude();
  }, [loadSaude]);

  const handleEnter = useCallback(() => {
    try { window.sessionStorage.setItem(ENTERED_KEY, '1'); } catch { /* ignora */ }
    setShowLanding(false);
  }, []);

  // Clicar no logo FORJA volta pra página de abertura.
  const handleShowLanding = useCallback(() => {
    setNavDrawerOpen(false);
    setShowLanding(true);
  }, []);

  const handleNavigate = (view: ViewName) => {
    setCurrentView(view);
    setNavDrawerOpen(false);
    if (view !== 'sistema-detail' && view !== 'genese' && view !== 'sistema-form') {
      setSelectedSistemaId(null);
      setSelectedIdeiaId(null);
    }
  };

  const handleSelectSistema = (id: string) => { setSelectedSistemaId(id); setCurrentView('sistema-detail'); };
  const handleEditSistema = (id: string) => { setSelectedSistemaId(id); setCurrentView('sistema-form'); };
  const handleSaved = () => { message.success('Salvo com sucesso'); loadSaude(); setCurrentView('sistemas'); setSelectedSistemaId(null); };
  const handleBack = () => { setCurrentView('sistemas'); setSelectedSistemaId(null); };
  const handleGenese = (ideiaId: string) => { setSelectedIdeiaId(ideiaId); setCurrentView('genese'); };

  const handleSearchSelect = (tipo: string, id: string) => {
    switch (tipo) {
      case 'sistema': setSelectedSistemaId(id); setCurrentView('sistema-detail'); break;
      case 'ideia': setCurrentView('ideias'); break;
      case 'pessoa': setCurrentView('clientes'); break;
      case 'oportunidade': setCurrentView('oportunidades'); break;
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard
          onSelectSistema={handleSelectSistema}
          onNavigate={handleNavigate}
          onImportGAS={() => setImportGASOpen(true)}
          onOpenAlertas={() => setAlertsDrawerOpen(true)}
          onOpenAtelierTab={(t) => { setAtelierInitialTab(t); setCurrentView('atelier'); }}
        />;
      case 'clientes':
        return <Clientes />;
      case 'ideias':
        return <IdeiasView onGenese={handleGenese} />;
      case 'sistemas':
        return <Bancada onSelectSistema={handleSelectSistema} onNewSistema={() => setCurrentView('sistema-form')} onImportGAS={() => setImportGASOpen(true)} refreshKey={sistemasRefresh} />;
      case 'operacoes':
        return <Operacoes />;
      case 'financeiro':
        return isAdmin ? <Financeiro /> : <AcessoNegado area="Financeiro" onVoltar={() => handleNavigate('dashboard')} />;
      case 'forja-ia':
        return <ForjaIA />;
      case 'relatorios':
        return <Relatorios />;
      case 'atelier':
        return <Atelier initialTab={atelierInitialTab} />;
      case 'estudos':
        return <Estudos />;
      case 'configuracoes':
        return isAdmin ? <Configuracoes /> : <AcessoNegado area="Configurações" onVoltar={() => handleNavigate('dashboard')} />;
      case 'sistema-form':
        return <SistemaForm sistemaId={selectedSistemaId} onBack={handleBack} onSaved={handleSaved} />;
      case 'sistema-detail':
        return selectedSistemaId
          ? <SistemaDetail sistemaId={selectedSistemaId} onBack={handleBack} onEdit={handleEditSistema} />
          : <Bancada onSelectSistema={handleSelectSistema} onNewSistema={() => setCurrentView('sistema-form')} />;
      case 'oportunidades':
        return <OportunidadesView />;
      case 'genese':
        return selectedIdeiaId
          ? <GeneseWizard ideiaId={selectedIdeiaId} onBack={() => handleNavigate('ideias')} />
          : <IdeiasView onGenese={handleGenese} />;
      default:
        return null;
    }
  };

  const sidebarEl = (
    <AppSidebar
      currentView={currentView}
      saudeMedia={saudeMedia}
      papel={acesso ? acesso.papel : null}
      usuario={acesso}
      footerMenu={isMobile}
      naoLidos={naoLidos}
      onNavigate={handleNavigate}
      onLogoClick={handleShowLanding}
      onSearchOpen={() => { setSearchOpen(true); setNavDrawerOpen(false); }}
      onGuideOpen={() => { setOnboardingOpen(true); setNavDrawerOpen(false); }}
      onShortcutsOpen={() => { setShortcutsOpen(true); setNavDrawerOpen(false); }}
      onAlertsOpen={() => { setAlertsDrawerOpen(true); setNavDrawerOpen(false); }}
    />
  );

  if (showLanding) {
    return <LandingPage onEnter={handleEnter} />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: t.appBg }}>
      {isMobile ? (
        <>
          <MobileTopbar
            saudeMedia={saudeMedia}
            naoLidos={naoLidos}
            usuario={acesso}
            onMenuOpen={() => setNavDrawerOpen(true)}
            onSearchOpen={() => setSearchOpen(true)}
            onAlertsOpen={() => setAlertsDrawerOpen(true)}
            onLogoClick={handleShowLanding}
          />
          <Drawer
            placement="left"
            open={navDrawerOpen}
            onClose={() => setNavDrawerOpen(false)}
            width={Math.min(280, window.innerWidth - 60)}
            closable={false}
            styles={{ body: { padding: 0, background: t.sidebarBg } }}
          >
            {sidebarEl}
          </Drawer>
          <Layout style={{ background: t.appBg, marginTop: TOPBAR_HEIGHT }}>
            <Content>
              <div key={currentView + ':' + (selectedSistemaId || '') + ':' + (selectedIdeiaId || '')} style={{ animation: 'forjaFadeIn 0.32s cubic-bezier(0.22,1,0.36,1)' }}>
                {renderView()}
              </div>
            </Content>
          </Layout>
        </>
      ) : (
        <>
          {sidebarEl}
          <TopRightControls
            usuario={acesso}
            naoLidos={naoLidos}
            isAdmin={isAdmin}
            onGuide={() => setOnboardingOpen(true)}
            onAlerts={() => setAlertsDrawerOpen(true)}
            onConfig={() => handleNavigate('configuracoes')}
          />
          <Layout style={{ marginLeft: SIDEBAR_WIDTH, background: t.appBg }}>
            <Content>
              <div key={currentView + ':' + (selectedSistemaId || '') + ':' + (selectedIdeiaId || '')} style={{ animation: 'forjaFadeIn 0.32s cubic-bezier(0.22,1,0.36,1)' }}>
                {renderView()}
              </div>
            </Content>
          </Layout>
        </>
      )}
      {/* Instância única dos alertas (desktop + mobile), controlada pelo App.
          O gatilho fica no menu de perfil (desktop) / topbar (mobile). Não abre
          sozinho: só sinaliza com a bolinha/badge — o user abre quando quiser. */}
      <AlertsBell
        hideButton
        controlledOpen={alertsDrawerOpen}
        onOpenChange={setAlertsDrawerOpen}
        onUnreadCount={setNaoLidos}
        onNavigate={handleNavigate}
      />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSearchSelect} onNavigate={handleNavigate} onImportGAS={() => setImportGASOpen(true)} onSkillsOpen={() => setSkillsOpen(true)} />
      <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} onNavigate={handleNavigate} onImportGAS={() => { setOnboardingOpen(false); setImportGASOpen(true); }} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ImportGASModal open={importGASOpen} onClose={() => setImportGASOpen(false)} onImported={handleImported} />
      <SkillsHubModal open={skillsOpen} onClose={() => setSkillsOpen(false)} />
      {/* Captura quick (g+x) — modal flutuante global de captura zero-fricção
          de ideias. Substitui a antiga view Centelha (fundida em Ideias). */}
      <IdeiaCapturaQuick
        open={capturaQuickOpen}
        onClose={() => setCapturaQuickOpen(false)}
        onIrParaIdeias={() => handleNavigate('ideias')}
      />
      {/* Lume — copiloto de IA global (FAB + drawer), em todas as telas. */}
      <LumeAssistant viewLabel={VIEW_LABELS[currentView] || 'app'} />
    </Layout>
  );
}

function AcessoNegado({ area, onVoltar }: { area: string; onVoltar: () => void }): React.ReactElement {
  const t = useTokens();
  return (
    <div className="forja-view" style={{ padding: '80px 40px', maxWidth: 560, margin: '0 auto', textAlign: 'center', animation: 'forjaFadeIn 0.3s ease' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: `${t.accents.rose}1f`, color: t.accents.rose, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 28 }}>🔒</div>
      <h2 style={{ color: t.text, fontSize: 22, marginBottom: 8 }}>Acesso restrito</h2>
      <p style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
        A área <b>{area}</b> é exclusiva para administradores. Fale com um admin se você precisa de acesso.
      </p>
      <button
        onClick={onVoltar}
        style={{ border: `1px solid ${t.border}`, background: t.surface, color: t.text, borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
      >
        Voltar ao Dashboard
      </button>
    </div>
  );
}
