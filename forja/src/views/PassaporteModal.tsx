import React, { useState } from 'react';
import { Modal, Button, message, Spin, Typography } from 'antd';
import { FileMarkdownOutlined, CopyOutlined } from '@ant-design/icons';
import callServer from '../gas-client';
import type { ServerResponse } from '../types';

const { Text } = Typography;

interface PassaporteModalProps {
  sistemaId: string;
  sistemaNome: string;
}

// Mock para preview local
const MOCK_PASSAPORTE = `# FORJA (forja)

> Central de comando e governança de sistemas

**Estágio:** forja | **Saúde:** 85%
**Stack:** GAS, React, TypeScript, Ant Design

---

## Recursos

### [endpoint] POST /api/systems
Cria um novo sistema na base

### [db] Google Sheets
Base de dados principal via SheetDB engine

## Decisões Técnicas

### Usar React + Ant Design ao invés de Vanilla (2026-06-12)
**Decisão:** React com Ant Design como framework de UI
**Justificativa:** Componentes prontos, tipagem forte, dark theme nativo
**Status:** ativa

## ⚠️ Mapa de Quebra (Riscos)

_Nenhum risco mapeado._

## Custos

| Fornecedor | Valor | Recorrência |
|---|---|---|
| Google Workspace | R$ 0.00 | mensal |

## Timeline

_Nenhum evento registrado._

---
_Gerado pela FORJA em 2026-06-12_
`;

export default function PassaporteModal({ sistemaId, sistemaNome }: PassaporteModalProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');

  const handleGenerate = () => {
    setOpen(true);
    setLoading(true);
    callServer<ServerResponse<string>>('gerarPassaporte', sistemaId)
      .then(res => {
        if (res.ok && res.data) {
          setMarkdown(res.data);
        } else {
          message.error(res.error || 'Erro ao gerar passaporte');
        }
      })
      .catch(() => {
        // Preview local
        setMarkdown(MOCK_PASSAPORTE);
      })
      .finally(() => setLoading(false));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      message.success('Passaporte copiado! Cole no Claude para contexto completo.');
    }).catch(() => {
      // Fallback para ambientes sem clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      message.success('Passaporte copiado!');
    });
  };

  return (
    <>
      <Button
        icon={<FileMarkdownOutlined />}
        onClick={handleGenerate}
        style={{ borderColor: '#D4A853', color: '#D4A853' }}
      >
        Passaporte
      </Button>

      <Modal
        title={
          <span>
            <FileMarkdownOutlined style={{ marginRight: 8, color: '#D4A853' }} />
            Passaporte — {sistemaNome}
          </span>
        }
        open={open}
        onCancel={() => setOpen(false)}
        width={720}
        footer={[
          <Button key="close" onClick={() => setOpen(false)}>Fechar</Button>,
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopy} disabled={!markdown}>
            Copiar Markdown
          </Button>,
        ]}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text style={{ color: '#8B8D98' }}>Compilando passaporte...</Text>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#0F1114',
              border: '1px solid #2A2D35',
              borderRadius: 8,
              padding: 20,
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: '#E8E8ED',
              whiteSpace: 'pre-wrap',
            }}
          >
            {markdown}
          </div>
        )}

        <div style={{ marginTop: 12, padding: '8px 12px', background: '#1E2028', borderRadius: 6 }}>
          <Text style={{ color: '#5C5E6A', fontSize: 11 }}>
            💡 Cole este Markdown no início de uma conversa com Claude para dar contexto completo sobre o sistema.
          </Text>
        </div>
      </Modal>
    </>
  );
}
