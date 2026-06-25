import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer, Tooltip } from 'antd';
import {
  BookMarked, Server, Shield, Code2, FileText, Bookmark, BookOpen, ChefHat,
  CheckCircle2, Circle, ArrowRight, Sparkles, Compass, Flame, Trophy,
  Layers, Crown, Activity,
} from 'lucide-react';
import { useTokens, useForja } from '../themeContext';
import { FONTS } from '../theme';
import type { ForjaTokens } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { AtelierTab } from '../views/Atelier';

// ─── AtelierGuia ─────────────────────────────────────────────────────────────
// Landing do Atelier. Função: orientar quem chega — explica pra que serve cada
// estação, sugere um roteiro inicial ("Setup recomendado") e mostra o estado
// atual (quantos itens cada estação já tem). Tudo navegável: clicar num card
// leva direto pra estação correspondente.
//
// Por que isso existe: o Atelier ficou rico (8 estações) e sem um guia,
// quem abre pela primeira vez não sabe por onde começar. Aqui resolvemos isso
// SEM polui com tour interativo — apenas uma landing densa, premium e útil.

interface AtelierGuiaProps {
  irPara: (tab: AtelierTab) => void;
}

interface AtelierStats {
  skills: number;
  snippets: number;
  templates: number;
  bookmarks: number;
  codex: number;
  codexNaIa: number;
  receituario: number;
  hospedagem: number;
  cofre: number;
}

interface CardEstacao {
  tab: AtelierTab;
  titulo: string;
  icon: React.ReactNode;
  accent: 'sage' | 'blue' | 'lavender' | 'peach' | 'rose' | 'clay';
  oQueE: string;
  quandoUsar: string;
  comecarAgora: string[]; // 3 passos máx
  contagem: (s: AtelierStats) => number;
  rotuloContagem: string; // "padrão" => "5 padrões"
}

interface ChecklistItem {
  id: string;
  titulo: string;
  descricao: string;
  feito: (s: AtelierStats) => boolean;
  irPara: AtelierTab;
}

