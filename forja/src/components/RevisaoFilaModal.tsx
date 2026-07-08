// RevisaoFilaModal — v1.267.0
// Revisão profunda EM FILA: escolhe um grupo (kit montado pela Lume ou filtro
// por estrelas + categorias), a IA reescreve o conteúdo de cada item UM POR VEZ
// (cada item = 1 chamada RPC, sem esbarrar no limite de 6 min do GAS), e no fim
// o usuário revê os antes/depois numa lista e aplica só o que aprovar.
//
// Pedido do usuário: rodar a análise profunda no grupo-fundação (skills
// essenciais de dev — design, segurança, código limpo…), categoria por
// categoria, priorizando as de mais estrelas.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Checkbox, Progress, Segmented, Select, Tag, message, Empty, Tooltip } from 'antd';
import { Sparkles, ListChecks, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import ModeloBadge from './ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

// Resumo mínimo que o hub já tem carregado (skills ou agents).
export interface ItemFila {
  id: string;
  nome: string;
  categoria?: string;
  tipoIA?: string;
  estrelas?: number;
  tamanhoBytes?: number;
  revisadaIAEm?: string;
}

interface KitResumo { id: string; nome: string; skills: number; agents: number; montadoPorLume: boolean }

interface ResultadoItem {
  id: string;
  nome: string;
  status: 'ok' | 'erro';
  erro?: string;
  conteudoOriginal?: string;
  conteudoRevisado?: string;
  resumo?: string[];
}

interface Props {
  aberto: boolean;
  onClose: () => void;
  tipo: 'skills' | 'agents';
  itens: ItemFila[];
  categoriasExistentes?: string[];
  onAplicado: () => void;
}

type Fase = 'config' | 'processando' | 'revisao' | 'aplicando';
type Origem = 'kit' | 'filtro';

// Revisão profunda suporta até ~28KB por item (limite do server) — acima disso
// o item é pulado com aviso em vez de falhar no meio da fila.
const LIMITE_KB = 28;

export default function RevisaoFilaModal({ aberto, onClose, tipo, itens, categoriasExistentes = [], onAplicado }: Props): React.ReactElement {
  const t = useTokens();
  const isSkills = tipo === 'skills';
  const label = isSkills ? 'skill' : 'agent';
  const cor = t.accents.clay;

  const [fase, setFase] = useState<Fase>('config');
  const [origem, setOrigem] = useState<Origem>('kit');
  const [kits, setKits] = useState<KitResumo[]>([]);
  const [kitId, setKitId] = useState<string>('');
  const [idsDoKit, setIdsDoKit] = useState<string[] | null>(null);
  const [carregandoKit, setCarregandoKit] = useState(false);
  const [minEstrelas, setMinEstrelas] = useState<number>(4);
  const [categorias, setCategorias] = useState<string[]>([]);
  // Seleção manual dentro do grupo (todos marcados por padrão).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [prog, setProg] = useState<{ feito: number; total: number; atual: string } | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [aceitos, setAceitos] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);
  const canceladoRef = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    setFase('config');
    setOrigem('kit');
    setKitId('');
    setIdsDoKit(null);
    setMinEstrelas(4);
    setCategorias([]);
    setSelecionados(new Set());
    setProg(null);
    setResultados([]);
    setAceitos(new Set());
    setExpandido(null);
    canceladoRef.current = false;
    // Carrega kits existentes (pra origem "kit"). Se não houver, cai no filtro.
    void callServer<ServerResult>('kitsList').then((r) => {
      if (r.ok && Array.isArray(r.data)) {
        const ks = (r.data as KitResumo[]).filter((k) => (isSkills ? k.skills : k.agents) > 0);
        setKits(ks);
        if (ks.length === 0) setOrigem('filtro');
      } else setOrigem('filtro');
    }).catch(() => setOrigem('filtro'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Ao escolher um kit, busca os ids dos itens dele (do tipo atual).
  useEffect(() => {
    if (!kitId) { setIdsDoKit(null); return; }
    setCarregandoKit(true);
    callServer<ServerResult>('kitsGetContent', kitId)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { skills: Array<{ id: string }>; agents: Array<{ id: string }> };
          setIdsDoKit((isSkills ? d.skills : d.agents).map((x) => x.id));
        } else {
          message.error(r.error || 'Não consegui abrir o kit');
          setIdsDoKit(null);
        }
      })
      .catch(() => setIdsDoKit(null))
      .finally(() => setCarregandoKit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId]);

  const catDoItem = (i: ItemFila) => String(i.tipoIA || i.categoria || '').trim();

  // Grupo resultante da origem escolhida, ordenado por categoria → estrelas
  // (desc) pra fila andar "categoria por categoria" como o usuário pediu.
  const grupo = useMemo(() => {
    let base: ItemFila[];
    if (origem === 'kit') {
      if (!idsDoKit) return [];
      const porId = new Map(itens.map((i) => [i.id, i]));
      base = idsDoKit.map((id) => porId.get(id)).filter(Boolean) as ItemFila[];
    } else {
      base = itens.filter((i) => (Number(i.estrelas) || 0) >= minEstrelas);
      if (categorias.length > 0) base = base.filter((i) => categorias.includes(catDoItem(i)));
    }
    return [...base].sort((a, b) => {
      const ca = catDoItem(a); const cb = catDoItem(b);
      if (ca !== cb) return ca.localeCompare(cb);
      return (Number(b.estrelas) || 0) - (Number(a.estrelas) || 0);
    });
  }, [origem, idsDoKit, itens, minEstrelas, categorias]);

  // Sempre que o grupo muda, re-seleciona todo mundo que cabe no limite.
  useEffect(() => {
    setSelecionados(new Set(grupo.filter((i) => (i.tamanhoBytes || 0) <= LIMITE_KB * 1024).map((i) => i.id)));
  }, [grupo]);

  const fila = useMemo(() => grupo.filter((i) => selecionados.has(i.id)), [grupo, selecionados]);

  const processar = async () => {
    setFase('processando');
    canceladoRef.current = false;
    const acc: ResultadoItem[] = [];
    for (let n = 0; n < fila.length; n++) {
      if (canceladoRef.current) break;
      const item = fila[n];
      setProg({ feito: n, total: fila.length, atual: item.nome });
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await callServer<ServerResult>('hubRevisarProfundo', { tipo, id: item.id });
        if (r.ok && r.data) {
          const d = r.data as { conteudoOriginal: string; conteudoRevisado: string; resumo: string[] };
          acc.push({ id: item.id, nome: item.nome, status: 'ok', ...d });
        } else {
          acc.push({ id: item.id, nome: item.nome, status: 'erro', erro: r.error || 'Erro na revisão' });
        }
      } catch (e) {
        acc.push({ id: item.id, nome: item.nome, status: 'erro', erro: e instanceof Error ? e.message : 'Erro' });
      }
      setResultados([...acc]);
    }
    setResultados(acc);
    setAceitos(new Set(acc.filter((r) => r.status === 'ok').map((r) => r.id)));
    setProg({ feito: acc.length, total: fila.length, atual: '' });
    setFase('revisao');
  };

  const aplicar = async () => {
    const aAplicar = resultados.filter((r) => r.status === 'ok' && aceitos.has(r.id));
    setFase('aplicando');
    let ok = 0;
    let falhas = 0;
    for (const r of aAplicar) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const resp = await callServer<ServerResult>('hubRevisaoProfundaAplicar', { tipo, id: r.id, conteudo: r.conteudoRevisado });
        if (resp.ok) ok++; else falhas++;
      } catch { falhas++; }
    }
    if (ok > 0) message.success(`${ok} ${label}(s) com conteúdo revisado e aplicado.`);
    if (falhas > 0) message.warning(`${falhas} não aplicou — tente de novo individualmente pelo drawer.`);
    onAplicado();
    onClose();
  };

  const toggleAceito = (id: string) => {
    setAceitos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const fechar = () => {
    canceladoRef.current = true;
    onClose();
  };

  const nAceitos = useMemo(() => resultados.filter((r) => r.status === 'ok' && aceitos.has(r.id)).length, [resultados, aceitos]);
  const nErros = useMemo(() => resultados.filter((r) => r.status === 'erro').length, [resultados]);
  const minEstimados = Math.max(1, Math.round(fila.length * 0.75));

  return (
    <Modal
      open={aberto}
      onCancel={fase === 'aplicando' ? undefined : fechar}
      width={860}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ListChecks size={18} color={cor} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
            Revisão profunda em fila — {isSkills ? 'skills' : 'agents'}
          </span>
        </span>
      }
      footer={
        fase === 'config' ? [
          <Button key="cancelar" onClick={fechar}>Cancelar</Button>,
          <Button
            key="ir" type="primary" icon={<Sparkles size={14} />}
            onClick={() => { void processar(); }}
            disabled={fila.length === 0 || carregandoKit}
            style={{ background: cor, borderColor: cor }}
          >
            Revisar {fila.length} {label}{fila.length === 1 ? '' : 's'} (~{minEstimados} min)
          </Button>,
        ] : fase === 'processando' ? [
          <Button key="parar" onClick={() => { canceladoRef.current = true; }}>
            Parar aqui e revisar o que já foi feito
          </Button>,
        ] : [
          <Button key="descartar" onClick={fechar} disabled={fase === 'aplicando'}>Descartar tudo</Button>,
          <Button
            key="aplicar" type="primary" icon={<CheckCircle2 size={14} />}
            onClick={() => { void aplicar(); }}
            loading={fase === 'aplicando'}
            disabled={nAceitos === 0}
            style={{ background: cor, borderColor: cor }}
          >
            Aplicar {nAceitos} aprovada{nAceitos === 1 ? '' : 's'}
          </Button>,
        ]
      }
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap',
        padding: '8px 12px', borderRadius: 10,
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
      }}>
        <Sparkles size={14} color={cor} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Modelo desta fila:</span>
        <ModeloBadge uso="atelier" size="medium" />
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginLeft: 'auto' }}>
          troque em Configurações → IA → Roteamento → “Atelier”
        </span>
      </div>

      {fase === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
            A IA reescreve o <strong style={{ color: t.text }}>conteúdo completo</strong> de cada {label} do grupo,
            um por um. No fim você revê os antes/depois e <strong style={{ color: t.text }}>aplica só o que aprovar</strong> —
            nada é gravado sem a sua revisão.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Grupo:</span>
            <Segmented
              value={origem}
              onChange={(v) => setOrigem(v as Origem)}
              options={[
                { label: 'Um kit (curadoria da Lume)', value: 'kit', disabled: kits.length === 0 },
                { label: 'Filtro por estrelas + categorias', value: 'filtro' },
              ]}
            />
          </div>

          {origem === 'kit' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Kit:</span>
              <Select
                placeholder="Escolha o kit (ex.: Fundação Vibe Code)"
                value={kitId || undefined}
                onChange={(v) => setKitId(v)}
                loading={carregandoKit}
                options={kits.map((k) => ({
                  value: k.id,
                  label: `${k.nome} (${isSkills ? k.skills : k.agents} ${label}s)${k.montadoPorLume ? ' · Lume' : ''}`,
                }))}
                style={{ minWidth: 340, flex: 1 }}
              />
            </div>
          )}

          {origem === 'filtro' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Estrelas:</span>
                <Segmented
                  value={minEstrelas}
                  onChange={(v) => setMinEstrelas(Number(v))}
                  options={[
                    { label: '5★', value: 5 },
                    { label: '4★ ou mais', value: 4 },
                    { label: '3★ ou mais', value: 3 },
                    { label: 'Todas', value: 0 },
                  ]}
                />
              </div>
              {categoriasExistentes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>Categorias:</span>
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="Todas (ou escolha as principais)"
                    value={categorias}
                    onChange={(v) => setCategorias(v as string[])}
                    options={Array.from(new Set(categoriasExistentes.map((c) => c.trim()).filter(Boolean)))
                      .sort((a, b) => a.localeCompare(b))
                      .map((c) => ({ value: c, label: c }))}
                    style={{ minWidth: 280, flex: 1 }}
                    maxTagCount="responsive"
                  />
                </div>
              )}
            </>
          )}

          {/* Pré-visualização do grupo: usuário pode desmarcar itens antes de rodar. */}
          {grupo.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={origem === 'kit'
                ? (kitId ? `Esse kit não tem ${label}s (ou eles foram removidos da base).` : 'Escolha um kit acima — ou monte o "Fundação Vibe Code" na estação Kits antes.')
                : `Nenhuma ${label} bate com esse filtro. Dica: rode "Avaliar com a Lume" antes pra ter estrelas na base.`}
            />
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>
                <strong style={{ color: t.text }}>{fila.length}</strong> de {grupo.length} no grupo · ~45s por item
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button size="small" onClick={() => setSelecionados(new Set(grupo.filter((i) => (i.tamanhoBytes || 0) <= LIMITE_KB * 1024).map((i) => i.id)))}>Marcar todas</Button>
                  <Button size="small" onClick={() => setSelecionados(new Set())}>Desmarcar</Button>
                </span>
              </div>
              <div className="forja-scroll-y" style={{ maxHeight: '38vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
                {grupo.map((i) => {
                  const grande = (i.tamanhoBytes || 0) > LIMITE_KB * 1024;
                  const on = selecionados.has(i.id);
                  return (
                    <div
                      key={i.id}
                      onClick={() => { if (!grande) toggleSelecionado(i.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        borderRadius: 8, cursor: grande ? 'not-allowed' : 'pointer',
                        border: `1px solid ${on ? `${cor}55` : t.borderSoft}`,
                        background: on ? `${cor}0d` : 'transparent',
                        opacity: grande ? 0.55 : 1, transition: 'all 0.18s ease',
                      }}
                    >
                      <Checkbox checked={on} disabled={grande} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelecionado(i.id)} />
                      <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i.nome}
                      </span>
                      {catDoItem(i) && (
                        <Tag bordered={false} style={{ borderRadius: 999, fontSize: 10, margin: 0, background: t.surfaceMuted, color: t.textSecondary }}>
                          {catDoItem(i)}
                        </Tag>
                      )}
                      {(Number(i.estrelas) || 0) > 0 && (
                        <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.accents.clay, flexShrink: 0 }}>{i.estrelas}★</span>
                      )}
                      {i.revisadaIAEm && (
                        <Tooltip title="Já passou por otimização/revisão de IA antes — pode revisar de novo se quiser.">
                          <Tag bordered={false} style={{ borderRadius: 999, fontSize: 10, margin: 0, background: `${t.accents.sage}1f`, color: t.textSecondary }}>
                            Revisada
                          </Tag>
                        </Tooltip>
                      )}
                      {grande && (
                        <Tooltip title={`Acima de ${LIMITE_KB}KB — a revisão profunda não suporta; ajuste manualmente pelo drawer.`}>
                          <AlertTriangle size={13} color={t.accents.peach} />
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {fase === 'processando' && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
            <Sparkles size={13} color={cor} />
            Revisando <strong>{(prog?.feito ?? 0) + 1}</strong>/{prog?.total ?? '…'}: {prog?.atual}
          </div>
          <Progress
            percent={prog ? Math.round((prog.feito / Math.max(prog.total, 1)) * 100) : 0}
            strokeColor={cor}
            size="small"
          />
          {resultados.length > 0 && (
            <div style={{ marginTop: 10, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>
              {resultados.filter((r) => r.status === 'ok').length} revisada(s) · {resultados.filter((r) => r.status === 'erro').length} com erro (puladas)
            </div>
          )}
        </div>
      )}

      {(fase === 'revisao' || fase === 'aplicando') && (
        <>
          {nErros > 0 && (
            <div style={{
              fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 10,
              background: `${t.accents.peach}1f`, border: `1px solid ${t.accents.peach}55`,
              borderRadius: 10, padding: '8px 12px',
            }}>
              {nErros} item(ns) falharam e foram pulados — o motivo aparece em cada um abaixo. Dá pra tentar de novo
              individualmente pelo botão "Revisar (IA)" no drawer.
            </div>
          )}
          {resultados.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada foi processado — a fila foi interrompida antes do primeiro item." />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary }}>
                  <strong style={{ color: t.text }}>{resultados.length}</strong> processado(s) · {nAceitos} aprovado(s) pra aplicar
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button size="small" onClick={() => setAceitos(new Set(resultados.filter((r) => r.status === 'ok').map((r) => r.id)))}>Aprovar todas</Button>
                  <Button size="small" onClick={() => setAceitos(new Set())}>Desmarcar todas</Button>
                </span>
              </div>
              <div className="forja-scroll-y" style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {resultados.map((r) => {
                  const on = r.status === 'ok' && aceitos.has(r.id);
                  const open = expandido === r.id;
                  return (
                    <div
                      key={r.id}
                      style={{
                        border: `1px solid ${r.status === 'erro' ? `${t.accents.rose}55` : on ? `${cor}66` : t.borderSoft}`,
                        background: r.status === 'erro' ? `${t.accents.rose}0d` : on ? `${cor}0d` : 'transparent',
                        borderRadius: 10, padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.status === 'ok' ? (
                          <Checkbox checked={on} onChange={() => toggleAceito(r.id)} />
                        ) : (
                          <AlertTriangle size={14} color={t.accents.rose} />
                        )}
                        <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color: t.text, flex: 1, minWidth: 0 }}>
                          {r.nome}
                        </span>
                        {r.status === 'ok' && (
                          <Button
                            type="text" size="small"
                            icon={open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            onClick={() => setExpandido(open ? null : r.id)}
                          >
                            {open ? 'Fechar' : 'Ver antes/depois'}
                          </Button>
                        )}
                      </div>

                      {r.status === 'erro' && (
                        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.5 }}>
                          {r.erro}
                        </div>
                      )}

                      {r.status === 'ok' && (r.resumo?.length ?? 0) > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.6 }}>
                          {r.resumo!.slice(0, open ? 12 : 3).map((m, i) => <li key={i}>{m}</li>)}
                          {!open && (r.resumo!.length > 3) && <li style={{ color: t.textTertiary }}>… +{r.resumo!.length - 3} mudança(s)</li>}
                        </ul>
                      )}

                      {open && r.status === 'ok' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {([['Original', r.conteudoOriginal || ''], ['Revisado', r.conteudoRevisado || '']] as const).map(([titulo, txt]) => (
                            <div key={titulo} style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, color: titulo === 'Revisado' ? cor : t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                                {titulo}
                              </div>
                              <pre className="forja-scroll-y" style={{
                                margin: 0, maxHeight: 260, overflow: 'auto',
                                fontFamily: FONTS.mono, fontSize: 10.5, lineHeight: 1.5, color: t.textSecondary,
                                background: t.surfaceMuted, border: `1px solid ${titulo === 'Revisado' ? `${cor}55` : t.borderSoft}`,
                                borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              }}>{txt}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
