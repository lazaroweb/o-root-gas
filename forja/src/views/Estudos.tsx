import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Star, BookOpen, FolderOpen, Route } from 'lucide-react';
import { PageHeader } from '../components/ui';
import SubNav, { type SubNavItem } from '../components/SubNav';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import EstudosEstudio from '../components/EstudosEstudio';
import EstudosFavoritos from '../components/EstudosFavoritos';
import EstudosCaderno from '../components/EstudosCaderno';
import EstudosYoutube from '../components/EstudosYoutube';
import EstudosTrilhas from '../components/EstudosTrilhas';

// Vídeo favoritado (espelha a tabela EstudoVideos no servidor). Compartilhado
// entre o player e a lista de favoritos.
export interface EstudoVideo {
  id: string;
  videoId: string;
  url: string;
  titulo: string;
  canal: string;
  thumb: string;
  categoria: string;
  colecaoId: string;
  tags: string[];
  nota: string;
  criadoEm: string;
  atualizadoEm: string;
}

// O que o player precisa pra tocar — pode ser um favorito ou um link avulso.
export interface VideoParaTocar {
  videoId: string;
  url?: string;
  titulo?: string;
  canal?: string;
  thumb?: string;
}

type EstTab = 'estudio' | 'youtube' | 'favoritos' | 'trilhas' | 'caderno';

export default function Estudos(): React.ReactElement {
  const t = useTokens();
  const [tab, setTab] = useState<EstTab>('estudio');
  const [videoAtual, setVideoAtual] = useState<VideoParaTocar | null>(null);
  // Fila atual (ex.: vídeos da pasta aberta) — pra escolher o próximo no Estúdio.
  const [fila, setFila] = useState<VideoParaTocar[]>([]);
  const [filaTitulo, setFilaTitulo] = useState('');
  // "Selo" que sobe a cada seleção deliberada de vídeo — só então o player dá
  // autoplay. Ao voltar pra aba (remount), o selo não muda → não começa sozinho.
  const [playSeq, setPlaySeq] = useState(0);
  // Histórico "continuar assistindo".
  const [recentes, setRecentes] = useState<VideoParaTocar[]>([]);
  // Bump pra recarregar a lista de favoritos quando o player salva um novo.
  const [favRefresh, setFavRefresh] = useState(0);

  const carregarRecentes = useCallback(() => {
    callServer<ServerResult>('estudoHistoricoList')
      .then((r) => {
        if (r.ok && r.data) {
          const lista = (r.data as Array<{ videoId: string; url: string; titulo: string; canal: string; thumb: string }>)
            .map((h) => ({ videoId: h.videoId, url: h.url, titulo: h.titulo, canal: h.canal, thumb: h.thumb }));
          setRecentes(lista);
        }
      })
      .catch(() => { /* preview */ });
  }, []);

  useEffect(() => { carregarRecentes(); }, [carregarRecentes]);

  const registrarHistorico = (v: VideoParaTocar) => {
    callServer<ServerResult>('estudoHistoricoAdd', {
      videoId: v.videoId, titulo: v.titulo, canal: v.canal, thumb: v.thumb, url: v.url,
    }).then(() => carregarRecentes()).catch(() => { /* noop */ });
  };

  const tocar = (v: VideoParaTocar, novaFila?: VideoParaTocar[], titulo?: string) => {
    setVideoAtual(v);
    if (novaFila) { setFila(novaFila); setFilaTitulo(titulo || ''); }
    setPlaySeq((s) => s + 1);
    setTab('estudio');
    registrarHistorico(v);
  };

  const trocarVideo = (v: VideoParaTocar) => {
    setVideoAtual(v);
    setPlaySeq((s) => s + 1);
    registrarHistorico(v);
  };

  const limparHistorico = () => {
    callServer<ServerResult>('estudoHistoricoClear').then(() => setRecentes([])).catch(() => { /* noop */ });
  };

  const items: SubNavItem<EstTab>[] = [
    { key: 'estudio', icon: Clapperboard, label: 'Estúdio', accent: 'peach', desc: 'Assista e anote ao mesmo tempo — o vídeo de um lado, suas notas do outro.' },
    { key: 'youtube', icon: FolderOpen, label: 'Pastas', accent: 'peach', desc: 'Suas playlists do YouTube como pastas de estudo — escolha o vídeo e leve pro Estúdio.' },
    { key: 'favoritos', icon: Star, label: 'Favoritos', accent: 'blue', desc: 'Gaveta rápida de vídeos soltos salvos por link — capa e título automáticos.' },
    { key: 'trilhas', icon: Route, label: 'Trilhas', accent: 'lavender', desc: 'Tópicos de estudo (Agents, Skills, Tools…) com vídeos e tarefas — monte seu plano e marque o progresso.' },
    { key: 'caderno', icon: BookOpen, label: 'Caderno', accent: 'sage', desc: 'Assuntos, ferramentas e dicas pra revisar e aprofundar na sua jornada.' },
  ];

  const card = (child: React.ReactNode): React.ReactElement => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {child}
    </div>
  );

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1240, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Estudos"
        subtitle="Seu canto de aprendizado: assista, salve o que importa e registre o que precisa aprofundar."
      />
      <SubNav items={items} value={tab} onChange={setTab} ariaLabel="Seções de Estudos">
        {tab === 'estudio' && card(
          <EstudosEstudio
            video={videoAtual}
            fila={fila}
            filaTitulo={filaTitulo}
            playSeq={playSeq}
            recentes={recentes}
            onTrocarVideo={trocarVideo}
            onTocarRecente={(v) => tocar(v, recentes, 'Continuar assistindo')}
            onLimparHistorico={limparHistorico}
            onSalvou={() => setFavRefresh((k) => k + 1)}
            onIrPastas={() => setTab('youtube')}
          />,
        )}
        {tab === 'favoritos' && card(<EstudosFavoritos onTocar={tocar} refreshKey={favRefresh} />)}
        {tab === 'youtube' && card(<EstudosYoutube onTocar={tocar} onImportou={() => setFavRefresh((k) => k + 1)} />)}
        {tab === 'trilhas' && card(<EstudosTrilhas onTocar={tocar} />)}
        {tab === 'caderno' && card(<EstudosCaderno onVirarTrilha={() => setTab('trilhas')} />)}
      </SubNav>
    </div>
  );
}
