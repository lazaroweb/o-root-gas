import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Form, Spin, Empty, Tag, Popconfirm, Tooltip, Drawer, App as AntApp } from 'antd';
import { Sparkles, Plus, Wand2, Trash2, Lightbulb, MessageSquareText, FileText, Save, Link2, Copy, Check, Send, ClipboardList, Gauge, Eye, FileDown, Mail, CalendarClock, Wrench } from 'lucide-react';
import { Panel, CopyBlock, copyText } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { gerarEbaixarPdf } from '../pdf-client';
import type { Pessoa, Entrevista, AnaliseEntrevista, DiscoveryForm, DiscoveryResposta, ServerResponse } from '../types';

const TIPO_OPTIONS = [
  { value: 'Discovery', label: 'Discovery' },
  { value: 'Validação', label: 'Validação' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Feedback', label: 'Feedback' },
];

function fmtDataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Estrutura uma pergunta do roteiro (que após publicada vira objeto com id/texto).
interface PerguntaEstruturada { id: string; texto: string; tipo?: string }
function blocosComPerguntas(form?: DiscoveryForm | null): Array<{ tema: string; perguntas: PerguntaEstruturada[] }> {
  if (!form) return [];
  return (form.blocos || []).map((b, bi) => ({
    tema: b.tema || `Bloco ${bi + 1}`,
    perguntas: ((b.perguntas || []) as unknown[]).map((p, pi) => {
      const obj = (p && typeof p === 'object') ? p as Record<string, unknown> : null;
      return {
        id: obj && obj['id'] ? String(obj['id']) : `b${bi}q${pi}`,
        texto: obj ? String(obj['texto'] || '') : String(p || ''),
        tipo: obj ? String(obj['tipo'] || 'texto') : 'texto',
      };
    }).filter((p) => p.texto),
  })).filter((b) => b.perguntas.length);
}

function fmtResposta(v: unknown): string {
  if (v == null || String(v).trim() === '') return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(' · ');
  return String(v);
}

function Lista({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }): React.ReactElement | null {
  const t = useTokens();
  if (!itens || !itens.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: cor, marginBottom: 6 }}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 13.5, lineHeight: 1.7 }}>
        {itens.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

export default function Discovery({ pessoaId, pessoaNome }: { pessoaId?: string; pessoaNome?: string } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const embedded = !!pessoaId;
  const soDoCliente = <T extends { pessoaId: string }>(arr: T[]): T[] => pessoaId ? arr.filter((x) => x.pessoaId === pessoaId) : arr;

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);

  // perguntas de discovery
  const [segmento, setSegmento] = useState('');
  const [gerandoPerguntas, setGerandoPerguntas] = useState(false);
  const [blocos, setBlocos] = useState<Array<{ tema?: string; perguntas?: string[] }>>([]);
  const [roteiroPessoaId, setRoteiroPessoaId] = useState<string | undefined>(undefined);
  const [salvandoRoteiro, setSalvandoRoteiro] = useState(false);

  // roteiros salvos + respostas do formulário público
  const [forms, setForms] = useState<DiscoveryForm[]>([]);
  const [respostas, setRespostas] = useState<DiscoveryResposta[]>([]);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [promovendoId, setPromovendoId] = useState<string | null>(null);
  const [respostaAberta, setRespostaAberta] = useState<DiscoveryResposta | null>(null);

  // config do app público (URL /exec)
  const [publicUrl, setPublicUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [salvandoUrl, setSalvandoUrl] = useState(false);

  // registrar entrevista
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  // análise inline
  const [analisandoId, setAnalisandoId] = useState<string | null>(null);
  const [analises, setAnalises] = useState<Record<string, AnaliseEntrevista>>({});
  const [criandoIdeiaId, setCriandoIdeiaId] = useState<string | null>(null);

  const carregar = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Pessoa[]>>('getPessoas').catch(() => ({ ok: false } as ServerResponse<Pessoa[]>)),
      callServer<ServerResponse<Entrevista[]>>('getEntrevistas').catch(() => ({ ok: false } as ServerResponse<Entrevista[]>)),
      callServer<ServerResponse<DiscoveryForm[]>>('getDiscoveryForms').catch(() => ({ ok: false } as ServerResponse<DiscoveryForm[]>)),
      callServer<ServerResponse<DiscoveryResposta[]>>('getRespostasDiscovery').catch(() => ({ ok: false } as ServerResponse<DiscoveryResposta[]>)),
    ]).then(([rp, re, rf, rr]) => {
      if (rp.ok && rp.data) setPessoas(rp.data);
      if (re.ok && re.data) {
        const list = soDoCliente(re.data);
        setEntrevistas(list);
        const pre: Record<string, AnaliseEntrevista> = {};
        list.forEach((e) => { if (e.analise) pre[e.id] = e.analise; });
        setAnalises(pre);
      }
      if (rf.ok && rf.data) setForms(soDoCliente(rf.data));
      if (rr.ok && rr.data) setRespostas(soDoCliente(rr.data));
    }).finally(() => setLoading(false));
  };

  const recarregarForms = () => {
    Promise.all([
      callServer<ServerResponse<DiscoveryForm[]>>('getDiscoveryForms').catch(() => ({ ok: false } as ServerResponse<DiscoveryForm[]>)),
      callServer<ServerResponse<DiscoveryResposta[]>>('getRespostasDiscovery').catch(() => ({ ok: false } as ServerResponse<DiscoveryResposta[]>)),
    ]).then(([rf, rr]) => {
      if (rf.ok && rf.data) setForms(soDoCliente(rf.data));
      if (rr.ok && rr.data) setRespostas(soDoCliente(rr.data));
    });
  };

  useEffect(() => {
    callServer<ServerResponse<{ url: string }>>('getDiscoveryPublicUrl')
      .then((r) => { if (r.ok && r.data) { setPublicUrl(r.data.url || ''); setUrlInput(r.data.url || ''); } })
      .catch(() => undefined);
  }, []);

  const salvarPublicUrl = async () => {
    setSalvandoUrl(true);
    try {
      const res = await callServer<ServerResponse<{ url: string }>>('setDiscoveryPublicUrl', { url: urlInput.trim() });
      if (res.ok && res.data) {
        setPublicUrl(res.data.url || '');
        setEditandoUrl(false);
        message.success('App público configurado');
        recarregarForms();
      } else message.error(res.error || 'URL inválida');
    } catch { message.error('Erro ao salvar URL'); }
    finally { setSalvandoUrl(false); }
  };

  useEffect(() => { carregar(); }, [pessoaId]);

  // Em modo per-cliente, pré-preenche o contexto do roteiro com o nome do cliente.
  useEffect(() => {
    if (embedded && pessoaNome) setSegmento((s) => s || pessoaNome);
  }, [embedded, pessoaNome]);

  const nomeCliente = (id: string) => pessoas.find((p) => p.id === id)?.nome || '—';

  const gerarPerguntas = async () => {
    setGerandoPerguntas(true);
    setBlocos([]);
    try {
      const res = await callServer<ServerResponse<{ blocos: Array<{ tema?: string; perguntas?: string[] }> }>>(
        'gerarPerguntasDiscovery', { segmento },
      );
      if (res.ok && res.data) setBlocos(res.data.blocos || []);
      else message.error(res.error || 'Falha ao gerar perguntas');
    } catch { message.error('Erro ao gerar perguntas'); }
    finally { setGerandoPerguntas(false); }
  };

  const copiarRoteiro = async () => {
    const txt = blocos.map((b) => `## ${b.tema || ''}\n` + (b.perguntas || []).map((p) => `- ${p}`).join('\n')).join('\n\n');
    const ok = await copyText(txt);
    message[ok ? 'success' : 'error'](ok ? 'Roteiro copiado' : 'Não foi possível copiar');
  };

  const salvarRoteiro = async () => {
    const alvo = pessoaId || roteiroPessoaId;
    if (!alvo) { message.warning('Escolha o cliente para salvar este roteiro'); return; }
    if (!blocos.length) { message.warning('Gere o roteiro primeiro'); return; }
    setSalvandoRoteiro(true);
    try {
      const res = await callServer<ServerResponse<unknown>>('salvarRoteiroDiscovery', {
        pessoaId: alvo, segmento, blocos,
      });
      if (res.ok) { message.success('Roteiro salvo no cliente'); recarregarForms(); }
      else message.error(res.error || 'Falha ao salvar roteiro');
    } catch { message.error('Erro ao salvar roteiro'); }
    finally { setSalvandoRoteiro(false); }
  };

  const publicar = async (f: DiscoveryForm) => {
    setPublicandoId(f.id);
    try {
      const res = await callServer<ServerResponse<{ token: string; url: string; configurado: boolean }>>('publicarFormDiscovery', { id: f.id });
      if (res.ok && res.data) {
        if (res.data.url) {
          const ok = await copyText(res.data.url);
          message.success(ok ? 'Formulário publicado — link copiado' : 'Formulário publicado');
        } else {
          message.warning('Publicado, mas o app público ainda não está configurado (Leva 2). Token gerado.');
        }
        recarregarForms();
      } else message.error(res.error || 'Falha ao publicar');
    } catch { message.error('Erro ao publicar'); }
    finally { setPublicandoId(null); }
  };

  const copiarLink = async (f: DiscoveryForm) => {
    if (!f.url) { message.warning('Sem link ainda — publique e configure o app público (Leva 2)'); return; }
    const ok = await copyText(f.url);
    if (ok) { setCopiadoId(f.id); setTimeout(() => setCopiadoId(null), 1600); }
    message[ok ? 'success' : 'error'](ok ? 'Link copiado' : 'Não foi possível copiar');
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

  const removerForm = async (id: string) => {
    try {
      const res = await callServer<ServerResponse<unknown>>('excluirFormDiscovery', id);
      if (res.ok) { message.success('Roteiro removido'); recarregarForms(); }
      else message.error(res.error || 'Erro ao remover');
    } catch { message.error('Erro ao remover'); }
  };

  const salvarEntrevista = async (values: { pessoaId?: string; data: string; tipo: string; transcricao: string }) => {
    setSalvando(true);
    try {
      const payload = pessoaId ? { ...values, pessoaId } : values;
      const res = await callServer<ServerResponse<Entrevista>>('createEntrevista', payload);
      if (res.ok) { message.success('Entrevista registrada'); form.resetFields(); carregar(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar entrevista'); }
    finally { setSalvando(false); }
  };

  const analisar = async (e: Entrevista) => {
    setAnalisandoId(e.id);
    try {
      const res = await callServer<ServerResponse<AnaliseEntrevista>>('analisarEntrevista', { id: e.id });
      if (res.ok && res.data) { setAnalises((prev) => ({ ...prev, [e.id]: res.data as AnaliseEntrevista })); message.success('Análise concluída'); }
      else message.error(res.error || 'Falha na análise');
    } catch { message.error('Erro ao analisar'); }
    finally { setAnalisandoId(null); }
  };

  const gerarIdeia = async (e: Entrevista) => {
    setCriandoIdeiaId(e.id);
    try {
      const res = await callServer<ServerResponse<unknown>>('criarIdeiaDeEntrevista', { id: e.id });
      if (res.ok) message.success('Ideia criada no banco de ideias');
      else message.error(res.error || 'Falha ao criar ideia');
    } catch { message.error('Erro ao criar ideia'); }
    finally { setCriandoIdeiaId(null); }
  };

  const remover = async (id: string) => {
    try {
      const res = await callServer<ServerResponse<unknown>>('deleteEntrevista', id);
      if (res.ok) { message.success('Entrevista removida'); carregar(); }
      else message.error(res.error || 'Erro ao remover');
    } catch { message.error('Erro ao remover'); }
  };

  const clienteOptions = pessoas.map((p) => ({ value: p.id, label: p.nome + (p.papel ? ` · ${p.papel}` : '') }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, animation: 'forjaFadeIn 0.3s ease' }}>
      {/* Roteiro de perguntas com IA */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} /> Roteiro de perguntas</span>}>
        <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0 }}>
          Descreva o segmento ou contexto do cliente e a IA monta um roteiro de discovery por temas.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Input
            value={segmento}
            onChange={(ev) => setSegmento(ev.target.value)}
            placeholder="Ex.: clínica odontológica que quer agendar online"
            style={{ flex: 1, minWidth: 260 }}
            onPressEnter={gerarPerguntas}
          />
          <Button type="primary" icon={<Wand2 size={16} />} loading={gerandoPerguntas} onClick={gerarPerguntas}>
            Gerar roteiro
          </Button>
        </div>

        {gerandoPerguntas && <Spin style={{ display: 'block', margin: '24px auto' }} />}

        {blocos.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{
              display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'flex-end', marginBottom: 12, padding: '10px 12px',
              borderRadius: 12, background: t.surfaceMuted, border: `1px solid ${t.border}`,
            }}>
              <span style={{ marginRight: 'auto', fontSize: 13, color: t.textSecondary }}>
                {embedded ? `Salvar este roteiro em ${pessoaNome || 'este cliente'}:` : 'Vincule este roteiro a um cliente para não perdê-lo:'}
              </span>
              {!embedded && (
                <Select
                  value={roteiroPessoaId}
                  onChange={setRoteiroPessoaId}
                  options={pessoas.map((p) => ({ value: p.id, label: p.nome }))}
                  placeholder={pessoas.length ? 'Escolha o cliente' : 'Cadastre um cliente primeiro'}
                  showSearch
                  optionFilterProp="label"
                  style={{ minWidth: 220 }}
                />
              )}
              <Button size="small" onClick={copiarRoteiro}>Copiar</Button>
              <Button type="primary" size="small" icon={<Save size={15} />} loading={salvandoRoteiro} onClick={salvarRoteiro}>
                {embedded ? `Salvar em ${pessoaNome || 'este cliente'}` : 'Salvar no cliente'}
              </Button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {blocos.map((b, i) => (
                <div key={i} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', background: t.surfaceMuted }}>
                  <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>{b.tema || `Bloco ${i + 1}`}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 13.5, lineHeight: 1.7 }}>
                    {(b.perguntas || []).map((p, j) => <li key={j}>{p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* Roteiros salvos — sempre visível em modo embutido para ficar claro o que tem aqui */}
      {(embedded || forms.length > 0) && (
        <Panel title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={17} />
            {embedded ? `Discoveries deste cliente` : 'Roteiros salvos'}
            <Tag bordered={false} style={{ borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{forms.length}</Tag>
          </span>
        )}>
          {(!publicUrl || editandoUrl) ? (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}55` }}>
              <div style={{ fontSize: 13, color: t.text, marginBottom: 8 }}>
                <strong>Conecte o app público.</strong> Cole a URL do formulário (termina em <code>/exec</code>) — depois disso o botão <em>Link</em> funciona.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://script.google.com/.../exec" style={{ flex: 1, minWidth: 280 }} onPressEnter={salvarPublicUrl} />
                <Button type="primary" loading={salvandoUrl} onClick={salvarPublicUrl}>Salvar</Button>
                {publicUrl && <Button onClick={() => { setEditandoUrl(false); setUrlInput(publicUrl); }}>Cancelar</Button>}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14, fontSize: 12.5, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link2 size={13} /> App público: <code style={{ color: t.textSecondary }}>{publicUrl}</code>
              <Button size="small" type="link" onClick={() => setEditandoUrl(true)} style={{ padding: 0, height: 'auto' }}>alterar</Button>
            </div>
          )}
          {forms.length === 0 ? (
            <Empty
              description={(
                <span style={{ color: t.textSecondary }}>
                  Nenhum discovery salvo aqui ainda. Gere um roteiro acima e clique em <strong>Salvar em {pessoaNome || 'este cliente'}</strong>.
                </span>
              )}
              imageStyle={{ height: 56 }}
            />
          ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {forms.map((f) => {
              const nPerg = (f.blocos || []).reduce((s, b) => s + ((b.perguntas || []).length), 0);
              const publicado = f.status === 'publicado';
              return (
                <div key={f.id} style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, background: t.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text }}>
                        {embedded ? (f.titulo || 'Roteiro') : (f.pessoaNome || '—')}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
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
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="small" icon={<Send size={14} />} loading={publicandoId === f.id} onClick={() => publicar(f)}>
                        {publicado ? 'Republicar' : 'Publicar'}
                      </Button>
                      <Tooltip title={f.url ? f.url : 'Publique e configure o app público (Leva 2) para gerar o link'}>
                        <Button size="small" icon={copiadoId === f.id ? <Check size={14} /> : <Link2 size={14} />} disabled={!f.url} onClick={() => copiarLink(f)}>
                          Link
                        </Button>
                      </Tooltip>
                      <Popconfirm title="Remover roteiro?" onConfirm={() => removerForm(f.id)} okText="Remover" cancelText="Cancelar">
                        <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </div>
                  </div>
                  {(f.criadoEm || f.publicadoEm) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${t.borderSoft}`, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: t.textTertiary, fontFamily: FONTS.mono }}>
                      {f.criadoEm && <span>criado em {fmtDataHora(f.criadoEm)}</span>}
                      {publicado && f.publicadoEm && <span>publicado em {fmtDataHora(f.publicadoEm)}</span>}
                    </div>
                  )}
                  {!f.publicoConfigurado && publicado && (
                    <div style={{ marginTop: 10, fontSize: 12, color: t.accents.peach }}>
                      App público ainda não configurado — o link fica disponível depois da Leva 2.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </Panel>
      )}

      {/* Respostas recebidas do formulário público */}
      {(embedded || respostas.length > 0) && (
        <Panel title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Gauge size={17} /> Respostas recebidas
            <Tag bordered={false} style={{ borderRadius: 999, background: t.surfaceMuted, color: t.textSecondary }}>{respostas.length}</Tag>
          </span>
        )}>
          {respostas.length === 0 ? (
            <Empty
              description={(
                <span style={{ color: t.textSecondary }}>
                  Nenhuma resposta ainda. Publique um discovery acima e compartilhe o link.
                </span>
              )}
              imageStyle={{ height: 56 }}
            />
          ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {respostas.map((r) => {
              const cor = r.score >= 70 ? t.accents.sage : r.score >= 40 ? t.accents.peach : t.accents.rose;
              return (
                <div
                  key={r.id}
                  onClick={() => setRespostaAberta(r)}
                  style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, background: t.surface, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${cor}88`; e.currentTarget.style.boxShadow = t.shadowSoft; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, color: cor }}>{r.score}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text }}>
                      {r.nome || r.pessoaNome || r.emailRespondente || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    <Button icon={<Eye size={15} />} onClick={() => setRespostaAberta(r)}>
                      Ver respostas
                    </Button>
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
      )}

      {/* Registrar entrevista */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Plus size={17} /> Registrar entrevista</span>}>
        <Form form={form} layout="vertical" onFinish={salvarEntrevista} initialValues={{ tipo: 'Discovery', data: new Date().toISOString().slice(0, 10) }}>
          <div style={{ display: 'grid', gridTemplateColumns: embedded ? '1fr 1fr' : '2fr 1fr 1fr', gap: 14 }}>
            {!embedded && (
              <Form.Item name="pessoaId" label="Cliente" rules={[{ required: true, message: 'Selecione o cliente' }]}>
                <Select
                  options={clienteOptions}
                  placeholder={clienteOptions.length ? 'Selecione' : 'Cadastre um cliente primeiro'}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            )}
            <Form.Item name="data" label="Data"><Input type="date" /></Form.Item>
            <Form.Item name="tipo" label="Tipo"><Select options={TIPO_OPTIONS} /></Form.Item>
          </div>
          <Form.Item name="transcricao" label="Transcrição / Notas" rules={[{ required: true, message: 'Cole a transcrição ou suas anotações' }]}>
            <Input.TextArea rows={6} placeholder="Cole aqui a transcrição da conversa ou suas anotações da entrevista..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" loading={salvando} icon={<Plus size={16} />}>Salvar entrevista</Button>
          </div>
        </Form>
      </Panel>

      {/* Lista de entrevistas */}
      <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MessageSquareText size={17} /> Entrevistas registradas</span>}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : entrevistas.length === 0 ? (
          <Empty description="Nenhuma entrevista registrada ainda" />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {entrevistas.map((e) => {
              const analise = analises[e.id];
              return (
                <div key={e.id} style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, background: t.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>
                        {e.pessoaNome || nomeCliente(e.pessoaId)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Tag bordered={false} style={{ background: `${t.accents.blue}1f`, color: t.accents.blue, borderRadius: 999 }}>{e.tipo}</Tag>
                        <span style={{ fontSize: 12, color: t.textTertiary, fontFamily: FONTS.mono }}>{e.data}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="small" icon={<Sparkles size={14} />} loading={analisandoId === e.id} onClick={() => analisar(e)}>
                        {analise ? 'Reanalisar' : 'Analisar com IA'}
                      </Button>
                      <Popconfirm title="Remover entrevista?" onConfirm={() => remover(e.id)} okText="Remover" cancelText="Cancelar">
                        <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </div>
                  </div>

                  {e.transcricao && (
                    <p style={{ color: t.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap', maxHeight: 88, overflow: 'hidden' }}>
                      {e.transcricao}
                    </p>
                  )}

                  {analise && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${t.border}` }}>
                      {analise.resumo && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <FileText size={16} style={{ color: t.accents.peach, marginTop: 2, flexShrink: 0 }} />
                          <p style={{ margin: 0, color: t.text, fontSize: 14, lineHeight: 1.6 }}>{analise.resumo}</p>
                        </div>
                      )}
                      <Lista titulo="Dores" itens={analise.dores} cor={t.accents.rose} />
                      <Lista titulo="Objetivos" itens={analise.objetivos} cor={t.accents.sage} />
                      <Lista titulo="Requisitos" itens={analise.requisitos} cor={t.accents.blue} />
                      <Lista titulo="Perguntas em aberto" itens={analise.perguntasAbertas} cor={t.textTertiary} />
                      {analise.oportunidade && (
                        <div style={{ marginTop: 14 }}>
                          <CopyBlock label="Oportunidade" text={analise.oportunidade} mono={false} maxHeight={160} />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                        <Button type="primary" ghost icon={<Lightbulb size={15} />} loading={criandoIdeiaId === e.id} onClick={() => gerarIdeia(e)}>
                          Gerar ideia
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <RespostaDrawer
        resposta={respostaAberta}
        form={respostaAberta ? (forms.find((f) => f.id === respostaAberta.formId) || null) : null}
        onClose={() => setRespostaAberta(null)}
        onPromover={promoverResposta}
        promovendo={!!respostaAberta && promovendoId === respostaAberta.id}
      />
    </div>
  );
}

// ─── Drawer: visualizador da resposta de Discovery ────────────────────────────

function RespostaDrawer({ resposta, form, onClose, onPromover, promovendo }: {
  resposta: DiscoveryResposta | null;
  form: DiscoveryForm | null;
  onClose: () => void;
  onPromover: (id: string) => void;
  promovendo: boolean;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [baixando, setBaixando] = useState(false);

  const r = resposta;
  const cor = !r ? t.textTertiary : r.score >= 70 ? t.accents.sage : r.score >= 40 ? t.accents.peach : t.accents.rose;
  const grupos = blocosComPerguntas(form);
  // Ids já cobertos pelos blocos — o resto vira "Outras respostas".
  const idsCobertos = new Set(grupos.flatMap((g) => g.perguntas.map((p) => p.id)));
  const extras = r ? Object.keys(r.respostas || {}).filter((k) => !idsCobertos.has(k) && fmtResposta(r.respostas[k])) : [];

  const exportarPdf = async () => {
    if (!r) return;
    setBaixando(true);
    try {
      await gerarEbaixarPdf('gerarPdfRespostaDiscovery', { id: r.id });
      message.success('PDF gerado');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Falha ao gerar PDF');
    } finally {
      setBaixando(false);
    }
  };

  const Pergunta = ({ texto, valor }: { texto: string; valor: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 3 }}>{texto}</div>
      <div style={{
        fontSize: 13, lineHeight: 1.6, color: valor ? t.textSecondary : t.textTertiary,
        paddingLeft: 11, borderLeft: `2px solid ${valor ? `${cor}66` : t.borderSoft}`, whiteSpace: 'pre-wrap',
      }}>
        {valor || '— sem resposta —'}
      </div>
    </div>
  );

  const MetaItem = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: t.textSecondary }}>
      <span style={{ color: t.textTertiary, display: 'inline-flex' }}>{icon}</span>{children}
    </div>
  );

  return (
    <Drawer
      open={!!r}
      onClose={onClose}
      placement="right"
      width={560}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={16} color={cor} />
          <span>Resposta de Discovery</span>
        </div>
      }
      extra={r && (
        <Button type="primary" icon={<FileDown size={15} />} loading={baixando} onClick={exportarPdf}>
          Exportar PDF
        </Button>
      )}
    >
      {r && (
        <>
          {/* Cabeçalho: nome + score */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', border: `4px solid ${cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: cor }}>{r.score}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text }}>
                {r.nome || r.pessoaNome || r.emailRespondente || '—'}
              </div>
              <div style={{ fontSize: 12.5, color: t.textTertiary, marginTop: 2 }}>
                {form?.titulo || 'Discovery'}{r.pessoaNome && r.pessoaNome !== r.nome ? ` · cliente: ${r.pessoaNome}` : ''}
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, marginBottom: 18 }}>
            {r.emailRespondente && <MetaItem icon={<Mail size={13} />}>{r.emailRespondente}</MetaItem>}
            {r.criadoEm && <MetaItem icon={<CalendarClock size={13} />}>Recebido em {fmtDataHora(r.criadoEm)}</MetaItem>}
            <MetaItem icon={<Lightbulb size={13} />}>
              {r.querAmostra ? 'Quer amostra' : 'Não pediu amostra'}{r.agendaPref ? ` · ${r.agendaPref}` : ''}
            </MetaItem>
            {r.ferramentas && r.ferramentas.length > 0 && (
              <MetaItem icon={<Wrench size={13} />}>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.ferramentas.map((f, i) => (
                    <Tag key={i} bordered={false} style={{ borderRadius: 999, margin: 0, background: t.surface, color: t.textSecondary }}>{f}</Tag>
                  ))}
                </span>
              </MetaItem>
            )}
          </div>

          {/* Respostas por bloco */}
          {grupos.length === 0 && extras.length === 0 ? (
            <Empty description={<span style={{ color: t.textTertiary }}>Sem respostas detalhadas para exibir.</span>} />
          ) : (
            <>
              {grupos.map((g, gi) => (
                <div key={gi} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 10 }}>
                    {g.tema}
                  </div>
                  {g.perguntas.map((p) => (
                    <Pergunta key={p.id} texto={p.texto} valor={fmtResposta(r.respostas[p.id])} />
                  ))}
                </div>
              ))}
              {extras.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 10 }}>
                    Outras respostas
                  </div>
                  {extras.map((k) => (
                    <Pergunta key={k} texto={k} valor={fmtResposta(r.respostas[k])} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${t.borderSoft}` }}>
            <Button type="primary" ghost icon={<Lightbulb size={15} />} loading={promovendo} onClick={() => onPromover(r.id)}>
              Promover a ideia
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
