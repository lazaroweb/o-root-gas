import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tooltip, Input, App as AntApp, Skeleton, Alert, Tag, Empty } from 'antd';
import { RefreshCw, ListChecks, Zap, Sparkles, Award, Hash, Search, Check, AlertTriangle, Globe } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface ModeloDisponivel {
  id: string;
  label: string;
  familia: 'anthropic' | 'openai' | 'google' | 'meta' | 'mistral' | 'outros';
  categoria: 'rápido' | 'balanço' | 'qualidade' | 'embedding' | 'outros';
}

interface ModelosPayload {
  total: number;
  endpoint: string;
  modelos: ModeloDisponivel[];
  consultadoEm: string;
}

interface Props {
  // Modelo atualmente selecionado no campo (pra destacar visualmente)
  valorAtual?: string;
  // Quando o usuário clica num modelo da lista
  onSelect?: (id: string) => void;
}

const ICON_CAT: Record<ModeloDisponivel['categoria'], React.ReactNode> = {
  'rápido': <Zap size={11} />,
  'balanço': <Sparkles size={11} />,
  'qualidade': <Award size={11} />,
  'embedding': <Hash size={11} />,
  'outros': <Hash size={11} />,
};

const COR_FAMILIA: Record<ModeloDisponivel['familia'], string> = {
  anthropic: '#C97B5C',
  openai: '#10A37F',
  google: '#4285F4',
  meta: '#0467DF',
  mistral: '#FF7000',
  outros: '#999',
};

const ORDEM_FAMILIA: ModeloDisponivel['familia'][] = ['anthropic', 'openai', 'google', 'meta', 'mistral', 'outros'];

function relTempo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  return `há ${Math.floor(m / 60)}h`;
}

export default function ModelosDisponiveisWidget({ valorAtual, onSelect }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [payload, setPayload] = useState<ModelosPayload | null>(null);
  const [filtro, setFiltro] = useState('');
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);

  const carregar = (manual = false) => {
    setLoading(true);
    setErro(null);
    callServer<ServerResult>('listModelosDisponiveis')
      .then((r) => {
        if (r.ok && r.data) {
          setPayload(r.data as ModelosPayload);
          setCarregouUmaVez(true);
          if (manual) message.success(`${(r.data as ModelosPayload).total} modelo(s) listado(s)`);
        } else {
          setErro(r.error || 'Erro');
          setCarregouUmaVez(true);
        }
      })
      .catch((e) => { setErro(e instanceof Error ? e.message : 'Erro'); setCarregouUmaVez(true); })
      .finally(() => setLoading(false));
  };

  // Não carrega automaticamente — usuário clica em "Listar modelos" quando quiser.
  // Evita gastar request toda vez que abrir Configurações.
  // (Pode ajustar pra carregar on-mount se preferir.)

  const filtrados = useMemo(() => {
    if (!payload) return [];
    const q = filtro.trim().toLowerCase();
    if (!q) return payload.modelos;
    return payload.modelos.filter((m) =>
      m.id.toLowerCase().indexOf(q) >= 0 || m.label.toLowerCase().indexOf(q) >= 0,
    );
  }, [payload, filtro]);

  const agrupados = useMemo(() => {
    const out: Record<string, ModeloDisponivel[]> = {};
    for (const m of filtrados) {
      if (!out[m.familia]) out[m.familia] = [];
      out[m.familia].push(m);
    }
    return out;
  }, [filtrados]);

  const familiasComResultado = ORDEM_FAMILIA.filter((f) => (agrupados[f] || []).length > 0);

  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 12,
        background: t.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      {/* Header do widget */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: payload || erro ? `1px solid ${t.borderSoft}` : 'none',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ListChecks size={15} color={t.accents.blue} strokeWidth={1.6} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text }}>
            Modelos do seu endpoint
          </span>
          {payload && (
            <Tag style={{ marginInlineEnd: 0, fontFamily: FONTS.ui, fontSize: 11 }}>
              {payload.total} disponíveis
            </Tag>
          )}
          {payload?.consultadoEm && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
              · {relTempo(payload.consultadoEm)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title={payload ? 'Consultar de novo o endpoint /models' : 'Faz GET /v1/models no seu proxy/endpoint'}>
            <Button
              size="small"
              type={payload ? 'default' : 'primary'}
              icon={<RefreshCw size={13} className={loading ? 'forja-spin' : ''} />}
              onClick={() => carregar(true)}
              loading={loading}
            >
              {payload ? 'Recarregar' : 'Listar modelos'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Estado inicial: nada listado ainda */}
      {!loading && !payload && !erro && !carregouUmaVez && (
        <div style={{ padding: '14px 16px', fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.55 }}>
          Clique em <strong>Listar modelos</strong> pra a Forja consultar <code style={{ fontFamily: FONTS.mono, fontSize: 11 }}>GET /v1/models</code> no seu proxy e mostrar tudo que está disponível.
        </div>
      )}

      {/* Loading inicial */}
      {loading && !payload && (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      )}

      {/* Erro */}
      {erro && !loading && (
        <div style={{ padding: 14 }}>
          <Alert
            type="warning"
            showIcon
            icon={<AlertTriangle size={15} />}
            message={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>Não consegui listar os modelos</span>}
            description={
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
                <code style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, wordBreak: 'break-all' }}>{erro}</code>
                <div style={{ marginTop: 8, fontSize: 11, color: t.textTertiary }}>
                  Possíveis causas: o proxy não expõe <code style={{ fontFamily: FONTS.mono }}>/models</code>, a chave não tem permissão de listar, ou a Base URL está incorreta. Você ainda pode digitar o slug do modelo manualmente acima.
                </div>
              </div>
            }
          />
        </div>
      )}

      {/* Lista com filtro */}
      {payload && !loading && (
        <div style={{ padding: '10px 14px 14px' }}>
          {payload.total > 8 && (
            <Input
              prefix={<Search size={13} color={t.textTertiary} />}
              placeholder="Filtrar (ex.: claude, haiku, gpt-4o…)"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              allowClear
              size="small"
              style={{ marginBottom: 10, fontFamily: FONTS.mono, fontSize: 12 }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Globe size={11} color={t.textTertiary} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary, wordBreak: 'break-all' }}>
              {payload.endpoint}
            </span>
          </div>

          {filtrados.length === 0 ? (
            <Empty description={filtro ? `Nenhum modelo combina com "${filtro}"` : 'Endpoint retornou lista vazia'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {familiasComResultado.map((fam) => (
                <div key={fam}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: COR_FAMILIA[fam] }} />
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'capitalize' }}>
                      {fam} <span style={{ color: t.textTertiary, fontWeight: 400 }}>({agrupados[fam].length})</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {agrupados[fam].map((m) => {
                      const selecionado = valorAtual === m.id;
                      return (
                        <Tooltip key={m.id} title={`Clique pra usar ${m.id}`}>
                          <button
                            type="button"
                            onClick={() => onSelect?.(m.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              background: selecionado ? `${COR_FAMILIA[fam]}1f` : t.surface,
                              border: `1px solid ${selecionado ? COR_FAMILIA[fam] : t.border}`,
                              borderRadius: 999,
                              padding: '3px 9px',
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              color: selecionado ? COR_FAMILIA[fam] : t.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {selecionado && <Check size={10} />}
                            <span style={{ color: COR_FAMILIA[fam] }}>{ICON_CAT[m.categoria]}</span>
                            {m.id}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
