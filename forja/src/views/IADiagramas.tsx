import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Empty, Input, Select, App as AntApp, Popconfirm, Tooltip, Collapse } from 'antd';
import { Workflow, Sparkles, Trash2, Save, Flame, Pin, PinOff, Clock, AlertTriangle, Code2, RefreshCw, Info, BookOpen } from 'lucide-react';
import { Panel } from '../components/ui';
import ContextoPicker, { type Contexto } from '../components/ContextoPicker';
import CodexToggle from '../components/CodexToggle';
import ForjaSobreForja from '../components/ForjaSobreForja';
import ModeloBadge from '../components/ModeloBadge';
import MermaidView from '../components/MermaidView';
import ModalExemplosDiagramas from '../components/ModalExemplosDiagramas';
import type { ExemploMermaid } from '../templates/mermaidExemplos';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Ideia, Sistema, ServerResponse, ServerResult } from '../types';

interface Diagrama {
  id?: string;
  titulo: string;
  mermaid: string;
  tipo?: string;
  sistemaId?: string;
  ideiaId?: string;
  data?: string;
  origem?: string;
  referencia?: string;
  modeloUsado?: string;
  parseAviso?: string;
}

const TIPOS = [
  { value: 'flowchart', label: 'Fluxograma' },
  { value: 'sequenceDiagram', label: 'Sequência' },
  { value: 'erDiagram', label: 'Entidades (ER)' },
  { value: 'classDiagram', label: 'Classes' },
  { value: 'mindmap', label: 'Mapa mental' },
];