const CARDS: CardEstacao[] = [
  {
    tab: 'codex',
    titulo: 'Códex',
    icon: <BookOpen size={20} strokeWidth={1.7} />,
    accent: 'sage',
    oQueE: 'Seu DNA de desenvolvimento — padrões de design, stack, código e convenções que você usa em todo projeto.',
    quandoUsar: 'Quando quiser que a IA gere algo no SEU estilo, com SEUS padrões. Marca o card como "incluir em IA" e ele entra no contexto.',
    comecarAgora: [
      'Clica "Importar padrões do Forja" pra começar com a base já cadastrada',
      'Adiciona seus padrões — fonte preferida, paleta, ícones',
      'Marca os essenciais como "incluir em IA"',
    ],
    contagem: (s) => s.codex,
    rotuloContagem: 'padrão',
  },
  {
    tab: 'receituario',
    titulo: 'Receituário',
    icon: <ChefHat size={20} strokeWidth={1.7} />,
    accent: 'peach',
    oQueE: 'Features prontas pra replicar em outros projetos — autenticação, billing, notificações. Cada receita tem passo-a-passo.',
    quandoUsar: 'Quando começar um sistema novo e quiser pular boilerplate. Copia, adapta, segue.',
    comecarAgora: [
      'Explora as 18 receitas iniciais por categoria',
      'Filtra por stack pra ver só o que se aplica ao seu projeto',
      'Anota suas próprias receitas conforme implementa',
    ],
    contagem: (s) => s.receituario,
    rotuloContagem: 'receita',
  },
  {
    tab: 'skills',
    titulo: 'Skills',
    icon: <BookMarked size={20} strokeWidth={1.7} />,
    accent: 'lavender',
    oQueE: 'Prompts, playbooks e arquivos SKILL.md da sua biblioteca pessoal — instruções reutilizáveis pra a IA executar tarefas específicas.',
    quandoUsar: 'Pra padronizar como você pede coisas pra IA. Ex: "revisão de código", "geração de testes", "audit de segurança".',
    comecarAgora: [
      'Upload de SKILL.md do Google Drive ou cola conteúdo direto',
      'Marca categoria (review, gerar, audit, etc.)',
      'Acessa rápido sempre que precisar invocar a skill',
    ],
    contagem: (s) => s.skills,
    rotuloContagem: 'skill',
  },
  {
    tab: 'snippets',
    titulo: 'Snippets',
    icon: <Code2 size={20} strokeWidth={1.7} />,
    accent: 'blue',
    oQueE: 'Blocos de código que você reusa sempre — funções utilitárias, configs, hooks. Copia na velocidade do pensamento.',
    quandoUsar: 'Quando perceber que copiou o mesmo pedaço de código pela terceira vez. Salva aqui.',
    comecarAgora: [
      'Adiciona seu snippet mais frequente (debounce, fetch wrapper, etc.)',
      'Marca a linguagem pra busca rápida',
      'Tagueia por contexto (react, node, css, etc.)',
    ],
    contagem: (s) => s.snippets,
    rotuloContagem: 'snippet',
  },
  {
    tab: 'templates',
    titulo: 'Templates',
    icon: <FileText size={20} strokeWidth={1.7} />,
    accent: 'lavender',
    oQueE: 'Briefings, PRDs, emails e contratos com variáveis tipo handlebars ({{cliente}}, {{prazo}}).',
    quandoUsar: 'Pra documentos repetitivos que mudam só uns campos. Briefing pra cliente novo, proposta de projeto, etc.',
    comecarAgora: [
      'Cola um documento que você reescreveu mais de uma vez',
      'Substitui as partes variáveis por {{placeholder}}',
      'Próxima vez: copia, troca os valores, pronto',
    ],
    contagem: (s) => s.templates,
    rotuloContagem: 'template',
  },
  {
    tab: 'bookmarks',
    titulo: 'Bookmarks',
    icon: <Bookmark size={20} strokeWidth={1.7} />,
    accent: 'peach',
    oQueE: 'Docs, tutoriais e ferramentas que você sempre volta — organizado por tag e categoria.',
    quandoUsar: 'Pra parar de procurar no Google a documentação que você consulta toda semana.',
    comecarAgora: [
      'Cola URL da doc/tool',
      'Categoriza (docs, tools, refs, etc.)',
      'Destaca as 5 mais usadas pra ficarem no topo',
    ],
    contagem: (s) => s.bookmarks,
    rotuloContagem: 'bookmark',
  },
  {
    tab: 'hospedagem',
    titulo: 'Hospedagem',
    icon: <Server size={20} strokeWidth={1.7} />,
    accent: 'sage',
    oQueE: 'Catálogo de provedores (Vercel, Railway, Fly.io, etc.) com free tiers, benefícios e custos pra decidir onde rodar.',
    quandoUsar: 'Na hora de deployar um projeto novo — qual provedor cabe no budget e no tipo de carga?',
    comecarAgora: [
      'Importa os provedores padrão (já vem 10+)',
      'Adiciona os que você usa que não tão na lista',
      'Compara free tiers e custos lado a lado',
    ],
    contagem: (s) => s.hospedagem,
    rotuloContagem: 'provedor',
  },
  {
    tab: 'cofre',
    titulo: 'Cofre',
    icon: <Shield size={20} strokeWidth={1.7} />,
    accent: 'peach',
    oQueE: 'Chaves de API e senhas criptografadas ponta-a-ponta — só você descriptografa, nem o Forja consegue ler.',
    quandoUsar: 'Pra centralizar segredos sem precisar de 1Password. Ideal pra chaves de OpenAI, Anthropic, Stripe, etc.',
    comecarAgora: [
      'Define sua master password (NÃO esquece — não tem recovery)',
      'Adiciona suas chaves de API principais',
      'Acessa de qualquer lugar — só sua master destrava',
    ],
    contagem: (s) => s.cofre,
    rotuloContagem: 'entrada',
  },
];

