import React, { useState, useEffect } from 'react';
import { Typography, Button, Steps, Form, Input, Space, Spin, message, Card } from 'antd';
import { ArrowLeftOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { Ideia, ServerResponse } from '../types';

const { Title, Text } = Typography;

interface GeneseWizardProps {
  ideiaId: string;
  onBack: () => void;
}

interface Respostas {
  publico: string;
  problema: string;
  stack: string;
  mvp: string;
  monetizacao: string;
}

const STEPS = [
  { title: 'Público', question: 'Quem vai usar isso? Descreva o público-alvo.' },
  { title: 'Problema', question: 'Qual problema concreto isso resolve para essas pessoas?' },
  { title: 'Stack', question: 'Que tecnologias você imagina usar? (pode ser "não sei ainda")' },
  { title: 'MVP', question: 'Qual é o mínimo viável? O que precisa funcionar no dia 1?' },
  { title: 'Monetização', question: 'Como isso gera valor/dinheiro? (assinatura, one-time, freemium, interno)' },
];

const MOCK_IDEIA: Ideia = {
  id: 'mock',
  titulo: 'App de orçamentos com IA',
  descricao: 'Gerador de propostas comerciais que usa IA para estimar preços',
  notaImpacto: 8,
  notaEsforco: 5,
  estado: 'validando',
};

export default function GeneseWizard({ ideiaId, onBack }: GeneseWizardProps): React.ReactElement {
  const [ideia, setIdeia] = useState<Ideia | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({ publico: '', problema: '', stack: '', mvp: '', monetizacao: '' });
  const [generating, setGenerating] = useState(false);
  const [kickoff, setKickoff] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    callServer<ServerResponse<Ideia>>('getIdeias')
      .then(res => {
        if (res.ok && res.data) {
          const found = (res.data as unknown as Ideia[]).find(i => i.id === ideiaId);
          if (found) setIdeia(found);
        }
      })
      .catch(() => setIdeia(MOCK_IDEIA))
      .finally(() => setLoading(false));
  }, [ideiaId]);

  const handleNext = () => {
    const field = Object.keys(respostas)[currentStep] as keyof Respostas;
    const value = form.getFieldValue(field) as string;
    setRespostas(prev => ({ ...prev, [field]: value || '' }));

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Último passo — gerar
      const finalRespostas = { ...respostas, [field]: value || '' };
      handleGenerate(finalRespostas);
    }
  };

  const handleGenerate = (r: Respostas) => {
    setGenerating(true);
    callServer<ServerResponse<string>>('gerarGenese', ideiaId, r)
      .then(res => {
        if (res.ok && res.data) {
          setKickoff(res.data);
        } else {
          message.error(res.error || 'Erro ao gerar');
        }
      })
      .catch(() => {
        // Mock local
        let mock = `# Kickoff: ${ideia?.titulo || 'Projeto'}\n\n`;
        mock += `## Contexto\n${ideia?.descricao || ''}\n\n`;
        mock += `## Validação\n`;
        mock += `- **Público-alvo:** ${r.publico}\n`;
        mock += `- **Problema:** ${r.problema}\n`;
        mock += `- **Stack:** ${r.stack}\n`;
        mock += `- **MVP:** ${r.mvp}\n`;
        mock += `- **Monetização:** ${r.monetizacao}\n\n`;
        mock += `## Prompt para o Claude\n\n`;
        mock += `> Construa "${ideia?.titulo}" — ${ideia?.descricao}. Público: ${r.publico}. MVP: ${r.mvp}. Stack: ${r.stack}.\n`;
        setKickoff(mock);
      })
      .finally(() => setGenerating(false));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(kickoff).then(() => {
      message.success('Prompt de kickoff copiado! Cole no Claude para começar a construir.');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = kickoff;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      message.success('Copiado!');
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  // Resultado final
  if (kickoff) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 720 }}>
        <Space style={{ marginBottom: 24 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#8B8D98' }} />
          <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
            <ThunderboltOutlined style={{ marginRight: 8, color: '#D4A853' }} />
            Gênese Completa!
          </Title>
        </Space>

        <div
          style={{
            background: '#0F1114',
            border: '1px solid #2A2D35',
            borderRadius: 8,
            padding: 20,
            maxHeight: 450,
            overflow: 'auto',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#E8E8ED',
            whiteSpace: 'pre-wrap',
            marginBottom: 16,
          }}
        >
          {kickoff}
        </div>

        <Space>
          <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>Copiar Prompt</Button>
          <Button onClick={onBack}>Voltar às Ideias</Button>
        </Space>

        <div style={{ marginTop: 16, padding: '8px 12px', background: '#1E2028', borderRadius: 6 }}>
          <Text style={{ color: '#5C5E6A', fontSize: 11 }}>
            💡 Cole este prompt no Claude para iniciar o desenvolvimento do projeto. A ideia foi marcada como "em andamento".
          </Text>
        </div>
      </div>
    );
  }

  // Wizard steps
  const field = Object.keys(respostas)[currentStep] as keyof Respostas;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 640 }}>
      <Space style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#8B8D98' }} />
        <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
          <ThunderboltOutlined style={{ marginRight: 8, color: '#D4A853' }} />
          Gênese: {ideia?.titulo}
        </Title>
      </Space>

      <Card style={{ borderColor: '#2A2D35', marginBottom: 24 }}>
        <Text style={{ color: '#8B8D98' }}>{ideia?.descricao}</Text>
      </Card>

      <Steps
        current={currentStep}
        size="small"
        items={STEPS.map(s => ({ title: s.title }))}
        style={{ marginBottom: 32 }}
      />

      <Form form={form} layout="vertical" onFinish={handleNext}>
        <Title level={5} style={{ color: '#E8E8ED', fontWeight: 500, marginBottom: 16 }}>
          {STEPS[currentStep].question}
        </Title>
        <Form.Item name={field} rules={[{ required: true, message: 'Responda para continuar' }]}>
          <Input.TextArea
            rows={3}
            placeholder="Sua resposta..."
            autoFocus
          />
        </Form.Item>
        <Space>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>Voltar</Button>
          )}
          <Button type="primary" htmlType="submit" loading={generating}>
            {currentStep === STEPS.length - 1 ? '⚡ Gerar Kickoff' : 'Próximo'}
          </Button>
        </Space>
      </Form>
    </div>
  );
}