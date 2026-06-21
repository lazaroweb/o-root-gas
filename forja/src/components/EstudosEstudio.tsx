import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import {
  App as AntApp, Button, Input, Segmented, Tooltip, Empty, Form, Modal, Select,
} from 'antd';
import {
  Clapperboard, PlayCircle, Star, ExternalLink, ListVideo, NotebookPen, Save, X, Check, BookmarkPlus,
  FolderOpen, ArrowRight, Link2, Zap,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { VideoParaTocar } from '../views/Estudos';
import { extrairVideoId } from './EstudosPlayer';
import { ThumbImg } from './EstudosYoutube';

interface EstudosEstudioProps {
  video: VideoParaTocar | null;
  fila: VideoParaTocar[];
  filaTitulo: string;
  playSeq: number;
  recentes: VideoParaTocar[];
  onTrocarVideo: (v: VideoParaTocar) => void;
  onTocarRecente: (v: VideoParaTocar) => void;
  onLimparHistorico: () => void;
  onSalvou: () => void;
  onIrPastas?: () => void;
}

// Persiste entre remontagens (troca de sub-aba): qual "selo" de seleção já tocou.
// Só damos autoplay quando o selo é novo (seleção deliberada), não ao voltar à aba.
let ultimaSeqComAutoplay = -1;

type PainelTab = 'notas' | 'fila';

const TIPO_OPCOES = [
  { value: 'conceito', label: 'Conceito' },
  { value: 'banco-dados', label: 'Banco de dados' },
  { value: 'ide', label: 'IDE / Editor' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'linguagem', label: 'Linguagem / Framework' },
  { value: 'ia', label: 'IA' },
  { value: 'outro', label: 'Outro' },
];
const STATUS_OPCOES = [
  { value: 'a-rever', label: 'A rever' },
  { value: 'aprofundando', label: 'Aprofundando' },
  { value: 'dominado', label: 'Dominado' },
];
const PRIORIDADE_OPCOES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

export default function EstudosEstudio({ video, fila, filaTitulo, playSeq, recentes, onTrocarVideo, onTocarRecente, onLimparHistorico, onSalvou, onIrPastas }: EstudosEstudioProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [link, setLink] = useState('');
  const linkRef = useRef<InputRef>(null);
  const [painel, setPainel] = useState<PainelTab>('notas');
  const [salvandoFav, setSalvandoFav] = useState(false);

  // Guia de uso em modal: aparece sozinho na 1ª vez (persistido), reabre via link.
  const [guiaOpen, setGuiaOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem('forja:estudio:guiaVisto')) setGuiaOpen(true); } catch { /* noop */ }
  }, []);
  const fecharGuia = () => {
    setGuiaOpen(false);
    try { localStorage.setItem('forja:estudio:guiaVisto', '1'); } catch { /* noop */ }
  };

  // URL do embed: recalculada só quando o vídeo OU o selo de seleção muda.
  // Re-renders por digitação nas notas não mexem nisso (não reinicia o vídeo).
  const [embedSrc, setEmbedSrc] = useState('');
  useEffect(() => {
    const vid = video?.videoId || '';
    if (!vid) { setEmbedSrc(''); return; }
    const autoplay = playSeq !== ultimaSeqComAutoplay;
    ultimaSeqComAutoplay = playSeq;
    setEmbedSrc(`https://www.youtube.com/embed/${vid}?rel=0${autoplay ? '&autoplay=1' : ''}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId, playSeq]);

  // ── Notas por vídeo (autosave) ──────────────────────────────────────────────
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState('');
  const textoRef = useRef('');
  const videoIdRef = useRef('');
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const salvarNota = useCallback((vid: string, txt: string) => {
    if (!vid) return;
    setSalvando(true);
    callServer<ServerResult>('estudoVideoNotaSave', { videoId: vid, texto: txt })
      .then((r) => { if (r.ok) { dirtyRef.current = false; setSalvoEm(new Date().toISOString()); } })
      .catch(() => { /* mantém dirty pra próxima tentativa */ })
      .finally(() => setSalvando(false));
  }, []);

  // Troca de vídeo: descarrega pendência do anterior e carrega a nota do novo.
  useEffect(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = undefined; }
    if (dirtyRef.current && videoIdRef.current) salvarNota(videoIdRef.current, textoRef.current);

    const vid = video?.videoId || '';
    videoIdRef.current = vid;
    dirtyRef.current = false;
    if (!vid) { setTexto(''); textoRef.current = ''; setSalvoEm(''); return; }
    callServer<ServerResult>('estudoVideoNotaGet', vid)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { texto?: string; atualizadoEm?: string };
          setTexto(d.texto || ''); textoRef.current = d.texto || '';
          setSalvoEm(d.atualizadoEm || '');
        }
      })
      .catch(() => { /* preview */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId]);

  // Flush ao desmontar.
  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (dirtyRef.current && videoIdRef.current) salvarNota(videoIdRef.current, textoRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeTexto = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexto(val); textoRef.current = val; dirtyRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => salvarNota(videoIdRef.current, textoRef.current), 800);
  };

  const assistirLink = () => {
    const id = extrairVideoId(link);
    if (!id) { message.error('Não reconheci um link/ID de vídeo do YouTube válido.'); return; }
    onTrocarVideo({ videoId: id, url: 'https://www.youtube.com/watch?v=' + id });
    setLink('');
  };

  const salvarFavorito = async () => {
    if (!video?.videoId) return;
    setSalvandoFav(true);
    try {
      const r = await callServer<ServerResult>('estudoVideoSave', {
        url: 'https://www.youtube.com/watch?v=' + video.videoId,
        titulo: video.titulo, canal: video.canal, thumb: video.thumb,
      });
      if (r.ok) {
        const dup = !!(r.data as { duplicado?: boolean } | undefined)?.duplicado;
        message[dup ? 'info' : 'success'](dup ? 'Esse vídeo já está em Favoritos' : 'Salvo em Favoritos');
        onSalvou();
      } else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvandoFav(false); }
  };

  // ── Mandar pro Caderno ──────────────────────────────────────────────────────
  const [cadOpen, setCadOpen] = useState(false);
  const [salvandoCad, setSalvandoCad] = useState(false);
  const [cadForm] = Form.useForm();

  const abrirCaderno = () => {
    cadForm.setFieldsValue({
      titulo: video?.titulo || '',
      descricao: texto || '',
      tipo: 'conceito', status: 'a-rever', prioridade: 'media',
      url: video?.videoId ? 'https://www.youtube.com/watch?v=' + video.videoId : '',
      tags: '',
    });
    setCadOpen(true);
  };

  const salvarCaderno = async () => {
    try {
      const v = await cadForm.validateFields();
      setSalvandoCad(true);
      const r = await callServer<ServerResult>('estudoNotaSave', v);
      if (r.ok) { message.success('Mandado pro Caderno'); setCadOpen(false); }
      else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvandoCad(false); }
  };

  const fmtHora = (iso: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      {/* Barra de link */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          ref={linkRef}
          prefix={<Clapperboard size={15} color={t.accents.rose} />}
          placeholder="Cole um link do YouTube (ou ID) pra assistir aqui…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPressEnter={assistirLink}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Button type="primary" icon={<PlayCircle size={15} />} onClick={assistirLink}>Assistir</Button>
      </div>

      {!video ? (
        <EmptyEstudio
          t={t}
          recentes={recentes}
          onIrPastas={onIrPastas}
          onColarLink={() => linkRef.current?.focus()}
          onTocarRecente={onTocarRecente}
          onLimparHistorico={onLimparHistorico}
          onComoFunciona={() => setGuiaOpen(true)}
        />
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Player */}
          <div style={{ flex: '2 1 440px', minWidth: 300 }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: '#000' }}>
              <iframe
                key={embedSrc}
                src={embedSrc}
                title="YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {video.titulo && <div style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>{video.titulo}</div>}
                {video.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 3 }}>{video.canal}</div>}
              </div>
              <Tooltip title="Salvar em Favoritos"><Button size="small" icon={<Star size={14} />} loading={salvandoFav} onClick={salvarFavorito} /></Tooltip>
              <Tooltip title="Abrir no YouTube"><Button size="small" icon={<ExternalLink size={14} />} href={'https://www.youtube.com/watch?v=' + video.videoId} target="_blank" rel="noopener noreferrer" /></Tooltip>
            </div>
          </div>

          {/* Painel: Notas | Fila */}
          <div style={{ flex: '1 1 320px', minWidth: 290, display: 'flex', flexDirection: 'column' }}>
            <Segmented
              block
              value={painel}
              onChange={(v) => setPainel(v as PainelTab)}
              options={[
                { value: 'notas', label: <Seg icon={<NotebookPen size={13} />} txt="Notas" /> },
                { value: 'fila', label: <Seg icon={<ListVideo size={13} />} txt={`Fila${fila.length ? ` (${fila.length})` : ''}`} /> },
              ]}
              style={{ marginBottom: 10 }}
            />

            {painel === 'notas' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input.TextArea
                  value={texto}
                  onChange={onChangeTexto}
                  placeholder="Anote enquanto assiste… ex.: aos 7min, padrão de RLS; testar isso no projeto X."
                  autoSize={{ minRows: 12, maxRows: 22 }}
                  style={{ fontFamily: FONTS.ui, fontSize: 13, lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {salvando ? 'Salvando…' : salvoEm ? <><Check size={12} color={t.accents.sage} /> Salvo {fmtHora(salvoEm)}</> : 'As notas salvam sozinhas'}
                  </span>
                  <span style={{ flex: 1 }} />
                  <Button size="small" icon={<BookmarkPlus size={14} />} onClick={abrirCaderno}>Mandar pro Caderno</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filaTitulo && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: t.textTertiary, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{filaTitulo}</div>}
                {fila.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem fila. Abra uma pasta e escolha um vídeo pra ela carregar aqui." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
                    {fila.map((v) => (
                      <FilaRow key={v.videoId} v={v} t={t} ativo={v.videoId === video.videoId} onClick={() => onTrocarVideo(v)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={cadOpen}
        onCancel={() => setCadOpen(false)}
        title="Mandar pro Caderno"
        width={540}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setCadOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvandoCad} onClick={salvarCaderno}>Salvar no Caderno</Button>,
        ]}
      >
        <Form form={cadForm} layout="vertical" requiredMark={false}>
          <Form.Item name="titulo" label="Assunto / o que estudar" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="ex.: Supabase RLS" autoFocus />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="tipo" label="Tipo"><Select options={TIPO_OPCOES} /></Form.Item>
            <Form.Item name="status" label="Status"><Select options={STATUS_OPCOES} /></Form.Item>
            <Form.Item name="prioridade" label="Prioridade"><Select options={PRIORIDADE_OPCOES} /></Form.Item>
          </div>
          <Form.Item name="descricao" label="Anotação / o que aprofundar">
            <Input.TextArea rows={4} placeholder="O texto da sua nota entra aqui — edite à vontade." />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="url" label="Link (opcional)"><Input placeholder="https://…" /></Form.Item>
            <Form.Item name="tags" label="Tags (vírgula)"><Input placeholder="ex.: testar, urgente" /></Form.Item>
          </div>
        </Form>
      </Modal>

      <GuiaModal open={guiaOpen} onClose={fecharGuia} t={t} />
    </div>
  );
}

function Seg({ icon, txt }: { icon: React.ReactNode; txt: string }): React.ReactElement {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon}{txt}</span>;
}

// Estado vazio leve: placeholder + "Continuar assistindo". As instruções moram no
// GuiaModal (abre sozinho na 1ª vez, reabre pelo "Como funciona?").
function EmptyEstudio({ t, recentes, onIrPastas, onColarLink, onTocarRecente, onLimparHistorico, onComoFunciona }: {
  t: ReturnType<typeof useTokens>; recentes: VideoParaTocar[]; onIrPastas?: () => void;
  onColarLink: () => void; onTocarRecente: (v: VideoParaTocar) => void; onLimparHistorico: () => void; onComoFunciona: () => void;
}): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '52px 24px', textAlign: 'center', border: `1px dashed ${t.border}`, borderRadius: 14, background: t.surfaceMuted }}>
        <span style={{ width: 52, height: 52, borderRadius: '50%', background: `${t.accents.peach}1f`, color: t.accents.peach, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clapperboard size={26} />
        </span>
        <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 600, color: t.text }}>Escolha um vídeo e estude com foco</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, maxWidth: 420, lineHeight: 1.55 }}>
          Cole um link, ou vá em Pastas / Favoritos e clique num vídeo. Você assiste de um lado e anota do outro.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {onIrPastas && <Button type="primary" icon={<FolderOpen size={15} />} onClick={onIrPastas}>Abrir Pastas <ArrowRight size={14} style={{ marginLeft: 2, verticalAlign: 'middle' }} /></Button>}
          <Button icon={<Link2 size={14} />} onClick={onColarLink}>Colar um link</Button>
        </div>
        <Button type="link" size="small" onClick={onComoFunciona} style={{ color: t.textTertiary, fontSize: 12 }}>Como funciona?</Button>
      </div>

      {recentes.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: t.textTertiary }}>Continuar assistindo</span>
            <span style={{ flex: 1, height: 1, background: t.borderSoft }} />
            <Button type="text" size="small" onClick={onLimparHistorico} style={{ fontSize: 11, color: t.textTertiary, height: 22 }}>Limpar</Button>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
            {recentes.map((v) => (
              <button
                key={v.videoId}
                type="button"
                onClick={() => onTocarRecente(v)}
                style={{ flex: '0 0 auto', width: 184, textAlign: 'left', cursor: 'pointer', border: `1px solid ${t.borderSoft}`, background: t.surface, borderRadius: 11, overflow: 'hidden', padding: 0, boxShadow: t.shadowSoft }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: t.surfaceMuted }}>
                  <ThumbImg src={v.thumb} videoId={v.videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayCircle size={20} />
                    </span>
                  </span>
                </div>
                <div style={{ padding: '8px 10px 9px' }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.titulo || 'Vídeo'}</div>
                  {v.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.canal}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Instruções de uso em modal (premium), abre sozinho na 1ª visita.
function GuiaModal({ open, onClose, t }: {
  open: boolean; onClose: () => void; t: ReturnType<typeof useTokens>;
}): React.ReactElement {
  const passos = [
    { n: 1, icon: <FolderOpen size={18} />, accent: t.accents.peach, titulo: 'Escolha o vídeo', desc: 'Em Pastas (suas playlists do YouTube) ou Favoritos, clique em Estudar.' },
    { n: 2, icon: <Clapperboard size={18} />, accent: t.accents.blue, titulo: 'Assista aqui', desc: 'O player abre à esquerda; a Fila fica à direita pra emendar o próximo.' },
    { n: 3, icon: <NotebookPen size={18} />, accent: t.accents.sage, titulo: 'Anote ao vivo', desc: 'Escreva na aba Notas enquanto assiste — salva sozinho, amarrado ao vídeo.' },
    { n: 4, icon: <BookmarkPlus size={18} />, accent: t.accents.lavender, titulo: 'Mande pro Caderno', desc: 'Virou algo pra revisar? Um clique promove a nota a assunto estruturado.' },
  ];
  const dicas = [
    { icon: <Zap size={13} />, txt: 'Notas com autosave' },
    { icon: <ListVideo size={13} />, txt: 'Fila pra emendar vídeos' },
    { icon: <Star size={13} />, txt: 'Salve em Favoritos num toque' },
  ];
  return (
    <Modal open={open} onCancel={onClose} width={600} centered footer={[<Button key="ok" type="primary" onClick={onClose}>Entendi</Button>]}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: t.accents.peach, background: `${t.accents.peach}16`, borderRadius: 999, padding: '4px 11px', marginBottom: 12 }}>
          <Clapperboard size={12} /> Seu estúdio de estudo
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 21, fontWeight: 600, color: t.text, lineHeight: 1.2, letterSpacing: -0.3 }}>Assista e anote — sem distração</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginTop: 7 }}>
          Tudo num fluxo só: escolheu, assistiu, anotou — e o que importa vai pro Caderno.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))', gap: 11, marginBottom: 16 }}>
        {passos.map((p) => (
          <div key={p.n} style={{ borderRadius: 12, border: `1px solid ${t.borderSoft}`, background: t.surface, padding: '14px 14px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${p.accent}1c`, color: p.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</span>
              <span style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, color: t.borderSoft, lineHeight: 1 }}>{p.n}</span>
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, marginBottom: 4 }}>{p.titulo}</div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingTop: 4 }}>
        {dicas.map((d) => (
          <span key={d.txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
            <span style={{ color: t.accents.sage, display: 'inline-flex' }}>{d.icon}</span>{d.txt}
          </span>
        ))}
      </div>
    </Modal>
  );
}

function FilaRow({ v, t, ativo, onClick }: {
  v: VideoParaTocar; t: ReturnType<typeof useTokens>; ativo: boolean; onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${ativo ? `${t.accents.peach}88` : 'transparent'}`,
        background: ativo ? `${t.accents.peach}14` : 'transparent',
        borderRadius: 10, padding: 6, width: '100%',
      }}
    >
      <div style={{ position: 'relative', width: 110, height: 62, flexShrink: 0, borderRadius: 7, overflow: 'hidden', background: t.surfaceMuted }}>
        <ThumbImg src={v.thumb} videoId={v.videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        {ativo && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff' }}>
            <PlayCircle size={20} />
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: ativo ? t.text : t.textSecondary, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {v.titulo || 'Vídeo'}
        </div>
        {v.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.canal}</div>}
      </div>
    </button>
  );
}
