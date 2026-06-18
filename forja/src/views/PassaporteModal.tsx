import React, { useState } from 'react';
import { Modal, Button, message, Spin, Typography } from 'antd';
import { FileText, Copy } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
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
  const t = useTokens();
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
        icon={<FileText size={15} />}
        onClick={handleGenerate}
        style={{ borderColor: `${t.accents.peach}99`, color: t.accents.peach }}
      >
        Passaporte
      </Button>

      <Modal
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color={t.accents.peach} />
            Passaporte — {sistemaNome}
          </span>
        }
        open={open}
        onCancel={() => setOpen(false)}
        width={720}
        footer={[
          <Button key="close" onClick={() => setOpen(false)}>Fechar</Button>,
          <Button key="copy" type="primary" icon={<Copy size={15} />} onClick={handleCopy} disabled={!markdown}>
            Copiar Markdown
          </Button>,
        ]}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text style={{ color: t.textSecondary }}>Compilando passaporte...</Text>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#16171A',
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 20,
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: FONTS.mono,
              fontSize: 12.5,
              lineHeight: 1.7,
              color: '#E8E6E1',
              whiteSpace: 'pre-wrap',
            }}
          >
            {markdown}
          </div>
        )}

        <div style={{ marginTop: 12, padding: '10px 14px', background: t.surfaceMuted, borderRadius: 10 }}>
          <Text style={{ color: t.textSecondary, fontSize: 12 }}>
            Cole este Markdown no início de uma conversa com Cursor ou Claude para dar contexto completo sobre o sistema.
          </Text>
        </div>
      </Modal>
    </>
  );
}
