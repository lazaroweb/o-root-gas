import React, { useState, useMemo } from 'react';
import { Button, Checkbox, App as AntApp, Tooltip, Tag } from 'antd';
import {
  Wand2, Check, X, Lightbulb, Boxes, ShieldAlert, Rocket, Receipt, FileText, BellOff, Workflow, AlertCircle,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

// Espelha o que o servidor emite em chatLLMComTools().toolCalls.
export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ToolExecutionResult {
  tool: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  preview: string;
}

interface Props {
  calls: ToolCall[];
  onExecuted: (results: ToolExecutionResult[]) => void;
  onRejected: () => void;
}

const ICON_POR_TOOL: Record<string, React.ReactNode> = {
  criar_ideia: <Lightbulb size={14} strokeWidth={1.7} />,
  criar_sistema: <Boxes size={14} strokeWidth={1.7} />,
  registrar_decisao: <Workflow size={14} strokeWidth={1.7} />,
  registrar_risco: <ShieldAlert size={14} strokeWidth={1.7} />,
  registrar_oportunidade: <Rocket size={14} strokeWidth={1.7} />,
  criar_cobranca: <Receipt size={14} strokeWidth={1.7} />,
  marcar_alertas_lidos: <BellOff size={14} strokeWidth={1.7} />,
  gerar_arquivo_md: <FileText size={14} strokeWidth={1.7} />,
};

const ROTULO_AMIGAVEL: Record<string, string> = {
  criar_ideia: 'Criar ideia',
  criar_sistema: 'Criar sistema',
  registrar_decisao: 'Registrar decisão',
  registrar_risco: 'Registrar risco',
  registrar_oportunidade: 'Registrar oportunidade',
  criar_cobranca: 'Adicionar cobrança',
  marcar_alertas_lidos: 'Marcar alertas como lidos',
  gerar_arquivo_md: 'Gerar arquivo .md',
};

function previewParams(tool: string, params: Record<string, unknown>): string {
  if (tool === 'criar_ideia') return String(params.titulo || '—');
  if (tool === 'criar_sistema') return String(params.nome || '—');
  if (tool === 'registrar_decisao') return String(params.titulo || params.decisao || '—');
  if (tool === 'registrar_risco') return `${params.area || '—'} · ${params.descricao || ''}`.slice(0, 90);
  if (tool === 'registrar_oportunidade') return String(params.titulo || '—');
  if (tool === 'criar_cobranca') return `${params.fornecedor || '—'} · R$${params.valor || 0} ${params.recorrencia || ''}`;
  if (tool === 'marcar_alertas_lidos') return 'Todos os alertas pendentes';
  if (tool === 'gerar_arquivo_md') return `${params.titulo || 'arquivo'}.md`;
  return JSON.stringify(params).slice(0, 90);
}

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export default function ToolProposalCard({ calls, onExecuted, onRejected }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [selecionadas, setSelecionadas] = useState<Set<number>>(() => new Set(calls.map((_, i) => i)));
  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState<ToolExecutionResult[] | null>(null);

  const todasMarcadas = useMemo(() => selecionadas.size === calls.length, [selecionadas.size, calls.length]);
  const nenhumaMarcada = useMemo(() => selecionadas.size === 0, [selecionadas.size]);

  const toggle = (i: number) => {
    setSelecionadas((s) => {
      const novo = new Set(s);
      if (novo.has(i)) novo.delete(i); else novo.add(i);
      return novo;
    });
  };

  const toggleTodas = () => {
    if (todasMarcadas) setSelecionadas(new Set());
    else setSelecionadas(new Set(calls.map((_, i) => i)));
  };

  const executar = async () => {
    const selecao = calls.filter((_, i) => selecionadas.has(i));
    if (selecao.length === 0) return;
    setExecutando(true);
    try {
      const r = await callServer<ServerResult>('executarToolsIA', selecao);
      if (r.ok && r.data) {
        const d = r.data as { resultados: ToolExecutionResult[]; sucessos: number; falhas: number };
        setResultados(d.resultados);
        for (const res of d.resultados) {
          if (res.ok && res.tool === 'gerar_arquivo_md' && res.data) {
            const arq = res.data as { filename: string; conteudo: string; mime: string };
            downloadFile(arq.filename, arq.conteudo, arq.mime || 'text/markdown');
          }
        }
        if (d.falhas === 0) message.success(`${d.sucessos} ação(ões) executada(s)`);
        else message.warning(`${d.sucessos} sucesso(s), ${d.falhas} falha(s)`);
        onExecuted(d.resultados);
      } else {
        message.error(r.error || 'Erro ao executar ações');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setExecutando(false);
    }
  };

  // Após execução, mostra os resultados (read-only)
  if (resultados) {
    const sucessos = resultados.filter((r) => r.ok).length;
    const falhas = resultados.length - sucessos;
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Check size={16} color={t.accents.sage} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 500, color: t.text }}>
            {sucessos} ação(ões) executada(s){falhas > 0 ? ` · ${falhas} falha(s)` : ''}
          </span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {resultados.map((r, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTS.ui, fontSize: 12, color: r.ok ? t.textSecondary : t.accents.rose }}>
              {r.ok ? <Check size={13} color={t.accents.sage} /> : <AlertCircle size={13} color={t.accents.rose} />}
              <span style={{ flex: 1 }}>{r.preview || r.tool}</span>
              {!r.ok && <span style={{ fontSize: 11, color: t.accents.rose }}>· {r.error}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.accents.peach}55`, borderRadius: 14, padding: 16, marginTop: 8, boxShadow: t.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wand2 size={16} color={t.accents.peach} />
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 500, color: t.text }}>
            A Forja IA quer executar {calls.length} ação(ões)
          </span>
          <Tag color="orange" style={{ marginInlineEnd: 0, fontSize: 10 }}>aguarda aprovação</Tag>
        </div>
        <button
          onClick={toggleTodas}
          style={{ background: 'none', border: 'none', color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12, cursor: 'pointer' }}
        >
          {todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {calls.map((call, i) => {
          const rotulo = ROTULO_AMIGAVEL[call.tool] || call.tool;
          const icon = ICON_POR_TOOL[call.tool] || <Workflow size={14} />;
          return (
            <li
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: selecionadas.has(i) ? `${t.accents.peach}0e` : t.surfaceMuted,
                border: `1px solid ${selecionadas.has(i) ? `${t.accents.peach}55` : t.borderSoft}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onClick={() => toggle(i)}
            >
              <Checkbox checked={selecionadas.has(i)} onChange={() => toggle(i)} onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }} />
              <span style={{ color: t.accents.peach, marginTop: 2 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 500 }}>{rotulo}</div>
                <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewParams(call.tool, call.params)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button icon={<X size={14} />} onClick={onRejected} disabled={executando}>Recusar tudo</Button>
        <Button
          type="primary"
          icon={<Check size={14} />}
          loading={executando}
          disabled={nenhumaMarcada}
          onClick={executar}
        >
          Executar {selecionadas.size > 0 ? `(${selecionadas.size})` : ''}
        </Button>
      </div>
    </div>
  );
}
