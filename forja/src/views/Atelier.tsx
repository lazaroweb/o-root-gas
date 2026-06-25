import React, { useState } from 'react';
import { BookMarked, Server, Shield, Code2, FileText, Bookmark, BookOpen, ChefHat, LayoutDashboard, HardDrive, Wallet, Hammer, Cpu, Bot, Boxes } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useForja, useTokens } from '../themeContext';
import { FONTS } from '../theme';
import SkillsHubModal from '../components/SkillsHubModal';
import AgentsHubModal from '../components/AgentsHubModal';
import KitsHubPanel from '../components/KitsHubPanel';
import HospedagemPanel from '../components/HospedagemPanel';
import CofrePanel from '../components/CofrePanel';
import SnippetsPanel from '../components/SnippetsPanel';
import TemplatesPanel from '../components/TemplatesPanel';
import BookmarksPanel from '../components/BookmarksPanel';
import CodexPanel from '../components/CodexPanel';
import ReceituarioPanel from '../components/ReceituarioPanel';
import DriverPanel from '../components/DriverPanel';
import ContasPanel from '../components/ContasPanel';
import ServidoresPanel from '../components/ServidoresPanel';
import AtelierGuia from '../components/AtelierGuia';

// ─── Tipos ───────────────────────────────────────────────────────────────────
// Cada section do Atelier é uma "estação de bancada". A nav é vertical (sidebar
// interna) pra escalar bem: descrição rica por item, sem overflow nem botão
// "...". Padrão usado por Linear/Notion settings — premium e familiar.
export type AtelierTab = 'guia' | 'skills' | 'agents' | 'kits' | 'snippets' | 'templates' | 'bookmarks' | 'driver' | 'contas' | 'servidores' | 'codex' | 'receituario' | 'hospedagem' | 'cofre';

interface AtelierProps {
  initialTab?: AtelierTab;
}

