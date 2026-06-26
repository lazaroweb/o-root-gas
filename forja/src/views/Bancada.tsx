import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Segmented, Button, Row, Col, Spin, Alert, Space, App as AntApp, Popconfirm } from 'antd';
import { Plus, FileCode, RefreshCw, CloudOff, Trash2, GitBranch } from 'lucide-react';
import SystemCard, { type BacklogSumarioItem } from '../components/SystemCard';
import ConectarReposModal from '../components/ConectarReposModal';
import { PageHeader, EmptyArt } from '../components/ui';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { Sistema, Estagio, ServerResponse, ServerResult } from '../types';

interface SyncResult {
  novos: number;
  novosLista: Array<{ scriptId: string; nome: string }>;
  removidos: Array<{ id: string; nome: string }>;
  renomeados: Array<{ id: string; de: string; para: string }>;
  restaurados: number;
  selfVinculado?: boolean;
  ultimaSync: string;
}

interface AuditSumarioItem { criadoEm: string; numFindings: number; modeloUsado: string }
type AuditSumario = Record<string, AuditSumarioItem>;
type BacklogSumario = Record<string, BacklogSumarioItem>;

interface BancadaProps {
  onSelectSistema: (id: string) => void;
  onNewSistema: () => void;
  onImportGAS?: () => void;
  refreshKey?: number;
}

type FilterOption = 'todos' | Estagio;

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'todos' },
  { label: 'Faísca', value: 'faisca' },
  { label: 'Forja', value: 'forja' },
  { label: 'Têmpera', value: 'tempera' },
  { label: 'Prateleira', value: 'prateleira' },
];

const MOCK: Sistema[] = [
  { id: '1', nome: 'ClientFlow', codinome: 'cflow', estagio: 'tempera', proposito: 'CRM simplificado para freelancers', stack: 'Next.js, Supabase, Vercel', urlProd: 'https://clientflow.app', scoreSaude: 92 },
  { id: '2', nome: 'FORJA', codinome: 'forja', estagio: 'forja', proposito: 'Central de comando e governança de sistemas', stack: 'GAS, React, TypeScript', urlProd: '', scoreSaude: 85 },
  { id: '3', nome: 'QuoteForge', codinome: 'qforge', estagio: 'faisca', proposito: 'Gerador de propostas com IA', stack: '', urlProd: '', scoreSaude: 0 },
];

