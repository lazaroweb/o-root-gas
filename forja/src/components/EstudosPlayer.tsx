import React, { useEffect, useState } from 'react';
import { App as AntApp, Button, Input, Tooltip } from 'antd';
import { PlayCircle, Star, ExternalLink, Clapperboard } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import type { VideoParaTocar } from '../views/Estudos';

// Extrai o videoId de várias formas de URL do YouTube (ou aceita um id cru).
export function extrairVideoId(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const padroes = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of padroes) {
    const m = s.match(re);
    if (m && m[1]) return m[1];
  }
  return '';
}

interface EstudosPlayerProps {
  video: VideoParaTocar | null;
  onSalvou: () => void;
}

export default function EstudosPlayer({ video, onSalvou }: EstudosPlayerProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [link, setLink] = useState('');
  const [videoId, setVideoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Quando chega um vídeo pra tocar (vindo dos Favoritos), carrega no player.
  useEffect(() => {
    if (video && video.videoId) {
      setVideoId(video.videoId);
      setLink(video.url || `https://www.youtube.com/watch?v=${video.videoId}`);
      setTitulo(video.titulo || '');
    }
  }, [video]);

  const assistir = () => {
    const id = extrairVideoId(link);
    if (!id) {
      message.error('Não reconheci um link/ID de vídeo do YouTube válido.');
      return;
    }
    setVideoId(id);
    setTitulo('');
  };

  const salvarFavorito = async () => {
    const id = videoId || extrairVideoId(link);
    if (!id) { message.error('Toque um vídeo antes de salvar.'); return; }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('estudoVideoSave', { url: `https://www.youtube.com/watch?v=${id}` });
      if (r.ok) {
        message.success('Salvo nos favoritos');
        onSalvou();
      } else { message.error(r.error || 'Erro ao salvar'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  return (
    <div style={{ padding: '16px 20px 22px' }}>
      {/* Barra de entrada */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Clapperboard size={15} color={t.accents.rose} />}
          placeholder="Cole um link do YouTube (ou o ID do vídeo) e dê play"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPressEnter={assistir}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Button type="primary" icon={<PlayCircle size={15} />} onClick={assistir}>Assistir</Button>
        {videoId && (
          <>
            <Button icon={<Star size={14} />} loading={salvando} onClick={salvarFavorito}>Salvar nos favoritos</Button>
            <Tooltip title="Abrir no YouTube">
              <Button icon={<ExternalLink size={14} />} href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" />
            </Tooltip>
          </>
        )}
      </div>

      {/* Player 16:9 */}
      {videoId ? (
        <div>
          {titulo && (
            <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>{titulo}</div>
          )}
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: '#000' }}>
            <iframe
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '64px 24px', textAlign: 'center',
          border: `1px dashed ${t.border}`, borderRadius: 12, background: t.surfaceMuted,
        }}>
          <span style={{ width: 52, height: 52, borderRadius: '50%', background: `${t.accents.rose}1f`, color: t.accents.rose, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clapperboard size={26} />
          </span>
          <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Cole um link e comece a estudar</div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, maxWidth: 420, lineHeight: 1.5 }}>
            Funciona com qualquer link do YouTube — vídeo, <code>youtu.be</code> ou shorts.
            Gostou? Salve nos favoritos pra montar sua trilha.
          </div>
        </div>
      )}
    </div>
  );
}
