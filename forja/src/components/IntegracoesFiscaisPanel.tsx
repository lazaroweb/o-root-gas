// IntegracoesFiscaisPanel — catálogo de conectores fiscais e de governo, por empresa.
// Cards agrupados por categoria; cada um abre um drawer com ambiente, endpoints e
// credenciais (segredos vão pro Vault, nunca exibidos). Emissão real roteia por um
// provedor (PlugNotas/Focus/Asaas); SEFAZ/cert/SOAP ficam como registro + docs.
import React, { useEffect, useState, useCallback } from 'react';
import { App as AntApp, Drawer, Segmented, Input, Button, Tag, Skeleton, Alert, Tooltip, Empty } from 'antd';
import {
  FileText, Landmark, Building2, Building, KeyRound, ExternalLink, Zap, ShieldCheck, ServerCog,
} from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface IntegCampo {
  key: string; label: string; tipo: 'text' | 'password' | 'url'; secreto: boolean;
  placeholder: string; valor?: string; tem?: boolean; ultimos?: string;
}
interface IntegConector {
  id: string; nome: string; categoria: string; descricao: string; docsUrl: string;
  accent: string; authLabel: string; nota: string; externo: string; testavel: boolean;
  ambiente: string; endpoints: { producao: string; homologacao: string }; campos: IntegCampo[];
  configurado: boolean;
}
interface IntegData {
  empresaId: string; empresaNome: string;
  categorias: Array<{ key: string; label: string }>; conectores: IntegConector[];
}

const ICONE_CAT: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
  emissao: FileText, federal: Landmark, estadual: Building2, municipal: Building,
};

