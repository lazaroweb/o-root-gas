import React, { useState, useEffect } from 'react';
import { Button, Spin, Tag, Select, Switch, App as AntApp, Empty } from 'antd';
import { Radar, PlayCircle, Clock, Mail } from 'lucide-react';
import { Panel, StatusDot } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { MonitorStatus, ServerResponse } from '../types';

const INTERVALOS = [
  { value: 5, label: 'A cada 5 min' },
  { value: 10, label: 'A cada 10 min' },
  { value: 15, label: 'A cada 15 min' },
  { value: 30, label: 'A cada 30 min' },
  { value: 60, label: 'A cada 1 hora' },
];

export default function OpsMonitor(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [intervalo, setIntervalo] = useState(15);
  const [busy, setBusy] = useState(false);
  const [rodando, setRodando] = useState(false);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResponse<MonitorStatus>>('getMonitorStatus')
      .then(res => { if (res.ok && res.data) { setStatus(res.data as MonitorStatus); setIntervalo((res.data as MonitorStatus).intervaloMin || 15); } })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };
  useEffect(carregar, []);

  const toggle = (ativar: boolean) => {
    setBusy(true);
    const fn = ativar ? 'ativarMonitoramento' : 'desativarMonitoramento';
    const args = ativar ? [intervalo] : [];
    callServer<ServerResponse<unknown>>(fn, ...args)
      .then(res => {
        if (res.ok) { message.success(ativar ? 'Monitoramento ativado' : 'Monitoramento desativado'); carregar(); }
        else message.error(res.error || 'Erro');
      })
      .catch(() => message.error('Disponível apenas no app publicado'))
      .finally(() => setBusy(false));
  };

  const mudarIntervalo = (v: number) => {
    setIntervalo(v);
    if (status?.ativo) {
      setBusy(true);
      callServer<ServerResponse<unknown>>('ativarMonitoramento', v)
        .then(res => { if (res.ok) { message.success('Intervalo atualizado'); carregar(); } })
        .catch(() => message.error('Erro'))
        .finally(() => setBusy(false));
    }
  };

  const rodarAgora = () => {
    setRodando(true);
    callServer<ServerResponse<MonitorStatus>>('rodarMonitoramentoAgora')
      .then(res => { if (res.ok && res.data) { setStatus(res.data as MonitorStatus); message.success('Verificação concluída'); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Disponível apenas no app publicado'))
      .finally(() => setRodando(false));
  };

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;

  const snapshot = status?.snapshot || [];
  const online = snapshot.filter(s => s.conectado).length;

  return (
    <div>
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Radar size={18} strokeWidth={1.6} color={t.accents.peach} /> Monitoramento automático</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>
          A Forja verifica periodicamente a URL de produção de cada app e os endpoints das APIs. Se algo cair, você recebe um e-mail de alerta.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Switch checked={!!status?.ativo} loading={busy} onChange={toggle} />
            <span style={{ color: t.text, fontWeight: 500 }}>{status?.ativo ? 'Ativo' : 'Desativado'}</span>
          </div>
          <Select value={intervalo} onChange={mudarIntervalo} options={INTERVALOS} style={{ minWidth: 170 }} disabled={busy} />
          <Button icon={<PlayCircle size={16} />} loading={rodando} onClick={rodarAgora}>Rodar agora</Button>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 6, color: t.textTertiary, fontSize: 12.5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Última verificação: {status?.ultimaExec ? new Date(status.ultimaExec).toLocaleString('pt-BR') : 'nunca'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> Alertas por e-mail no endereço da sua conta Google</span>
        </div>
      </Panel>

      <div style={{ marginTop: 18 }}>
        <Panel
          title="Última leitura"
          extra={snapshot.length ? <Tag bordered={false} style={{ background: online === snapshot.length ? `${t.accents.sage}22` : `${t.accents.clay}22`, color: online === snapshot.length ? t.accents.sage : t.accents.clay, fontWeight: 600 }}>{online}/{snapshot.length} online</Tag> : null}
          padding={8}
        >
          {snapshot.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ainda sem leituras. Clique em “Rodar agora”." style={{ padding: 28 }} />
          ) : (
            snapshot.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1px solid ${t.borderSoft}` }}>
                <StatusDot color={s.conectado ? t.accents.sage : t.accents.rose} />
                <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue, fontSize: 11, textTransform: 'uppercase' }}>{s.tipo}</Tag>
                <span style={{ flex: 1, color: t.text, fontSize: 14 }}>{s.nome}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: s.conectado ? t.accents.sage : t.accents.rose }}>{s.conectado ? 'OK' : 'FALHA'} {s.status ? `· ${s.status}` : ''}</span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}
