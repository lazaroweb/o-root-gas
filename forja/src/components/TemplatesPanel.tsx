import React, { useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select, Alert,
} from 'antd';
import {
  FileText, Plus, Search, Copy, Trash2, Edit3, X, Save, Info, Sparkles, Download, Variable,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Template {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  conteudo: string;
  variaveis: string[];
  tags: string[];
  criadoEm: string;
  atualizadoEm: string;
}

const CATEGORIAS = [
  'briefing', 'prd', 'contrato', 'lancamento', 'marketing', 'email', 'reuniao', 'review', 'outros',
];

const CORES_CATEGORIA: Record<string, string> = {
  briefing: '#A788C9', prd: '#4A90E2', contrato: '#7B9B7E', lancamento: '#E2A04A',
  marketing: '#D87F8C', email: '#74B7B2', reuniao: '#C97B5C', review: '#3FA679',
  outros: '#999',
};

// Substitui {{var}} pelo valor correspondente em values. Vars sem valor ficam visíveis.
function aplicarVariaveis(conteudo: string, values: Record<string, string>): string {
  return conteudo.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (m, key) => {
    const v = values[key];
    return v !== undefined && v !== '' ? v : m;
  });
}

export default function TemplatesPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [aberto, setAberto] = useState<Template | null>(null);
  const [valoresVars, setValoresVars] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Template | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('templatesList')
      .then((r) => { if (r.ok && r.data) setTemplates(r.data as Template[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  // Reset valores quando abre outro template
  useEffect(() => {
    if (aberto) {
      const init: Record<string, string> = {};
      for (const v of aberto.variaveis) init[v] = '';
      setValoresVars(init);
    }
  }, [aberto]);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'briefing' });
    setFormOpen(true);
  };

  const abrirEditar = (tpl: Template) => {
    setEditando(tpl);
    form.setFieldsValue({ ...tpl, tags: tpl.tags.join(', ') });
    setFormOpen(true);
    setAberto(null);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('templatesSave', { id: editando?.id, ...v });
      if (r.ok) {
        message.success(editando ? 'Template atualizado' : 'Template adicionado');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('templatesDelete', id);
    if (r.ok) { message.success('Removido'); setAberto(null); carregar(); }
  };

  const renderizado = useMemo(() => {
    if (!aberto) return '';
    return aplicarVariaveis(aberto.conteudo, valoresVars);
  }, [aberto, valoresVars]);

  const copiarRenderizado = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(renderizado);
      message.success('Texto renderizado copiado');
    }
  };

  const baixarMd = () => {
    if (!aberto) return;
    const slug = aberto.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'template';
    const blob = new Blob([renderizado], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${slug}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtrados = useMemo(() => {
    let lista = templates;
    if (categoriaFiltro) lista = lista.filter((tpl) => tpl.categoria === categoriaFiltro);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((tpl) =>
        tpl.nome.toLowerCase().indexOf(q) >= 0 ||
        tpl.descricao.toLowerCase().indexOf(q) >= 0 ||
        tpl.conteudo.toLowerCase().indexOf(q) >= 0 ||
        tpl.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0),
      );
    }
    return lista;
  }, [templates, filtro, categoriaFiltro]);

  const todasPreenchidas = aberto ? aberto.variaveis.every((v) => valoresVars[v] && valoresVars[v].trim()) : false;
  const totalVars = aberto?.variaveis.length || 0;
  const preenchidas = aberto ? aberto.variaveis.filter((v) => valoresVars[v] && valoresVars[v].trim()).length : 0;

  return (
    <div style={{ padding: '14px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.6} color={t.accents.lavender} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Templates</span>
            <Tooltip title="Documentos reutilizáveis com placeholders no formato {{variavel}}. Preencha as variáveis quando for usar e copie/baixe o texto pronto. Ótimo pra briefings, PRDs, propostas, emails.">
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          {templates.length > 0 && (
            <p style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>
              <strong>{templates.length}</strong> template{templates.length > 1 ? 's' : ''} · use <code style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{'{{nome}}'}</code> pra placeholders
            </p>
          )}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar template</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por nome, conteúdo, tag…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="Categoria"
          allowClear
          value={categoriaFiltro || undefined}
          onChange={(v) => setCategoriaFiltro(v || '')}
          style={{ minWidth: 160 }}
          options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {loading && templates.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 ? (
        <Empty description={templates.length === 0 ? 'Nenhum template ainda — crie seu primeiro briefing/PRD.' : `Nada combina com "${filtro}"`}>
          {templates.length === 0 && <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar primeiro template</Button>}
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtrados.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} onOpen={() => setAberto(tpl)} />
          ))}
        </div>
      )}

      {/* Drawer: usar template */}
      <Drawer
        open={!!aberto}
        onClose={() => setAberto(null)}
        width={820}
        title={aberto ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CORES_CATEGORIA[aberto.categoria] || '#999' }} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberto.nome}</span>
            {aberto.categoria && <Tag color="purple" style={{ marginInlineEnd: 0 }}>{aberto.categoria}</Tag>}
          </span>
        ) : ''}
        extra={aberto && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip title="Copiar texto renderizado"><Button icon={<Copy size={14} />} onClick={copiarRenderizado}>Copiar</Button></Tooltip>
            <Tooltip title="Baixar como .md"><Button icon={<Download size={14} />} onClick={baixarMd} /></Tooltip>
            <Button icon={<Edit3 size={14} />} onClick={() => abrirEditar(aberto)}>Editar</Button>
            <Popconfirm title="Remover template?" onConfirm={() => deletar(aberto.id)} okText="Remover" cancelText="Cancelar">
              <Tooltip title="Remover"><Button icon={<Trash2 size={14} />} danger /></Tooltip>
            </Popconfirm>
          </div>
        )}
      >
        {aberto && (
          <>
            {aberto.descricao && <p style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, marginTop: 0, marginBottom: 14 }}>{aberto.descricao}</p>}

            {/* Variáveis */}
            {totalVars > 0 ? (
              <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Variable size={14} color={t.accents.lavender} />
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.text }}>Preencha as variáveis</span>
                  <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>{preenchidas}/{totalVars}</Tag>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {aberto.variaveis.map((v) => (
                    <Input
                      key={v}
                      addonBefore={<span style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{`{{${v}}}`}</span>}
                      placeholder={v}
                      value={valoresVars[v] || ''}
                      onChange={(e) => setValoresVars({ ...valoresVars, [v]: e.target.value })}
                      size="small"
                    />
                  ))}
                </div>
                {!todasPreenchidas && (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 8 }}>
                    Vars não preenchidas aparecem como <code style={{ fontFamily: FONTS.mono }}>{'{{nome}}'}</code> no resultado.
                  </div>
                )}
              </div>
            ) : (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 14 }}
                message={<span style={{ fontSize: 12 }}>Este template não tem variáveis ({'{{nome}}'}) — é só copiar.</span>}
              />
            )}

            {/* Resultado renderizado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={13} color={t.accents.peach} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.text }}>Resultado pronto</span>
            </div>
            <pre style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: 16, fontFamily: FONTS.mono,
              fontSize: 12.5, lineHeight: 1.6, color: t.text,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 'calc(100vh - 400px)', overflow: 'auto',
            }}>
              {renderizado}
            </pre>
          </>
        )}
      </Drawer>

      {/* Modal de form */}
      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? `Editar: ${editando.nome}` : 'Adicionar template'}
        width={760}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: Briefing inicial cliente, PRD MVP, Email pós-discovery" autoFocus />
            </Form.Item>
            <Form.Item name="categoria" label="Categoria">
              <Select options={CATEGORIAS.map((c) => ({ value: c, label: c }))} />
            </Form.Item>
          </div>
          <Form.Item name="descricao" label="Descrição (opcional)">
            <Input placeholder="Quando usar este template" />
          </Form.Item>
          <Form.Item
            name="conteudo"
            label={<span>Conteúdo <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, marginLeft: 6 }}>(use {'{{variavel}}'} pra placeholders)</span></span>}
            rules={[{ required: true, message: 'Obrigatório' }]}
          >
            <Input.TextArea rows={12} placeholder={`# Briefing — {{cliente}}\n\nReunião em {{data}} com {{interlocutor}}.\n\n## Objetivo\n{{objetivo}}\n\n## Próximos passos\n- ...`} style={{ fontFamily: FONTS.mono, fontSize: 12.5 }} />
          </Form.Item>
          <Form.Item name="tags" label="Tags (vírgula)">
            <Input placeholder="discovery, mvp, contrato" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message={<span style={{ fontSize: 12 }}>As variáveis <code style={{ fontFamily: FONTS.mono }}>{'{{nome}}'}</code> são detectadas automaticamente ao salvar.</span>}
          />
        </Form>
      </Modal>
    </div>
  );
}

function TemplateCard({ template, onOpen }: { template: Template; onOpen: () => void }): React.ReactElement {
  const t = useTokens();
  const cor = CORES_CATEGORIA[template.categoria] || '#999';
  return (
    <div
      onClick={onOpen}
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: 14, cursor: 'pointer', transition: 'all 0.18s',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 130,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cor}1a`, color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={14} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>
            {template.nome}
          </div>
          {template.categoria && (
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: cor, marginTop: 1 }}>
              {template.categoria}
            </div>
          )}
        </div>
        {template.variaveis.length > 0 && (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} icon={<Variable size={10} style={{ marginRight: 3 }} />}>
            {template.variaveis.length} var{template.variaveis.length > 1 ? 's' : ''}
          </Tag>
        )}
      </div>
      {template.descricao && (
        <p style={{ margin: 0, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
          {template.descricao}
        </p>
      )}
      {template.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
          {template.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{ background: t.surfaceMuted, color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 10, padding: '1px 7px', borderRadius: 999 }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
