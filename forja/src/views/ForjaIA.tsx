import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { MessageCircle, Users, FileText, Workflow, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/ui';
import IAChat from './IAChat';
import IAConselho from './IAConselho';
import IABlueprint from './IABlueprint';
import IADiagramas from './IADiagramas';
import IAPrompts from './IAPrompts';
import callServer from '../gas-client';
import type { Sistema, Ideia, ServerResponse } from '../types';

export default function ForjaIA(): React.ReactElement {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [ideias, setIdeias] = useState<Ideia[]>([]);

  useEffect(() => {
    callServer<ServerResponse<Sistema[]>>('getSistemas')
      .then(res => { if (res.ok && res.data) setSistemas(res.data as Sistema[]); })
      .catch(() => setSistemas([]));
    callServer<ServerResponse<Ideia[]>>('getIdeias')
      .then(res => { if (res.ok && res.data) setIdeias(res.data as Ideia[]); })
      .catch(() => setIdeias([]));
  }, []);

  const items = [
    { key: 'chat', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><MessageCircle size={15} /> Assistente</span>, children: <IAChat sistemas={sistemas} /> },
    { key: 'conselho', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Users size={15} /> Conselho</span>, children: <IAConselho ideias={ideias} sistemas={sistemas} /> },
    { key: 'blueprint', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FileText size={15} /> Blueprint</span>, children: <IABlueprint ideias={ideias} sistemas={sistemas} /> },
    { key: 'diagramas', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Workflow size={15} /> Diagramas</span>, children: <IADiagramas ideias={ideias} sistemas={sistemas} /> },
    { key: 'prompts', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><SlidersHorizontal size={15} /> Prompts</span>, children: <IAPrompts /> },
  ];

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 1160, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      <PageHeader title="Forja IA" subtitle="O cérebro da Forja: assistente, conselho de especialistas, blueprints e diagramas." />
      <Tabs defaultActiveKey="chat" items={items} destroyInactiveTabPane />
    </div>
  );
}
