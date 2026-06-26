import React, { useState, useEffect } from 'react';
import { Tag, Spin, App as AntApp, Tooltip, Button } from 'antd';
import { Activity, Sparkles, GitBranch, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { Panel, StatusDot } from '../components/ui';
import ApisPanel from '../components/ApisPanel';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { Sistema, StatusGeral, ServerResponse } from '../types';

interface OpsStatusProps {
  // Mantido por compat com Operações (não é mais usado aqui — o ApisPanel
  // busca os sistemas que precisa). Centralização v1.188.0.
  sistemas?: Sistema[];
  // Leva o user pra Configurações quando IA ou GitHub estão desconectados
  // (princípio: alerta sem ação proibido).
  onIrParaConfig?: () => void;
  // Leva o user pro hub de cadastro de APIs (Configurações → Conexões).
  onGerenciarApis?: () => void;
}

export default function OpsStatus({ onIrParaConfig, onGerenciarApis }: OpsStatusProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [validating, setValidating] = useState(false);

  const validar = () => {
    setValidating(true);
    callServer<ServerResponse<StatusGeral>>('getStatusGeral')
      .then(res => { if (res.ok && res.data) setStatus(res.data as StatusGeral); })
      .catch(() => { /* preview local não valida */ })
      .finally(() => setValidating(false));
  };

  useEffect(validar, []);

  const conexaoTag = (conectado: boolean, configurado = true) => {
    if (!configurado) return <Tag bordered={false} style={{ background: `${t.textTertiary}22`, color: t.textTertiary }}>Não configurado</Tag>;
    return (
      <Tag bordered={false} style={{ background: conectado ? `${t.accents.sage}22` : `${t.accents.rose}22`, color: conectado ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>
        {conectado ? 'Conectado' : 'Desconectado'}
      </Tag>
    );
  };

  const statusRow = (icon: React.ReactNode, nome: string, detalhe: string, conectado: boolean, configurado: boolean, latencia?: number) => {
    const precisaAjuste = !configurado || !conectado;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${t.borderSoft}` }}>
        <StatusDot color={!configurado ? t.textTertiary : conectado ? t.accents.sage : t.accents.rose} />
        <span style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t.surfaceMuted, color: t.textSecondary }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{nome}</div>
          <div style={{ color: t.textTertiary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detalhe}{latencia ? ` · ${latencia}ms` : ''}</div>
        </div>
        {conexaoTag(conectado, configurado)}
        {precisaAjuste && onIrParaConfig && (
          <Tooltip title={!configurado ? 'Cadastre a chave/token em Configurações.' : 'Verifique a chave/token em Configurações — pode ter expirado ou mudado de endpoint.'}>
            <Button size="small" type="text" icon={<SettingsIcon size={13} />} onClick={onIrParaConfig}>
              {!configurado ? 'Configurar' : 'Revisar'}
            </Button>
          </Tooltip>
        )}
      </div>
    );
  };

  const resumo = status?.resumo;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 }}>
        <Button icon={<RefreshCw size={15} />} loading={validating} onClick={validar}>Revalidar conexões</Button>
      </div>

      <Panel
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Activity size={18} strokeWidth={1.6} color={t.accents.sage} /> Central de Status</span>}
        extra={resumo ? <Tag bordered={false} style={{ background: resumo.online === resumo.total ? `${t.accents.sage}22` : `${t.accents.clay}22`, color: resumo.online === resumo.total ? t.accents.sage : t.accents.clay, fontWeight: 600 }}>{resumo.online}/{resumo.total} online</Tag> : (validating ? <Spin size="small" /> : null)}
        padding={8}
      >
        {!status && validating && <Spin style={{ display: 'block', margin: '24px auto' }} />}
        {!status && !validating && <div style={{ padding: 20, color: t.textTertiary, fontSize: 13 }}>A validação automática roda no app publicado. Clique em “Revalidar conexões”.</div>}
        {status && (
          <div>
            {statusRow(<Sparkles size={16} strokeWidth={1.7} />, 'IA — Proxy principal', status.llm.detalhe, status.llm.conectado, status.llm.configurado, status.llm.latenciaMs)}
            {statusRow(<GitBranch size={16} strokeWidth={1.7} />, 'GitHub', status.github.detalhe, status.github.conectado, status.github.configurado, status.github.latenciaMs)}
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 18 }}>
        <ApisPanel mode="monitor" onGerenciar={onGerenciarApis} />
      </div>
    </div>
  );
}
