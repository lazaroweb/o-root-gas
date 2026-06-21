import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { T, FONTS } from './theme';
import callServer from './gas-client';
import type { FormPublico, BlocoForm, PerguntaForm, SubmitPayload, SubmitResult } from './types';

declare const window: Window & { __FORM_TOKEN__?: string };

const FERRAMENTAS_COMUNS = [
  'WhatsApp', 'Planilhas / Excel', 'Google Agenda', 'Instagram',
  'E-mail', 'Caderno / papel', 'Sistema próprio', 'ERP', 'Trello / Notion',
];

type Screen =
  | { kind: 'intro' }
  | { kind: 'pergunta'; bloco: string; pergunta: PerguntaForm }
  | { kind: 'ferramentas' }
  | { kind: 'amostra' }
  | { kind: 'contato' }
  | { kind: 'done' };

function emailOk(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

// Detecta opções "Outro / Outros / Outra" (com ou sem dois pontos / texto extra)
function isOutroOpcao(o: string): boolean {
  return /^outr[oa]s?\b/i.test((o || '').trim());
}
// Tudo que já é "Outro: …" digitado pelo cliente
function isOutroValor(v: string): boolean {
  return /^outr[oa]s?\b/i.test((v || '').trim());
}

// ─── Componentes de UI ──────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }): React.ReactElement {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: T.bgSoft, zIndex: 10 }}>
      <div style={{
        height: '100%', width: `${Math.max(4, Math.min(100, pct))}%`,
        background: `linear-gradient(90deg, ${T.peach}, ${T.ember})`,
        borderRadius: '0 4px 4px 0', transition: 'width 0.45s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  );
}

function OptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
        border: `1.5px solid ${selected ? T.peach : T.border}`,
        background: selected ? T.peachSoft : T.surface,
        color: T.text, fontSize: 16, fontFamily: FONTS.body,
        boxShadow: selected ? `0 6px 20px -8px ${T.peach}88` : '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'all 0.18s ease', transform: selected ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget.style.borderColor = T.borderStrong); }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget.style.borderColor = T.border); }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? T.peach : T.borderStrong}`,
        background: selected ? T.peach : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </span>
      <span>{label}</span>
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 30px', borderRadius: 999, border: 'none',
        background: disabled ? T.borderStrong : `linear-gradient(135deg, ${T.peach}, ${T.ember})`,
        color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: FONTS.body,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : `0 10px 24px -10px ${T.ember}`,
        transition: 'transform 0.12s ease, box-shadow 0.18s ease', opacity: disabled ? 0.7 : 1,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      {children}
    </button>
  );
}

// Marca da Forja — Opção B (wordmark editorial). Sem mark/ícone: a tipografia
// É o herói. Um filete dourado em gradiente separa o wordmark do slogan,
// trazendo a hierarquia de uma masthead de revista (NYT, MIT Tech Review).
// Aplicado consistentemente em todas as superfícies (public + app principal).
function Brand({ compact }: { compact?: boolean }): React.ReactElement {
  const wordSize = compact ? 18 : 28;
  const wordSpacing = compact ? '0.07em' : '0.08em';
  const fileteWidth = compact ? 48 : 68;
  const sloganSize = compact ? 8 : 9.5;
  const sloganSpacing = compact ? '0.28em' : '0.32em';
  // Gaps internos: respiro consistente entre wordmark → filete → assinatura.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{
        fontFamily: FONTS.display,
        fontWeight: 600,
        fontSize: wordSize,
        color: T.text,
        letterSpacing: wordSpacing,
        lineHeight: 1,
      }}>
        FORJA
      </div>
      <div
        aria-hidden
        style={{
          height: 1.5,
          width: fileteWidth,
          background: `linear-gradient(90deg, ${T.ember}, ${T.peach} 70%, transparent)`,
          borderRadius: 1,
          marginTop: compact ? 7 : 11,
        }}
      />
      <div style={{
        fontSize: sloganSize,
        letterSpacing: sloganSpacing,
        textTransform: 'uppercase',
        color: T.textTertiary,
        fontWeight: 600,
        lineHeight: 1,
        marginTop: compact ? 7 : 10,
      }}>
        Inteligência de Negócios
      </div>
    </div>
  );
}

