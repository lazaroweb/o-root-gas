import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, List, Typography, Tag, Space, Empty } from 'antd';
import { SearchOutlined, AppstoreOutlined, BulbOutlined, TeamOutlined, RocketOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { ServerResponse, ViewName } from '../types';

const { Text } = Typography;

interface SearchResult {
  tipo: string;
  id: string;
  titulo: string;
  subtitulo: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tipo: string, id: string) => void;
}

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  sistema: { icon: <AppstoreOutlined />, color: '#D4A853', label: 'Sistema' },
  ideia: { icon: <BulbOutlined />, color: '#E8A838', label: 'Ideia' },
  pessoa: { icon: <TeamOutlined />, color: '#4A9EFF', label: 'Pessoa' },
  oportunidade: { icon: <RocketOutlined />, color: '#52C97F', label: 'Oportunidade' },
};

const MOCK_RESULTS: SearchResult[] = [
  { tipo: 'sistema', id: '1', titulo: 'FORJA', subtitulo: 'forja' },
  { tipo: 'sistema', id: '2', titulo: 'ClientFlow', subtitulo: 'cflow' },
  { tipo: 'ideia', id: 'i1', titulo: 'App de orçamentos', subtitulo: 'nova' },
];

export default function SearchModal({ open, onClose, onSelect }: SearchModalProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    callServer<ServerResponse<SearchResult[]>>('buscaGlobal', q)
      .then(res => {
        if (res.ok && res.data) setResults(res.data);
      })
      .catch(() => {
        // Mock local
        const filtered = MOCK_RESULTS.filter(r => r.titulo.toLowerCase().includes(q.toLowerCase()));
        setResults(filtered);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, doSearch]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={520}
      styles={{ body: { padding: 0 } }}
      style={{ top: 80 }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2D35' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#5C5E6A' }} />}
          placeholder="Buscar sistemas, ideias, pessoas..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          variant="borderless"
          autoFocus
          style={{ fontSize: 16 }}
          suffix={<Tag style={{ fontSize: 10, color: '#5C5E6A' }}>ESC</Tag>}
        />
      </div>

      <div style={{ maxHeight: 360, overflow: 'auto', padding: '8px 0' }}>
        {query.length < 2 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Text style={{ color: '#5C5E6A', fontSize: 13 }}>
              Digite pelo menos 2 caracteres para buscar
            </Text>
          </div>
        ) : results.length === 0 && !loading ? (
          <Empty description="Nenhum resultado" style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            loading={loading}
            dataSource={results}
            renderItem={item => {
              const config = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.sistema;
              return (
                <List.Item
                  onClick={() => { onSelect(item.tipo, item.id); onClose(); }}
                  style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1E2028'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Space>
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <div>
                      <Text style={{ color: '#E8E8ED', fontSize: 14 }}>{item.titulo}</Text>
                      <Text style={{ color: '#5C5E6A', fontSize: 11, marginLeft: 8 }}>{item.subtitulo}</Text>
                    </div>
                  </Space>
                  <Tag style={{ fontSize: 10 }} color={config.color}>{config.label}</Tag>
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid #2A2D35', display: 'flex', gap: 12 }}>
        <Text style={{ color: '#3A3C45', fontSize: 10 }}>↵ Selecionar</Text>
        <Text style={{ color: '#3A3C45', fontSize: 10 }}>ESC Fechar</Text>
        <Text style={{ color: '#3A3C45', fontSize: 10 }}>⌘K Abrir</Text>
      </div>
    </Modal>
  );
}