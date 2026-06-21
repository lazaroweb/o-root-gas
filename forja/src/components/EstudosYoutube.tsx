import React, { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp, Button, Input, Segmented, Skeleton, Empty, Tooltip, Avatar, Modal, Form, Alert,
} from 'antd';
import {
  PlayCircle, ListVideo, Search, Star, ExternalLink, RefreshCw, ChevronLeft, Check,
  KeyRound, Copy, Plug, LogOut, FolderPlus, FolderOpen, X,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { VideoParaTocar } from '../views/Estudos';

interface YtVideo { videoId: string; titulo: string; canal: string; thumb: string; publicado: string }
interface YtPlaylist { playlistId: string; titulo: string; canal: string; thumb: string; qtd: number }
interface PastaSeguida { id: string; playlistId: string; titulo: string; canal: string; thumb: string; qtd: number; ordem: number }
interface YtStatus { conectado: boolean; credConfigured: boolean; connectorId: string; redirectUri: string; canal?: string; foto?: string }
interface YtPage<T> { itens: T[]; nextPageToken: string }

type YtTab = 'pastas' | 'buscar';

interface EstudosYoutubeProps {
  onTocar: (v: VideoParaTocar, fila?: VideoParaTocar[], titulo?: string) => void;
  onImportou: () => void;
}

export default function EstudosYoutube({ onTocar, onImportou }: EstudosYoutubeProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [status, setStatus] = useState<YtStatus | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [tab, setTab] = useState<YtTab>('pastas');

  // Pastas (playlists seguidas)
  const [seguidas, setSeguidas] = useState<PastaSeguida[]>([]);
  const [pastaAberta, setPastaAberta] = useState<PastaSeguida | null>(null);

  // Vídeos (de uma pasta aberta ou da busca)
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const [busca, setBusca] = useState('');
  const [buscou, setBuscou] = useState(false);

  const [importados, setImportados] = useState<Record<string, boolean>>({});

  // Adicionar pasta (lista todas as playlists do YouTube)
  const [addOpen, setAddOpen] = useState(false);

  // Conexão
  const [credOpen, setCredOpen] = useState(false);
  const [salvandoCred, setSalvandoCred] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [form] = Form.useForm();

  const verificarStatus = useCallback((silencioso?: boolean) => {
    if (!silencioso) setVerificando(true);
    callServer<ServerResult>('estudoYoutubeStatus')
      .then((r) => { if (r.ok && r.data) setStatus(r.data as YtStatus); else setStatus({ conectado: false, credConfigured: false, connectorId: '', redirectUri: '' }); })
      .catch(() => setStatus({ conectado: false, credConfigured: false, connectorId: '', redirectUri: '' }))
      .finally(() => setVerificando(false));
  }, []);

  useEffect(() => { verificarStatus(); }, [verificarStatus]);

  const tratarErro = useCallback((r: ServerResult): boolean => {
    if (r.error === 'NOT_CONNECTED' || r.error === 'AUTH_NEEDED') {
      message.warning('Conexão com o YouTube expirou — conecte de novo.');
      verificarStatus(true);
      return true;
    }
    if (r.error === 'API_DISABLED') {
      message.error('Ative a "YouTube Data API v3" no seu projeto do Google Cloud (a mesma das credenciais).');
      return true;
    }
    return false;
  }, [message, verificarStatus]);

  const carregarSeguidas = useCallback(() => {
    callServer<ServerResult>('estudoPlaylistsSeguidas')
      .then((r) => { if (r.ok && r.data) setSeguidas(r.data as PastaSeguida[]); })
      .catch(() => { /* noop */ });
  }, []);

  useEffect(() => {
    if (!status?.conectado) return;
    carregarSeguidas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.conectado]);

  // Abre uma pasta seguida e lista os vídeos ao vivo.
  const abrirPasta = useCallback((p: PastaSeguida, pageToken?: string) => {
    if (pageToken) setCarregandoMais(true); else { setLoading(true); setVideos([]); setToken(''); setPastaAberta(p); }
    callServer<ServerResult>('estudoYoutubePlaylistItens', p.playlistId, pageToken)
      .then((r) => {
        if (r.ok && r.data) {
          const pg = r.data as YtPage<YtVideo>;
          setVideos((prev) => (pageToken ? [...prev, ...pg.itens] : pg.itens));
          setToken(pg.nextPageToken || '');
        } else if (!tratarErro(r)) message.error(r.error || 'Erro ao abrir a pasta');
      })
      .catch((e) => message.error(e.message))
      .finally(() => { setLoading(false); setCarregandoMais(false); });
  }, [message, tratarErro]);

  const buscar = useCallback((pageToken?: string) => {
    const q = busca.trim();
    if (!q) return;
    if (pageToken) setCarregandoMais(true); else { setLoading(true); setVideos([]); setToken(''); setBuscou(true); }
    callServer<ServerResult>('estudoYoutubeBuscar', q, pageToken)
      .then((r) => {
        if (r.ok && r.data) {
          const pg = r.data as YtPage<YtVideo>;
          setVideos((prev) => (pageToken ? [...prev, ...pg.itens] : pg.itens));
          setToken(pg.nextPageToken || '');
        } else if (!tratarErro(r)) message.error(r.error || 'Erro na busca');
      })
      .catch((e) => message.error(e.message))
      .finally(() => { setLoading(false); setCarregandoMais(false); });
  }, [busca, message, tratarErro]);

  // Reseta a visão de vídeos ao trocar de aba.
  useEffect(() => {
    setVideos([]); setToken(''); setPastaAberta(null); setBuscou(false);
  }, [tab]);

  // Converte os vídeos atuais (pasta ou busca) em fila pro Estúdio.
  const filaAtual = useCallback((): VideoParaTocar[] => videos.map((v) => ({
    videoId: v.videoId, url: 'https://www.youtube.com/watch?v=' + v.videoId, titulo: v.titulo, canal: v.canal, thumb: v.thumb,
  })), [videos]);

  const tituloFila = tab === 'buscar' ? (busca.trim() ? 'Busca: ' + busca.trim() : 'Busca') : (pastaAberta?.titulo || '');

  const abrirNoEstudio = (v: YtVideo) => {
    onTocar(
      { videoId: v.videoId, url: 'https://www.youtube.com/watch?v=' + v.videoId, titulo: v.titulo, canal: v.canal, thumb: v.thumb },
      filaAtual(),
      tituloFila,
    );
  };

  const importar = async (v: YtVideo) => {
    setImportados((m) => ({ ...m, [v.videoId]: true }));
    try {
      const r = await callServer<ServerResult>('estudoVideoSave', {
        url: 'https://www.youtube.com/watch?v=' + v.videoId,
        titulo: v.titulo, canal: v.canal, thumb: v.thumb,
      });
      if (r.ok) {
        const dup = !!(r.data as { duplicado?: boolean } | undefined)?.duplicado;
        if (dup) message.info('Esse vídeo já está em Favoritos');
        else message.success('Salvo em Favoritos');
        onImportou();
      } else { message.error(r.error || 'Erro'); setImportados((m) => ({ ...m, [v.videoId]: false })); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
      setImportados((m) => ({ ...m, [v.videoId]: false }));
    }
  };

  const removerPasta = async (p: PastaSeguida) => {
    const r = await callServer<ServerResult>('estudoPlaylistRemover', p.id);
    if (r.ok) { message.success('Pasta removida'); carregarSeguidas(); }
  };

  // ─── Conexão ──────────────────────────────────────────────────────────────────
  const salvarCred = async () => {
    try {
      const v = await form.validateFields();
      setSalvandoCred(true);
      const r = await callServer<ServerResult>('estudoYoutubeSetCred', { clientId: v.clientId, clientSecret: v.clientSecret });
      if (r.ok) { message.success('Credenciais salvas'); setCredOpen(false); verificarStatus(true); }
      else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      if (e instanceof Error && !('errorFields' in e)) message.error(e.message);
    } finally { setSalvandoCred(false); }
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const r = await callServer<ServerResult>('estudoYoutubeConectarUrl');
      if (!r.ok) { message.error(r.error || 'Erro ao conectar'); return; }
      const data = r.data as { authorized?: boolean; url?: string };
      if (data.authorized) { message.success('Já autorizado'); verificarStatus(true); return; }
      if (data.url) {
        window.open(data.url, '_blank', 'width=520,height=680');
        message.info('Conclua a autorização na janela do Google e clique em "Verificar conexão".');
      }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setConectando(false); }
  };

  const desconectar = async () => {
    const r = await callServer<ServerResult>('estudoYoutubeDesconectar');
    if (r.ok) { message.success('Desconectado'); verificarStatus(true); }
  };

  const copiar = (txt: string) => {
    try { navigator.clipboard.writeText(txt); message.success('Copiado'); } catch { /* noop */ }
  };

  // ─── Render: estados de conexão ────────────────────────────────────────────────
  if (verificando) {
    return <div style={{ padding: '20px 22px' }}><Skeleton active avatar paragraph={{ rows: 3 }} /></div>;
  }

  if (!status?.conectado) {
    return (
      <div style={{ padding: '34px 28px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${t.accents.peach}1f`, color: t.accents.peach }}>
            <ListVideo size={26} />
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, marginBottom: 8 }}>
            Conecte sua conta do YouTube
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
            Depois de conectar, você escolhe quais <b>playlists</b> acompanhar como pastas de estudo —
            elas já são a sua organização. A conexão é por OAuth próprio (igual ao Driver).
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PassoCard
            n={1}
            ativo={!status?.credConfigured}
            feito={!!status?.credConfigured}
            titulo="Credenciais OAuth do Google"
            desc={status?.credConfigured ? 'Credenciais salvas. Pode reconfigurar quando quiser.' : 'Cole o Client ID e o Client Secret do seu projeto (com a YouTube Data API v3 habilitada).'}
            acao={<Button icon={<KeyRound size={14} />} onClick={() => { form.resetFields(); setCredOpen(true); }}>{status?.credConfigured ? 'Reconfigurar' : 'Configurar'}</Button>}
            t={t}
          />
          <PassoCard
            n={2}
            ativo={!!status?.credConfigured}
            feito={false}
            titulo="Autorizar a conta"
            desc="Abre a tela do Google pra você consentir o acesso de leitura ao seu YouTube."
            acao={(
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" icon={<Plug size={14} />} loading={conectando} disabled={!status?.credConfigured} onClick={conectar}>Conectar</Button>
                <Button icon={<RefreshCw size={14} />} onClick={() => verificarStatus()}>Verificar conexão</Button>
              </div>
            )}
            t={t}
          />
        </div>

        <Alert
          style={{ marginTop: 18 }}
          type="info"
          showIcon
          message="Como pegar as credenciais (rápido)"
          description={(
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              No <b>Google Cloud Console</b>: 1) habilite a <b>YouTube Data API v3</b>; 2) em <b>Tela de consentimento OAuth</b>,
              adicione o scope <code>youtube.readonly</code>; 3) em <b>Credenciais → Criar → ID do cliente OAuth (Aplicativo da
              Web)</b>, cole a Redirect URI abaixo. Passo a passo em <code>YOUTUBE_OAUTH.md</code>.
            </div>
          )}
        />

        <Modal
          open={credOpen}
          onCancel={() => setCredOpen(false)}
          title="Credenciais OAuth — YouTube"
          width={560}
          footer={[
            <Button key="c" onClick={() => setCredOpen(false)}>Cancelar</Button>,
            <Button key="s" type="primary" loading={salvandoCred} onClick={salvarCred}>Salvar</Button>,
          ]}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginBottom: 4 }}>Redirect URI (registre essa no seu OAuth client)</div>
            <Input
              readOnly
              value={status?.redirectUri || ''}
              addonAfter={<Tooltip title="Copiar"><Copy size={14} style={{ cursor: 'pointer' }} onClick={() => copiar(status?.redirectUri || '')} /></Tooltip>}
            />
          </div>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item name="clientId" label="Client ID" rules={[{ required: true, message: 'Cole o Client ID' }]}>
              <Input placeholder="…apps.googleusercontent.com" autoFocus />
            </Form.Item>
            <Form.Item name="clientSecret" label="Client Secret" rules={[{ required: true, message: 'Cole o Client Secret' }]}>
              <Input.Password placeholder="GOCSPX-…" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  const mostrandoVideos = (tab === 'pastas' && !!pastaAberta) || (tab === 'buscar');

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar src={status.foto || undefined} size={34} style={{ background: t.surfaceMuted, color: t.textTertiary }}>
            {(status.canal || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.2 }}>{status.canal || 'Conta conectada'}</div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.accents.sage }}>● YouTube conectado</div>
          </div>
          <Tooltip title="Desconectar"><Button type="text" size="small" icon={<LogOut size={14} />} onClick={desconectar} /></Tooltip>
        </div>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as YtTab)}
          options={[
            { value: 'pastas', label: <Seg icon={<FolderOpen size={13} />} txt="Pastas" /> },
            { value: 'buscar', label: <Seg icon={<Search size={13} />} txt="Buscar" /> },
          ]}
        />
      </div>

      {/* ABA PASTAS — grade de pastas seguidas */}
      {tab === 'pastas' && !pastaAberta && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>
              {seguidas.length} {seguidas.length === 1 ? 'pasta acompanhada' : 'pastas acompanhadas'}
            </div>
            <Button type="primary" icon={<FolderPlus size={14} />} onClick={() => setAddOpen(true)}>Adicionar pasta</Button>
          </div>
          {seguidas.length === 0 ? (
            <Empty description="Você ainda não acompanha nenhuma playlist. Clique em “Adicionar pasta” e escolha as suas.">
              <Button type="primary" icon={<FolderPlus size={14} />} onClick={() => setAddOpen(true)}>Adicionar pasta</Button>
            </Empty>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {seguidas.map((p) => (
                <FolderCard key={p.id} p={p} t={t} onAbrir={() => abrirPasta(p)} onRemover={() => removerPasta(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ABA PASTAS — dentro de uma pasta */}
      {tab === 'pastas' && pastaAberta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => { setPastaAberta(null); setVideos([]); setToken(''); }}>Pastas</Button>
          <span style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text }}>{pastaAberta.titulo}</span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>· {pastaAberta.qtd} vídeos</span>
        </div>
      )}

      {/* ABA BUSCAR */}
      {tab === 'buscar' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            prefix={<Search size={13} color={t.textTertiary} />}
            placeholder="Buscar vídeos no YouTube…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onPressEnter={() => buscar()}
            allowClear
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={() => buscar()} loading={loading}>Buscar</Button>
        </div>
      )}

      {/* GRADE DE VÍDEOS (pasta aberta ou busca) — clicar leva pro Estúdio */}
      {mostrandoVideos && (
        loading ? <Skeleton active paragraph={{ rows: 6 }} />
          : videos.length === 0 ? (
            <Empty description={tab === 'buscar' && !buscou ? 'Digite algo e busque vídeos no YouTube.' : 'Nada por aqui.'} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {videos.map((v) => (
                  <VideoGridCard
                    key={v.videoId + (v.publicado || '')}
                    v={v}
                    t={t}
                    importado={!!importados[v.videoId]}
                    onAbrir={() => abrirNoEstudio(v)}
                    onImportar={() => importar(v)}
                  />
                ))}
              </div>
              {token && (
                <div style={{ textAlign: 'center', marginTop: 18 }}>
                  <Button loading={carregandoMais} onClick={() => { if (tab === 'buscar') buscar(token); else if (pastaAberta) abrirPasta(pastaAberta, token); }}>Carregar mais</Button>
                </div>
              )}
            </>
          )
      )}

      <AdicionarPasta
        open={addOpen}
        onClose={() => setAddOpen(false)}
        seguidas={seguidas}
        onMudou={carregarSeguidas}
        tratarErro={tratarErro}
        t={t}
      />
    </div>
  );
}

