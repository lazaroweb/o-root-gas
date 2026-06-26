// OpsVisaoGeral — cockpit "Ao vivo" (v1.191.0).
//
// O posto de observação ganhou uma visão geral premium: num relance você vê a
// saúde de tudo que está no ar (conexões, apps, repositórios, monitor) e, abaixo,
// só o que precisa de atenção agora — cada item com caminho de resolução.
// As abas de detalhe (Conexões, Aplicações, GitHub, Monitor) continuam pra fundo.
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin, Tooltip } from 'antd';
import {
  RefreshCw, Sparkles, GitBranch, Server, Radar, Plug, CheckCircle2,
  AlertTriangle, ChevronRight, ShieldCheck, Clock,
} from 'lucide-react';
import { Panel, RingProgress } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { StatusGeral, AppStatusItem, MonitorStatus, GitHubRepo, ServerResponse } from '../types';

interface Props {
  onIrParaStatus?: () => void;
  onIrParaApps?: () => void;
  onIrParaGitHub?: () => void;
  onIrParaMonitor?: () => void;
  onAbrirSistema?: (id: string) => void;
  onIrParaConfigSecao?: (secao: string) => void;
}

interface Incidente {
  id: string;
  severidade: 'erro' | 'aviso';
  icon: React.ReactNode;
  titulo: string;
  detalhe: string;
  acaoLabel: string;
  onAcao?: () => void;
}

