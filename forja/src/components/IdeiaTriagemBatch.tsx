// IdeiaTriagemBatch — modo "Foco" de triagem em batch.
//
// Inspiração: Superhuman (e-mail), Things 3 (inbox review). Quando você tem 12
// ideias acumuladas no Inbox, abrir uma por uma é lento. Aqui você fica em
// modo foco: 1 ideia gigante centralizada, navega com ← → (ou J/K), decide com
// 1 tecla (C=concluir, A=arquivar, D=descartar, G=gênese, B=backlog,
// T=triagem detalhada). Sai com Esc.
//
// O Modal abre fullscreen pra forçar foco — sem sidebar, sem distrações.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, Button, Tag, Progress, App as AntApp, Tooltip, Empty,
} from 'antd';
import {
  Check, Archive, XCircle, Sparkles, ListChecks, Settings2,
  ArrowLeft, ArrowRight, X, Flame, Clock,
} from 'lucide-react';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import IdeiaTriagemDrawer from './IdeiaTriagemDrawer';
import type { Ideia, Sistema, ServerResult } from '../types';

interface IdeiaTriagemBatchProps {
  ideias: Ideia[]; // fila de ideias a triar (geralmente: inbox bruto, ordenado por criadoEm desc)
  sistemas: Sistema[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onGenese?: (ideiaId: string) => void;
}

function tempoRelativo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const me = Math.floor(d / 30);
  return `há ${me}m`;
}

