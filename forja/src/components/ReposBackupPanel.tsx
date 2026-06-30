// ReposBackupPanel — espelha os repositórios do GitHub no Google Drive (v1.232.0).
//
// Fase 1: backup manual (o cliente chama repo a repo pra mostrar progresso e não
//   estourar o limite de 6 min do GAS). Fase 2: agendamento automático por trigger
//   de tempo (diário/semanal). Fase 3 (Google): o destino pode ser uma pasta de
//   Drive Compartilhado — basta colar o ID — pra espelhar dentro do Google.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, App as AntApp, Tag, Empty, Spin, Input, InputNumber, Select, Switch, Tooltip, Progress, Alert } from 'antd';
import { GitBranch, HardDrive, Download, Folder, Clock, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, History, ShieldCheck, Lock } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface UltimoBackup { criadoEm: string; tamanho: number }
interface RepoItem {
  fullName: string;
  nome: string;
  privado: boolean;
  pushedAt: string;
  tamanhoKb: number;
  defaultBranch: string;
  ultimoBackup: UltimoBackup | null;
}
interface HistItem { fullName: string; nome: string; stamp: string; criadoEm: string; tamanho: number; ok?: boolean; erro?: string; url?: string }
interface Agenda { ativo: boolean; freq: string; hora: number; dia: number }
interface Config { manter: number; destinoFolderId: string; destinoNome: string; pastaUrl: string; ultimoRun: string; agendamento: Agenda }
interface Estado { repos: RepoItem[]; githubOk: boolean; githubErro: string; total: number; historico: HistItem[]; config: Config }

