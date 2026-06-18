import React, { useState, useEffect } from 'react';
import { Button, Empty, Spin, Tag, App as AntApp } from 'antd';
import { RefreshCw, ExternalLink, Server } from 'lucide-react';
import { Panel, StatusDot } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { AppStatusItem, ServerResponse } from '../types';

export default function OpsAplicacoes(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [apps, setApps] = useState<AppStatusItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = () => {
    setLoading(true);
    callServer<ServerResponse<AppStatusItem[]>>('getAppStatus')
      .then(res => { if (res.ok && res.data) setApps(res.data as AppStatusItem[]); else message.error(res.error || 'Erro'); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };
  useEffect(carregar, []);

  const tag = (conectado: boolean, temUrl = true) => {
    if (!temUrl) return <Tag bordered={false} style={{ background: `${t.textTertiary}22`, color: t.textTertiary }}>Sem URL</Tag>;
    return <Tag bordered={false} style={{ background: conectado ? `${t.accents.sage}22` : `${t.accents.rose}22`, color: conectado ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>{conectado ? 'No ar' : 'Fora do ar'}</Tag>;
  };

  const online = apps ? apps.filter(a => a.temUrl && a.conectado).length : 0;
  const comUrl = apps ? apps.filter(a => a.temUrl).length : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ color: t.textSecondary, fontSize: 13.5 }}>Ping ao vivo da URL de produção de cada app e dos endpoints vinculados.</span>
        <Button icon={<RefreshCw size={15} />} loading={loading} onClick={carregar}>Revalidar</Button>
      </div>

      <Panel
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Server size={18} strokeWidth={1.6} color={t.accents.sage} /> Status das aplicações</span>}
        extra={apps ? <Tag bordered={false} style={{ background: online === comUrl ? `${t.accents.sage}22` : `${t.accents.clay}22`, color: online === comUrl ? t.accents.sage : t.accents.clay, fontWeight: 600 }}>{online}/{comUrl} no ar</Tag> : null}
        padding={8}
      >
        {loading && !apps ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : !apps || apps.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma aplicação cadastrada" style={{ padding: 32 }} />
        ) : (
          apps.map((a) => (
            <div key={a.id} style={{ borderBottom: `1px solid ${t.borderSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}>
                <StatusDot color={!a.temUrl ? t.textTertiary : a.conectado ? t.accents.sage : t.accents.rose} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{a.nome}</span>
                    <Tag bordered={false} style={{ background: `${t.accents.lavender}1a`, color: t.accents.lavender, fontSize: 11, textTransform: 'capitalize' }}>{a.estagio}</Tag>
                  </div>
                  <div style={{ color: t.textTertiary, fontSize: 12, fontFamily: FONTS.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.urlProd || 'sem URL de produção'}</div>
                </div>
                <div style={{ minWidth: 120, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  {tag(a.conectado, a.temUrl)}
                  {a.temUrl && <span style={{ color: t.textTertiary, fontSize: 11, fontFamily: FONTS.mono }}>{a.status ? `HTTP ${a.status}` : 'sem resposta'}{a.latenciaMs ? ` · ${a.latenciaMs}ms` : ''}</span>}
                </div>
                {a.urlProd && <Button type="text" size="small" icon={<ExternalLink size={15} />} href={a.urlProd} target="_blank" />}
              </div>
              {a.endpoints.length > 0 && (
                <div style={{ padding: '0 14px 12px 36px' }}>
                  {a.endpoints.map((e) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <StatusDot color={e.conectado ? t.accents.sage : t.accents.rose} />
                      <span style={{ flex: 1, color: t.textSecondary, fontSize: 13 }}>{e.nome}</span>
                      <span style={{ color: t.textTertiary, fontSize: 11, fontFamily: FONTS.mono }}>{e.status ? `HTTP ${e.status}` : 'sem resposta'}{e.latenciaMs ? ` · ${e.latenciaMs}ms` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
