// OtimizadorIAModal — v1.265.0
// Otimização IA em massa de Skills/Agents no Atelier, com modelo dedicado
// (serviço 'atelier' no Roteamento de IA — ex.: Fable 5).
//
// Fluxo: configurar escopo → análise chunked (25/chamada, com progresso) →
// revisão das sugestões (aceita/rejeita por item) → aplicar só o aceito.
// NADA é gravado sem passar pela revisão.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Checkbox, Progress, Segmented, Tag, message, Empty } from 'antd';
import { Sparkles, Wand2, CheckCircle2, ArrowRight } from 'lucide-react';
import ModeloBadge from './ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface SugestaoOtimizacao {
  id: string;
  nome: string;
  atual: { categoria: string; tags: string; descricao: string; estrelas: number };
  sugestao: { categoria?: string; tags?: string; descricao?: string; estrelas?: number; motivo: string };
}

interface Props {
  aberto: boolean;
  onClose: () => void;
  tipo: 'skills' | 'agents';
  // Chamado depois de aplicar com sucesso (recarrega a lista do hub).
  onAplicado: () => void;
}

type Fase = 'config' | 'analisando' | 'revisao' | 'aplicando';

export default function OtimizadorIAModal({ aberto, onClose, tipo, onAplicado }: Props): React.ReactElement {
  const t = useTokens();
  const isSkills = tipo === 'skills';
  const label = isSkills ? 'skill' : 'agent';
  const cor = t.accents.lavender;

  const [fase, setFase] = useState<Fase>('config');
  const [escopo, setEscopo] = useState<'pendentes' | 'todas'>('pendentes');
  const [prog, setProg] = useState<{ feitas: number; total: number } | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoOtimizacao[]>([]);
  const [aceitas, setAceitas] = useState<Set<string>>(new Set());
  const [erroAnalise, setErroAnalise] = useState('');
  // Ref (não state): o loop de análise lê o valor atual a cada iteração —
  // state ficaria congelado na closure e o "Parar" não funcionaria.
  const canceladoRef = useRef(false);

  useEffect(() => {
    if (aberto) {
      setFase('config');
      setProg(null);
      setSugestoes([]);
      setAceitas(new Set());
      setErroAnalise('');
      canceladoRef.current = false;
    }
  }, [aberto]);

  const analisar = async () => {
    setFase('analisando');
    setErroAnalise('');
    const acumulado: SugestaoOtimizacao[] = [];
    let offset = 0;
    let guarda = 0;
    try {
      // Loop chunked: cada chamada analisa ~25 itens e devolve `restantes`.
      // 200 iterações cobre 5000 itens — folga pra base de ~1000.
      for (;;) {
        guarda++;
        if (guarda > 200 || canceladoRef.current) break;
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('hubOtimizarComIA', { tipo, escopo, offset });
        if (!r.ok) { setErroAnalise(r.error || 'Erro na análise'); break; }
        const d = r.data as { sugestoes: SugestaoOtimizacao[]; processados: number; restantes: number; total: number };
        acumulado.push(...(d.sugestoes || []));
        offset += d.processados;
        setProg({ feitas: offset, total: d.total });
        setSugestoes([...acumulado]);
        if (d.restantes <= 0 || d.processados === 0) break;
      }
    } catch (e) {
      setErroAnalise(e instanceof Error ? e.message : 'Erro na análise');
    }
    setSugestoes(acumulado);
    setAceitas(new Set(acumulado.map((s) => s.id)));
    setFase('revisao');
  };

  const aplicar = async () => {
    const itens = sugestoes
      .filter((s) => aceitas.has(s.id))
      .map((s) => ({
        id: s.id,
        categoria: s.sugestao.categoria,
        tags: s.sugestao.tags,
        descricao: s.sugestao.descricao,
        estrelas: s.sugestao.estrelas,
        motivo: s.sugestao.motivo,
      }));
    if (itens.length === 0) { onClose(); return; }
    setFase('aplicando');
    try {
      let atualizados = 0;
      // hubOtimizacaoAplicar aceita até 300 por chamada.
      for (let i = 0; i < itens.length; i += 300) {
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('hubOtimizacaoAplicar', { tipo, itens: itens.slice(i, i + 300) });
        if (!r.ok) { message.error(r.error || 'Erro ao aplicar'); setFase('revisao'); return; }
        atualizados += ((r.data as { atualizados: number })?.atualizados || 0);
      }
      message.success(`Otimização aplicada em ${atualizados} ${label}(s).`);
      onAplicado();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao aplicar');
      setFase('revisao');
    }
  };

  const toggle = (id: string) => {
    setAceitas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const camposMudados = (s: SugestaoOtimizacao): Array<{ campo: string; de: string; para: string }> => {
    const out: Array<{ campo: string; de: string; para: string }> = [];
    if (s.sugestao.categoria !== undefined) out.push({ campo: 'Categoria', de: s.atual.categoria || '—', para: s.sugestao.categoria });
    if (s.sugestao.tags !== undefined) out.push({ campo: 'Tags', de: s.atual.tags || '—', para: s.sugestao.tags });
    if (s.sugestao.descricao !== undefined) out.push({ campo: 'Descrição', de: s.atual.descricao || '—', para: s.sugestao.descricao });
    if (s.sugestao.estrelas !== undefined) out.push({ campo: 'Estrelas', de: `${s.atual.estrelas}★`, para: `${s.sugestao.estrelas}★` });
    return out;
  };

  const fechar = () => {
    canceladoRef.current = true;
    onClose();
  };

  const nAceitas = useMemo(() => sugestoes.filter((s) => aceitas.has(s.id)).length, [sugestoes, aceitas]);
  const analisando = fase === 'analisando';

  return (
    <Modal
      open={aberto}
      onCancel={fase === 'aplicando' ? undefined : fechar}
      width={760}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Wand2 size={18} color={cor} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
            Otimizar {isSkills ? 'skills' : 'agents'} com IA
          </span>
        </span>
      }
      footer={
        fase === 'config' ? [
          <Button key="cancelar" onClick={fechar}>Cancelar</Button>,
          <Button key="ir" type="primary" icon={<Sparkles size={14} />} onClick={() => { void analisar(); }}
            style={{ background: cor, borderColor: cor }}>
            Iniciar análise
          </Button>,
        ] : fase === 'analisando' ? [
          <Button key="parar" onClick={() => { canceladoRef.current = true; }}>Parar aqui e revisar o que já foi analisado</Button>,
        ] : [
          <Button key="descartar" onClick={fechar} disabled={fase === 'aplicando'}>Descartar tudo</Button>,
          <Button
            key="aplicar" type="primary" icon={<CheckCircle2 size={14} />}
            onClick={() => { void aplicar(); }}
            loading={fase === 'aplicando'}
            disabled={nAceitas === 0}
            style={{ background: cor, borderColor: cor }}
          >
            Aplicar {nAceitas} aceita{nAceitas === 1 ? '' : 's'}
          </Button>,
        ]
      }
    >
      {/* Modelo em uso — configurável em Configurações → IA → Roteamento (serviço "Atelier"). */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap',
        padding: '8px 12px', borderRadius: 10,
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
      }}>
        <Sparkles size={14} color={cor} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
          Modelo desta análise:
        </span>
        <ModeloBadge uso="atelier" size="medium" />
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
          troque em Configurações → IA → Roteamento → “Atelier”
        </span>
      </div>

      {fase === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            A IA analisa os <strong style={{ color: t.text }}>metadados</strong> de cada {label} (nome, descrição,
            categoria, tags e estrelas) e sugere ajustes. <strong style={{ color: t.text }}>Nada é gravado sem a sua
            revisão</strong> — no final você aceita ou rejeita item por item.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Escopo:</span>
            <Segmented
              value={escopo}
              onChange={(v) => setEscopo(v as 'pendentes' | 'todas')}
              options={[
                { label: 'Só incompletas (sem categoria, nota ou descrição)', value: 'pendentes' },
                { label: 'Base inteira', value: 'todas' },
              ]}
            />
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.5 }}>
            A análise roda em lotes de 25 — pra base inteira (~1000 itens) leva alguns minutos e gasta tokens
            proporcionais. Você pode parar no meio e revisar o que já foi analisado.
          </div>
        </div>
      )}

      {analisando && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
            <Sparkles size={13} color={cor} />
            Analisando {isSkills ? 'skills' : 'agents'}: <strong>{prog?.feitas ?? 0}</strong>/{prog?.total ?? '…'}
            <span style={{ marginLeft: 'auto', color: t.textTertiary, fontSize: 11.5 }}>
              {sugestoes.length} sugestão(ões) até agora
            </span>
          </div>
          <Progress
            percent={prog ? Math.round((prog.feitas / Math.max(prog.total, 1)) * 100) : 0}
            strokeColor={cor}
            size="small"
          />
        </div>
      )}

      {(fase === 'revisao' || fase === 'aplicando') && (
        <>
          {erroAnalise && (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 10,
              background: `${t.accents.rose}1f`, border: `1px solid ${t.accents.rose}55`,
              borderRadius: 10, padding: '8px 12px',
            }}>
              A análise parou com erro: {erroAnalise} — o que foi analisado até ali está abaixo.
            </div>
          )}
          {sugestoes.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`A IA não encontrou nada pra melhorar nesse escopo — ${prog?.total ?? 0} ${label}(s) analisado(s), tudo em ordem.`}
            />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
                  <strong style={{ color: t.text }}>{sugestoes.length}</strong> sugestão(ões) de {prog?.total ?? '—'} analisado(s) · {nAceitas} aceita(s)
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button size="small" onClick={() => setAceitas(new Set(sugestoes.map((s) => s.id)))}>Aceitar todas</Button>
                  <Button size="small" onClick={() => setAceitas(new Set())}>Desmarcar todas</Button>
                </span>
              </div>
              <div className="forja-scroll-y" style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {sugestoes.map((s) => {
                  const on = aceitas.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      style={{
                        border: `1px solid ${on ? `${cor}66` : t.borderSoft}`,
                        background: on ? `${cor}0d` : 'transparent',
                        borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Checkbox checked={on} onClick={(e) => e.stopPropagation()} onChange={() => toggle(s.id)} />
                        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, flex: 1, minWidth: 0 }}>
                          {s.nome}
                        </span>
                        {s.sugestao.motivo && (
                          <Tag bordered={false} style={{ borderRadius: 999, fontSize: 10.5, margin: 0, background: `${t.accents.peach}1f`, color: t.textSecondary }}>
                            {s.sugestao.motivo}
                          </Tag>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {camposMudados(s).map((c) => (
                          <div key={c.campo} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: FONTS.ui, fontSize: 11.5, lineHeight: 1.5 }}>
                            <span style={{ color: t.textTertiary, minWidth: 66, flexShrink: 0 }}>{c.campo}</span>
                            <span style={{ color: t.textTertiary, textDecoration: 'line-through', wordBreak: 'break-word' }}>{c.de}</span>
                            <ArrowRight size={11} color={t.textTertiary} style={{ flexShrink: 0, alignSelf: 'center' }} />
                            <span style={{ color: t.text, wordBreak: 'break-word' }}>{c.para}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ─── Revisão profunda (conteúdo completo, 1 item) ───────────────────────────
// Botão no drawer da skill/agent → a IA reescreve o markdown inteiro → preview
// lado a lado + resumo das mudanças → só grava se o usuário aplicar.

interface RevisaoProps {
  aberto: boolean;
  onClose: () => void;
  tipo: 'skills' | 'agents';
  id: string;
  nome: string;
  // Chamado com o conteúdo novo depois de aplicar (pra UI atualizar o drawer).
  onAplicado: (conteudoNovo: string) => void;
}

export function RevisaoProfundaModal({ aberto, onClose, tipo, id, nome, onAplicado }: RevisaoProps): React.ReactElement {
  const t = useTokens();
  const cor = t.accents.lavender;
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<{ conteudoOriginal: string; conteudoRevisado: string; resumo: string[] } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setResultado(null);
    setErro('');
    setCarregando(true);
    callServer<ServerResult>('hubRevisarProfundo', { tipo, id })
      .then((r) => {
        if (r.ok && r.data) setResultado(r.data as typeof resultado);
        else setErro(r.error || 'Erro na revisão');
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, id]);

  const aplicar = async () => {
    if (!resultado) return;
    setAplicando(true);
    try {
      const r = await callServer<ServerResult>('hubRevisaoProfundaAplicar', { tipo, id, conteudo: resultado.conteudoRevisado });
      if (r.ok) {
        message.success('Revisão aplicada — conteúdo atualizado.');
        onAplicado(resultado.conteudoRevisado);
        onClose();
      } else message.error(r.error || 'Erro ao aplicar');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setAplicando(false); }
  };

  return (
    <Modal
      open={aberto}
      onCancel={aplicando ? undefined : onClose}
      width={900}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Wand2 size={18} color={cor} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Revisão profunda — {nome}</span>
        </span>
      }
      footer={[
        <Button key="descartar" onClick={onClose} disabled={aplicando}>Descartar</Button>,
        <Button
          key="aplicar" type="primary" icon={<CheckCircle2 size={14} />}
          onClick={() => { void aplicar(); }}
          loading={aplicando} disabled={!resultado}
          style={{ background: cor, borderColor: cor }}
        >
          Aplicar revisão
        </Button>,
      ]}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap',
        padding: '8px 12px', borderRadius: 10,
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
      }}>
        <Sparkles size={14} color={cor} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Modelo desta revisão:</span>
        <ModeloBadge uso="atelier" size="medium" />
      </div>

      {carregando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
          <Progress type="circle" size={28} percent={99} strokeColor={cor} format={() => ''} />
          A IA está reescrevendo o conteúdo completo… pode levar até 1 minuto.
        </div>
      )}

      {erro && !carregando && (
        <div style={{
          fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, lineHeight: 1.6,
          background: `${t.accents.rose}1f`, border: `1px solid ${t.accents.rose}55`,
          borderRadius: 10, padding: '10px 14px',
        }}>
          {erro}
        </div>
      )}

      {resultado && !carregando && (
        <>
          {resultado.resumo.length > 0 && (
            <div style={{
              marginBottom: 12, borderRadius: 10, padding: '10px 14px',
              background: `${t.accents.sage}1f`, border: `1px solid ${t.accents.sage}55`,
            }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                O que mudou
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.7 }}>
                {resultado.resumo.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {([['Original', resultado.conteudoOriginal], ['Revisado', resultado.conteudoRevisado]] as const).map(([titulo, txt]) => (
              <div key={titulo} style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: titulo === 'Revisado' ? cor : t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {titulo}
                </div>
                <pre className="forja-scroll-y" style={{
                  margin: 0, maxHeight: '46vh', overflow: 'auto',
                  fontFamily: FONTS.mono, fontSize: 11, lineHeight: 1.55, color: t.textSecondary,
                  background: t.surfaceMuted, border: `1px solid ${titulo === 'Revisado' ? `${cor}55` : t.borderSoft}`,
                  borderRadius: 10, padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{txt}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
