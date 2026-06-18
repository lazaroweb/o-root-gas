import React, { useState, useEffect } from 'react';
import { Form, Input, Select, InputNumber, Button, Space, App as AntApp } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { Sistema, ServerResponse, Estagio } from '../types';

const { TextArea } = Input;

interface SistemaFormProps {
  sistemaId?: string | null;
  onBack: () => void;
  onSaved: () => void;
}

interface FormValues {
  nome: string;
  codinome: string;
  estagio: Estagio;
  proposito: string;
  stack: string;
  urlProd: string;
  repoUrl: string;
  scoreSaude: number;
  dominioCustomizado: string;
}

const ESTAGIO_OPTIONS = [
  { value: 'faisca', label: '🔥 Faísca — ideia em validação' },
  { value: 'forja', label: '⚒️ Forja — em construção' },
  { value: 'tempera', label: '🛡️ Têmpera — em produção' },
  { value: 'prateleira', label: '📦 Prateleira — pausado/aposentado' },
];

export default function SistemaForm({ sistemaId, onBack, onSaved }: SistemaFormProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const isEditing = Boolean(sistemaId);

  useEffect(() => {
    if (sistemaId) {
      setLoadingData(true);
      callServer<ServerResponse<Sistema>>('getSistemaById', sistemaId)
        .then(res => {
          if (res.ok && res.data) {
            form.setFieldsValue(res.data);
          } else {
            message.error(res.error || 'Erro ao carregar sistema');
          }
        })
        .catch(() => {
          // Local preview — preenche com mock
          form.setFieldsValue({
            nome: 'Sistema Exemplo',
            codinome: 'exemplo',
            estagio: 'forja',
            proposito: 'Demonstração local',
            stack: 'React, TypeScript',
            urlProd: '',
            repoUrl: '',
            scoreSaude: 75,
          });
        })
        .finally(() => setLoadingData(false));
    }
  }, [sistemaId, form]);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      let res: ServerResponse<Sistema>;
      if (isEditing && sistemaId) {
        res = await callServer<ServerResponse<Sistema>>('updateSistema', sistemaId, values);
      } else {
        res = await callServer<ServerResponse<Sistema>>('createSistema', values);
      }
      if (res.ok) {
        message.success(isEditing ? 'Sistema atualizado!' : 'Sistema criado!');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro de conexão. Verifique se o app está publicado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 640, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      {/* Header */}
      <Space style={{ marginBottom: 28 }} align="center">
        <Button type="text" icon={<ArrowLeft size={18} />} onClick={onBack} style={{ color: t.textSecondary }} />
        <span style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 26, color: t.text }}>
          {isEditing ? 'Editar sistema' : 'Novo sistema'}
        </span>
      </Space>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loadingData}
        initialValues={{ estagio: 'faisca', scoreSaude: 0 }}
      >
        <Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Nome é obrigatório' }]}>
          <Input placeholder="Ex: ClientFlow" />
        </Form.Item>

        <Form.Item name="codinome" label="Codinome" rules={[{ required: true, message: 'Codinome é obrigatório' }]}>
          <Input
            placeholder="Ex: cflow"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          />
        </Form.Item>

        <Form.Item name="estagio" label="Estágio" rules={[{ required: true }]}>
          <Select options={ESTAGIO_OPTIONS} />
        </Form.Item>

        <Form.Item name="proposito" label="Propósito">
          <TextArea rows={3} placeholder="O que este sistema faz? Para quem?" />
        </Form.Item>

        <Form.Item name="stack" label="Stack">
          <Input placeholder="Ex: Next.js, Supabase, Vercel (separado por vírgula)" />
        </Form.Item>

        <Form.Item name="urlProd" label="URL de Produção">
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item
          name="dominioCustomizado"
          label="Domínio próprio (opcional)"
          extra={<DomainHints form={form} />}
        >
          <Input placeholder="ex.: minhaotica.com.br" style={{ fontFamily: FONTS.mono }} />
        </Form.Item>

        <Form.Item name="repoUrl" label="Repositório (GitHub)">
          <Input placeholder="https://github.com/usuario/repo" style={{ fontFamily: FONTS.mono }} />
        </Form.Item>

        <Form.Item name="scoreSaude" label="Score de Saúde (0-100)">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item style={{ marginTop: 32 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEditing ? 'Salvar Alterações' : 'Criar Sistema'}
            </Button>
            <Button onClick={onBack}>Cancelar</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}

// Sugestões inteligentes de domínio baseadas no codinome do sistema.
// Clica e preenche o campo. Mostra também links pra checar disponibilidade.
function DomainHints({ form }: { form: ReturnType<typeof Form.useForm<FormValues>>[0] }): React.ReactElement {
  const t = useTokens();
  const codinome = (Form.useWatch('codinome', form) || '').toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!codinome) return <span style={{ color: t.textTertiary, fontSize: 12 }}>Preencha o codinome pra ver sugestões.</span>;

  const sugestoes = [
    `${codinome}.com.br`,
    `${codinome}.com`,
    `${codinome}.app`,
    `${codinome}.io`,
  ];

  const aplicar = (s: string) => form.setFieldValue('dominioCustomizado', s);
  const valor = Form.useWatch('dominioCustomizado', form) as string | undefined;
  const buscaUrl = valor
    ? `https://registro.br/painel/dominios/${encodeURIComponent(valor)}`
    : `https://registro.br/painel/dominios/${encodeURIComponent(codinome)}.com.br`;

  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: t.textTertiary }}>Sugestões:</span>
      {sugestoes.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => aplicar(s)}
          style={{
            background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
            borderRadius: 7, padding: '2px 8px', fontSize: 11, color: t.textSecondary,
            cursor: 'pointer', fontFamily: FONTS.mono,
          }}
        >
          {s}
        </button>
      ))}
      <a
        href={buscaUrl} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 11, color: t.accents.blue, marginLeft: 6 }}
      >
        Verificar no Registro.br →
      </a>
    </div>
  );
}
