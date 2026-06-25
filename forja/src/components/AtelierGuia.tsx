import React, { useEffect, useRef, useState } from 'react';
import { Spin, Tooltip } from 'antd';
import {
  BookMarked, Server, Shield, Code2, FileText, Bookmark, BookOpen, ChefHat,
  CheckCircle2, Circle, ArrowRight, Sparkles, Compass, Flame, ChevronDown, Trophy,
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

  // Setup completo → colapsa o módulo (mostra só o 5/5). O user pode reabrir pra
  // revisar. Assim que os stats chegam, ajustamos uma vez; depois é manual.
  const [setupAberto, setSetupAberto] = useState(false);
  const ajustadoRef = useRef(false);
  useEffect(() => {
    if (stats && !ajustadoRef.current) { setSetupAberto(!completo); ajustadoRef.current = true; }
  }, [stats, completo]);

  // Toque "vivo": saudação por horário do dia.
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const peach = t.accents.peach;
  const sage = t.accents.sage;

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @keyframes forjaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes forjaGlowRing{0%,100%{box-shadow:0 0 0 0 ${sage}00}50%{box-shadow:0 0 0 7px ${sage}26}}
        @keyframes forjaPop{0%{transform:scale(.55);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        @keyframes forjaShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      `}</style>
      {/* ─── Bloco de boas-vindas ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '15px 18px', borderRadius: 14,
        background: mode === 'luz'
          ? 'linear-gradient(135deg, #FBF8F2 0%, #F5F0E5 100%)'
          : 'linear-gradient(135deg, #1F2023 0%, #232427 100%)',
        border: `1px solid ${t.borderSoft}`,
        marginBottom: 18,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${peach}1A`,
          color: peach,
          flexShrink: 0,
          animation: 'forjaFloat 4.5s ease-in-out infinite',
        }}>
          {completo ? <Flame size={20} strokeWidth={1.7} /> : <Compass size={20} strokeWidth={1.7} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 18, fontWeight: 500,
            color: t.text, marginBottom: 2, letterSpacing: '-0.01em',
          }}>
            {completo ? 'Seu Atelier está no ponto' : `${saudacao} — bem-vindo ao seu Atelier`}
          </div>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary,
            lineHeight: 1.5, maxWidth: 720,
          }}>
            {completo
              ? 'Tudo configurado: a IA tem o seu contexto, suas receitas e padrões estão à mão e seus segredos protegidos. Agora é só forjar.'
              : 'Sua bancada de vibe coder: padrões, skills, receitas, snippets, provedores e segredos — tudo num lugar só. Use o guia pra descobrir por onde começar.'}
          </div>
        </div>
      </div>

      {/* ─── Setup recomendado ───────────────────────────────────────────────
          Enquanto não está 5/5, mostra o checklist completo. Ao completar,
          colapsa num cartão comemorativo (só o 5/5), reabrível pra revisar. */}
      {completo ? (
        <div style={{
          borderRadius: 14, marginBottom: 18, overflow: 'hidden',
          border: `1px solid ${sage}55`,
          background: mode === 'luz'
            ? `linear-gradient(135deg, ${sage}14 0%, ${sage}08 100%)`
            : `linear-gradient(135deg, ${sage}1f 0%, ${sage}0d 100%)`,
        }}>
          <button
            onClick={() => setSetupAberto((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${sage}22`, color: sage,
              animation: 'forjaPop .5s ease both, forjaGlowRing 2.8s ease-in-out infinite',
            }}>
              <Trophy size={20} strokeWidth={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 500, color: t.text,
              }}>
                Setup completo
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 11, color: sage,
                  background: `${sage}1f`, border: `1px solid ${sage}55`,
                  borderRadius: 999, padding: '1px 9px', letterSpacing: 0.4,
                }}>
                  {feitos}/{CHECKLIST.length} completo
                </span>
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
                Seu Atelier está no ponto. {setupAberto ? 'Toque pra recolher.' : 'Toque pra revisar os passos.'}
              </div>
            </div>
            <ChevronDown
              size={18} strokeWidth={1.8}
              style={{ color: t.textTertiary, flexShrink: 0, transition: 'transform .2s', transform: setupAberto ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {setupAberto && (
            <div style={{ padding: '0 14px 12px', display: 'grid', gap: 6 }}>
              {CHECKLIST.map((c) => (
                <ChecklistRow key={c.id} item={c} feito={stats ? c.feito(stats) : false} t={t} mode={mode} onClick={() => irPara(c.irPara)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '16px 20px', borderRadius: 14,
          background: t.surfaceMuted,
          border: `1px solid ${t.borderSoft}`,
          marginBottom: 18,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text,
              }}>
                <Sparkles size={15} strokeWidth={1.7} style={{ color: sage }} />
                Setup recomendado
              </div>
              <div style={{
                fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary,
                marginTop: 2,
              }}>
                5 passos pra deixar o Atelier no ponto. Não precisa ser hoje.
              </div>
            </div>
            {carregando ? (
              <Spin size="small" />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary,
              }}>
                <span>{feitos}/{CHECKLIST.length}</span>
                <div style={{
                  width: 110, height: 6, borderRadius: 999,
                  background: t.borderSoft, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressoPct}%`, height: '100%',
                    background: sage,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {CHECKLIST.map((c) => (
              <ChecklistRow key={c.id} item={c} feito={stats ? c.feito(stats) : false} t={t} mode={mode} onClick={() => irPara(c.irPara)} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Cabeçalho da grade de estações ──────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text,
          marginBottom: 2,
        }}>
          As 8 estações do Atelier
        </div>
        <div style={{
          fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary,
        }}>
          Cada card abaixo abre a estação correspondente. Comece pelo que faz mais sentido agora.
        </div>
      </div>

      {/* ─── Grade de cards (amostragem compacta das estações) ───────────────
          Cada card é uma "amostra" da estação: ícone, contagem, o que é e CTA.
          O "quando usar" e o passo-a-passo completo vivem dentro de cada estação
          (e aparecem no tooltip), pra a landing não ficar densa demais. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))',
        gap: 12,
      }}>
        {CARDS.map((c) => {
          const accent = t.accents[c.accent];
          const n = stats ? c.contagem(stats) : 0;
          const rotulo = `${n} ${c.rotuloContagem}${n === 1 ? '' : 's'}`;
          const vazio = n === 0;
          return (
            <Tooltip
              key={c.tab}
              placement="top"
              mouseEnterDelay={0.35}
              title={<span style={{ fontFamily: FONTS.ui, fontSize: 12 }}><strong>Quando usar:</strong> {c.quandoUsar}</span>}
            >
              <button
                onClick={() => irPara(c.tab)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  padding: '14px 16px', borderRadius: 14,
                  background: t.surface,
                  border: `1px solid ${t.borderSoft}`,
                  cursor: 'pointer', textAlign: 'left', height: '100%',
                  transition: 'border-color 0.18s, transform 0.18s, box-shadow 0.18s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${accent}66`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = t.shadowSoft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = t.borderSoft;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Faixa de accent fininha no topo */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: accent, opacity: 0.6,
                }} />

                {/* Header: ícone + título + contagem */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accent}1A`, color: accent,
                    flexShrink: 0,
                  }}>
                    {c.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 500,
                      color: t.text, letterSpacing: '-0.005em',
                    }}>
                      {c.titulo}
                    </div>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 10.5,
                      color: vazio ? t.textTertiary : accent,
                      marginTop: 1, letterSpacing: 0.3,
                    }}>
                      {carregando ? '—' : rotulo}
                    </div>
                  </div>
                </div>

                {/* O que é (curto, limitado a 3 linhas) */}
                <div style={{
                  fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary,
                  lineHeight: 1.5, marginBottom: 12, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {c.oQueE}
                </div>

                {/* CTA + badge "vazio" */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: FONTS.ui, fontSize: 12, fontWeight: 500, color: accent,
                  }}>
                    Abrir {c.titulo}
                    <ArrowRight size={13} strokeWidth={2} />
                  </span>
                  {!carregando && vazio && (
                    <span style={{
                      fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.4,
                      color: t.textTertiary, background: t.surfaceMuted,
                      border: `1px solid ${t.borderSoft}`, borderRadius: 999, padding: '1px 7px',
                    }}>
                      vazio
                    </span>
                  )}
                </div>
              </button>
            </Tooltip>
          );
        })}
      </div>

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

function estadoZerado(): AtelierStats {
  return {
    skills: 0, snippets: 0, templates: 0, bookmarks: 0,
    codex: 0, codexNaIa: 0, receituario: 0,
    hospedagem: 0, cofre: 0,
  };
}
