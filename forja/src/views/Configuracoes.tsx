import React, { useEffect, useState } from 'react';
import { Row, Col, Input, Button, Form, Select, Tag, Popconfirm, App as AntApp, Skeleton, Spin, Collapse } from 'antd';
import { Sparkles, GitBranch, Layers, KeyRound, Plus, Trash2, CheckCircle2, Zap, RefreshCw, ExternalLink } from 'lucide-react';
import { ShieldCheck, Tags, Bell, Database, Layers as LayersSection, Landmark, Plug, Cpu, CreditCard } from 'lucide-react';
import { PageHeader, Panel } from '../components/ui';
import IntegracoesFiscaisPanel from '../components/IntegracoesFiscaisPanel';
import ApisPanel from '../components/ApisPanel';
import ServidoresPanel from '../components/ServidoresPanel';
import PagamentosPanel from '../components/PagamentosPanel';
import AutomacoesPanel from '../components/AutomacoesPanel';
import UsuariosPanel from '../components/UsuariosPanel';
import ModeloAuditoriaPanel from '../components/ModeloAuditoriaPanel';
import RoteamentoIAPanel from '../components/RoteamentoIAPanel';
import RegrasCategoriaPanel from '../components/RegrasCategoriaPanel';
import ModelosDisponiveisWidget from '../components/ModelosDisponiveisWidget';
import BackupRestorePanel from '../components/BackupRestorePanel';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import { useIsMobile } from '../useResponsive';
import callServer from '../gas-client';
import type { Settings, Stack, StatusGeral, ServerResponse } from '../types';

type SecaoKey = 'conta' | 'ia' | 'integracoes' | 'apis' | 'infra' | 'pagamentos' | 'fiscal' | 'financeiro' | 'automacoes' | 'dados' | 'stacks';

const SECAO_VALIDAS: SecaoKey[] = ['conta', 'ia', 'integracoes', 'apis', 'infra', 'pagamentos', 'fiscal', 'financeiro', 'automacoes', 'dados', 'stacks'];

interface ConfiguracoesProps {
  // Deep-link: abre direto numa seção (ex.: vindo de Operações/Atelier → Conexões).
  initialSecao?: string;
}

