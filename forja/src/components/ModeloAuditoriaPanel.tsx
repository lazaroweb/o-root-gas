import React, { useEffect, useState } from 'react';
import { Input, Button, App as AntApp, Tooltip, Tag, Skeleton, Alert } from 'antd';
import { Sparkles, Zap, Award, Save, Info, RotateCcw, RefreshCw, ExternalLink, Key, Copy } from 'lucide-react';
import { Panel } from './ui';
import ModelosDisponiveisWidget from './ModelosDisponiveisWidget';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface ModeloInfo {
  modeloAuditoria: string;
  modeloChat: string;
  chaveProperty: string;
  chavePropertyChat: string;
  settingsUrl: string;
  editorUrl: string;
}

// Presets recomendados pra auditoria, ordenados por velocidade/custo.
// O usuário pode digitar livre se tiver outro slug no proxy.
const PRESETS = [
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5', categoria: 'rápido', tempo: '~5-10s', descricao: 'Anthropic — mais rápido e barato. Recomendado pra auditoria.' },
  { value: 'claude-3-5-haiku-latest', label: 'Haiku 3.5', categoria: 'rápido', tempo: '~6-12s', descricao: 'Anthropic — versão anterior, ainda excelente.' },
  { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', categoria: 'balanço', tempo: '~15-25s', descricao: 'Anthropic — qualidade superior, ainda razoavelmente rápido.' },
  { value: 'claude-3-5-sonnet-latest', label: 'Sonnet 3.5', categoria: 'balanço', tempo: '~18-30s', descricao: 'Anthropic — versão anterior do balanço.' },
  { value: 'claude-opus-4-1', label: 'Opus 4.1', categoria: 'qualidade', tempo: '~25-45s', descricao: 'Anthropic — máxima qualidade, mais lento e caro.' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', categoria: 'rápido', tempo: '~5-10s', descricao: 'OpenAI — alternativa rápida e barata.' },
  { value: 'gpt-4o', label: 'GPT-4o', categoria: 'balanço', tempo: '~15-25s', descricao: 'OpenAI — balanço de qualidade e velocidade.' },
];

const ICON_CAT: Record<string, React.ReactNode> = {
  'rápido': <Zap size={11} />,
  'balanço': <Sparkles size={11} />,
  'qualidade': <Award size={11} />,
};

export default function ModeloAuditoriaPanel({ embedded = false }: { embedded?: boolean } = {}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [valor, setValor] = useState('');
  const [info, setInfo] = useState<ModeloInfo | null>(null);

  const carregar = (silencioso = false) => {
    if (!silencioso) setLoading(true);
    callServer<ServerResult>('getModeloAuditoria')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as ModeloInfo;
          setInfo(d);
          setValor(d.modeloAuditoria || '');
          if (silencioso) message.success('Sincronizado com Script Properties.');
        }
      })
      .catch(() => { /* preview */ })
      .finally(() => { if (!silencioso) setLoading(false); });
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('setModeloAuditoria', valor);
      if (r.ok) {
        message.success('Salvo em Script Properties.');
        carregar();
      } else { message.error(r.error || 'Erro'); }
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  };

  const limpar = async () => {
    setValor('');
    setSalvando(true);
    try {
      await callServer<ServerResult>('setModeloAuditoria', '');
      message.success('Propriedade removida. Voltando a usar o modelo do chat.');
      carregar();
    } finally { setSalvando(false); }
  };

  const copiarChave = (chave: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(chave);
      message.success(`Copiado: ${chave}`);
    }
  };

  const propPill = (chave: string, atalho?: () => void) => (
    <span
      onClick={() => atalho?.() || copiarChave(chave)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: t.surfaceMuted, color: t.text,
        border: `1px dashed ${t.border}`, borderRadius: 6,
        padding: '2px 8px', fontFamily: FONTS.mono, fontSize: 11,
        cursor: 'pointer', userSelect: 'all',
      }}
      title="Clique pra copiar"
    >
      <Key size={10} color={t.textTertiary} />
      {chave}
      <Copy size={10} color={t.textTertiary} />
    </span>
  );

  const naoAlterou = valor === (info?.modeloAuditoria || '');

  const acoes = (
    <div style={{ display: 'flex', gap: 6 }}>
      <Tooltip title="Recarrega o valor que está em Script Properties (caso você tenha editado direto no Apps Script)">
        <Button size="small" icon={<RefreshCw size={13} />} onClick={() => carregar(true)}>Sincronizar</Button>
      </Tooltip>
      {info?.settingsUrl && (
        <Tooltip title="Abre a página de Project Settings do Apps Script — role até 'Script Properties' pra editar direto lá">
          <Button
            size="small"
            icon={<ExternalLink size={13} />}
            href={info.settingsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Script Properties
          </Button>
        </Tooltip>
      )}
    </div>
  );

  const corpo = (
    <>
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          {/* Como funciona (ponte explícita com GAS Properties) */}
          <Alert
            type="info"
            showIcon
            icon={<Key size={15} color={t.accents.blue} />}
            style={{ marginBottom: 16, background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
            message={
              <span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>
                <strong>Esse campo é só uma janela pra <code style={{ fontFamily: FONTS.mono, fontSize: 12 }}>Script Properties</code> do Apps Script.</strong>
              </span>
            }
            description={
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
                Você pode editar <strong>aqui</strong> (escreve no GAS) ou <strong>direto no Apps Script</strong> (em Project Settings → Script Properties) — depois clique em <em>Sincronizar</em> pra trazer o valor pra cá. Sincroniza nos dois sentidos.
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: t.textTertiary }}>Chaves usadas:</span>
                  {propPill(info?.chaveProperty || 'LLM_MODEL_AUDITORIA')}
                  <span style={{ color: t.textTertiary, fontSize: 11 }}>(deste painel)</span>
                  {propPill(info?.chavePropertyChat || 'LLM_MODEL')}
                  <span style={{ color: t.textTertiary, fontSize: 11 }}>(modelo do chat, em Configurações acima)</span>
                </div>
              </div>
            }
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, margin: 0, flex: 1, minWidth: 240 }}>
              Define qual modelo usar <strong>especificamente</strong> pra rodar auditorias.
              Vazio = usa o modelo do chat (<code style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textSecondary }}>{info?.modeloChat || '(não configurado)'}</code>).
            </p>
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
              Valor no GAS agora: {info?.modeloAuditoria ? (
                <Tag style={{ marginInlineEnd: 0, fontFamily: FONTS.mono, fontSize: 11 }}>{info.modeloAuditoria}</Tag>
              ) : (
                <Tag color="default" style={{ marginInlineEnd: 0, fontFamily: FONTS.ui, fontSize: 11 }}>(vazio — usa o do chat)</Tag>
              )}
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {PRESETS.map((p) => (
              <Tooltip key={p.value} title={`${p.descricao} · ${p.tempo}`}>
                <button
                  type="button"
                  onClick={() => setValor(p.value)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: valor === p.value ? `${t.accents.peach}1f` : t.surface,
                    border: `1px solid ${valor === p.value ? t.accents.peach : t.border}`,
                    borderRadius: 999, padding: '4px 11px',
                    fontFamily: FONTS.ui, fontSize: 12,
                    color: valor === p.value ? t.accents.peach : t.textSecondary,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ color: t.accents.peach }}>{ICON_CAT[p.categoria]}</span>
                  {p.label}
                  <span style={{ fontSize: 10, color: t.textTertiary }}>{p.tempo}</span>
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Input + ações */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="ex.: claude-haiku-4-5 (ou cole o slug do modelo do seu proxy)"
              style={{ flex: 1, minWidth: 240, fontFamily: FONTS.mono }}
            />
            <Tooltip title={naoAlterou ? 'O campo já está igual ao que está no GAS' : 'Escrever este valor em Script Properties'}>
              <Button type="primary" icon={<Save size={14} />} loading={salvando} onClick={salvar} disabled={naoAlterou}>
                Salvar no GAS
              </Button>
            </Tooltip>
            {info?.modeloAuditoria && (
              <Tooltip title="Apaga a propriedade no GAS — auditoria volta a usar o modelo do chat">
                <Button icon={<RotateCcw size={14} />} onClick={limpar}>Resetar</Button>
              </Tooltip>
            )}
          </div>

          {/* Widget: lista modelos que o endpoint configurado realmente responde */}
          <ModelosDisponiveisWidget
            valorAtual={valor}
            onSelect={(id) => setValor(id)}
          />
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{acoes}</div>
        {corpo}
      </div>
    );
  }

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={17} strokeWidth={1.6} color={t.accents.peach} />
          Modelo de IA para Auditoria
          <Tooltip title="A Auditoria Forja IA roda separadamente do chat. Aqui você escolhe qual modelo usar — geralmente vale a pena usar um modelo mais rápido (ex.: Haiku) porque a auditoria roda sob demanda e você não quer esperar 30s+ toda vez.">
            <Info size={13} color={t.textTertiary} style={{ cursor: 'help' }} />
          </Tooltip>
        </span>
      }
      extra={acoes}
    >
      {corpo}
    </Panel>
  );
}
