import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp, Button, Input, Tabs, Tag, Empty, Skeleton, Tooltip,
  Select, Form, Popconfirm, Modal,
} from 'antd';
import {
  HardDrive, Folder, FileText, FileSpreadsheet, FileImage, Presentation,
  ChevronRight, RefreshCw, Search, ExternalLink, Plus, Trash2, Cloud,
  Home, ShieldCheck, Info, Link2,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface DriveItem {
  id: string;
  nome: string;
  mimeType: string;
  isFolder: boolean;
  modificado: string;
  tamanho: number;
  link: string;
}

interface Connector {
  id: string;
  provedor: string;
  email: string;
  rotulo: string;
  status: string;
  pastaRaizId: string;
  notas: string;
  criadoEm: string;
}

interface Crumb { id: string; nome: string }

const PROVEDORES = [
  { value: 'google-drive', label: 'Google Drive (outra conta)' },
  { value: 'onedrive', label: 'OneDrive / Microsoft 365' },
  { value: 'dropbox', label: 'Dropbox' },
  { value: 'icloud', label: 'iCloud Drive' },
  { value: 'outro', label: 'Outro' },
];

function provedorLabel(v: string): string {
  return PROVEDORES.find((p) => p.value === v)?.label || v || 'Conta';
}

function bytesHumano(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function dataHumana(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Ícone por tipo de arquivo do Drive.
function IconePorMime({ item, size = 18 }: { item: DriveItem; size?: number }): React.ReactElement {
  const t = useTokens();
  if (item.isFolder) return <Folder size={size} color={t.accents.blue} strokeWidth={1.7} />;
  const m = item.mimeType;
  if (m.indexOf('spreadsheet') >= 0) return <FileSpreadsheet size={size} color={t.accents.sage} strokeWidth={1.7} />;
  if (m.indexOf('presentation') >= 0) return <Presentation size={size} color={t.accents.peach} strokeWidth={1.7} />;
  if (m.indexOf('image') >= 0) return <FileImage size={size} color={t.accents.lavender} strokeWidth={1.7} />;
  return <FileText size={size} color={t.textTertiary} strokeWidth={1.7} />;
}

export default function DriverPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [tab, setTab] = useState<'arquivos' | 'contas'>('arquivos');

  // ─── Navegador de arquivos ──────────────────────────────────────────────
  const [trilha, setTrilha] = useState<Crumb[]>([{ id: 'root', nome: 'Meu Drive' }]);
  const [itens, setItens] = useState<DriveItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [erro, setErro] = useState('');

  const atual = trilha[trilha.length - 1];

  const listar = useCallback((folderId: string, termo: string) => {
    setCarregando(true);
    setErro('');
    setAuthUrl('');
    callServer<ServerResult>('driveListar', folderId, termo)
      .then((r) => {
        if (r.ok && r.data) {
          setItens((r.data as { arquivos: DriveItem[] }).arquivos || []);
        } else if (r.error && r.error.indexOf('AUTH_NEEDED::') === 0) {
          setAuthUrl(r.error.split('::')[1] || '');
          setItens([]);
        } else {
          setErro(r.error || 'Erro ao listar o Drive');
          setItens([]);
        }
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (tab === 'arquivos') listar(atual.id, busca.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual.id, tab]);

  // Busca com debounce dentro da pasta atual
  useEffect(() => {
    if (tab !== 'arquivos') return;
    const timer = setTimeout(() => listar(atual.id, busca.trim()), 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const entrarPasta = (item: DriveItem) => {
    if (!item.isFolder) {
      if (item.link) window.open(item.link, '_blank', 'noopener');
      return;
    }
    setBusca('');
    setTrilha((tr) => [...tr, { id: item.id, nome: item.nome }]);
  };

  const irParaCrumb = (idx: number) => {
    setBusca('');
    setTrilha((tr) => tr.slice(0, idx + 1));
  };

  // ─── Contas & nuvens ────────────────────────────────────────────────────
  const [conectores, setConectores] = useState<Connector[]>([]);
  const [contaGoogle, setContaGoogle] = useState('');
  const [carregandoContas, setCarregandoContas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregarContas = useCallback(() => {
    setCarregandoContas(true);
    Promise.all([
      callServer<ServerResult>('driveConnectorsList'),
      callServer<ServerResult>('driveInfoConta'),
    ])
      .then(([rc, ri]) => {
        if (rc.ok && rc.data) setConectores(rc.data as Connector[]);
        if (ri.ok && ri.data) setContaGoogle((ri.data as { email: string }).email || '');
      })
      .catch(() => { /* silencioso */ })
      .finally(() => setCarregandoContas(false));
  }, []);

  useEffect(() => {
    if (tab === 'contas') carregarContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const salvarConta = async () => {
    try {
      const vals = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('driveConnectorSave', vals);
      if (r.ok) {
        message.success('Conta registrada. A sincronização via OAuth é o próximo passo.');
        setModalAberto(false);
        form.resetFields();
        carregarContas();
      } else {
        message.error(r.error || 'Erro ao salvar');
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return; // validação do form
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  };

  const removerConta = async (id: string) => {
    const r = await callServer<ServerResult>('driveConnectorDelete', id);
    if (r.ok) { message.success('Conta removida'); carregarContas(); }
    else message.error(r.error || 'Erro');
  };

  const itensFiltrados = useMemo(() => itens, [itens]);

  // ─── Render: aba Arquivos ───────────────────────────────────────────────
  const renderArquivos = () => (
    <div style={{ padding: '14px 18px 18px' }}>
      {/* Trilha + ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1, minWidth: 200 }}>
          {trilha.map((c, i) => (
            <React.Fragment key={c.id + i}>
              {i > 0 && <ChevronRight size={13} color={t.textTertiary} />}
              <button
                onClick={() => irParaCrumb(i)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: FONTS.ui, fontSize: 13,
                  color: i === trilha.length - 1 ? t.text : t.textSecondary,
                  fontWeight: i === trilha.length - 1 ? 600 : 500,
                  padding: '3px 6px', borderRadius: 7,
                }}
              >
                {i === 0 && <Home size={13} />}
                {c.nome}
              </button>
            </React.Fragment>
          ))}
        </div>
        <Input
          prefix={<Search size={13} color={t.textTertiary} />}
          placeholder="Buscar nesta pasta…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        <Tooltip title="Atualizar">
          <Button icon={<RefreshCw size={14} />} onClick={() => listar(atual.id, busca.trim())} />
        </Tooltip>
      </div>

      {/* Autorização necessária */}
      {authUrl ? (
        <div style={{
          background: `${t.accents.peach}14`, border: `1px solid ${t.accents.peach}44`,
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <ShieldCheck size={26} color={t.accents.peach} style={{ marginBottom: 8 }} />
          <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.text, marginBottom: 4 }}>
            Precisa autorizar o acesso de leitura ao seu Drive
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 14 }}>
            É um passo único do Google. Abra o editor, rode/autorize e volte aqui.
          </div>
          <Button type="primary" icon={<ExternalLink size={14} />} onClick={() => window.open(authUrl, '_blank', 'noopener')}>
            Abrir autorização
          </Button>
        </div>
      ) : erro ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textSecondary }}>{erro}</span>} />
      ) : carregando && itens.length === 0 ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : itensFiltrados.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textSecondary }}>Pasta vazia ou nada encontrado.</span>} />
      ) : (
        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
          {itensFiltrados.map((it, i) => (
            <div
              key={it.id}
              onClick={() => entrarPasta(it)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${t.borderSoft}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceMuted; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <IconePorMime item={it} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: FONTS.ui, fontSize: 13.5, color: t.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {it.nome}
                </div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                  {it.isFolder ? 'Pasta' : bytesHumano(it.tamanho)}{it.modificado ? ` · ${dataHumana(it.modificado)}` : ''}
                </div>
              </div>
              {it.isFolder
                ? <ChevronRight size={16} color={t.textTertiary} />
                : it.link && (
                  <Tooltip title="Abrir no Drive">
                    <ExternalLink size={15} color={t.textTertiary} />
                  </Tooltip>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Render: aba Contas & nuvens ────────────────────────────────────────
  const renderContas = () => (
    <div style={{ padding: '16px 18px 18px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: `${t.accents.blue}10`, border: `1px solid ${t.accents.blue}33`,
        borderRadius: 12, padding: 14, marginBottom: 16,
      }}>
        <Info size={16} color={t.accents.blue} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6 }}>
          Centralize aqui suas nuvens. A conta deste app já navega seu Google Drive na aba
          <strong style={{ color: t.text }}> Arquivos</strong>. Para outras contas (OneDrive, outra conta Google),
          registre-as abaixo — a conexão real será via <strong style={{ color: t.text }}>OAuth</strong> (consentimento),
          nunca pedimos senha.
        </div>
      </div>

      {/* Conta principal (este app) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.accents.sage}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HardDrive size={18} color={t.accents.sage} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>
            Google Drive {contaGoogle && <span style={{ fontWeight: 400, color: t.textSecondary }}>· {contaGoogle}</span>}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>Conta deste app — navegação ativa</div>
        </div>
        <Tag color="green" style={{ marginInlineEnd: 0 }}>conectada</Tag>
      </div>

      {/* Conectores registrados */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Outras contas & nuvens</span>
        <Button type="primary" size="small" icon={<Plus size={13} />} onClick={() => { form.resetFields(); setModalAberto(true); }}>
          Adicionar
        </Button>
      </div>

      {carregandoContas && conectores.length === 0 ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : conectores.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: t.textSecondary, fontFamily: FONTS.ui }}>Nenhuma outra conta registrada ainda.</span>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conectores.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.accents.lavender}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cloud size={18} color={t.accents.lavender} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.rotulo || provedorLabel(c.provedor)}
                </div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {provedorLabel(c.provedor)}{c.email ? ` · ${c.email}` : ''}
                </div>
              </div>
              <Tag color={c.status === 'conectada' ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>{c.status}</Tag>
              <Tooltip title="Conectar via OAuth (em breve)">
                <Button size="small" icon={<Link2 size={13} />} disabled>Conectar</Button>
              </Tooltip>
              <Popconfirm title="Remover esta conta?" onConfirm={() => removerConta(c.id)} okText="Remover" cancelText="Cancelar">
                <Button size="small" danger icon={<Trash2 size={13} />} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalAberto}
        onCancel={() => setModalAberto(false)}
        onOk={salvarConta}
        okText="Registrar conta"
        cancelText="Cancelar"
        confirmLoading={salvando}
        title="Adicionar conta / nuvem"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="provedor" label="Provedor" rules={[{ required: true, message: 'Escolha o provedor' }]}>
            <Select options={PROVEDORES} placeholder="Google Drive, OneDrive…" />
          </Form.Item>
          <Form.Item name="email" label="E-mail da conta">
            <Input placeholder="voce@example.com" />
          </Form.Item>
          <Form.Item name="rotulo" label="Rótulo (apelido)">
            <Input placeholder="ex.: Pessoal, Trabalho, Cliente X" />
          </Form.Item>
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} placeholder="Pra que serve essa conta no seu QG" />
          </Form.Item>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <ShieldCheck size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            Guardamos só estes metadados. Nenhuma senha é solicitada — a sincronização usa consentimento OAuth do provedor.
          </div>
        </Form>
      </Modal>
    </div>
  );

  return (
    <Tabs
      activeKey={tab}
      onChange={(k) => setTab(k as 'arquivos' | 'contas')}
      tabBarStyle={{ paddingLeft: 18, paddingRight: 18, marginBottom: 0 }}
      items={[
        {
          key: 'arquivos',
          label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><HardDrive size={14} /> Arquivos</span>,
          children: renderArquivos(),
        },
        {
          key: 'contas',
          label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Cloud size={14} /> Contas & nuvens {conectores.length > 0 && <Tag style={{ marginInlineEnd: 0 }}>{conectores.length}</Tag>}</span>,
          children: renderContas(),
        },
      ]}
    />
  );
}
