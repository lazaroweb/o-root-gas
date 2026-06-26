// ConexoesBackupPanel — backup/restore das abas de conexões (Apis/Servidores/Recursos).
//
// Fase 3 (v1.189.0): rede de segurança antes de qualquer migração de conexões.
// O backup duplica as abas dentro da própria planilha (sem novo escopo do Drive);
// o restore copia de volta, criando antes um snapshot 'pre-restore' do estado atual.
import React, { useEffect, useState } from 'react';
import { Button, App as AntApp, Popconfirm, Tag, Empty, Spin } from 'antd';
import { ShieldCheck, History, RotateCcw, DatabaseBackup } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface BackupAba { origem: string; backup: string; linhas: number }
interface BackupReg { stamp: string; motivo: string; criadoEm: string; abas: BackupAba[] }

export default function ConexoesBackupPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [backups, setBackups] = useState<BackupReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [fazendo, setFazendo] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('listarBackupsConexoes')
      .then((r) => { if (r.ok && r.data) setBackups(((r.data as { backups: BackupReg[] }).backups) || []); })
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

  const restaurar = (stamp: string) => {
    setRestaurando(stamp);
    callServer<ServerResult>('restaurarBackupConexoes', stamp)
      .then((r) => { if (r.ok) { message.success('Conexões restauradas a partir do backup'); carregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Restore só roda no app publicado'))
      .finally(() => setRestaurando(null));
  };

  const rotuloMotivo = (m: string) => {
    if (m === 'manual') return { txt: 'Manual', cor: t.accents.blue };
    if (m === 'pre-restore') return { txt: 'Antes de restaurar', cor: t.accents.clay };
    if (String(m).indexOf('premig') === 0) return { txt: 'Antes de migração', cor: t.accents.sage };
    return { txt: m || '—', cor: t.textTertiary };
  };

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
