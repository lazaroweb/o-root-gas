// ConexoesBackupPanel — backup/restore das abas de conexões (Apis/Servidores/Recursos).
//
// Fase 3 (v1.189.0): rede de segurança antes de qualquer migração de conexões.
// O backup duplica as abas dentro da própria planilha (sem novo escopo do Drive);
// o restore copia de volta, criando antes um snapshot 'pre-restore' do estado atual.
// v1.233.0: retenção em janela rolante (mantém só os N mais recentes) + agendamento
// automático por trigger de tempo, igual ao backup de repositórios.
import React, { useEffect, useState } from 'react';
import { Button, App as AntApp, Popconfirm, Tag, Empty, Spin, InputNumber, Switch, Select } from 'antd';
import { ShieldCheck, History, RotateCcw, DatabaseBackup, Clock } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface BackupAba { origem: string; backup: string; linhas: number }
interface BackupReg { stamp: string; motivo: string; criadoEm: string; abas: BackupAba[] }
interface Agenda { ativo: boolean; freq: string; hora: number; dia: number }
interface Config { manter: number; ultimoRun: string; agendamento: Agenda }

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function fmtData(iso: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

export default function ConexoesBackupPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [backups, setBackups] = useState<BackupReg[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [manter, setManter] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [fazendo, setFazendo] = useState(false);
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('listarBackupsConexoes')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { backups: BackupReg[]; config?: Config };
          setBackups(d.backups || []);
          if (d.config) { setConfig(d.config); setManter(d.config.manter); }
        }
      })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };

  useEffect(carregar, []);

  const fazerBackup = () => {
    setFazendo(true);
    callServer<ServerResult>('backupConexoes')
      .then((r) => { if (r.ok) { message.success('Backup das conexões criado'); carregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Backup só roda no app publicado'))
      .finally(() => setFazendo(false));
  };

  const salvarRetencao = () => {
    setSalvandoCfg(true);
    callServer<ServerResult>('setConexoesBackupConfig', { manter })
      .then((r) => { if (r.ok) { message.success('Retenção salva'); carregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Só salva no app publicado'))
      .finally(() => setSalvandoCfg(false));
  };

  const aplicarAgenda = (patch: Partial<Agenda>) => {
    if (!config) return;
    const a = { ...config.agendamento, ...patch };
    setSalvandoAgenda(true);
    callServer<ServerResult>('configurarAgendamentoConexoes', { ativo: a.ativo, freq: a.freq, hora: a.hora, dia: a.dia })
      .then((r) => {
        if (r.ok) { setConfig({ ...config, agendamento: a }); message.success(a.ativo ? 'Agendamento ativado' : 'Agendamento desativado'); }
        else message.error(r.error || 'Erro');
      })
      .catch(() => message.error('Agendamento só roda no app publicado'))
      .finally(() => setSalvandoAgenda(false));
  };

  const restaurar = (stamp: string) => {
    setRestaurando(stamp);
    callServer<ServerResult>('restaurarBackupConexoes', stamp)
      .then((r) => { if (r.ok) { message.success('Conexões restauradas a partir do backup'); carregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Restore só roda no app publicado'))
      .finally(() => setRestaurando(null));
  };

  const rotuloMotivo = (m: string) => {
    if (m === 'manual') return { txt: 'Manual', cor: t.accents.blue };
    if (m === 'agendado') return { txt: 'Agendado', cor: t.accents.sage };
    if (m === 'pre-restore') return { txt: 'Antes de restaurar', cor: t.accents.clay };
    if (String(m).indexOf('premig') === 0) return { txt: 'Antes de migração', cor: t.accents.sage };
    return { txt: m || '—', cor: t.textTertiary };
  };

  const ag = config?.agendamento;

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><DatabaseBackup size={18} strokeWidth={1.6} color={t.accents.peach} /> Backup das conexões</span>}
      extra={<Button type="primary" icon={<ShieldCheck size={15} />} loading={fazendo} onClick={fazerBackup}>Fazer backup agora</Button>}
    >
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Snapshot das abas <code>Apis</code>, <code>Servidores</code> e <code>Recursos</code> dentro da própria planilha
        (abas ocultas <code>_bkp_…</code>). É a rede de segurança usada antes de qualquer migração de conexões — o
        restore recoloca os dados no lugar e ainda guarda o estado atual antes de sobrescrever.
      </div>

      {/* ─── Retenção + agendamento ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <History size={15} color={t.accents.peach} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: t.text }}>Retenção (janela rolante)</span>
          </div>
          <div style={{ fontSize: 11.5, color: t.textTertiary, marginBottom: 10 }}>
            Mantém os últimos <b>{manter}</b> snapshots datados; ao criar o próximo, o mais antigo é descartado.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: t.textSecondary }}>Manter últimos</span>
            <InputNumber min={1} max={30} value={manter} onChange={(v) => setManter(Number(v) || 1)} style={{ width: 80 }} />
            <span style={{ fontSize: 12.5, color: t.textSecondary }}>snapshots</span>
            <Button size="small" type="primary" loading={salvandoCfg} onClick={salvarRetencao} style={{ marginLeft: 'auto' }}>Salvar</Button>
          </div>
        </div>

        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock size={15} color={t.accents.sage} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: t.text }}>Agendamento automático</span>
            <Switch size="small" checked={!!ag?.ativo} loading={salvandoAgenda} onChange={(v) => aplicarAgenda({ ativo: v })} style={{ marginLeft: 'auto' }} />
          </div>
          {ag?.ativo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Select size="small" value={ag.freq} onChange={(v) => aplicarAgenda({ freq: v })} style={{ width: 110 }}
                options={[{ value: 'diario', label: 'Diário' }, { value: 'semanal', label: 'Semanal' }]} />
              {ag.freq === 'semanal' && (
                <Select size="small" value={ag.dia} onChange={(v) => aplicarAgenda({ dia: Number(v) })} style={{ width: 120 }}
                  options={DIAS.map((d, i) => ({ value: i + 1, label: d }))} />
              )}
              <span style={{ fontSize: 12.5, color: t.textSecondary }}>às</span>
              <InputNumber size="small" min={0} max={23} value={ag.hora} onChange={(v) => aplicarAgenda({ hora: Number(v) || 0 })} style={{ width: 64 }} />
              <span style={{ fontSize: 12.5, color: t.textSecondary }}>h</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: t.textTertiary }}>Desligado. Ligue pra criar um snapshot das conexões sozinho.</div>
          )}
          {config?.ultimoRun ? (
            <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 8 }}>Última rodada automática: {fmtData(config.ultimoRun)}</div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '24px auto' }} />
      ) : backups.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum backup ainda" style={{ padding: 24 }} />
      ) : (
        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 10, overflow: 'hidden' }}>
          {backups.map((b, idx) => {
            const m = rotuloMotivo(b.motivo);
            const totalLinhas = (b.abas || []).reduce((acc, a) => acc + Number(a.linhas || 0), 0);
            return (
              <div key={b.stamp + idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: idx > 0 ? `1px solid ${t.borderSoft}` : 'none' }}>
                <History size={15} color={t.textTertiary} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: t.text, fontWeight: 600 }}>{b.stamp}</span>
                    <Tag bordered={false} style={{ background: `${m.cor}1a`, color: m.cor, fontSize: 11 }}>{m.txt}</Tag>
                  </div>
                  <div style={{ color: t.textTertiary, fontSize: 11.5 }}>
                    {b.criadoEm ? new Date(b.criadoEm).toLocaleString('pt-BR') : ''} · {(b.abas || []).length} aba(s) · {totalLinhas} linha(s)
                  </div>
                </div>
                <Popconfirm
                  title="Restaurar este backup?"
                  description="Sobrescreve as conexões atuais. O estado atual é salvo antes (pre-restore)."
                  okText="Restaurar" cancelText="Cancelar"
                  onConfirm={() => restaurar(b.stamp)}
                >
                  <Button size="small" icon={<RotateCcw size={13} />} loading={restaurando === b.stamp}>Restaurar</Button>
                </Popconfirm>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
