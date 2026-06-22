// CentelhaTriagemModal — UI rica de triagem + decisão pra uma Centelha.
//
// Fluxo: capturei uma centelha bruta no Inbox → abro pra triar → escolho
// categoria/sistema/prioridade → opcionalmente peço refinamento por IA (que
// sugere campos E detecta duplicata) → decido destino (Ideia, Backlog,
// Arquivar, Descartar) ou só salvo a triagem pra decidir depois.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Form, Input, Select, Button, Tag, Tooltip, Alert,
  Space, Divider, Spin, App as AntApp, Segmented,
} from 'antd';
import {
  Sparkles, Archive, Trash2, ArrowRight, Lightbulb, ListChecks,
  AlertTriangle, Check, X,
} from 'lucide-react';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { Centelha, CentelhaCategoria, Sistema, ServerResult, ServerResponse, CentelhaPropostaIA } from '../types';

const { TextArea } = Input;

interface CentelhaTriagemModalProps {
  centelha: Centelha | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const CATEGORIA_OPCOES: Array<{ value: CentelhaCategoria; label: string; cor?: string }> = [
  { value: 'feature', label: 'Feature nova' },
  { value: 'bug', label: 'Bug a corrigir' },
  { value: 'melhoria', label: 'Melhoria' },
  { value: 'sistema_novo', label: 'Ideia de sistema novo' },
  { value: 'processo', label: 'Processo / organização' },
  { value: 'pessoal', label: 'Pessoal' },
];

const PRIORIDADE_OPCOES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

interface FormValues {
  titulo: string;
  contexto?: string;
  categoria?: CentelhaCategoria;
  sistemaId?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
  tags?: string;
}

export default function CentelhaTriagemModal({
  centelha, open, onClose, onChanged,
}: CentelhaTriagemModalProps): React.ReactElement | null {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [refinando, setRefinando] = useState(false);
  const [proposta, setProposta] = useState<CentelhaPropostaIA | null>(null);
  const [duplicado, setDuplicado] = useState<{ id: string; titulo: string; motivo: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((r) => { if (r.ok && r.data) setSistemas(r.data); })
      .catch(() => { /* preview */ });
  }, [open]);

  useEffect(() => {
    if (!centelha || !open) {
      form.resetFields();
      setProposta(null);
      setDuplicado(null);
      return;
    }
    form.setFieldsValue({
      titulo: centelha.titulo,
      contexto: centelha.contexto || '',
      categoria: (centelha.categoria as CentelhaCategoria) || undefined,
      sistemaId: centelha.sistemaId || undefined,
      prioridade: (centelha.prioridade as 'alta' | 'media' | 'baixa') || undefined,
      tags: centelha.tags || '',
    });
    setProposta(null);
    setDuplicado(null);
  }, [centelha, open, form]);

  const sistemasOptions = useMemo(() => sistemas.map((s) => ({ value: s.id, label: s.nome })), [sistemas]);

  if (!centelha) return null;

  const persistirTriagem = async (extras?: Partial<FormValues> & { estado?: string }) => {
    const values = await form.validateFields();
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('updateCentelha', centelha.id, { ...values, ...(extras || {}) });
      if (!r.ok) {
        message.error(r.error || 'Erro ao salvar triagem');
        return false;
      }
      return true;
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar triagem');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const salvarTriagem = async () => {
    const ok = await persistirTriagem();
    if (ok) {
      message.success('Triagem salva');
      onChanged();
      onClose();
    }
  };