// Modal pra escolher quais playlists do YouTube acompanhar como pastas.
function AdicionarPasta({ open, onClose, seguidas, onMudou, tratarErro, t }: {
  open: boolean; onClose: () => void; seguidas: PastaSeguida[]; onMudou: () => void;
  tratarErro: (r: ServerResult) => boolean; t: ReturnType<typeof useTokens>;
}): React.ReactElement {
  const { message } = AntApp.useApp();
  const [todas, setTodas] = useState<YtPlaylist[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [trabalhando, setTrabalhando] = useState<Record<string, boolean>>({});

  const seguidasIds = new Set(seguidas.map((s) => s.playlistId));

  const carregar = useCallback((pageToken?: string) => {
    if (pageToken) setCarregandoMais(true); else { setLoading(true); setTodas([]); setToken(''); }
    callServer<ServerResult>('estudoYoutubePlaylists', pageToken)
      .then((r) => {
        if (r.ok && r.data) {
          const pg = r.data as YtPage<YtPlaylist>;
          setTodas((prev) => (pageToken ? [...prev, ...pg.itens] : pg.itens));
          setToken(pg.nextPageToken || '');
        } else if (!tratarErro(r)) message.error(r.error || 'Erro ao listar playlists');
      })
      .catch((e) => message.error(e.message))
      .finally(() => { setLoading(false); setCarregandoMais(false); });
  }, [message, tratarErro]);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const alternar = async (pl: YtPlaylist, seguindo: boolean) => {
    setTrabalhando((m) => ({ ...m, [pl.playlistId]: true }));
    try {
      const r = seguindo
        ? await callServer<ServerResult>('estudoPlaylistRemover', pl.playlistId)
        : await callServer<ServerResult>('estudoPlaylistSeguir', { playlistId: pl.playlistId, titulo: pl.titulo, canal: pl.canal, thumb: pl.thumb, qtd: pl.qtd });
      if (r.ok) onMudou(); else message.error(r.error || 'Erro');
    } finally {
      setTrabalhando((m) => ({ ...m, [pl.playlistId]: false }));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Adicionar pastas (suas playlists do YouTube)"
      width={620}
      footer={[<Button key="ok" type="primary" onClick={onClose}>Concluído</Button>]}
    >
      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginBottom: 14 }}>
        Marque as playlists que já têm o que você quer estudar. Elas viram pastas aqui — sem reorganizar nada.
      </div>
      {loading ? <Skeleton active paragraph={{ rows: 5 }} />
        : todas.length === 0 ? <Empty description="Nenhuma playlist encontrada nesta conta." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {todas.map((pl) => {
                const seguindo = seguidasIds.has(pl.playlistId);
                return (
                  <div key={pl.playlistId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, border: `1px solid ${seguindo ? `${t.accents.sage}66` : t.border}`, background: t.surface }}>
                    <div style={{ position: 'relative', width: 72, height: 41, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: t.surfaceMuted }}>
                      <ThumbImg src={pl.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.titulo}</div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{pl.qtd} vídeos</div>
                    </div>
                    <Button
                      size="small"
                      type={seguindo ? 'default' : 'primary'}
                      loading={!!trabalhando[pl.playlistId]}
                      icon={seguindo ? <Check size={13} /> : <FolderPlus size={13} />}
                      onClick={() => alternar(pl, seguindo)}
                    >
                      {seguindo ? 'Acompanhando' : 'Acompanhar'}
                    </Button>
                  </div>
                );
              })}
              {token && (
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <Button size="small" loading={carregandoMais} onClick={() => carregar(token)}>Carregar mais</Button>
                </div>
              )}
            </div>
          )}
    </Modal>
  );
}

