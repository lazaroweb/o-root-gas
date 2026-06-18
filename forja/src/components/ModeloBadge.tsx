import React, { useEffect, useState, useCallback } from 'react';
import { Tooltip, Skeleton, Button, App as AntApp } from 'antd';
import { Cpu, Sparkles, Zap, Snail, AlertTriangle, Lightbulb, Activity } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, ModeloInfo, ModeloTier } from '../types';

// ─── Cores semânticas do farol ───────────────────────────────────────────────
// Padronizadas — fora dos accents do tema pra serem reconhecíveis universalmente
// como "saúde" (verde=ok, vermelho=erro, cinza=desconhecido).
const COR_FAROL = {
  verde:        '#3CB371',  // medium sea green — claro suficiente em dark, suficientemente saturado em light
  vermelho:     '#E5484D',  // radix red — atenção sem ser hostil
  desconhecido: '#8C8884',  // cinza neutro
} as const;

// ─── ModeloBadge ─────────────────────────────────────────────────────────────
// Widget reutilizável que mostra QUAL modelo LLM está ativo + tier + sugestão.
//
// Modos:
//   - 'live' (default): busca via getModeloAtual no servidor (config corrente)
//   - 'stamped': mostra o modelo gravado num artefato específico (passa via prop)
//
// Sizes: 'small' (chip compacto) | 'medium' (com ícone + label)

export interface ModeloBadgeProps {
  // Quando passa stampedModelo, mostra esse — útil pra histórico de artefatos
  // gerados em sessões anteriores (pode ser diferente do modelo atual).
  stampedModelo?: string;
  // Contexto de uso pra que a sugestão seja relevante (chat=tudo, blueprint=longo, etc)
  uso?: 'chat' | 'blueprint' | 'diagrama' | 'audit';
  size?: 'small' | 'medium';
  // Quando true, omite o label "Modelo:" pra economizar espaço (chip puro).
  inline?: boolean;
}

// ─── Cor + ícone por tier ────────────────────────────────────────────────────
function metaTier(tier: ModeloTier): { color: keyof ReturnType<typeof useTokens>['accents']; icon: React.ReactNode; label: string } {
  switch (tier) {
    case 'premium':     return { color: 'lavender', icon: <Sparkles size={11} strokeWidth={1.8} />, label: 'Premium' };
    case 'balanceado':  return { color: 'blue',     icon: <Cpu      size={11} strokeWidth={1.8} />, label: 'Balanceado' };
    case 'rapido':      return { color: 'sage',     icon: <Zap      size={11} strokeWidth={1.8} />, label: 'Rápido' };
    case 'economico':   return { color: 'peach',    icon: <Snail    size={11} strokeWidth={1.8} />, label: 'Econômico' };
    default:            return { color: 'peach',    icon: <AlertTriangle size={11} strokeWidth={1.8} />, label: 'Desconhecido' };
  }
}