  const refinarComIA = async () => {
    setRefinando(true);
    setProposta(null);
    setDuplicado(null);
    try {
      const r = await callServer<ServerResponse<{ proposta: CentelhaPropostaIA; duplicado: { id: string; titulo: string; motivo: string } | null }>>('refinarCentelhaComIA', { centelhaId: centelha.id });
      if (!r.ok || !r.data) {
        message.error(r.error || 'IA não conseguiu refinar');
        return;
      }
      setProposta(r.data.proposta);
      setDuplicado(r.data.duplicado);
      form.setFieldsValue({
        titulo: r.data.proposta.tituloSugerido || form.getFieldValue('titulo'),
        contexto: r.data.proposta.contextoSugerido || form.getFieldValue('contexto'),
        categoria: r.data.proposta.categoria || form.getFieldValue('categoria'),
        sistemaId: r.data.proposta.sistemaIdSugerido || form.getFieldValue('sistemaId'),
        prioridade: r.data.proposta.prioridade || form.getFieldValue('prioridade'),
      });
      message.success('Proposta de triagem aplicada nos campos');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'IA falhou');
    } finally {
      setRefinando(false);
    }
  };

  const promoverParaIdeia = async () => {
    const values = await form.validateFields();
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('promoverCentelhaParaIdeia', {
        centelhaId: centelha.id,
        ideia: {
          titulo: values.titulo,
          descricao: values.contexto || '',
          tipo: values.categoria === 'sistema_novo' ? 'sistema' : 'melhoria',
          sistemaId: values.sistemaId || '',
          prioridade: values.prioridade || 'media',
        },
      });
      if (!r.ok) {
        message.error(r.error || 'Erro ao promover');
        return;
      }
      message.success('Centelha virou Ideia ✨');
      onChanged();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao promover');
    } finally {
      setSalvando(false);
    }
  };

  const promoverParaBacklog = async () => {
    const values = await form.validateFields();
    if (!values.sistemaId) {
      message.warning('Escolha um sistema antes de promover ao backlog');
      return;
    }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('promoverCentelhaParaBacklog', {
        centelhaId: centelha.id,
        decisao: {
          sistemaId: values.sistemaId,
          titulo: values.titulo,
          decisao: values.contexto || '',
          prioridade: values.prioridade || 'media',
          tags: values.tags || '',
        },
      });
      if (!r.ok) {
        message.error(r.error || 'Erro ao promover');
        return;
      }
      const sNome = sistemas.find((s) => s.id === values.sistemaId)?.nome || 'sistema';
      message.success(`Centelha virou item de backlog em ${sNome}`);
      onChanged();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao promover');
    } finally {
      setSalvando(false);
    }
  };

  const arquivar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('arquivarCentelha', centelha.id);
      if (!r.ok) { message.error(r.error || 'Erro ao arquivar'); return; }
      message.success('Arquivada (histórico preservado)');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const descartar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('descartarCentelha', centelha.id);
      if (!r.ok) { message.error(r.error || 'Erro ao descartar'); return; }
      message.success('Descartada');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color={t.accents.peach} />
          <span style={{ fontFamily: FONTS.display, fontSize: 18 }}>Triar centelha</span>
        </div>
      }
      width={680}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="titulo" label="Título" rules={[{ required: true, message: 'Título é obrigatório' }]}>
          <Input placeholder="Resumo curto da ideia" />
        </Form.Item>

        <Form.Item name="contexto" label="Contexto (opcional)" extra="Cola o que vier à cabeça: PRD, link, justificativa, transcrição">
          <TextArea rows={3} placeholder="Sem amarra — escreva como pensa" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="categoria" label="Categoria">
            <Select allowClear placeholder="Classifica a natureza" options={CATEGORIA_OPCOES} />
          </Form.Item>
          <Form.Item name="prioridade" label="Prioridade">
            <Select allowClear placeholder="Pragmático, não cerimonioso" options={PRIORIDADE_OPCOES} />
          </Form.Item>
        </div>

        <Form.Item name="sistemaId" label="Sistema vinculado (opcional)" extra="Obrigatório se for promover ao Backlog">
          <Select allowClear showSearch placeholder="Nenhum (ideia solta ou pessoal)" options={sistemasOptions} optionFilterProp="label" />
        </Form.Item>

        <Form.Item name="tags" label="Tags" extra="Separe por vírgula">
          <Input placeholder="ex.: ux, performance, growth" />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Tooltip title="A Forja IA sugere categoria, prioridade, sistema E detecta duplicata cruzando com Ideias + Backlog existentes">
            <Button
              icon={<Sparkles size={14} />}
              onClick={refinarComIA}
              loading={refinando}
              type="dashed"
            >
              Refinar com IA
            </Button>
          </Tooltip>
          {proposta && (
            <Tag color="purple" style={{ fontFamily: FONTS.mono, fontSize: 11 }}>
              IA sugere: {proposta.destino}
            </Tag>
          )}
        </div>

        {duplicado && (
          <Alert
            type="warning"
            showIcon
            icon={<AlertTriangle size={16} />}
            message="Possível duplicata detectada"
            description={
              <div style={{ fontSize: 13 }}>
                <div><strong>Já existe:</strong> {duplicado.titulo}</div>
                <div style={{ marginTop: 4, color: t.textSecondary }}>{duplicado.motivo}</div>
              </div>
            }
            style={{ marginBottom: 12 }}
          />
        )}

        {proposta?.justificativa && !duplicado && (
          <Alert
            type="info"
            showIcon
            message={<span style={{ fontSize: 13 }}>{proposta.justificativa}</span>}
            style={{ marginBottom: 12 }}
          />
        )}

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            icon={<Lightbulb size={14} />}
            onClick={promoverParaIdeia}
            loading={salvando}
          >
            Promover → Ideia
          </Button>
          <Button
            icon={<ListChecks size={14} />}
            onClick={promoverParaBacklog}
            loading={salvando}
          >
            Promover → Backlog
          </Button>
          <div style={{ flex: 1 }} />
          <Button icon={<Archive size={14} />} onClick={arquivar} loading={salvando}>
            Arquivar
          </Button>
          <Button icon={<Trash2 size={14} />} danger onClick={descartar} loading={salvando}>
            Descartar
          </Button>
        </div>

        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button type="link" onClick={salvarTriagem} loading={salvando}>
            Só salvar triagem (decidir depois)
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
