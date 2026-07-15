import React, { useEffect, useMemo, useState } from 'react';
import {
  Input, Button, App as AntApp, Tag, Skeleton, Empty, Drawer, Form, Modal, Popconfirm, Tooltip, Select, Segmented, InputNumber,
} from 'antd';
import {
  Server, Plus, Edit3, Trash2, X, Save, ExternalLink, Globe, Terminal, KeyRound, Boxes, Network,
  AlertTriangle, CheckCircle2, Cpu, HardDrive, Layers, DollarSign, Info, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface VpsHost {
  id: string;
  provedor: string;
  nome: string;
  ip: string;
  ipv6: string;
  hostname: string;
  plano: string;
  regiao: string;
  so: string;
  painelUrl: string;
  dominioRaiz: string;
  dominioExpira: string;
  sshUsuario: string;
  sshHost: string;
  sshPorta: string;
  cofreLabel: string;
  status: string;
  custoMensal: string;
  moeda: string;
  notas: string;
  tags: string[];
  ordem: number;
  numServicos: number;
  numPendencias: number;
  criadoEm: string;
  atualizadoEm: string;
}

interface VpsServico {
  id: string;
  vpsHostId: string;
  nome: string;
  imagem: string;
  funcao: string;
  portaInterna: string;
  portaExposta: string;
  dominioPublico: string;
  status: string;
  volume: string;
  dependeDe: string;
  cofreLabel: string;
  notas: string;
  ordem: number;
}

interface VpsPendencia {
  id: string;
  vpsHostId: string;
  servicoId: string;
  tipo: string;
  titulo: string;
  descricao: string;
  severidade: string;
  status: string;
  criadoEm: string;
}

interface PingResultado {
  id: string;
  vpsHostId: string;
  hostNome: string;
  nome: string;
  funcao: string;
  dominioPublico: string;
  online: boolean;
  instavel: boolean;
  statusCode: number;
  ms: number;
  erro: string;
  checadoEm: string;
}

// ─── Metadados visuais ───────────────────────────────────────────────────────

const STATUS_SERVICO: Record<string, { label: string; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  rodando: { label: 'rodando', accent: 'sage' },
  parado: { label: 'parado', accent: 'clay' },
  erro: { label: 'erro', accent: 'rose' },
  reiniciando: { label: 'reiniciando', accent: 'peach' },
};

const STATUS_HOST: Record<string, { label: string; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  ativo: { label: 'ativo', accent: 'sage' },
  pausado: { label: 'pausado', accent: 'clay' },
  desativado: { label: 'desativado', accent: 'rose' },
};

const TIPO_PENDENCIA: Record<string, { label: string; icon: React.ReactNode; accent: keyof ReturnType<typeof useTokens>['accents'] }> = {
  debito: { label: 'Débito técnico', icon: <Layers size={12} />, accent: 'clay' },
  erro: { label: 'Erro conhecido', icon: <AlertTriangle size={12} />, accent: 'rose' },
  proximo: { label: 'Próximo passo', icon: <ArrowRight size={12} />, accent: 'blue' },
};

interface Props {
  onAbrirCofre?: (label?: string) => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function TopologiaPanel({ onAbrirCofre }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [hosts, setHosts] = useState<VpsHost[]>([]);
  const [loading, setLoading] = useState(true);

  // Status ao vivo dos serviços (health-check HTTP)
  const [pings, setPings] = useState<PingResultado[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [jaChecou, setJaChecou] = useState(false);

  // Detalhe (drawer)
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [servicos, setServicos] = useState<VpsServico[]>([]);
  const [pendencias, setPendencias] = useState<VpsPendencia[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Modais
  const [hostFormOpen, setHostFormOpen] = useState(false);
  const [editandoHost, setEditandoHost] = useState<VpsHost | null>(null);
  const [servicoFormOpen, setServicoFormOpen] = useState(false);
  const [editandoServico, setEditandoServico] = useState<VpsServico | null>(null);
  const [pendFormOpen, setPendFormOpen] = useState(false);
  const [editandoPend, setEditandoPend] = useState<VpsPendencia | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [hostForm] = Form.useForm();
  const [servicoForm] = Form.useForm();
  const [pendForm] = Form.useForm();

  const hostAberto = useMemo(() => hosts.find((h) => h.id === abertoId) || null, [hosts, abertoId]);

  // Ping indexado por serviço + saúde agregada por host (pra resumo no card).
  const pingPorServico = useMemo(() => {
    const m: Record<string, PingResultado> = {};
    pings.forEach((p) => { m[p.id] = p; });
    return m;
  }, [pings]);
  const saudePorHost = useMemo(() => {
    const m: Record<string, { online: number; total: number }> = {};
    pings.forEach((p) => {
      if (!m[p.vpsHostId]) m[p.vpsHostId] = { online: 0, total: 0 };
      m[p.vpsHostId].total += 1;
      if (p.online) m[p.vpsHostId].online += 1;
    });
    return m;
  }, [pings]);
  const ultimaChecagem = pings.length > 0 ? pings[0].checadoEm : '';

  // Serviços partidos: com domínio (checados por HTTP) × internos (sem URL).
  const servicosComDominio = useMemo(() => servicos.filter((s) => (s.dominioPublico || '').trim()), [servicos]);
  const servicosInternos = useMemo(() => servicos.filter((s) => !(s.dominioPublico || '').trim()), [servicos]);
  const saudeAberto = hostAberto ? saudePorHost[hostAberto.id] : undefined;
  const onlineCor = saudeAberto && saudeAberto.total > 0
    ? (saudeAberto.online === saudeAberto.total ? t.accents.sage : (saudeAberto.online === 0 ? t.accents.rose : t.accents.clay))
    : t.accents.sage;

  const renderServico = (s: VpsServico) => (
    <ServicoLinha
      key={s.id}
      servico={s}
      ping={pingPorServico[s.id]}
      verificando={verificando}
      onEdit={() => abrirEditarServico(s)}
      onDelete={() => deletarServico(s.id)}
      onAbrirCofre={onAbrirCofre}
    />
  );

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('vpsHostsList')
      .then((r) => { if (r.ok && r.data) setHosts(r.data as VpsHost[]); })
      .catch(() => { /* preview */ })
      .finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const verificarStatus = () => {
    setVerificando(true);
    callServer<ServerResult>('vpsPingServicos')
      .then((r) => { if (r.ok && r.data) setPings(r.data as PingResultado[]); })
      .catch(() => { /* preview */ })
      .finally(() => { setVerificando(false); setJaChecou(true); });
  };
  // Verifica ao entrar, assim que houver serviços com domínio pra checar.
  useEffect(() => {
    if (!jaChecou && !loading && hosts.some((h) => h.numServicos > 0)) verificarStatus();
  }, [loading, hosts, jaChecou]);

  const carregarDetalhe = (id: string) => {
    setCarregandoDetalhe(true);
    callServer<ServerResult>('vpsHostDetalhe', id)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { servicos: VpsServico[]; pendencias: VpsPendencia[] };
          setServicos(d.servicos || []);
          setPendencias(d.pendencias || []);
        }
      })
      .catch(() => { /* preview */ })
      .finally(() => setCarregandoDetalhe(false));
  };

  const abrirDetalhe = (h: VpsHost) => {
    setAbertoId(h.id);
    carregarDetalhe(h.id);
    if (pings.length === 0 && !verificando) verificarStatus();
  };

  // ── VPS host ──
  const abrirNovoHost = () => {
    setEditandoHost(null);
    hostForm.resetFields();
    hostForm.setFieldsValue({ provedor: 'Hostinger', status: 'ativo', moeda: 'USD', sshUsuario: 'root', sshPorta: '22' });
    setHostFormOpen(true);
  };
  const abrirEditarHost = (h: VpsHost) => {
    setEditandoHost(h);
    hostForm.setFieldsValue({ ...h, tags: (h.tags || []).join(', ') });
    setHostFormOpen(true);
  };
  const salvarHost = async () => {
    try {
      const v = await hostForm.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('vpsHostSave', { id: editandoHost?.id, ...v });
      if (r.ok) {
        message.success(editandoHost ? 'VPS atualizada' : 'VPS cadastrada');
        setHostFormOpen(false);
        carregar();
      } else message.error(r.error || 'Erro');
    } catch (e) { if (e instanceof Error && e.message) message.error(e.message); }
    finally { setSalvando(false); }
  };
  const deletarHost = async (id: string) => {
    const r = await callServer<ServerResult>('vpsHostDelete', id);
    if (r.ok) { message.success('VPS removida'); setAbertoId(null); carregar(); }
    else message.error(r.error || 'Erro');
  };

  // ── Serviço ──
  const abrirNovoServico = () => {
    setEditandoServico(null);
    servicoForm.resetFields();
    servicoForm.setFieldsValue({ status: 'rodando' });
    setServicoFormOpen(true);
  };
  const abrirEditarServico = (s: VpsServico) => { setEditandoServico(s); servicoForm.setFieldsValue({ ...s }); setServicoFormOpen(true); };
  const salvarServico = async () => {
    if (!abertoId) return;
    try {
      const v = await servicoForm.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('vpsServicoSave', { id: editandoServico?.id, vpsHostId: abertoId, ...v });
      if (r.ok) {
        message.success(editandoServico ? 'Serviço atualizado' : 'Serviço adicionado');
        setServicoFormOpen(false);
        carregarDetalhe(abertoId);
        carregar();
      } else message.error(r.error || 'Erro');
    } catch (e) { if (e instanceof Error && e.message) message.error(e.message); }
    finally { setSalvando(false); }
  };
  const deletarServico = async (id: string) => {
    const r = await callServer<ServerResult>('vpsServicoDelete', id);
    if (r.ok && abertoId) { message.success('Serviço removido'); carregarDetalhe(abertoId); carregar(); }
    else message.error(r.error || 'Erro');
  };

  // ── Pendência ──
  const abrirNovaPend = () => {
    setEditandoPend(null);
    pendForm.resetFields();
    pendForm.setFieldsValue({ tipo: 'debito', severidade: 'media', status: 'aberto' });
    setPendFormOpen(true);
  };
  const abrirEditarPend = (p: VpsPendencia) => { setEditandoPend(p); pendForm.setFieldsValue({ ...p }); setPendFormOpen(true); };
  const salvarPend = async () => {
    if (!abertoId) return;
    try {
      const v = await pendForm.validateFields();
      setSalvando(true);
      const r = await callServer<ServerResult>('vpsPendenciaSave', { id: editandoPend?.id, vpsHostId: abertoId, ...v });
      if (r.ok) {
        message.success(editandoPend ? 'Pendência atualizada' : 'Pendência registrada');
        setPendFormOpen(false);
        carregarDetalhe(abertoId);
        carregar();
      } else message.error(r.error || 'Erro');
    } catch (e) { if (e instanceof Error && e.message) message.error(e.message); }
    finally { setSalvando(false); }
  };
  const togglePend = async (p: VpsPendencia) => {
    const novo = p.status === 'resolvido' ? 'aberto' : 'resolvido';
    const r = await callServer<ServerResult>('vpsPendenciaSave', { ...p, status: novo });
    if (r.ok && abertoId) { carregarDetalhe(abertoId); carregar(); }
  };
  const deletarPend = async (id: string) => {
    const r = await callServer<ServerResult>('vpsPendenciaDelete', id);
    if (r.ok && abertoId) { carregarDetalhe(abertoId); }
    else message.error(r.error || 'Erro');
  };

  return (
    <div style={{ padding: '14px 24px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Network size={18} strokeWidth={1.6} color={t.accents.blue} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Minhas VPS & Serviços</span>
            <Tooltip title="Cadastre suas máquinas (VPS/servidores dedicados) e mapeie a topologia: o que roda dentro de cada uma (containers/apps), débitos técnicos, erros conhecidos e para onde crescer. As chaves ficam no Cofre.">
              <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
            </Tooltip>
          </div>
          <p style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, margin: '4px 0 0', lineHeight: 1.5 }}>
            {hosts.length > 0
              ? <><strong>{hosts.length}</strong> {hosts.length === 1 ? 'máquina' : 'máquinas'} · alimente conforme novos apps entram na topologia.</>
              : 'Cadastre sua primeira VPS e mapeie o que roda dentro dela.'}
          </p>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovoHost}>Nova VPS</Button>
      </div>

      {loading && hosts.length === 0 ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : hosts.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: t.textTertiary }}>Nenhuma VPS cadastrada. Clique em <strong>Nova VPS</strong> pra começar a mapear sua infra.</span>}
        >
          <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovoHost}>Cadastrar minha primeira VPS</Button>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {hosts.map((h) => <HostCard key={h.id} host={h} saude={saudePorHost[h.id]} verificando={verificando} onOpen={() => abrirDetalhe(h)} />)}
        </div>
      )}

      {/* ─── Drawer de detalhe / topologia ─────────────────────────────────── */}
      <Drawer
        open={!!abertoId}
        onClose={() => setAbertoId(null)}
        width={720}
        title={hostAberto ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 8, background: `${t.accents.blue}1f`, color: t.accents.blue,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Server size={15} />
            </span>
            <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>{hostAberto.nome}</span>
            <Tag bordered={false} style={{ borderRadius: 999, fontSize: 11 }}>{hostAberto.provedor}</Tag>
          </span>
        ) : ''}
        extra={hostAberto && (
          <div style={{ display: 'flex', gap: 6 }}>
            {hostAberto.painelUrl && (
              <Tooltip title="Abrir painel do provedor">
                <Button icon={<ExternalLink size={14} />} href={hostAberto.painelUrl} target="_blank" rel="noopener noreferrer" />
              </Tooltip>
            )}
            <Button icon={<Edit3 size={14} />} onClick={() => abrirEditarHost(hostAberto)}>Editar</Button>
            <Popconfirm
              title="Remover esta VPS?"
              description="Leva junto os serviços e pendências cadastrados nela."
              onConfirm={() => deletarHost(hostAberto.id)}
              okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
            >
              <Tooltip title="Remover VPS"><Button icon={<Trash2 size={14} />} danger /></Tooltip>
            </Popconfirm>
          </div>
        )}
      >
        {hostAberto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <HostResumo host={hostAberto} onAbrirCofre={onAbrirCofre} />

            {/* Serviços */}
            {carregandoDetalhe ? (
              <Secao icon={<Boxes size={15} />} titulo="Serviços rodando"><Skeleton active paragraph={{ rows: 3 }} /></Secao>
            ) : servicos.length === 0 ? (
              <Secao
                icon={<Boxes size={15} />}
                titulo="Serviços rodando"
                acao={<Button size="small" type="primary" icon={<Plus size={13} />} onClick={abrirNovoServico}>Adicionar</Button>}
              >
                <VazioLinha texto="Nenhum serviço mapeado. Adicione o que roda nesta VPS (containers, apps, bancos…)." />
              </Secao>
            ) : (
              <>
                {/* Checados por HTTP (entram na conta X/Y no ar) */}
                {servicosComDominio.length > 0 && (
                  <Secao
                    icon={<Boxes size={15} />}
                    titulo={(
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        Serviços online
                        <LiveDot cor={onlineCor} pulsando={(saudeAberto?.online || 0) > 0} />
                      </span>
                    )}
                    contagem={servicosComDominio.length}
                    sub={<SaudeResumo saude={saudeAberto} verificando={verificando} ultima={ultimaChecagem} />}
                    acao={(
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="small"
                          icon={<RefreshCw size={13} style={{ animation: verificando ? 'forjaSpin 0.9s linear infinite' : undefined }} />}
                          onClick={verificarStatus}
                        >
                          Verificar
                        </Button>
                        <Button size="small" type="primary" icon={<Plus size={13} />} onClick={abrirNovoServico}>Adicionar</Button>
                      </div>
                    )}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {servicosComDominio.map(renderServico)}
                    </div>
                  </Secao>
                )}

                {/* Internos — sem domínio público, status manual */}
                {servicosInternos.length > 0 && (
                  <Secao
                    icon={<Boxes size={15} />}
                    titulo={servicosComDominio.length > 0 ? 'Serviços internos' : 'Serviços rodando'}
                    contagem={servicosInternos.length}
                    sub={servicosComDominio.length > 0
                      ? <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>sem domínio público pra checar — status informado no cadastro</span>
                      : undefined}
                    acao={servicosComDominio.length === 0
                      ? <Button size="small" type="primary" icon={<Plus size={13} />} onClick={abrirNovoServico}>Adicionar</Button>
                      : undefined}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {servicosInternos.map(renderServico)}
                    </div>
                  </Secao>
                )}
              </>
            )}

            {/* Pendências / débitos */}
            <Secao
              icon={<AlertTriangle size={15} />}
              titulo="Débitos, erros & próximos passos"
              contagem={pendencias.length}
              acao={<Button size="small" icon={<Plus size={13} />} onClick={abrirNovaPend}>Registrar</Button>}
            >
              {carregandoDetalhe ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : pendencias.length === 0 ? (
                <VazioLinha texto="Sem pendências registradas. Guarde aqui os débitos técnicos, erros conhecidos e o que falta fazer." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendencias.map((p) => (
                    <PendenciaLinha
                      key={p.id}
                      pend={p}
                      servico={servicos.find((s) => s.id === p.servicoId)}
                      onToggle={() => togglePend(p)}
                      onEdit={() => abrirEditarPend(p)}
                      onDelete={() => deletarPend(p.id)}
                    />
                  ))}
                </div>
              )}
            </Secao>

            {hostAberto.notas && (
              <Secao icon={<Info size={15} />} titulo="Notas">
                <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {hostAberto.notas}
                </div>
              </Secao>
            )}
          </div>
        )}
      </Drawer>

      {/* ─── Modal VPS ─────────────────────────────────────────────────────── */}
      <Modal
        open={hostFormOpen}
        onCancel={() => setHostFormOpen(false)}
        title={editandoHost ? `Editar ${editandoHost.nome}` : 'Nova VPS / servidor'}
        width={720}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setHostFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvarHost}>
            {editandoHost ? 'Atualizar' : 'Cadastrar'}
          </Button>,
        ]}
      >
        <Form form={hostForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="nome" label="Nome / apelido" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: Central LLM (pulse8)" />
            </Form.Item>
            <Form.Item name="provedor" label="Provedor">
              <Input placeholder="Hostinger" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={[
                { value: 'ativo', label: 'Ativo' },
                { value: 'pausado', label: 'Pausado' },
                { value: 'desativado', label: 'Desativado' },
              ]} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="ip" label="IPv4"><Input placeholder="179.197.71.187" /></Form.Item>
            <Form.Item name="ipv6" label="IPv6"><Input placeholder="2a02:4780:…" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="hostname" label="Hostname"><Input placeholder="srv1827177.hstgr.cloud" /></Form.Item>
            <Form.Item name="plano" label="Plano"><Input placeholder="VPS KVM2" /></Form.Item>
            <Form.Item name="so" label="Sistema"><Input placeholder="Ubuntu 24.04" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="regiao" label="Região"><Input placeholder="Brasil / EUA…" /></Form.Item>
            <Form.Item name="dominioRaiz" label="Domínio raiz"><Input placeholder="pulse8.cloud" /></Form.Item>
            <Form.Item name="dominioExpira" label="Domínio expira em"><Input placeholder="13/07/2027" /></Form.Item>
          </div>
          <Form.Item name="painelUrl" label="URL do painel"><Input placeholder="https://hpanel.hostinger.com" /></Form.Item>
          <div style={{
            fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, margin: '2px 0 10px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Terminal size={12} /> Acesso SSH (só a referência — a senha/chave fica no Cofre)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
            <Form.Item name="sshUsuario" label="Usuário SSH"><Input placeholder="root" /></Form.Item>
            <Form.Item name="sshHost" label="Host SSH"><Input placeholder="srv1827177.hstgr.cloud" /></Form.Item>
            <Form.Item name="sshPorta" label="Porta"><Input placeholder="22" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Form.Item name="cofreLabel" label="Rótulo no Cofre (chave/senha)"><Input placeholder="ex.: SSH root VPS Hostinger" /></Form.Item>
            <Form.Item name="custoMensal" label="Custo/mês"><InputNumber min={0} style={{ width: '100%' }} placeholder="5" /></Form.Item>
            <Form.Item name="moeda" label="Moeda">
              <Select options={[{ value: 'USD', label: 'USD' }, { value: 'BRL', label: 'BRL' }, { value: 'EUR', label: 'EUR' }]} />
            </Form.Item>
          </div>
          <Form.Item name="tags" label="Tags (vírgula)"><Input placeholder="ex.: docker, gateway, sempre-ligado" /></Form.Item>
          <Form.Item name="notas" label="Notas"><Input.TextArea rows={3} placeholder="Comandos úteis, dependências, princípios (ex.: só o Caddy fala com o mundo)…" /></Form.Item>
        </Form>
      </Modal>

      {/* ─── Modal Serviço ─────────────────────────────────────────────────── */}
      <Modal
        open={servicoFormOpen}
        onCancel={() => setServicoFormOpen(false)}
        title={editandoServico ? `Editar ${editandoServico.nome}` : 'Adicionar serviço'}
        width={640}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setServicoFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvarServico}>
            {editandoServico ? 'Atualizar' : 'Adicionar'}
          </Button>,
        ]}
      >
        <Form form={servicoForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Form.Item name="nome" label="Nome / container" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="ex.: central-llm-gateway" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={[
                { value: 'rodando', label: 'Rodando' },
                { value: 'parado', label: 'Parado' },
                { value: 'reiniciando', label: 'Reiniciando' },
                { value: 'erro', label: 'Com erro' },
              ]} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="imagem" label="Imagem / stack"><Input placeholder="ghcr.io/berriai/litellm:main-stable" /></Form.Item>
            <Form.Item name="funcao" label="Função"><Input placeholder="Gateway LLM" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
            <Form.Item name="portaInterna" label="Porta interna"><Input placeholder="4000" /></Form.Item>
            <Form.Item name="portaExposta" label="Porta exposta"><Input placeholder="—" /></Form.Item>
            <Form.Item name="dominioPublico" label="Domínio público"><Input placeholder="litellm.pulse8.cloud" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="volume" label="Volume / persistência"><Input placeholder="postgres_data" /></Form.Item>
            <Form.Item name="dependeDe" label="Depende de"><Input placeholder="central-llm-db" /></Form.Item>
          </div>
          <Form.Item name="cofreLabel" label="Rótulo no Cofre (se tem chave/senha)"><Input placeholder="ex.: LITELLM_MASTER_KEY" /></Form.Item>
          <Form.Item name="notas" label="Notas"><Input.TextArea rows={2} placeholder="Observações, gotchas, o que quebra se cair…" /></Form.Item>
        </Form>
      </Modal>

      {/* ─── Modal Pendência ───────────────────────────────────────────────── */}
      <Modal
        open={pendFormOpen}
        onCancel={() => setPendFormOpen(false)}
        title={editandoPend ? 'Editar item' : 'Registrar débito / erro / próximo passo'}
        width={560}
        footer={[
          <Button key="c" icon={<X size={14} />} onClick={() => setPendFormOpen(false)}>Cancelar</Button>,
          <Button key="s" type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvarPend}>
            {editandoPend ? 'Atualizar' : 'Registrar'}
          </Button>,
        ]}
      >
        <Form form={pendForm} layout="vertical" requiredMark={false}>
          <Form.Item name="tipo" label="Tipo">
            <Segmented options={[
              { value: 'debito', label: 'Débito técnico' },
              { value: 'erro', label: 'Erro conhecido' },
              { value: 'proximo', label: 'Próximo passo' },
            ]} />
          </Form.Item>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input placeholder="ex.: Rotação trimestral da LITELLM_VIRTUAL_KEY" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição"><Input.TextArea rows={3} placeholder="Detalhe, causa, solução conhecida…" /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="severidade" label="Severidade">
              <Select options={[
                { value: 'alta', label: 'Alta' },
                { value: 'media', label: 'Média' },
                { value: 'baixa', label: 'Baixa' },
              ]} />
            </Form.Item>
            <Form.Item name="servicoId" label="Serviço (opcional)">
              <Select allowClear placeholder="VPS inteira" options={servicos.map((s) => ({ value: s.id, label: s.nome }))} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Sub: card de host ───────────────────────────────────────────────────────
