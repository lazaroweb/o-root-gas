import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Empty, Spin, Input, App as AntApp, Popconfirm, Tooltip } from 'antd';
import { FileText, Sparkles, Trash2, Flame, Pin, PinOff, Clock, AlertTriangle } from 'lucide-react';
import { Panel, CopyBlock } from '../components/ui';
import ContextoPicker, { type Contexto } from '../components/ContextoPicker';
import CodexToggle from '../components/CodexToggle';
import ForjaSobreForja from '../components/ForjaSobreForja';
import ModeloBadge from '../components/ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Ideia, Sistema, ServerResponse, ServerResult } from '../types';

interface BlueprintPrompts { cursor?: string; claude?: string; chatgpt?: string }
interface Blueprint {
  id?: string;
  titulo: string;
  conteudoMd: string;
  prompts?: BlueprintPrompts;
  data?: string;
  origem?: string;
  referencia?: string;
  modeloUsado?: string;
  parseAviso?: string;
}

export default function IABlueprint({ ideias, sistemas }: { ideias: Ideia[]; sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [contexto, setContexto] = useState<Contexto>({ modo: 'ideia' });
  const [stack, setStack] = useState('');
  // Códex: default ativado pra dar valor desde a primeira geração; user pode
  // desligar caso queira blueprint genérico.
  const [usarCodex, setUsarCodex] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Blueprint | null>(null);
  const [historico, setHistorico] = useState<Blueprint[]>([]);
  // Timer pra feedback visual de tempo enquanto LLM gera
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHist = () => {
    callServer<ServerResponse<Blueprint[]>>('getBlueprints')
      .then(res => { if (res.ok && res.data) setHistorico(res.data as Blueprint[]); })
      .catch(() => { /* ignore */ });
  };
  useEffect(loadHist, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const gerar = () => {
    setLoading(true);
    setResult(null);
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);

    callServer<ServerResponse<Blueprint>>('gerarBlueprint', { ...contexto, stack, usarCodex })
      .then(res => {
        if (res.ok && res.data) {
          const bp = res.data as Blueprint;
          setResult(bp);
          loadHist();
          if (bp.parseAviso === 'sim') {
            message.warning('Blueprint salvo mas a IA não devolveu JSON puro — veja o conteúdo bruto.', 5);
          } else {
            message.success('Blueprint gerado');
          }
        } else {
          message.error(res.error || 'Erro', 6);
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

  const remover = (id?: string) => {
    if (!id) return;
    callServer<ServerResponse<unknown>>('deleteBlueprint', id)
      .then(res => { if (res.ok) { setHistorico(h => h.filter(b => b.id !== id)); message.success('Removido'); } });
  };

  const alternarRef = (id?: string) => {
    if (!id) return;
    callServer<ServerResult>('alternarReferencia', 'blueprint', id)
      .then((r) => {
        if (r.ok) {
          loadHist();
          const novo = (r.data as { referencia?: string })?.referencia;
          message.success(novo === 'sim' ? 'Marcado como referência' : 'Desmarcado');
        } else {
          message.error(r.error || 'Erro');
        }
      });
  };

  // Pinned items (referencia=sim) sobem pro topo; depois ordem padrão (desc por data).
  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => {
      const aRef = a.referencia === 'sim' ? 1 : 0;
      const bRef = b.referencia === 'sim' ? 1 : 0;
      if (aRef !== bRef) return bRef - aRef;
      return 0; // mantém ordem do servidor
    });
  }, [historico]);

  const promptBox = (label: string, value?: string) => (
    value ? (
      <div style={{ marginTop: 12 }}>
        <CopyBlock label={label} text={value} maxHeight={220} mono={false} />
      </div>
    ) : null
  );

  return (
    <div>
      <ForjaSobreForja
        tipo="blueprint"
        onGerou={(r) => setResult(r)}
        onReloadHistorico={loadHist}
      />

      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileText size={18} strokeWidth={1.6} color={t.accents.blue} /> Gerador de Blueprint + Prompts</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>Transforma uma ideia em um blueprint completo e prompts prontos para colar no Cursor, Claude e ChatGPT.</p>
        <ContextoPicker value={contexto} onChange={setContexto} ideias={ideias} sistemas={sistemas} />
        <Input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Stack preferida (opcional). Ex.: Next.js + Supabase" style={{ marginTop: 12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<Sparkles size={16} />} loading={loading} onClick={gerar}>Gerar blueprint</Button>
          <CodexToggle value={usarCodex} onChange={setUsarCodex} />
          <ModeloBadge uso="blueprint" size="small" />
          {loading && (
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11,
              color: elapsed >= 60 ? t.accents.peach : t.textTertiary,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Clock size={12} />
              {elapsed}s
              {elapsed >= 60 && <span style={{ fontWeight: 600 }}>· demorando — aguarde até 90s</span>}
            </span>
          )}
        </div>
      </Panel>

      {loading && <div style={{ textAlign: 'center', margin: '40px auto' }}><Spin tip={`Arquitetando${elapsed > 0 ? ` (${elapsed}s)` : '...'}`}><div style={{ height: 60 }} /></Spin></div>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <Panel title={result.titulo}>
            <CopyBlock label="Blueprint (Markdown)" text={result.conteudoMd} maxHeight={420} />
            <div style={{ marginTop: 18, fontFamily: FONTS.display, fontSize: 15, color: t.text, fontWeight: 600 }}>Prompts prontos</div>
            {promptBox('Cursor', result.prompts?.cursor)}
            {promptBox('Claude', result.prompts?.claude)}
            {promptBox('ChatGPT', result.prompts?.chatgpt)}
          </Panel>
        </div>
      )}

      {historico.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Panel title="Blueprints salvos" padding={8}>
            {historicoOrdenado.map((b) => {
              const ehSelf = b.origem === 'forja-self';
              const ehRef = b.referencia === 'sim';
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    borderBottom: `1px solid ${t.borderSoft}`,
                    background: ehRef ? `${t.accents.peach}08` : 'transparent',
                    borderLeft: ehRef ? `3px solid ${t.accents.peach}` : '3px solid transparent',
                  }}
                >
                  {ehSelf ? (
                    <Flame size={16} color={t.accents.peach} strokeWidth={1.7} />
                  ) : (
                    <FileText size={16} color={t.textTertiary} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: t.text, fontWeight: 500, fontSize: 14 }}>{b.titulo}</span>
                      {ehSelf && (
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.08em',
                          padding: '1px 6px', borderRadius: 999,
                          background: `${t.accents.peach}18`,
                          color: t.accents.peach,
                          border: `1px solid ${t.accents.peach}33`,
                          textTransform: 'uppercase',
                        }}>
                          forja-self
                        </span>
                      )}
                      {ehRef && (
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.08em',
                          padding: '1px 6px', borderRadius: 999,
                          background: `${t.accents.peach}22`,
                          color: t.accents.peach,
                          border: `1px solid ${t.accents.peach}44`,
                          textTransform: 'uppercase',
                        }}>
                          referência
                        </span>
                      )}
                      {b.parseAviso === 'sim' && (
                        <Tooltip title="A IA não devolveu JSON estruturado — conteúdo bruto preservado.">
                          <span style={{
                            fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.08em',
                            padding: '1px 6px', borderRadius: 999,
                            background: `${t.accents.peach}10`,
                            color: t.accents.peach,
                            border: `1px solid ${t.accents.peach}55`,
                            textTransform: 'uppercase',
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <AlertTriangle size={9} /> bruto
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      {b.data && <span style={{ color: t.textTertiary, fontSize: 12 }}>{new Date(b.data).toLocaleString('pt-BR')}</span>}
                      {b.modeloUsado && <ModeloBadge stampedModelo={b.modeloUsado} size="small" />}
                    </div>
                  </div>
                  <Tooltip title={ehRef ? 'Remover dos fixados' : 'Fixar como referência'}>
                    <Button
                      size="small"
                      type="text"
                      icon={ehRef ? <PinOff size={14} /> : <Pin size={14} />}
                      onClick={() => alternarRef(b.id)}
                      style={{ color: ehRef ? t.accents.peach : t.textTertiary }}
                    />
                  </Tooltip>
                  <Button size="small" onClick={() => setResult(b)}>Abrir</Button>
                  <Popconfirm title="Remover blueprint?" onConfirm={() => remover(b.id)} okText="Remover" cancelText="Cancelar">
                    <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                  </Popconfirm>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

      {!loading && !result && historico.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Gere seu primeiro blueprint" style={{ marginTop: 40 }} />}
    </div>
  );
}
