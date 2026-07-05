// Pontos de restauração do SISTEMA COMPLETO: snapshot integral da planilha-banco
// no Drive (todas as tabelas, incluindo o Financeiro Pessoal) com restore de um
// clique. "Fiz merda? Volto exatamente pra aquele momento." Um snapshot
// 'pre-restore' é criado automaticamente antes de qualquer restauração, então o
// próprio restore é reversível. Mora em Configurações → Dados & Backup.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, InputNumber, Tag, Skeleton, App as AntApp } from 'antd';
import { ShieldCheck, History, ExternalLink } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

// Um ponto de restauração (registro devolvido por listarBackupsCompletos).
interface BackupCompleto {
  stamp: string;
  motivo: string;
  criadoEm: string;
  fileId: string;
  url: string;
  tabelas: number;
  linhas: number;
}

// '20260705-105501' → '05/07/2026 10:55'
function fmtStamp(stamp: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(String(stamp || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(stamp || '');
}

export default function PontosRestauracaoPanel(): React.ReactElement {
  const t = useTokens();
  const { message, modal } = AntApp.useApp();
  const [backups, setBackups] = useState<BackupCompleto[]>([]);
  const [pastaUrl, setPastaUrl] = useState('');
  const [manter, setManter] = useState(10);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [restaurando, setRestaurando] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('listarBackupsCompletos')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { backups: BackupCompleto[]; config: { manter: number; pastaUrl: string } };
          setBackups(Array.isArray(d.backups) ? d.backups : []);
          setManter(Number(d.config?.manter || 10));
          setPastaUrl(String(d.config?.pastaUrl || ''));
        }
      })
      .catch(() => { /* painel fica vazio */ })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const criar = () => {
    setCriando(true);
    callServer<ServerResult>('criarBackupCompleto')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { tabelas: number; linhas: number };
          message.success(`Ponto de restauração criado — ${d.tabelas} tabelas, ${d.linhas} linhas de dados`);
          carregar();
        } else message.error(r.error || 'Erro ao criar backup');
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setCriando(false));
  };

  const restaurar = (b: BackupCompleto) => {
    modal.confirm({
      title: `Restaurar o sistema pra ${fmtStamp(b.stamp)}?`,
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ marginTop: 0 }}>
            O conteúdo de <strong>todas as tabelas</strong> (negócio + financeiro pessoal + família)
            volta a ser <strong>exatamente</strong> o daquele momento. Tudo que foi criado ou
            alterado depois de {fmtStamp(b.stamp)} deixa de existir nas tabelas restauradas.
          </p>
          <p style={{ marginBottom: 0 }}>
            Rede de segurança: um snapshot <em>pre-restore</em> do estado atual é criado antes —
            se você se arrepender, dá pra restaurar ele e voltar pra agora.
          </p>
        </div>
      ),
      okText: 'Restaurar tudo',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: () => {
        setRestaurando(b.stamp);
        return callServer<ServerResult>('restaurarBackupCompleto', b.stamp)
          .then((r) => {
            if (r.ok && r.data) {
              const d = r.data as { restauradas: Array<{ tabela: string; linhas: number }>; preRestoreStamp: string };
              modal.success({
                title: 'Sistema restaurado',
                content: `${d.restauradas.length} tabela(s) voltaram pro estado de ${fmtStamp(b.stamp)}. O estado anterior ficou guardado como pre-restore (${fmtStamp(d.preRestoreStamp)}). A página vai recarregar pra refletir os dados.`,
                okText: 'Recarregar agora',
                onOk: () => window.location.reload(),
              });
            } else message.error(r.error || 'Erro ao restaurar');
          })
          .catch((e) => message.error(e instanceof Error ? e.message : 'Erro'))
          .finally(() => setRestaurando(''));
      },
    });
  };

  const salvarRetencao = (n: number | null) => {
    if (!n) return;
    setManter(n);
    callServer<ServerResult>('setBackupCompletoConfig', { manter: n })
      .then((r) => { if (!r.ok) message.error(r.error || 'Erro ao salvar retenção'); })
      .catch(() => { /* best-effort */ });
  };

  return (
    <Panel padding={20} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={17} color={t.accents.sage} /> Pontos de restauração (sistema completo)</span>}>
      <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
        Tira uma <strong>foto integral da planilha-banco</strong> no Drive — todas as tabelas,
        incluindo o Financeiro Pessoal, cartões, família e histórico de importações. Se algo der
        errado, <strong>Restaurar</strong> volta o sistema exatamente pra aquele momento
        (um snapshot <em>pre-restore</em> é criado antes, então o restore também é reversível).
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: backups.length > 0 ? 16 : 0 }}>
        <Button type="primary" icon={<ShieldCheck size={14} />} loading={criando} onClick={criar}>
          Criar ponto de restauração agora
        </Button>
        <span style={{ fontSize: 12, color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Guardar os últimos
          <InputNumber size="small" min={1} max={30} value={manter} onChange={salvarRetencao} style={{ width: 56 }} />
          pontos
        </span>
        {pastaUrl && (
          <a href={pastaUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ExternalLink size={12} /> pasta no Drive
          </a>
        )}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : backups.length === 0 ? (
        <p style={{ color: t.textTertiary, fontSize: 12, fontStyle: 'italic', margin: '10px 0 0' }}>
          Nenhum ponto de restauração ainda. Crie o primeiro antes de qualquer operação arriscada
          (importações grandes, limpezas, zerar cartão…).
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {backups.map((b) => (
            <div
              key={b.stamp}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '9px 2px', borderTop: `1px dashed ${t.borderSoft}`,
                fontFamily: FONTS.ui, fontSize: 13,
              }}
            >
              <History size={13} color={t.textTertiary} />
              <span style={{ color: t.text, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmtStamp(b.stamp)}</span>
              {b.motivo && b.motivo !== 'manual' && (
                <Tag style={{ marginInlineEnd: 0 }} color={b.motivo === 'pre-restore' ? 'orange' : undefined}>{b.motivo}</Tag>
              )}
              <span style={{ color: t.textTertiary, fontSize: 12 }}>
                {b.tabelas} tabelas · {Number(b.linhas || 0).toLocaleString('pt-BR')} linhas
              </span>
              <span style={{ flex: 1 }} />
              {b.url && (
                <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>abrir</a>
              )}
              <Button size="small" danger loading={restaurando === b.stamp} onClick={() => restaurar(b)}>
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
