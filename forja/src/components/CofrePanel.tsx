import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select, Alert, Progress, AutoComplete,
} from 'antd';
import {
  Lock, Unlock, Plus, Search, Eye, EyeOff, Copy, Trash2, Edit3, X, Save, Shield, ShieldCheck,
  AlertTriangle, Info, KeyRound, RotateCcw, Clock, ExternalLink, Upload, FolderOpen, ChevronDown, ChevronRight, Folder,
  Paperclip, FileText, Download, FileLock2,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import {
  inicializarCofre, destravarCofre, cifrarSegredo, decifrarSegredo, cifrarArquivo, decifrarArquivo,
} from '../cofreCrypto';

// Limite de upload — base64 trafega via google.script.run; docs pequenos.
const MAX_DOC_BYTES = 10 * 1024 * 1024;

function formatarBytes(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface ItemCofreCifrado {
  id: string;
  label: string;
  categoria: string;
  grupo: string;
  urlRef: string;
  usuario: string;
  iv: string;
  cipher: string;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface CofreDoc {
  id: string;
  label: string;
  grupo: string;
  categoria: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  driveFileId: string;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
}

// Rótulo interno pra itens sem seção (avulsos). Mostrado por último.
const SEM_SECAO = '__avulsos__';

interface CofreConfig {
  salt: string;
  wrappedKey: string;
  wrapIv: string;
  verificador: string;
  totalItens: number;
}

// Slugs estáveis: `categoria` já é texto livre na planilha, então incluir
// opções novas não exige migração e itens antigos continuam intactos.
const CATEGORIAS = [
  'api-key',
  'login',
  'token',
  'env',
  'ssh-key',
  'database',
  'certificate',
  'oauth',
  'webhook',
  'signing-key',
  'recovery-code',
  'wallet-seed',
  'nota',
  'outros',
];
const AUTO_LOCK_MIN = 10; // re-lock após 10min de inatividade

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// Avalia a força da senha-mestra. Retorna 0-100.
function forcaSenha(s: string): { score: number; label: string; cor: string } {
  let p = 0;
  if (s.length >= 8) p += 20;
  if (s.length >= 12) p += 20;
  if (s.length >= 16) p += 20;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p += 15;
  if (/\d/.test(s)) p += 10;
  if (/[^a-zA-Z0-9]/.test(s)) p += 15;
  p = Math.min(100, p);
  if (p < 40) return { score: p, label: 'fraca', cor: '#D87F8C' };
  if (p < 70) return { score: p, label: 'razoável', cor: '#E2A04A' };
  if (p < 90) return { score: p, label: 'boa', cor: '#7B9B7E' };
  return { score: p, label: 'forte', cor: '#7B9B7E' };
}

export default function CofrePanel({ initialFiltro = '' }: { initialFiltro?: string } = {}): React.ReactElement {
  const t = useTokens();
  const { message, modal } = AntApp.useApp();

  // Estado de config / unlock
  const [config, setConfig] = useState<CofreConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [destravando, setDestravando] = useState(false);

  // Itens cifrados (do server) + cache de decifrados
  const [itens, setItens] = useState<ItemCofreCifrado[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [revelados, setRevelados] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState(initialFiltro);

  // Quando aberto via atalho (ex.: card de Conta → "Abrir no Cofre"), já cai
  // filtrado pelo label do segredo associado.
  useEffect(() => { if (initialFiltro) setFiltro(initialFiltro); }, [initialFiltro]);

  // Modal add/edit
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<ItemCofreCifrado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  // Modal de importação em massa (colar JSON ou linhas)
  const [importOpen, setImportOpen] = useState(false);
  const [importTexto, setImportTexto] = useState('');
  const [importCategoria, setImportCategoria] = useState('outros');
  const [importGrupo, setImportGrupo] = useState('');
  const [importando, setImportando] = useState(false);
  const [importProgresso, setImportProgresso] = useState<{ feito: number; total: number } | null>(null);

  // Seções recolhidas (por nome de grupo)
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  const toggleSecao = (g: string) => setRecolhidos((r) => ({ ...r, [g]: !r[g] }));

  // Documentos cifrados (anexos)
  const [docs, setDocs] = useState<CofreDoc[]>([]);
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [docArquivo, setDocArquivo] = useState<File | null>(null);
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [docForm] = Form.useForm();

  // Auto-lock por inatividade
  const ultimaAtividadeRef = useRef<number>(Date.now());

  // Carrega config do server
  const carregarConfig = () => {
    setLoadingConfig(true);
    callServer<ServerResult>('cofreGetConfig')
      .then((r) => { if (r.ok && r.data) setConfig(r.data as CofreConfig); })
      .catch(() => { /* preview */ })
      .finally(() => setLoadingConfig(false));
  };

  useEffect(() => { carregarConfig(); }, []);

  // Auto-lock por inatividade — reseta timer em qualquer click/keypress
  useEffect(() => {
    if (!vaultKey) return;
    const tick = () => {
      const idle = (Date.now() - ultimaAtividadeRef.current) / 60000;
      if (idle >= AUTO_LOCK_MIN) {
        lock();
        message.info(`Cofre travou automaticamente após ${AUTO_LOCK_MIN}min de inatividade.`);
      }
    };
    const interval = setInterval(tick, 30_000);
    const onAct = () => { ultimaAtividadeRef.current = Date.now(); };
    window.addEventListener('click', onAct);
    window.addEventListener('keydown', onAct);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', onAct);
      window.removeEventListener('keydown', onAct);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultKey]);

  // Carrega itens + documentos quando o cofre é destravado
  useEffect(() => {
    if (!vaultKey) { setItens([]); setRevelados({}); setDocs([]); return; }
    setCarregandoItens(true);
    callServer<ServerResult>('cofreList')
      .then((r) => { if (r.ok && r.data) setItens(r.data as ItemCofreCifrado[]); })
      .catch(() => { /* preview */ })
      .finally(() => setCarregandoItens(false));
    callServer<ServerResult>('cofreDocList')
      .then((r) => { if (r.ok && r.data) setDocs(r.data as CofreDoc[]); })
      .catch(() => { /* preview */ });
  }, [vaultKey]);

  const lock = () => {
    setVaultKey(null);
    setRevelados({});
    setSenha('');
  };

  const handleUnlock = async () => {
    if (!config) return;
    if (!senha) { message.warning('Digite sua senha-mestra'); return; }
    setDestravando(true);
    try {
      const isPrimeiraVez = !config.salt;
      if (isPrimeiraVez) {
        if (senha !== senha2) {
          message.error('As senhas não coincidem');
          setDestravando(false); return;
        }
        if (senha.length < 8) {
          message.warning('Use no mínimo 8 caracteres na senha-mestra.');
          setDestravando(false); return;
        }
        // Inicializa cofre
        const { config: cfg, vaultKey: vk } = await inicializarCofre(senha);
        const r = await callServer<ServerResult>('cofreSetConfig', cfg);
        if (!r.ok) throw new Error(r.error || 'Falha ao inicializar');
        setVaultKey(vk);
        setConfig({ ...cfg, totalItens: 0 });
        message.success('Cofre criado e destravado.');
      } else {
        const vk = await destravarCofre(senha, config);
        if (!vk) { message.error('Senha incorreta.'); setDestravando(false); return; }
        setVaultKey(vk);
        message.success('Cofre destravado.');
      }
      setUnlockOpen(false);
      setSenha(''); setSenha2('');
      ultimaAtividadeRef.current = Date.now();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setDestravando(false); }
  };

  const revelar = async (item: ItemCofreCifrado) => {
    if (!vaultKey) return;
    if (revelados[item.id]) {
      const novo = { ...revelados }; delete novo[item.id];
      setRevelados(novo);
      return;
    }
    try {
      const plain = await decifrarSegredo(vaultKey, { iv: item.iv, cipher: item.cipher });
      setRevelados({ ...revelados, [item.id]: plain });
    } catch (e) {
      message.error('Falha ao decifrar — vault key inválida ou item corrompido.');
    }
  };

  const copiar = async (item: ItemCofreCifrado) => {
    if (!vaultKey) return;
    try {
      const plain = revelados[item.id] || await decifrarSegredo(vaultKey, { iv: item.iv, cipher: item.cipher });
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(plain);
        message.success('Copiado — apague depois (browser não limpa automaticamente).');
      }
    } catch {
      message.error('Falha ao copiar');
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    form.resetFields();
    form.setFieldsValue({ categoria: 'api-key' });
    setFormOpen(true);
  };

  const abrirEditar = async (item: ItemCofreCifrado) => {
    if (!vaultKey) return;
    setEditando(item);
    try {
      const plain = await decifrarSegredo(vaultKey, { iv: item.iv, cipher: item.cipher });
      form.setFieldsValue({
        label: item.label,
        categoria: item.categoria,
        grupo: item.grupo || '',
        urlRef: item.urlRef,
        usuario: item.usuario,
        notas: item.notas,
        valor: plain,
      });
      setFormOpen(true);
    } catch {
      message.error('Falha ao decifrar pra edição');
    }
  };

  const salvar = async () => {
    if (!vaultKey) return;
    try {
      const v = await form.validateFields();
      setSalvando(true);
      const cif = await cifrarSegredo(vaultKey, String(v.valor));
      const r = await callServer<ServerResult>('cofreSave', {
        id: editando?.id,
        label: v.label,
        categoria: v.categoria,
        grupo: (v.grupo || '').trim(),
        urlRef: v.urlRef || '',
        usuario: v.usuario || '',
        notas: v.notas || '',
        iv: cif.iv,
        cipher: cif.cipher,
      });
      if (r.ok) {
        message.success(editando ? 'Item atualizado' : 'Item adicionado');
        setFormOpen(false);
        // recarrega lista
        const lr = await callServer<ServerResult>('cofreList');
        if (lr.ok && lr.data) setItens(lr.data as ItemCofreCifrado[]);
      } else { message.error(r.error || 'Erro'); }
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally { setSalvando(false); }
  };

  const deletar = async (id: string) => {
    const r = await callServer<ServerResult>('cofreDelete', id);
    if (r.ok) {
      message.success('Item removido');
      setItens(itens.filter((i) => i.id !== id));
    } else message.error(r.error || 'Erro');
  };

  // ── Documentos cifrados ──
  const abrirNovoDoc = (grupoInicial?: string) => {
    setDocArquivo(null);
    docForm.resetFields();
    docForm.setFieldsValue({ categoria: 'documento', grupo: grupoInicial || '' });
    setDocFormOpen(true);
  };

  const salvarDoc = async () => {
    if (!vaultKey) return;
    if (!docArquivo) { message.warning('Escolha um arquivo pra anexar.'); return; }
    if (docArquivo.size > MAX_DOC_BYTES) { message.error(`Arquivo muito grande (máx. ${formatarBytes(MAX_DOC_BYTES)}).`); return; }
    try {
      const v = await docForm.validateFields();
      setSalvandoDoc(true);
      const buf = await docArquivo.arrayBuffer();
      const cif = await cifrarArquivo(vaultKey, new Uint8Array(buf));
      const r = await callServer<ServerResult>('cofreDocSave', {
        label: v.label,
        grupo: (v.grupo || '').trim(),
        categoria: v.categoria || 'documento',
        nomeArquivo: docArquivo.name,
        mimeType: docArquivo.type || 'application/octet-stream',
        tamanho: docArquivo.size,
        iv: cif.iv,
        cipherB64: cif.cipher,
        notas: v.notas || '',
      });
      if (r.ok) {
        message.success('Documento cifrado e guardado no Drive.');
        setDocFormOpen(false);
        const lr = await callServer<ServerResult>('cofreDocList');
        if (lr.ok && lr.data) setDocs(lr.data as CofreDoc[]);
      } else message.error(r.error || 'Erro');
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally { setSalvandoDoc(false); }
  };

  const baixarDoc = async (doc: CofreDoc) => {
    if (!vaultKey) return;
    setBaixandoId(doc.id);
    try {
      const r = await callServer<ServerResult>('cofreDocGet', doc.id);
      if (!r.ok || !r.data) { message.error(r.error || 'Falha ao buscar o arquivo.'); return; }
      const d = r.data as { iv: string; cipher: string; nomeArquivo: string; mimeType: string };
      const bytes = await decifrarArquivo(vaultKey, { iv: d.iv, cipher: d.cipher });
      const blob = new Blob([bytes as unknown as BlobPart], { type: d.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = d.nomeArquivo || doc.nomeArquivo || 'arquivo';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      message.success('Decifrado e baixado. Apague do computador quando não precisar mais.');
    } catch {
      message.error('Falha ao decifrar — vault key inválida ou arquivo corrompido.');
    } finally { setBaixandoId(null); }
  };

  const deletarDoc = async (id: string) => {
    const r = await callServer<ServerResult>('cofreDocDelete', id);
    if (r.ok) {
      message.success('Documento removido (arquivo enviado à lixeira do Drive).');
      setDocs(docs.filter((d) => d.id !== id));
    } else message.error(r.error || 'Erro');
  };

  // Interpreta o texto colado em itens { label, valor, categoria?, usuario?, urlRef?, notas? }.
  // Aceita: (1) JSON — objeto com `items`/array, ou array direto; (2) linhas
  // `rótulo | valor | categoria` (categoria opcional). Ignora vazios e comentários.
  const parseImport = (texto: string): Array<{ label: string; valor: string; categoria?: string; grupo?: string; usuario?: string; urlRef?: string; notas?: string }> => {
    const bruto = texto.trim();
    if (!bruto) return [];
    // Tenta JSON
    if (bruto.startsWith('{') || bruto.startsWith('[')) {
      try {
        const j = JSON.parse(bruto);
        const arr = Array.isArray(j) ? j : (Array.isArray(j.items) ? j.items : []);
        return arr
          .map((x: Record<string, unknown>) => ({
            label: String(x.label || x.rotulo || x.nome || x.key || '').trim(),
            valor: String(x.valor || x.value || x.segredo || x.secret || '').trim(),
            categoria: x.categoria ? String(x.categoria).trim() : undefined,
            grupo: (x.grupo || x.secao || x.secção || x.section) ? String(x.grupo || x.secao || x.secção || x.section).trim() : undefined,
            usuario: x.usuario ? String(x.usuario).trim() : undefined,
            urlRef: (x.urlRef || x.url) ? String(x.urlRef || x.url).trim() : undefined,
            notas: x.notas ? String(x.notas).trim() : undefined,
          }))
          .filter((x: { label: string; valor: string }) => x.label && x.valor);
      } catch { /* cai pro modo linhas */ }
    }
    // Modo linhas: "rótulo | valor | categoria"  (aceita também = como separador do valor)
    return bruto.split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('#'))
      .map((linha) => {
        const partes = linha.split('|').map((p) => p.trim());
        if (partes.length >= 2) {
          return { label: partes[0], valor: partes[1], categoria: partes[2] || undefined };
        }
        // fallback: "CHAVE=valor"
        const eq = linha.indexOf('=');
        if (eq > 0) return { label: linha.slice(0, eq).trim(), valor: linha.slice(eq + 1).trim() };
        return { label: '', valor: '' };
      })
      .filter((x) => x.label && x.valor);
  };

  const previaImport = useMemo(() => parseImport(importTexto), [importTexto]);

  const importarSegredos = async () => {
    if (!vaultKey) return;
    const itensImp = parseImport(importTexto);
    if (itensImp.length === 0) { message.warning('Nada reconhecido pra importar. Confira o formato.'); return; }
    setImportando(true);
    setImportProgresso({ feito: 0, total: itensImp.length });
    // Upsert por rótulo: reimportar atualiza o item existente em vez de duplicar
    // (também conserta itens antigos gravados sem o prefixo à prova de planilha).
    const idPorLabel = new Map(itens.map((i) => [i.label.trim().toLowerCase(), i.id]));
    let ok = 0; let erros = 0;
    try {
      for (let i = 0; i < itensImp.length; i++) {
        const it = itensImp[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          const cif = await cifrarSegredo(vaultKey, it.valor);
          // eslint-disable-next-line no-await-in-loop
          const r = await callServer<ServerResult>('cofreSave', {
            id: idPorLabel.get(it.label.trim().toLowerCase()),
            label: it.label,
            categoria: it.categoria || importCategoria,
            grupo: (it.grupo || importGrupo || '').trim(),
            urlRef: it.urlRef || '',
            usuario: it.usuario || '',
            notas: it.notas || '',
            iv: cif.iv,
            cipher: cif.cipher,
          });
          if (r.ok) ok++; else erros++;
        } catch { erros++; }
        setImportProgresso({ feito: i + 1, total: itensImp.length });
      }
      const lr = await callServer<ServerResult>('cofreList');
      if (lr.ok && lr.data) setItens(lr.data as ItemCofreCifrado[]);
      if (ok > 0) message.success(`${ok} segredo(s) importado(s) e cifrado(s)${erros ? `, ${erros} com erro` : ''}.`);
      else message.error('Nenhum segredo foi importado.');
      if (erros === 0) { setImportOpen(false); setImportTexto(''); }
    } finally {
      setImportando(false);
      setImportProgresso(null);
    }
  };

  const confirmarReset = () => {
    modal.confirm({
      title: 'Resetar cofre?',
      icon: <AlertTriangle size={18} color="#D87F8C" />,
      content: (
        <div style={{ fontSize: 13 }}>
          <p>Esta ação <strong>apaga tudo</strong>: a senha-mestra, todos os {config?.totalItens || 0} segredos e o estado do cofre.</p>
          <p>Use só se você esqueceu a senha-mestra e está tudo bem perder os dados.</p>
        </div>
      ),
      okText: 'Resetar tudo', okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        const r = await callServer<ServerResult>('cofreReset');
        if (r.ok) {
          message.success('Cofre resetado.');
          lock();
          setConfig(null);
          carregarConfig();
        }
      },
    });
  };

  const filtrados = useMemo(() => {
    if (!filtro.trim()) return itens;
    const q = filtro.toLowerCase();
    return itens.filter((i) =>
      i.label.toLowerCase().indexOf(q) >= 0 ||
      i.categoria.toLowerCase().indexOf(q) >= 0 ||
      (i.grupo || '').toLowerCase().indexOf(q) >= 0 ||
      i.usuario.toLowerCase().indexOf(q) >= 0 ||
      i.notas.toLowerCase().indexOf(q) >= 0,
    );
  }, [itens, filtro]);

  const docsFiltrados = useMemo(() => {
    if (!filtro.trim()) return docs;
    const q = filtro.toLowerCase();
    return docs.filter((d) =>
      d.label.toLowerCase().indexOf(q) >= 0 ||
      d.categoria.toLowerCase().indexOf(q) >= 0 ||
      (d.grupo || '').toLowerCase().indexOf(q) >= 0 ||
      d.nomeArquivo.toLowerCase().indexOf(q) >= 0 ||
      d.notas.toLowerCase().indexOf(q) >= 0,
    );
  }, [docs, filtro]);

  // Agrupa segredos + documentos por seção. Nomeados primeiro (alfabético); avulsos por último.
  const secoes = useMemo(() => {
    const mapItens = new Map<string, ItemCofreCifrado[]>();
    const mapDocs = new Map<string, CofreDoc[]>();
    filtrados.forEach((i) => {
      const g = (i.grupo || '').trim() || SEM_SECAO;
      if (!mapItens.has(g)) mapItens.set(g, []);
      mapItens.get(g)!.push(i);
    });
    docsFiltrados.forEach((d) => {
      const g = (d.grupo || '').trim() || SEM_SECAO;
      if (!mapDocs.has(g)) mapDocs.set(g, []);
      mapDocs.get(g)!.push(d);
    });
    const chaves = new Set<string>([...mapItens.keys(), ...mapDocs.keys()]);
    const nomeados = [...chaves].filter((g) => g !== SEM_SECAO).sort((a, b) => a.localeCompare(b));
    const ordem = [...nomeados];
    if (chaves.has(SEM_SECAO)) ordem.push(SEM_SECAO);
    return ordem.map((g) => ({ nome: g, itens: mapItens.get(g) || [], docs: mapDocs.get(g) || [] }));
  }, [filtrados, docsFiltrados]);

  // Só agrupa visualmente se houver ao menos uma seção nomeada (em segredo ou doc).
  const temSecoes = useMemo(
    () => itens.some((i) => (i.grupo || '').trim()) || docs.some((d) => (d.grupo || '').trim()),
    [itens, docs],
  );

  // Grupos existentes pra sugerir no AutoComplete (form + importação + doc).
  const gruposExistentes = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => { const g = (i.grupo || '').trim(); if (g) s.add(g); });
    docs.forEach((d) => { const g = (d.grupo || '').trim(); if (g) s.add(g); });
    return [...s].sort((a, b) => a.localeCompare(b)).map((g) => ({ value: g }));
  }, [itens, docs]);

  if (loadingConfig) return <Skeleton active paragraph={{ rows: 4 }} style={{ padding: 24 }} />;

  // Estado: cofre não inicializado ainda (primeira vez)
  if (!config || !config.salt) {
    return (
      <div style={{ padding: '28px 24px', maxWidth: 540, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.accents.peach}1f`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Shield size={28} color={t.accents.peach} />
          </div>
          <h2 style={{ fontFamily: FONTS.display, fontSize: 20, color: t.text, margin: '0 0 8px', fontWeight: 500 }}>Crie sua senha-mestra</h2>
          <p style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6, margin: 0 }}>
            O Cofre criptografa tudo no seu navegador antes de salvar.<br />
            O servidor <strong>nunca</strong> vê seus segredos nem essa senha.
          </p>
        </div>

        <Alert
          type="warning"
          showIcon
          icon={<AlertTriangle size={15} />}
          style={{ marginBottom: 18 }}
          message={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}><strong>Sem recuperação.</strong></span>}
          description={<span style={{ fontSize: 12 }}>Se você esquecer, perde tudo. Salve em lugar seguro (gerenciador de senhas físico, papel num cofre).</span>}
        />

        <Form layout="vertical" onFinish={handleUnlock}>
          <Form.Item label="Senha-mestra">
            <Input.Password
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Escolha algo único e memorável"
              autoFocus
              size="large"
            />
            {senha.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <Progress
                  percent={forcaSenha(senha).score}
                  showInfo={false}
                  strokeColor={forcaSenha(senha).cor}
                  size="small"
                />
                <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: forcaSenha(senha).cor }}>
                  Força: {forcaSenha(senha).label}
                </span>
              </div>
            )}
          </Form.Item>
          <Form.Item label="Confirme">
            <Input.Password
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              placeholder="Digite de novo"
              size="large"
              status={senha2 && senha2 !== senha ? 'error' : ''}
            />
          </Form.Item>
          <Button
            type="primary"
            size="large"
            block
            icon={<Shield size={15} />}
            loading={destravando}
            disabled={!senha || senha !== senha2}
            onClick={handleUnlock}
          >
            Criar cofre
          </Button>
        </Form>
      </div>
    );
  }

  // Estado: travado (config existe)
  if (!vaultKey) {
    return (
      <div style={{ padding: '28px 24px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.accents.blue}1f`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Lock size={28} color={t.accents.blue} />
          </div>
          <h2 style={{ fontFamily: FONTS.display, fontSize: 20, color: t.text, margin: '0 0 8px', fontWeight: 500 }}>Cofre travado</h2>
          <p style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6, margin: 0 }}>
            {config.totalItens} {config.totalItens === 1 ? 'item' : 'itens'} guardados. Digite sua senha-mestra pra destravar.
          </p>
        </div>

        <Form layout="vertical" onFinish={handleUnlock}>
          <Form.Item label="Senha-mestra">
            <Input.Password
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoFocus
              size="large"
            />
          </Form.Item>
          <Button
            type="primary"
            size="large"
            block
            icon={<Unlock size={15} />}
            loading={destravando}
            disabled={!senha}
            onClick={handleUnlock}
          >
            Destravar
          </Button>
        </Form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Button type="link" danger icon={<RotateCcw size={13} />} onClick={confirmarReset}>
            Esqueci a senha — resetar tudo
          </Button>
        </div>
      </div>
    );
  }

  // Estado: destravado — lista de segredos
  return (
    <div style={{ padding: '14px 24px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} strokeWidth={1.6} color={t.accents.sage} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Cofre destravado</span>
            <Tooltip title={`Auto-lock em ${AUTO_LOCK_MIN}min de inatividade. Tudo é criptografado no seu browser com AES-256-GCM, chave derivada via PBKDF2 (250k iterações). O servidor nunca vê texto plano.`}>
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          <p style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>
            <Clock size={11} style={{ verticalAlign: 'text-top', marginRight: 4 }} />
            Trava sozinho após {AUTO_LOCK_MIN}min sem atividade.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="Travar cofre agora">
            <Button icon={<Lock size={14} />} onClick={lock}>Travar</Button>
          </Tooltip>
          <Tooltip title="Importar vários segredos de uma vez (colar JSON ou lista)">
            <Button icon={<Upload size={14} />} onClick={() => { setImportTexto(''); setImportOpen(true); }}>Importar</Button>
          </Tooltip>
          <Tooltip title="Anexar um documento sigiloso — cifrado no browser, guardado no seu Drive">
            <Button icon={<Paperclip size={14} />} onClick={() => abrirNovoDoc()}>Anexar doc</Button>
          </Tooltip>
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar</Button>
        </div>
      </div>

      <Input
        prefix={<Search size={13} color={t.textTertiary} />}
        placeholder="Buscar por label, categoria, seção, arquivo…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        allowClear
        style={{ marginBottom: 14 }}
      />

      {carregandoItens ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 && docsFiltrados.length === 0 ? (
        <Empty
          description={
            itens.length === 0 && docs.length === 0
              ? 'Cofre vazio. Adicione sua primeira chave/senha ou anexe um documento.'
              : `Nada combina com "${filtro}"`
          }
        >
          {itens.length === 0 && docs.length === 0 && (
            <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar primeiro item</Button>
          )}
        </Empty>
      ) : !temSecoes ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map((item) => (
            <CofreRow
              key={item.id}
              item={item}
              revelado={revelados[item.id] || null}
              onRevelar={() => revelar(item)}
              onCopiar={() => copiar(item)}
              onEditar={() => abrirEditar(item)}
              onDeletar={() => deletar(item.id)}
            />
          ))}
          {docsFiltrados.map((doc) => (
            <CofreDocRow
              key={doc.id}
              doc={doc}
              baixando={baixandoId === doc.id}
              onBaixar={() => baixarDoc(doc)}
              onDeletar={() => deletarDoc(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {secoes.map((s) => {
            const avulso = s.nome === SEM_SECAO;
            const recolhido = !!recolhidos[s.nome];
            return (
              <div key={s.nome}>
                <button
                  onClick={() => toggleSecao(s.nome)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px 2px 8px', textAlign: 'left', color: t.textSecondary,
                  }}
                >
                  {recolhido ? <ChevronRight size={14} color={t.textTertiary} /> : <ChevronDown size={14} color={t.textTertiary} />}
                  {avulso
                    ? <Folder size={14} color={t.textTertiary} />
                    : <FolderOpen size={14} color={t.accents.peach} />}
                  <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: avulso ? t.textTertiary : t.text }}>
                    {avulso ? 'Avulsos' : s.nome}
                  </span>
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary,
                    background: t.surfaceMuted, borderRadius: 999, padding: '1px 7px',
                  }}>{s.itens.length + s.docs.length}</span>
                  {!avulso && (
                    <Tooltip title={`Anexar documento nesta seção (${s.nome})`}>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); abrirNovoDoc(s.nome); }}
                        style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', color: t.textTertiary }}
                      >
                        <Paperclip size={13} />
                      </span>
                    </Tooltip>
                  )}
                </button>
                {!recolhido && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {s.itens.map((item) => (
                      <CofreRow
                        key={item.id}
                        item={item}
                        revelado={revelados[item.id] || null}
                        onRevelar={() => revelar(item)}
                        onCopiar={() => copiar(item)}
                        onEditar={() => abrirEditar(item)}
                        onDeletar={() => deletar(item.id)}
                      />
                    ))}
                    {s.docs.map((doc) => (
                      <CofreDocRow
                        key={doc.id}
                        doc={doc}
                        baixando={baixandoId === doc.id}
                        onBaixar={() => baixarDoc(doc)}
                        onDeletar={() => deletarDoc(doc.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de adicionar/editar */}
      <Modal
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        title={editando ? `Editar: ${editando.label}` : 'Adicionar segredo'}
        width={580}
        footer={[
          <Button key="cancel" icon={<X size={14} />} onClick={() => setFormOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar}>
            {editando ? 'Atualizar' : 'Salvar criptografado'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: OpenAI API key (pessoal)" autoFocus />
            </Form.Item>
            <Form.Item name="categoria" label="Categoria">
              <Select options={CATEGORIAS.map((c) => ({ value: c, label: c }))} />
            </Form.Item>
          </div>
          <Form.Item
            name="grupo"
            label="Seção (opcional)"
            tooltip="Agrupe chaves por origem — ex.: 'VPS Pulse8 · Hostinger'. Deixe vazio pra ficar em Avulsos."
          >
            <AutoComplete
              options={gruposExistentes}
              placeholder="ex.: VPS Pulse8 · Hostinger"
              allowClear
              filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="valor" label="Segredo (será cifrado no browser)" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.Password placeholder="cole o valor sensível aqui" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="usuario" label="Usuário (opcional)">
              <Input placeholder="login ou email associado" />
            </Form.Item>
            <Form.Item name="urlRef" label="URL de referência (opcional)">
              <Input placeholder="https://…" />
            </Form.Item>
          </div>
          <Form.Item name="notas" label="Notas (não cifrado — não coloque dados sensíveis aqui)">
            <Input.TextArea rows={2} placeholder="Onde foi usado, data de expiração, etc." />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            icon={<KeyRound size={13} />}
            style={{ marginTop: 4 }}
            message={<span style={{ fontSize: 12 }}>Só o campo <strong>Segredo</strong> é criptografado. Label, categoria, usuário, URL e notas ficam em texto plano na planilha.</span>}
          />
        </Form>
      </Modal>

      {/* Modal de importação em massa */}
      <Modal
        open={importOpen}
        onCancel={() => { if (!importando) setImportOpen(false); }}
        title="Importar segredos"
        width={640}
        maskClosable={!importando}
        footer={[
          <Button key="cancel" icon={<X size={14} />} disabled={importando} onClick={() => setImportOpen(false)}>Cancelar</Button>,
          <Button key="imp" type="primary" icon={<Upload size={14} />} loading={importando} disabled={previaImport.length === 0} onClick={importarSegredos}>
            {previaImport.length > 0 ? `Importar e cifrar ${previaImport.length}` : 'Importar'}
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          icon={<Shield size={14} />}
          style={{ marginBottom: 14 }}
          message={<span style={{ fontSize: 12.5 }}>Cole aqui e o valor é <strong>cifrado no seu navegador</strong> antes de sair. Depois de importar, <strong>apague o texto de onde copiou</strong> (não deixe chaves soltas em arquivo).</span>}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>Categoria padrão:</span>
          <Select
            size="small"
            value={importCategoria}
            onChange={setImportCategoria}
            style={{ minWidth: 140 }}
            options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
          />
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>Seção:</span>
          <AutoComplete
            size="small"
            value={importGrupo}
            onChange={setImportGrupo}
            options={gruposExistentes}
            style={{ minWidth: 200 }}
            allowClear
            placeholder="ex.: VPS Pulse8 · Hostinger"
            filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </div>

        <Input.TextArea
          rows={8}
          value={importTexto}
          onChange={(e) => setImportTexto(e.target.value)}
          placeholder={'Cole em um dos formatos:\n\n# 1) Uma linha por segredo:  rótulo | valor | categoria\nLITELLM_MASTER_KEY | sk-BFZV… | api-key\nSSH root VPS | Lbsf… | ssh-key\n\n# 2) ou CHAVE=valor\nPROXY_TRABALHO_API_KEY=ck_a11c3…\n\n# 3) ou JSON: {"items":[{"label":"…","valor":"…","categoria":"api-key"}]}'}
          style={{ fontFamily: FONTS.mono, fontSize: 12 }}
        />

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: previaImport.length > 0 ? t.accents.sage : t.textTertiary }}>
            {importTexto.trim()
              ? (previaImport.length > 0 ? `${previaImport.length} segredo(s) reconhecido(s).` : 'Nada reconhecido — confira o formato.')
              : 'Aguardando texto…'}
          </span>
          {importProgresso && (
            <span style={{ minWidth: 160, flex: 1, maxWidth: 260 }}>
              <Progress percent={Math.round((importProgresso.feito / importProgresso.total) * 100)} size="small" showInfo={false} strokeColor={t.accents.sage} />
            </span>
          )}
        </div>
      </Modal>

      {/* Modal de anexar documento cifrado */}
      <Modal
        open={docFormOpen}
        onCancel={() => { if (!salvandoDoc) setDocFormOpen(false); }}
        title="Anexar documento sigiloso"
        width={560}
        maskClosable={!salvandoDoc}
        footer={[
          <Button key="c" icon={<X size={14} />} disabled={salvandoDoc} onClick={() => setDocFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<FileLock2 size={14} />} loading={salvandoDoc} disabled={!docArquivo} onClick={salvarDoc}>
            Cifrar e guardar
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          icon={<Shield size={14} />}
          style={{ marginBottom: 14 }}
          message={(
            <span style={{ fontSize: 12.5 }}>
              O arquivo é <strong>cifrado no seu navegador</strong> e sobe pro seu Google Drive já embaralhado
              (pasta <em>“Forja — Cofre (arquivos cifrados)”</em>). Pra abrir depois, precisa da senha-mestra do Cofre —
              acesso ao Drive sozinho não basta.
            </span>
          )}
        />
        <Form form={docForm} layout="vertical" requiredMark={false}>
          <Form.Item label="Arquivo" required>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
                border: `1px dashed ${docArquivo ? t.accents.sage : t.border}`, borderRadius: 10,
                background: t.surfaceMuted,
              }}
            >
              <FileText size={18} color={docArquivo ? t.accents.sage : t.textTertiary} />
              <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: docArquivo ? t.text : t.textTertiary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {docArquivo ? `${docArquivo.name} · ${formatarBytes(docArquivo.size)}` : `Clique pra escolher (máx. ${formatarBytes(MAX_DOC_BYTES)})`}
              </span>
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setDocArquivo(f);
                  if (f && !docForm.getFieldValue('label')) docForm.setFieldsValue({ label: f.name.replace(/\.[^.]+$/, '') });
                }}
              />
            </label>
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="label" label="Rótulo" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: Contrato VPS / Nota fiscal / Backup config" />
            </Form.Item>
            <Form.Item name="categoria" label="Categoria">
              <Select options={['documento', 'contrato', 'nota-fiscal', 'certificado', 'backup', 'imagem', 'outros'].map((c) => ({ value: c, label: c }))} />
            </Form.Item>
          </div>
          <Form.Item name="grupo" label="Seção (opcional)" tooltip="Guarde o documento junto das chaves da mesma origem.">
            <AutoComplete
              options={gruposExistentes}
              placeholder="ex.: VPS Pulse8 · Hostinger"
              allowClear
              filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="notas" label="Notas (não cifrado)">
            <Input.TextArea rows={2} placeholder="O que é este arquivo, validade, etc." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub: linha de documento cifrado ────────────────────────────────────────
function CofreDocRow({
  doc, baixando, onBaixar, onDeletar,
}: {
  doc: CofreDoc;
  baixando: boolean;
  onBaixar: () => void;
  onDeletar: () => void;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${t.accents.blue}1a`, color: t.accents.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileLock2 size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doc.label}
          </span>
          {doc.categoria && <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 10 }}>{doc.categoria}</Tag>}
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>cifrado</span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textTertiary, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
          {doc.nomeArquivo}{doc.tamanho ? ` · ${formatarBytes(doc.tamanho)}` : ''}
        </div>
        {doc.notas && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.notas}</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Tooltip title="Baixar e decifrar">
          <Button type="text" size="small" loading={baixando} icon={<Download size={14} />} onClick={onBaixar} />
        </Tooltip>
        <Popconfirm title="Remover documento?" description="O arquivo cifrado vai pra lixeira do Drive." onConfirm={onDeletar} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Tooltip title="Remover">
            <Button type="text" size="small" icon={<Trash2 size={14} />} danger />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}

// ─── Sub: linha do cofre ────────────────────────────────────────────────────
function CofreRow({
  item, revelado, onRevelar, onCopiar, onEditar, onDeletar,
}: {
  item: ItemCofreCifrado;
  revelado: string | null;
  onRevelar: () => void;
  onCopiar: () => void;
  onEditar: () => void;
  onDeletar: () => void;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${t.accents.peach}1a`, color: t.accents.peach, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <KeyRound size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 14, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </span>
          {item.categoria && <Tag color="purple" style={{ marginInlineEnd: 0, fontSize: 10 }}>{item.categoria}</Tag>}
          {item.usuario && <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary }}>{item.usuario}</span>}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: revelado ? t.text : t.textTertiary, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
          {revelado || '••••••••••••••••'}
        </div>
        {item.notas && <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.notas}</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Tooltip title={revelado ? 'Esconder' : 'Mostrar'}>
          <Button type="text" size="small" icon={revelado ? <EyeOff size={14} /> : <Eye size={14} />} onClick={onRevelar} />
        </Tooltip>
        <Tooltip title="Copiar (clipboard não é limpo automaticamente)">
          <Button type="text" size="small" icon={<Copy size={14} />} onClick={onCopiar} />
        </Tooltip>
        {item.urlRef && (
          <Tooltip title="Abrir URL">
            <Button type="text" size="small" icon={<ExternalLink size={14} />} href={item.urlRef} target="_blank" rel="noopener noreferrer" />
          </Tooltip>
        )}
        <Tooltip title="Editar">
          <Button type="text" size="small" icon={<Edit3 size={14} />} onClick={onEditar} />
        </Tooltip>
        <Popconfirm title="Remover este item?" onConfirm={onDeletar} okText="Remover" cancelText="Cancelar">
          <Tooltip title="Remover">
            <Button type="text" size="small" icon={<Trash2 size={14} />} danger />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}
