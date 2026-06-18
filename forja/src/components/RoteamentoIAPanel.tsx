import React, { useCallback, useEffect, useState } from 'react';
import { Select, Button, Tag, Tooltip, Skeleton, App as AntApp } from 'antd';
import { Cpu, RefreshCw, Wand2, Cloud, CheckCircle2, Sparkles, Lightbulb } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface ServicoIAItem {
  id: string;
  label: string;
  descricao: string;
  stack: 'proxy' | 'gemini';
  complexidade: 'simples' | 'media' | 'pesada';
  roteavel: boolean;
  modeloEfetivo: string;
  overrideAtivo: boolean;
  rotulo: string;
  tier: string;
  endpoint: string;
  saude?: 'verde' | 'vermelho' | 'desconhecido';
  ultimaChamada?: { ts: number; ok: boolean; latenciaMs?: number; erro?: string } | null;
}

interface ServicosIAData {
  global: { configurado: boolean; modelo: string; provider: string; baseUrl: string; rotulo: string; tier: string; saude: 'verde' | 'vermelho' | 'desconhecido' };
  gemini: { configurado: boolean; modelo: string };
  servicos: ServicoIAItem[];
}

interface SugestaoItem {
  id: string;
  modeloRecomendado: string;
  alternativaMaisBarata: string;
  motivo: string;
  disponivel: boolean;
}

const COR_FAROL: Record<string, string> = { verde: '#3CB371', vermelho: '#E5484D', desconhecido: '#8C8884' };
const COR_COMPLEX: Record<string, 'green' | 'blue' | 'purple'> = { simples: 'green', media: 'blue', pesada: 'purple' };
const LABEL_COMPLEX: Record<string, string> = { simples: 'simples', media: 'média', pesada: 'pesada' };

