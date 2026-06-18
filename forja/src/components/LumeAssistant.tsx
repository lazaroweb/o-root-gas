import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Spin, App as AntApp } from 'antd';
import { Flame, Send, User, Eraser, RefreshCw, X, Lightbulb } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface LumeMsg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGESTOES = [
  'O que eu deveria priorizar agora no meu portfólio?',
  'Me explica como funciona a importação de fatura por IA.',
  'Quais sistemas estão com a saúde mais baixa e por quê?',
  'Tive uma ideia nova — me ajuda a lapidar?',
];

// Renderiza markdown leve (negrito, `code`, listas) sem dependência externa.
function renderInline(text: string, t: ReturnType<typeof useTokens>): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) {
      return (
        <code key={i} style={{ fontFamily: FONTS.mono, fontSize: 12, padding: '1px 5px', borderRadius: 5, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
          {p.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function renderRich(content: string, t: ReturnType<typeof useTokens>): React.ReactNode {
  const linhas = content.split('\n');
  return linhas.map((linha, i) => {
    const bullet = /^\s*[-*]\s+/.test(linha);
    const ordered = /^\s*\d+\.\s+/.test(linha);
    if (bullet) {
      return (
        <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 2, margin: '2px 0' }}>
          <span style={{ color: t.accents.peach, flexShrink: 0 }}>•</span>
          <span>{renderInline(linha.replace(/^\s*[-*]\s+/, ''), t)}</span>
        </div>
      );
    }
    if (ordered) {
      const num = (linha.match(/^\s*(\d+)\./) || [])[1] || '';
      return (
        <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 2, margin: '2px 0' }}>
          <span style={{ color: t.accents.peach, flexShrink: 0, fontFamily: FONTS.mono, fontSize: 12 }}>{num}.</span>
          <span>{renderInline(linha.replace(/^\s*\d+\.\s+/, ''), t)}</span>
        </div>
      );
    }
    if (!linha.trim()) return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ margin: '2px 0' }}>{renderInline(linha, t)}</div>;
  });
}

