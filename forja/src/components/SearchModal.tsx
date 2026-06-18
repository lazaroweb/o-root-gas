import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, Input, Tag, Spin } from 'antd';
import {
  Search, Boxes, Lightbulb, Users, Rocket,
  LayoutDashboard, Activity, Wallet, Sparkles, Settings, Plus, CornerDownLeft, Compass, FileCode, FileText, Download, Printer, BookMarked, Wrench, Server, Shield, Code2, Bookmark,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse, ViewName } from '../types';

interface SearchResult {
  tipo: string;
  id: string;
  titulo: string;
  subtitulo: string;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: React.ReactNode;
  color: string;
  run: () => void;
}

interface FlatItem {
  key: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  tag: string;
  run: () => void;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tipo: string, id: string) => void;
  onNavigate: (view: ViewName) => void;
  onImportGAS?: () => void;
  onSkillsOpen?: () => void;
}

export default function SearchModal({ open, onClose, onSelect, onNavigate, onImportGAS, onSkillsOpen }: SearchModalProps): React.ReactElement {
  const t = useTokens();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    sistema: { icon: <Boxes size={16} strokeWidth={1.6} />, color: t.accents.peach, label: 'Sistema' },
    ideia: { icon: <Lightbulb size={16} strokeWidth={1.6} />, color: t.accents.clay, label: 'Ideia' },
    pessoa: { icon: <Users size={16} strokeWidth={1.6} />, color: t.accents.blue, label: 'Pessoa' },
    oportunidade: { icon: <Rocket size={16} strokeWidth={1.6} />, color: t.accents.sage, label: 'Oportunidade' },
  };

  const go = useCallback((view: ViewName) => { onNavigate(view); onClose(); }, [onNavigate, onClose]);

  const commands: Command[] = useMemo(() => {
    const i = (node: React.ReactNode) => node;
    return [
      { id: 'nav-dashboard', label: 'Dashboard', hint: 'Visão geral', keywords: 'home inicio painel', icon: i(<LayoutDashboard size={16} strokeWidth={1.6} />), color: t.accents.peach, run: () => go('dashboard') },
      { id: 'nav-clientes', label: 'Clientes', hint: 'CRM e discovery', keywords: 'crm contatos entrevistas discovery', icon: i(<Users size={16} strokeWidth={1.6} />), color: t.accents.blue, run: () => go('clientes') },
      { id: 'nav-ideias', label: 'Ideias', hint: 'Banco de ideias', keywords: 'faisca backlog', icon: i(<Lightbulb size={16} strokeWidth={1.6} />), color: t.accents.clay, run: () => go('ideias') },
      { id: 'nav-sistemas', label: 'Sistemas', hint: 'Bancada de apps', keywords: 'apps projetos bancada', icon: i(<Boxes size={16} strokeWidth={1.6} />), color: t.accents.peach, run: () => go('sistemas') },
      { id: 'nav-operacoes', label: 'Operações', hint: 'Status, APIs, GitHub', keywords: 'status api github monitor uptime', icon: i(<Activity size={16} strokeWidth={1.6} />), color: t.accents.sage, run: () => go('operacoes') },
      { id: 'nav-financeiro', label: 'Financeiro', hint: 'MRR, custos, lucro', keywords: 'dinheiro receita custo mrr contas', icon: i(<Wallet size={16} strokeWidth={1.6} />), color: t.accents.sage, run: () => go('financeiro') },
      { id: 'nav-forja-ia', label: 'Forja IA', hint: 'Assistente, blueprint, diagramas', keywords: 'ia assistente blueprint diagrama conselho prompt', icon: i(<Sparkles size={16} strokeWidth={1.6} />), color: t.accents.rose, run: () => go('forja-ia') },
      { id: 'nav-relatorios', label: 'Relatórios', hint: 'Snapshot mensal + exportação', keywords: 'relatorio mensal pdf exportar csv backup json print imprimir', icon: i(<FileText size={16} strokeWidth={1.6} />), color: t.accents.sage, run: () => go('relatorios') },
      { id: 'nav-atelier', label: 'Atelier', hint: 'Skills, snippets, templates, bookmarks, hospedagem, cofre', keywords: 'atelier vibe skill prompt snippet template bookmark hospedagem provedor cofre senha key vault biblioteca', icon: i(<Wrench size={16} strokeWidth={1.6} />), color: t.accents.lavender, run: () => go('atelier') },
      { id: 'nav-atelier-snippets', label: 'Atelier: Snippets', hint: 'Blocos de código reutilizáveis', keywords: 'snippet codigo code js ts python sql bash react hook util', icon: i(<Code2 size={16} strokeWidth={1.6} />), color: t.accents.blue, run: () => go('atelier') },
      { id: 'nav-atelier-templates', label: 'Atelier: Templates', hint: 'Briefings, PRDs com variáveis', keywords: 'template briefing prd contrato email modelo documento variavel', icon: i(<FileText size={16} strokeWidth={1.6} />), color: t.accents.lavender, run: () => go('atelier') },
      { id: 'nav-atelier-bookmarks', label: 'Atelier: Bookmarks', hint: 'Links, docs, ferramentas salvas', keywords: 'bookmark link favorito url docs tutorial ferramenta inspiracao', icon: i(<Bookmark size={16} strokeWidth={1.6} />), color: t.accents.peach, run: () => go('atelier') },
      { id: 'nav-atelier-host', label: 'Atelier: Hospedagem', hint: 'Catálogo de provedores', keywords: 'hospedagem provedor vercel netlify supabase railway free tier preco', icon: i(<Server size={16} strokeWidth={1.6} />), color: t.accents.sage, run: () => go('atelier') },
      { id: 'nav-atelier-cofre', label: 'Atelier: Cofre', hint: 'Chaves e senhas criptografadas', keywords: 'cofre senha key api password vault criptografia', icon: i(<Shield size={16} strokeWidth={1.6} />), color: t.accents.peach, run: () => go('atelier') },
      { id: 'nav-config', label: 'Configurações', hint: 'IA, GitHub, stacks', keywords: 'settings ajustes proxy chave token', icon: i(<Settings size={16} strokeWidth={1.6} />), color: t.accents.blue, run: () => go('configuracoes') },
      { id: 'act-novo-sistema', label: 'Novo sistema', hint: 'Criar app na bancada', keywords: 'criar adicionar app projeto', icon: i(<Plus size={16} strokeWidth={1.6} />), color: t.accents.peach, run: () => go('sistema-form') },
      { id: 'act-discovery', label: 'Nova entrevista (Discovery)', hint: 'Registrar entrevista', keywords: 'entrevista discovery cliente requisito', icon: i(<Compass size={16} strokeWidth={1.6} />), color: t.accents.blue, run: () => go('clientes') },
      ...(onImportGAS ? [{
        id: 'act-import-gas', label: 'Importar do Google Apps Script', hint: 'Trazer apps que você já tem no GAS',
        keywords: 'gas google apps script importar sincronizar bancada', icon: i(<FileCode size={16} strokeWidth={1.6} />), color: t.accents.blue,
        run: () => { onClose(); onImportGAS(); },
      } as Command] : []),
      ...(onSkillsOpen ? [{
        id: 'act-skills', label: 'Skills (SKILL.md)', hint: 'Biblioteca de prompts e playbooks',
        keywords: 'skill prompt playbook md markdown anthropic cursor agent biblioteca colecao',
        icon: i(<BookMarked size={16} strokeWidth={1.6} />), color: t.accents.lavender,
        run: () => { onClose(); onSkillsOpen(); },
      } as Command] : []),
    ];
  }, [go, t, onImportGAS, onSkillsOpen, onClose]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + ' ' + c.hint + ' ' + c.keywords).toLowerCase().includes(q));
  }, [commands, query]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    callServer<ServerResponse<SearchResult[]>>('buscaGlobal', q)
      .then(res => { if (res.ok && res.data) setResults(res.data); else setResults([]); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, doSearch]);

  useEffect(() => { if (!open) { setQuery(''); setResults([]); setActive(0); } }, [open]);

  const items: FlatItem[] = useMemo(() => {
    const cmds: FlatItem[] = filteredCommands.map((c) => ({
      key: c.id, icon: c.icon, color: c.color, title: c.label, subtitle: c.hint, tag: 'Ir para', run: c.run,
    }));
    const ents: FlatItem[] = results.map((r) => {
      const cfg = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.sistema;
      return {
        key: `${r.tipo}-${r.id}`, icon: cfg.icon, color: cfg.color, title: r.titulo, subtitle: r.subtitulo, tag: cfg.label,
        run: () => { onSelect(r.tipo, r.id); onClose(); },
      };
    });
    return [...cmds, ...ents];
  }, [filteredCommands, results]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(0); }, [query, results.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.run(); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const firstEntityIdx = filteredCommands.length;

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={560} styles={{ body: { padding: 0 } }} style={{ top: 88 }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.borderSoft}` }}>
        <Input
          prefix={<Search size={18} strokeWidth={1.6} color={t.textTertiary} style={{ marginRight: 6 }} />}
          suffix={loading ? <Spin size="small" /> : null}
          placeholder="Buscar ou navegar — sistemas, ideias, clientes, ações..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          variant="borderless"
          autoFocus
          style={{ fontSize: 16 }}
        />
      </div>

      <div ref={listRef} style={{ maxHeight: 420, overflow: 'auto', padding: '6px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
            {loading ? 'Buscando...' : 'Nenhum resultado'}
          </div>
        ) : (
          items.map((item, idx) => {
            const isActive = idx === active;
            const showHeader = idx === 0 || idx === firstEntityIdx;
            const headerLabel = idx === 0 ? 'Ir para' : 'Resultados';
            return (
              <React.Fragment key={item.key}>
                {showHeader && (idx === 0 ? filteredCommands.length > 0 : results.length > 0) && (
                  <div style={{ padding: '8px 18px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textTertiary }}>
                    {headerLabel}
                  </div>
                )}
                <div
                  data-idx={idx}
                  onClick={() => item.run()}
                  onMouseEnter={() => setActive(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', cursor: 'pointer',
                    background: isActive ? t.surfaceMuted : 'transparent',
                    borderLeft: `2px solid ${isActive ? item.color : 'transparent'}`,
                    transition: 'background 0.12s',
                  }}
                >
                  <span style={{ color: item.color, display: 'inline-flex' }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: t.text, fontSize: 14 }}>{item.title}</span>
                    {item.subtitle && <span style={{ color: t.textTertiary, fontSize: 11.5, marginLeft: 8 }}>{item.subtitle}</span>}
                  </div>
                  {isActive
                    ? <CornerDownLeft size={14} color={t.textTertiary} />
                    : <Tag bordered={false} style={{ fontSize: 10, margin: 0, background: `${item.color}1a`, color: item.color }}>{item.tag}</Tag>}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div style={{ padding: '10px 18px', borderTop: `1px solid ${t.borderSoft}`, display: 'flex', gap: 16 }}>
        <span style={{ color: t.textTertiary, fontSize: 10, fontFamily: FONTS.mono }}>↑↓ Navegar</span>
        <span style={{ color: t.textTertiary, fontSize: 10, fontFamily: FONTS.mono }}>↵ Selecionar</span>
        <span style={{ color: t.textTertiary, fontSize: 10, fontFamily: FONTS.mono }}>ESC Fechar</span>
      </div>
    </Modal>
  );
}
