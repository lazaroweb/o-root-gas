import React, { useState, useMemo } from 'react';
import { Modal, Tabs, Button, Empty, Tag } from 'antd';
import { GitBranch, Workflow, Database, Network, Brain, BookOpen, Flame, Check } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import MermaidView from './MermaidView';
import {
  EXEMPLOS_MERMAID,
  ROTULO_TIPO,
  exemplosPorSecao,
  type ExemploMermaid,
  type TipoMermaid,
} from '../templates/mermaidExemplos';

// ─── ModalExemplosDiagramas ──────────────────────────────────────────────────
// Galeria de 10 templates Mermaid renderizados que servem como starter pack.
// Quem nunca usou Mermaid escolhe um, vê na hora, e usa como base no editor.
//
// Layout:
//   - Modal grande (1100px) com 2 tabs (Genéricos / Sobre Forja)
//   - Cada tab tem grid de cards 2-coluna
//   - Cada card: header (tipo + título) + miniatura Mermaid (180px) + footer
//     (descrição + botão "Usar este")
//   - Renderização lazy via mounted flag — só monta MermaidViews quando modal
//     abre, evitando render inútil quando fechado

// Ícone por tipo de diagrama — consistente com o resto do app.
function iconePorTipo(tipo: TipoMermaid, size = 14): React.ReactElement {
  const props = { size, strokeWidth: 1.7 };
  switch (tipo) {
    case 'flowchart': return <GitBranch {...props} />;
    case 'sequenceDiagram': return <Workflow {...props} />;
    case 'erDiagram': return <Database {...props} />;
    case 'classDiagram': return <Network {...props} />;
    case 'mindmap': return <Brain {...props} />;
    default: return <GitBranch {...props} />;
  }
}

interface ModalExemplosDiagramasProps {
  open: boolean;
  onClose: () => void;
  // Chamado quando user escolhe um exemplo: pai recebe e carrega no editor.
  onEscolher: (exemplo: ExemploMermaid) => void;
}

export default function ModalExemplosDiagramas({
  open, onClose, onEscolher,
}: ModalExemplosDiagramasProps): React.ReactElement {
  const t = useTokens();
  const [secao, setSecao] = useState<'generico' | 'forja'>('generico');

  // Lista filtrada pela tab ativa. Memoizado pra não recriar a cada render.
  const exemplosVisiveis = useMemo(() => exemplosPorSecao(secao), [secao]);

  // ─── Card de um exemplo ────────────────────────────────────────────────
  const CardExemplo = ({ exemplo }: { exemplo: ExemploMermaid }) => (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 160ms ease, transform 160ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${t.accents.sage}66`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
    >
      {/* Header: tipo + título */}
      <div style={{
        padding: '12px 14px 8px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px solid ${t.borderSoft}`,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${t.accents.sage}15`,
          border: `1px solid ${t.accents.sage}33`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: t.accents.sage, flexShrink: 0,
        }}>
          {iconePorTipo(exemplo.tipo, 14)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONTS.display, fontSize: 14, fontWeight: 500,
            color: t.text, lineHeight: 1.3,
          }}>
            {exemplo.titulo}
          </div>
          <Tag style={{
            margin: 0, marginTop: 3, fontSize: 10, lineHeight: 1.4,
            background: 'transparent', borderColor: t.borderSoft, color: t.textTertiary,
            padding: '0 6px', borderRadius: 6,
          }}>
            {ROTULO_TIPO[exemplo.tipo]}
          </Tag>
        </div>
      </div>

      {/* Miniatura renderizada — render real do Mermaid em tamanho compacto.
          showToolbar=false porque a toolbar atrapalha no preview pequeno.
          semGrade pra ficar mais "clean" (a grade só faz sentido em canvas grande). */}
      <div style={{ padding: 10, background: t.surfaceMuted }}>
        <MermaidView
          code={exemplo.mermaid}
          minHeight={200}
          showToolbar={false}
          semGrade
        />
      </div>

      {/* Footer: descrição + botão */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderTop: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{
          flex: 1, fontSize: 12, color: t.textSecondary, lineHeight: 1.4,
        }}>
          {exemplo.descricao}
        </div>
        <Button
          type="primary"
          size="small"
          icon={<Check size={13} />}
          onClick={() => { onEscolher(exemplo); onClose(); }}
        >
          Usar este
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={18} strokeWidth={1.7} color={t.accents.sage} />
          <span style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 500 }}>
            Galeria de exemplos
          </span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.06em',
            color: t.textTertiary, marginLeft: 4,
            padding: '2px 7px', borderRadius: 999,
            background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
            textTransform: 'uppercase',
          }}>
            10 templates · zero IA
          </span>
        </div>
      }
      // destroyOnClose: importante pra não manter os 10 MermaidViews montados
      // quando o modal está fechado (lazy mount/unmount).
      destroyOnClose
      styles={{ body: { padding: '8px 0 0' } }}
    >
      <div style={{
        fontSize: 12.5, color: t.textSecondary, marginBottom: 14,
        paddingInline: 4,
      }}>
        Cada card mostra um exemplo pronto. Clique <strong>"Usar este"</strong> pra carregar
        no editor — sem consumir IA. Depois você pode editar manualmente ou clicar
        <strong> Re-gerar</strong> pra IA refazer com seu próprio contexto.
      </div>

      <Tabs
        activeKey={secao}
        onChange={(k) => setSecao(k as 'generico' | 'forja')}
        items={[
          {
            key: 'generico',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={13} strokeWidth={1.7} />
                Exemplos genéricos
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 9.5,
                  color: t.textTertiary, marginLeft: 2,
                }}>
                  ({exemplosPorSecao('generico').length})
                </span>
              </span>
            ),
          },
          {
            key: 'forja',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Flame size={13} strokeWidth={1.7} />
                Sobre Forja
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 9.5,
                  color: t.textTertiary, marginLeft: 2,
                }}>
                  ({exemplosPorSecao('forja').length})
                </span>
              </span>
            ),
          },
        ]}
      />

      {/* Grid 2-col responsivo. Em telas estreitas vira 1-col automaticamente. */}
      {exemplosVisiveis.length === 0 ? (
        <Empty description="Nenhum exemplo nesta seção" style={{ padding: 40 }} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
          gap: 16,
          paddingBottom: 8,
        }}>
          {exemplosVisiveis.map((ex) => (
            <CardExemplo key={ex.id} exemplo={ex} />
          ))}
        </div>
      )}
    </Modal>
  );
}
