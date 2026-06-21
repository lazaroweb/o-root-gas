import React, { useState, useEffect } from 'react';
import { Modal, Button, Spin, Checkbox } from 'antd';
import { Check, ArrowRight, Sparkles, GitBranch, Users, Lightbulb, Boxes, FileCode, Wrench } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Settings, Pessoa, Ideia, Sistema, ServerResponse, ViewName } from '../types';

interface OnboardingProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewName) => void;
  onImportGAS?: () => void;
}

interface Step {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  color: string;
  done: boolean;
  cta: string;
  action: () => void;
}

export default function Onboarding({ open, onClose, onNavigate, onImportGAS }: OnboardingProps): React.ReactElement {
  const t = useTokens();
  const [loading, setLoading] = useState(true);
  const [naoMostrar, setNaoMostrar] = useState(true);
  const [flags, setFlags] = useState({ ia: false, github: false, cliente: false, ideia: false, sistema: false });

  const carregar = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Settings>>('getSettings').catch(() => ({ ok: false } as ServerResponse<Settings>)),
      callServer<ServerResponse<Pessoa[]>>('getPessoas').catch(() => ({ ok: false } as ServerResponse<Pessoa[]>)),
      callServer<ServerResponse<Ideia[]>>('getIdeias').catch(() => ({ ok: false } as ServerResponse<Ideia[]>)),
      callServer<ServerResponse<Sistema[]>>('getSistemas').catch(() => ({ ok: false } as ServerResponse<Sistema[]>)),
    ]).then(([rs, rp, ri, rsis]) => {
      setFlags({
        ia: !!(rs.ok && rs.data?.llm?.temChave),
        github: !!(rs.ok && rs.data?.github?.temToken),
        cliente: !!(rp.ok && rp.data && rp.data.length > 0),
        ideia: !!(ri.ok && ri.data && ri.data.length > 0),
        sistema: !!(rsis.ok && rsis.data && rsis.data.length > 0),
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (open) carregar(); }, [open]);

  const persistirSeNecessario = () => {
    if (naoMostrar) { try { window.localStorage.setItem('forja_onboarding_done', '1'); } catch { /* ignora */ } }
  };
  const goTo = (view: ViewName) => { persistirSeNecessario(); onNavigate(view); onClose(); };
  const goImport = () => { persistirSeNecessario(); if (onImportGAS) onImportGAS(); else onNavigate('sistemas'); onClose(); };

  const steps: Step[] = [
    { id: 'ia', titulo: 'Conectar a IA', descricao: 'Configure o proxy e a chave para liberar assistente, blueprints e diagramas.', icon: <Sparkles size={18} strokeWidth={1.6} />, color: t.accents.rose, done: flags.ia, cta: 'Configurar IA', action: () => goTo('configuracoes') },
    { id: 'github', titulo: 'Conectar o GitHub', descricao: 'Adicione usuário e token para ver seus repositórios na Forja.', icon: <GitBranch size={18} strokeWidth={1.6} />, color: t.accents.blue, done: flags.github, cta: 'Configurar GitHub', action: () => goTo('configuracoes') },
    { id: 'import-gas', titulo: 'Importar do Google Apps Script', descricao: 'Em 1 clique, traga seus projetos do GAS pra Bancada — com link do web app já preenchido.', icon: <FileCode size={18} strokeWidth={1.6} />, color: t.accents.blue, done: flags.sistema, cta: 'Importar agora', action: goImport },
    { id: 'cliente', titulo: 'Cadastrar um cliente', descricao: 'Registre quem traz as oportunidades e faça o primeiro discovery.', icon: <Users size={18} strokeWidth={1.6} />, color: t.accents.blue, done: flags.cliente, cta: 'Ir para Clientes', action: () => goTo('clientes') },
    { id: 'ideia', titulo: 'Registrar uma ideia', descricao: 'Capture a primeira faísca no banco de ideias.', icon: <Lightbulb size={18} strokeWidth={1.6} />, color: t.accents.clay, done: flags.ideia, cta: 'Ir para Ideias', action: () => goTo('ideias') },
    { id: 'sistema', titulo: 'Cadastrar um sistema', descricao: 'Crie seu primeiro app na bancada com URL e repositório.', icon: <Boxes size={18} strokeWidth={1.6} />, color: t.accents.peach, done: flags.sistema, cta: 'Ir para Sistemas', action: () => goTo('sistemas') },
    { id: 'atelier', titulo: 'Conhecer o Atelier', descricao: 'Seu kit de bancada: Skills, Snippets, Templates ({{vars}}), Bookmarks, Hospedagem e Cofre criptografado. Atalho: g+v', icon: <Wrench size={18} strokeWidth={1.6} />, color: t.accents.lavender, done: false, cta: 'Abrir Atelier', action: () => goTo('atelier') },
  ];

  const feitos = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((feitos / total) * 100);

  const fechar = () => { persistirSeNecessario(); onClose(); };

  return (
    <Modal open={open} onCancel={fechar} footer={null} width={580} styles={{ body: { padding: 0 } }} style={{ top: 70 }}>
      {/* Cabeçalho — marca tratamento Opção B (wordmark + filete + assinatura) */}
      <div style={{ padding: '26px 28px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, letterSpacing: '0.08em', color: t.text, lineHeight: 1 }}>FORJA</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accents.peach, boxShadow: `0 0 8px ${t.accents.peach}` }} />
        </div>
        <div
          aria-hidden
          style={{
            height: 1.5,
            width: 56,
            background: `linear-gradient(90deg, ${t.accents.peach}, ${t.accents.peach}66 70%, transparent)`,
            borderRadius: 1,
            marginBottom: 8,
          }}
        />
        <div style={{ fontSize: 9, fontWeight: 600, color: t.textTertiary, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 28, lineHeight: 1 }}>
          Inteligência de Negócios
        </div>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, margin: '4px 0 6px', color: t.text }}>
          Bem-vindo ao seu QG
        </h2>
        <p style={{ color: t.textSecondary, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Da ideia ao app no ar, num só lugar. Conclua os passos abaixo para deixar tudo pronto.
        </p>

        {/* Progresso */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: t.textTertiary }}>Progresso da configuração</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{feitos}/{total}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: t.surfaceMuted, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${t.accents.peach}, ${t.accents.rose})`, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* Passos */}
      <div style={{ padding: '0 28px', maxHeight: 360, overflow: 'auto' }}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '30px auto' }} />
        ) : (
          steps.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                borderTop: `1px solid ${t.borderSoft}`,
              }}
            >
              <span
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: s.done ? `${t.accents.sage}22` : `${s.color}18`,
                  color: s.done ? t.accents.sage : s.color,
                }}
              >
                {s.done ? <Check size={18} strokeWidth={2} /> : s.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>
                  {s.titulo}
                </div>
                <div style={{ fontSize: 12.5, color: t.textTertiary, lineHeight: 1.5 }}>{s.descricao}</div>
              </div>
              {!s.done && (
                <Button size="small" type="text" onClick={s.action} style={{ color: s.color }}>
                  {s.cta} <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rodapé */}
      <div style={{ padding: '16px 28px', borderTop: `1px solid ${t.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Checkbox checked={naoMostrar} onChange={(e) => setNaoMostrar(e.target.checked)}>
          <span style={{ fontSize: 13, color: t.textSecondary }}>Não mostrar de novo</span>
        </Checkbox>
        <Button type="primary" onClick={fechar}>
          {feitos === total ? 'Tudo pronto!' : 'Começar a usar'}
        </Button>
      </div>
    </Modal>
  );
}
