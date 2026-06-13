import React, { useState, useEffect } from 'react';
import { Form, Input, Select, InputNumber, Button, Typography, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Sistema, ServerResponse, Estagio } from '../types';

const { Title } = Typography;
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
  scoreSaude: number;
}

const ESTAGIO_OPTIONS = [
  { value: 'faisca', label: '🔥 Faísca — ideia em validação' },
  { value: 'forja', label: '⚒️ Forja — em construção' },
  { value: 'tempera', label: '🛡️ Têmpera — em produção' },
  { value: 'prateleira', label: '📦 Prateleira — pausado/aposentado' },
];

export default function SistemaForm({ sistemaId, onBack, onSaved }: SistemaFormProps): React.ReactElement {
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
    <div style={{ padding: '32px 40px', maxWidth: 640 }}>
      {/* Header */}
      <Space style={{ marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ color: '#8B8D98' }}
        />
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          {isEditing ? 'Editar Sistema' : 'Novo Sistema'}
        </Title>
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
