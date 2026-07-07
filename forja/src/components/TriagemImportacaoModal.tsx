// TriagemImportacaoModal — v1.262.0
// Triagem pós-importação de Skills e Agents: logo depois de importar, mostra
// SÓ os itens recém-criados pra você decidir categoria (existente ou nova) e
// estrelas de cada um — sem caçar os novos no meio de centenas já triados.
// Aplica tudo num lote só via RPC `hubTriagemAplicar`.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, AutoComplete, Rate, message, Tag } from 'antd';
import { ListChecks, Sparkles } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

export interface ItemTriagem {
  id: string;
  nome: string;
  slug?: string;
  descricao?: string;
  categoria?: string; // categoria que veio do arquivo (pré-preenche)
}

interface Props {
  aberto: boolean;
  onClose: () => void;
  tipo: 'skills' | 'agents';
  itens: ItemTriagem[];
  // Categorias já usadas na base — viram sugestões; digitar livre cria nova.
  categoriasExistentes: string[];
  // Chamado depois de aplicar com sucesso (pra recarregar a lista do hub).
  onAplicado: () => void;
}

interface Escolha { categoria: string; estrelas: number }

export default function TriagemImportacaoModal({
  aberto, onClose, tipo, itens, categoriasExistentes, onAplicado,
}: Props): React.ReactElement {
  const t = useTokens();
  const isSkills = tipo === 'skills';
  const corDestaque = isSkills ? t.accents.lavender : t.accents.blue;
  const label = isSkills ? 'skill' : 'agent';

  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [catTodos, setCatTodos] = useState('');
  const [estrelasTodos, setEstrelasTodos] = useState(0);
  const [salvando, setSalvando] = useState(false);

  // Reinicia as escolhas quando o lote muda (pré-preenche com a categoria
  // que o arquivo trouxe, se trouxe).
  useEffect(() => {
    if (!aberto) return;
    const base: Record<string, Escolha> = {};
    for (const it of itens) base[it.id] = { categoria: (it.categoria || '').trim(), estrelas: 0 };
    setEscolhas(base);
    setCatTodos('');
    setEstrelasTodos(0);
  }, [aberto, itens]);

  const opcoesCategoria = useMemo(() => {
    const set = new Set(categoriasExistentes.map((c) => c.trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c }));
  }, [categoriasExistentes]);

  const setEscolha = (id: string, patch: Partial<Escolha>) => {
    setEscolhas((prev) => ({ ...prev, [id]: { ...(prev[id] || { categoria: '', estrelas: 0 }), ...patch } }));
  };

  const aplicarATodos = () => {
    setEscolhas((prev) => {
      const novo: Record<string, Escolha> = {};
      for (const it of itens) {
        const cur = prev[it.id] || { categoria: '', estrelas: 0 };
        novo[it.id] = {
          categoria: catTodos.trim() || cur.categoria,
          estrelas: estrelasTodos > 0 ? estrelasTodos : cur.estrelas,
        };
      }
      return novo;
    });
  };

  const salvar = async () => {
    const payload = itens
      .map((it) => {
        const e = escolhas[it.id] || { categoria: '', estrelas: 0 };
        return {
          id: it.id,
          categoria: e.categoria.trim() || undefined,
          estrelas: e.estrelas > 0 ? e.estrelas : undefined,
        };
      })
      .filter((x) => x.categoria !== undefined || x.estrelas !== undefined);
    if (payload.length === 0) { onClose(); return; }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('hubTriagemAplicar', { tipo, itens: payload });
      if (r.ok) {
        const d = r.data as { atualizados: number } | undefined;
        message.success(`Triagem aplicada em ${d?.atualizados ?? payload.length} ${label}(s).`);
        onAplicado();
        onClose();
      } else {
        message.error(r.error || 'Erro ao aplicar a triagem');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  };

  const pendentes = useMemo(
    () => itens.filter((it) => !(escolhas[it.id]?.categoria || '').trim()).length,
    [itens, escolhas],
  );

  return (
    <Modal
      open={aberto}
      onCancel={salvando ? undefined : onClose}
      width={680}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ListChecks size={18} color={corDestaque} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
            Triagem — {itens.length} {label}{itens.length === 1 ? '' : 's'} importado{itens.length === 1 ? '' : 's'}
          </span>
        </span>
      }
      footer={[
        <Button key="depois" onClick={onClose} disabled={salvando}>Deixar pra depois</Button>,
        <Button
          key="salvar" type="primary" onClick={salvar} loading={salvando}
          style={{ background: corDestaque, borderColor: corDestaque }}
        >
          Salvar triagem
        </Button>,
      ]}
    >
      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Só o que acabou de entrar — os {isSkills ? 'skills' : 'agents'} antigos não aparecem aqui porque já passaram por isso.
        Escolha uma categoria existente ou <strong style={{ color: t.text }}>digite uma nova</strong> pra criá-la, e dê as estrelas.
      </div>

      {/* Aplicar a todos — o atalho pro caso comum (lote da mesma natureza). */}
      {itens.length > 1 && (
        <div style={{
          background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10,
          padding: '10px 12px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, letterSpacing: 0.4 }}>
            APLICAR A TODOS
          </span>
          <AutoComplete
            size="small"
            value={catTodos}
            onChange={(v) => setCatTodos(String(v || ''))}
            options={opcoesCategoria}
            placeholder="Categoria (existente ou nova)"
            style={{ minWidth: 200, flex: '1 1 200px' }}
            filterOption={(input, opt) => String(opt?.value || '').toLowerCase().includes(input.toLowerCase())}
            allowClear
          />
          <Rate value={estrelasTodos} onChange={setEstrelasTodos} style={{ fontSize: 15, color: t.accents.peach }} />
          <Button size="small" onClick={aplicarATodos} disabled={!catTodos.trim() && estrelasTodos === 0}>
            Aplicar
          </Button>
        </div>
      )}

      <div className="forja-scroll-y" style={{ maxHeight: '48vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {itens.map((it) => {
          const e = escolhas[it.id] || { categoria: '', estrelas: 0 };
          return (
            <div key={it.id} style={{
              border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, flex: '1 1 auto', minWidth: 0 }}>
                  {it.nome}
                </span>
                {it.categoria && (
                  <Tag style={{ fontSize: 10, margin: 0 }}>{it.categoria}</Tag>
                )}
              </div>
              {it.descricao && (
                <div style={{
                  fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {it.descricao}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <AutoComplete
                  size="small"
                  value={e.categoria}
                  onChange={(v) => setEscolha(it.id, { categoria: String(v || '') })}
                  options={opcoesCategoria}
                  placeholder="Categoria (existente ou nova)"
                  style={{ minWidth: 220, flex: '1 1 220px' }}
                  filterOption={(input, opt) => String(opt?.value || '').toLowerCase().includes(input.toLowerCase())}
                  allowClear
                />
                <Rate
                  value={e.estrelas}
                  onChange={(n) => setEscolha(it.id, { estrelas: n })}
                  style={{ fontSize: 15, color: t.accents.peach }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {pendentes > 0 && (
        <div style={{
          marginTop: 12, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={12} color={corDestaque} />
          {pendentes} sem categoria — pode salvar assim mesmo e classificar depois.
        </div>
      )}
    </Modal>
  );
}