function tempoRel(iso: string): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function OpsVisaoGeral({
  onIrParaStatus, onIrParaApps, onIrParaGitHub, onIrParaMonitor, onAbrirSistema, onIrParaConfigSecao,
}: Props): React.ReactElement {
  const t = useTokens();
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [apps, setApps] = useState<AppStatusItem[] | null>(null);
  const [monitor, setMonitor] = useState<MonitorStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string>('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<StatusGeral>>('getStatusGeral').catch(() => null),
      callServer<ServerResponse<AppStatusItem[]>>('getAppStatus').catch(() => null),
      callServer<ServerResponse<MonitorStatus>>('getMonitorStatus').catch(() => null),
      callServer<ServerResponse<GitHubRepo[]>>('getGitHubRepos').catch(() => null),
    ]).then(([s, a, m, r]) => {
      if (s && s.ok && s.data) setStatus(s.data as StatusGeral);
      if (a && a.ok && a.data) setApps(a.data as AppStatusItem[]);
      if (m && m.ok && m.data) setMonitor(m.data as MonitorStatus);
      if (r && r.ok && r.data) setRepos(r.data as GitHubRepo[]);
      setAtualizadoEm(new Date().toISOString());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(carregar, [carregar]);

  // ─── Agregações ────────────────────────────────────────────────────────────
  const appsComUrl = (apps || []).filter(a => a.temUrl);
  const appsOnline = appsComUrl.filter(a => a.conectado);
  const appsSemUrl = (apps || []).filter(a => !a.temUrl);
  const apisOffline = (status?.apis || []).filter(a => !a.conectado);
  const apisTotal = status?.apis.length || 0;

  // Saúde geral: razão de "no ar" sobre tudo que é monitorável e está configurado.
  const partes = [
    status?.llm.configurado ? { ok: status.llm.conectado } : null,
    status?.github.configurado ? { ok: status.github.conectado } : null,
    ...(status?.apis || []).map(a => ({ ok: a.conectado })),
    ...appsComUrl.map(a => ({ ok: a.conectado })),
  ].filter(Boolean) as { ok: boolean }[];
  const totalMon = partes.length;
  const onlineMon = partes.filter(p => p.ok).length;
  const saude = totalMon > 0 ? Math.round((onlineMon / totalMon) * 100) : 100;
  const saudeCor = saude >= 99 ? t.accents.sage : saude >= 80 ? t.accents.clay : t.accents.rose;

  // ─── Incidentes (o que precisa de atenção agora) ────────────────────────────
  const incidentes: Incidente[] = [];
  if (status) {
    if (status.llm.configurado && !status.llm.conectado) {
      incidentes.push({ id: 'llm', severidade: 'erro', icon: <Sparkles size={15} />, titulo: 'IA — proxy desconectado', detalhe: status.llm.detalhe || 'Sem resposta do proxy de LLM', acaoLabel: 'Revisar', onAcao: () => onIrParaConfigSecao && onIrParaConfigSecao('ia') });
    } else if (!status.llm.configurado) {
      incidentes.push({ id: 'llm-cfg', severidade: 'aviso', icon: <Sparkles size={15} />, titulo: 'IA — proxy não configurado', detalhe: 'Cadastre a base URL e a chave do proxy', acaoLabel: 'Configurar', onAcao: () => onIrParaConfigSecao && onIrParaConfigSecao('ia') });
    }
    if (status.github.configurado && !status.github.conectado) {
      incidentes.push({ id: 'gh', severidade: 'erro', icon: <GitBranch size={15} />, titulo: 'GitHub desconectado', detalhe: status.github.detalhe || 'Token inválido ou expirado', acaoLabel: 'Revisar', onAcao: () => onIrParaConfigSecao && onIrParaConfigSecao('integracoes') });
    } else if (!status.github.configurado) {
      incidentes.push({ id: 'gh-cfg', severidade: 'aviso', icon: <GitBranch size={15} />, titulo: 'GitHub sem token', detalhe: 'Conecte o GitHub para ver repositórios e atividade', acaoLabel: 'Configurar', onAcao: () => onIrParaConfigSecao && onIrParaConfigSecao('integracoes') });
    }
  }
  if (apisOffline.length > 0) {
    incidentes.push({ id: 'apis', severidade: 'erro', icon: <Plug size={15} />, titulo: `${apisOffline.length} de ${apisTotal} endpoint(s) de API fora do ar`, detalhe: 'Sem resposta ou erro de servidor (5xx)', acaoLabel: 'Ver status', onAcao: onIrParaStatus });
  }
  (apps || []).filter(a => a.temUrl && !a.conectado).forEach(a => {
    incidentes.push({ id: `app-${a.id}`, severidade: 'erro', icon: <Server size={15} />, titulo: `${a.nome} fora do ar`, detalhe: a.urlProd || 'URL de produção sem resposta', acaoLabel: 'Resolver', onAcao: () => (onAbrirSistema ? onAbrirSistema(a.id) : onIrParaApps && onIrParaApps()) });
  });
  if (appsSemUrl.length > 0) {
    incidentes.push({ id: 'sem-url', severidade: 'aviso', icon: <Server size={15} />, titulo: `${appsSemUrl.length} app(s) sem URL de produção`, detalhe: 'Cadastre a URL para entrarem no monitoramento', acaoLabel: 'Ver apps', onAcao: onIrParaApps });
  }
  if (status && !monitor?.ativo && totalMon > 0) {
    incidentes.push({ id: 'mon', severidade: 'aviso', icon: <Radar size={15} />, titulo: 'Monitoramento automático desativado', detalhe: 'Ative para receber alertas por e-mail quando algo cair', acaoLabel: 'Ativar', onAcao: onIrParaMonitor });
  }

  // ─── Tiles ──────────────────────────────────────────────────────────────────
  const conexOnline = ((status?.llm.conectado ? 1 : 0) + (status?.github.conectado ? 1 : 0) + (status?.apis.filter(a => a.conectado).length || 0));
  const conexTotal = ((status?.llm.configurado ? 1 : 0) + (status?.github.configurado ? 1 : 0) + apisTotal);

  const tiles = [
    { key: 'conex', icon: <Plug size={16} strokeWidth={1.8} />, accent: t.accents.peach, label: 'Conexões', valor: `${conexOnline}/${conexTotal}`, sub: 'IA · GitHub · APIs', onClick: onIrParaStatus },
    { key: 'apps', icon: <Server size={16} strokeWidth={1.8} />, accent: t.accents.sage, label: 'Aplicações', valor: `${appsOnline.length}/${appsComUrl.length}`, sub: 'no ar agora', onClick: onIrParaApps },
    { key: 'repos', icon: <GitBranch size={16} strokeWidth={1.8} />, accent: t.accents.lavender, label: 'Repositórios', valor: repos ? String(repos.length) : '—', sub: 'no GitHub', onClick: onIrParaGitHub },
    { key: 'mon', icon: <Radar size={16} strokeWidth={1.8} />, accent: monitor?.ativo ? t.accents.sage : t.accents.clay, label: 'Monitor', valor: monitor?.ativo ? 'Ativo' : 'Off', sub: monitor?.ativo ? `${monitor.intervaloMin}min · ${tempoRel(monitor.ultimaExec)}` : 'desativado', onClick: onIrParaMonitor },
  ];

  if (loading && !status && !apps) {
    return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {atualizadoEm && <span style={{ color: t.textTertiary, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> atualizado {tempoRel(atualizadoEm)}</span>}
        <Button icon={<RefreshCw size={15} />} loading={loading} onClick={carregar}>Revalidar tudo</Button>
      </div>

      {/* Hero: saúde geral + tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, marginBottom: 18 }} className="forja-subnav-grid">
        <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, boxShadow: t.shadow, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <RingProgress value={saude} color={saudeCor} size={150} sublabel={`${onlineMon}/${totalMon} no ar`} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: incidentes.length === 0 ? t.accents.sage : saudeCor }}>
              {incidentes.length === 0 ? <ShieldCheck size={17} /> : <AlertTriangle size={17} />}
              {incidentes.length === 0 ? 'Tudo no ar' : `${incidentes.length} ponto(s) de atenção`}
            </div>
            <div style={{ color: t.textTertiary, fontSize: 12, marginTop: 4 }}>Saúde geral ao vivo</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {tiles.map(tile => (
            <button
              key={tile.key}
              onClick={tile.onClick}
              className="forja-lift"
              style={{ textAlign: 'left', cursor: 'pointer', borderRadius: 18, border: `1px solid ${t.border}`, background: t.surface, boxShadow: t.shadow, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, font: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${tile.accent}1f`, color: tile.accent }}>{tile.icon}</span>
                <ChevronRight size={16} color={t.textTertiary} />
              </div>
              <div>
                <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: t.text, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{tile.valor}</div>
                <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 600, marginTop: 2 }}>{tile.label}</div>
                <div style={{ fontSize: 11.5, color: t.textTertiary }}>{tile.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Precisa de atenção */}
      <Panel
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} strokeWidth={1.6} color={incidentes.length ? t.accents.clay : t.accents.sage} /> Precisa de atenção</span>}
        padding={incidentes.length ? 8 : 22}
      >
        {incidentes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: t.textSecondary }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${t.accents.sage}1f`, color: t.accents.sage }}><CheckCircle2 size={24} /></span>
            <span style={{ fontFamily: FONTS.display, fontSize: 15, color: t.text, fontWeight: 600 }}>Nenhum incidente</span>
            <span style={{ fontSize: 12.5 }}>Tudo que está configurado respondeu na última verificação.</span>
          </div>
        ) : (
          incidentes.map((inc, idx) => {
            const cor = inc.severidade === 'erro' ? t.accents.rose : t.accents.clay;
            return (
              <div key={inc.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderTop: idx > 0 ? `1px solid ${t.borderSoft}` : 'none' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${cor}1a`, color: cor, flexShrink: 0 }}>{inc.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{inc.titulo}</div>
                  <div style={{ color: t.textTertiary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.detalhe}</div>
                </div>
                {inc.onAcao && (
                  <Tooltip title="Abrir o lugar certo para resolver">
                    <Button size="small" type="text" style={{ color: cor }} onClick={inc.onAcao}>{inc.acaoLabel}</Button>
                  </Tooltip>
                )}
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}
