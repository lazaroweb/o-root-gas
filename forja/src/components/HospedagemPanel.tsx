import React, { useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select,
} from 'antd';
import {
  Server, Plus, Search, ExternalLink, Sparkles, Tag as TagIcon, Edit3, Trash2, X, Save, Layers, Info,
  CheckCircle2, AlertTriangle, DollarSign, Gift, Target, FileText,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface Provedor {
  id: string;
  nome: string;
  categoria: string;
  urlSite: string;
  freeTier: string;
  precoBase: string;
  beneficios: string;
  limitacoes: string;
  idealPara: string;
  notas: string;
  status: string;
  tags: string[];
  criadoEm: string;
  atualizadoEm: string;
}

const CORES_CATEGORIA: Record<string, string> = {
  hospedagem: '#7B9B7E',
  banco: '#4A90E2',
  auth: '#C97B5C',
  ia: '#A788C9',
  email: '#E2A04A',
  dominio: '#74B7B2',
  monitoring: '#D87F8C',
  pagamento: '#3FA679',
  storage: '#9FA8DA',
  outros: '#999',
};

const ICONES_CATEGORIA: Record<string, React.ReactNode> = {
  hospedagem: <Server size={11} />,
  banco: <Layers size={11} />,
  auth: <CheckCircle2 size={11} />,
  ia: <Sparkles size={11} />,
  email: <FileText size={11} />,
  dominio: <ExternalLink size={11} />,
  monitoring: <AlertTriangle size={11} />,
  pagamento: <DollarSign size={11} />,
  storage: <Layers size={11} />,
  outros: <Layers size={11} />,
};

const CATEGORIAS = [
  'hospedagem', 'banco', 'auth', 'ia', 'email', 'dominio', 'monitoring', 'pagamento', 'storage', 'outros',
];

export default function HospedagemPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [provedores, setProvedores] = useState<Provedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');

  // Drawer de detalhe
  const [aberto, setAberto] = useState<Provedor | null>(null);

  // Modal de adicionar/editar
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Provedor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('provedoresList')
      .then((r) => { if (r.ok && r.data) setProvedores(r.data as Provedor[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ status: 'curado', categoria: 'hospedagem' });
    setFormOpen(true);
  };

  const abrirEditar = (p: Provedor) => {
    setEditando(p);
    form.setFieldsValue({ ...p, tags: p.tags.join(', ') });
    setFormOpen(true);
    setAberto(null);
  };

  const salvar = async () => {
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('provedoresSave', {
        id: editando?.id,
        ...v,
      });
      if (r.ok) {
        message.success(editando ? 'Provedor atualizado' : 'Provedor adicionado');
        setFormOpen(false);
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('provedoresDelete', id);
    if (r.ok) { message.success('Provedor removido'); setAberto(null); carregar(); }
    else message.error(r.error || 'Erro');
  };

  const filtrados = useMemo(() => {
    let lista = provedores;
    if (categoriaFiltro) lista = lista.filter((p) => p.categoria === categoriaFiltro);
    if (filtro.trim()) {
      const q = filtro.toLowerCase();
      lista = lista.filter((p) =>
        p.nome.toLowerCase().indexOf(q) >= 0 ||
        p.beneficios.toLowerCase().indexOf(q) >= 0 ||
        p.idealPara.toLowerCase().indexOf(q) >= 0 ||
        p.tags.some((tg) => tg.toLowerCase().indexOf(q) >= 0),
      );
    }
    return lista;
  }, [provedores, filtro, categoriaFiltro]);

  const agrupados = useMemo(() => {
    const out: Record<string, Provedor[]> = {};
    for (const p of filtrados) {
      if (!out[p.categoria]) out[p.categoria] = [];
      out[p.categoria].push(p);
    }
    return out;
  }, [filtrados]);

  const categoriasComResultado = Object.keys(agrupados).sort();

  return (
    <div style={{ padding: '14px 24px 24px' }}>
      {/* Header da seção */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={18} strokeWidth={1.6} color={t.accents.sage} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Hospedagem & Provedores</span>
            <Tooltip title="Catálogo curado de provedores pra você consultar na hora de publicar um app — hospedagem, banco, auth, IA, email, domínio, pagamento. Tem 18 provedores iniciais; adicione os seus.">
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, margin: '4px 0 0', lineHeight: 1.5 }}>
            {provedores.length > 0 && (
              <>
                <strong>{provedores.length}</strong> opções catalogadas em <strong>{Object.keys(agrupados).length}</strong> categorias.
              </>
            )}
          </p>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar provedor</Button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar por nome, benefícios, tags…"
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

      {loading && provedores.length === 0 ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : filtrados.length === 0 ? (
        <Empty description="Nenhum provedor encontrado com esses filtros." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {categoriasComResultado.map((cat) => (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: CORES_CATEGORIA[cat] || CORES_CATEGORIA.outros }} />
                <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.textSecondary, textTransform: 'capitalize' }}>
                  {cat} <span style={{ color: t.textTertiary, fontWeight: 400 }}>({agrupados[cat].length})</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {agrupados[cat].map((p) => <ProvedorCard key={p.id} provedor={p} onOpen={() => setAberto(p)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer de detalhe */}
      <Drawer
        open={!!aberto}
        onClose={() => setAberto(null)}
        width={640}
        title={aberto ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${CORES_CATEGORIA[aberto.categoria] || CORES_CATEGORIA.outros}1f`,
                color: CORES_CATEGORIA[aberto.categoria] || CORES_CATEGORIA.outros,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {ICONES_CATEGORIA[aberto.categoria] || <Server size={13} />}
            </span>
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{aberto.nome}</span>
            <Tag color="default" style={{ marginLeft: 4, fontSize: 11, textTransform: 'capitalize' }}>{aberto.categoria}</Tag>
          </span>
        ) : ''}
        extra={
          aberto && (
            <div style={{ display: 'flex', gap: 6 }}>
              {aberto.urlSite && (
                <Tooltip title="Abrir site">
                  <Button icon={<ExternalLink size={14} />} href={aberto.urlSite} target="_blank" rel="noopener noreferrer" />
                </Tooltip>
              )}
              <Button icon={<Edit3 size={14} />} onClick={() => abrirEditar(aberto)}>Editar</Button>
              <Popconfirm
                title="Remover este provedor?"
                description="A entrada será apagada da planilha."
                onConfirm={() => deletar(aberto.id)}
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
        {aberto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {aberto.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {aberto.tags.map((tag) => <Tag key={tag} icon={<TagIcon size={10} style={{ marginRight: 4 }} />}>{tag}</Tag>)}
              </div>
            )}

            <DetalheBlock icon={<Gift size={14} />} cor={t.accents.sage} titulo="Free tier" texto={aberto.freeTier || '(não informado)'} />
            <DetalheBlock icon={<DollarSign size={14} />} cor={t.accents.peach} titulo="Preço base" texto={aberto.precoBase || '(não informado)'} />
            <DetalheBlock icon={<CheckCircle2 size={14} />} cor={t.accents.sage} titulo="Benefícios" texto={aberto.beneficios || '(não informado)'} />
            {aberto.limitacoes && <DetalheBlock icon={<AlertTriangle size={14} />} cor={t.accents.rose} titulo="Limitações" texto={aberto.limitacoes} />}
            <DetalheBlock icon={<Target size={14} />} cor={t.accents.blue} titulo="Ideal pra" texto={aberto.idealPara || '(não informado)'} />
            {aberto.notas && <DetalheBlock icon={<FileText size={14} />} cor={t.accents.lavender} titulo="Minhas anotações" texto={aberto.notas} />}

            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 4 }}>
              Status: <strong style={{ textTransform: 'capitalize' }}>{aberto.status || 'curado'}</strong>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal de adicionar/editar */}
      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? `Editar ${editando.nome}` : 'Adicionar provedor'}
        width={680}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Adicionar'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: Vercel, Supabase, Stripe…" />
            </Form.Item>
            <Form.Item name="categoria" label="Categoria" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Select options={CATEGORIAS.map((c) => ({ value: c, label: c }))} />
            </Form.Item>
          </div>
          <Form.Item name="urlSite" label="URL do site">
            <Input placeholder="https://…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="freeTier" label="Free tier">
              <Input placeholder="ex.: 100GB/mês, 5k MAU" />
            </Form.Item>
            <Form.Item name="precoBase" label="Preço base (plano pago)">
              <Input placeholder="ex.: USD 20/mês" />
            </Form.Item>
          </div>
          <Form.Item name="beneficios" label="Benefícios">
            <Input.TextArea rows={2} placeholder="O que o provedor entrega de melhor" />
          </Form.Item>
          <Form.Item name="limitacoes" label="Limitações">
            <Input.TextArea rows={2} placeholder="Limites de quota, lock-in, pegadinhas" />
          </Form.Item>
          <Form.Item name="idealPara" label="Ideal pra">
            <Input.TextArea rows={2} placeholder="Casos de uso onde brilha" />
          </Form.Item>
          <Form.Item name="notas" label="Anotações pessoais">
            <Input.TextArea rows={2} placeholder="Experiência sua, observações, descontos que você conhece…" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="tags" label="Tags (vírgula)">
              <Input placeholder="ex.: frontend, edge, serverless" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: 'curado', label: 'Curado (lista padrão)' },
                  { value: 'usando', label: 'Usando' },
                  { value: 'usei', label: 'Já usei' },
                  { value: 'avaliando', label: 'Avaliando' },
                  { value: 'descartado', label: 'Descartado' },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub: card de provedor ──────────────────────────────────────────────────
function ProvedorCard({ provedor, onOpen }: { provedor: Provedor; onOpen: () => void }): React.ReactElement {
  const t = useTokens();
  const cor = CORES_CATEGORIA[provedor.categoria] || CORES_CATEGORIA.outros;
  return (
    <div
      onClick={onOpen}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 13,
        cursor: 'pointer',
        transition: 'all 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 130,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = cor;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${cor}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cor }}>
          {ICONES_CATEGORIA[provedor.categoria] || <Server size={13} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>
            {provedor.nome}
          </div>
          {provedor.precoBase && (
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, marginTop: 2 }}>
              {provedor.precoBase}
            </div>
          )}
        </div>
        {provedor.status && provedor.status !== 'curado' && (
          <Tag color={provedor.status === 'usando' ? 'green' : provedor.status === 'descartado' ? 'red' : 'default'} style={{ marginInlineEnd: 0, fontSize: 10 }}>
            {provedor.status}
          </Tag>
        )}
      </div>

      {provedor.beneficios && (
        <p style={{
          margin: 0, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
        }}>
          {provedor.beneficios}
        </p>
      )}

      {provedor.freeTier && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, color: t.accents.sage, marginTop: 'auto' }}>
          <Gift size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provedor.freeTier}</span>
        </div>
      )}
    </div>
  );
}

function DetalheBlock({ icon, cor, titulo, texto }: { icon: React.ReactNode; cor: string; titulo: string; texto: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: cor }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600 }}>{titulo}</span>
      </div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {texto}
      </div>
    </div>
  );
}