export default function Configuracoes({ initialSecao }: ConfiguracoesProps = {}): React.ReactElement {
  const t = useTokens();
  const isMobile = useIsMobile();
  const { message } = AntApp.useApp();
  const secaoInicial: SecaoKey = (initialSecao && SECAO_VALIDAS.indexOf(initialSecao as SecaoKey) >= 0) ? (initialSecao as SecaoKey) : 'conta';
  const [secao, setSecao] = useState<SecaoKey>(secaoInicial);

  useEffect(() => {
    if (initialSecao && SECAO_VALIDAS.indexOf(initialSecao as SecaoKey) >= 0) setSecao(initialSecao as SecaoKey);
  }, [initialSecao]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingLlm, setSavingLlm] = useState(false);
  const [savingGit, setSavingGit] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [llmForm] = Form.useForm();
  const [geminiForm] = Form.useForm();
  const [gitForm] = Form.useForm();
  const [stackForm] = Form.useForm();

  const validar = () => {
    setChecking(true);
    callServer<ServerResponse<StatusGeral>>('getStatusGeral')
      .then(res => { if (res.ok && res.data) setStatus(res.data as StatusGeral); })
      .catch(() => { /* preview local não valida */ })
      .finally(() => setChecking(false));
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Settings>>('getSettings'),
      callServer<ServerResponse<Stack[]>>('getStacks'),
    ])
      .then(([s, st]) => {
        if (s.ok && s.data) {
          setSettings(s.data);
          llmForm.setFieldsValue({ baseUrl: s.data.llm.baseUrl, modelo: s.data.llm.modelo, provider: s.data.llm.provider || 'proxy' });
          geminiForm.setFieldsValue({ modelo: s.data.gemini?.modelo || 'gemini-3.5-flash' });
          gitForm.setFieldsValue({ usuario: s.data.github.usuario });
        }
        if (st.ok && st.data) setStacks(st.data);
      })
      .catch(() => message.error('Não foi possível carregar as configurações (rode no Apps Script)'))
      .finally(() => { setLoading(false); validar(); });
  };

  useEffect(load, []);

  const saveLlm = (v: Record<string, string>) => {
    setSavingLlm(true);
    callServer<ServerResponse<unknown>>('saveSettings', { llm: { baseUrl: v.baseUrl, modelo: v.modelo, provider: v.provider, apiKey: v.apiKey || '' } })
      .then(res => { if (res.ok) { message.success('Conexão de IA salva'); llmForm.setFieldValue('apiKey', ''); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao salvar'))
      .finally(() => setSavingLlm(false));
  };

  const saveGemini = (v: Record<string, string>) => {
    setSavingGemini(true);
    callServer<ServerResponse<unknown>>('saveSettings', { gemini: { modelo: v.modelo || 'gemini-3.5-flash', apiKey: v.apiKey || '' } })
      .then(res => { if (res.ok) { message.success('Gemini conectado'); geminiForm.setFieldValue('apiKey', ''); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao salvar'))
      .finally(() => setSavingGemini(false));
  };

  const testarGemini = () => {
    setTestingGemini(true);
    callServer<ServerResponse<{ resposta: string; latenciaMs: number; modelo: string }>>('testGeminiConnection')
      .then(res => {
        if (res.ok && res.data) message.success(`Gemini OK (${res.data.latenciaMs}ms · ${res.data.modelo})`);
        else message.error(res.error || 'Falha na conexão');
      })
      .catch(() => message.error('Teste só funciona no app publicado'))
      .finally(() => setTestingGemini(false));
  };

  const saveGit = (v: Record<string, string>) => {
    setSavingGit(true);
    callServer<ServerResponse<unknown>>('saveSettings', { github: { usuario: v.usuario, token: v.token || '' } })
      .then(res => { if (res.ok) { message.success('GitHub conectado'); gitForm.setFieldValue('token', ''); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao salvar'))
      .finally(() => setSavingGit(false));
  };

  const testarLlm = () => {
    setTestingLlm(true);
    callServer<ServerResponse<{ resposta: string; latenciaMs: number }>>('testLLMConnection')
      .then(res => {
        if (res.ok && res.data) message.success(`Conexão OK (${res.data.latenciaMs}ms) — resposta: "${res.data.resposta}"`);
        else message.error(res.error || 'Falha na conexão');
      })
      .catch(() => message.error('Teste só funciona no app publicado'))
      .finally(() => setTestingLlm(false));
  };

  const sincronizar = () => {
    setSyncing(true);
    callServer<ServerResponse<{ mapeados: string[]; encontradas: string[] }>>('syncSettings')
      .then(res => {
        if (res.ok && res.data) {
          const n = res.data.mapeados.length;
          if (n > 0) message.success(`${n} configuração(ões) sincronizada(s): ${res.data.mapeados.join('; ')}`);
          else message.info(`Nada novo para sincronizar. Propriedades encontradas: ${res.data.encontradas.join(', ') || 'nenhuma'}`);
          load();
          validar();
        } else message.error(res.error || 'Erro ao sincronizar');
      })
      .catch(() => message.error('Sincronização só funciona no app publicado'))
      .finally(() => setSyncing(false));
  };

  const addStack = (v: Record<string, string>) => {
    callServer<ServerResponse<Stack>>('createStack', { nome: v.nome, categoria: v.categoria || '', descricao: v.descricao || '', docsUrl: v.docsUrl || '' })
      .then(res => { if (res.ok) { message.success('Stack adicionada'); stackForm.resetFields(); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao adicionar'));
  };

  const removeStack = (id: string) => {
    callServer<ServerResponse<unknown>>('deleteStack', id)
      .then(res => { if (res.ok) { setStacks(s => s.filter(x => x.id !== id)); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao remover'));
  };

  // Selo de status ao vivo: pendente / verificando / Conectado / Desconectado
  const connBadge = (configurado: boolean, live?: { conectado: boolean }) => {
    if (!configurado) return <Tag bordered={false} style={{ background: `${t.accents.peach}22`, color: t.accents.peach }}>pendente</Tag>;
    if (checking && !live) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.textTertiary, fontSize: 12 }}><Spin size="small" /> verificando…</span>;
    if (!live) return <Tag bordered={false} style={{ background: `${t.accents.sage}22`, color: t.accents.sage }}>configurado</Tag>;
    return (
      <Tag bordered={false} style={{ background: live.conectado ? `${t.accents.sage}22` : `${t.accents.rose}22`, color: live.conectado ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>
        {live.conectado ? 'Conectado' : 'Desconectado'}
      </Tag>
    );
  };

  const SECOES: Array<{ key: SecaoKey; label: string; descricao: string; icon: React.ReactNode; accent: string; status?: 'ok' | 'pendente' }> = [
    { key: 'conta', label: 'Conta & Acesso', descricao: 'Usuários e permissões', icon: <ShieldCheck size={18} strokeWidth={1.6} />, accent: t.accents.peach },
    { key: 'ia', label: 'Inteligência (IA)', descricao: 'Proxy, Gemini e auditoria', icon: <Sparkles size={18} strokeWidth={1.6} />, accent: t.accents.peach, status: (settings?.llm.temChave || settings?.gemini?.temChave) ? 'ok' : 'pendente' },
    { key: 'integracoes', label: 'Integrações', descricao: 'GitHub', icon: <GitBranch size={18} strokeWidth={1.6} />, accent: t.accents.lavender, status: settings?.github.temToken ? 'ok' : 'pendente' },
    { key: 'apis', label: 'APIs & Webhooks', descricao: 'Endpoints monitorados por aplicação', icon: <Plug size={18} strokeWidth={1.6} />, accent: t.accents.peach },
    { key: 'infra', label: 'Infraestrutura', descricao: 'Servidores e instâncias que você roda', icon: <Cpu size={18} strokeWidth={1.6} />, accent: t.accents.sage },
    { key: 'pagamentos', label: 'Pagamentos (PSP)', descricao: 'Asaas / Mercado Pago — boleto, PIX, webhook', icon: <CreditCard size={18} strokeWidth={1.6} />, accent: t.accents.blue },
    { key: 'fiscal', label: 'Fiscal & Governo', descricao: 'Receita, SEFAZ, NFS-e, provedores', icon: <Landmark size={18} strokeWidth={1.6} />, accent: t.accents.clay },
    { key: 'financeiro', label: 'Financeiro', descricao: 'Regras de categoria', icon: <Tags size={18} strokeWidth={1.6} />, accent: t.accents.sage },
    { key: 'automacoes', label: 'Automações & Alertas', descricao: 'Regras, e-mail, WhatsApp', icon: <Bell size={18} strokeWidth={1.6} />, accent: t.accents.clay },
    { key: 'dados', label: 'Dados & Backup', descricao: 'Exportar e restaurar', icon: <Database size={18} strokeWidth={1.6} />, accent: t.accents.blue },
    { key: 'stacks', label: 'Catálogo de Stacks', descricao: 'Tecnologias', icon: <LayersSection size={18} strokeWidth={1.6} />, accent: t.accents.blue },
  ];

  const renderSecao = (): React.ReactNode => {
    switch (secao) {
      case 'conta':
        return <UsuariosPanel />;
      case 'ia': {
        const iaItems = [
          {
            key: 'conexao',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} strokeWidth={1.6} color={t.accents.peach} /> Conexão de IA (Proxy)</span>,
            extra: settings ? connBadge(settings.llm.temChave, status?.llm) : undefined,
            children: (
              <>
                <Form form={llmForm} layout="vertical" onFinish={saveLlm} requiredMark={false}>
                  <Form.Item name="provider" label="Provedor">
                    <Select
                      options={[
                        { value: 'proxy', label: 'Proxy (compatível OpenAI/Anthropic)' },
                        { value: 'anthropic', label: 'Anthropic (nativo)' },
                        { value: 'openai', label: 'OpenAI (nativo)' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: 'Informe a URL do proxy' }]}>
                    <Input placeholder="https://seu-proxy.exemplo.com/v1" />
                  </Form.Item>
                  <Form.Item name="modelo" label="Modelo padrão">
                    <Input placeholder="ex: claude-3-5-sonnet / gpt-4o" />
                  </Form.Item>
                  <Form.Item name="apiKey" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} /> Chave da API</span>} extra={settings?.llm.temChave ? 'Já existe uma chave salva. Preencha apenas para substituir.' : 'Guardada com segurança no Vault, nunca exibida.'}>
                    <Input.Password placeholder={settings?.llm.temChave ? '•••••••••• (mantida)' : 'cole a chave aqui'} autoComplete="off" />
                  </Form.Item>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button type="primary" htmlType="submit" loading={savingLlm}>Salvar conexão</Button>
                    <Button icon={<Zap size={15} />} loading={testingLlm} onClick={testarLlm} disabled={!settings?.llm.temChave}>Testar conexão</Button>
                  </div>
                </Form>

                {settings?.llm.temChave && (
                  <ModelosDisponiveisWidget
                    valorAtual={llmForm.getFieldValue('modelo')}
                    onSelect={(id) => llmForm.setFieldsValue({ modelo: id })}
                  />
                )}
              </>
            ),
          },
          {
            key: 'gemini',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} strokeWidth={1.6} color={t.accents.sage} /> Google Gemini (gratuito)</span>,
            extra: settings ? connBadge(!!settings.gemini?.temChave) : undefined,
            children: (
              <>
                <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 6 }}>Como pegar sua chave (1 min, grátis):</div>
                  <ol style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.7 }}>
                    <li>Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: t.accents.sage, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Google AI Studio <ExternalLink size={11} /></a> com a sua conta Google.</li>
                    <li>Clique em <b>“Create API key”</b> (pode usar o projeto padrão).</li>
                    <li>Copie a chave e cole abaixo. Pronto — fica guardada no Vault.</li>
                  </ol>
                </div>
                <Form form={geminiForm} layout="vertical" onFinish={saveGemini} requiredMark={false}>
                  <Form.Item name="modelo" label="Modelo" extra="gemini-3.5-flash é rápido, barato e lê PDF/imagem. (gemini-2.0-flash foi desligado pelo Google em 01/06/2026.)">
                    <Select
                      options={[
                        { value: 'gemini-3.5-flash', label: 'gemini-3.5-flash (recomendado)' },
                        { value: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (mais leve/barato)' },
                        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (mais preciso)' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="apiKey" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} /> Chave da API</span>} extra={settings?.gemini?.temChave ? 'Já existe uma chave salva. Preencha apenas para substituir.' : 'Guardada com segurança no Vault, nunca exibida.'}>
                    <Input.Password placeholder={settings?.gemini?.temChave ? '•••••••••• (mantida)' : 'AIza...'} autoComplete="off" />
                  </Form.Item>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button type="primary" htmlType="submit" loading={savingGemini} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>Salvar Gemini</Button>
                    <Button icon={<Zap size={15} />} loading={testingGemini} onClick={testarGemini} disabled={!settings?.gemini?.temChave}>Testar</Button>
                  </div>
                </Form>
              </>
            ),
          },
          {
            key: 'roteamento',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} strokeWidth={1.6} color={t.accents.blue} /> Roteamento de IA por serviço</span>,
            children: <RoteamentoIAPanel embedded />,
          },
          {
            key: 'auditoria',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} strokeWidth={1.6} color={t.accents.peach} /> Modelo de IA para Auditoria</span>,
            children: <ModeloAuditoriaPanel embedded />,
          },
        ];
        return (
          <Collapse
            defaultActiveKey={[]}
            items={iaItems}
            expandIconPosition="end"
            style={{ background: 'transparent', border: 'none' }}
            className="forja-ia-collapse"
          />
        );
      }
      case 'integracoes':
        return (
          <Panel
            title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><GitBranch size={18} strokeWidth={1.6} color={t.accents.lavender} /> GitHub</span>}
            extra={settings && connBadge(settings.github.temToken, status?.github)}
          >
            <Form form={gitForm} layout="vertical" onFinish={saveGit} requiredMark={false}>
              <Form.Item name="usuario" label="Usuário / organização" rules={[{ required: true, message: 'Informe seu usuário' }]}>
                <Input placeholder="seu-usuario" />
              </Form.Item>
              <Form.Item name="token" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} /> Personal Access Token</span>} extra={settings?.github.temToken ? 'Token já salvo. Preencha apenas para substituir.' : 'Use um token com escopo repo (somente leitura já basta).'}>
                <Input.Password placeholder={settings?.github.temToken ? '•••••••••• (mantido)' : 'ghp_...'} autoComplete="off" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={savingGit}>Conectar GitHub</Button>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: t.textTertiary, fontSize: 12 }}>
                <CheckCircle2 size={14} /> A listagem de repositórios ao vivo entra na Fase 5 (Operações).
              </div>
            </Form>
          </Panel>
        );
      case 'apis': {
        const intro = 'Cadastro central dos endpoints que você monitora por aplicação. Operações → Status mostra o mesmo em modo leitura/teste. Nunca cole chaves aqui — use só a referência (ex.: Vault/LLM).';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Plug size={18} strokeWidth={1.6} color={t.accents.peach} />
              <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>APIs & Webhooks</span>
            </div>
            <div style={{ marginBottom: 16, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>{intro}</div>
            <ApisPanel mode="full" />
          </div>
        );
      }
      case 'infra': {
        const intro = 'Inventário das instâncias que você roda (proxies LLM, automações, bancos locais, self-hosted). Atelier → Servidores mostra o mesmo em modo monitoramento (ping ao vivo). Senhas vão para o Cofre.';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Cpu size={18} strokeWidth={1.6} color={t.accents.sage} />
              <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Infraestrutura & Servidores</span>
            </div>
            <div style={{ marginBottom: 16, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>{intro}</div>
            <ServidoresPanel mode="full" />
          </div>
        );
      }
      case 'pagamentos': {
        const intro = 'Provedor de cobrança usado pelas Cobranças do Financeiro (boleto/PIX + baixa automática por webhook). Mesma configuração — editar aqui ou lá dá no mesmo.';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <CreditCard size={18} strokeWidth={1.6} color={t.accents.blue} />
              <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: t.text }}>Pagamentos (PSP)</span>
            </div>
            <div style={{ marginBottom: 16, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>{intro}</div>
            <PagamentosPanel />
          </div>
        );
      }
      case 'fiscal':
        return <IntegracoesFiscaisPanel />;
      case 'financeiro':
        return <RegrasCategoriaPanel />;
      case 'automacoes':
        return <AutomacoesPanel />;
      case 'dados':
        return <BackupRestorePanel />;
      case 'stacks':
        return (
          <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Layers size={18} strokeWidth={1.6} color={t.accents.blue} /> Catálogo de Stacks</span>}>
            <Form form={stackForm} layout="inline" onFinish={addStack} style={{ marginBottom: 18, rowGap: 10, flexWrap: 'wrap' }}>
              <Form.Item name="nome" rules={[{ required: true, message: 'Nome' }]} style={{ flex: '1 1 180px' }}>
                <Input placeholder="Nome da tecnologia" />
              </Form.Item>
              <Form.Item name="categoria" style={{ flex: '1 1 140px' }}>
                <Input placeholder="Categoria" />
              </Form.Item>
              <Form.Item name="descricao" style={{ flex: '2 1 240px' }}>
                <Input placeholder="Descrição curta" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<Plus size={16} />}>Adicionar</Button>
              </Form.Item>
            </Form>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {stacks.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '10px 12px', minWidth: 200, flex: '1 1 220px', background: t.surfaceMuted }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: t.text, fontSize: 14 }}>{s.nome}</div>
                      <Tag bordered={false} style={{ marginTop: 4, fontSize: 11, background: `${t.accents.blue}1a`, color: t.accents.blue }}>{s.categoria || 'geral'}</Tag>
                    </div>
                    <Popconfirm title="Remover stack?" onConfirm={() => removeStack(s.id)} okText="Remover" cancelText="Cancelar">
                      <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary }} />
                    </Popconfirm>
                  </div>
                  {s.descricao && <div style={{ color: t.textSecondary, fontSize: 12, marginTop: 6 }}>{s.descricao}</div>}
                </div>
              ))}
            </div>
          </Panel>
        );
      default:
        return null;
    }
  };

  const renderNavItem = (s: typeof SECOES[number]) => {
    const ativo = secao === s.key;
    return (
      <button
        key={s.key}
        onClick={() => setSecao(s.key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: isMobile ? 'auto' : '100%', flexShrink: 0,
          padding: isMobile ? '9px 14px' : '11px 12px',
          border: `1px solid ${ativo ? `${s.accent}55` : 'transparent'}`,
          borderRadius: 12, cursor: 'pointer', textAlign: 'left',
          background: ativo ? `${s.accent}14` : 'transparent',
          transition: 'background 0.16s, border-color 0.16s',
        }}
        onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = t.surfaceMuted; }}
        onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: ativo ? s.accent : `${s.accent}1f`, color: ativo ? '#fff' : s.accent,
          transition: 'background 0.16s, color 0.16s',
        }}>{s.icon}</span>
        {!isMobile && (
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              {s.status && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: s.status === 'ok' ? t.accents.sage : t.accents.peach }} />
              )}
            </span>
            <span style={{ display: 'block', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.descricao}</span>
          </span>
        )}
        {isMobile && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: ativo ? t.text : t.textSecondary, whiteSpace: 'nowrap' }}>{s.label}</span>
        )}
      </button>
    );
  };

  return (
    <div className="forja-view" style={{ padding: isMobile ? '40px 16px 40px' : '68px 40px 56px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader
        title="Configurações"
        subtitle="O Vault da Forja: conexões de IA, GitHub e catálogo de tecnologias."
        extra={<Button icon={<RefreshCw size={15} />} loading={syncing} onClick={sincronizar}>Sincronizar do Apps Script</Button>}
      />

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isMobile ? (
        <>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 18 }}>
            {SECOES.map(renderNavItem)}
          </div>
          <div key={secao} style={{ animation: 'forjaFadeIn 0.25s ease' }}>{renderSecao()}</div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start' }}>
          <nav style={{ width: 248, flexShrink: 0, position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SECOES.map(renderNavItem)}
          </nav>
          <div key={secao} style={{ flex: 1, minWidth: 0, animation: 'forjaFadeIn 0.25s ease' }}>
            {renderSecao()}
          </div>
        </div>
      )}
    </div>
  );
}
