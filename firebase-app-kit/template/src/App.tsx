// ─── App shell — login, gates e o app em si ──────────────────────────────────
// Fluxo: splash (auth resolvendo) → login → [beta fechado?] → carrega base →
// app. A tela de demonstração é um CRUD de notas — troque pela sua.
import React, { useEffect, useState } from 'react';
import { App as AntApp, Button, Input, Popconfirm } from 'antd';
import { LogOut, Plus, Trash2, StickyNote } from 'lucide-react';
import { signInWithPopup, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { carregarBase, resetStore } from './server/store';
import { garantirDono } from './server/acesso';
import callServer, { subscribeLoading } from './rpc-client';
import { APP_VERSION } from './version';
import type { ServerResult, Nota } from './types';

const NOME_APP = 'Meu App';

export default function App(): React.ReactElement {
  const { message } = AntApp.useApp();
  // undefined = auth ainda resolvendo (mostra splash, não a tela de login —
  // um flash de "Entrar" pra quem já está logado parece app quebrado).
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [baseOk, setBaseOk] = useState(false);
  const [semConvite, setSemConvite] = useState(false);
  const [erroBase, setErroBase] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  useEffect(() => subscribeLoading(setProcessando), []);

  useEffect(() => {
    if (!user) { resetStore(); setBaseOk(false); setSemConvite(false); return; }
    let cancelado = false;
    setErroBase(null);
    setSemConvite(false);
    // Posse (config/dono) precisa vir ANTES da base: as rules só liberam
    // usuarios/{uid} pra dono/convidados.
    garantirDono()
      .then(() => carregarBase(user.uid))
      .then(() => { if (!cancelado) setBaseOk(true); })
      .catch((e) => {
        if (cancelado) return;
        // Beta fechado: as rules negam leitura pra quem não tem convite.
        const code = (e as { code?: string })?.code || '';
        if (code === 'permission-denied') { setSemConvite(true); return; }
        setErroBase(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelado = true; };
  }, [user]);

  const entrar = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // NUNCA engula este erro — um catch silencioso aqui esconde
      // auth/unauthorized-domain e vira "loop de login" sem pista.
      message.error(e instanceof Error ? e.message : 'Erro no login');
    }
  };
  const sair = () => { void signOut(auth); };

  // ── Splash ──
  if (user === undefined) {
    return <Centro><span style={{ color: '#8a8580', fontSize: 14 }}>Carregando…</span></Centro>;
  }

  // ── Login ──
  if (!user) {
    return (
      <Centro>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#2A2724', marginBottom: 6 }}>{NOME_APP}</div>
          <p style={{ color: '#8a8580', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Entre com sua conta Google pra começar.
          </p>
          <Button type="primary" size="large" onClick={entrar}>Entrar com Google</Button>
          <div style={{ marginTop: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: '#b5b0aa' }}>
            v{APP_VERSION}
          </div>
        </div>
      </Centro>
    );
  }

  // ── Beta fechado ──
  if (semConvite) {
    return (
      <Centro>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#2A2724', marginBottom: 8 }}>Beta fechado</div>
          <p style={{ color: '#8a8580', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
            Este app está em beta por convite. Peça pra quem te indicou liberar o e-mail:
          </p>
          <div style={{
            display: 'inline-block', fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
            background: '#f4ede2', border: '1px solid #e0d5c5', borderRadius: 10,
            padding: '8px 14px', marginBottom: 24, color: '#2A2724',
          }}>
            {user.email}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button onClick={() => window.location.reload()}>Já fui liberado — tentar de novo</Button>
            <Button onClick={sair}>Trocar de conta</Button>
          </div>
        </div>
      </Centro>
    );
  }

  if (erroBase) {
    return (
      <Centro>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#8a1f1f', marginBottom: 8 }}>Erro ao carregar</div>
          <p style={{ color: '#8a8580', fontSize: 13, marginBottom: 20 }}>{erroBase}</p>
          <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        </div>
      </Centro>
    );
  }

  if (!baseOk) {
    return <Centro><span style={{ color: '#8a8580', fontSize: 14 }}>Carregando seus dados…</span></Centro>;
  }

  // ── App ──
  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F5' }}>
      {/* Barrinha global de atividade — aparece em qualquer RPC em andamento */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 99,
        background: processando ? 'linear-gradient(90deg, #d99b73, #c9855c)' : 'transparent',
        transition: 'background 0.2s ease',
      }} />
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', borderBottom: '1px solid #eee5d8', background: '#FFFDFA',
      }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: '#2A2724' }}>{NOME_APP}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: '#b5b0aa' }}>v{APP_VERSION}</span>
          <Button type="text" size="small" icon={<LogOut size={14} />} onClick={sair}>Sair</Button>
        </span>
      </header>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '36px 24px' }}>
        <NotasDemo />
      </main>
    </div>
  );
}

// ─── Demo: CRUD de notas — apague e construa o seu app aqui ──────────────────
function NotasDemo(): React.ReactElement {
  const { message } = AntApp.useApp();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const r = await callServer<ServerResult<Nota[]>>('getNotas');
    if (r.ok && r.data) setNotas(r.data);
  };
  useEffect(() => { void carregar(); }, []);

  const adicionar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult<Nota>>('salvarNota', { texto });
      if (r.ok) { setTexto(''); await carregar(); }
      else message.error(r.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const apagar = async (id: string) => {
    const r = await callServer<ServerResult>('deletarNota', id);
    if (r.ok) await carregar();
    else message.error(r.error || 'Erro ao apagar');
  };

  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#2A2724', marginBottom: 4 }}>
        <StickyNote size={18} /> Notas
      </h2>
      <p style={{ color: '#8a8580', fontSize: 13, marginBottom: 20 }}>
        CRUD de demonstração — cada nota vira um documento em <code>usuarios/&#123;você&#125;/Notas</code>.
        Apague esta view e construa seu app.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPressEnter={() => { if (texto.trim()) void adicionar(); }}
          placeholder="Escreva uma nota e aperte Enter…"
        />
        <Button type="primary" icon={<Plus size={15} />} loading={salvando}
          disabled={!texto.trim()} onClick={adicionar}>Adicionar</Button>
      </div>
      {notas.length === 0 ? (
        <p style={{ color: '#b5b0aa', fontSize: 13 }}>Nenhuma nota ainda — escreva a primeira acima.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notas.map((n) => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: '#FFFDFA', border: '1px solid #eee5d8', borderRadius: 10,
            }}>
              <span style={{ flex: 1, fontSize: 14, color: '#2A2724' }}>{n.texto}</span>
              <span style={{ fontSize: 11, color: '#b5b0aa', whiteSpace: 'nowrap' }}>
                {new Date(n.criadoEm).toLocaleDateString('pt-BR')}
              </span>
              <Popconfirm title="Apagar esta nota?" okText="Apagar" okButtonProps={{ danger: true }}
                onConfirm={() => void apagar(n.id)}>
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#FAF8F5', padding: 24,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {children}
    </div>
  );
}