function Seg({ icon, txt }: { icon: React.ReactNode; txt: string }): React.ReactElement {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon}{txt}</span>;
}

// Capa robusta: no iframe sandbox do Apps Script, a thumb do YouTube só carrega
// com referrerPolicy "no-referrer". Em caso de erro, tenta variações pelo videoId.
export function ThumbImg({ src, videoId, alt, style }: {
  src?: string; videoId?: string; alt?: string; style?: React.CSSProperties;
}): React.ReactElement | null {
  const candidatos = React.useMemo(() => {
    const arr: string[] = [];
    if (src) arr.push(src);
    if (videoId) {
      arr.push('https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg');
      arr.push('https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg');
      arr.push('https://i.ytimg.com/vi/' + videoId + '/default.jpg');
    }
    return Array.from(new Set(arr.filter(Boolean)));
  }, [src, videoId]);
  const [i, setI] = useState(0);
  if (candidatos.length === 0 || i >= candidatos.length) return null;
  return (
    <img
      src={candidatos[i]}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      loading="lazy"
      style={style}
      onError={() => setI((n) => n + 1)}
    />
  );
}

function FolderCard({ p, t, onAbrir, onRemover }: {
  p: PastaSeguida; t: ReturnType<typeof useTokens>; onAbrir: () => void; onRemover: () => void;
}): React.ReactElement {
  return (
    <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface, overflow: 'hidden', boxShadow: t.shadowSoft }}>
      <button
        type="button"
        onClick={onAbrir}
        style={{ textAlign: 'left', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'block' }}
      >
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: t.surfaceMuted }}>
          <ThumbImg src={p.thumb} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{ position: 'absolute', right: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontFamily: FONTS.ui, fontSize: 11 }}>
            <ListVideo size={12} /> {p.qtd}
          </span>
        </div>
        <div style={{ padding: '11px 13px' }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.titulo}</div>
          {p.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 3 }}>{p.canal}</div>}
        </div>
      </button>
      <Tooltip title="Parar de acompanhar">
        <Button
          type="text"
          size="small"
          icon={<X size={14} />}
          onClick={onRemover}
          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.45)', color: '#fff' }}
        />
      </Tooltip>
    </div>
  );
}