export default function LumeAssistant({ viewLabel }: { viewLabel: string }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<LumeMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dica, setDica] = useState('');
  const [dicaLoading, setDicaLoading] = useState(false);
  const [dicaErro, setDicaErro] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // Guarda anti-loop: ignora respostas obsoletas e mata o spinner se o
  // google.script.run pendurar (proxy de IA lento/travado).
  const dicaReqRef = useRef(0);
  const dicaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  // Esc fecha o painel flutuante.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const carregarDica = useCallback(() => {
    const reqId = ++dicaReqRef.current;
    setDicaLoading(true);
    setDica('');
    setDicaErro('');
    if (dicaTimerRef.current) clearTimeout(dicaTimerRef.current);
    // Timeout de segurança: se não voltar em 30s, libera a UI e oferece retry.
    dicaTimerRef.current = setTimeout(() => {
      if (dicaReqRef.current === reqId) {
        setDicaLoading(false);
        setDicaErro('Demorou demais pra gerar a dica. Toque no ↻ pra tentar de novo.');
      }
    }, 30000);
    callServer<ServerResult>('lumeDica', viewLabel)
      .then((r) => {
        if (dicaReqRef.current !== reqId) return; // resposta obsoleta — ignora
        if (r.ok && r.data) setDica((r.data as { texto: string }).texto || '');
        else setDicaErro(r.error || 'Não consegui gerar a dica agora.');
      })
      .catch(() => {
        if (dicaReqRef.current === reqId) setDicaErro('Sem conexão de IA. Verifique em Configurações.');
      })
      .finally(() => {
        if (dicaReqRef.current !== reqId) return;
        if (dicaTimerRef.current) { clearTimeout(dicaTimerRef.current); dicaTimerRef.current = null; }
        setDicaLoading(false);
      });
  }, [viewLabel]);

  // Limpa o timer ao desmontar pra não vazar timeout.
  useEffect(() => () => { if (dicaTimerRef.current) clearTimeout(dicaTimerRef.current); }, []);

  // Ao abrir com a conversa vazia, a Lume "puxa assunto" com uma dica proativa.
  useEffect(() => {
    if (open && msgs.length === 0 && !dica && !dicaLoading) carregarDica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = (texto?: string) => {
    const conteudo = (texto ?? input).trim();
    if (!conteudo || sending) return;
    const novaHistoria: LumeMsg[] = [...msgs, { role: 'user', content: conteudo }];
    setMsgs(novaHistoria);
    setInput('');
    setSending(true);
    callServer<ServerResult>('lumeChat', novaHistoria.map((m) => ({ role: m.role, content: m.content })), viewLabel)
      .then((res) => {
        if (res.ok && res.data) {
          setMsgs([...novaHistoria, { role: 'assistant', content: (res.data as { texto: string }).texto || '(sem resposta)' }]);
        } else {
          message.error(res.error || 'Erro');
          setMsgs([...novaHistoria, { role: 'assistant', content: `⚠️ ${res.error || 'Não consegui responder. Verifique a conexão de IA em Configurações.'}` }]);
        }
      })
      .catch(() => {
        message.error('Sem conexão (rode no app publicado)');
        setMsgs([...novaHistoria, { role: 'assistant', content: '⚠️ A Lume só responde no app publicado, com o proxy de IA configurado em Configurações.' }]);
      })
      .finally(() => setSending(false));
  };

  const limpar = () => { setMsgs([]); setDica(''); };

  const avatar = (isUser: boolean) => (
    <span style={{
      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: isUser ? `${t.accents.blue}1f` : `${t.accents.peach}1f`,
      color: isUser ? t.accents.blue : t.accents.peach,
    }}>
      {isUser ? <User size={15} strokeWidth={1.8} /> : <Flame size={15} strokeWidth={1.8} />}
    </span>
  );

  const larguraPainel = Math.min(412, typeof window !== 'undefined' ? window.innerWidth - 44 : 412);

  return (
    <>
      {/* ─── Botão flutuante (FAB) ─────────────────────────────────────────── */}
      {!open && (
        <button
          aria-label="Abrir a Lume"
          onClick={() => setOpen(true)}
          className="forja-lume-fab"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 1000,
            width: 56, height: 56, borderRadius: 18, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.18)',
            background: `linear-gradient(135deg, ${t.accents.peach} 0%, ${t.accents.clay} 100%)`,
            color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 10px 30px ${t.accents.clay}66, 0 3px 10px rgba(0,0,0,0.20)`,
            transition: 'transform 0.18s, box-shadow 0.18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.06)'; e.currentTarget.style.boxShadow = `0 16px 40px ${t.accents.clay}77, 0 4px 12px rgba(0,0,0,0.24)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = `0 10px 30px ${t.accents.clay}66, 0 3px 10px rgba(0,0,0,0.20)`; }}
          title="Lume — sua copiloto na forja"
        >
          {/* halo pulsante atrás do ícone */}
          <span style={{
            position: 'absolute', inset: -2, borderRadius: 20, pointerEvents: 'none',
            boxShadow: `0 0 0 2px ${t.accents.peach}33`, animation: 'forjaLumeGlow 2.6s ease-in-out infinite',
          }} />
          <Flame size={25} strokeWidth={1.9} />
        </button>
      )}

      {/* ─── Painel flutuante (glass, premium) ─────────────────────────────── */}
      {open && (
        <div
          className="forja-lume-panel"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 1000,
            width: larguraPainel, height: 'min(680px, 82vh)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: 22,
            background: t.surface,
            border: `1px solid ${t.border}`,
            boxShadow: `0 24px 70px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.16), 0 0 0 1px ${t.accents.peach}1f`,
          }}
        >
          {/* brilho de topo (gradiente sutil) */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 120, pointerEvents: 'none',
            background: `radial-gradient(120% 80% at 100% 0%, ${t.accents.peach}22, transparent 60%)`,
          }} />

          {/* Header */}
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px',
            borderBottom: `1px solid ${t.borderSoft}`,
            background: `linear-gradient(135deg, ${t.accents.peach}14, ${t.accents.clay}0d)`,
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0, position: 'relative',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${t.accents.peach} 0%, ${t.accents.clay} 100%)`, color: '#fff',
              boxShadow: `0 4px 14px ${t.accents.clay}55`,
            }}>
              <Flame size={21} strokeWidth={1.9} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 17.5, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>Lume</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: FONTS.ui, fontSize: 10, fontWeight: 600,
                  color: t.accents.sage, background: `${t.accents.sage}1c`, padding: '1px 7px', borderRadius: 20,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.accents.sage }} /> online
                </span>
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>sua copiloto na forja</div>
            </div>
            {msgs.length > 0 && (
              <Button size="small" type="text" icon={<Eraser size={15} />} onClick={limpar} title="Limpar conversa" />
            )}
            <Button size="small" type="text" icon={<X size={17} />} onClick={() => setOpen(false)} title="Fechar (Esc)" />
          </div>

          {/* Corpo */}
          <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
          {msgs.length === 0 ? (
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 500, color: t.text, marginBottom: 4 }}>
                Oi! Sou a Lume 🔥
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.55, marginBottom: 16 }}>
                Conheço todo o seu app e os seus dados. Pode me perguntar qualquer coisa — do portfólio a uma dúvida de código ou negócio.
              </div>

              {/* Dica proativa */}
              <div style={{
                border: `1px solid ${t.accents.peach}44`, background: `${t.accents.peach}12`,
                borderRadius: 14, padding: '12px 14px', marginBottom: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 700, color: t.accents.clay, letterSpacing: '0.03em' }}>
                    <Lightbulb size={13} /> DICA DA LUME
                  </span>
                  <Button size="small" type="text" icon={<RefreshCw size={13} />} loading={dicaLoading} onClick={carregarDica} title="Nova dica" />
                </div>
                {dicaLoading ? (
                  <Spin size="small" />
                ) : dica ? (
                  <>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, lineHeight: 1.55 }}>
                      {renderRich(dica, t)}
                    </div>
                    <button
                      onClick={() => send(`Sobre a sua dica: "${dica}". Me explica melhor e o que eu faço com isso?`)}
                      style={{
                        marginTop: 8, background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.accents.clay, padding: 0,
                      }}
                    >
                      Explorar essa dica →
                    </button>
                  </>
                ) : dicaErro ? (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.accents.clay, lineHeight: 1.5 }}>
                    {dicaErro}
                  </div>
                ) : (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>
                    Toque no ↻ pra eu olhar seus dados e sugerir algo.
                  </div>
                )}
              </div>

              {/* Sugestões iniciais */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGESTOES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    style={{
                      textAlign: 'left', background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: 12, padding: '10px 13px', cursor: 'pointer',
                      fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${t.accents.peach}66`; e.currentTarget.style.color = t.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    {avatar(isUser)}
                    <div style={{
                      maxWidth: '82%',
                      background: isUser ? t.surfaceMuted : t.surface,
                      border: `1px solid ${t.border}`, borderRadius: 14, padding: '10px 13px',
                      color: t.text, fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.6,
                      boxShadow: t.shadowSoft, wordBreak: 'break-word',
                    }}>
                      {isUser ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span> : renderRich(m.content, t)}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {avatar(false)}
                  <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '10px 14px' }}>
                    <Spin size="small" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

          {/* Input */}
          <div style={{
            position: 'relative', display: 'flex', gap: 8, alignItems: 'flex-end', padding: 11,
            margin: 11, borderRadius: 16,
            border: `1px solid ${t.border}`, background: t.surfaceMuted,
          }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pergunte algo à Lume…  (Enter envia)"
              autoSize={{ minRows: 1, maxRows: 5 }}
              variant="borderless"
              style={{ flex: 1, resize: 'none', fontSize: 13.5, background: 'transparent' }}
            />
            <Button
              type="primary"
              icon={<Send size={15} />}
              onClick={() => send()}
              loading={sending}
              disabled={!input.trim()}
              style={{ height: 34, background: t.accents.peach, borderColor: t.accents.peach }}
            />
          </div>
        </div>
      )}
    </>
  );
}
