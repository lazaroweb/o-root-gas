// PagamentosPanel — configuração do provedor de cobrança (PSP) no hub de Conexões.
//
// Centralização v1.188.1 (Fase 2): mesma fonte de verdade do modal "Configurar
// PSP" do Financeiro (RPCs cobrancaConfigGet / cobrancaConfigSalvar). Os dois
// editam o mesmo backend, então ficam sempre em sincronia.
import React, { useEffect, useState } from 'react';
import { Form, Segmented, Select, Input, Button, App as AntApp, Skeleton } from 'antd';
import { Link2, Copy, KeyRound, Zap } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { CobrancaConfig, ServerResponse } from '../types';

export default function PagamentosPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [config, setConfig] = useState<CobrancaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [provider, setProvider] = useState<'asaas' | 'mercadopago'>('asaas');

  const aplicar = (cfg: CobrancaConfig | null) => {
    const prov = (cfg?.provider as 'asaas' | 'mercadopago') || 'asaas';
    setProvider(prov);
    form.setFieldsValue({ provider: prov, env: cfg?.env || 'sandbox', apiKey: '' });
    setWebhookUrl(cfg?.webhookUrl || '');
  };

  const carregar = () => {
    setLoading(true);
    callServer<ServerResponse<CobrancaConfig>>('cobrancaConfigGet')
      .then((r) => { if (r.ok && r.data) { setConfig(r.data as CobrancaConfig); aplicar(r.data as CobrancaConfig); } })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };

  useEffect(carregar, []);

  const isMP = provider === 'mercadopago';
  const provConfigurado = isMP ? !!config?.mpConfigurado : !!config?.asaasConfigurado;
  const chaveAtual = config?.provider === provider ? config?.chaveMascarada : '';

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await callServer<ServerResponse<CobrancaConfig>>('cobrancaConfigSalvar', {
        provider, env: v.env, apiKey: v.apiKey,
      });
      if (res.ok && res.data) {
        const cfg = res.data as CobrancaConfig;
        setConfig(cfg);
        setWebhookUrl(cfg.webhookUrl || '');
        form.setFieldValue('apiKey', '');
        message.success('Configuração de pagamento salva');
      } else message.error(res.error || 'Erro');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const copiarWebhook = () => {
    if (!webhookUrl) { message.warning('Salve a configuração pra gerar a URL de webhook.'); return; }
    navigator.clipboard?.writeText(webhookUrl).then(() => message.success('URL de webhook copiada'));
  };

  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Provedor de cobrança (boleto/PIX com baixa automática por webhook). Apenas provedores por <strong>token</strong>
        funcionam no Google Apps Script — Nubank e C6 exigem certificado (mTLS) e não dá pra integrar direto. Esta é a
        mesma configuração usada em Financeiro → Cobranças.
      </div>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item label="Provedor (PSP)">
          <Segmented
            block
            value={provider}
            onChange={(v) => { const p = v as 'asaas' | 'mercadopago'; setProvider(p); form.setFieldsValue({ provider: p, apiKey: '' }); }}
            options={[
              { value: 'asaas', label: `Asaas${config?.asaasConfigurado ? ' ✓' : ''}` },
              { value: 'mercadopago', label: `Mercado Pago${config?.mpConfigurado ? ' ✓' : ''}` },
            ]}
          />
        </Form.Item>
        <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: -8, marginBottom: 12 }}>
          {isMP
            ? 'Mercado Pago: PIX e boleto como pagamento direto; "Boleto + PIX" gera um link de checkout. Tarifa por % da transação.'
            : 'Asaas: boleto + PIX na mesma cobrança, tarifa flat baixa. Recomendado pra SaaS PME.'}
        </div>
        <Form.Item name="env" label="Ambiente" extra={isMP ? 'No Mercado Pago, o ambiente é definido pelo tipo do token (TEST- vs APP_USR-).' : undefined}>
          <Select options={[{ value: 'sandbox', label: 'Sandbox (testes)' }, { value: 'producao', label: 'Produção' }]} />
        </Form.Item>
        <Form.Item name="provider" hidden><Input /></Form.Item>
        <Form.Item
          name="apiKey"
          label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} /> {isMP ? 'Access Token (Bearer)' : 'Chave de API (access_token)'}</span>}
          extra={provConfigurado ? `Chave atual: ${chaveAtual || '••••'} — deixe em branco pra manter.` : (isMP ? 'Cole o Access Token das suas credenciais no painel do Mercado Pago.' : 'Cole a API key gerada no painel do Asaas.')}
        >
          <Input.Password placeholder={provConfigurado ? '•••• (manter atual)' : (isMP ? 'APP_USR-... ou TEST-...' : '$aact_...')} autoComplete="off" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} icon={<Zap size={15} />}>Salvar configuração</Button>
      </Form>

      <div style={{ marginTop: 16, padding: 12, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 6 }}>
          <Link2 size={14} color={t.accents.blue} /> URL de webhook
        </div>
        <div style={{ fontSize: 11.5, color: t.textTertiary, marginBottom: 8 }}>
          {isMP
            ? 'Cadastre esta URL no painel do Mercado Pago (Suas integrações → Webhooks, evento "Pagamentos"). Já vem com o token de segurança embutido.'
            : 'Cadastre esta URL no painel do Asaas (Notificações → Webhooks). Já vem com o token de segurança embutido.'} A baixa automática depende dela.
        </div>
        {webhookUrl ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input readOnly value={webhookUrl} style={{ fontFamily: FONTS.mono, fontSize: 11.5 }} />
            <Button icon={<Copy size={14} />} onClick={copiarWebhook}>Copiar</Button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: t.textTertiary }}>Salve a configuração pra gerar a URL.</div>
        )}
      </div>
    </div>
  );
}
