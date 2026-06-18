import React from 'react';
import { Tabs } from 'antd';
import { Users, Compass } from 'lucide-react';
import { PageHeader } from '../components/ui';
import PessoasView from './PessoasView';
import Discovery from './Discovery';

export default function Clientes(): React.ReactElement {
  const items = [
    { key: 'contatos', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Users size={15} /> Contatos</span>, children: <PessoasView embedded /> },
    { key: 'discovery', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Compass size={15} /> Discovery</span>, children: <Discovery /> },
  ];

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1100, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Clientes" subtitle="Seu mini-CRM e o discovery: entreviste, extraia requisitos e vire ideia." />
      <Tabs defaultActiveKey="contatos" items={items} destroyInactiveTabPane />
    </div>
  );
}
