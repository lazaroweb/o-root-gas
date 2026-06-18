import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, Button, Tooltip, App as AntApp, Skeleton, Badge } from 'antd';
import { Bell, AlertTriangle, AlertCircle, Info, X, Check, RefreshCw, Trash2, ExternalLink, Zap, Sparkles } from 'lucide-react';
import callServer from '../gas-client';
import { useForja } from '../themeContext';
import { FONTS } from '../theme';
import type { Alerta, ServerResult, ViewName } from '../types';

interface AlertsBellProps {
  collapsed?: boolean;
  onNavigate?: (view: ViewName) => void;
  hideButton?: boolean;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUnreadCount?: (count: number) => void;
}

function tempoRelativo(iso: string): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function AlertsBell({ collapsed = false, onNavigate, hideButton, controlledOpen, onOpenChange, onUnreadCount }: AlertsBellProps): React.ReactElement {
  const { mode, tokens: t } = useForja();
  const { message } = AntApp.useApp();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { if (isControlled) onOpenChange?.(v); else setInternalOpen(v); };
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const r = await callServer<ServerResult>('getAlertas');
      if (r.ok && r.data) {
        const d = r.data as { alertas: Alerta[]; naoLidos: number };
        setAlertas(d.alertas || []);
        setNaoLidos(d.naoLidos || 0);
        onUnreadCount?.(d.naoLidos || 0);
      }
    } catch { /* silencioso */ }
    finally { if (!silencioso) setLoading(false); }
  }, [onUnreadCount]);

  useEffect(() => { void carregar(); }, [carregar]);
  // Refresh leve a cada 3min
  useEffect(() => {
    const id = setInterval(() => { void carregar(true); }, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [carregar]);

  const marcarTodos = async () => {
    try {
      await callServer<ServerResult>('marcarTodosAlertasLidos');
      void carregar();
    } catch { message.error('Erro ao marcar lidos'); }
  };
  const marcarUm = async (id: string) => {
    try { await callServer<ServerResult>('marcarAlertaLido', id); void carregar(); } catch { /* */ }
  };
  const dismissUm = async (id: string) => {
    try { await callServer<ServerResult>('dismissAlerta', id); void carregar(); } catch { /* */ }
  };
  const rodarAgora = async () => {
    setRodando(true);
    try {
      const r = await callServer<ServerResult>('rodarAutomacoesAgora');
      if (r.ok && r.data) {
        const d = r.data as { criados: number; regrasAtivas: number; avaliados: { sistemasComUrl: number; totalSistemas: number; apis: number; custosComProximaCobranca: number } };
        if (d.criados > 0) {
          message.success(`${d.criados} novo(s) alerta(s) criado(s)`);
        } else if (d.regrasAtivas === 0) {
          message.warning('Nenhuma regra está ativa. Vá em Configurações → Automações.');
        } else {
          const a = d.avaliados;
          const detalhes: string[] = [];
          detalhes.push(`${d.regrasAtivas} regra(s) ativa(s)`);
          detalhes.push(`${a.sistemasComUrl}/${a.totalSistemas} sistema(s) com URL`);
          detalhes.push(`${a.apis} API(s)`);
          detalhes.push(`${a.custosComProximaCobranca} conta(s) com próx. cobrança`);
          message.info('Nenhum novo alerta — ' + detalhes.join(' · '), 6);
        }
        void carregar();
      } else message.error(r.error || 'Erro');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setRodando(false); }
  };

  const enviarTeste = async () => {
    try {
      const r = await callServer<ServerResult>('gerarAlertaTeste');
      if (r.ok) { message.success('Alerta de teste criado e enviado pelos canais ativos'); void carregar(); }
      else message.error(r.error || 'Erro');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const corPorSev = (sev: string): string => {
    if (sev === 'critico') return t.accents.rose;
    if (sev === 'aviso') return t.accents.peach;
    return t.accents.blue;
  };
  const iconePorSev = (sev: string) => {
    if (sev === 'critico') return <AlertCircle size={16} strokeWidth={1.7} />;
    if (sev === 'aviso') return <AlertTriangle size={16} strokeWidth={1.7} />;
    return <Info size={16} strokeWidth={1.7} />;
  };

  return (
    <>
      {!hideButton && (
      <Tooltip title={naoLidos > 0 ? `${naoLidos} alerta(s) não lido(s)` : 'Alertas'} placement="right">
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
            border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent',
            color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14, fontWeight: 500, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'luz' ? '#F5F1EA' : '#212327'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ display: 'inline-flex', position: 'relative', color: t.textTertiary }}>
            <Bell size={18} strokeWidth={1.6} />
            {naoLidos > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -5, minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 8, background: t.accents.rose, color: '#fff',
                fontSize: 10, fontWeight: 700, fontFamily: FONTS.ui,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>{naoLidos > 99 ? '99+' : naoLidos}</span>
            )}
          </span>
          {!collapsed && <span style={{ flex: 1 }}>Alertas</span>}
        </button>
      </Tooltip>
      )}

      <Drawer
        title={null}
        placement="right"
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        closable={false}
        styles={{
          body: { padding: 0, background: t.appBg },
          header: { display: 'none' },
        }}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: `1px solid ${t.borderSoft}`, background: t.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: t.text }}>Alertas</div>
            <Button type="text" size="small" icon={<X size={16} />} onClick={() => setOpen(false)} />
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
            {naoLidos > 0 ? `${naoLidos} não lido(s) · ${alertas.length} total` : `${alertas.length} alerta(s)`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Button size="small" icon={<Zap size={14} />} loading={rodando} onClick={rodarAgora}>
              Rodar agora
            </Button>
            <Tooltip title="Cria um alerta fake e dispara pelos canais ativos">
              <Button size="small" icon={<Sparkles size={14} />} onClick={enviarTeste}>
                Alerta de teste
              </Button>
            </Tooltip>
            <Button size="small" icon={<RefreshCw size={14} />} onClick={() => carregar()}>
              Atualizar
            </Button>
            {naoLidos > 0 && (
              <Button size="small" icon={<Check size={14} />} onClick={marcarTodos}>
                Marcar todos lidos
              </Button>
            )}
            {onNavigate && (
              <Button size="small" type="link" onClick={() => { setOpen(false); onNavigate('configuracoes'); }}>
                Configurar regras →
              </Button>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : alertas.length === 0 ? (
            <div style={{ padding: '40px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
              <Badge dot={false} count={0} showZero={false}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textTertiary }}>
                  <Bell size={24} strokeWidth={1.4} />
                </div>
              </Badge>
              <div>
                <div style={{ fontFamily: FONTS.display, fontSize: 18, color: t.text, marginBottom: 4 }}>Tudo calmo por aqui</div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary, maxWidth: 300, lineHeight: 1.55 }}>
                  Alertas aparecem quando algo casa com uma regra ativa: app com <code>urlProd</code> que caiu, conta com <code>proximaCobranca</code> próxima, saúde abaixo do limite etc.<br /><br />
                  Sem dado real cadastrado, nada vai disparar — use <strong>"Alerta de teste"</strong> acima pra verificar os canais.
                </div>
              </div>
              {onNavigate && (
                <Button size="small" onClick={() => { setOpen(false); onNavigate('configuracoes'); }}>
                  Ajustar regras
                </Button>
              )}
            </div>
          ) : alertas.map((a) => {
            const lido = !!a.lidoEm;
            const cor = corPorSev(a.severidade);
            return (
              <div
                key={a.id}
                style={{
                  background: t.surface,
                  border: `1px solid ${lido ? t.borderSoft : cor + '40'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  opacity: lido ? 0.65 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: cor, marginTop: 2 }}>{iconePorSev(a.severidade)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontFamily: FONTS.ui, fontWeight: 600, fontSize: 14, color: t.text, lineHeight: 1.3 }}>{a.titulo}</div>
                    </div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.5, wordBreak: 'break-word' }}>{a.mensagem}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                      <span>{tempoRelativo(a.criadoEm)}</span>
                      {a.link && (
                        <a href={a.link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: t.textTertiary }}>
                          <ExternalLink size={11} /> abrir
                        </a>
                      )}
                      <div style={{ flex: 1 }} />
                      {!lido && (
                        <Tooltip title="Marcar como lido"><button onClick={() => marcarUm(a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.textTertiary, padding: 2 }}><Check size={13} /></button></Tooltip>
                      )}
                      <Tooltip title="Descartar"><button onClick={() => dismissUm(a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.textTertiary, padding: 2 }}><Trash2 size={13} /></button></Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