// ─── Checklist de setup recomendado ──────────────────────────────────────────
// Roteiro mínimo pra deixar o Atelier "ligado" — quando os 5 estiverem feitos,
// a IA tem contexto, você tem receitas e padrões pra reusar, e seus segredos
// tão num lugar seguro. Nessa ordem por dependência mental: padrões > skills
// > receitas > infra > segredos.
const CHECKLIST: ChecklistItem[] = [
  {
    id: 'codex',
    titulo: 'Configure o Códex com seus padrões',
    descricao: 'Pelo menos 5 padrões marcados como "incluir em IA". Isso ensina o assistente a falar a sua língua.',
    feito: (s) => s.codexNaIa >= 5,
    irPara: 'codex',
  },
  {
    id: 'skills',
    titulo: 'Adicione 1 Skill da sua biblioteca',
    descricao: 'Um SKILL.md ou playbook que você usa pra dar instruções padronizadas pra IA.',
    feito: (s) => s.skills >= 1,
    irPara: 'skills',
  },
  {
    id: 'receita',
    titulo: 'Marque sua primeira receita favorita',
    descricao: 'Tem 18 prontas — escolhe uma e marca como destaque pra fixar no topo.',
    feito: (s) => s.receituario >= 1,
    irPara: 'receituario',
  },
  {
    id: 'hospedagem',
    titulo: 'Registre seu provedor preferido',
    descricao: 'Mesmo que seja só pra ter o link da dashboard a 1 clique.',
    feito: (s) => s.hospedagem >= 1,
    irPara: 'hospedagem',
  },
  {
    id: 'cofre',
    titulo: 'Guarde 1 chave de API no Cofre',
    descricao: 'A chave do seu LLM principal é um bom começo. Tudo criptografado client-side.',
    feito: (s) => s.cofre >= 1,
    irPara: 'cofre',
  },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AtelierGuia({ irPara }: AtelierGuiaProps): React.ReactElement {
  const t = useTokens();
  const { mode } = useForja();
  const [stats, setStats] = useState<AtelierStats | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    callServer<ServerResult>('getAtelierStats')
      .then((r) => {
        if (!vivo) return;
        if (r.ok && r.data) setStats(r.data as AtelierStats);
        else setStats(estadoZerado());
      })
      .catch(() => { if (vivo) setStats(estadoZerado()); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const feitos = stats ? CHECKLIST.filter((c) => c.feito(stats)).length : 0;
  const progressoPct = stats ? Math.round((feitos / CHECKLIST.length) * 100) : 0;
  const completo = !!stats && feitos === CHECKLIST.length;

  // O guia (explicação + setup) virou um Drawer lateral, acionado por um botão
  // flutuante — pra landing respirar e focar nos indicadores.
  const [guiaOpen, setGuiaOpen] = useState(false);

  // Toque "vivo": saudação por horário do dia.
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const peach = t.accents.peach;
  const sage = t.accents.sage;

  // Indicadores do topo (derivados das contagens das estações).
  const totalItens = stats ? CARDS.reduce((a, c) => a + c.contagem(stats), 0) : 0;
  const estacoesAtivas = stats ? CARDS.filter((c) => c.contagem(stats) > 0).length : 0;
  const noContextoIA = stats ? stats.codexNaIa : 0;
  const dash = carregando ? '—' : undefined;
  // Estação mais cheia (ranking simples por contagem).
  const topEstacao = stats
    ? CARDS.map((c) => ({ titulo: c.titulo, n: c.contagem(stats) })).sort((a, b) => b.n - a.n)[0]
    : null;
  const temTop = !!topEstacao && topEstacao.n > 0;
  // Cobertura da IA: % dos padrões do Códex marcados como "incluir em IA".
  const coberturaIA = stats && stats.codex > 0 ? Math.round((stats.codexNaIa / stats.codex) * 100) : 0;
  const pctAtivas = Math.round((estacoesAtivas / CARDS.length) * 100);
  // Estações ainda vazias (para o tooltip de "Estações ativas").
  const estacoesInativas = stats ? CARDS.filter((c) => c.contagem(stats) === 0).map((c) => c.titulo) : [];

  // Textos de apoio dos gauges (tooltips).
  const dicaSetup: React.ReactNode = (
    <span style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
      {feitos} de {CHECKLIST.length} passos do setup recomendado concluídos. Clique para abrir o guia.
    </span>
  );
  const dicaAtivas: React.ReactNode = (
    <span style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
      {estacoesInativas.length === 0
        ? 'Todas as 8 estações já têm conteúdo. 🎉'
        : <>Faltam encher {estacoesInativas.length}: <strong>{estacoesInativas.join(', ')}</strong>.</>}
    </span>
  );
  const dicaCobertura: React.ReactNode = (
    <span style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
      {stats && stats.codex > 0
        ? <>{stats.codexNaIa} de {stats.codex} padrões do Códex estão marcados para entrar no contexto da IA. Quanto maior, mais a IA conhece seu DNA de desenvolvimento.</>
        : 'Marque padrões do Códex como "incluir na IA" para alimentar o contexto do seu assistente.'}
    </span>
  );

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @keyframes forjaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes forjaPop{0%{transform:scale(.55);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
      `}</style>
      {/* ─── Header enxuto: saudação ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${peach}1A`, color: peach,
          animation: 'forjaFloat 4.5s ease-in-out infinite',
        }}>
          {completo ? <Flame size={19} strokeWidth={1.7} /> : <Compass size={19} strokeWidth={1.7} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 18, fontWeight: 500,
            color: t.text, letterSpacing: '-0.01em',
          }}>
            {completo ? 'Seu Atelier está no ponto' : `${saudacao} — bem-vindo ao seu Atelier`}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginTop: 1 }}>
            Um panorama da sua bancada. Precisa de instruções? Abra o guia logo abaixo.
          </div>
        </div>
      </div>

      {/* ─── Indicadores numéricos ───────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14, marginBottom: 14,
      }}>
        <Kpi t={t} cor={peach} icon={<Layers size={18} strokeWidth={1.7} />}
          valor={dash ?? String(totalItens)} label="itens no total" sub="somando as 8 estações" />
        <Kpi t={t} cor={t.accents.lavender} icon={<Sparkles size={18} strokeWidth={1.7} />}
          valor={dash ?? String(noContextoIA)} label="no contexto da IA" sub="padrões do Códex" />
        <Kpi t={t} cor={t.accents.clay} icon={<Crown size={18} strokeWidth={1.7} />}
          valor={dash ?? (temTop ? String(topEstacao!.n) : '0')}
          label={temTop ? `top: ${topEstacao!.titulo}` : 'estação mais cheia'}
          sub={temTop ? 'mais itens guardados' : 'sem itens ainda'} />
      </div>

      {/* ─── Saúde do Atelier (gauges redondos) ──────────────────────────────
          Métricas de razão viram anéis — brinca com a forma circular sem
          inventar dado: tudo derivado das contagens reais. */}
      <div style={{
        borderRadius: 14, border: `1px solid ${t.borderSoft}`, background: t.surfaceMuted,
        padding: '18px 18px 20px', marginBottom: 22,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 500, color: t.text,
        }}>
          <Activity size={15} strokeWidth={1.8} style={{ color: sage }} />
          Saúde do Atelier
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, justifyItems: 'center' }}>
          <GaugeRing t={t} cor={completo ? sage : t.accents.clay} pct={carregando ? 0 : progressoPct}
            centro={`${feitos}/${CHECKLIST.length}`} label="Setup" sub={completo ? 'tudo pronto' : 'recomendado'}
            dica={dicaSetup} onClick={() => setGuiaOpen(true)} />
          <GaugeRing t={t} cor={t.accents.blue} pct={carregando ? 0 : pctAtivas}
            centro={`${estacoesAtivas}/${CARDS.length}`} label="Estações ativas" sub="com conteúdo"
            dica={dicaAtivas} />
          <GaugeRing t={t} cor={t.accents.lavender} pct={carregando ? 0 : coberturaIA}
            centro={`${coberturaIA}%`} label="Cobertura da IA" sub="padrões na IA"
            dica={dicaCobertura} />
        </div>
      </div>

      {/* As 8 estações agora vivem no Guia (botão flutuante → Drawer), como
          atalhos. A Visão geral fica só com os indicadores. */}

      {/* ─── Rodapé com dica de versionamento ────────────────────────────── */}
      <div style={{
        marginTop: 22, padding: '12px 14px', borderRadius: 10,
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
        fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <Sparkles size={13} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 2, color: t.accents.lavender }} />
        <div>
          <strong style={{ color: t.textSecondary }}>Dica:</strong> tudo aqui é versionado e
          tem rollback. Se um deploy quebrar algo, rode <code style={{
            fontFamily: FONTS.mono, fontSize: 10.5, padding: '1px 4px',
            background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 4,
          }}>npm run rollback -- &lt;versao&gt;</code> no terminal — a URL não muda.
        </div>
      </div>

      {/* ─── Botão flutuante do Guia ─────────────────────────────────────────
          Tira o guia do fluxo da página: pílula fixa (via portal no body, pra
          não ser contida por wrappers), acima do assistente (laranja). */}
      {typeof document !== 'undefined' && createPortal(
        <button
          onClick={() => setGuiaOpen(true)}
          aria-label="Abrir guia de início"
          style={{
            position: 'fixed', right: 22, bottom: 104, zIndex: 1100,
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '9px 16px 9px 11px', borderRadius: 999,
            background: t.surface, color: t.text,
            border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,.22)',
            cursor: 'pointer', fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600,
            transition: 'transform .18s, box-shadow .18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,.28)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.22)'; }}
        >
          <span style={{
            position: 'relative', width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: completo ? `${sage}22` : `${t.accents.lavender}1A`,
            color: completo ? sage : t.accents.lavender,
          }}>
            {completo ? <Trophy size={15} strokeWidth={1.8} /> : <BookOpen size={15} strokeWidth={1.8} />}
            {!completo && !carregando && (
              <span style={{
                position: 'absolute', top: -6, right: -7, minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 999, background: peach, color: '#fff',
                fontFamily: FONTS.mono, fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${t.appBg}`,
              }}>
                {CHECKLIST.length - feitos}
              </span>
            )}
          </span>
          Guia de início
        </button>,
        document.body,
      )}

      {/* ─── Drawer do Guia ──────────────────────────────────────────────── */}
      <Drawer
        title={(
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTS.display }}>
            {completo ? <Trophy size={17} style={{ color: sage }} /> : <BookOpen size={17} style={{ color: t.accents.lavender }} />}
            Guia de início
          </span>
        )}
        placement="right"
        width={Math.min(440, typeof window !== 'undefined' ? window.innerWidth - 40 : 440)}
        open={guiaOpen}
        onClose={() => setGuiaOpen(false)}
      >
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 18 }}>
          O Atelier é sua bancada de vibe coder: <strong>Códex</strong> (seus padrões),
          <strong> Receituário</strong>, <strong>Skills</strong>, <strong>Snippets</strong>,
          <strong> Templates</strong>, <strong>Bookmarks</strong>, <strong>Hospedagem</strong> e
          <strong> Cofre</strong>. Marque os padrões essenciais como "incluir em IA" pra o
          assistente falar a sua língua.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTS.display, fontSize: 14, fontWeight: 500, color: t.text }}>
            <Sparkles size={15} strokeWidth={1.7} style={{ color: sage }} />
            Setup recomendado
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary }}>
            <span>{feitos}/{CHECKLIST.length}</span>
            <div style={{ width: 90, height: 5, borderRadius: 999, background: t.borderSoft, overflow: 'hidden' }}>
              <div style={{ width: `${progressoPct}%`, height: '100%', background: sage, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {completo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: `${sage}14`, border: `1px solid ${sage}44`, marginBottom: 12,
          }}>
            <Trophy size={16} style={{ color: sage }} />
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>Tudo pronto — seu Atelier está no ponto.</span>
          </div>
        )}

        <div style={{ display: 'grid', gap: 4 }}>
          {CHECKLIST.map((c) => (
            <ChecklistRow
              key={c.id}
              item={c}
              feito={stats ? c.feito(stats) : false}
              t={t}
              mode={mode}
              onClick={() => { setGuiaOpen(false); irPara(c.irPara); }}
            />
          ))}
        </div>

        {/* ─── Atalhos das 8 estações ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 8px',
          fontFamily: FONTS.display, fontSize: 14, fontWeight: 500, color: t.text,
        }}>
          <Compass size={15} strokeWidth={1.7} style={{ color: t.accents.lavender }} />
          As 8 estações
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {CARDS.map((c) => (
            <EstacaoLauncher
              key={c.tab}
              card={c}
              n={stats ? c.contagem(stats) : 0}
              carregando={carregando}
              t={t}
              mode={mode}
              onClick={() => { setGuiaOpen(false); irPara(c.tab); }}
            />
          ))}
        </div>
      </Drawer>
    </div>
  );
}

// Linha do checklist (reusada nos dois estados: aberto e completo-expandido).
function ChecklistRow({ item, feito, t, mode, onClick }: {
  item: ChecklistItem; feito: boolean; t: ForjaTokens; mode: 'luz' | 'noturno'; onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 10,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: 'transparent', transition: 'background 0.18s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#FFFFFF80' : '#26282C80'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'inline-flex', color: feito ? t.accents.sage : t.textTertiary, flexShrink: 0 }}>
        {feito ? <CheckCircle2 size={18} strokeWidth={1.8} /> : <Circle size={18} strokeWidth={1.6} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 500,
          color: feito ? t.textSecondary : t.text,
          textDecoration: feito ? 'line-through' : 'none', textDecorationColor: t.textTertiary,
        }}>
          {item.titulo}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 1 }}>
          {item.descricao}
        </div>
      </div>
      <ArrowRight size={14} strokeWidth={1.6} style={{ color: t.textTertiary, flexShrink: 0 }} />
    </button>
  );
}

// Cartão de indicador (KPI) do topo da landing.
function Kpi({ t, cor, icon, valor, label, sub, progresso, destaque, onClick }: {
  t: ForjaTokens; cor: string; icon: React.ReactNode; valor: string; label: string; sub: string;
  progresso?: number; destaque?: boolean; onClick?: () => void;
}): React.ReactElement {
  const clicavel = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clicavel}
      style={{
        position: 'relative', overflow: 'hidden', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '14px 15px', borderRadius: 14,
        background: t.surface, border: `1px solid ${destaque ? `${cor}66` : t.borderSoft}`,
        cursor: clicavel ? 'pointer' : 'default',
        transition: 'border-color .18s, transform .18s, box-shadow .18s',
      }}
      onMouseEnter={clicavel ? (e) => { e.currentTarget.style.borderColor = `${cor}66`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = t.shadowSoft; } : undefined}
      onMouseLeave={clicavel ? (e) => { e.currentTarget.style.borderColor = destaque ? `${cor}66` : t.borderSoft; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } : undefined}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cor, opacity: 0.6 }} />
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${cor}1A`, color: cor,
        ...(destaque ? { animation: 'forjaPop .5s ease both' } : {}),
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: t.text, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {valor}
        </span>
      </div>
      <div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 500, color: t.textSecondary }}>{label}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 1 }}>{sub}</div>
      </div>
      {typeof progresso === 'number' && (
        <div style={{ width: '100%', height: 4, borderRadius: 999, background: t.borderSoft, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${progresso}%`, height: '100%', background: cor, transition: 'width .4s ease' }} />
        </div>
      )}
    </button>
  );
}

// Gauge circular (anel de progresso) — a "forma redonda" dos indicadores.
function GaugeRing({ t, cor, pct, centro, label, sub, dica, onClick }: {
  t: ForjaTokens; cor: string; pct: number; centro: string; label: string; sub: string;
  dica?: React.ReactNode; onClick?: () => void;
}): React.ReactElement {
  const size = 104; const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const off = circ * (1 - p / 100);
  const clicavel = !!onClick;
  const corpo = (
    <div
      onClick={onClick}
      role={clicavel ? 'button' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: clicavel ? 'pointer' : (dica ? 'help' : 'default') }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.borderSoft} strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset .7s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 600, color: t.text, lineHeight: 1, letterSpacing: '-0.01em' }}>{centro}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 500, color: t.textSecondary }}>{label}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
  return dica ? <Tooltip placement="top" title={dica}>{corpo}</Tooltip> : corpo;
}

// Atalho compacto de estação (dentro do Drawer do guia).
function EstacaoLauncher({ card, n, carregando, t, mode, onClick }: {
  card: CardEstacao; n: number; carregando: boolean; t: ForjaTokens; mode: 'luz' | 'noturno'; onClick: () => void;
}): React.ReactElement {
  const accent = t.accents[card.accent];
  const rotulo = `${n} ${card.rotuloContagem}${n === 1 ? '' : 's'}`;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 10px', borderRadius: 10,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: 'transparent', transition: 'background .18s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#00000008' : '#FFFFFF0A'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}1A`, color: accent,
      }}>
        {card.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 500, color: t.text }}>{card.titulo}</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: n ? accent : t.textTertiary, marginTop: 1, letterSpacing: 0.3 }}>{carregando ? '—' : rotulo}</div>
      </div>
      <ArrowRight size={14} strokeWidth={1.7} style={{ color: t.textTertiary, flexShrink: 0 }} />
    </button>
  );
}

function estadoZerado(): AtelierStats {
  return {
    skills: 0, snippets: 0, templates: 0, bookmarks: 0,
    codex: 0, codexNaIa: 0, receituario: 0,
    hospedagem: 0, cofre: 0,
  };
}