function fmtBytes(b: number): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ReposBackupPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [busca, setBusca] = useState('');
  const [repoBusy, setRepoBusy] = useState<string | null>(null);

  // Backup em lote (todos): progresso controlado no cliente.
  const [lote, setLote] = useState<{ ativo: boolean; feito: number; total: number; atual: string; erros: string[] }>({ ativo: false, feito: 0, total: 0, atual: '', erros: [] });

  // Edição de config (rascunho local até salvar).
  const [manter, setManter] = useState<number>(4);
  const [destinoId, setDestinoId] = useState('');
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);

  const carregar = (silencioso = false) => {
    if (!silencioso) setLoading(true);
    callServer<ServerResult>('getReposBackupEstado')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as Estado;
          setEstado(d);
          setManter(d.config.manter);
          setDestinoId(d.config.destinoFolderId || '');
        } else message.error(r.error || 'Erro ao carregar');
      })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const repos = estado?.repos || [];
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [estado, busca]);

  const backupUm = async (fullName: string): Promise<boolean> => {
    setRepoBusy(fullName);
    try {
      const r = await callServer<ServerResult>('backupRepoParaDrive', fullName);
      if (r.ok) { message.success(`Backup de ${fullName} concluído`); carregar(true); return true; }
      message.error(`${fullName}: ${r.error || 'erro'}`);
      return false;
    } catch {
      message.error('Backup só roda no app publicado');
      return false;
    } finally { setRepoBusy(null); }
  };

  const backupTodos = async () => {
    const repos = estado?.repos || [];
    if (!repos.length) return;
    setLote({ ativo: true, feito: 0, total: repos.length, atual: '', erros: [] });
    const erros: string[] = [];
    for (let i = 0; i < repos.length; i++) {
      const full = repos[i].fullName;
      setLote((p) => ({ ...p, atual: full, feito: i }));
      try {
        const r = await callServer<ServerResult>('backupRepoParaDrive', full);
        if (!r.ok) erros.push(`${full}: ${r.error || 'erro'}`);
      } catch {
        erros.push(`${full}: falha de conexão`);
      }
    }
    setLote({ ativo: false, feito: repos.length, total: repos.length, atual: '', erros });
    if (erros.length) message.warning(`${repos.length - erros.length}/${repos.length} repositórios salvos. ${erros.length} com erro.`);
    else message.success(`Todos os ${repos.length} repositórios foram salvos no Drive.`);
    carregar(true);
  };

  const salvarConfig = async () => {
    setSalvandoCfg(true);
    try {
      const r = await callServer<ServerResult>('setReposBackupConfig', { manter, destinoFolderId: destinoId });
      if (r.ok) { message.success('Configuração salva'); carregar(true); }
      else message.error(r.error || 'Erro ao salvar');
    } catch { message.error('Configuração só salva no app publicado'); }
    finally { setSalvandoCfg(false); }
  };

  const aplicarAgenda = async (patch: Partial<Agenda>) => {
    if (!estado) return;
    const a = { ...estado.config.agendamento, ...patch };
    setSalvandoAgenda(true);
    try {
      const r = await callServer<ServerResult>('configurarAgendamentoReposBackup', { ativo: a.ativo, freq: a.freq, hora: a.hora, dia: a.dia });
      if (r.ok) {
        setEstado({ ...estado, config: { ...estado.config, agendamento: a } });
        message.success(a.ativo ? 'Agendamento ativado' : 'Agendamento desativado');
      } else message.error(r.error || 'Erro');
    } catch { message.error('Agendamento só roda no app publicado'); }
    finally { setSalvandoAgenda(false); }
  };

  const cfg = estado?.config;
  const ag = cfg?.agendamento;
  const pctLote = lote.total ? Math.round((lote.feito / lote.total) * 100) : 0;

  const acoes = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button size="small" icon={<RefreshCw size={14} />} onClick={() => carregar()} disabled={loading || lote.ativo}>Atualizar</Button>
      {cfg?.pastaUrl ? (
        <Button size="small" icon={<ExternalLink size={14} />} href={cfg.pastaUrl} target="_blank">Abrir no Drive</Button>
      ) : null}
      <Button type="primary" icon={<HardDrive size={15} />} loading={lote.ativo} disabled={loading || !(estado?.repos.length)} onClick={backupTodos}>
        Backup de todos
      </Button>
    </div>
  );

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><GitBranch size={18} strokeWidth={1.6} color={t.accents.blue} /> Backup de repositórios</span>}
      extra={acoes}
    >
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
        Baixa cada repositório do GitHub inteiro (<code>.zip</code>) e guarda no seu Google Drive — uma cópia fora do
        GitHub e do GAS. Mantém os últimos <b>{manter}</b> snapshots de cada repo. Para espelhar pra outro lugar, aponte
        o destino pra uma pasta de <b>Drive Compartilhado</b> ou deixe o Google Drive para Desktop / OneDrive sincronizar a pasta.
      </div>

      {/* ─── Configuração ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Folder size={15} color={t.accents.peach} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: t.text }}>Destino & retenção</span>
          </div>
          <div style={{ fontSize: 11.5, color: t.textTertiary, marginBottom: 6 }}>Pasta de destino — em branco usa o Meu Drive ({cfg?.destinoNome || 'Forja — Backups de Repositórios'})</div>
          <Input
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            placeholder="ID da pasta (opcional, ex.: Shared Drive)"
            style={{ marginBottom: 10 }}
            allowClear
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: t.textSecondary }}>Manter últimos</span>
            <InputNumber min={1} max={50} value={manter} onChange={(v) => setManter(Number(v) || 1)} style={{ width: 80 }} />
            <span style={{ fontSize: 12.5, color: t.textSecondary }}>snapshots</span>
            <Button size="small" type="primary" loading={salvandoCfg} onClick={salvarConfig} style={{ marginLeft: 'auto' }}>Salvar</Button>
          </div>
        </div>

        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock size={15} color={t.accents.sage} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: t.text }}>Agendamento automático</span>
            <Switch
              size="small"
              checked={!!ag?.ativo}
              loading={salvandoAgenda}
              onChange={(v) => aplicarAgenda({ ativo: v })}
              style={{ marginLeft: 'auto' }}
            />
          </div>
          {ag?.ativo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Select
                size="small"
                value={ag.freq}
                onChange={(v) => aplicarAgenda({ freq: v })}
                style={{ width: 110 }}
                options={[{ value: 'diario', label: 'Diário' }, { value: 'semanal', label: 'Semanal' }]}
              />
              {ag.freq === 'semanal' && (
                <Select
                  size="small"
                  value={ag.dia}
                  onChange={(v) => aplicarAgenda({ dia: Number(v) })}
                  style={{ width: 120 }}
                  options={DIAS.map((d, i) => ({ value: i + 1, label: d }))}
                />
              )}
              <span style={{ fontSize: 12.5, color: t.textSecondary }}>às</span>
              <InputNumber size="small" min={0} max={23} value={ag.hora} onChange={(v) => aplicarAgenda({ hora: Number(v) || 0 })} style={{ width: 64 }} />
              <span style={{ fontSize: 12.5, color: t.textSecondary }}>h</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: t.textTertiary }}>Desligado. Ligue pra rodar o backup de todos os repos sozinho.</div>
          )}
          {cfg?.ultimoRun ? (
            <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 8 }}>Última rodada automática: {fmtData(cfg.ultimoRun)}</div>
          ) : null}
        </div>
      </div>

      {/* ─── Progresso do lote ──────────────────────────────────────────── */}
      {(lote.ativo || lote.erros.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          {lote.ativo && (
            <>
              <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                Salvando {lote.feito + 1}/{lote.total} — <span style={{ fontFamily: FONTS.mono }}>{lote.atual}</span>
              </div>
              <Progress percent={pctLote} status="active" />
            </>
          )}
          {!lote.ativo && lote.erros.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${lote.total - lote.erros.length}/${lote.total} salvos · ${lote.erros.length} com erro`}
              description={<div style={{ fontSize: 11.5, maxHeight: 90, overflow: 'auto' }}>{lote.erros.map((e, i) => <div key={i}>{e}</div>)}</div>}
              closable
              onClose={() => setLote((p) => ({ ...p, erros: [] }))}
            />
          )}
        </div>
      )}

      {/* ─── Lista de repositórios ──────────────────────────────────────── */}
      {loading ? (
        <Spin style={{ display: 'block', margin: '24px auto' }} />
      ) : !estado?.githubOk ? (
        <Alert type="error" showIcon message="GitHub não conectado" description={estado?.githubErro || 'Configure o token do GitHub em Configurações → Integrações.'} />
      ) : (estado?.repos.length || 0) === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum repositório encontrado" style={{ padding: 24 }} />
      ) : (
        <>
          <Input
            prefix={<GitBranch size={14} color={t.textTertiary} />}
            placeholder={`Buscar entre ${estado?.total || 0} repositórios…`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            allowClear
            style={{ marginBottom: 12 }}
          />
          <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 10, overflow: 'hidden' }}>
            {filtradas.map((r, idx) => (
              <div key={r.fullName} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: idx > 0 ? `1px solid ${t.borderSoft}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fullName}</span>
                    {r.privado && <Tooltip title="Privado"><Lock size={12} color={t.textTertiary} /></Tooltip>}
                  </div>
                  <div style={{ color: t.textTertiary, fontSize: 11.5, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                    <span>{fmtBytes(r.tamanhoKb * 1024)}</span>
                    {r.ultimoBackup ? (
                      <span style={{ color: t.accents.sage, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={11} /> backup {fmtData(r.ultimoBackup.criadoEm)} · {fmtBytes(r.ultimoBackup.tamanho)}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertCircle size={11} /> sem backup</span>
                    )}
                  </div>
                </div>
                <Button
                  size="small"
                  icon={<Download size={13} />}
                  loading={repoBusy === r.fullName}
                  disabled={lote.ativo}
                  onClick={() => backupUm(r.fullName)}
                >
                  Backup
                </Button>
              </div>
            ))}
            {filtradas.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 12.5 }}>Nenhum repositório com “{busca}”.</div>
            )}
          </div>
        </>
      )}

      {/* ─── Histórico recente ──────────────────────────────────────────── */}
      {!loading && (estado?.historico.length || 0) > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <History size={14} color={t.textTertiary} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSecondary }}>Histórico recente</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(estado?.historico || []).slice(0, 8).map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: t.textTertiary }}>
                {h.ok === false
                  ? <AlertCircle size={12} color={t.accents.rose} />
                  : <ShieldCheck size={12} color={t.accents.sage} />}
                <span style={{ fontFamily: FONTS.mono, color: t.textSecondary }}>{h.fullName}</span>
                <span>·</span>
                <span>{fmtData(h.criadoEm)}</span>
                <span>·</span>
                <span>{h.ok === false ? (h.erro || 'erro') : fmtBytes(h.tamanho)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
