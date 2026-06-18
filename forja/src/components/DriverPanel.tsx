import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App as AntApp, Button, Input, Tabs, Tag, Empty, Skeleton, Tooltip,
  Select, Form, Popconfirm, Modal,
} from 'antd';
import {
  HardDrive, Folder, FileText, FileSpreadsheet, FileImage, Presentation,
  ChevronRight, RefreshCw, Search, ExternalLink, Plus, Trash2, Cloud,
  Home, ShieldCheck, Info, Link2, KeyRound, Copy, Unplug, Pencil,
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

// Provedores com OAuth implementado.
const OAUTH_PROVS = ['google-drive', 'onedrive'];

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

  // ─── Contas (carregadas no mount: alimentam o seletor de fonte e a aba) ───
  const [conectores, setConectores] = useState<Connector[]>([]);
  const [contaGoogle, setContaGoogle] = useState('');
  const [credStatus, setCredStatus] = useState<Record<string, boolean>>({});
  const [redirectUri, setRedirectUri] = useState('');
  const [carregandoContas, setCarregandoContas] = useState(false);

  const carregarContas = useCallback(() => {
    setCarregandoContas(true);
    Promise.all([
      callServer<ServerResult>('driveConnectorsList'),
      callServer<ServerResult>('driveInfoConta'),
      callServer<ServerResult>('driveOAuthGetCredenciaisStatus'),
    ])
      .then(([rc, ri, rs]) => {
        if (rc.ok && rc.data) setConectores(rc.data as Connector[]);
        if (ri.ok && ri.data) setContaGoogle((ri.data as { email: string }).email || '');
        if (rs.ok && rs.data) {
          const d = rs.data as { status: Record<string, boolean>; redirectUri: string };
          setCredStatus(d.status || {});
          setRedirectUri(d.redirectUri || '');
        }
      })
      .catch(() => { /* silencioso */ })
      .finally(() => setCarregandoContas(false));
  }, []);

  useEffect(() => { carregarContas(); }, [carregarContas]);

  const conectadas = useMemo(() => conectores.filter((c) => c.status === 'conectada'), [conectores]);

  // ─── Navegador de arquivos (fonte: 'local' ou connectorId) ───────────────
  const [fonteAtiva, setFonteAtiva] = useState<string>('local');
  // Uma trilha (breadcrumb) por fonte → cada aba lembra a pasta onde você estava.
  const [trilhas, setTrilhas] = useState<Record<string, Crumb[]>>({ local: [{ id: 'root', nome: 'Meu Drive' }] });
  // Cache de itens por "fonte::pasta" → alternar entre abas não recarrega.
  const cacheRef = useRef<Record<string, DriveItem[]>>({});
  const [itens, setItens] = useState<DriveItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [erro, setErro] = useState('');

  const trilha = trilhas[fonteAtiva] || [{ id: 'root', nome: 'Meu Drive' }];
  const atual = trilha[trilha.length - 1];

  const setTrilhaAtual = (updater: (prev: Crumb[]) => Crumb[]) => {
    setTrilhas((m) => {
      const prev = m[fonteAtiva] || [{ id: 'root', nome: 'Meu Drive' }];
      return { ...m, [fonteAtiva]: updater(prev) };
    });
  };

  const purgarFonte = (id: string) => {
    setTrilhas((m) => { const n = { ...m }; delete n[id]; return n; });
    Object.keys(cacheRef.current).forEach((k) => { if (k.indexOf(id + '::') === 0) delete cacheRef.current[k]; });
  };

  const listar = useCallback((fonte: string, folderId: string, termo: string, force = false) => {
    const key = `${fonte}::${folderId}`;
    // Busca é sempre ao vivo; navegação normal usa cache (se houver e não for refresh).
    if (!termo && !force && cacheRef.current[key]) {
      setErro('');
      setAuthUrl('');
      setItens(cacheRef.current[key]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    setAuthUrl('');
    const call = fonte === 'local'
      ? callServer<ServerResult>('driveListar', folderId, termo)
      : callServer<ServerResult>('driveListarRemoto', fonte, folderId, termo);
    call
      .then((r) => {
        if (r.ok && r.data) {
          const arr = (r.data as { arquivos: DriveItem[] }).arquivos || [];
          setItens(arr);
          if (!termo) cacheRef.current[key] = arr;
        } else if (r.error === 'NOT_CONNECTED') {
          setErro('Esta conta não está conectada. Vá em "Contas & nuvens" e clique em Conectar.');
          setItens([]);
        } else if (r.error && r.error.indexOf('AUTH_NEEDED::') === 0) {
          setAuthUrl(r.error.split('::')[1] || '');
          setItens([]);
        } else {
          setErro(r.error || 'Erro ao listar arquivos');
          setItens([]);
        }
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (tab === 'arquivos') listar(fonteAtiva, atual.id, busca.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual.id, fonteAtiva, tab]);

  useEffect(() => {
    if (tab !== 'arquivos') return;
    const timer = setTimeout(() => listar(fonteAtiva, atual.id, busca.trim()), 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const trocarFonte = (f: string) => {
    setBusca('');
    // Mantém a trilha já existente da fonte (lembra a pasta); só inicializa se nova.
    setTrilhas((m) => {
      if (m[f]) return m;
      let nome = 'Meu Drive';
      if (f !== 'local') {
        const c = conectores.find((x) => x.id === f);
        nome = c?.rotulo || provedorLabel(c?.provedor || '') || 'Conta';
      }
      return { ...m, [f]: [{ id: 'root', nome }] };
    });
    setFonteAtiva(f);
  };

  const entrarPasta = (item: DriveItem) => {
    if (!item.isFolder) {
      if (item.link) window.open(item.link, '_blank', 'noopener');
      return;
    }
    setBusca('');
    setTrilhaAtual((tr) => [...tr, { id: item.id, nome: item.nome }]);
  };

  const irParaCrumb = (idx: number) => {
    setBusca('');
    setTrilhaAtual((tr) => tr.slice(0, idx + 1));
  };

  // ─── Conexão OAuth ────────────────────────────────────────────────────────
  const [conectandoId, setConectandoId] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const conectar = async (c: Connector) => {
    if (!credStatus[c.provedor]) {
      message.warning('Configure as credenciais OAuth deste provedor primeiro.');
      abrirCredenciais(c.provedor);
      return;
    }
    setConectandoId(c.id);
    try {
      const r = await callServer<ServerResult>('driveOAuthAuthorizeUrl', c.id);
      if (!r.ok) { message.error(r.error || 'Erro ao iniciar autorização'); setConectandoId(''); return; }
      const data = r.data as { authorized?: boolean; url?: string };
      if (data.authorized) { message.success('Conta já conectada!'); setConectandoId(''); carregarContas(); return; }
      window.open(data.url, '_blank', 'width=560,height=680,noopener');
      message.info('Conclua o consentimento na nova janela. Vou verificar automaticamente.');
      let tentativas = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        tentativas += 1;
        callServer<ServerResult>('driveOAuthStatus', c.id).then((s) => {
          const conectada = !!(s.ok && (s.data as { conectada?: boolean })?.conectada);
          if (conectada || tentativas > 40) {
            if (pollRef.current) clearInterval(pollRef.current);
            setConectandoId('');
            if (conectada) { message.success('Conta conectada!'); carregarContas(); }
          }
        });
      }, 3000);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
      setConectandoId('');
    }
  };

  const desconectar = async (c: Connector) => {
    const r = await callServer<ServerResult>('driveOAuthDesconectar', c.id);
    if (r.ok) {
      message.success('Conta desconectada');
      purgarFonte(c.id);
      if (fonteAtiva === c.id) trocarFonte('local');
      carregarContas();
    } else message.error(r.error || 'Erro');
  };

  // ─── Modal: adicionar conta ────────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoConta, setEditandoConta] = useState<Connector | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const abrirNovaConta = () => {
    setEditandoConta(null);
    form.resetFields();
    setModalAberto(true);
  };

  const abrirEditarConta = (c: Connector) => {
    setEditandoConta(c);
    form.setFieldsValue({ provedor: c.provedor, email: c.email, rotulo: c.rotulo, notas: c.notas });
    setModalAberto(true);
  };

  // Auto-preenche o rótulo com a parte do e-mail antes do @, enquanto o usuário
  // não digitou um rótulo próprio.
  const onValoresConta = (changed: Record<string, unknown>) => {
    if ('email' in changed) {
      const email = String(changed.email || '');
      const at = email.indexOf('@');
      const rotuloAtual = String(form.getFieldValue('rotulo') || '');
      if (at > 0 && !rotuloAtual) {
        form.setFieldsValue({ rotulo: email.slice(0, at) });
      }
    }
  };

  const salvarConta = async () => {
    try {
      const vals = await form.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('driveConnectorSave', { ...vals, id: editandoConta?.id });
      if (r.ok) {
        message.success(editandoConta ? 'Conta atualizada.' : 'Conta registrada. Configure as credenciais e clique em Conectar.');
        setModalAberto(false);
        setEditandoConta(null);
        form.resetFields();
        carregarContas();
      } else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  const removerConta = async (id: string) => {
    const r = await callServer<ServerResult>('driveConnectorDelete', id);
    if (r.ok) { message.success('Conta removida'); purgarFonte(id); if (fonteAtiva === id) trocarFonte('local'); carregarContas(); }
    else message.error(r.error || 'Erro');
  };

  // ─── Modal: credenciais OAuth ──────────────────────────────────────────────
  const [credModal, setCredModal] = useState(false);
  const [salvandoCred, setSalvandoCred] = useState(false);
  const [credForm] = Form.useForm();

  const abrirCredenciais = (provedor?: string) => {
    credForm.resetFields();
    credForm.setFieldsValue({ provedor: provedor && OAUTH_PROVS.indexOf(provedor) >= 0 ? provedor : 'google-drive' });
    setCredModal(true);
  };

  const salvarCredenciais = async () => {
    try {
      const vals = await credForm.validateFields();
      setSalvandoCred(true);
      const r = await callServer<ServerResult>('driveOAuthSetCredenciais', vals);
      if (r.ok) { message.success('Credenciais salvas. Agora clique em Conectar na conta.'); setCredModal(false); credForm.resetFields(); carregarContas(); }
      else message.error(r.error || 'Erro ao salvar');
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvandoCred(false); }
  };

  const copiar = (txt: string) => {
    if (navigator.clipboard) { void navigator.clipboard.writeText(txt); message.success('Copiado'); }
  };

  // ─── Render: aba Arquivos ───────────────────────────────────────────────
  const fonteOptions = useMemo(() => ([
    { value: 'local', short: 'Meu Drive', provedor: 'local' },
    ...conectadas.map((c) => ({ value: c.id, short: c.rotulo || provedorLabel(c.provedor), provedor: c.provedor })),
  ]), [conectadas]);

  const renderArquivos = () => (
    <div style={{ padding: '14px 18px 18px' }}>
      {/* Abas de contas (fontes) — alternar é instantâneo (cache por aba) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {fonteOptions.map((o) => {
          const ativo = o.value === fonteAtiva;
          return (
            <button
              key={o.value}
              onClick={() => trocarFonte(o.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: ativo ? 600 : 500,
                border: `1px solid ${ativo ? t.accents.blue : t.borderSoft}`,
                background: ativo ? `${t.accents.blue}14` : 'transparent',
                color: ativo ? t.text : t.textSecondary,
                transition: 'all 0.15s',
              }}
            >
              {o.provedor === 'local'
                ? <HardDrive size={14} color={ativo ? t.accents.blue : t.textTertiary} />
                : <Cloud size={14} color={ativo ? t.accents.blue : t.textTertiary} />}
              {o.short}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1, minWidth: 160 }}>
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
          style={{ width: 200 }}
        />
        <Tooltip title="Atualizar (recarrega esta pasta)">
          <Button icon={<RefreshCw size={14} />} onClick={() => listar(fonteAtiva, atual.id, busca.trim(), true)} />
        </Tooltip>
      </div>

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
      ) : itens.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textSecondary }}>Pasta vazia ou nada encontrado.</span>} />
      ) : (
        <div style={{ border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
          {itens.map((it, i) => (
            <div
              key={it.id + i}
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
                  <Tooltip title="Abrir">
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
          Conecte OneDrive e contas Google extras via <strong style={{ color: t.text }}>OAuth</strong> (consentimento) —
          nunca pedimos senha. Primeiro registre o app OAuth do provedor em <strong style={{ color: t.text }}>Credenciais</strong>,
          depois clique em <strong style={{ color: t.text }}>Conectar</strong> na conta.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button icon={<KeyRound size={14} />} onClick={() => abrirCredenciais()}>Credenciais OAuth</Button>
        {OAUTH_PROVS.map((p) => (
          <Tag key={p} color={credStatus[p] ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
            {provedorLabel(p)}: {credStatus[p] ? 'configurado' : 'pendente'}
          </Tag>
        ))}
      </div>

      {/* Conta principal */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12,
      }}>
        <div style={{
          position: 'relative', width: 36, height: 36, borderRadius: 9,
          background: `${t.accents.sage}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HardDrive size={18} color={t.accents.sage} />
          <span style={{
            position: 'absolute', right: -2, bottom: -2, width: 11, height: 11,
            borderRadius: 999, background: t.accents.sage, border: `2px solid ${t.surface}`,
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>
            Google Drive {contaGoogle && <span style={{ fontWeight: 400, color: t.textSecondary }}>· {contaGoogle}</span>}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>Conta deste app — navegação ativa</div>
        </div>
        <Tag color="green" style={{ marginInlineEnd: 0 }}>conectada</Tag>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Outras contas & nuvens</span>
        <Button type="primary" size="small" icon={<Plus size={13} />} onClick={abrirNovaConta}>
          Adicionar
        </Button>
      </div>

      {carregandoContas && conectores.length === 0 ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : conectores.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: t.textSecondary, fontFamily: FONTS.ui }}>Nenhuma outra conta registrada ainda.</span>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conectores.map((c) => {
            const oauthOk = OAUTH_PROVS.indexOf(c.provedor) >= 0;
            const conectada = c.status === 'conectada';
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{
                  position: 'relative', width: 36, height: 36, borderRadius: 9,
                  background: conectada ? `${t.accents.sage}1f` : t.surfaceMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Cloud size={18} color={conectada ? t.accents.sage : t.textTertiary} />
                  <span style={{
                    position: 'absolute', right: -2, bottom: -2, width: 11, height: 11,
                    borderRadius: 999, background: conectada ? t.accents.sage : t.textTertiary,
                    border: `2px solid ${t.surface}`,
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.rotulo || provedorLabel(c.provedor)}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {provedorLabel(c.provedor)}{c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                <Tag color={conectada ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>{c.status}</Tag>
                <Tooltip title="Editar">
                  <Button size="small" icon={<Pencil size={13} />} onClick={() => abrirEditarConta(c)} />
                </Tooltip>
                {conectada ? (
                  <>
                    <Tooltip title="Ver arquivos">
                      <Button size="small" icon={<Folder size={13} />} onClick={() => { trocarFonte(c.id); setTab('arquivos'); }} />
                    </Tooltip>
                    <Tooltip title="Desconectar">
                      <Button size="small" icon={<Unplug size={13} />} onClick={() => desconectar(c)} />
                    </Tooltip>
                  </>
                ) : oauthOk ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<Link2 size={13} />}
                    loading={conectandoId === c.id}
                    onClick={() => conectar(c)}
                  >
                    Conectar
                  </Button>
                ) : (
                  <Tooltip title="OAuth ainda não disponível para este provedor">
                    <Button size="small" icon={<Link2 size={13} />} disabled>Conectar</Button>
                  </Tooltip>
                )}
                <Popconfirm title="Remover esta conta?" onConfirm={() => removerConta(c.id)} okText="Remover" cancelText="Cancelar">
                  <Button size="small" danger icon={<Trash2 size={13} />} />
                </Popconfirm>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: adicionar conta */}
      <Modal
        open={modalAberto}
        onCancel={() => { setModalAberto(false); setEditandoConta(null); }}
        onOk={salvarConta}
        okText={editandoConta ? 'Salvar alterações' : 'Registrar conta'}
        cancelText="Cancelar"
        confirmLoading={salvando}
        title={editandoConta ? 'Editar conta / nuvem' : 'Adicionar conta / nuvem'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} onValuesChange={onValoresConta}>
          <Form.Item name="provedor" label="Provedor" rules={[{ required: true, message: 'Escolha o provedor' }]}>
            <Select options={PROVEDORES} placeholder="Google Drive, OneDrive…" />
          </Form.Item>
          <Form.Item name="email" label="E-mail da conta">
            <Input placeholder="voce@example.com" />
          </Form.Item>
          <Form.Item name="rotulo" label="Rótulo (apelido)" extra="Vazio = usamos a parte antes do @ do e-mail.">
            <Input placeholder="ex.: lazaroweb, trabalho, cliente-x" />
          </Form.Item>
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} placeholder="Pra que serve essa conta no seu QG" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: credenciais OAuth */}
      <Modal
        open={credModal}
        onCancel={() => setCredModal(false)}
        onOk={salvarCredenciais}
        okText="Salvar credenciais"
        cancelText="Cancelar"
        confirmLoading={salvandoCred}
        title="Credenciais OAuth do provedor"
        width={560}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, marginBottom: 14,
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 12,
        }}>
          <ShieldCheck size={15} color={t.accents.sage} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.6, flex: 1, minWidth: 0 }}>
            Registre um app OAuth no provedor e cole <strong style={{ color: t.text }}>Client ID</strong> e
            <strong style={{ color: t.text }}> Client Secret</strong> aqui. Use esta <strong style={{ color: t.text }}>Redirect URI</strong>:
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <code style={{
                fontFamily: FONTS.mono, fontSize: 11, background: t.surface, color: t.text,
                border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 8px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {redirectUri || '—'}
              </code>
              <Tooltip title="Copiar Redirect URI">
                <Button size="small" icon={<Copy size={12} />} onClick={() => copiar(redirectUri)} disabled={!redirectUri} />
              </Tooltip>
            </div>
          </div>
        </div>
        <Form form={credForm} layout="vertical">
          <Form.Item name="provedor" label="Provedor" rules={[{ required: true }]}>
            <Select options={PROVEDORES.filter((p) => OAUTH_PROVS.indexOf(p.value) >= 0)} />
          </Form.Item>
          <Form.Item name="clientId" label="Client ID" rules={[{ required: true, message: 'Cole o Client ID' }]}>
            <Input placeholder="ex.: 1234-abcd.apps.googleusercontent.com" />
          </Form.Item>
          <Form.Item name="clientSecret" label="Client Secret" rules={[{ required: true, message: 'Cole o Client Secret' }]}>
            <Input.Password placeholder="••••••••••••" />
          </Form.Item>
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
