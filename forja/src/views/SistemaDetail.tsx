import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Spin, Alert, Descriptions, Card, Table, Divider, Tabs } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import StageBadge from '../components/StageBadge';
import RecursosPanel from './RecursosPanel';
import DecisoesPanel from './DecisoesPanel';
import RiscosPanel from './RiscosPanel';
import PulsosPanel from './PulsosPanel';
import PassaporteModal from './PassaporteModal';
import callServer from '../gas-client';
import type { Sistema, Custo, ServerResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

interface SistemaDetailProps {
  sistemaId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

// Mock data para preview local
const MOCK_SISTEMA: Sistema = {
  id: 'mock-1',
  nome: 'FORJA',
  codinome: 'forja',
  estagio: 'forja',
  proposito: 'Central de comando e governança de sistemas',
  stack: 'GAS, React, TypeScript, Ant Design',
  urlProd: '',
  scoreSaude: 85,
};

const MOCK_CUSTOS: Custo[] = [
  { id: 'c1', sistemaId: 'mock-1', fornecedor: 'Google Workspace', valor: 0, recorrencia: 'mensal', proximaCobranca: '' },
];

export default function SistemaDetail({ sistemaId, onBack, onEdit }: SistemaDetailProps): React.ReactElement {
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<Sistema>>('getSistemaById', sistemaId),
      callServer<ServerResponse<Custo[]>>('getCustosBySistema', sistemaId),
    ])
      .then(([sRes, cRes]) => {
        if (sRes.ok && sRes.data) setSistema(sRes.data);
        else setError(sRes.error || 'Sistema não encontrado');
        if (cRes.ok && cRes.data) setCustos(cRes.data);
      })
      .catch(() => {
        setSistema(MOCK_SISTEMA);
        setCustos(MOCK_CUSTOS);
      })
      .finally(() => setLoading(false));
  }, [sistemaId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (error || !sistema) return <Alert type="error" message={error || 'Erro'} showIcon style={{ margin: 24 }} />;

  const custosColumns = [
    { title: 'Fornecedor', dataIndex: 'fornecedor', key: 'fornecedor' },
    { title: 'Valor', dataIndex: 'valor', key: 'valor', render: (v: number) => `R$ ${v.toFixed(2)}` },
    { title: 'Recorrência', dataIndex: 'recorrencia', key: 'recorrencia' },
    { title: 'Próxima Cobrança', dataIndex: 'proximaCobranca', key: 'proximaCobranca' },
  ];

  const tabItems = [
    {
      key: 'recursos',
      label: '🔌 Recursos',
      children: <RecursosPanel sistemaId={sistemaId} />,
    },
    {
      key: 'decisoes',
      label: '📋 Decisões',
      children: <DecisoesPanel sistemaId={sistemaId} />,
    },
    {
      key: 'riscos',
      label: '⚠️ Riscos',
      children: <RiscosPanel sistemaId={sistemaId} />,
    },
    {
      key: 'custos',
      label: '💰 Custos',
      children: (
        <Table
          columns={custosColumns}
          dataSource={custos}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: 'Nenhum custo registrado' }}
        />
      ),
    },
    {
      key: 'pulsos',
      label: '📡 Pulsos',
      children: <PulsosPanel sistemaId={sistemaId} />,
    },
  ];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#8B8D98' }} />
          <Title level={3} style={{ color: '#E8E8ED', margin: 0, fontWeight: 600 }}>
            {sistema.nome}
          </Title>
          <StageBadge estagio={sistema.estagio} />
        </Space>
        <Space>
          <PassaporteModal sistemaId={sistemaId} sistemaNome={sistema.nome} />
          <Button icon={<EditOutlined />} onClick={() => onEdit(sistema.id)}>Editar</Button>
        </Space>
      </div>

      {/* Codinome */}
      <Text style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: '#5C5E6A', display: 'block', marginBottom: 16 }}>
        #{sistema.codinome}
      </Text>

      {/* Descrição */}
      {sistema.proposito && (
        <Paragraph style={{ color: '#8B8D98', fontSize: 15, marginBottom: 24 }}>
          {sistema.proposito}
        </Paragraph>
      )}

      {/* Info card */}
      <Card style={{ borderColor: '#2A2D35', marginBottom: 24 }}>
        <Descriptions column={2} size="small" labelStyle={{ color: '#5C5E6A' }} contentStyle={{ color: '#E8E8ED' }}>
          <Descriptions.Item label="Stack">{sistema.stack || '—'}</Descriptions.Item>
          <Descriptions.Item label="Saúde">{sistema.scoreSaude}%</Descriptions.Item>
          <Descriptions.Item label="URL Produção" span={2}>
            {sistema.urlProd ? (
              <a href={sistema.urlProd} target="_blank" rel="noopener noreferrer" style={{ color: '#4A9EFF' }}>
                {sistema.urlProd}
              </a>
            ) : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tabs: Recursos, Decisões, Riscos, Custos */}
      <Divider style={{ borderColor: '#2A2D35', marginBottom: 8 }} />
      <Tabs items={tabItems} defaultActiveKey="recursos" />
    </div>
  );
}
