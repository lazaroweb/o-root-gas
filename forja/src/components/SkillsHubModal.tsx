import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal, Button, Input, Tag, App as AntApp, Empty, Spin, Tooltip, Drawer, Upload,
  Popconfirm, Tabs, Form, Skeleton, Segmented,
} from 'antd';
import {
  BookMarked, Plus, Upload as UploadIcon, Copy, Trash2, Download, Search, Tag as TagIcon,
  ExternalLink, Sparkles, Eye, FileText, Save, X, FolderOpen, CheckCircle2, Info, Languages,
} from 'lucide-react';
import ModeloBadge from './ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import { GAS_APP_KIT_SKILLS } from '../data/gasAppKitSkills';

interface SkillSummary {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  tags: string[];
  fonte: string;
  tamanhoBytes: number;
  criadoEm: string;
  atualizadoEm: string;
}

interface Traducao { conteudo: string; descricao: string; idioma?: string; em?: string }

interface SkillFull extends SkillSummary {
  conteudo: string;
  parsed: { nome: string; descricao: string; categoria: string; tags: string[]; secoes: string[] };
  traducao?: Traducao | null;
}

interface Props {
  open?: boolean;
  onClose?: () => void;
  // Quando true, renderiza o conteúdo direto (sem o Modal wrapper) — usado
  // pelo Atelier que já tem seu próprio container/tabs.
  embedded?: boolean;
}

function bytesHumano(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// Lê um arquivo .md (ou .txt) como string usando FileReader.
function lerArquivoComoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.readAsText(file, 'utf-8');
  });
}

