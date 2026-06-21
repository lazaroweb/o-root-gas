import React, { useEffect, useState } from 'react';
import { Button, Input, Spin, Empty, Tag, Tooltip, Popconfirm, App as AntApp } from 'antd';
import { Gauge, Lightbulb, Link2, Compass, ArrowUpRight, ClipboardList, Trash2, Send } from 'lucide-react';
import { Panel, copyText } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import ClienteSnapshotDrawer from '../components/ClienteSnapshotDrawer';
import type { DiscoveryForm, DiscoveryResposta, ServerResponse } from '../types';

function fmtDataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RadarOportunidades(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();

  const [forms, setForms] = useState<DiscoveryForm[]>([]);
  const [respostas, setRespostas] = useState<DiscoveryResposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [promovendoId, setPromovendoId] = useState<string | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ id: string; nome: string } | null>(null);

  const [publicUrl, setPublicUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [salvandoUrl, setSalvandoUrl] = useState(false);

  const carregar = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<DiscoveryForm[]>>('getDiscoveryForms').catch(() => ({ ok: false } as ServerResponse<DiscoveryForm[]>)),
      callServer<ServerResponse<DiscoveryResposta[]>>('getRespostasDiscovery').catch(() => ({ ok: false } as ServerResponse<DiscoveryResposta[]>)),
    ]).then(([rf, rr]) => {
      if (rf.ok && rf.data) setForms(rf.data);
      if (rr.ok && rr.data) setRespostas([...rr.data].sort((a, b) => (b.score || 0) - (a.score || 0)));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
    callServer<ServerResponse<{ url: string }>>('getDiscoveryPublicUrl')
      .then((r) => { if (r.ok && r.data) { setPublicUrl(r.data.url || ''); setUrlInput(r.data.url || ''); } })
      .catch(() => undefined);
  }, []);

  const salvarPublicUrl = async () => {
    setSalvandoUrl(true);
    try {
      const res = await callServer<ServerResponse<{ url: string }>>('setDiscoveryPublicUrl', { url: urlInput.trim() });
      if (res.ok && res.data) { setPublicUrl(res.data.url || ''); setEditandoUrl(false); message.success('App público configurado'); carregar(); }
      else message.error(res.error || 'URL inválida');
    } catch { message.error('Erro ao salvar URL'); }
    finally { setSalvandoUrl(false); }
  };

  const promoverResposta = async (id: string) => {
    setPromovendoId(id);
    try {
      const res = await callServer<ServerResponse<unknown>>('promoverRespostaDiscoveryParaIdeia', { id });
      if (res.ok) message.success('Ideia criada no banco de ideias');
      else message.error(res.error || 'Falha ao promover');
    } catch { message.error('Erro ao promover'); }
    finally { setPromovendoId(null); }
  };

  const copiarLink = async (f: DiscoveryForm) => {
    if (!f.url) { message.warning('Sem link ainda — configure o app público abaixo'); return; }
    const ok = await copyText(f.url);
    message[ok ? 'success' : 'error'](ok ? 'Link copiado' : 'Não foi possível copiar');
  };

  const publicar = async (f: DiscoveryForm) => {
    setPublicandoId(f.id);
    try {
      const res = await callServer<ServerResponse<{ url: string }>>('publicarFormDiscovery', { id: f.id });
      if (res.ok && res.data) {
        if (res.data.url) { const ok = await copyText(res.data.url); message.success(ok ? 'Publicado — link copiado' : 'Publicado'); }
        else message.warning('Publicado. Configure o app público para gerar o link.');
        carregar();
      } else message.error(res.error || 'Falha ao publicar');
    } catch { message.error('Erro ao publicar'); }
    finally { setPublicandoId(null); }
  };

  const removerForm = async (id: string) => {
    try {
      const res = await callServer<ServerResponse<unknown>>('excluirFormDiscovery', id);
      if (res.ok) { message.success('Discovery removido'); carregar(); }
      else message.error(res.error || 'Erro ao remover');
    } catch { message.error('Erro ao remover'); }
  };

  const abrirCliente = (pessoaId: string, nome: string) => setAlvo({ id: pessoaId, nome });

  return (
    <div style={{ display: 'grid', gap: 20, animation: 'forjaFadeIn 0.3s ease' }}>
      {/* Config do app público (global) */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Link2 size={17} /> App público de formulários</span>}>
        {(!publicUrl || editandoUrl) ? (
          <div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 8 }}>
              Cole a URL do formulário público (termina em <code>/exec</code>) — depois disso os links dos roteiros publicados passam a funcionar.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://script.google.com/.../exec" style={{ flex: 1, minWidth: 280 }} onPressEnter={salvarPublicUrl} />
              <Button type="primary" loading={salvandoUrl} onClick={salvarPublicUrl}>Salvar</Button>
              {publicUrl && <Button onClick={() => { setEditandoUrl(false); setUrlInput(publicUrl); }}>Cancelar</Button>}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link2 size={13} /> Configurado: <code style={{ color: t.textSecondary }}>{publicUrl}</code>
            <Button size="small" type="link" onClick={() => setEditandoUrl(true)} style={{ padding: 0, height: 'auto' }}>alterar</Button>
          </div>
        )}
      </Panel>

      {/* Oportunidades (respostas por score) */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Gauge size={17} /> Oportunidades por score</span>}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : respostas.length === 0 ? (
          <Empty description="Nenhuma resposta de discovery ainda. Abra um cliente em Contatos → aba Discovery para gerar e publicar um formulário." />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {respostas.map((r) => {
              const cor = r.score >= 70 ? t.accents.sage : r.score >= 40 ? t.accents.peach : t.accents.rose;
              return (
                <div key={r.id} style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, background: t.surface, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, color: cor }}>{r.score}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text }}>
                      {r.pessoaNome || r.nome || r.emailRespondente || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      {r.nome && r.pessoaNome && r.nome !== r.pessoaNome && <span style={{ fontSize: 12, color: t.textSecondary }}>resp.: {r.nome}</span>}
                      {r.emailRespondente && <span style={{ fontSize: 12, color: t.textTertiary, fontFamily: FONTS.mono }}>{r.emailRespondente}</span>}
                      {r.querAmostra && <Tag bordered={false} style={{ borderRadius: 999, background: `${t.accents.sage}22`, color: t.accents.sage }}>Quer amostra</Tag>}
                      {r.agendaPref && <span style={{ fontSize: 12, color: t.textSecondary }}>· {r.agendaPref}</span>}
                      {r.criadoEm && <span style={{ fontSize: 11.5, color: t.textTertiary, fontFamily: FONTS.mono }}>· {fmtDataHora(r.criadoEm)}</span>}
                    </div>
                    {r.ferramentas && r.ferramentas.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.ferramentas.map((ferr, i) => (
                          <Tag key={i} bordered={false} style={{ borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{ferr}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.pessoaId && (
                      <Button icon={<ArrowUpRight size={15} />} onClick={() => abrirCliente(r.pessoaId, r.pessoaNome || r.nome || 'Cliente')}>
                        Abrir cliente
                      </Button>
                    )}
                    <Button type="primary" ghost icon={<Lightbulb size={15} />} loading={promovendoId === r.id} onClick={() => promoverResposta(r.id)}>
                      Promover a ideia
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Todos os discoveries criados (gerenciar / apagar) */}
      <Panel title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={17} /> Discoveries criados
          {forms.length > 0 && <Tag bordered={false} style={{ borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{forms.length}</Tag>}
        </span>
      )}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '24px auto' }} />
        ) : forms.length === 0 ? (
          <Empty description="Nenhum discovery criado ainda." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {forms.map((f) => {
              const nPerg = (f.blocos || []).reduce((s, b) => s + ((b.perguntas || []).length), 0);
              const publicado = f.status === 'publicado';
              return (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', border: `1px solid ${t.border}`, borderRadius: 12, background: t.surface }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text }}>{f.pessoaNome || '—'}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <Tag bordered={false} style={{ borderRadius: 999, background: publicado ? `${t.accents.sage}22` : `${t.textTertiary}1f`, color: publicado ? t.accents.sage : t.textTertiary }}>
                        {publicado ? 'Publicado' : 'Rascunho'}
                      </Tag>
                      <span style={{ fontSize: 12, color: t.textTertiary }}>{nPerg} perguntas</span>
                      {f.respostasCount > 0 && (
                        <Tag bordered={false} style={{ borderRadius: 999, background: `${t.accents.blue}1f`, color: t.accents.blue }}>
                          {f.respostasCount} resposta{f.respostasCount > 1 ? 's' : ''}
                        </Tag>
                      )}
                      {f.segmento && <span style={{ fontSize: 12, color: t.textTertiary }}>· {f.segmento}</span>}
                      {f.criadoEm && <span style={{ fontSize: 11.5, color: t.textTertiary, fontFamily: FONTS.mono }}>· criado em {fmtDataHora(f.criadoEm)}</span>}
                      {publicado && f.publicadoEm && <span style={{ fontSize: 11.5, color: t.accents.sage, fontFamily: FONTS.mono }}>· publicado em {fmtDataHora(f.publicadoEm)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="small" icon={<Send size={14} />} loading={publicandoId === f.id} onClick={() => publicar(f)}>
                      {publicado ? 'Republicar' : 'Publicar'}
                    </Button>
                    <Tooltip title={f.url || 'Configure o app público acima para gerar o link'}>
                      <Button size="small" icon={<Link2 size={14} />} disabled={!f.url} onClick={() => copiarLink(f)}>Link</Button>
                    </Tooltip>
                    <Button size="small" icon={<Compass size={14} />} onClick={() => abrirCliente(f.pessoaId, f.pessoaNome || 'Cliente')}>Abrir</Button>
                    <Popconfirm title="Remover este discovery?" description="Apaga o roteiro/formulário. As respostas já recebidas continuam guardadas." onConfirm={() => removerForm(f.id)} okText="Remover" cancelText="Cancelar">
                      <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <ClienteSnapshotDrawer
        pessoaId={alvo?.id || null}
        pessoaNome={alvo?.nome}
        initialTab="discovery"
        onClose={() => { setAlvo(null); carregar(); }}
      />
    </div>
  );
}
