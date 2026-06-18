import React, { useState, useEffect } from 'react';
import { Button, Input, Tag, Spin, Empty, App as AntApp } from 'antd';
import { Wand2, Save, RotateCcw, Sparkles } from 'lucide-react';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

interface PromptDef {
  key: string;
  label: string;
  descricao: string;
  placeholders: string[];
  padrao: string;
  custom: string;
}

export default function IAPrompts(): React.ReactElement {
  const t = useTokens();
  const { message, modal } = AntApp.useApp();
  const [prompts, setPrompts] = useState<PromptDef[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    callServer<ServerResponse<PromptDef[]>>('getPrompts')
      .then(res => {
        if (res.ok && res.data) {
          const list = res.data as PromptDef[];
          setPrompts(list);
          const e: Record<string, string> = {};
          list.forEach(p => { e[p.key] = p.custom || p.padrao; });
          setEdits(e);
        }
      })
      .catch(() => message.error('Os prompts carregam no app publicado'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const salvar = (p: PromptDef) => {
    setBusy(p.key);
    callServer<ServerResponse<unknown>>('savePrompt', p.key, edits[p.key])
      .then(res => { if (res.ok) { message.success('Prompt salvo'); load(); } else message.error(res.error || 'Erro'); })
      .catch(() => message.error('Erro ao salvar'))
      .finally(() => setBusy(null));
  };

  const restaurar = (p: PromptDef) => {
    modal.confirm({
      title: 'Restaurar padrão?',
      content: 'Isso descarta sua versão personalizada deste prompt.',
      okText: 'Restaurar', cancelText: 'Cancelar',
      onOk: () => callServer<ServerResponse<string>>('resetPrompt', p.key)
        .then(res => { if (res.ok) { message.success('Prompt restaurado'); setEdits(e => ({ ...e, [p.key]: p.padrao })); load(); } })
        .catch(() => message.error('Erro ao restaurar')),
    });
  };

  const refinar = (p: PromptDef) => {
    let instrucao = '';
    modal.confirm({
      title: `Refinar prompt — ${p.label}`,
      icon: <Wand2 size={18} />,
      content: (
        <div>
          <p style={{ color: t.textSecondary, fontSize: 13 }}>A IA vai melhorar o prompt atual mantendo o formato e os placeholders. Você revisa antes de salvar.</p>
          <Input.TextArea placeholder="Pedido opcional (ex.: deixe mais conciso, foque em segurança...)" autoSize={{ minRows: 2, maxRows: 4 }} onChange={(e) => { instrucao = e.target.value; }} />
        </div>
      ),
      okText: 'Refinar', cancelText: 'Cancelar',
      onOk: () => {
        setBusy(p.key);
        return callServer<ServerResponse<string>>('refinarPrompt', { key: p.key, atual: edits[p.key], instrucao })
          .then(res => {
            if (res.ok && typeof res.data === 'string') { setEdits(e => ({ ...e, [p.key]: res.data as string })); message.success('Prompt refinado — revise e salve'); }
            else message.error(res.error || 'Erro');
          })
          .catch(() => message.error('Refinar só funciona com IA configurada'))
          .finally(() => setBusy(null));
      },
    });
  };

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (prompts.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Prompts indisponíveis (rode no app publicado)" style={{ marginTop: 40 }} />;

  return (
    <div>
      <p style={{ color: t.textSecondary, fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
        Cada recurso da Forja IA usa um prompt de sistema. Veja, edite, peça um refinamento à IA ou volte ao padrão. Mantenha os placeholders e estruturas JSON para o recurso continuar funcionando.
      </p>
      {prompts.map((p) => {
        const personalizado = !!p.custom;
        const alterado = edits[p.key] !== (p.custom || p.padrao);
        return (
          <div key={p.key} style={{ marginBottom: 16 }}>
            <Panel
              title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} strokeWidth={1.6} color={t.accents.peach} /> {p.label}</span>}
              extra={<Tag bordered={false} style={{ background: personalizado ? `${t.accents.lavender}22` : `${t.textTertiary}1f`, color: personalizado ? t.accents.lavender : t.textTertiary }}>{personalizado ? 'personalizado' : 'padrão'}</Tag>}
            >
              <p style={{ color: t.textSecondary, fontSize: 13, marginTop: 0 }}>{p.descricao}</p>
              {p.placeholders.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: t.textTertiary, fontSize: 12 }}>Placeholders (não remova):</span>
                  {p.placeholders.map(ph => <Tag key={ph} bordered={false} style={{ fontFamily: FONTS.mono, background: `${t.accents.blue}1a`, color: t.accents.blue }}>{ph}</Tag>)}
                </div>
              )}
              <Input.TextArea
                value={edits[p.key]}
                onChange={(e) => setEdits(prev => ({ ...prev, [p.key]: e.target.value }))}
                autoSize={{ minRows: 5, maxRows: 18 }}
                style={{ fontFamily: FONTS.mono, fontSize: 12.5, lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <Button type="primary" icon={<Save size={15} />} loading={busy === p.key} disabled={!alterado} onClick={() => salvar(p)}>Salvar</Button>
                <Button icon={<Wand2 size={15} />} loading={busy === p.key} onClick={() => refinar(p)}>Refinar com IA</Button>
                <Button icon={<RotateCcw size={15} />} disabled={!personalizado} onClick={() => restaurar(p)}>Restaurar padrão</Button>
              </div>
            </Panel>
          </div>
        );
      })}
    </div>
  );
}