export default function SkillsHubModal({ open, onClose, embedded = false }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [tab, setTab] = useState<'lista' | 'adicionar'>('lista');
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');

  // Drawer de detalhe
  const [aberta, setAberta] = useState<SkillFull | null>(null);
  const [carregandoAberta, setCarregandoAberta] = useState(false);
  // Tradução pt-BR: por padrão mostra traduzido; cache persistido no servidor
  // (coluna traducaoPt) pra não re-gastar tokens. `verOriginal` mostra o original.
  const [traduzido, setTraduzido] = useState<Traducao | null>(null);
  const [traduzindo, setTraduzindo] = useState(false);
  const [verOriginal, setVerOriginal] = useState(false);

  // Form de adicionar/editar
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [fonte, setFonte] = useState('');
  const [nomeOverride, setNomeOverride] = useState('');
  const [descricaoOverride, setDescricaoOverride] = useState('');
  const [categoriaOverride, setCategoriaOverride] = useState('');
  const [tagsOverride, setTagsOverride] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [importandoKit, setImportandoKit] = useState(false);
  const [preview, setPreview] = useState<{ nome: string; descricao: string; categoria: string; tags: string[]; secoes: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResult>('skillsList')
      .then((r) => { if (r.ok && r.data) setSkills(r.data as SkillSummary[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open || embedded) {
      carregar();
      setTab('lista');
      setFiltro('');
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, embedded]);

  const resetForm = () => {
    setEditandoId(null);
    setConteudo('');
    setFonte('');
    setNomeOverride('');
    setDescricaoOverride('');
    setCategoriaOverride('');
    setTagsOverride('');
    setPreview(null);
  };

  // Faz parse server-side do conteúdo digitado/upload (debounce simples)
  useEffect(() => {
    if (!conteudo.trim()) { setPreview(null); return; }
    setPreviewing(true);
    const timer = setTimeout(() => {
      callServer<ServerResult>('skillsPreviewParse', conteudo)
        .then((r) => { if (r.ok && r.data) setPreview(r.data as typeof preview); })
        .catch(() => { /* sem preview */ })
        .finally(() => setPreviewing(false));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo]);

  const onUploadFile = async (file: File) => {
    try {
      if (file.size > 500 * 1024) {
        message.warning(`Arquivo grande (${bytesHumano(file.size)}). Pode demorar pra salvar.`);
      }
      const texto = await lerArquivoComoTexto(file);
      setConteudo(texto);
      setFonte(file.name);
      message.success(`"${file.name}" carregado — revise o preview e salve.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao ler arquivo');
    }
    return false; // impede upload automático da AntD
  };

  const salvar = async () => {
    if (!conteudo.trim()) { message.warning('Cole o conteúdo da skill ou faça upload de um arquivo .md'); return; }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('skillsSave', {
        id: editandoId || undefined,
        conteudo,
        fonte,
        nomeOverride,
        descricaoOverride,
        categoriaOverride,
        tagsOverride,
      });
      if (r.ok) {
        message.success(editandoId ? 'Skill atualizada.' : 'Skill salva.');
        resetForm();
        setTab('lista');
        carregar();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  // Semeia a biblioteca com as skills do GAS App Kit embarcadas no build.
  // Idempotente: faz upsert por `fonte` (atualiza a existente em vez de duplicar).
  const importarKit = async () => {
    if (GAS_APP_KIT_SKILLS.length === 0) {
      message.warning('Nenhuma skill do GAS App Kit foi embarcada neste build.');
      return;
    }
    setImportandoKit(true);
    const hide = message.loading(`Importando ${GAS_APP_KIT_SKILLS.length} skills do GAS App Kit…`, 0);
    let novas = 0; let atualizadas = 0; let erros = 0;
    try {
      const idPorFonte = new Map(skills.map((s) => [s.fonte, s.id]));
      for (const ks of GAS_APP_KIT_SKILLS) {
        const id = idPorFonte.get(ks.fonte);
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('skillsSave', { id, conteudo: ks.conteudo, fonte: ks.fonte });
        if (r.ok) { if (id) atualizadas++; else novas++; } else { erros++; }
      }
    } catch {
      /* o resumo abaixo reporta o que deu certo */
    } finally {
      hide();
      setImportandoKit(false);
      carregar();
    }
    if (erros && !novas && !atualizadas) {
      message.error('Não foi possível importar as skills do GAS App Kit.');
    } else {
      message.success(`GAS App Kit importado — ${novas} nova(s), ${atualizadas} atualizada(s)${erros ? `, ${erros} com erro` : ''}.`);
    }
  };

  const abrirSkill = async (id: string) => {
    setCarregandoAberta(true);
    setTraduzido(null);
    setVerOriginal(false);
    try {
      const r = await callServer<ServerResult>('skillsGetContent', id);
      if (r.ok && r.data) {
        const full = r.data as SkillFull;
        setAberta(full);
        if (full.traducao && (full.traducao.conteudo || full.traducao.descricao)) {
          // Cache existe → mostra pt-BR na hora, sem gastar token.
          setTraduzido(full.traducao);
        } else {
          // Sem cache → traduz uma vez (fica guardado pras próximas).
          traduzirSkill(id);
        }
      } else {
        message.error(r.error || 'Erro ao carregar');
      }
    } finally { setCarregandoAberta(false); }
  };

  const traduzirSkill = async (idArg?: string) => {
    const id = idArg || aberta?.id;
    if (!id) return;
    setTraduzindo(true);
    try {
      const r = await callServer<ServerResult>('skillsTraduzir', id);
      if (r.ok && r.data) {
        setTraduzido(r.data as Traducao);
        setVerOriginal(false);
      } else {
        message.error(r.error || 'Não consegui traduzir');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao traduzir');
    } finally {
      setTraduzindo(false);
    }
  };

  const editarSkill = (s: SkillFull) => {
    setAberta(null);
    setEditandoId(s.id);
    setConteudo(s.conteudo);
    setFonte(s.fonte);
    setNomeOverride(s.nome);
    setDescricaoOverride(s.descricao);
    setCategoriaOverride(s.categoria);
    setTagsOverride(s.tags.join(', '));
    setTab('adicionar');
  };

  const deletarSkill = async (id: string) => {
    const r = await callServer<ServerResult>('skillsDelete', id);
    if (r.ok) {
      message.success('Skill removida');
      setAberta(null);
      carregar();
    } else message.error(r.error || 'Erro');
  };

  const copiarConteudo = (texto: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(texto);
      message.success('Copiado para a área de transferência');
    }
  };

  const baixarMd = (s: { nome: string; conteudo: string }) => {
    const slug = s.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';
    const blob = new Blob([s.conteudo], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${slug}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtradas = useMemo(() => {
    if (!filtro.trim()) return skills;
    const q = filtro.toLowerCase();
    return skills.filter((s) =>
      s.nome.toLowerCase().indexOf(q) >= 0 ||
      s.descricao.toLowerCase().indexOf(q) >= 0 ||
      s.categoria.toLowerCase().indexOf(q) >= 0 ||
      s.tags.some((tag) => tag.toLowerCase().indexOf(q) >= 0),
    );
  }, [skills, filtro]);

  const tabsEl = (
    <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'lista' | 'adicionar')}
          tabBarStyle={{ paddingLeft: 24, paddingRight: 24, marginBottom: 0 }}
          items={[
            {
              key: 'lista',
              label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FolderOpen size={14} /> Minhas skills {skills.length > 0 && <Tag style={{ marginInlineEnd: 0 }}>{skills.length}</Tag>}</span>,
              children: (
                <div style={{ padding: '14px 24px 24px', minHeight: 380, maxHeight: '70vh', overflow: 'auto' }}>
                  {/* Status do LLM usado nesta seção (tradução das skills) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '8px 12px', borderRadius: 10,
                    background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                    flexWrap: 'wrap',
                  }}>
                    <Languages size={14} color={t.accents.sage} />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                      IA usada para tradução das skills:
                    </span>
                    <ModeloBadge uso="chat" size="medium" />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
                      passe o mouse para latência e status · botão "Testar conexão"
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Input
                      prefix={<Search size={13} color={t.textTertiary} />}
                      placeholder="Filtrar por nome, descrição, categoria ou tag…"
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      allowClear
                      style={{ flex: 1, minWidth: 240 }}
                    />
                    {GAS_APP_KIT_SKILLS.length > 0 && (
                      <Tooltip title={`Adiciona as ${GAS_APP_KIT_SKILLS.length} skills do GAS App Kit à sua biblioteca. Reimportar atualiza, não duplica.`}>
                        <Button icon={<Download size={14} />} loading={importandoKit} onClick={importarKit}>
                          Importar GAS App Kit
                        </Button>
                      </Tooltip>
                    )}
                    <Button type="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setTab('adicionar'); }}>
                      Adicionar skill
                    </Button>
                  </div>

                  {loading && skills.length === 0 ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : filtradas.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <div style={{ fontFamily: FONTS.ui, color: t.textSecondary }}>
                          {skills.length === 0
                            ? 'Sua biblioteca de skills está vazia. Adicione a primeira pra começar.'
                            : `Nenhuma skill combina com "${filtro}"`}
                        </div>
                      }
                    >
                      {skills.length === 0 && (
                        <Button type="primary" icon={<Plus size={14} />} onClick={() => setTab('adicionar')}>
                          Adicionar primeira skill
                        </Button>
                      )}
                    </Empty>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {filtradas.map((s) => (
                        <SkillCard
                          key={s.id}
                          skill={s}
                          onOpen={() => abrirSkill(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'adicionar',
              label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> {editandoId ? 'Editando' : 'Adicionar'}</span>,
              children: (
                <div style={{ padding: '14px 24px 24px', maxHeight: '70vh', overflow: 'auto' }}>
                  {/* Zona de upload */}
                  <Upload.Dragger
                    accept=".md,.markdown,.txt"
                    multiple={false}
                    showUploadList={false}
                    beforeUpload={onUploadFile}
                    style={{ marginBottom: 14, background: t.surfaceMuted }}
                  >
                    <p style={{ margin: 0 }}>
                      <UploadIcon size={28} color={t.accents.lavender} style={{ display: 'inline-block', marginBottom: 6 }} />
                    </p>
                    <p style={{ fontFamily: FONTS.ui, color: t.text, margin: '4px 0', fontSize: 14 }}>
                      Arraste um arquivo <code style={{ fontFamily: FONTS.mono, fontSize: 12 }}>.md</code> aqui ou clique pra escolher
                    </p>
                    <p style={{ fontFamily: FONTS.ui, color: t.textTertiary, fontSize: 12, margin: 0 }}>
                      O nome, descrição e tags são extraídos automaticamente do frontmatter ou do primeiro heading
                    </p>
                  </Upload.Dragger>

                  <div style={{ textAlign: 'center', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, margin: '0 0 14px' }}>
                    ── ou cole o conteúdo abaixo ──
                  </div>

                  <Form layout="vertical">
                    <Form.Item label={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>Conteúdo Markdown {fonte && <Tag style={{ marginLeft: 8, fontSize: 11 }}>{fonte}</Tag>}</span>}>
                      <Input.TextArea
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        placeholder={`---\nname: Revisar PR\ndescription: Checklist de code review\ncategory: review\ntags: [code, quality]\n---\n\n# Como fazer code review\n\n## Passos\n...`}
                        rows={10}
                        style={{ fontFamily: FONTS.mono, fontSize: 12 }}
                      />
                    </Form.Item>

                    {/* Preview do parse */}
                    {(preview || previewing) && (
                      <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Sparkles size={13} color={t.accents.lavender} />
                          <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>Metadados extraídos</span>
                          {previewing && <Spin size="small" />}
                        </div>
                        {preview && (
                          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.7 }}>
                            <div><strong>Nome:</strong> {preview.nome || <em style={{ color: t.textTertiary }}>(não detectado — preencha override abaixo)</em>}</div>
                            <div><strong>Descrição:</strong> {preview.descricao || <em style={{ color: t.textTertiary }}>(vazio)</em>}</div>
                            {preview.categoria && <div><strong>Categoria:</strong> <Tag>{preview.categoria}</Tag></div>}
                            {preview.tags.length > 0 && (
                              <div><strong>Tags:</strong> {preview.tags.map((tg) => <Tag key={tg} icon={<TagIcon size={9} style={{ marginRight: 3 }} />}>{tg}</Tag>)}</div>
                            )}
                            {preview.secoes.length > 0 && (
                              <div><strong>Seções (H2):</strong> {preview.secoes.map((sc) => <Tag key={sc} color="default" style={{ fontWeight: 400 }}>{sc}</Tag>)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overrides */}
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ cursor: 'pointer', fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
                        Sobrescrever metadados (opcional)
                      </summary>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        <Form.Item label="Nome" style={{ marginBottom: 6 }}>
                          <Input value={nomeOverride} onChange={(e) => setNomeOverride(e.target.value)} placeholder={preview?.nome || 'Nome da skill'} />
                        </Form.Item>
                        <Form.Item label="Categoria" style={{ marginBottom: 6 }}>
                          <Input value={categoriaOverride} onChange={(e) => setCategoriaOverride(e.target.value)} placeholder={preview?.categoria || 'ex.: review, infra, prompt'} />
                        </Form.Item>
                        <Form.Item label="Descrição" style={{ marginBottom: 6, gridColumn: '1 / -1' }}>
                          <Input value={descricaoOverride} onChange={(e) => setDescricaoOverride(e.target.value)} placeholder={preview?.descricao || 'Pra que serve essa skill?'} />
                        </Form.Item>
                        <Form.Item label="Tags (separadas por vírgula)" style={{ marginBottom: 6, gridColumn: '1 / -1' }}>
                          <Input value={tagsOverride} onChange={(e) => setTagsOverride(e.target.value)} placeholder={preview?.tags.join(', ') || 'ex.: code, review, claude'} />
                        </Form.Item>
                      </div>
                    </details>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="primary" icon={<Save size={14} />} onClick={salvar} loading={salvando}>
                        {editandoId ? 'Atualizar skill' : 'Salvar skill'}
                      </Button>
                      {editandoId && (
                        <Button icon={<X size={14} />} onClick={() => { resetForm(); setTab('lista'); }}>Cancelar edição</Button>
                      )}
                    </div>
                  </Form>
                </div>
              ),
            },
          ]}
        />
  );

  return (
    <>
      {embedded ? (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {tabsEl}
        </div>
      ) : (
        <Modal
          open={!!open}
          onCancel={onClose}
          footer={null}
          width={920}
          styles={{ body: { padding: 0 } }}
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <BookMarked size={18} strokeWidth={1.6} color={t.accents.lavender} />
              <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Skills</span>
              <Tooltip title="Coleção de prompts, instruções e playbooks reutilizáveis (formato SKILL.md / agent-skill). Tudo fica na sua planilha do Forja — exportável como .md.">
                <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
              </Tooltip>
            </span>
          }
        >
          {tabsEl}
        </Modal>
      )}

      {/* Drawer: detalhe de uma skill */}
      <Drawer
        open={!!aberta || carregandoAberta}
        onClose={() => setAberta(null)}
        width={680}
        title={
          aberta ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color={t.accents.lavender} />
              <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberta.nome}</span>
            </span>
          ) : 'Carregando…'
        }
        extra={
          aberta && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Tooltip title="Copiar conteúdo">
                <Button icon={<Copy size={14} />} onClick={() => copiarConteudo(aberta.conteudo)} />
              </Tooltip>
              <Tooltip title="Baixar como .md">
                <Button icon={<Download size={14} />} onClick={() => baixarMd(aberta)} />
              </Tooltip>
              {traduzido ? (
                <Segmented
                  size="small"
                  value={verOriginal ? 'orig' : 'pt'}
                  onChange={(v) => setVerOriginal(v === 'orig')}
                  options={[
                    { label: 'Português', value: 'pt' },
                    { label: 'Original', value: 'orig' },
                  ]}
                />
              ) : (
                <Tooltip title="Traduzir descrição e conteúdo para português (fica guardado, não gasta token de novo)">
                  <Button
                    icon={<Languages size={14} />}
                    loading={traduzindo}
                    onClick={() => traduzirSkill()}
                  >
                    {traduzindo ? 'Traduzindo…' : 'Traduzir'}
                  </Button>
                </Tooltip>
              )}
              <Button icon={<Sparkles size={14} />} onClick={() => editarSkill(aberta)}>Editar</Button>
              <Popconfirm
                title="Remover essa skill?"
                description="Não dá pra desfazer pelo Forja (mas o registro continua na planilha)."
                onConfirm={() => deletarSkill(aberta.id)}
                okText="Remover" cancelText="Cancelar"
              >
                <Tooltip title="Remover">
                  <Button icon={<Trash2 size={14} />} danger />
                </Tooltip>
              </Popconfirm>
            </div>
          )
        }
      >
        {carregandoAberta && <Skeleton active paragraph={{ rows: 6 }} />}
        {aberta && (
          <>
            {traduzindo && !traduzido && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                background: `${t.accents.blue}1a`, border: `1px solid ${t.accents.blue}40`,
                borderRadius: 999, padding: '3px 10px',
                fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary,
              }}>
                <Spin size="small" />
                Traduzindo para português…
              </div>
            )}
            {traduzido && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
                background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
                borderRadius: 999, padding: '3px 10px',
                fontFamily: FONTS.ui, fontSize: 11, color: t.textSecondary,
              }}>
                <Languages size={11} color={t.accents.sage} />
                {verOriginal ? 'Mostrando o original' : 'Traduzido por IA (guardado) · use "Original" pra ver o texto-fonte'}
              </div>
            )}
            {(traduzido && !verOriginal ? traduzido.descricao : aberta.descricao) && (
              <p style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.65, marginTop: 0 }}>
                {traduzido && !verOriginal ? traduzido.descricao : aberta.descricao}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {aberta.categoria && <Tag color="purple">{aberta.categoria}</Tag>}
              {aberta.tags.map((tag) => <Tag key={tag} icon={<TagIcon size={10} style={{ marginRight: 4 }} />}>{tag}</Tag>)}
              {aberta.fonte && <Tag color="default" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{aberta.fonte}</Tag>}
              <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
                {bytesHumano(aberta.tamanhoBytes)} · {relTempo(aberta.atualizadoEm)}
              </span>
            </div>

            {/* Seções (índice gerado do README) */}
            {aberta.parsed.secoes.length > 0 && (
              <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Eye size={13} color={t.accents.lavender} />
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>O que essa skill cobre</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {aberta.parsed.secoes.map((sc) => (
                    <span
                      key={sc}
                      style={{
                        background: t.surface, color: t.textSecondary,
                        border: `1px solid ${t.border}`, borderRadius: 999,
                        padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 11,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <CheckCircle2 size={10} color={t.accents.sage} />
                      {sc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo bruto */}
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginBottom: 6 }}>
              {traduzido && !verOriginal ? 'Conteúdo Markdown (traduzido)' : 'Conteúdo Markdown'}
            </div>
            <pre
              style={{
                background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
                borderRadius: 10, padding: 14, fontFamily: FONTS.mono,
                fontSize: 12, color: t.text, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 'calc(100vh - 360px)', overflow: 'auto',
              }}
            >
              {traduzido && !verOriginal ? traduzido.conteudo : aberta.conteudo}
            </pre>
          </>
        )}
      </Drawer>
    </>
  );
}

// ─── Sub-componente: card de uma skill na lista ───────────────────────────
function SkillCard({ skill, onOpen }: { skill: SkillSummary; onOpen: () => void }): React.ReactElement {
  const t = useTokens();
  return (
    <div
      onClick={onOpen}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        transition: 'all 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 140,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.accents.lavender;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = `0 4px 14px ${t.shadowSoft || 'rgba(0,0,0,0.05)'}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${t.accents.lavender}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookMarked size={15} color={t.accents.lavender} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {skill.nome || '(sem nome)'}
          </div>
          {skill.categoria && (
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.accents.lavender, marginTop: 2 }}>
              {skill.categoria}
            </div>
          )}
        </div>
      </div>

      {skill.descricao && (
        <p style={{
          margin: 0, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
        }}>
          {skill.descricao}
        </p>
      )}

      {skill.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
          {skill.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              style={{
                background: t.surfaceMuted, color: t.textTertiary,
                fontFamily: FONTS.ui, fontSize: 10,
                padding: '1px 7px', borderRadius: 999,
              }}
            >
              {tag}
            </span>
          ))}
          {skill.tags.length > 4 && <span style={{ fontSize: 10, color: t.textTertiary }}>+{skill.tags.length - 4}</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary }}>
        <span>{bytesHumano(skill.tamanhoBytes)}</span>
        <span>{relTempo(skill.atualizadoEm)}</span>
      </div>
    </div>
  );
}