export default function Bancada({ onSelectSistema, onNewSistema, onImportGAS, refreshKey = 0 }: BancadaProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [filter, setFilter] = useState<FilterOption>('todos');
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [auditSumario, setAuditSumario] = useState<AuditSumario>({});
  const [backlogSumario, setBacklogSumario] = useState<BacklogSumario>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [conectarReposOpen, setConectarReposOpen] = useState(false);

  const semRepo = useMemo(() => sistemas.filter((s) => !String(s.repoUrl || '').trim()).length, [sistemas]);

  const carregarSistemas = useCallback(() => {
    return callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); else setError(res.error || 'Erro'); })
      .catch(() => setSistemas(MOCK));
  }, []);

  const carregar = useCallback(() => {
    setLoading(true);
    carregarSistemas().finally(() => setLoading(false));
    callServer<ServerResult>('getAuditoriasSumario')
      .then((r) => { if (r.ok && r.data) setAuditSumario(r.data as AuditSumario); })
      .catch(() => { /* preview */ });
    callServer<ServerResult>('getBacklogSumario')
      .then((r) => { if (r.ok && r.data) setBacklogSumario(r.data as BacklogSumario); })
      .catch(() => { /* preview */ });
  }, [carregarSistemas]);

  const sincronizar = useCallback((quiet: boolean) => {
    if (!quiet) setSyncing(true);
    callServer<ServerResult>('sincronizarGAS')
      .then((r) => {
        if (!r.ok) {
          if (!quiet) {
            const err = r.error || 'Erro ao sincronizar';
            if (err.startsWith('AUTH_NEEDED::')) message.warning('Autorize o acesso ao Google Apps Script para sincronizar.');
            else message.error(err);
          }
          return;
        }
        const data = r.data as SyncResult;
        const renomeados = data.renomeados || [];
        const mudou = data.novos > 0 || data.removidos.length > 0 || data.restaurados > 0 || renomeados.length > 0 || !!data.selfVinculado;
        if (mudou) { setSync(data); carregarSistemas(); }
        if (!quiet) {
          if (!mudou) message.success('Tudo sincronizado — nada novo.');
          else {
            const partes: string[] = [];
            if (data.novos > 0) partes.push(`${data.novos} novo(s) no GAS`);
            if (renomeados.length > 0) partes.push(`${renomeados.length} renomeado(s)`);
            if (data.removidos.length > 0) partes.push(`${data.removidos.length} removido(s)`);
            if (data.restaurados > 0) partes.push(`${data.restaurados} restaurado(s)`);
            message.info(partes.join(' · '));
          }
        }
      })
      .catch(() => { if (!quiet) message.error('Erro ao sincronizar'); })
      .finally(() => { if (!quiet) setSyncing(false); });
  }, [carregarSistemas, message]);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);
  // Sync automático leve ao abrir a sessão Sistemas (silencioso).
  useEffect(() => { sincronizar(true); }, [sincronizar]);

  const removerSistema = (id: string, nome: string) => {
    callServer<ServerResult>('removerSistema', id).then((r) => {
      if (r.ok) {
        message.success(`${nome} removido do Forja`);
        setSync((prev) => prev ? { ...prev, removidos: prev.removidos.filter((x) => x.id !== id) } : prev);
        carregarSistemas();
      } else message.error(r.error || 'Erro ao remover');
    });
  };

  const manterSistema = (id: string, nome: string) => {
    callServer<ServerResult>('descartarFlagRemocaoGas', id).then((r) => {
      if (r.ok) {
        message.success(`${nome} mantido — aviso descartado`);
        setSync((prev) => prev ? { ...prev, removidos: prev.removidos.filter((x) => x.id !== id) } : prev);
        carregarSistemas();
      } else message.error(r.error || 'Erro');
    });
  };

  const filtered = useMemo(() => (filter === 'todos' ? sistemas : sistemas.filter(s => s.estagio === filter)), [sistemas, filter]);

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1240, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Sistemas"
        subtitle="Seu portfólio de apps, do primeiro rascunho à prateleira."
        extra={
          <Space>
            <Button icon={<RefreshCw size={15} />} loading={syncing} onClick={() => sincronizar(false)}>Sincronizar</Button>
            {semRepo > 0 && <Button icon={<GitBranch size={15} />} onClick={() => setConectarReposOpen(true)}>Conectar repos ({semRepo})</Button>}
            {onImportGAS && <Button icon={<FileCode size={16} />} onClick={onImportGAS}>Importar do GAS</Button>}
            <Button type="primary" icon={<Plus size={16} />} onClick={onNewSistema}>Novo sistema</Button>
          </Space>
        }
      />

      {/* Banner de sync: novos projetos no GAS pra importar */}
      {sync && sync.novos > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, border: `1px solid ${t.accents.blue}44`, background: `linear-gradient(135deg, ${t.accents.blue}12, ${t.surface})`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: `${t.accents.blue}22`, color: t.accents.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileCode size={18} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>{sync.novos} projeto(s) novo(s) no seu GAS</div>
            <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 1 }}>Ainda não estão na sua bancada — importe pra acompanhar.</div>
          </div>
          {onImportGAS && <Button type="primary" size="small" icon={<FileCode size={14} />} onClick={onImportGAS}>Importar</Button>}
        </div>
      )}

      {/* Banner de sync: nomes atualizados a partir do GAS */}
      {sync && sync.renomeados && sync.renomeados.length > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, border: `1px solid ${t.accents.sage}44`, background: `linear-gradient(135deg, ${t.accents.sage}10, ${t.surface})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: sync.renomeados.length > 0 ? 8 : 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: `${t.accents.sage}22`, color: t.accents.sage, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RefreshCw size={17} strokeWidth={1.8} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>{sync.renomeados.length} nome(s) atualizado(s) a partir do GAS</div>
              <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 1 }}>As nomenclaturas atuais já foram aplicadas na bancada.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sync.renomeados.map((r) => (
              <span key={r.id} style={{ fontSize: 12, color: t.textSecondary, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{r.de || '(sem nome)'}</span>
                {'  →  '}
                <span style={{ color: t.text, fontWeight: 600 }}>{r.para}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Banner de sync: apps removidos no GAS (não-destrutivo) */}
      {sync && sync.removidos.length > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, border: `1px solid ${t.accents.rose}44`, background: `linear-gradient(135deg, ${t.accents.rose}10, ${t.surface})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: `${t.accents.rose}22`, color: t.accents.rose, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CloudOff size={18} strokeWidth={1.8} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>{sync.removidos.length} app(s) não existem mais no GAS</div>
              <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 1 }}>A governança foi preservada. Decida remover do Forja ou manter o registro.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sync.removidos.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.text, fontWeight: 500 }}>{r.nome || '(sem nome)'}</span>
                <Button size="small" onClick={() => manterSistema(r.id, r.nome)}>Manter</Button>
                <Popconfirm title={`Remover "${r.nome}" do Forja?`} description="Isso apaga o sistema da sua bancada." okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => removerSistema(r.id, r.nome)}>
                  <Button size="small" danger icon={<Trash2 size={13} />}>Remover</Button>
                </Popconfirm>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner descobridor: só aparece se a bancada está vazia (loaded sem sistemas) */}
      {!loading && !error && sistemas.length === 0 && (
        <div style={{ marginBottom: 22, padding: '18px 22px', borderRadius: 16, border: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${t.accents.blue}10, ${t.surface})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: `${t.accents.blue}22`, color: t.accents.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileCode size={20} strokeWidth={1.7} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text }}>Você já tem apps no Apps Script?</div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>Importa em 1 clique: a Forja puxa nome, link do web app e marca pra você acompanhar.</div>
            </div>
            {onImportGAS && <Button type="primary" icon={<FileCode size={15} />} onClick={onImportGAS}>Importar do GAS</Button>}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <Segmented options={FILTER_OPTIONS} value={filter} onChange={(val) => setFilter(val as FilterOption)} />
      </div>

      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
      ) : error ? (
        <Alert type="error" message={error} showIcon />
      ) : filtered.length === 0 ? (
        sistemas.length === 0 ? (
          <EmptyArt
            icon={<Plus size={26} strokeWidth={1.6} />}
            titulo="Sua bancada está vazia"
            descricao="Crie um sistema do zero ou importe os que você já tem no Google Apps Script."
            acao={
              <Space>
                <Button type="primary" icon={<Plus size={16} />} onClick={onNewSistema}>Novo sistema</Button>
                {onImportGAS && <Button icon={<FileCode size={16} />} onClick={onImportGAS}>Importar do GAS</Button>}
              </Space>
            }
          />
        ) : (
          <EmptyArt
            icon={<Plus size={26} strokeWidth={1.6} />}
            titulo="Nada neste estágio"
            descricao="Mude o filtro acima ou cadastre um novo sistema."
          />
        )
      ) : (
        <Row gutter={[18, 18]}>
          {filtered.map(sistema => (
            <Col xs={24} sm={12} lg={8} key={sistema.id}>
              <SystemCard
                sistema={sistema}
                onClick={onSelectSistema}
                auditoria={auditSumario[sistema.id] || null}
                backlog={backlogSumario[sistema.id] || null}
              />
            </Col>
          ))}
        </Row>
      )}

      <ConectarReposModal
        open={conectarReposOpen}
        onClose={() => setConectarReposOpen(false)}
        onDone={() => carregar()}
      />
    </div>
  );
}
