import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Switch, Button, Select, Tag, Skeleton, App as AntApp, Tooltip, Row, Col, Progress, Alert, Collapse } from 'antd';
import { Bell, Zap, RefreshCw, Play, AlertTriangle, AlertCircle, Mail, Webhook, CheckCircle2, Sparkles, Clock, Wand2, MessageCircle } from 'lucide-react';
import { Panel } from './ui';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { AutomationConfig, AuditoriaAgendadaStatus, ServerResult } from '../types';

export default function AutomacoesPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [cfg, setCfg] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [auditStatus, setAuditStatus] = useState<AuditoriaAgendadaStatus | null>(null);
  const [runningAudit, setRunningAudit] = useState(false);
  const [form] = Form.useForm();
  const waProvider = Form.useWatch('wa_provider', form) as 'meta' | 'twilio' | undefined;
  const waOn = Form.useWatch('whatsapp', form) as boolean | undefined;

  const carregar = () => {
    setLoading(true);
    callServer<ServerResult>('getAutomationsSettings')
      .then((r) => {
        if (r.ok && r.data) {
          const c = r.data as AutomationConfig;
          setCfg(c);
          form.setFieldsValue({
            intervaloMin: c.intervaloMin,
            email: c.canais.email,
            webhook: c.canais.webhook,
            webhookUrl: c.webhookUrl || '',
            whatsapp: c.canais.whatsapp,
            wa_provider: c.whatsapp?.provider || 'meta',
            wa_destinos: c.whatsapp?.destinos || [],
            wa_metaPhoneNumberId: c.whatsapp?.metaPhoneNumberId || '',
            wa_metaToken: '',
            wa_metaTemplate: c.whatsapp?.metaTemplate || '',
            wa_metaTemplateLang: c.whatsapp?.metaTemplateLang || 'pt_BR',
            wa_twilioSid: c.whatsapp?.twilioSid || '',
            wa_twilioToken: '',
            wa_twilioFrom: c.whatsapp?.twilioFrom || '',
            r_appOffline: c.regras.appOffline.ativo,
            r_apiOffline: c.regras.apiOffline.ativo,
            r_contaVence: c.regras.contaVence.ativo,
            r_contaVenceDias: c.regras.contaVence.diasAntes,
            r_saudeBaixa: c.regras.saudeBaixa.ativo,
            r_saudeBaixaMin: c.regras.saudeBaixa.minimo,
            r_custoSubiu: c.regras.custoSubiu.ativo,
            r_custoSubiuPct: c.regras.custoSubiu.pctLimite,
            r_mrrCaiu: c.regras.mrrCaiu.ativo,
            r_mrrCaiuPct: c.regras.mrrCaiu.pctLimite,
            r_auditAg: c.regras.auditoriaAgendada?.ativo || false,
            r_auditAgFreq: c.regras.auditoriaAgendada?.frequenciaDias || 7,
            r_auditAgMax: c.regras.auditoriaAgendada?.maxPorCiclo || 2,
            r_auditAgAlerta: c.regras.auditoriaAgendada?.alertarSeAlta ?? true,
            r_auditAgPularApos: c.regras.auditoriaAgendada?.pularAposentados ?? true,
          });
        }
      })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
    callServer<ServerResult>('getAuditoriaAgendadaStatus')
      .then((r) => { if (r.ok && r.data) setAuditStatus(r.data as AuditoriaAgendadaStatus); })
      .catch(() => { /* não bloqueia */ });
  };

  useEffect(carregar, []);

  const montarPayload = (v: Record<string, unknown>) => ({
    intervaloMin: Number(v.intervaloMin) || 30,
    canais: { email: !!v.email, webhook: !!v.webhook, whatsapp: !!v.whatsapp },
    webhookUrl: String(v.webhookUrl || ''),
    whatsapp: {
      provider: (v.wa_provider === 'twilio' ? 'twilio' : 'meta') as 'meta' | 'twilio',
      destinos: Array.isArray(v.wa_destinos) ? (v.wa_destinos as string[]) : [],
      metaPhoneNumberId: String(v.wa_metaPhoneNumberId || ''),
      metaToken: String(v.wa_metaToken || ''),
      metaTemplate: String(v.wa_metaTemplate || ''),
      metaTemplateLang: String(v.wa_metaTemplateLang || 'pt_BR'),
      twilioSid: String(v.wa_twilioSid || ''),
      twilioToken: String(v.wa_twilioToken || ''),
      twilioFrom: String(v.wa_twilioFrom || ''),
    },
    regras: {
      appOffline: { ativo: !!v.r_appOffline },
      apiOffline: { ativo: !!v.r_apiOffline },
      contaVence: { ativo: !!v.r_contaVence, diasAntes: Number(v.r_contaVenceDias) || 7 },
      saudeBaixa: { ativo: !!v.r_saudeBaixa, minimo: Number(v.r_saudeBaixaMin) || 50 },
      custoSubiu: { ativo: !!v.r_custoSubiu, pctLimite: Number(v.r_custoSubiuPct) || 20 },
      mrrCaiu: { ativo: !!v.r_mrrCaiu, pctLimite: Number(v.r_mrrCaiuPct) || 15 },
      auditoriaAgendada: {
        ativo: !!v.r_auditAg,
        frequenciaDias: Number(v.r_auditAgFreq) || 7,
        maxPorCiclo: Number(v.r_auditAgMax) || 2,
        alertarSeAlta: !!v.r_auditAgAlerta,
        pularAposentados: !!v.r_auditAgPularApos,
      },
    },
  });

  const salvar = (v: Record<string, unknown>) => {
    setSaving(true);
    callServer<ServerResult>('saveAutomationsSettings', montarPayload(v))
      .then((r) => {
        if (r.ok) { message.success('Regras salvas'); carregar(); }
        else message.error(r.error || 'Erro ao salvar');
      })
      .catch(() => message.error('Salvar só funciona no app publicado'))
      .finally(() => setSaving(false));
  };

  const toggleAtivo = (ativar: boolean) => {
    setToggling(true);
    const intervalo = form.getFieldValue('intervaloMin') || 30;
    const fn = ativar ? 'ativarAutomacoes' : 'desativarAutomacoes';
    callServer<ServerResult>(fn, intervalo)
      .then((r) => {
        if (r.ok) { message.success(ativar ? `Automações ligadas (a cada ${intervalo}min)` : 'Automações pausadas'); carregar(); }
        else message.error(r.error || 'Erro');
      })
      .catch(() => message.error('Só funciona no app publicado'))
      .finally(() => setToggling(false));
  };

  const rodarAgora = () => {
    setRunning(true);
    callServer<ServerResult>('rodarAutomacoesAgora')
      .then((r) => {
        if (r.ok) message.success('Avaliação concluída. Veja o sino na lateral.');
        else message.error(r.error || 'Erro');
      })
      .catch(() => message.error('Só funciona no app publicado'))
      .finally(() => setRunning(false));
  };

  const rodarAuditAgora = () => {
    setRunningAudit(true);
    callServer<ServerResult>('rodarAuditoriaAgendadaAgora')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { processados: number; ignorados: number; criticosNovos: number; novosAlertas: number };
          if (d.processados === 0) {
            message.info('Nenhum sistema elegível agora — todos foram auditados recentemente.');
          } else {
            message.success(
              `${d.processados} sistema${d.processados > 1 ? 's' : ''} auditado${d.processados > 1 ? 's' : ''}` +
              (d.criticosNovos ? `, ${d.criticosNovos} finding${d.criticosNovos > 1 ? 's' : ''} de severidade alta` : '') +
              (d.novosAlertas ? `, ${d.novosAlertas} alerta${d.novosAlertas > 1 ? 's' : ''}.` : '.'),
            );
          }
          carregar();
        } else {
          message.error(r.error || 'Erro');
        }
      })
      .catch(() => message.error('Só funciona no app publicado'))
      .finally(() => setRunningAudit(false));
  };

  const testarWh = () => {
    const url = form.getFieldValue('webhookUrl');
    if (!url) { message.warning('Cole a URL do webhook primeiro'); return; }
    setTesting(true);
    callServer<ServerResult>('testarWebhook', url)
      .then((r) => {
        if (r.ok) message.success('Webhook OK — confira o canal de destino');
        else message.error(r.error || 'Webhook não respondeu');
      })
      .catch(() => message.error('Só funciona no app publicado'))
      .finally(() => setTesting(false));
  };

  // Salva a config atual (o teste no servidor lê o que está salvo) e dispara
  // uma mensagem de teste pra todos os destinos.
  const testarWa = async () => {
    setTestingWa(true);
    try {
      const v = await form.validateFields();
      const s = await callServer<ServerResult>('saveAutomationsSettings', montarPayload(v as Record<string, unknown>));
      if (!s.ok) { message.error(s.error || 'Erro ao salvar antes do teste'); return; }
      const r = await callServer<ServerResult>('testarWhatsapp');
      if (r.ok) {
        const d = (r.data as { enviados?: number; avisos?: string[] } | undefined) || {};
        if (d.avisos && d.avisos.length) message.warning(`Enviado para ${d.enviados}, mas houve avisos: ${d.avisos.join(' | ')}`, 8);
        else message.success(`WhatsApp enviado para ${d.enviados || 0} número(s) — confira o app.`);
        carregar();
      } else {
        message.error(r.error || 'Não foi possível enviar', 8);
      }
    } catch {
      message.error('Revise os campos do WhatsApp');
    } finally {
      setTestingWa(false);
    }
  };

  if (loading) return <Panel title="Automações"><Skeleton active paragraph={{ rows: 6 }} /></Panel>;

  const ativo = !!cfg?.ativo;

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Bell size={18} strokeWidth={1.6} color={t.accents.peach} /> Automações & Alertas</span>}
      extra={
        <Tag bordered={false} style={{ background: ativo ? `${t.accents.sage}22` : `${t.accents.peach}22`, color: ativo ? t.accents.sage : t.accents.peach, fontWeight: 600 }}>
          {ativo ? `ativas · ${cfg?.intervaloMin}min` : 'pausadas'}
        </Tag>
      }
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <Button
          type={ativo ? 'default' : 'primary'}
          icon={<Zap size={15} />}
          loading={toggling}
          onClick={() => toggleAtivo(!ativo)}
        >
          {ativo ? 'Pausar automações' : 'Ligar automações'}
        </Button>
        <Button icon={<Play size={15} />} loading={running} onClick={rodarAgora}>
          Rodar agora (teste)
        </Button>
        <Button icon={<RefreshCw size={15} />} onClick={carregar}>
          Recarregar
        </Button>
        {cfg?.ultimaExec && (
          <span style={{ alignSelf: 'center', color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12 }}>
            última execução: {new Date(cfg.ultimaExec).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Row gutter={[18, 0]}>
          <Col xs={24} md={8}>
            <Form.Item name="intervaloMin" label="Intervalo de verificação">
              <Select
                options={[
                  { value: 10, label: 'A cada 10 minutos' },
                  { value: 15, label: 'A cada 15 minutos' },
                  { value: 30, label: 'A cada 30 minutos (recomendado)' },
                  { value: 60, label: 'A cada hora' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ fontFamily: FONTS.display, fontSize: 16, color: t.text, margin: '8px 0 12px' }}>Canais de notificação</div>
        <Row gutter={[18, 0]} style={{ marginBottom: 8 }}>
          <Col xs={24} md={8}>
            <Form.Item name="email" valuePropName="checked" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={14} color={t.accents.blue} /> E-mail</span>} extra={<span style={{ fontSize: 12, color: t.textTertiary }}>Enviado para o e-mail da conta Google.</span>}>
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item name="webhook" valuePropName="checked" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Webhook size={14} color={t.accents.lavender} /> Webhook (Slack / Discord)</span>}>
              <Switch />
            </Form.Item>
            <Form.Item name="webhookUrl" label="URL do webhook" extra={<span style={{ fontSize: 12, color: t.textTertiary }}>Cole a URL de incoming webhook do Slack ou do Discord.</span>}>
              <Input placeholder="https://hooks.slack.com/services/... ou https://discord.com/api/webhooks/..." addonAfter={<Button type="link" size="small" icon={<Zap size={13} />} loading={testing} onClick={testarWh}>testar</Button>} />
            </Form.Item>
          </Col>
        </Row>

        {/* WhatsApp — card próprio porque tem credenciais e dois providers */}
        <div style={{ marginTop: 6, padding: 18, border: `1px solid ${t.borderSoft}`, borderRadius: 14, background: `linear-gradient(135deg, ${t.surface}, ${t.accents.sage}0a)` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: `${t.accents.sage}22`, color: t.accents.sage, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={18} strokeWidth={1.7} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text }}>WhatsApp</span>
                <Tag bordered={false} style={{ background: `${t.accents.lavender}22`, color: t.accents.lavender, fontSize: 10 }}>NOVO</Tag>
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginTop: 3, lineHeight: 1.55 }}>
                Recebe os alertas (incluindo vencimentos) no WhatsApp dos números cadastrados.
              </div>
            </div>
            <Form.Item name="whatsapp" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>

          <Row gutter={[14, 0]} style={{ marginTop: 14 }}>
            <Col xs={24} md={8}>
              <Form.Item name="wa_provider" label={<span style={{ fontSize: 12 }}>Provedor</span>}>
                <Select
                  options={[
                    { value: 'meta', label: 'Meta Cloud API (oficial)' },
                    { value: 'twilio', label: 'Twilio' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item
                name="wa_destinos"
                label={<span style={{ fontSize: 12 }}>Números de destino</span>}
                extra={<span style={{ fontSize: 12, color: t.textTertiary }}>Formato internacional, ex.: +55 71 99999-9999. Digite e tecle Enter para adicionar vários.</span>}
              >
                <Select mode="tags" tokenSeparators={[',', ' ']} open={false} placeholder="+5571999999999" />
              </Form.Item>
            </Col>
          </Row>

          {waProvider !== 'twilio' ? (
            <Row gutter={[14, 0]}>
              <Col xs={24} md={8}>
                <Form.Item name="wa_metaPhoneNumberId" label={<span style={{ fontSize: 12 }}>Phone Number ID</span>}>
                  <Input placeholder="ex.: 123456789012345" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="wa_metaToken" label={<span style={{ fontSize: 12 }}>Token de acesso</span>} extra={cfg?.whatsapp?.metaTokenSet ? <span style={{ fontSize: 11, color: t.textTertiary }}>Token salvo. Preencha só para substituir.</span> : undefined}>
                  <Input.Password autoComplete="off" placeholder={cfg?.whatsapp?.metaTokenSet ? '•••••••••• (mantido)' : 'EAAB...'} />
                </Form.Item>
              </Col>
              <Col xs={12} md={5}>
                <Form.Item name="wa_metaTemplate" label={<span style={{ fontSize: 12 }}>Template (opcional)</span>}>
                  <Input placeholder="ex.: alerta_forja" />
                </Form.Item>
              </Col>
              <Col xs={12} md={3}>
                <Form.Item name="wa_metaTemplateLang" label={<span style={{ fontSize: 12 }}>Idioma</span>}>
                  <Input placeholder="pt_BR" />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={[14, 0]}>
              <Col xs={24} md={8}>
                <Form.Item name="wa_twilioSid" label={<span style={{ fontSize: 12 }}>Account SID</span>}>
                  <Input placeholder="ACxxxxxxxx..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="wa_twilioToken" label={<span style={{ fontSize: 12 }}>Auth Token</span>} extra={cfg?.whatsapp?.twilioTokenSet ? <span style={{ fontSize: 11, color: t.textTertiary }}>Token salvo. Preencha só para substituir.</span> : undefined}>
                  <Input.Password autoComplete="off" placeholder={cfg?.whatsapp?.twilioTokenSet ? '•••••••••• (mantido)' : 'seu auth token'} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="wa_twilioFrom" label={<span style={{ fontSize: 12 }}>Número remetente</span>}>
                  <Input placeholder="whatsapp:+14155238886" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Alert
            type="info"
            showIcon
            style={{ marginTop: 4, marginBottom: 12 }}
            message={
              waProvider !== 'twilio'
                ? 'Mensagens proativas exigem um template aprovado pela Meta. Para testar sem template, use um número de teste da Meta com destinatários verificados (deixe o campo Template vazio).'
                : 'No Sandbox da Twilio, cada destinatário precisa enviar o código de adesão para o número da Twilio antes de receber mensagens.'
            }
          />

          <Button icon={<Zap size={14} />} loading={testingWa} onClick={() => void testarWa()} disabled={!waOn}>
            Salvar e enviar teste
          </Button>

          <Collapse
            ghost
            style={{ marginTop: 12 }}
            items={[
              {
                key: 'twilio',
                label: <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Como ativar — Twilio (mais rápido para testar)</span>,
                children: (
                  <ol style={{ margin: 0, paddingLeft: 18, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.7 }}>
                    <li>Crie uma conta em <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noreferrer">twilio.com</a>.</li>
                    <li>No console, vá em <strong>Messaging → Try it out → Send a WhatsApp message</strong> (Sandbox).</li>
                    <li>Cada número (o seu e os da família) precisa enviar a frase de adesão (ex.: <code>join &lt;palavra&gt;</code>) para o número do Sandbox da Twilio.</li>
                    <li>Copie o <strong>Account SID</strong> e o <strong>Auth Token</strong> (na home do console) e o <strong>número remetente</strong> do Sandbox (ex.: <code>whatsapp:+14155238886</code>).</li>
                    <li>Aqui no FORJA: provedor <strong>Twilio</strong>, cole SID, Token e remetente, adicione os números e clique <strong>Salvar e enviar teste</strong>.</li>
                    <li>Para produção (qualquer destinatário, fora do sandbox): peça aprovação de um sender/template WhatsApp na Twilio.</li>
                  </ol>
                ),
              },
              {
                key: 'meta',
                label: <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Como ativar — Meta Cloud API (oficial, gratuito)</span>,
                children: (
                  <ol style={{ margin: 0, paddingLeft: 18, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.7 }}>
                    <li>Acesse <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer">developers.facebook.com</a> e crie um app do tipo <strong>Business</strong>.</li>
                    <li>Adicione o produto <strong>WhatsApp</strong> ao app.</li>
                    <li>Na aba de configuração da API, copie o <strong>Phone Number ID</strong> e gere um <strong>Token de acesso</strong> (temporário de 24h para testar; depois um permanente via System User).</li>
                    <li>Em <strong>"To"</strong>, adicione os números que vão receber como <strong>destinatários de teste</strong> (eles confirmam por código).</li>
                    <li>Aqui no FORJA: provedor <strong>Meta Cloud API</strong>, cole Phone Number ID e Token, adicione os números e deixe o campo <strong>Template vazio</strong>; clique <strong>Salvar e enviar teste</strong>.</li>
                    <li>Para produção (mensagem proativa para qualquer número, fora da janela de 24h): crie um <strong>template</strong> no WhatsApp Manager, aguarde a aprovação e preencha o nome dele no campo <strong>Template</strong> (idioma ex.: <code>pt_BR</code>).</li>
                  </ol>
                ),
              },
              {
                key: 'notas',
                label: <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>Observações importantes</span>,
                children: (
                  <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.7 }}>
                    <li>Mensagens <strong>proativas</strong> (alertas) exigem template aprovado (Meta) ou sender aprovado (Twilio). Para testar antes disso, use número de teste (Meta) / Sandbox (Twilio).</li>
                    <li>Na Meta Cloud API o número usado vira "número de negócio" e <strong>não pode estar ativo no app WhatsApp comum</strong> — costuma-se usar um chip/número secundário.</li>
                    <li>Depois de configurar, lembre de clicar em <strong>"Ligar automações"</strong> no topo para os disparos rodarem sozinhos.</li>
                    <li>Os tokens ficam guardados no servidor e nunca voltam para a tela; preencha de novo só para substituir.</li>
                  </ul>
                ),
              },
            ]}
          />
        </div>

        <div style={{ fontFamily: FONTS.display, fontSize: 16, color: t.text, margin: '14px 0 12px' }}>Regras</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RegraLinha cor={t.accents.rose} icon={<AlertCircle size={16} strokeWidth={1.7} />} titulo="App fora do ar" descricao="Notifica quando a URL de produção de qualquer Sistema deixar de responder." switchName="r_appOffline" />
          <RegraLinha cor={t.accents.peach} icon={<AlertTriangle size={16} strokeWidth={1.7} />} titulo="API fora do ar" descricao="Notifica quando uma API cadastrada (proxy, endpoint) parar de responder." switchName="r_apiOffline" />
          <RegraLinha cor={t.accents.clay} icon={<CheckCircle2 size={16} strokeWidth={1.7} />} titulo="Conta a vencer" descricao="Avisa N dias antes de uma cobrança recorrente vencer." switchName="r_contaVence">
            <Form.Item name="r_contaVenceDias" noStyle><InputNumber min={1} max={30} addonAfter="dias antes" style={{ width: 140 }} /></Form.Item>
          </RegraLinha>
          <RegraLinha cor={t.accents.peach} icon={<AlertTriangle size={16} strokeWidth={1.7} />} titulo="Saúde baixa" descricao="Alerta quando o score de saúde de um Sistema fica abaixo do limite." switchName="r_saudeBaixa">
            <Form.Item name="r_saudeBaixaMin" noStyle><InputNumber min={0} max={100} addonAfter="abaixo de" style={{ width: 140 }} /></Form.Item>
          </RegraLinha>
          <RegraLinha cor={t.accents.blue} icon={<AlertTriangle size={16} strokeWidth={1.7} />} titulo="Custos subiram no mês" descricao="Avisa quando a soma de custos mensais cresce além do limite (compara com o mês anterior)." switchName="r_custoSubiu">
            <Form.Item name="r_custoSubiuPct" noStyle><InputNumber min={1} max={500} addonAfter="% ou mais" style={{ width: 140 }} /></Form.Item>
          </RegraLinha>
          <RegraLinha cor={t.accents.lavender} icon={<AlertTriangle size={16} strokeWidth={1.7} />} titulo="MRR caiu no mês" descricao="Alerta quando a receita recorrente mensal cai além do limite." switchName="r_mrrCaiu">
            <Form.Item name="r_mrrCaiuPct" noStyle><InputNumber min={1} max={100} addonAfter="% ou mais" style={{ width: 140 }} /></Form.Item>
          </RegraLinha>
        </div>

        {/* Auditoria agendada — card especial porque tem mais controles */}
        <div style={{ marginTop: 18, padding: 18, border: `1px solid ${t.borderSoft}`, borderRadius: 14, background: `linear-gradient(135deg, ${t.surface}, ${t.accents.peach}0a)` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: `${t.accents.peach}22`, color: t.accents.peach, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={18} strokeWidth={1.7} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 15.5, fontWeight: 600, color: t.text }}>Auditoria agendada — Forja AI em background</span>
                <Tooltip title="A Forja AI roda enquanto você dorme. Cada ciclo audita até N sistemas que tenham mais de X dias sem auditoria.">
                  <Tag bordered={false} style={{ background: `${t.accents.lavender}22`, color: t.accents.lavender, fontSize: 10 }}>NOVO</Tag>
                </Tooltip>
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginTop: 3, lineHeight: 1.55 }}>
                Re-audita seus sistemas periodicamente. Cria alertas se a IA encontrar findings de severidade alta. Processo limitado pra não estourar o tempo do GAS.
              </div>
            </div>
            <Form.Item name="r_auditAg" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>

          <Row gutter={[14, 0]} style={{ marginTop: 14 }}>
            <Col xs={24} md={8}>
              <Form.Item name="r_auditAgFreq" label={<span style={{ fontSize: 12 }}>Re-auditar após</span>}>
                <Select
                  options={[
                    { value: 3, label: '3 dias (intensivo)' },
                    { value: 7, label: '7 dias (semanal — recomendado)' },
                    { value: 14, label: '14 dias' },
                    { value: 30, label: '30 dias (mensal)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="r_auditAgMax" label={<span style={{ fontSize: 12 }}>Máx por ciclo (1x/dia)</span>}>
                <InputNumber min={1} max={5} style={{ width: '100%' }} addonAfter="sistemas" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="r_auditAgAlerta" valuePropName="checked" label={<span style={{ fontSize: 12 }}>Alertar se finding ALTO</span>}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="r_auditAgPularApos" valuePropName="checked" label={<span style={{ fontSize: 12 }}>Pular sistemas aposentados</span>} style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>

          {/* Status do ciclo */}
          {auditStatus && auditStatus.sistemas.total > 0 && (
            <div style={{ marginTop: 14, padding: 14, background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color={t.textTertiary} />
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Status do ciclo</span>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<Wand2 size={13} />}
                  loading={runningAudit}
                  onClick={rodarAuditAgora}
                  disabled={!auditStatus.ativo}
                >
                  Rodar ciclo agora
                </Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
                <StatBlock label="Total" valor={auditStatus.sistemas.total} cor={t.text} />
                <StatBlock label="Nunca auditados" valor={auditStatus.sistemas.nuncaAuditados} cor={auditStatus.sistemas.nuncaAuditados > 0 ? t.accents.peach : t.textTertiary} />
                <StatBlock label="Vencidos" valor={auditStatus.sistemas.stale} cor={auditStatus.sistemas.stale > 0 ? t.accents.clay : t.textTertiary} />
                <StatBlock label="Em dia" valor={auditStatus.sistemas.recentes} cor={t.accents.sage} />
                {auditStatus.sistemas.aposentadosPulados > 0 && (
                  <StatBlock label="Pulados" valor={auditStatus.sistemas.aposentadosPulados} cor={t.textTertiary} />
                )}
              </div>

              {auditStatus.sistemas.total > 0 && (
                <>
                  <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>
                    Cobertura: {auditStatus.sistemas.recentes}/{auditStatus.sistemas.total - auditStatus.sistemas.aposentadosPulados} sistemas em dia
                  </div>
                  <Progress
                    percent={Math.round((auditStatus.sistemas.recentes / Math.max(1, auditStatus.sistemas.total - auditStatus.sistemas.aposentadosPulados)) * 100)}
                    showInfo={false}
                    strokeColor={t.accents.sage}
                    trailColor={t.surfaceMuted}
                    size="small"
                  />
                </>
              )}

              {auditStatus.ultimoCiclo && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 8 }}>
                  Último ciclo: {new Date(auditStatus.ultimoCiclo).toLocaleString('pt-BR')} · próximo: {auditStatus.proximoCicloEm ? new Date(auditStatus.proximoCicloEm).toLocaleString('pt-BR') : '—'}
                </div>
              )}
              {auditStatus.elegiveis === 0 && auditStatus.ativo && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.sage, marginTop: 6 }}>
                  ✓ Todos os sistemas elegíveis estão em dia.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 22 }}>
          <Button type="primary" htmlType="submit" loading={saving}>Salvar regras</Button>
          <span style={{ marginLeft: 14, color: t.textTertiary, fontSize: 12, fontFamily: FONTS.ui }}>
            Cada alerta tem dedup automático — você não recebe a mesma notificação repetida em menos de 24h.
          </span>
        </div>
      </Form>
    </Panel>
  );
}

interface RegraLinhaProps {
  cor: string;
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  switchName: string;
  children?: React.ReactNode;
}

function StatBlock({ label, valor, cor }: { label: string; valor: number; cor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ padding: '8px 10px', background: t.surfaceMuted, borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: cor, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

function RegraLinha({ cor, icon, titulo, descricao, switchName, children }: RegraLinhaProps): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: `1px solid ${t.borderSoft}`, borderRadius: 12, background: t.surface }}>
      <span style={{ color: cor, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.ui, fontWeight: 600, fontSize: 14, color: t.text }}>{titulo}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2 }}>{descricao}</div>
      </div>
      {children && <div>{children}</div>}
      <Form.Item name={switchName} valuePropName="checked" noStyle>
        <Switch />
      </Form.Item>
    </div>
  );
}
