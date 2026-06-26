import React from 'react';
import { Tabs } from 'antd';
import { Users, Radar, Target } from 'lucide-react';
import { PageHeader } from '../components/ui';
import PessoasView from './PessoasView';
import RadarOportunidades from './RadarOportunidades';
import PipelineComercial from './PipelineComercial';

export default function Clientes(): React.ReactElement {
  const items = [
    { key: 'contatos', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Users size={15} /> Contatos</span>, children: <PessoasView embedded /> },
    { key: 'pipeline', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Target size={15} /> Pipeline</span>, children: <PipelineComercial /> },
    { key: 'radar', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Radar size={15} /> Radar de oportunidades</span>, children: <RadarOportunidades /> },
  ];

  return (
    <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1180, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Clientes" subtitle="Seu mini-CRM: contatos com Discovery, pipeline comercial com kanban arrastável, e o radar das melhores oportunidades." />
      <Tabs defaultActiveKey="contatos" items={items} destroyInactiveTabPane />
    </div>
  );
}