function ScreenShell({ children, kicker, titulo, sub }: { children?: React.ReactNode; kicker?: string; titulo: string; sub?: string }): React.ReactElement {
  return (
    <div key={titulo} style={{ animation: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
      {kicker && (
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.peach, marginBottom: 18 }}>{kicker}</div>
      )}
      <h1 style={{ fontFamily: FONTS.display, fontSize: 'clamp(24px, 4.5vw, 34px)', fontWeight: 600, color: T.text, lineHeight: 1.28, margin: 0 }}>{titulo}</h1>
      {sub && <p style={{ color: T.textSecondary, fontSize: 16, lineHeight: 1.65, marginTop: 16, marginBottom: 0 }}>{sub}</p>}
      {children && <div style={{ marginTop: 36 }}>{children}</div>}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const token = (window.__FORM_TOKEN__ || '').trim();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormPublico | null>(null);
  const [idx, setIdx] = useState(0);

  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [ferramentas, setFerramentas] = useState<string[]>([]);
  const [outraFerr, setOutraFerr] = useState('');
  const [querAmostra, setQuerAmostra] = useState<boolean | null>(null);
  const [agendaPref, setAgendaPref] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); setForm({ ok: false, error: 'Link inválido.' }); return; }
    callServer<FormPublico>('getFormPublico', token)
      .then((res) => {
        setForm(res);
        // Pré-preenche nome do contato (se cadastrado) pra evitar redigitação.
        if (res && res.ok && res.primeiroNome) setNome((cur) => cur || res.primeiroNome || '');
      })
      .catch(() => setForm({ ok: false, error: 'Não foi possível carregar.' }))
      .finally(() => setLoading(false));
  }, [token]);

  const screens = useMemo<Screen[]>(() => {
    if (!form || !form.ok) return [];
    const out: Screen[] = [{ kind: 'intro' }];
    (form.blocos || []).forEach((b: BlocoForm) => {
      (b.perguntas || []).forEach((p) => out.push({ kind: 'pergunta', bloco: b.tema, pergunta: p }));
    });
    out.push({ kind: 'ferramentas' }, { kind: 'amostra' }, { kind: 'contato' }, { kind: 'done' });
    return out;
  }, [form]);

  const totalPassos = Math.max(1, screens.length - 2); // exclui intro e done
  const cur = screens[idx];

  const next = useCallback(() => { setErro(''); setIdx((i) => Math.min(screens.length - 1, i + 1)); }, [screens.length]);
  const back = useCallback(() => { setErro(''); setIdx((i) => Math.max(0, i - 1)); }, []);

  const recomecar = useCallback(() => {
    setRespostas({}); setFerramentas([]); setOutraFerr(''); setQuerAmostra(null);
    setAgendaPref(''); setNome(''); setEmail(''); setDoneMsg(''); setErro(''); setIdx(0);
  }, []);

  const setResp = (qid: string, value: unknown) => setRespostas((r) => ({ ...r, [qid]: value }));

  const enviar = useCallback(async () => {
    setSubmitting(true); setErro('');
    const payload: SubmitPayload = {
      token, nome: nome.trim(), email: email.trim().toLowerCase(),
      respostas, ferramentas, querAmostra: querAmostra === true, agendaPref: agendaPref.trim(),
    };
    try {
      const res = await callServer<SubmitResult>('submitRespostaPublica', payload);
      if (res.ok) { setDoneMsg(res.mensagem || 'Recebido! Obrigado.'); next(); }
      else setErro(res.error || 'Não foi possível enviar.');
    } catch { setErro('Falha de conexão. Tente novamente.'); }
    finally { setSubmitting(false); }
  }, [token, nome, email, respostas, ferramentas, querAmostra, agendaPref, next]);

  // ─── Estados de carregamento / erro ─────────────────────────────────────────
  if (loading) {
    return <Centro><div style={{ color: T.textTertiary, fontFamily: FONTS.body }}>Carregando…</div></Centro>;
  }
  if (!form || !form.ok) {
    return (
      <Centro>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontFamily: FONTS.display, color: T.text }}>Link indisponível</h2>
          <p style={{ color: T.textSecondary }}>{(form && form.error) || 'Este formulário não está disponível.'}</p>
        </div>
      </Centro>
    );
  }

  const pct = cur.kind === 'intro' ? 0 : cur.kind === 'done' ? 100 : Math.round((idx / totalPassos) * 100);

  const cliente = form.cliente || '';

  return (
    <>
      <ProgressBar pct={pct} />
      {/* Brand fixa só aparece fora da intro — na intro a marca é elemento de hero */}
      {cur.kind !== 'intro' && (
        <div style={{ position: 'fixed', top: 22, left: 26, zIndex: 9 }}><Brand compact /></div>
      )}
      <Centro>
        <div style={{ width: '100%', maxWidth: 620, padding: '0 4px' }}>
          {cur.kind !== 'intro' && cur.kind !== 'done' && (
            <button onClick={back} style={{ background: 'none', border: 'none', color: T.textTertiary, cursor: 'pointer', fontSize: 14, marginBottom: 28, padding: 0, fontFamily: FONTS.body }}>← voltar</button>
          )}

          {cur.kind === 'intro' && (
            <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1)' }}>
              {/* Brand como hero — generoso */}
              <div style={{ marginBottom: 56 }}><Brand /></div>

              {/* Kicker discreto */}
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.peach, marginBottom: 24 }}>
                Discovery · por convite
              </div>

              {/* Saudação (quando há nome) — leve, fora do peso do título */}
              {form.primeiroNome && (
                <div style={{
                  fontFamily: FONTS.display,
                  fontSize: 'clamp(19px, 2.6vw, 23px)',
                  fontWeight: 400,
                  color: T.textSecondary,
                  marginBottom: 18,
                  lineHeight: 1.3,
                }}>
                  Olá, <span style={{ color: T.text, fontWeight: 600 }}>{form.primeiroNome}</span> <span aria-hidden style={{ display: 'inline-block', transform: 'translateY(-2px)' }}>👋</span>
                </div>
              )}

              {/* Título — peso premium */}
              <h1 style={{
                fontFamily: FONTS.display,
                fontSize: 'clamp(30px, 5.6vw, 46px)',
                fontWeight: 600,
                color: T.text,
                lineHeight: 1.12,
                margin: 0,
                letterSpacing: '-0.015em',
              }}>
                Vamos desenhar {form.primeiroNome ? 'juntos ' : ''}o sistema ideal {cliente ? <>da <span style={{ color: T.ember }}>{cliente}</span></> : 'do seu negócio'}.
              </h1>

              {/* Subtítulo — descreve a experiência, não repete o título */}
              <p style={{
                color: T.textSecondary,
                fontSize: 17.5,
                lineHeight: 1.7,
                marginTop: 28,
                marginBottom: 0,
                maxWidth: 540,
              }}>
                {form.intro}
              </p>

              {/* CTA */}
              <div style={{ marginTop: 48 }}>
                <PrimaryBtn onClick={next}>Começar →</PrimaryBtn>
              </div>

              {/* Microcopy com separadores de bolinha — premium e leve */}
              <div style={{
                color: T.textTertiary,
                fontSize: 13,
                marginTop: 28,
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <span>~3 min</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.borderStrong }} />
                <span>a maioria é só clicar</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.borderStrong }} />
                <span>respostas confidenciais</span>
              </div>
            </div>
          )}

          {cur.kind === 'pergunta' && (
            <PerguntaView
              key={cur.pergunta.id}
              bloco={cur.bloco}
              pergunta={cur.pergunta}
              valor={respostas[cur.pergunta.id]}
              onChange={(v) => setResp(cur.pergunta.id, v)}
              onAuto={next}
              onNext={next}
              erro={erro}
              setErro={setErro}
            />
          )}

          {cur.kind === 'ferramentas' && (
            <ScreenShell kicker="Sua rotina" titulo="Quais ferramentas você usa hoje?" sub="Marque tudo que faz parte do seu dia a dia.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[...FERRAMENTAS_COMUNS, ...ferramentas.filter((f) => FERRAMENTAS_COMUNS.indexOf(f) < 0)].map((f) => {
                  const sel = ferramentas.indexOf(f) >= 0;
                  return (
                    <button key={f} onClick={() => setFerramentas((arr) => sel ? arr.filter((x) => x !== f) : [...arr, f])}
                      style={{
                        padding: '10px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 15, fontFamily: FONTS.body,
                        border: `1.5px solid ${sel ? T.peach : T.border}`, background: sel ? T.peachSoft : T.surface, color: T.text,
                        transition: 'all 0.16s ease',
                      }}>
                      {sel ? '✓ ' : '+ '}{f}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <input value={outraFerr} onChange={(e) => setOutraFerr(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && outraFerr.trim()) { setFerramentas((a) => [...a, outraFerr.trim()]); setOutraFerr(''); } }}
                  placeholder="Outra ferramenta…" style={inputStyle} />
                <button onClick={() => { if (outraFerr.trim()) { setFerramentas((a) => [...a, outraFerr.trim()]); setOutraFerr(''); } }}
                  style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: T.peach, fontWeight: 600 }}>Add</button>
              </div>
              <div style={{ marginTop: 34 }}><PrimaryBtn onClick={next}>Continuar →</PrimaryBtn></div>
            </ScreenShell>
          )}

          {cur.kind === 'amostra' && (
            <ScreenShell kicker="Quase lá" titulo="Quer ver uma amostra do que dá pra construir?" sub="Sem compromisso — só pra você sentir na prática.">
              <div style={{ display: 'grid', gap: 14 }}>
                <OptionCard label="Sim, quero ver uma amostra" selected={querAmostra === true} onClick={() => setQuerAmostra(true)} />
                <OptionCard label="Agora não, obrigado" selected={querAmostra === false} onClick={() => { setQuerAmostra(false); setAgendaPref(''); }} />
              </div>
              {querAmostra === true && (
                <div style={{ marginTop: 18, animation: 'fadeUp 0.35s ease' }}>
                  <label style={labelStyle}>Qual o melhor dia e horário pra você?</label>
                  <input value={agendaPref} onChange={(e) => setAgendaPref(e.target.value)} placeholder="Ex.: terça de manhã, ou qualquer tarde" style={inputStyle} />
                </div>
              )}
              <div style={{ marginTop: 34 }}><PrimaryBtn onClick={next} disabled={querAmostra === null}>Continuar →</PrimaryBtn></div>
            </ScreenShell>
          )}

          {cur.kind === 'contato' && (
            <ScreenShell kicker="Pra finalizar" titulo="Como podemos te chamar?" sub="Deixe seu contato pra gente trazer um retorno certeiro.">
              <label style={labelStyle}>Seu nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" style={inputStyle} />
              <label style={{ ...labelStyle, marginTop: 16 }}>Seu melhor e-mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@example.com" style={inputStyle} type="email" />
              {erro && <div style={{ color: T.rose, fontSize: 14, marginTop: 12 }}>{erro}</div>}
              <div style={{ marginTop: 34 }}>
                <PrimaryBtn
                  onClick={() => {
                    if (!nome.trim()) { setErro('Conte seu nome 🙂'); return; }
                    if (!emailOk(email)) { setErro('Confira seu e-mail.'); return; }
                    enviar();
                  }}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando…' : 'Enviar respostas'}
                </PrimaryBtn>
              </div>
            </ScreenShell>
          )}

          {cur.kind === 'done' && (
            <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
              <h1 style={{ fontFamily: FONTS.display, fontSize: 30, color: T.text, margin: 0 }}>{doneMsg || 'Recebido!'}</h1>
              <p style={{ color: T.textSecondary, fontSize: 16, marginTop: 12, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                Suas respostas chegaram à Forja. Em breve voltamos com um retorno certeiro{querAmostra ? ' e a sua amostra' : ''}.
              </p>
              <div style={{ marginTop: 26, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={recomecar} style={{
                  padding: '12px 24px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.surface,
                  color: T.textSecondary, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.body,
                }}>Enviar outra resposta</button>
              </div>
              <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', opacity: 0.8 }}><Brand compact /></div>
            </div>
          )}
        </div>
      </Centro>
      <div style={{ position: 'fixed', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: T.textTertiary, letterSpacing: '0.04em', pointerEvents: 'none' }}>
        Forja · Inteligência de Negócios
      </div>
    </>
  );
}

// ─── Tela de pergunta (renderiza por tipo) ──────────────────────────────────

function PerguntaView({ bloco, pergunta, valor, onChange, onAuto, onNext, erro, setErro }: {
  bloco: string; pergunta: PerguntaForm; valor: unknown;
  onChange: (v: unknown) => void; onAuto: () => void; onNext: () => void;
  erro: string; setErro: (s: string) => void;
}): React.ReactElement {
  const tipo = pergunta.tipo;
  const auto = (v: unknown) => { onChange(v); setTimeout(onAuto, 260); };
  const exigeTexto = tipo === 'texto' || tipo === 'texto_longo';
  const multipla = tipo === 'multipla';
  const arrVal = Array.isArray(valor) ? (valor as string[]) : [];

  const tentarNext = () => {
    if (pergunta.obrigatorio) {
      const vazio = valor === undefined || valor === null || String(valor).trim() === '' || (Array.isArray(valor) && valor.length === 0);
      if (vazio) { setErro('Essa é importante pra gente 🙂'); return; }
    }
    onNext();
  };

  return (
    <ScreenShell kicker={bloco} titulo={pergunta.texto} sub={pergunta.ajuda}>
      {(tipo === 'sim_nao') && (
        <div style={{ display: 'grid', gap: 14 }}>
          {['Sim', 'Não', 'Mais ou menos'].map((o) => <OptionCard key={o} label={o} selected={valor === o} onClick={() => auto(o)} />)}
        </div>
      )}

      {(tipo === 'escala') && (
        <div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => auto(n)}
                style={{
                  flex: 1, padding: '18px 0', borderRadius: 14, cursor: 'pointer', fontSize: 20, fontWeight: 700, fontFamily: FONTS.display,
                  border: `1.5px solid ${valor === n ? T.peach : T.border}`, background: valor === n ? T.peachSoft : T.surface, color: valor === n ? T.ember : T.textSecondary,
                  transition: 'all 0.16s ease',
                }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textTertiary, fontSize: 12.5, marginTop: 8 }}>
            <span>nada</span><span>muito</span>
          </div>
        </div>
      )}

      {(tipo === 'unica') && (() => {
        const valStr = typeof valor === 'string' ? valor : '';
        const escolheuOutro = isOutroValor(valStr);
        const textoOutro = escolheuOutro ? valStr.replace(/^outr[oa]s?\s*:?\s*/i, '') : '';
        return (
          <div style={{ display: 'grid', gap: 14 }}>
            {(pergunta.opcoes || []).map((o) => {
              if (isOutroOpcao(o)) {
                return (
                  <OptionCard
                    key={o}
                    label={o.replace(/:?\s*$/, '')}
                    selected={escolheuOutro}
                    onClick={() => { if (!escolheuOutro) onChange('Outro: '); else onChange(''); }}
                  />
                );
              }
              return <OptionCard key={o} label={o} selected={valor === o} onClick={() => auto(o)} />;
            })}
            {escolheuOutro && (
              <input
                value={textoOutro}
                onChange={(e) => onChange('Outro: ' + e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') tentarNext(); }}
                placeholder="Conte qual…"
                style={{ ...inputStyle, marginTop: 4 }}
                autoFocus
              />
            )}
          </div>
        );
      })()}

      {multipla && (() => {
        const idxOutro = arrVal.findIndex(isOutroValor);
        const temOutro = idxOutro >= 0;
        const textoOutro = temOutro ? arrVal[idxOutro].replace(/^outr[oa]s?\s*:?\s*/i, '') : '';
        const setOutro = (txt: string) => {
          const base = arrVal.filter((x) => !isOutroValor(x));
          onChange(txt.trim() ? [...base, 'Outro: ' + txt] : [...base, 'Outro: ']);
        };
        return (
          <div style={{ display: 'grid', gap: 14 }}>
            {(pergunta.opcoes || []).map((o) => {
              if (isOutroOpcao(o)) {
                return (
                  <OptionCard
                    key={o}
                    label={o.replace(/:?\s*$/, '')}
                    selected={temOutro}
                    onClick={() => {
                      if (temOutro) onChange(arrVal.filter((x) => !isOutroValor(x)));
                      else onChange([...arrVal, 'Outro: ']);
                    }}
                  />
                );
              }
              const sel = arrVal.indexOf(o) >= 0;
              return <OptionCard key={o} label={o} selected={sel} onClick={() => onChange(sel ? arrVal.filter((x) => x !== o) : [...arrVal, o])} />;
            })}
            {temOutro && (
              <input
                value={textoOutro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Quais? (separe por vírgula se for mais de um)"
                style={{ ...inputStyle, marginTop: 4 }}
                autoFocus
              />
            )}
          </div>
        );
      })()}

      {exigeTexto && (
        tipo === 'texto_longo'
          ? <textarea value={String(valor || '')} onChange={(e) => onChange(e.target.value)} placeholder="Pode escrever à vontade…" rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} autoFocus />
          : <input value={String(valor || '')} onChange={(e) => onChange(e.target.value)} placeholder="Digite aqui…"
              onKeyDown={(e) => { if (e.key === 'Enter') tentarNext(); }} style={inputStyle} autoFocus />
      )}

      {erro && <div style={{ color: T.rose, fontSize: 14, marginTop: 14 }}>{erro}</div>}

      {(multipla || exigeTexto || (tipo === 'unica' && isOutroValor(String(valor || ''))) || !['sim_nao', 'escala', 'unica'].includes(tipo)) && (
        <div style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'center' }}>
          <PrimaryBtn onClick={tentarNext}>Próximo →</PrimaryBtn>
          {!pergunta.obrigatorio && <button onClick={onNext} style={{ background: 'none', border: 'none', color: T.textTertiary, cursor: 'pointer', fontSize: 14 }}>pular</button>}
        </div>
      )}
    </ScreenShell>
  );
}

function Centro({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', position: 'relative', overflow: 'hidden' }}>
      <div className="aura aura-1" /><div className="aura aura-2" />
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${T.border}`,
  background: T.surface, color: T.text, fontSize: 16, fontFamily: FONTS.body, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13.5, fontWeight: 600, color: T.textSecondary, marginBottom: 8,
};

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