interface Estacao {
  key: AtelierTab;
  icon: React.ReactNode;
  iconActive: React.ReactNode;
  label: string;
  descricao: string;
  // Cor de destaque pra accent quando ativo (pinta o ícone).
  accent: keyof ReturnType<typeof useTokens>['accents'];
  novo?: boolean; // badge "novo" pra recém-lançados
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function Atelier({ initialTab = 'guia' }: AtelierProps): React.ReactElement {
  const t = useTokens();
  const { mode } = useForja();
  const [tab, setTab] = useState<AtelierTab>(initialTab);
  // Filtro inicial do Cofre quando aberto via atalho (card de Conta com segredo).
  const [cofreFiltro, setCofreFiltro] = useState('');
  const abrirCofre = (label?: string) => { setCofreFiltro(label || ''); setTab('cofre'); };

  // Definição das estações. Pra adicionar uma nova: 1) cria o painel componente,
  // 2) adiciona aqui na lista, 3) adiciona o case no renderConteudo abaixo.
  // É só isso — a nav escala sozinha.
  const ESTACOES: Estacao[] = [
    {
      key: 'guia',
      icon: <LayoutDashboard size={17} strokeWidth={1.6} />,
      iconActive: <LayoutDashboard size={17} strokeWidth={1.8} />,
      label: 'Visão geral',
      descricao: 'Panorama do seu Atelier: indicadores das estações num relance. O guia de início fica no botão flutuante.',
      accent: 'peach',
    },
    {
      key: 'skills',
      icon: <BookMarked size={17} strokeWidth={1.6} />,
      iconActive: <BookMarked size={17} strokeWidth={1.8} />,
      label: 'Skills',
      descricao: 'Prompts, playbooks e arquivos SKILL.md da sua biblioteca pessoal.',
      accent: 'lavender',
    },
    {
      key: 'agents',
      icon: <Bot size={17} strokeWidth={1.6} />,
      iconActive: <Bot size={17} strokeWidth={1.8} />,
      label: 'Agents',
      descricao: 'Agentes de IA: prompts longos, com persona, modelo e ferramentas — irmãos das Skills.',
      accent: 'blue',
      novo: true,
    },
    {
      key: 'kits',
      icon: <Boxes size={17} strokeWidth={1.6} />,
      iconActive: <Boxes size={17} strokeWidth={1.8} />,
      label: 'Kits',
      descricao: 'Kits dos sonhos curados pela Lume: as melhores skills + agents pra cada objetivo, prontos pra exportar.',
      accent: 'peach',
      novo: true,
    },
    {
      key: 'snippets',
      icon: <Code2 size={17} strokeWidth={1.6} />,
      iconActive: <Code2 size={17} strokeWidth={1.8} />,
      label: 'Snippets',
      descricao: 'Blocos de código reutilizáveis — copie e cole na velocidade do pensamento.',
      accent: 'blue',
    },
    {
      key: 'templates',
      icon: <FileText size={17} strokeWidth={1.6} />,
      iconActive: <FileText size={17} strokeWidth={1.8} />,
      label: 'Templates',
      descricao: 'Briefings, PRDs, emails e contratos com variáveis {{tipo-handlebars}}.',
      accent: 'lavender',
    },
    {
      key: 'bookmarks',
      icon: <Bookmark size={17} strokeWidth={1.6} />,
      iconActive: <Bookmark size={17} strokeWidth={1.8} />,
      label: 'Bookmarks',
      descricao: 'Docs, tutoriais e ferramentas que você sempre volta — organizado por tag.',
      accent: 'peach',
    },
    {
      key: 'driver',
      icon: <HardDrive size={17} strokeWidth={1.6} />,
      iconActive: <HardDrive size={17} strokeWidth={1.8} />,
      label: 'Driver',
      descricao: 'Navegue seu Google Drive e registre suas outras nuvens (OneDrive, contas extras) num só lugar.',
      accent: 'blue',
      novo: true,
    },
    {
      key: 'contas',
      icon: <Wallet size={17} strokeWidth={1.6} />,
      iconActive: <Wallet size={17} strokeWidth={1.8} />,
      label: 'Contas',
      descricao: 'Inventário das suas contas — e-mails, IAs, dev, infra: plano, custo, renovação e onde está a senha.',
      accent: 'lavender',
      novo: true,
    },
    {
      key: 'codex',
      icon: <BookOpen size={17} strokeWidth={1.6} />,
      iconActive: <BookOpen size={17} strokeWidth={1.8} />,
      label: 'Códex',
      descricao: 'Seu DNA de desenvolvimento — padrões de design, stack e código que alimentam a IA.',
      accent: 'sage',
    },
    {
      key: 'receituario',
      icon: <ChefHat size={17} strokeWidth={1.6} />,
      iconActive: <ChefHat size={17} strokeWidth={1.8} />,
      label: 'Receituário',
      descricao: 'Features prontas pra replicar em outros projetos — cada receita tem passo-a-passo.',
      accent: 'peach',
    },
    {
      key: 'hospedagem',
      icon: <Server size={17} strokeWidth={1.6} />,
      iconActive: <Server size={17} strokeWidth={1.8} />,
      label: 'Hospedagem',
      descricao: 'Provedores, free tiers, benefícios e custos pra escolher onde rodar.',
      accent: 'sage',
    },
    {
      key: 'servidores',
      icon: <Cpu size={17} strokeWidth={1.6} />,
      iconActive: <Cpu size={17} strokeWidth={1.8} />,
      label: 'Servidores',
      descricao: 'Instâncias que você roda: proxies LLM, automações, mística, bancos locais e self-hosted.',
      accent: 'sage',
      novo: true,
    },
    {
      key: 'cofre',
      icon: <Shield size={17} strokeWidth={1.6} />,
      iconActive: <Shield size={17} strokeWidth={1.8} />,
      label: 'Cofre',
      descricao: 'Chaves de API e senhas criptografadas ponta-a-ponta — só você descriptografa.',
      accent: 'peach',
    },
  ];

  const ativa = ESTACOES.find((e) => e.key === tab) ?? ESTACOES[0];

  // Renderiza o painel de conteúdo certo. Wrappamos cada um em uma "card" pra
  // dar coesão visual (mesmo background/borda em todos), exceto Skills que já
  // traz a própria moldura via SkillsHubModal embedded.
  const renderConteudo = (): React.ReactNode => {
    switch (tab) {
      case 'guia':
        // O Guia tem moldura própria (cards, gradients) — wrappamos numa card
        // discreta só pra manter consistência com as outras estações.
        return wrapCard(<AtelierGuia irPara={setTab} />);
      case 'skills':
        return <SkillsHubModal embedded />;
      case 'agents':
        return wrapCard(<AgentsHubModal embedded />);
      case 'kits':
        return wrapCard(<KitsHubPanel />);
      case 'snippets':
        return wrapCard(<SnippetsPanel />);
      case 'templates':
        return wrapCard(<TemplatesPanel />);
      case 'bookmarks':
        return wrapCard(<BookmarksPanel />);
      case 'driver':
        return wrapCard(<DriverPanel />);
      case 'contas':
        return wrapCard(<ContasPanel onAbrirCofre={abrirCofre} />);
      case 'codex':
        return wrapCard(<CodexPanel />);
      case 'receituario':
        return wrapCard(<ReceituarioPanel />);
      case 'hospedagem':
        return wrapCard(<HospedagemPanel />);
      case 'servidores':
        return wrapCard(<ServidoresPanel onAbrirCofre={abrirCofre} />);
      case 'cofre':
        return wrapCard(<CofrePanel initialFiltro={cofreFiltro} />);
      default:
        return null;
    }
  };

  function wrapCard(child: React.ReactNode): React.ReactElement {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {child}
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1440, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Atelier"
        subtitle="O kit de bancada do vibe coder. Tudo ao toque dos dedos."
      />

      <div className="forja-subnav-grid" style={{
        display: 'grid',
        gridTemplateColumns: '210px 1fr',
        gap: 24,
        alignItems: 'stretch',
        marginTop: 4,
      }}>
        {/* ─── Sub-nav vertical ──────────────────────────────────────────────
            A moldura estica até o fim do conteúdo (colunas alinhadas), mas a
            lista de botões fica sticky no topo pra continuar visível ao rolar. */}
        <div
          style={{
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            padding: '6px',
            background: mode === 'luz' ? '#FBF8F2' : '#1B1D21',
            border: `1px solid ${t.borderSoft}`,
            borderRadius: 14,
          }}
        >
        <nav
          aria-label="Estações do Atelier"
          style={{
            position: 'sticky',
            top: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {ESTACOES.map((e) => {
            const active = e.key === tab;
            const accentColor = t.accents[e.accent];
            return (
              <button
                key={e.key}
                onClick={() => setTab(e.key)}
                title={e.descricao}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: active ? (mode === 'luz' ? '#F1ECE3' : '#26282C') : 'transparent',
                  color: active ? t.text : t.textSecondary,
                  fontFamily: FONTS.ui,
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  textAlign: 'left',
                  transition: 'background 0.18s, color 0.18s',
                }}
                onMouseEnter={(ev) => { if (!active) ev.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
                onMouseLeave={(ev) => { if (!active) ev.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  display: 'inline-flex',
                  color: active ? accentColor : t.textTertiary,
                  transition: 'color 0.18s',
                }}>
                  {active ? e.iconActive : e.icon}
                </span>
                <span style={{ flex: 1 }}>{e.label}</span>
                {e.novo && (
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.08em',
                    padding: '2px 6px', borderRadius: 999,
                    background: `${t.accents.peach}22`,
                    color: t.accents.peach,
                    border: `1px solid ${t.accents.peach}44`,
                    textTransform: 'uppercase',
                  }}>
                    novo
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Selo de bancada — preenche o rodapé da moldura com um toque clássico,
            ancorado embaixo (marginTop auto). Escondido no mobile (faixa horizontal). */}
        <div
          className="forja-atelier-mark"
          aria-hidden="true"
          style={{
            marginTop: 'auto',
            paddingTop: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
            opacity: 0.4,
            userSelect: 'none',
          }}
        >
          <span style={{
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${t.borderSoft}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: t.textTertiary,
          }}>
            <Hammer size={14} strokeWidth={1.6} />
          </span>
          <span style={{
            fontFamily: FONTS.display, fontSize: 10.5,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: t.textTertiary,
          }}>
            Forja
          </span>
        </div>
        </div>

        {/* ─── Conteúdo da estação ativa ────────────────────────────────────── */}
        <div style={{ minWidth: 0 /* evita overflow horizontal de tabelas */ }}>
          {/* Cabeçalho contextual: nome da estação + descrição. Substitui o
              subtitle inline das tabs antigas, fica mais respirado. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4,
            }}>
              <span style={{ color: t.accents[ativa.accent], display: 'inline-flex' }}>
                {ativa.iconActive}
              </span>
              <h2 style={{
                fontFamily: FONTS.display, fontSize: 19, fontWeight: 500,
                margin: 0, color: t.text, letterSpacing: '-0.01em',
              }}>
                {ativa.label}
              </h2>
            </div>
            <div style={{
              fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary,
              paddingLeft: 28,
            }}>
              {ativa.descricao}
            </div>
          </div>
          {renderConteudo()}
        </div>
      </div>
    </div>
  );
}
