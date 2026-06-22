// IdeiaTriagemDrawer — drawer lateral de triagem rica de uma Ideia.
//
// Substitui o Modal antigo de edição (que era pesado e tirava o contexto). Aqui
// o usuário tria com calma: título, contexto, categoria, prioridade, sistema,
// impacto/esforço — opcionalmente pede refinamento por IA (que sugere campos
// E detecta duplicata) — e decide destino: Concluir, Gênese, Promover ao
// Backlog, Arquivar, Descartar, ou só salvar pra decidir depois.
//
// Princípio: tudo que pode ser feito em uma Ideia cabe aqui. Sem precisar
// abrir 2-3 modais em sequência.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Drawer, Form, Input, Select, Button, Tag, Tooltip, Alert,
  Slider, Divider, Space, App as AntApp, Popconfirm, Segmented,
} from 'antd';
import {
  Sparkles, Archive, Trash2, AlertTriangle, Lightbulb, ListChecks,
  Rocket, Check, RotateCcw, Save, XCircle,
} from 'lucide-react';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import { PromoverIdeiaModal } from './IdeiasFaixa';
import type {
  Ideia, IdeiaCategoria, Sistema, ServerResult, ServerResponse, IdeiaPropostaIA,
} from '../types';

const { TextArea } = Input;

interface IdeiaTriagemDrawerProps {
  ideia: Ideia | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onGenese?: (ideiaId: string) => void;
  sistemas?: Sistema[]; // opcional — se vier, evita re-fetch
}

const CATEGORIA_OPCOES: Array<{ value: IdeiaCategoria; label: string }> = [
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
  descricao?: string;
  categoria?: IdeiaCategoria;
  prioridade?: 'alta' | 'media' | 'baixa';
  sistemaId?: string;
  tipo?: 'sistema' | 'melhoria';
  notaImpacto?: number;
  notaEsforco?: number;
}