export default function RoteamentoIAPanel({ embedded = false }: { embedded?: boolean }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<ServicosIAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelosDisp, setModelosDisp] = useState<string[]>([]);
  const [sugerindo, setSugerindo] = useState(false);
  const [sugestoes, setSugestoes] = useState<Record<string, SugestaoItem>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('listarServicosIA')
      .then((r) => { if (r.ok && r.data) setData(r.data as ServicosIAData); else message.error(r.error || 'Erro ao carregar'); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  }, [message]);

  const carregarModelos = useCallback(() => {
    callServer<ServerResult>('listModelosDisponiveis')
      .then((r) => {
        if (r.ok && r.data) {
          const ms = (r.data as { modelos: Array<{ id: string }> }).modelos.map((m) => m.id);
          setModelosDisp(ms);
        }
      })
      .catch(() => { /* sem /models — Select aceita digitar */ });
  }, []);

  useEffect(() => { carregar(); carregarModelos(); }, [carregar, carregarModelos]);

  const salvarModelo = async (uso: string, modelo: string) => {
    setSalvandoId(uso);
    try {
      const r = await callServer<ServerResult>('setModeloServico', uso, modelo);
      if (r.ok) { message.success(modelo ? 'Modelo definido' : 'Voltou ao padrão global'); carregar(); }
      else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvandoId(null);
    }
  };

  const sugerir = async () => {
    setSugerindo(true);
    try {
      const r = await callServer<ServerResult>('sugerirRoteamentoIA');
      if (r.ok && r.data) {
        const lista = (r.data as { sugestoes: SugestaoItem[] }).sugestoes || [];
        const map: Record<string, SugestaoItem> = {};
        lista.forEach((s) => { map[s.id] = s; });
        setSugestoes(map);
        if (lista.length === 0) message.info('A IA não retornou sugestões. Tente de novo.');
        else message.success('Sugestões geradas pela IA');
      } else {
        message.error(r.error || 'Não consegui sugerir');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao sugerir');
    } finally {
      setSugerindo(false);
    }
  };

  const aplicarTodas = async () => {
    const entradas = Object.values(sugestoes).filter((s) => s.modeloRecomendado);
    for (const s of entradas) {
      // eslint-disable-next-line no-await-in-loop
      await callServer<ServerResult>('setModeloServico', s.id, s.modeloRecomendado).catch(() => null);
    }
    message.success(`Aplicadas ${entradas.length} sugestões`);
    carregar();
  };

  const proxy = (data?.servicos || []).filter((s) => s.stack === 'proxy');
  const gemini = (data?.servicos || []).filter((s) => s.stack === 'gemini');

  const opcoesSelect = (atual: string) => {
    const base = Array.from(new Set([...modelosDisp, atual].filter(Boolean)));
    return base.map((id) => ({ value: id, label: id }));
  };

  const farol = (s: ServicoIAItem) => {
    const cor = COR_FAROL[s.saude || 'desconhecido'];
    const uc = s.ultimaChamada;
    const tip = uc
      ? `${uc.ok ? 'OK' : 'Falhou'}${uc.latenciaMs ? ` · ${uc.latenciaMs}ms` : ''}${uc.erro ? ` · ${uc.erro.slice(0, 90)}` : ''}`
      : 'Sem chamada recente neste serviço';
    return (
      <Tooltip title={tip}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, display: 'inline-block', flexShrink: 0, boxShadow: s.saude === 'verde' ? `0 0 5px ${COR_FAROL.verde}` : 'none' }} />
      </Tooltip>
    );
  };

  const tierChip = (tier: string, rotulo: string) => (
    <Tag style={{ marginInlineEnd: 0, fontFamily: FONTS.mono, fontSize: 10 }} color={
      tier === 'premium' ? 'purple' : tier === 'balanceado' ? 'blue' : tier === 'rapido' ? 'green' : tier === 'economico' ? 'gold' : 'default'
    }>{rotulo || '—'}</Tag>
  );

  const toolbar = (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { carregar(); carregarModelos(); }}>Resincronizar</Button>
      <Button size="small" type="primary" icon={<Wand2 size={13} />} loading={sugerindo} onClick={sugerir}>Sugerir modelos (IA)</Button>
    </div>
  );

  const corpo = (
    <>
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <>
          {/* Resumo global */}
          {data && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
              borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: COR_FAROL[data.global.saude], flexShrink: 0, boxShadow: data.global.saude === 'verde' ? `0 0 6px ${COR_FAROL.verde}` : 'none' }} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
                Modelo padrão global:
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.text }}>{data.global.modelo || '— não configurado —'}</span>
              {data.global.modelo && tierChip(data.global.tier, data.global.rotulo)}
              <span style={{ marginLeft: 'auto', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                {data.global.provider} · {data.global.baseUrl || 'sem endpoint'}
              </span>
            </div>
          )}

          {Object.keys(sugestoes).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Lightbulb size={14} color={t.accents.peach} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Sugestões da IA prontas — aplique por serviço ou todas de uma vez.</span>
              <Button size="small" type="link" onClick={aplicarTodas} style={{ padding: 0 }}>Aplicar todas</Button>
            </div>
          )}

          {/* Serviços proxy (roteáveis) */}
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            Proxy LLM — modelo por serviço
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {proxy.map((s) => {
              const sug = sugestoes[s.id];
              return (
                <div key={s.id} style={{
                  border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {farol(s)}
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{s.label}</span>
                    <Tag color={COR_COMPLEX[s.complexidade]} style={{ marginInlineEnd: 0, fontSize: 10 }}>{LABEL_COMPLEX[s.complexidade]}</Tag>
                    {s.overrideAtivo
                      ? tierChip(s.tier, s.rotulo)
                      : <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color="default">padrão global</Tag>}
                  </div>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.4 }}>{s.descricao}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Select
                      size="small"
                      style={{ minWidth: 280, flex: 1 }}
                      showSearch
                      allowClear
                      placeholder={`Padrão global (${data?.global.modelo || '—'})`}
                      value={s.overrideAtivo ? s.modeloEfetivo : undefined}
                      options={opcoesSelect(s.modeloEfetivo)}
                      loading={salvandoId === s.id}
                      onChange={(v) => salvarModelo(s.id, v || '')}
                      onClear={() => salvarModelo(s.id, '')}
                      notFoundContent={modelosDisp.length === 0 ? 'Liste os modelos em "Resincronizar"' : 'Nenhum modelo'}
                    />
                    <Tooltip title={`Modelo efetivo agora: ${s.modeloEfetivo || 'global'}`}>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>→ {s.modeloEfetivo || '—'}</span>
                    </Tooltip>
                  </div>

                  {sug && sug.modeloRecomendado && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      background: `${t.accents.peach}12`, border: `1px solid ${t.accents.peach}33`,
                      borderRadius: 8, padding: '6px 10px',
                    }}>
                      <Sparkles size={12} color={t.accents.clay} />
                      <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary }}>
                        Sugerido: <strong style={{ fontFamily: FONTS.mono }}>{sug.modeloRecomendado}</strong>
                        {sug.alternativaMaisBarata && <> · + barato: <span style={{ fontFamily: FONTS.mono }}>{sug.alternativaMaisBarata}</span></>}
                        {sug.motivo && <span style={{ color: t.textTertiary }}> — {sug.motivo}</span>}
                        {!sug.disponivel && <Tag color="warning" style={{ marginLeft: 6, fontSize: 10 }}>fora da lista</Tag>}
                      </span>
                      <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} style={{ marginLeft: 'auto' }} onClick={() => salvarModelo(s.id, sug.modeloRecomendado)}>
                        Aplicar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Serviços Gemini (view-only) */}
          {gemini.length > 0 && (
            <>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '18px 0 8px' }}>
                Gemini (multimodal) — só visualização
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gemini.map((s) => (
                  <div key={s.id} style={{
                    border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>
                    <Cloud size={14} color={t.accents.sage} />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>{s.label}</span>
                    <Tag color={COR_COMPLEX[s.complexidade]} style={{ marginInlineEnd: 0, fontSize: 10 }}>{LABEL_COMPLEX[s.complexidade]}</Tag>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.textSecondary }}>{s.modeloEfetivo || '— não configurado —'}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                      troque no painel “Google Gemini” acima
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 14, lineHeight: 1.5 }}>
            O farol (●) de cada serviço reflete a <strong>última chamada real daquele serviço</strong> nos últimos 30 min:
            verde = ok, vermelho = falhou, cinza = sem chamada recente. Passe o mouse pra ver latência/erro.
          </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{toolbar}</div>
        {corpo}
      </div>
    );
  }

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Cpu size={18} strokeWidth={1.6} color={t.accents.blue} /> Roteamento de IA por serviço</span>}
      extra={toolbar}
    >
      {corpo}
    </Panel>
  );
}
