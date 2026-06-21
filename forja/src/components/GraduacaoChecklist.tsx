import React, { useEffect, useState } from 'react';
import { Typography, Button, Switch, Spin, App as AntApp, Modal } from 'antd';
import { CheckCircle2, Circle, ArrowUpRight, Sparkles, Lock } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Criterio {
  id: string;
  label: string;
  auto: boolean;
  ok: boolean;
  detalhe: string;
}

interface GraduacaoData {
  estagio: string;
  criterios: Criterio[];
  prontos: number;
  total: number;
  podeGraduar: boolean;
}

interface GraduacaoChecklistProps {
  sistemaId: string;
  onGraduated?: () => void;
  // Quando muda, força recarregar o status (ex.: após adicionar um custo).
  reloadSignal?: number;
}

// Checklist de saída do estágio Forja (portão Forja → Têmpera).
// 4 critérios auto-avaliados + 1 toggle manual ("fluxo validado").
export default function GraduacaoChecklist({ sistemaId, onGraduated, reloadSignal }: GraduacaoChecklistProps): React.ReactElement | null {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<GraduacaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvandoFluxo, setSalvandoFluxo] = useState(false);
  const [graduando, setGraduando] = useState(false);

  const carregar = () => {
    callServer<ServerResult>('graduacaoStatus', sistemaId)
      .then((r) => { if (r.ok && r.data) setData(r.data as GraduacaoData); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId, reloadSignal]);

  const toggleFluxo = async (valor: boolean) => {
    setSalvandoFluxo(true);
    try {
      const r = await callServer<ServerResult>('setFluxoValidado', sistemaId, valor);
      if (r.ok) carregar();
      else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvandoFluxo(false);
    }
  };

  const graduar = () => {
    Modal.confirm({
      title: 'Graduar para Têmpera?',
      content: 'O sistema sai de "em construção" (Forja) e passa a "no ar" (Têmpera). Você pode reverter editando o estágio depois.',
      okText: 'Graduar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setGraduando(true);
        try {
          const r = await callServer<ServerResult>('graduarSistema', sistemaId);
          if (r.ok) {
            message.success('Graduado para Têmpera!');
            onGraduated?.();
          } else {
            message.error(r.error || 'Não foi possível graduar');
          }
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Erro');
        } finally {
          setGraduando(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <Panel style={{ marginBottom: 16 }} padding={18}>
        <Spin />
      </Panel>
    );
  }

  // Só mostra o portão quando o sistema está em Forja.
  if (!data || data.estagio !== 'forja') return null;

  const pct = Math.round((data.prontos / data.total) * 100);
  const cor = data.podeGraduar ? t.accents.sage : t.accents.peach;

  return (
    <Panel style={{ marginBottom: 16 }} padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color={cor} />
          <Typography.Text strong style={{ color: t.text, fontSize: 15 }}>Pronto pra Têmpera?</Typography.Text>
          <span style={{ fontSize: 12, color: t.textTertiary }}>portão Forja → Têmpera</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: cor }}>{data.prontos}/{data.total} critérios</span>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: t.borderSoft, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 999, transition: 'width .3s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.criterios.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>
              {c.ok
                ? <CheckCircle2 size={18} color={t.accents.sage} />
                : <Circle size={18} color={t.textTertiary} strokeWidth={1.5} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Typography.Text style={{ color: c.ok ? t.text : t.textSecondary, fontSize: 14 }}>{c.label}</Typography.Text>
                {!c.auto && (
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: t.accents.peach, background: `${t.accents.peach}1f`, padding: '1px 7px', borderRadius: 999 }}>MANUAL</span>
                )}
              </div>
              <Typography.Text style={{ color: t.textTertiary, fontSize: 12 }}>{c.detalhe}</Typography.Text>
            </div>
            {!c.auto && (
              <Switch
                size="small"
                checked={c.ok}
                loading={salvandoFluxo}
                onChange={toggleFluxo}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button
          type="primary"
          icon={data.podeGraduar ? <ArrowUpRight size={15} /> : <Lock size={14} />}
          disabled={!data.podeGraduar}
          loading={graduando}
          onClick={graduar}
        >
          Graduar pra Têmpera
        </Button>
      </div>
    </Panel>
  );
}
