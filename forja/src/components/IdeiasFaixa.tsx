// IdeiasFaixa — captura rápida de "ideias de melhoria" amarradas a um sistema,
// exibida como uma faixa enxuta dentro do Backlog. É o lugar pra jogar a faísca
// sem fricção (1 campo) sem poluir o Kanban acionável. Quando você quer, a IA
// refina a ideia num item de backlog e checa duplicado antes de promover.
//
// PromoverIdeiaModal é exportado e reaproveitado pela IdeiasView (caixa global).
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Modal, Form, Select, App as AntApp, Tooltip, Popconfirm, Spin } from 'antd';
import { Lightbulb, Sparkles, ChevronDown, ChevronRight, Plus, X, AlertTriangle } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Ideia, Sistema, ServerResult, ServerResponse } from '../types';

interface IdeiasFaixaProps {
  sistemaId: string;
  sistemaNome?: string;
  onPromovido?: () => void;
}

const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export default function IdeiasFaixa({ sistemaId, sistemaNome, onPromovido }: IdeiasFaixaProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [aberto, setAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [promovendo, setPromovendo] = useState<Ideia | null>(null);

  const carregar = useCallback(() => {
    callServer<ServerResult>('getMelhoriasBySistema', sistemaId)
      .then((r) => { if (r.ok && r.data) setIdeias(r.data as Ideia[]); })
      .catch(() => { /* preview */ });
  }, [sistemaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async () => {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    setAdicionando(true);
    try {
      const r = await callServer<ServerResult>('createIdeia', {
        titulo,
        descricao: '',
        notaImpacto: 5,
        notaEsforco: 5,
        estado: 'nova',
        tipo: 'melhoria',
        sistemaId,
        prioridade: 'media',
        criadoEm: new Date().toISOString(),
      });
      if (r.ok) {
        setNovoTitulo('');
        setAberto(true);
        carregar();
      } else {
        message.error(r.error || 'Erro ao adicionar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setAdicionando(false);
    }
  };

  const descartar = async (id: string) => {
    try {
      await callServer('updateIdeia', id, { estado: 'descartada' });
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  const qtd = ideias.length;

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadowSoft, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header: título + captura rápida sempre visível (frictionless) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ width: 30, height: 30, borderRadius: 9, background: `${t.accents.clay}1f`, color: t.accents.clay, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={16} />
          </span>
          <span style={{ fontFamily: FONTS.display, fontSize: 14.5, fontWeight: 600, color: t.text }}>Ideias</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: qtd > 0 ? t.accents.clay : t.surfaceMuted, color: qtd > 0 ? '#fff' : t.textTertiary, fontFamily: FONTS.ui }}>
            {qtd}
          </span>
          <span style={{ color: t.textTertiary, display: 'inline-flex' }}>{aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
          <Input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onPressEnter={adicionar}
            placeholder="Tive uma ideia de melhoria pra este sistema…"
            size="small"
            style={{ flex: 1 }}
          />
          <Button type="primary" size="small" icon={<Plus size={13} />} loading={adicionando} onClick={adicionar} style={{ background: t.accents.clay, borderColor: t.accents.clay }}>
            Lançar
          </Button>
        </div>
      </div>

      {/* Corpo: lista de ideias pendentes */}
      {aberto && (
        <div style={{ borderTop: `1px solid ${t.borderSoft}`, padding: qtd > 0 ? '8px 10px 12px' : '0' }}>
          {qtd === 0 ? (
            <div style={{ padding: '16px 14px', fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.55 }}>
              Jogue aqui faíscas de melhoria pra <strong>{sistemaNome || 'este sistema'}</strong>. Elas ficam fora do acionável até você refinar — aí a IA estrutura, checa duplicado e manda pro Backlog.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ideias.map((i) => (
                <div
                  key={i.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}
                >
                  <Lightbulb size={13} color={t.accents.clay} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, lineHeight: 1.4 }}>{i.titulo}</span>
                  <Tooltip title="Refinar com IA e mandar pro Backlog">
                    <Button size="small" type="text" icon={<Sparkles size={13} />} onClick={() => setPromovendo(i)} style={{ color: t.accents.peach }}>Promover</Button>
                  </Tooltip>
                  <Popconfirm title="Descartar esta ideia?" onConfirm={() => descartar(i.id)} okText="Descartar" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                    <Tooltip title="Descartar">
                      <Button size="small" type="text" icon={<X size={13} />} style={{ color: t.textTertiary }} />
                    </Tooltip>
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PromoverIdeiaModal
        ideia={promovendo}
        open={!!promovendo}
        onClose={() => setPromovendo(null)}
        onPromovido={() => { setPromovendo(null); carregar(); onPromovido?.(); }}
      />
    </div>
  );
}

// ─── Modal de promoção (refinar com IA + dedup + confirmar) ──────────────────
interface PropostaItem {
  titulo: string;
  decisao: string;
  justificativa: string;
  prioridade: string;
  tags: string;
  estimativa: string;
}
interface Duplicado { id: string; titulo: string; motivo: string }

export function PromoverIdeiaModal({ ideia, open, onClose, onPromovido }: {
  ideia: Ideia | null;
  open: boolean;
  onClose: () => void;
  onPromovido: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<PropostaItem>();
  const [refinando, setRefinando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [duplicado, setDuplicado] = useState<Duplicado | null>(null);
  const [refinado, setRefinado] = useState(false);
  const [sistemaId, setSistemaId] = useState<string>('');
  const [sistemas, setSistemas] = useState<Sistema[]>([]);

  // Carrega sistemas só quando precisa destinar (ideia sem sistemaId).
  useEffect(() => {
    if (!open) return;
    const sid = String(ideia?.sistemaId || '').trim();
    setSistemaId(sid);
    setRefinado(false);
    setDuplicado(null);
    form.resetFields();
    form.setFieldsValue({ titulo: ideia?.titulo || '', decisao: ideia?.descricao || '', prioridade: 'media' });
    if (!sid) {
      callServer<ServerResponse<Sistema[]>>('getSistemas')
        .then((r) => { if (r.ok && r.data) setSistemas(r.data); })
        .catch(() => { /* preview */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ideia]);

  const refinar = async () => {
    if (!ideia) return;
    if (!sistemaId) { message.warning('Escolha a qual sistema esta melhoria pertence.'); return; }
    setRefinando(true);
    setDuplicado(null);
    try {
      // Se a ideia ainda não tinha sistema, amarra agora antes de refinar.
      if (!String(ideia.sistemaId || '').trim()) {
        await callServer('updateIdeia', ideia.id, { sistemaId });
      }
      const r = await callServer<ServerResult>('refinarIdeiaMelhoria', { ideiaId: ideia.id });
      if (r.ok && r.data) {
        const d = r.data as { proposta: PropostaItem; duplicado: Duplicado | null };
        form.setFieldsValue(d.proposta);
        setDuplicado(d.duplicado);
        setRefinado(true);
      } else {
        message.error(r.error || 'Erro ao refinar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setRefinando(false);
    }
  };

  const confirmar = async () => {
    if (!ideia) return;
    const item = await form.validateFields();
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('confirmarPromocaoIdeia', { ideiaId: ideia.id, sistemaId, item });
      if (r.ok) {
        message.success('Ideia promovida pro Backlog (coluna "A fazer")');
        onPromovido();
      } else {
        message.error(r.error || 'Erro ao promover');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      title={<span style={{ fontFamily: FONTS.display }}>Promover ideia pro Backlog</span>}
      open={open}
      onCancel={onClose}
      width={580}
      footer={
        refinado
          ? [
              <Button key="cancel" onClick={onClose}>Cancelar</Button>,
              <Button key="ok" type="primary" loading={salvando} onClick={confirmar} icon={<Sparkles size={14} />}>
                {duplicado ? 'Promover mesmo assim' : 'Promover pro Backlog'}
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose}>Cancelar</Button>,
              <Button key="refinar" type="primary" loading={refinando} onClick={refinar} icon={<Sparkles size={14} />} disabled={!sistemaId}>
                Refinar com IA
              </Button>,
            ]
      }
    >
      {!String(ideia?.sistemaId || '').trim() && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 6 }}>A qual sistema esta melhoria pertence?</div>
          <Select
            value={sistemaId || undefined}
            onChange={setSistemaId}
            placeholder="Escolha o sistema"
            style={{ width: '100%' }}
            options={sistemas.map((s) => ({ value: s.id, label: s.nome }))}
            disabled={refinado}
          />
        </div>
      )}

      {refinando ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <Spin />
          <div style={{ marginTop: 12, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary }}>
            A IA está estruturando a ideia e checando duplicados no backlog…
          </div>
        </div>
      ) : !refinado ? (
        <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          <div style={{ padding: '10px 12px', background: t.surfaceMuted, borderRadius: 10, border: `1px solid ${t.borderSoft}`, marginBottom: 4 }}>
            <strong style={{ color: t.text }}>{ideia?.titulo}</strong>
            {ideia?.descricao && <div style={{ marginTop: 4, color: t.textTertiary, fontSize: 12.5 }}>{ideia.descricao}</div>}
          </div>
          <div style={{ marginTop: 12, color: t.textTertiary, fontSize: 12.5 }}>
            Ao refinar, a IA transforma isso num item de backlog estruturado (o quê, por quê, prioridade) e avisa se já existe algo parecido neste sistema — pra você não criar duplicado.
          </div>
        </div>
      ) : (
        <Form form={form} layout="vertical">
          {duplicado && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: `${t.accents.clay}14`, border: `1px solid ${t.accents.clay}66`, borderRadius: 10, marginBottom: 16 }}>
              <AlertTriangle size={18} color={t.accents.clay} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
                <strong style={{ color: t.text }}>Possível duplicado:</strong> “{duplicado.titulo}”.
                {duplicado.motivo && <span> {duplicado.motivo}</span>}
                <div style={{ marginTop: 4, color: t.textTertiary }}>Revise antes de promover, ou cancele se já estiver coberto.</div>
              </div>
            </div>
          )}
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="decisao" label="O que precisa ser feito" rules={[{ required: true, message: 'Obrigatório' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="justificativa" label="Por quê / contexto">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="prioridade" label="Prioridade">
              <Select options={Object.keys(PRIO_LABEL).map((k) => ({ value: k, label: PRIO_LABEL[k] }))} />
            </Form.Item>
            <Form.Item name="estimativa" label="Estimativa">
              <Input placeholder="Ex: 2h, 1d" />
            </Form.Item>
          </div>
          <Form.Item name="tags" label="Tags" extra="Separe por vírgula">
            <Input placeholder="melhoria, ux" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