export default function ModeloBadge({
  stampedModelo, uso, size = 'small', inline = true,
}: ModeloBadgeProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [info, setInfo] = useState<ModeloInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testando, setTestando] = useState(false);

  // Busca info do modelo. Memoizado pra reuso pelo refresh pós-ping.
  const carregar = useCallback(() => {
    if (stampedModelo) {
      callServer<ServerResult>('classificarModelo', stampedModelo)
        .then((r) => {
          if (r.ok && r.data) {
            const meta = r.data as { tier: ModeloTier; familia: ModeloInfo['familia']; rotulo: string };
            setInfo({
              configurado: true,
              modelo: stampedModelo,
              tier: meta.tier,
              familia: meta.familia,
              rotulo: meta.rotulo,
            });
          }
        })
        .catch(() => {/* preview local não classifica */})
        .finally(() => setLoading(false));
      return;
    }
    callServer<ServerResult>('getModeloAtual', { uso: uso || 'chat' })
      .then((r) => {
        if (r.ok && r.data) setInfo(r.data as ModeloInfo);
      })
      .catch(() => {/* preview local não tem config */})
      .finally(() => setLoading(false));
  }, [stampedModelo, uso]);

  useEffect(() => { carregar(); }, [carregar]);

  // Ping manual — só faz sentido no modo live (não-stamped)
  const testarAgora = useCallback(async () => {
    setTestando(true);
    try {
      const r = await callServer<ServerResult>('pingModelo');
      if (r.ok && r.data) {
        const d = r.data as { ok: boolean; latenciaMs?: number; erro?: string };
        if (d.ok) message.success(`Modelo respondeu em ${d.latenciaMs}ms`);
        else message.error(`Falha: ${d.erro?.slice(0, 120) || 'erro desconhecido'}`);
      }
      carregar(); // re-busca status pra atualizar farol
    } finally {
      setTestando(false);
    }
  }, [carregar, message]);

  if (loading) {
    return <Skeleton.Button active size="small" style={{ width: 90, height: size === 'medium' ? 28 : 22 }} />;
  }

  if (!info) {
    return (
      <span style={{
        fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary,
        padding: '2px 8px', borderRadius: 999, background: 'transparent',
        border: `1px dashed ${t.borderSoft}`,
      }}>
        sem modelo
      </span>
    );
  }

  if (!info.configurado) {
    return (
      <Tooltip title="Configure o modelo em Configurações → IA.">
        <span style={{
          fontFamily: FONTS.mono, fontSize: 10, color: t.accents.peach,
          padding: '2px 8px', borderRadius: 999,
          background: `${t.accents.peach}11`,
          border: `1px solid ${t.accents.peach}44`,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <AlertTriangle size={10} />
          IA não configurada
        </span>
      </Tooltip>
    );
  }

  const meta = metaTier(info.tier);
  const accentColor = t.accents[meta.color];
  const temSugestao = !!info.sugestao;

  // Farol — só faz sentido em modo "live" (modelo em uso atual).
  // No modo stamped (artefato histórico) não tem chamada recente, mostramos cinza neutro.
  const saude: 'verde' | 'vermelho' | 'desconhecido' =
    stampedModelo ? 'desconhecido' : (info.saude || 'desconhecido');
  const corFarol = COR_FAROL[saude];

  // Texto curto pro label do status
  const labelStatus = saude === 'verde' ? 'Ativo' : saude === 'vermelho' ? 'Falhou' : 'Aguardando';

  // Formata "há X" pra última chamada
  const formatarHa = (ts: number): string => {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'agora há pouco';
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  };

  // Tooltip detalhado: status (verde/vermelho), modelo, tier, última chamada, sugestão
  const tooltipNode = (
    <div style={{ maxWidth: 340, padding: '4px 0' }}>
      {/* Cabeçalho: status + modelo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: corFarol,
          boxShadow: saude === 'verde' ? `0 0 6px ${corFarol}` : 'none',
        }} />
        <span style={{ fontSize: 11.5, color: '#fff', fontWeight: 600 }}>
          {labelStatus}
        </span>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>
          {saude === 'verde' ? '· em uso' : saude === 'vermelho' ? '· última falhou' : '· nunca chamado nesta sessão'}
        </span>
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 11, marginBottom: 4, color: '#fff' }}>
        {info.modelo}
      </div>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>
        Tier: <strong>{meta.label}</strong> · {info.familia}
      </div>

      {/* Detalhe da última chamada (latência ou erro) */}
      {info.ultimaChamada && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          fontSize: 11, color: 'rgba(255,255,255,0.8)',
          lineHeight: 1.5,
        }}>
          <div>Última chamada {formatarHa(info.ultimaChamada.ts)}</div>
          {info.ultimaChamada.ok && info.ultimaChamada.latenciaMs && (
            <div style={{ color: 'rgba(255,255,255,0.6)' }}>
              Latência: {info.ultimaChamada.latenciaMs}ms
            </div>
          )}
          {!info.ultimaChamada.ok && info.ultimaChamada.erro && (
            <div style={{ color: '#FFB4B4', marginTop: 2 }}>
              {info.ultimaChamada.erro.slice(0, 150)}
            </div>
          )}
        </div>
      )}

      {/* Sugestão (apenas em live) */}
      {!stampedModelo && temSugestao && info.sugestao && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          marginTop: 8, paddingTop: 8,
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <Lightbulb size={13} color="#FFD58A" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45 }}>
            {info.sugestao.motivo}
            {info.sugestao.modeloSugerido && (
              <div style={{ marginTop: 4, fontFamily: FONTS.mono, fontSize: 10.5, color: '#FFD58A' }}>
                → {info.sugestao.modeloSugerido}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botão "Testar agora" — só no modo live */}
      {!stampedModelo && (
        <div style={{ marginTop: 10 }}>
          <Button
            size="small"
            type="primary"
            ghost
            loading={testando}
            icon={<Activity size={11} />}
            onClick={(e) => { e.stopPropagation(); testarAgora(); }}
            style={{ fontSize: 11, height: 22, padding: '0 8px' }}
          >
            Testar conexão
          </Button>
        </div>
      )}
    </div>
  );

  // ─── Bolinha de status reutilizável (pequena e grande) ──────────────────
  const Farol = ({ tamanho = 6 }: { tamanho?: number }) => (
    <span
      style={{
        display: 'inline-block',
        width: tamanho, height: tamanho, borderRadius: '50%',
        background: corFarol,
        marginLeft: 4,
        flexShrink: 0,
        // Pulso sutil quando verde (vivo). Vermelho/cinza ficam estáticos.
        animation: saude === 'verde' ? 'forjaFaroleVerde 2.4s ease-in-out infinite' : undefined,
        boxShadow: saude === 'verde' ? `0 0 0 0 ${corFarol}` : 'none',
      }}
      aria-label={`Modelo ${labelStatus.toLowerCase()}`}
    />
  );

  if (size === 'medium') {
    return (
      <Tooltip title={tooltipNode} placement="top" trigger={['hover', 'click']}>
        <span style={{
          fontFamily: FONTS.ui, fontSize: 12, color: accentColor,
          padding: '5px 10px', borderRadius: 8,
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}33`,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          position: 'relative',
        }}>
          <span style={{ display: 'inline-flex', color: accentColor }}>{meta.icon}</span>
          <span style={{ fontWeight: 500 }}>{info.rotulo}</span>
          <Farol tamanho={7} />
        </span>
      </Tooltip>
    );
  }

  // size = 'small'
  return (
    <Tooltip title={tooltipNode} placement="top" trigger={['hover', 'click']}>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 10, color: accentColor,
        padding: '2px 7px', borderRadius: 999,
        background: `${accentColor}10`,
        border: `1px solid ${accentColor}33`,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        cursor: 'pointer',
        letterSpacing: 0.2,
      }}>
        <span style={{ display: 'inline-flex', color: accentColor }}>{meta.icon}</span>
        {!inline && <span style={{ opacity: 0.7 }}>Modelo:</span>}
        <span style={{ fontWeight: 500 }}>{info.rotulo}</span>
        <Farol tamanho={6} />
      </span>
    </Tooltip>
  );
}