// Card de vídeo — clicar abre no Estúdio (com a fila da pasta/busca).
function VideoGridCard({ v, t, importado, onAbrir, onImportar }: {
  v: YtVideo; t: ReturnType<typeof useTokens>; importado: boolean; onAbrir: () => void; onImportar: () => void;
}): React.ReactElement {
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: t.shadowSoft }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: t.surfaceMuted }}>
        <button
          type="button"
          onClick={onAbrir}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, margin: 0, cursor: 'pointer', background: 'transparent', display: 'block' }}
        >
          <ThumbImg src={v.thumb} videoId={v.videoId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)' }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlayCircle size={26} />
            </span>
          </span>
        </button>
      </div>
      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {v.titulo}
        </div>
        {v.canal && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{v.canal}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 'auto', paddingTop: 6 }}>
          <Button type="text" size="small" icon={<PlayCircle size={15} />} onClick={onAbrir} style={{ paddingLeft: 0 }}>Estudar</Button>
          <span style={{ flex: 1 }} />
          <Tooltip title="Abrir no YouTube"><Button type="text" size="small" icon={<ExternalLink size={14} />} href={'https://www.youtube.com/watch?v=' + v.videoId} target="_blank" rel="noopener noreferrer" /></Tooltip>
          <Tooltip title={importado ? 'Salvo em Favoritos' : 'Salvar em Favoritos'}>
            <Button type="text" size="small" icon={importado ? <Check size={15} color={t.accents.sage} /> : <Star size={14} />} disabled={importado} onClick={onImportar} />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function PassoCard({ n, ativo, feito, titulo, desc, acao, t }: {
  n: number; ativo: boolean; feito: boolean; titulo: string; desc: string; acao: React.ReactNode;
  t: ReturnType<typeof useTokens>;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: t.surface, border: `1px solid ${ativo ? `${t.accents.peach}66` : t.border}`, opacity: ativo || feito ? 1 : 0.6 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: feito ? `${t.accents.sage}22` : t.surfaceMuted, color: feito ? t.accents.sage : t.textTertiary, fontFamily: FONTS.ui, fontWeight: 700, fontSize: 13 }}>
        {feito ? <Check size={16} /> : n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>{titulo}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{acao}</div>
    </div>
  );
}