function HostCard({ host, saude, verificando, onOpen }: {
  host: VpsHost; saude?: { online: number; total: number }; verificando: boolean; onOpen: () => void;
}): React.ReactElement {
  const t = useTokens();
  const st = STATUS_HOST[host.status] || STATUS_HOST.ativo;
  const cor = t.accents[st.accent];
  const temSaude = !!saude && saude.total > 0;
  const saudeCor = temSaude
    ? (saude!.online === saude!.total ? t.accents.sage : (saude!.online === 0 ? t.accents.rose : t.accents.clay))
    : t.textTertiary;
  return (
    <div
      onClick={onOpen}
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16,
        cursor: 'pointer', transition: 'all 0.18s', display: 'flex', flexDirection: 'column', gap: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accents.blue; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${t.accents.blue}1f`, color: t.accents.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Server size={17} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {host.nome}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 1 }}>
            {host.provedor}{host.plano ? ` · ${host.plano}` : ''}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, color: cor }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: cor }} />
          {st.label}
        </span>
      </div>

      {host.ip && (
        <div style={{ fontFamily: FONTS.mono, fontSize: 11.5, color: t.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Globe size={11} color={t.textTertiary} /> {host.ip}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
        <Chip icon={<Boxes size={11} />} texto={`${host.numServicos} ${host.numServicos === 1 ? 'serviço' : 'serviços'}`} cor={t.accents.sage} />
        {temSaude && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11,
            color: saudeCor, background: `${saudeCor}18`, border: `1px solid ${saudeCor}33`, borderRadius: 999, padding: '2px 9px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 999, background: saudeCor,
              animation: verificando ? 'forjaPulse 1s ease-in-out infinite' : undefined,
            }} />
            {saude!.online}/{saude!.total} no ar
          </span>
        )}
        {host.numPendencias > 0 && (
          <Chip icon={<AlertTriangle size={11} />} texto={`${host.numPendencias} ${host.numPendencias === 1 ? 'pendência' : 'pendências'}`} cor={t.accents.clay} />
        )}
        {host.custoMensal && (
          <Chip icon={<DollarSign size={11} />} texto={`${host.moeda} ${host.custoMensal}/mês`} cor={t.accents.peach} />
        )}
      </div>
    </div>
  );
}

function Chip({ icon, texto, cor }: { icon: React.ReactNode; texto: string; cor: string }): React.ReactElement {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11,
      color: cor, background: `${cor}18`, border: `1px solid ${cor}33`, borderRadius: 999, padding: '2px 9px',
    }}>
      {icon}{texto}
    </span>
  );
}

// ─── Sub: resumo do host no drawer ──────────────────────────────────────────
function HostResumo({ host, onAbrirCofre }: { host: VpsHost; onAbrirCofre?: (label?: string) => void }): React.ReactElement {
  const t = useTokens();
  const linhas: Array<{ icon: React.ReactNode; label: string; valor: React.ReactNode }> = [];
  if (host.ip) linhas.push({ icon: <Globe size={13} />, label: 'IPv4', valor: <Mono>{host.ip}</Mono> });
  if (host.ipv6) linhas.push({ icon: <Globe size={13} />, label: 'IPv6', valor: <Mono>{host.ipv6}</Mono> });
  if (host.hostname) linhas.push({ icon: <Server size={13} />, label: 'Hostname', valor: <Mono>{host.hostname}</Mono> });
  if (host.so) linhas.push({ icon: <Cpu size={13} />, label: 'Sistema', valor: host.so });
  if (host.regiao) linhas.push({ icon: <Globe size={13} />, label: 'Região', valor: host.regiao });
  if (host.dominioRaiz) {
    linhas.push({ icon: <Globe size={13} />, label: 'Domínio', valor: <span><Mono>{host.dominioRaiz}</Mono>{host.dominioExpira ? <span style={{ color: t.textTertiary }}> · expira {host.dominioExpira}</span> : null}</span> });
  }
  if (host.sshHost || host.sshUsuario) {
    linhas.push({
      icon: <Terminal size={13} />, label: 'SSH',
      valor: <Mono>{`${host.sshUsuario || 'root'}@${host.sshHost || host.ip}${host.sshPorta && host.sshPorta !== '22' ? `:${host.sshPorta}` : ''}`}</Mono>,
    });
  }
  if (host.custoMensal) linhas.push({ icon: <DollarSign size={13} />, label: 'Custo', valor: `${host.moeda} ${host.custoMensal}/mês` });

  return (
    <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 18px' }}>
        {linhas.map((l, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {l.icon}{l.label}
            </span>
            <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, wordBreak: 'break-all' }}>{l.valor}</span>
          </div>
        ))}
      </div>
      {(host.cofreLabel || host.tags.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {host.cofreLabel && (
            <Button size="small" icon={<KeyRound size={13} />} onClick={() => onAbrirCofre?.(host.cofreLabel)}>
              Chave no Cofre: {host.cofreLabel}
            </Button>
          )}
          {host.tags.map((tag) => <Tag key={tag} bordered={false} style={{ borderRadius: 999, fontSize: 11 }}>{tag}</Tag>)}
        </div>
      )}
    </div>
  );
}

// ─── Sub: seção com título ───────────────────────────────────────────────────
// Dot "ao vivo": bolinha sólida + halo que expande e some (mais vivo que um pulse fraco).
function LiveDot({ cor, pulsando }: { cor: string; pulsando?: boolean }): React.ReactElement {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9, flexShrink: 0 }}>
      {pulsando && (
        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: cor, animation: 'forjaPulseRing 1.6s ease-out infinite' }} />
      )}
      <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: cor }} />
    </span>
  );
}

function Secao({ icon, titulo, contagem, acao, sub, children }: {
  icon: React.ReactNode; titulo: React.ReactNode; contagem?: number; acao?: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: sub ? 4 : 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: t.textSecondary }}>
          <span style={{ color: t.textTertiary }}>{icon}</span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>{titulo}</span>
          {typeof contagem === 'number' && contagem > 0 && (
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, background: t.surfaceMuted, borderRadius: 999, padding: '1px 7px' }}>{contagem}</span>
          )}
        </span>
        {acao}
      </div>
      {sub && <div style={{ marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  );
}

// Resumo de saúde (X de Y no ar) — mostrado sob o título de "Serviços rodando".
function SaudeResumo({ saude, verificando, ultima }: {
  saude?: { online: number; total: number }; verificando: boolean; ultima: string;
}): React.ReactElement | null {
  const t = useTokens();
  if (verificando && !saude) {
    return <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>verificando status…</span>;
  }
  if (!saude || saude.total === 0) return null;
  const todosOk = saude.online === saude.total;
  const cor = todosOk ? t.accents.sage : (saude.online === 0 ? t.accents.rose : t.accents.clay);
  const rel = (() => {
    if (!ultima) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(ultima).getTime()) / 1000));
    if (s < 60) return 'agora há pouco';
    const m = Math.floor(s / 60);
    return m < 60 ? `há ${m}min` : `há ${Math.floor(m / 60)}h`;
  })();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: cor }} />
      <span style={{ color: cor, fontWeight: 600 }}>{saude.online} de {saude.total}</span> no ar
      {rel && <span>· checado {rel}</span>}
    </span>
  );
}

function VazioLinha({ texto }: { texto: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{
      fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, lineHeight: 1.5,
      background: t.surfaceMuted, border: `1px dashed ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px',
    }}>
      {texto}
    </div>
  );
}