export default function IdeiaTriagemDrawer({
  ideia, open, onClose, onChanged, onGenese, sistemas: sistemasProp,
}: IdeiaTriagemDrawerProps): React.ReactElement | null {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [sistemas, setSistemas] = useState<Sistema[]>(sistemasProp || []);
  const [salvando, setSalvando] = useState(false);
  const [refinando, setRefinando] = useState(false);
  const [proposta, setProposta] = useState<IdeiaPropostaIA | null>(null);
  const [duplicado, setDuplicado] = useState<{ id: string; titulo: string; motivo: string } | null>(null);
  const [promovendoBacklog, setPromovendoBacklog] = useState(false);

  const tipoAtual = Form.useWatch('tipo', form) || 'sistema';
  const categoriaAtual = Form.useWatch('categoria', form);
  const impactoAtual = Form.useWatch('notaImpacto', form) || 0;
  const esforcoAtual = Form.useWatch('notaEsforco', form) || 0;

  useEffect(() => {
    if (!open) return;
    if (sistemasProp && sistemasProp.length) {
      setSistemas(sistemasProp);
      return;
    }
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then((r) => { if (r.ok && r.data) setSistemas(r.data); })
      .catch(() => { /* preview */ });
  }, [open, sistemasProp]);

  useEffect(() => {
    if (!ideia || !open) {
      form.resetFields();
      setProposta(null);
      setDuplicado(null);
      return;
    }
    form.setFieldsValue({
      titulo: ideia.titulo,
      descricao: ideia.descricao || '',
      categoria: (ideia.categoria as IdeiaCategoria) || undefined,
      prioridade: (ideia.prioridade as 'alta' | 'media' | 'baixa') || undefined,
      sistemaId: ideia.sistemaId || undefined,
      tipo: ideia.tipo === 'melhoria' ? 'melhoria' : 'sistema',
      notaImpacto: ideia.notaImpacto || 5,
      notaEsforco: ideia.notaEsforco || 5,
    });
    setProposta(null);
    setDuplicado(null);
  }, [ideia, open, form]);

  const sistemasOptions = useMemo(
    () => sistemas.map((s) => ({ value: s.id, label: s.nome })),
    [sistemas],
  );

  const persistirEdicao = useCallback(async (extras?: Partial<FormValues> & { estado?: string }) => {
    if (!ideia) return false;
    const values = await form.validateFields();
    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        ...values,
        ...(extras || {}),
        // Quando categoria/sistema são preenchidos, a ideia deixa de ser "bruta"
        // mesmo que o estado não tenha mudado. Não precisamos marcar nada — o
        // filtro Inbox só conta ideias SEM categoria e SEM sistema.
      };
      const r = await callServer<ServerResult>('updateIdeia', ideia.id, payload);
      if (!r.ok) {
        message.error(r.error || 'Erro ao salvar');
        return false;
      }
      return true;
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar');
      return false;
    } finally {
      setSalvando(false);
    }
  }, [ideia, form, message]);

  if (!ideia) return null;

  const salvarTriagem = async () => {
    const ok = await persistirEdicao();
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
      const r = await callServer<ServerResponse<{
        proposta: IdeiaPropostaIA;
        duplicado: { id: string; titulo: string; motivo: string } | null;
      }>>('refinarIdeiaComIA', { ideiaId: ideia.id });
      if (!r.ok || !r.data) {
        message.error(r.error || 'IA não conseguiu refinar');
        return;
      }
      setProposta(r.data.proposta);
      setDuplicado(r.data.duplicado);
      form.setFieldsValue({
        titulo: r.data.proposta.tituloSugerido || form.getFieldValue('titulo'),
        descricao: r.data.proposta.descricaoSugerida || form.getFieldValue('descricao'),
        categoria: r.data.proposta.categoria || form.getFieldValue('categoria'),
        sistemaId: r.data.proposta.sistemaIdSugerido || form.getFieldValue('sistemaId'),
        prioridade: r.data.proposta.prioridade || form.getFieldValue('prioridade'),
        notaImpacto: r.data.proposta.notaImpactoSugerida || form.getFieldValue('notaImpacto'),
        notaEsforco: r.data.proposta.notaEsforcoSugerida || form.getFieldValue('notaEsforco'),
      });
      message.success('Proposta aplicada nos campos. Revise antes de salvar.');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'IA falhou');
    } finally {
      setRefinando(false);
    }
  };

  const concluir = async () => {
    const okSalvar = await persistirEdicao();
    if (!okSalvar) return;
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('concluirIdeia', ideia.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Ideia concluída ✓');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const reabrir = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('reabrirIdeia', ideia.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Ideia reaberta');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const arquivar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('arquivarIdeia', ideia.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Arquivada');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const descartar = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('descartarIdeia', ideia.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Descartada');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const remover = async () => {
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('deleteIdeia', ideia.id);
      if (!r.ok) { message.error(r.error || 'Erro'); return; }
      message.success('Apagada');
      onChanged();
      onClose();
    } finally { setSalvando(false); }
  };

  const irGenese = async () => {
    const ok = await persistirEdicao({ tipo: 'sistema' });
    if (!ok) return;
    onClose();
    onGenese?.(ideia.id);
  };

  const promoverBacklog = async () => {
    const values = await form.validateFields();
    if (!values.sistemaId) {
      message.warning('Escolha um sistema antes de promover ao backlog');
      return;
    }
    const ok = await persistirEdicao({ tipo: 'melhoria' });
    if (!ok) return;
    // Reaproveita PromoverIdeiaModal (que refina + checa dup + cria a Decisão).
    setPromovendoBacklog(true);
  };

  const estado = (ideia.estado || 'nova').toLowerCase();
  const ativa = !['concluida', 'arquivada', 'descartada', 'promovida'].includes(estado);
  const ehSistema = tipoAtual === 'sistema' || categoriaAtual === 'sistema_novo';
  const ehMelhoria = tipoAtual === 'melhoria';
  const prioridadeVisual = (() => {
    const d = impactoAtual - esforcoAtual;
    if (d >= 4) return { label: 'Alta', cor: t.accents.sage };
    if (d >= 1) return { label: 'Média', cor: t.accents.clay };
    return { label: 'Baixa', cor: t.textTertiary };
  })();

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        placement="right"
        width={520}
        destroyOnClose
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `${t.accents.peach}1f`, color: t.accents.peach,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600 }}>Triar ideia</div>
              <div style={{ fontSize: 11, color: t.textTertiary }}>
                Estado: <span style={{ color: t.textSecondary, textTransform: 'capitalize' }}>{estado}</span>
              </div>
            </div>
          </div>
        }
        styles={{ body: { padding: '20px 24px' } }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="titulo"
            label="Título"
            rules={[{ required: true, message: 'Título é obrigatório' }]}
          >
            <Input placeholder="Resumo curto e claro" size="large" style={{ fontFamily: FONTS.display, fontSize: 15 }} />
          </Form.Item>

          <Form.Item
            name="descricao"
            label="Contexto / descrição"
            extra="Sem amarra — escreve como pensa"
          >
            <TextArea rows={3} placeholder="O que é, problema que resolve, links..." />
          </Form.Item>

          <Form.Item name="tipo" label="Tipo de faísca">
            <Segmented
              options={[
                { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Rocket size={13} /> Novo sistema</span>, value: 'sistema' },
                { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={13} /> Melhoria</span>, value: 'melhoria' },
              ]}
              block
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="categoria" label="Categoria">
              <Select allowClear placeholder="Natureza" options={CATEGORIA_OPCOES} />
            </Form.Item>
            <Form.Item name="prioridade" label="Prioridade">
              <Select allowClear placeholder="Pragmático" options={PRIORIDADE_OPCOES} />
            </Form.Item>
          </div>

          {ehMelhoria && (
            <Form.Item
              name="sistemaId"
              label="Sistema vinculado"
              extra="Obrigatório se for promover ao backlog"
            >
              <Select
                allowClear showSearch
                placeholder="Qual sistema esta melhoria afeta?"
                options={sistemasOptions}
                optionFilterProp="label"
              />
            </Form.Item>
          )}

          {/* Score impacto / esforço com sliders visuais (vs InputNumber chato) */}
          {ehSistema && (
            <div style={{
              background: t.surfaceMuted,
              borderRadius: 12,
              padding: '14px 16px 6px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>Score (impacto vs esforço)</span>
                <Tag
                  bordered={false}
                  style={{ background: `${prioridadeVisual.cor}1f`, color: prioridadeVisual.cor, borderRadius: 999, fontSize: 11 }}
                >
                  {prioridadeVisual.label}
                </Tag>
              </div>
              <Form.Item name="notaImpacto" label={<span style={{ fontSize: 12, color: t.textTertiary }}>Impacto: <strong style={{ color: t.text }}>{impactoAtual}</strong>/10</span>} style={{ marginBottom: 4 }}>
                <Slider min={1} max={10} tooltip={{ open: false }} />
              </Form.Item>
              <Form.Item name="notaEsforco" label={<span style={{ fontSize: 12, color: t.textTertiary }}>Esforço: <strong style={{ color: t.text }}>{esforcoAtual}</strong>/10</span>} style={{ marginBottom: 4 }}>
                <Slider min={1} max={10} tooltip={{ open: false }} />
              </Form.Item>
            </div>
          )}

          <Divider style={{ margin: '8px 0 14px' }} />

          {/* Bloco de IA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <Tooltip title="A IA sugere categoria, prioridade, sistema, título refinado, impacto/esforço E detecta duplicata">
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

          <Divider style={{ margin: '8px 0 14px' }} />

          {/* Ações primárias variam pelo estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ativa && ehSistema && (
              <Button
                type="primary"
                size="large"
                icon={<Sparkles size={16} />}
                onClick={irGenese}
                loading={salvando}
                style={{ background: t.accents.peach, borderColor: t.accents.peach }}
              >
                Promover → Gênese (virar sistema)
              </Button>
            )}
            {ativa && ehMelhoria && (
              <Button
                type="primary"
                size="large"
                icon={<ListChecks size={16} />}
                onClick={promoverBacklog}
                loading={salvando}
                style={{ background: t.accents.clay, borderColor: t.accents.clay }}
              >
                Promover → Backlog do sistema
              </Button>
            )}

            <Space wrap>
              {ativa && (
                <Button icon={<Check size={14} />} onClick={concluir} loading={salvando} style={{ color: t.accents.sage, borderColor: `${t.accents.sage}99` }}>
                  Concluir
                </Button>
              )}
              {!ativa && estado !== 'descartada' && (
                <Button icon={<RotateCcw size={14} />} onClick={reabrir} loading={salvando}>
                  Reabrir
                </Button>
              )}
              <Button icon={<Save size={14} />} onClick={salvarTriagem} loading={salvando}>
                Salvar triagem
              </Button>
              <Button icon={<Archive size={14} />} onClick={arquivar} loading={salvando}>
                Arquivar
              </Button>
              <Button icon={<XCircle size={14} />} onClick={descartar} loading={salvando}>
                Descartar
              </Button>
              <Popconfirm
                title="Apagar permanentemente?"
                description="Diferente de descartar, isso some sem histórico."
                onConfirm={remover}
                okText="Apagar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button icon={<Trash2 size={14} />} danger>Apagar</Button>
              </Popconfirm>
            </Space>
          </div>
        </Form>
      </Drawer>

      <PromoverIdeiaModal
        ideia={promovendoBacklog ? ideia : null}
        open={promovendoBacklog}
        onClose={() => setPromovendoBacklog(false)}
        onPromovido={() => { setPromovendoBacklog(false); onChanged(); onClose(); }}
      />
    </>
  );
}