export default function IntegracoesFiscaisPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [data, setData] = useState<IntegData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<IntegConector | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState('');
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  // Estado editável do drawer
  const [ambiente, setAmbiente] = useState('homologacao');
  const [endProd, setEndProd] = useState('');
  const [endHomolog, setEndHomolog] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [segredos, setSegredos] = useState<Record<string, string>>({});

  const accentDe = (a: string): string => (t.accents as Record<string, string>)[a] || t.accents.peach;

  const carregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<IntegData>>('getIntegracoesFiscais')
      .then((res) => { if (res.ok && res.data) setData(res.data as IntegData); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(carregar, [carregar]);

  const abrir = (c: IntegConector) => {
    setAberto(c);
    setAmbiente(c.ambiente || 'homologacao');
    setEndProd(c.endpoints.producao || '');
    setEndHomolog(c.endpoints.homologacao || '');
    const v: Record<string, string> = {};
    c.campos.forEach((f) => { if (!f.secreto) v[f.key] = f.valor || ''; });
    setValores(v);
    setSegredos({});
  };

  const salvar = async () => {
    if (!aberto) return;
    setSalvando(true);
    try {
      const segFiltrados: Record<string, string> = {};
      Object.keys(segredos).forEach((k) => { if (segredos[k]) segFiltrados[k] = segredos[k]; });
      const res = await callServer<ServerResponse<IntegData>>('salvarIntegracaoFiscal', aberto.id, {
        ambiente, endpoints: { producao: endProd, homologacao: endHomolog }, valores, segredos: segFiltrados,
      });
      if (res.ok && res.data) { setData(res.data as IntegData); message.success('Integração salva no Vault'); setAberto(null); }
      else message.error(res.error || 'Erro ao salvar');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };

  const testar = async (id: string) => {
    setTestando(id);
    try {
      const res = await callServer<ServerResponse<{ status: string; mensagem: string }>>('testarIntegracaoFiscal', id);
      if (res.ok && res.data) {
        const st = res.data.status;
        setTestStatus((s) => ({ ...s, [id]: st }));
        if (st === 'conectado') message.success(res.data.mensagem);
        else if (st === 'falha') message.warning(res.data.mensagem);
        else message.info(res.data.mensagem);
      } else message.error(res.error || 'Falha no teste');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Teste só funciona no app publicado'); }
    finally { setTestando(''); }
  };

  const badge = (c: IntegConector): React.ReactNode => {
    const st = testStatus[c.id];
    if (st === 'conectado') return <Tag bordered={false} style={{ background: `${t.accents.sage}22`, color: t.accents.sage, fontWeight: 600 }}>Conectado</Tag>;
    if (st === 'falha') return <Tag bordered={false} style={{ background: `${t.accents.rose}22`, color: t.accents.rose, fontWeight: 600 }}>Falha</Tag>;
    if (c.configurado) return <Tag bordered={false} style={{ background: `${t.accents.sage}1f`, color: t.accents.sage }}>Configurado</Tag>;
    return <Tag bordered={false} style={{ background: `${t.accents.peach}22`, color: t.accents.peach }}>Pendente</Tag>;
  };

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!data) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem dados (rode no app publicado)" style={{ marginTop: 40 }} />;

  const lbl: React.CSSProperties = { fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6, display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Alert
        type="info" showIcon
        message={<span>Configurando a empresa: <strong>{data.empresaNome || 'padrão'}</strong></span>}
        description="Cada CNPJ tem suas próprias credenciais e certificado. Troque a empresa ativa no Financeiro para configurar outra. A emissão de notas roteia por um provedor (PlugNotas/Focus/Asaas); SEFAZ/certificado ficam como registro + atalho da documentação."
      />

      {data.categorias.map((cat) => {
        const itens = data.conectores.filter((c) => c.categoria === cat.key);
        if (!itens.length) return null;
        const IconeCat = ICONE_CAT[cat.key] || ServerCog;
        return (
          <Panel
            key={cat.key}
            title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconeCat size={17} strokeWidth={1.6} color={t.accents.lavender} /> {cat.label}</span>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {itens.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrir(c)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', background: t.surfaceMuted,
                    border: `1px solid ${t.border}`, borderRadius: 14, padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.16s, background 0.16s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accentDe(c.accent)}66`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${accentDe(c.accent)}1f`, color: accentDe(c.accent) }}>
                      <ServerCog size={16} strokeWidth={1.7} />
                    </span>
                    {badge(c)}
                  </div>
                  <div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text }}>{c.nome}</div>
                    <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 3, lineHeight: 1.5 }}>{c.descricao}</div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 'auto' }}>
                    <KeyRound size={12} /> {c.authLabel}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        );
      })}

      <Drawer
        open={!!aberto}
        onClose={() => setAberto(null)}
        width={460}
        title={aberto ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ServerCog size={18} color={accentDe(aberto.accent)} /> {aberto.nome}</span> : ''}
        extra={aberto && !aberto.externo ? <Button type="primary" loading={salvando} onClick={salvar}>Salvar</Button> : undefined}
      >
        {aberto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {aberto.nota && <Alert type="warning" showIcon message={aberto.nota} />}

            {!aberto.externo && (
              <div>
                <span style={lbl}>Ambiente</span>
                <Segmented
                  block
                  value={ambiente}
                  onChange={(v) => setAmbiente(String(v))}
                  options={[{ value: 'homologacao', label: 'Homologação' }, { value: 'producao', label: 'Produção' }]}
                />
              </div>
            )}

            <div>
              <span style={lbl}>Endpoint — Produção</span>
              <Input value={endProd} onChange={(e) => setEndProd(e.target.value)} disabled={!!aberto.externo} placeholder="https://..." />
            </div>
            <div>
              <span style={lbl}>Endpoint — Homologação</span>
              <Input value={endHomolog} onChange={(e) => setEndHomolog(e.target.value)} disabled={!!aberto.externo} placeholder="https://..." />
            </div>

            {aberto.campos.map((f) => (
              <div key={f.key}>
                <span style={lbl}>{f.secreto ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KeyRound size={13} /> {f.label}</span> : f.label}</span>
                {f.secreto ? (
                  <Input.Password
                    autoComplete="off"
                    placeholder={f.tem ? `•••••••• (mantido${f.ultimos ? ` ····${f.ultimos}` : ''})` : f.placeholder}
                    value={segredos[f.key] || ''}
                    onChange={(e) => setSegredos((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    placeholder={f.placeholder}
                    value={valores[f.key] || ''}
                    onChange={(e) => setValores((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
                {f.secreto && (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 4 }}>
                    Guardado no Vault, nunca exibido. {f.tem ? 'Preencha só para substituir.' : ''}
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {!aberto.externo && (
                <Tooltip title={aberto.testavel ? 'Faz uma chamada de verificação na API' : 'Conector sem teste automático (provedor/certificado)'}>
                  <Button icon={<Zap size={15} />} loading={testando === aberto.id} onClick={() => testar(aberto.id)} disabled={!aberto.configurado && !aberto.testavel}>
                    Testar conexão
                  </Button>
                </Tooltip>
              )}
              <a href={aberto.docsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: accentDe(aberto.accent), fontFamily: FONTS.ui, fontSize: 12.5 }}>
                Documentação <ExternalLink size={13} />
              </a>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 11.5 }}>
              <ShieldCheck size={14} /> {aberto.authLabel}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