export default function IADiagramas({ ideias, sistemas }: { ideias: Ideia[]; sistemas: Sistema[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [contexto, setContexto] = useState<Contexto>({ modo: 'texto' });
  const [tipo, setTipo] = useState('flowchart');
  const [usarCodex, setUsarCodex] = useState(true);
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [code, setCode] = useState('');
  const [historico, setHistorico] = useState<Diagrama[]>([]);
  const [elapsed, setElapsed] = useState(0);
  // Guarda modeloUsado da geração atual pra passar ao saveDiagrama (rastreio)
  const [modeloDaGeracao, setModeloDaGeracao] = useState('');
  const [parseAvisoDaGeracao, setParseAvisoDaGeracao] = useState('nao');
  // Tipo usado na ÚLTIMA geração bem-sucedida — alimenta o "botão inteligente":
  // se o user mudar o select pra outro tipo, o CTA muda pra "Gerar como X".
  const [tipoGerado, setTipoGerado] = useState<string | null>(null);
  // Modal da galeria de exemplos (10 templates hardcoded — zero IA)
  const [modalExemplosOpen, setModalExemplosOpen] = useState(false);

  // Carrega um exemplo escolhido no modal direto no editor.
  // Não consome IA — só popula o estado. tipoGerado é setado pra que o botão
  // mostre "Re-gerar" (já que tem code carregado, mas não foi a IA quem fez).
  const aplicarExemplo = (ex: ExemploMermaid) => {
    setTitulo(ex.titulo);
    setCode(ex.mermaid);
    setTipo(ex.tipo);
    setTipoGerado(ex.tipo);
    setModeloDaGeracao('');
    setParseAvisoDaGeracao('nao');
    message.success(`Exemplo "${ex.titulo}" carregado no editor`);
  };
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHist = () => {
    callServer<ServerResponse<Diagrama[]>>('getDiagramas')
      .then(res => { if (res.ok && res.data) setHistorico(res.data as Diagrama[]); })
      .catch(() => { /* ignore */ });
  };
  useEffect(loadHist, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const gerar = () => {
    setLoading(true);
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);

    callServer<ServerResponse<Diagrama>>('gerarDiagrama', { ...contexto, tipo, usarCodex })
      .then(res => {
        if (res.ok && res.data) {
          const d = res.data;
          setTitulo(d.titulo || 'Diagrama');
          setCode(d.mermaid || '');
          setModeloDaGeracao(d.modeloUsado || '');
          setParseAvisoDaGeracao(d.parseAviso || 'nao');
          setTipoGerado(tipo); // marca: foi este tipo que produziu o code atual
          if (d.parseAviso === 'sim') {
            message.warning('Mermaid não veio formatado — pode precisar de ajuste manual.', 5);
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

  const salvar = () => {
    if (!code.trim()) { message.warning('Nada para salvar'); return; }
    callServer<ServerResponse<Diagrama>>('saveDiagrama', {
      titulo: titulo || 'Diagrama',
      mermaid: code,
      tipo,
      sistemaId: contexto.sistemaId || '',
      ideiaId: contexto.ideiaId || '',
      modeloUsado: modeloDaGeracao,
      parseAviso: parseAvisoDaGeracao,
    })
      .then(res => { if (res.ok) { message.success('Diagrama salvo'); loadHist(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Salvar só funciona no app publicado'));
  };

  const remover = (id?: string) => {
    if (!id) return;
    callServer<ServerResponse<unknown>>('deleteDiagrama', id)
      .then(res => { if (res.ok) { setHistorico(h => h.filter(d => d.id !== id)); message.success('Removido'); } });
  };

  const alternarRef = (id?: string) => {
    if (!id) return;
    callServer<ServerResult>('alternarReferencia', 'diagrama', id)
      .then((r) => {
        if (r.ok) {
          loadHist();
          const novo = (r.data as { referencia?: string })?.referencia;
          message.success(novo === 'sim' ? 'Marcado como referência' : 'Desmarcado');
        }
      });
  };

  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => {
      const aRef = a.referencia === 'sim' ? 1 : 0;
      const bRef = b.referencia === 'sim' ? 1 : 0;
      if (aRef !== bRef) return bRef - aRef;
      return 0;
    });
  }, [historico]);

  return (
    <div>
      <ForjaSobreForja
        tipo="diagrama"
        onGerou={(r) => {
          if (r && (r as Diagrama).mermaid) {
            const d = r as Diagrama;
            setTitulo(d.titulo || 'Forja sobre Forja');
            setCode(d.mermaid);
            if (d.tipo) { setTipo(d.tipo); setTipoGerado(d.tipo); }
          }
        }}
        onReloadHistorico={loadHist}
      />

      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Workflow size={18} strokeWidth={1.6} color={t.accents.sage} /> Estúdio de diagramas</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>Descreva, a IA desenha em Mermaid e você edita o código com pré-visualização ao vivo.</p>
        <ContextoPicker value={contexto} onChange={setContexto} ideias={ideias} sistemas={sistemas} placeholder="Ex.: Fluxo de onboarding: usuário se cadastra, confirma e-mail, escolhe plano e acessa o painel." />
        {(() => {
          // ─── Validação de contexto ──────────────────────────────────────
          // O servidor rejeita se não houver conteúdo. Validamos no cliente
          // pra desabilitar o botão e explicar EXATAMENTE o que falta —
          // evita o popup genérico "Descreva o que deseja diagramar".
          const temContexto =
            (contexto.modo === 'texto' && !!(contexto.texto || '').trim()) ||
            (contexto.modo === 'ideia' && !!contexto.ideiaId) ||
            (contexto.modo === 'sistema' && !!contexto.sistemaId);
          const motivoBloqueio = !temContexto ? (
            contexto.modo === 'texto' ? 'Escreva uma descrição acima antes de gerar.' :
            contexto.modo === 'ideia' ? 'Selecione uma ideia acima antes de gerar.' :
            'Selecione um sistema acima antes de gerar.'
          ) : '';

          // ─── Botão inteligente ──────────────────────────────────────────
          const tipoLabel = TIPOS.find(x => x.value === tipo)?.label || tipo;
          const semCode = !code;
          const tipoMudou = !semCode && tipoGerado !== null && tipoGerado !== tipo;
          const mesmoTipo = !semCode && tipoGerado === tipo;
          const botaoLabel = semCode
            ? 'Gerar diagrama'
            : tipoMudou
            ? `Gerar como ${tipoLabel}`
            : 'Re-gerar';
          const botaoIcon = mesmoTipo ? <RefreshCw size={16} /> : <Sparkles size={16} />;
          const botaoDisabled = !temContexto || loading;

          return (
            <>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Select value={tipo} onChange={setTipo} options={TIPOS} style={{ minWidth: 180 }} />
                <Tooltip title={
                  motivoBloqueio ? motivoBloqueio :
                  semCode ? 'Cria a primeira visão do conteúdo descrito acima.' :
                  tipoMudou ? `Gera uma nova visão do mesmo conteúdo no formato ${tipoLabel}. A vista anterior continua disponível em "Diagramas salvos" se você salvou.` :
                  'Refaz o mesmo tipo (útil se a IA não acertou no primeiro tiro).'
                }>
                  <Button
                    type="primary"
                    icon={botaoIcon}
                    loading={loading}
                    disabled={botaoDisabled}
                    onClick={gerar}
                    style={tipoMudou && !botaoDisabled ? {
                      boxShadow: `0 0 0 2px ${t.accents.sage}22`,
                    } : undefined}
                  >
                    {botaoLabel}
                  </Button>
                </Tooltip>
                <Tooltip title="10 templates prontos pra carregar no editor — zero IA. Bom pra quem ainda não conhece cada tipo de diagrama.">
                  <Button
                    icon={<BookOpen size={14} />}
                    onClick={() => setModalExemplosOpen(true)}
                    style={{
                      borderColor: `${t.accents.sage}55`,
                      color: t.accents.sage,
                    }}
                  >
                    Ver exemplos
                  </Button>
                </Tooltip>
                <CodexToggle value={usarCodex} onChange={setUsarCodex} />
                <ModeloBadge uso="diagrama" size="small" />
                {loading && (
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 11,
                    color: elapsed >= 60 ? t.accents.peach : t.textTertiary,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Clock size={12} />
                    {elapsed}s
                    {elapsed >= 60 && <span style={{ fontWeight: 600 }}>· demorando…</span>}
                  </span>
                )}
              </div>

              {/* Hint contextual abaixo da toolbar — prioridade:
                  1) falta contexto (peach, atenção)
                  2) trocou de tipo (sage, ação sugerida)
                  3) info geral pós-geração (cinza, neutro) */}
              {!loading && motivoBloqueio && (
                <div style={{
                  marginTop: 10,
                  padding: '6px 10px',
                  background: `${t.accents.peach}10`,
                  borderRadius: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, color: t.text,
                  border: `1px solid ${t.accents.peach}44`,
                }}>
                  <AlertTriangle size={12} color={t.accents.peach} />
                  {motivoBloqueio}
                </div>
              )}
              {!loading && !motivoBloqueio && !semCode && (
                <div style={{
                  marginTop: 10,
                  padding: '6px 10px',
                  background: tipoMudou ? `${t.accents.sage}10` : t.surfaceMuted,
                  borderRadius: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, color: tipoMudou ? t.text : t.textTertiary,
                  border: tipoMudou ? `1px solid ${t.accents.sage}33` : `1px dashed ${t.borderSoft}`,
                }}>
                  <Info size={12} color={tipoMudou ? t.accents.sage : t.textTertiary} />
                  {tipoMudou ? (
                    <>Você trocou pra <strong>{tipoLabel}</strong>. Clique <strong>Gerar como {tipoLabel}</strong> pra criar essa nova visão. Antes, salve a atual se quiser preservar.</>
                  ) : (
                    <>Pra ver outra visão do mesmo conteúdo, escolha outro tipo no select e clique <strong>Gerar como X</strong> — cada tipo é uma chamada de IA separada.</>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </Panel>

      {(code || loading) && (
        <div style={{ marginTop: 18 }}>
          {/* PRÉVIA grande no topo — vibe Miro. O código vai colapsável abaixo
              porque depois de gerado, raramente o user mexe; o que importa é VER. */}
          <Panel
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Workflow size={16} strokeWidth={1.6} color={t.accents.sage} />
                {titulo || 'Pré-visualização'}
              </span>
            }
            extra={
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Input
                  size="small"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título do diagrama"
                  style={{ width: 220 }}
                />
                <Button size="small" type="primary" icon={<Save size={14} />} onClick={salvar} disabled={!code.trim()}>Salvar</Button>
              </div>
            }
          >
            {loading ? (
              <div style={{
                minHeight: 380, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                background: t.surfaceMuted, borderRadius: 12,
              }}>
                <Sparkles size={28} color={t.accents.peach} strokeWidth={1.5} style={{ animation: 'brasaBreath 1.6s ease-in-out infinite' }} />
                <div style={{ color: t.textSecondary, fontSize: 14 }}>Desenhando seu diagrama…</div>
              </div>
            ) : (
              <MermaidView
                code={code}
                minHeight={460}
                onCodigoLimpo={(limpo) => {
                  setCode(limpo);
                  message.success('Código atualizado com a versão limpa.');
                }}
              />
            )}
          </Panel>

          {/* Código Mermaid — colapsável, fechado por default. Quem quiser
              ajustar abre; quem só quer ver o desenho, ignora. */}
          {!loading && code && (
            <div style={{ marginTop: 12 }}>
              <Collapse
                size="small"
                ghost
                items={[{
                  key: 'code',
                  label: (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontFamily: FONTS.ui, fontSize: 13, fontWeight: 500,
                      color: t.textSecondary,
                    }}>
                      <Code2 size={14} strokeWidth={1.6} />
                      Código Mermaid (clique pra editar)
                      <span style={{
                        fontFamily: FONTS.mono, fontSize: 10.5,
                        color: t.textTertiary, marginLeft: 4,
                      }}>
                        {code.split('\n').length} linhas
                      </span>
                    </span>
                  ),
                  children: (
                    <Input.TextArea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      autoSize={{ minRows: 8, maxRows: 26 }}
                      style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}
                      placeholder="O código Mermaid aparece aqui após gerar — edite à vontade."
                    />
                  ),
                }]}
              />
            </div>
          )}
        </div>
      )}

      {historico.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Panel title="Diagramas salvos" padding={8}>
            {historicoOrdenado.map((d) => {
              const ehSelf = d.origem === 'forja-self';
              const ehRef = d.referencia === 'sim';
              return (
                <div
                  key={d.id}
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
                    <Workflow size={16} color={t.textTertiary} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: t.text, fontWeight: 500, fontSize: 14 }}>{d.titulo}</span>
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
                      {d.parseAviso === 'sim' && (
                        <Tooltip title="A IA não devolveu Mermaid puro — pode precisar de ajuste.">
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
                      {d.data && <span style={{ color: t.textTertiary, fontSize: 12 }}>{new Date(d.data).toLocaleString('pt-BR')}</span>}
                      {d.modeloUsado && <ModeloBadge stampedModelo={d.modeloUsado} size="small" />}
                    </div>
                  </div>
                  <Tooltip title={ehRef ? 'Remover dos fixados' : 'Fixar como referência'}>
                    <Button
                      size="small"
                      type="text"
                      icon={ehRef ? <PinOff size={14} /> : <Pin size={14} />}
                      onClick={() => alternarRef(d.id)}
                      style={{ color: ehRef ? t.accents.peach : t.textTertiary }}
                    />
                  </Tooltip>
                  <Button size="small" onClick={() => {
                    setTitulo(d.titulo);
                    setCode(d.mermaid);
                    if (d.tipo) { setTipo(d.tipo); setTipoGerado(d.tipo); }
                  }}>Abrir</Button>
                  <Popconfirm title="Remover diagrama?" onConfirm={() => remover(d.id)} okText="Remover" cancelText="Cancelar">
                    <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                  </Popconfirm>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

      {!loading && !code && historico.length === 0 && (
        <div style={{
          marginTop: 40,
          padding: '32px 24px',
          background: t.surfaceMuted,
          borderRadius: 16,
          border: `1px dashed ${t.borderSoft}`,
          textAlign: 'center',
        }}>
          <Workflow size={36} color={t.textTertiary} strokeWidth={1.3} style={{ marginBottom: 12 }} />
          <div style={{
            fontFamily: FONTS.display, fontSize: 16, color: t.text,
            fontWeight: 500, marginBottom: 6,
          }}>
            Nada gerado ainda
          </div>
          <div style={{
            fontSize: 13.5, color: t.textSecondary, marginBottom: 18,
            maxWidth: 480, marginInline: 'auto', lineHeight: 1.55,
          }}>
            Descreva acima e clique <strong>Gerar diagrama</strong>, ou comece por um
            exemplo pronto pra entender cada tipo de Mermaid antes de gastar IA.
          </div>
          <Button
            type="primary"
            icon={<BookOpen size={15} />}
            onClick={() => setModalExemplosOpen(true)}
            size="large"
            style={{
              background: t.accents.sage,
              borderColor: t.accents.sage,
            }}
          >
            Ver galeria de exemplos (10 templates)
          </Button>
        </div>
      )}

      <ModalExemplosDiagramas
        open={modalExemplosOpen}
        onClose={() => setModalExemplosOpen(false)}
        onEscolher={aplicarExemplo}
      />
    </div>
  );
}