export default function IdeiaTriagemBatch({
  ideias, sistemas, open, onClose, onChanged, onGenese,
}: IdeiaTriagemBatchProps): React.ReactElement | null {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [idx, setIdx] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [triagemDetalhada, setTriagemDetalhada] = useState<Ideia | null>(null);
  // Lista local: snapshot quando abre. Conforme decide, marca como processada
  // sem remover (assim mantém o índice estável e o progresso "5 de 12").
  const [processadas, setProcessadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setIdx(0);
      setProcessadas(new Set());
    }
  }, [open]);

  const total = ideias.length;
  const atual = ideias[idx] || null;
  const processadasCount = processadas.size;
  const restantes = total - processadasCount;

  const sistemaNome = useCallback((id?: string) => sistemas.find((s) => s.id === id)?.nome || '', [sistemas]);

  const proximo = useCallback(() => {
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const anterior = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  const marcar = useCallback((id: string) => {
    setProcessadas((s) => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }, []);

  const acaoSimples = useCallback(async (fn: string, ideiaAtual: Ideia, sucesso: string) => {
    setProcessing(true);
    try {
      const r = await callServer<ServerResult>(fn, ideiaAtual.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success(sucesso);
      marcar(ideiaAtual.id);
      onChanged();
      // Auto-avança pra próxima — mantém o fluxo rápido tipo email zero.
      setTimeout(() => proximo(), 80);
    } finally {
      setProcessing(false);
    }
  }, [message, marcar, onChanged, proximo]);

  const concluir = () => atual && acaoSimples('concluirIdeia', atual, 'Concluída ✓');
  const arquivar = () => atual && acaoSimples('arquivarIdeia', atual, 'Arquivada');
  const descartar = () => atual && acaoSimples('descartarIdeia', atual, 'Descartada');

  const irGenese = () => {
    if (!atual) return;
    marcar(atual.id);
    onChanged();
    onClose();
    onGenese?.(atual.id);
  };

  // Hotkeys do modo foco. Só ativas quando o modal está aberto e não tem
  // triagem detalhada por cima (senão atrapalha o drawer interno).
  useEffect(() => {
    if (!open || triagemDetalhada) return undefined;
    const handler = (e: KeyboardEvent) => {
      // Não capturar se digitando em input
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'j' || k === ' ') { e.preventDefault(); proximo(); return; }
      if (k === 'arrowleft' || k === 'k') { e.preventDefault(); anterior(); return; }
      if (!atual) return;
      if (k === 'c') { e.preventDefault(); concluir(); }
      else if (k === 'a') { e.preventDefault(); arquivar(); }
      else if (k === 'd') { e.preventDefault(); descartar(); }
      else if (k === 'g') { e.preventDefault(); irGenese(); }
      else if (k === 't') { e.preventDefault(); setTriagemDetalhada(atual); }
      else if (k === 'escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, triagemDetalhada, atual, proximo, anterior]);

  const pctProgresso = total > 0 ? Math.round((processadasCount / total) * 100) : 0;

  const ehProcessada = atual ? processadas.has(atual.id) : false;

  const kbd = (txt: string): React.ReactElement => (
    <kbd style={{
      fontFamily: FONTS.mono,
      background: t.surfaceMuted,
      color: t.textSecondary,
      border: `1px solid ${t.border}`,
      padding: '1px 6px',
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 500,
    }}>{txt}</kbd>
  );

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={null}
        footer={null}
        width="min(900px, 92vw)"
        destroyOnClose
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 22, overflow: 'hidden', background: t.surface },
        }}
      >
        {/* Header do modo foco */}
        <div style={{
          padding: '18px 28px',
          background: `linear-gradient(180deg, ${t.accents.peach}0c 0%, ${t.surface} 100%)`,
          borderBottom: `1px solid ${t.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `${t.accents.peach}24`, color: t.accents.peach,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={18} />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>
                Modo Foco · Triagem
              </div>
              <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>
                {processadasCount > 0
                  ? `${processadasCount} de ${total} processadas · ${restantes} restando`
                  : `${total} pra triar`}
              </div>
            </div>
          </div>
          <Button type="text" icon={<X size={18} />} onClick={onClose} />
        </div>

        {/* Progress bar */}
        <Progress
          percent={pctProgresso}
          showInfo={false}
          strokeColor={t.accents.peach}
          trailColor={t.surfaceMuted}
          style={{ margin: 0 }}
          size={4}
        />

        {/* Corpo */}
        {total === 0 ? (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <Empty description="Inbox vazio. Boa!" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            <Button style={{ marginTop: 16 }} onClick={onClose}>Fechar</Button>
          </div>
        ) : !atual ? (
          <div style={{ padding: 80, textAlign: 'center', color: t.textSecondary }}>
            Sem mais ideias.
          </div>
        ) : (
          <div style={{ padding: '40px 48px 24px', minHeight: 360 }}>
            {/* Status da ideia: indicador "já processada" pra avisar caso volte */}
            {ehProcessada && (
              <Tag
                bordered={false}
                style={{
                  background: `${t.accents.sage}1f`,
                  color: t.accents.sage,
                  borderRadius: 999,
                  fontSize: 11,
                  marginBottom: 14,
                }}
              >
                <Check size={11} style={{ verticalAlign: -2, marginRight: 4 }} />
                Já processada nesta sessão
              </Tag>
            )}

            <div style={{
              fontFamily: FONTS.display,
              fontSize: 28,
              fontWeight: 600,
              color: t.text,
              lineHeight: 1.25,
              marginBottom: 18,
              opacity: ehProcessada ? 0.5 : 1,
              textDecoration: ehProcessada ? 'line-through' : 'none',
            }}>
              {atual.titulo}
            </div>

            {atual.descricao && (
              <div style={{
                color: t.textSecondary,
                fontSize: 15,
                lineHeight: 1.55,
                marginBottom: 20,
                whiteSpace: 'pre-wrap',
                opacity: ehProcessada ? 0.5 : 1,
              }}>
                {atual.descricao}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 28 }}>
              {atual.categoria && (
                <Tag style={{ borderRadius: 999, fontSize: 11 }}>{atual.categoria}</Tag>
              )}
              {atual.prioridade && (
                <Tag
                  bordered={false}
                  style={{
                    background: `${atual.prioridade === 'alta' ? t.accents.rose : atual.prioridade === 'media' ? t.accents.clay : t.accents.blue}1f`,
                    color: atual.prioridade === 'alta' ? t.accents.rose : atual.prioridade === 'media' ? t.accents.clay : t.accents.blue,
                    borderRadius: 999, fontSize: 11, textTransform: 'capitalize',
                  }}
                >
                  {atual.prioridade}
                </Tag>
              )}
              {atual.sistemaId && sistemaNome(atual.sistemaId) && (
                <Tag style={{ borderRadius: 999, fontSize: 11 }}>{sistemaNome(atual.sistemaId)}</Tag>
              )}
              {atual.criadoEm && (
                <Tooltip title={new Date(atual.criadoEm).toLocaleString('pt-BR')}>
                  <span style={{ fontSize: 11, color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {tempoRelativo(atual.criadoEm)}
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Ações primárias com hotkeys destacadas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
              <Button
                size="large"
                icon={<Check size={16} />}
                onClick={concluir}
                loading={processing}
                style={{ color: t.accents.sage, borderColor: `${t.accents.sage}77` }}
              >
                Concluir {kbd('C')}
              </Button>
              <Button
                size="large"
                icon={<Sparkles size={16} />}
                onClick={irGenese}
                loading={processing}
                style={{ color: t.accents.peach, borderColor: `${t.accents.peach}77` }}
              >
                Gênese {kbd('G')}
              </Button>
              <Button
                size="large"
                icon={<Archive size={16} />}
                onClick={arquivar}
                loading={processing}
              >
                Arquivar {kbd('A')}
              </Button>
              <Button
                size="large"
                icon={<XCircle size={16} />}
                onClick={descartar}
                loading={processing}
              >
                Descartar {kbd('D')}
              </Button>
              <Button
                size="large"
                icon={<Settings2 size={16} />}
                onClick={() => setTriagemDetalhada(atual)}
              >
                Triar { kbd('T') }
              </Button>
            </div>
          </div>
        )}

        {/* Footer: navegação */}
        <div style={{
          padding: '14px 28px',
          background: t.surfaceMuted,
          borderTop: `1px solid ${t.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="middle"
              icon={<ArrowLeft size={14} />}
              onClick={anterior}
              disabled={idx === 0}
            >
              Anterior
            </Button>
            <Button
              size="middle"
              type="primary"
              icon={<ArrowRight size={14} />}
              onClick={proximo}
              disabled={idx >= total - 1}
              iconPosition="end"
            >
              Próxima
            </Button>
          </div>
          <div style={{ fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{idx + 1} / {total}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{kbd('←')} {kbd('→')} ou {kbd('J')} {kbd('K')} pra navegar</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{kbd('Esc')} sai</span>
          </div>
        </div>
      </Modal>

      <IdeiaTriagemDrawer
        ideia={triagemDetalhada}
        open={!!triagemDetalhada}
        onClose={() => setTriagemDetalhada(null)}
        onChanged={() => {
          if (triagemDetalhada) marcar(triagemDetalhada.id);
          onChanged();
        }}
        onGenese={onGenese}
        sistemas={sistemas}
      />
    </>
  );
}