// ─── Sub: linha de serviço ───────────────────────────────────────────────────
function ServicoLinha({ servico, ping, verificando, onEdit, onDelete, onAbrirCofre }: {
  servico: VpsServico; ping?: PingResultado; verificando?: boolean; onEdit: () => void; onDelete: () => void; onAbrirCofre?: (label?: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const st = STATUS_SERVICO[servico.status] || STATUS_SERVICO.rodando;
  // Se o serviço tem domínio público, o farol reflete o health-check ao vivo;
  // senão (ex.: Postgres interno), cai pro status manual cadastrado.
  const temPing = !!servico.dominioPublico && !!ping;
  const liveCor = temPing
    ? (ping!.online ? (ping!.instavel ? t.accents.clay : t.accents.sage) : t.accents.rose)
    : t.accents[st.accent];
  const liveRotulo = temPing
    ? (ping!.online ? (ping!.instavel ? `instável ${ping!.statusCode}` : 'no ar') : 'fora')
    : '';
  const cor = liveCor;
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 11, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9, flexShrink: 0 }} title={temPing ? liveRotulo : st.label}>
          {temPing && ping!.online && !ping!.instavel && (
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 999, background: cor,
              animation: `forjaPulseRing ${verificando ? '1s' : '1.6s'} ease-out infinite`,
            }} />
          )}
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: cor }} />
        </span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {servico.nome}
        </span>
        {servico.funcao && <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, whiteSpace: 'nowrap' }}>· {servico.funcao}</span>}
        <span style={{ flex: 1 }} />
        {temPing ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ping!.online && ping!.ms > 0 && (
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary }}>{ping!.ms}ms</span>
            )}
            <span style={{
              fontFamily: FONTS.ui, fontSize: 10.5, color: cor,
              background: `${cor}18`, border: `1px solid ${cor}33`, borderRadius: 999, padding: '1px 8px',
            }}>{liveRotulo}</span>
          </span>
        ) : (
          <Tooltip title={servico.dominioPublico
            ? 'Ainda não checado — clique em Verificar.'
            : 'Sem domínio público pra checar por HTTP (serviço interno / reverse proxy). Este é o status que você informou ao cadastrar.'}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help',
              fontFamily: FONTS.ui, fontSize: 10.5, color: cor,
              background: `${cor}14`, border: `1px solid ${cor}2e`, borderRadius: 999, padding: '1px 8px',
            }}>
              {st.label}
              <span style={{ color: t.textTertiary, fontSize: 9.5 }}>· manual</span>
            </span>
          </Tooltip>
        )}
        {servico.cofreLabel && (
          <Tooltip title={`Chave no Cofre: ${servico.cofreLabel}`}>
            <Button type="text" size="small" icon={<KeyRound size={13} />} onClick={() => onAbrirCofre?.(servico.cofreLabel)} />
          </Tooltip>
        )}
        <Button type="text" size="small" icon={<Edit3 size={13} />} onClick={onEdit} />
        <Popconfirm title="Remover serviço?" onConfirm={onDelete} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
        </Popconfirm>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 17 }}>
        {servico.imagem && <MetaPill icon={<HardDrive size={10} />} texto={servico.imagem} />}
        {servico.portaInterna && <MetaPill icon={<Network size={10} />} texto={`:${servico.portaInterna}${servico.portaExposta && servico.portaExposta !== '—' ? ` → ${servico.portaExposta}` : ''}`} />}
        {servico.dominioPublico && (
          <a href={`https://${servico.dominioPublico}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <MetaPill icon={<Globe size={10} />} texto={servico.dominioPublico} link cor={t.accents.blue} />
          </a>
        )}
        {servico.dependeDe && <MetaPill icon={<ArrowRight size={10} />} texto={`depende de ${servico.dependeDe}`} />}
      </div>
      {servico.notas && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, paddingLeft: 17, lineHeight: 1.5 }}>{servico.notas}</div>
      )}
    </div>
  );
}

function MetaPill({ icon, texto, link, cor }: { icon: React.ReactNode; texto: string; link?: boolean; cor?: string }): React.ReactElement {
  const t = useTokens();
  const c = cor || t.textTertiary;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.mono, fontSize: 10.5,
      color: c, background: link ? `${c}14` : t.surfaceMuted, borderRadius: 6, padding: '2px 7px',
      maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      textDecoration: link ? 'none' : undefined,
    }}>
      {icon}{texto}
    </span>
  );
}

// ─── Sub: linha de pendência ─────────────────────────────────────────────────
function PendenciaLinha({ pend, servico, onToggle, onEdit, onDelete }: {
  pend: VpsPendencia; servico?: VpsServico; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}): React.ReactElement {
  const t = useTokens();
  const meta = TIPO_PENDENCIA[pend.tipo] || TIPO_PENDENCIA.debito;
  const cor = t.accents[meta.accent];
  const resolvido = pend.status === 'resolvido';
  return (
    <div style={{
      background: t.surface, border: `1px solid ${resolvido ? t.borderSoft : t.border}`, borderRadius: 11,
      padding: '10px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', opacity: resolvido ? 0.6 : 1,
    }}>
      <Tooltip title={resolvido ? 'Reabrir' : 'Marcar como resolvido'}>
        <button
          onClick={onToggle}
          style={{
            border: `1.5px solid ${resolvido ? t.accents.sage : t.border}`, background: resolvido ? t.accents.sage : 'transparent',
            width: 18, height: 18, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 2, flexShrink: 0, color: '#fff',
          }}
        >
          {resolvido && <CheckCircle2 size={12} />}
        </button>
      </Tooltip>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 10.5, color: cor, background: `${cor}18`, border: `1px solid ${cor}33`, borderRadius: 999, padding: '1px 8px' }}>
            {meta.icon}{meta.label}
          </span>
          {pend.tipo !== 'proximo' && (
            <span style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{pend.severidade}</span>
          )}
          {servico && <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>· {servico.nome}</span>}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, marginTop: 5, textDecoration: resolvido ? 'line-through' : 'none' }}>
          {pend.titulo}
        </div>
        {pend.descricao && (
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55, marginTop: 3, whiteSpace: 'pre-wrap' }}>
            {pend.descricao}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <Button type="text" size="small" icon={<Edit3 size={13} />} onClick={onEdit} />
        <Popconfirm title="Apagar item?" onConfirm={onDelete} okText="Apagar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
        </Popconfirm>
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }): React.ReactElement {
  return <span style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}>{children}</span>;
}
