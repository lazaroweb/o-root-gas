import React, { useEffect, useRef, useState } from 'react';
import { Button, App as AntApp, Tooltip } from 'antd';
import { Flame, Sparkles, Clock, Layers } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import ModeloBadge from './ModeloBadge';

// ─── ForjaSobreForja ─────────────────────────────────────────────────────────
// Hero card que aparece no topo das views de geração de IA (Blueprint, Diagrama).
// Convida o user a usar o PRÓPRIO Forja como entrada — dogfooding pra testar
// o pipeline com algo conhecido antes de aplicar a outros sistemas.
//
// Tipo controla qual ação executar e o que mostrar:
//   - 'blueprint' → chama gerarBlueprintDoForja
//   - 'diagrama'  → chama gerarDiagramaDoForja (sugere flowchart)
//
// onGerou recebe o resultado pra view pai exibir/atualizar lista.

interface ForjaSobreForjaProps {
  tipo: 'blueprint' | 'diagrama';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGerou: (resultado: any) => void;
  onReloadHistorico?: () => void;
}

export default function ForjaSobreForja({ tipo, onGerou, onReloadHistorico }: ForjaSobreForjaProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  // Timer pra dar feedback de tempo decorrido enquanto LLM responde. Sem isso
  // o user fica encarando "loading..." por 60s sem saber se travou ou tá ok.
  const [elapsed, setElapsed] = useState(0);
  // Estado da geração múltipla (galeria 5 visões) — só usado quando tipo='diagrama'.
  // Mantém em ref de progresso só pra exibição (server roda tudo de uma vez).
  const [galeriaLoading, setGaleriaLoading] = useState(false);
  const [galeriaElapsed, setGaleriaElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const galeriaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlueprint = tipo === 'blueprint';
  const acao = isBlueprint ? 'gerarBlueprintDoForja' : 'gerarDiagramaDoForja';
  const labelBotao = isBlueprint ? 'Gerar blueprint do Forja' : 'Gerar diagrama do Forja';
  const descricao = isBlueprint
    ? 'Dogfooding: peça pra IA documentar a própria Forja como blueprint. Usa snapshot real do app + seu Códex. Resultado vai pra lista abaixo marcado como referência.'
    : 'Dogfooding: peça pra IA desenhar o fluxograma da Forja. Usa snapshot real do app + seu Códex. Bom pra ter um diagrama-modelo do que pedir pros seus outros sistemas.';

  // Limpa ambos timers no unmount pra não vazar
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (galeriaTimerRef.current) clearInterval(galeriaTimerRef.current);
  }, []);

  const gerar = () => {
    setLoading(true);
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);

    callServer<ServerResult>(acao)
      .then((r) => {
        if (r.ok && r.data) {
          // Aviso quando IA retornou texto sem JSON estruturado — não é erro
          // (já salvamos o bruto), mas user precisa saber que precisa formatar.
          const data = r.data as { parseAviso?: string };
          if (data.parseAviso === 'sim') {
            message.warning('Gerado mas a IA não devolveu JSON puro — conteúdo bruto salvo. Veja na lista.', 5);
          } else {
            message.success(isBlueprint ? 'Blueprint do Forja gerado' : 'Diagrama do Forja gerado');
          }
          onGerou(r.data);
          if (onReloadHistorico) onReloadHistorico();
        } else {
          message.error(r.error || 'Erro ao gerar', 6);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.indexOf('not available') >= 0) message.error('Geração só funciona no app publicado, com IA configurada');
        else message.error('Erro: ' + msg.slice(0, 200), 6);
      })
      .finally(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setLoading(false);
        setElapsed(0);
      });
  };

  // ─── Galeria completa (multi-gen) ──────────────────────────────────────────
  // Dispara gerarTodasAsVisoesDoForja no server, que itera nos 5 tipos.
  // O server-side é síncrono e demora ~75-150s — mostramos timer + aviso.
  // Resultado: array de diagramas + array de erros (parcial é OK).
  const gerarGaleria = () => {
    setGaleriaLoading(true);
    setGaleriaElapsed(0);
    const t0 = Date.now();
    galeriaTimerRef.current = setInterval(
      () => setGaleriaElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    );

    callServer<ServerResult>('gerarTodasAsVisoesDoForja')
      .then((r) => {
        if (r.ok && r.data) {
          const data = r.data as { gerados?: unknown[]; erros?: Array<{ tipo: string }>; total?: number };
          const okCount = (data.gerados || []).length;
          const errCount = (data.erros || []).length;
          if (errCount === 0) {
            message.success(`Galeria completa: ${okCount} visões geradas e marcadas como referência`, 6);
          } else {
            message.warning(`${okCount} visões geradas, ${errCount} falharam (${(data.erros || []).map(e => e.tipo).join(', ')})`, 8);
          }
          // Mostra a primeira no editor pra o user já ver algo
          const gerados = data.gerados as Array<{ titulo?: string; mermaid?: string; tipo?: string }>;
          if (gerados.length > 0) onGerou(gerados[0]);
          if (onReloadHistorico) onReloadHistorico();
        } else {
          message.error(r.error || 'Falha ao gerar galeria', 6);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.indexOf('not available') >= 0) message.error('Galeria só funciona no app publicado, com IA configurada');
        else message.error('Erro: ' + msg.slice(0, 200), 6);
      })
      .finally(() => {
        if (galeriaTimerRef.current) { clearInterval(galeriaTimerRef.current); galeriaTimerRef.current = null; }
        setGaleriaLoading(false);
        setGaleriaElapsed(0);
      });
  };

  // Estimativa de tempo da galeria (5 tipos × ~15-30s cada). Aviso quando passa.
  const galeriaTempoEstimado = '~1-2min';
  const galeriaPasse = galeriaElapsed >= 90;

  return (
    <div
      style={{
        position: 'relative',
        padding: '16px 18px',
        background: `linear-gradient(135deg, ${t.accents.peach}11 0%, ${t.accents.lavender}08 100%)`,
        border: `1px solid ${t.accents.peach}33`,
        borderRadius: 14,
        marginBottom: 18,
        overflow: 'hidden',
      }}
    >
      {/* Decorative flame icon as background watermark */}
      <Flame
        size={120}
        color={t.accents.peach}
        strokeWidth={0.8}
        style={{
          position: 'absolute', right: -20, top: -20,
          opacity: 0.06, pointerEvents: 'none',
        }}
      />

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${t.accents.peach}18`,
          border: `1px solid ${t.accents.peach}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Flame size={20} color={t.accents.peach} strokeWidth={1.6} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 500, color: t.text,
              letterSpacing: '-0.01em',
            }}>
              Forja sobre Forja
            </span>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: '0.08em',
              padding: '2px 7px', borderRadius: 999,
              background: `${t.accents.peach}22`,
              color: t.accents.peach,
              border: `1px solid ${t.accents.peach}44`,
              textTransform: 'uppercase',
            }}>
              dogfooding
            </span>
          </div>
          <div style={{
            fontSize: 12.5, color: t.textSecondary,
            marginTop: 4, lineHeight: 1.55, maxWidth: 620,
          }}>
            {descricao}
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip title="Gera 1 visão usando o Códex ativo. Pra ajustar padrões, edita em Atelier → Códex.">
              <Button
                type="primary"
                icon={loading ? undefined : <Sparkles size={14} />}
                onClick={gerar}
                loading={loading}
                disabled={galeriaLoading}
                style={{
                  background: t.accents.peach,
                  borderColor: t.accents.peach,
                }}
              >
                {loading ? 'Gerando…' : labelBotao}
              </Button>
            </Tooltip>

            {/* ─── Galeria completa: só pra diagrama (blueprint não tem 5 tipos) */}
            {!isBlueprint && (
              <Tooltip title="Gera as 5 visões do Forja (Fluxograma, Sequência, ER, Classes, Mapa mental) de uma vez. Cada uma vira referência fixada. Leva ~1-2min.">
                <Button
                  icon={galeriaLoading ? undefined : <Layers size={14} />}
                  onClick={gerarGaleria}
                  loading={galeriaLoading}
                  disabled={loading}
                  style={{
                    borderColor: `${t.accents.peach}66`,
                    color: t.accents.peach,
                    background: 'transparent',
                  }}
                >
                  {galeriaLoading ? `Gerando galeria… (${galeriaElapsed}s)` : 'Galeria completa (5 visões)'}
                </Button>
              </Tooltip>
            )}

            {/* Badge do modelo atual — sempre visível pra user saber o que gera */}
            <ModeloBadge uso={isBlueprint ? 'blueprint' : 'diagrama'} size="small" />

            {/* Timer/dica: prioridade é mostrar o loading ativo (single ou galeria) */}
            {loading ? (
              <span style={{
                fontFamily: FONTS.mono, fontSize: 10.5,
                color: elapsed >= 60 ? t.accents.peach : t.textTertiary,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Clock size={11} />
                {elapsed}s
                {elapsed >= 60 && <span style={{ fontWeight: 600 }}>· demorando, aguarde até 90s ou cancele</span>}
              </span>
            ) : galeriaLoading ? (
              <span style={{
                fontFamily: FONTS.mono, fontSize: 10.5,
                color: galeriaPasse ? t.accents.peach : t.textTertiary,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Clock size={11} />
                {galeriaElapsed}s de ~120s
                {galeriaPasse && <span style={{ fontWeight: 600 }}>· quase lá, são 5 chamadas seguidas</span>}
              </span>
            ) : (
              <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>
                {isBlueprint ? '~20–50s' : `1 visão ~10-20s · galeria ${galeriaTempoEstimado}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
