import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select, Alert, Progress,
} from 'antd';
import {
  Lock, Unlock, Plus, Search, Eye, EyeOff, Copy, Trash2, Edit3, X, Save, Shield, ShieldCheck,
  AlertTriangle, Info, KeyRound, RotateCcw, Clock, ExternalLink,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';
import {
  inicializarCofre, destravarCofre, cifrarSegredo, decifrarSegredo,
} from '../cofreCrypto';

interface ItemCofreCifrado {
  id: string;
  label: string;
  categoria: string;
  urlRef: string;
  usuario: string;
  iv: string;
  cipher: string;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface CofreConfig {
  salt: string;
  wrappedKey: string;
  wrapIv: string;
  verificador: string;
  totalItens: number;
}

const CATEGORIAS = ['api-key', 'login', 'token', 'env', 'nota', 'outros'];
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

export default function CofrePanel(): React.ReactElement {
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
  const [filtro, setFiltro] = useState('');

  // Modal add/edit
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<ItemCofreCifrado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

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

  // Carrega itens quando o cofre é destravado
  useEffect(() => {
    if (!vaultKey) { setItens([]); setRevelados({}); return; }
    setCarregandoItens(true);
    callServer<ServerResult>('cofreList')
      .then((r) => { if (r.ok && r.data) setItens(r.data as ItemCofreCifrado[]); })
      .catch(() => { /* preview */ })
      .finally(() => setCarregandoItens(false));
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
      i.usuario.toLowerCase().indexOf(q) >= 0 ||
      i.notas.toLowerCase().indexOf(q) >= 0,
    );
  }, [itens, filtro]);

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
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar</Button>
        </div>
      </div>

      <Input
        prefix={<Search size={13} color={t.textTertiary} />}
        placeholder="Buscar por label, categoria, usuário…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        allowClear
        style={{ marginBottom: 14 }}
      />

      {carregandoItens ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtrados.length === 0 ? (
        <Empty
          description={
            itens.length === 0
              ? 'Cofre vazio. Adicione sua primeira chave/senha pra começar.'
              : `Nenhum item combina com "${filtro}"`
          }
        >
          {itens.length === 0 && (
            <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>Adicionar primeiro item</Button>
          )}
        </Empty>
      ) : (
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
