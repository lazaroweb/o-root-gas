// ImportarLoteModal — v1.151.1
// Modal genérico de import em lote pra Skills e Agents.
// Aceita MÚLTIPLOS arquivos de uma vez (caso típico: 23 .json, um por
// categoria), respeitando a `category` embutida em cada item do JSON.
// Override de categoria do modal só vira FALLBACK pra itens sem categoria.
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Input, Radio, Button, Alert, Spin, Progress, message, Tag } from 'antd';
import { Upload as UploadIcon, CheckCircle2, AlertTriangle, Boxes, X, FileJson, FileText, Hourglass } from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface ItemLote {
  markdown: string;
  slug?: string;
  categoria?: string;
  tags?: string;
  fonte?: string;
  idExterno?: string;
}

interface RelatorioLote {
  total: number;
  criados: number;
  atualizados: number;
  pulados: number;
  erros: Array<{ slug: string; msg: string }>;
  // v1.151.3 — descartados pela trava de segurança (incompletos, duplicados
  // no lote, downgrade evitado). Não são erros — é a proteção funcionando.
  ignorados?: Array<{ slug: string; msg: string }>;
}

// v1.151.1 — Cada arquivo selecionado vira um "Lote" com estado próprio.
type StatusLote = 'pendente' | 'processando' | 'ok' | 'erro';

interface Lote {
  id: string;            // gerado local pra react keys
  nome: string;          // file name original
  itens: ItemLote[];     // resultado do parser
  // Categoria DETECTADA do arquivo (se 100% dos itens têm a mesma `category`).
  // Quando preenchida, sinaliza no card que a importação vai respeitar esse
  // valor (ignorando o override do modal).
  categoriaDetectada?: string;
  status: StatusLote;
  erroParse?: string;    // se o JSON/MD não pôde ser lido
  relatorio?: RelatorioLote;
}

const CHUNK = 100;

// Helper: gera um id local rápido pra React.key.
let _seq = 0;
const novoId = () => `lt-${Date.now()}-${++_seq}`;

// ─── Parser (mesma lógica do v1.151.0) ──────────────────────────────────
function parsearArquivo(texto: string, nome: string): ItemLote[] {
  const ehJson = /\.json$/i.test(nome) || texto.trim().startsWith('[') || texto.trim().startsWith('{');
  if (ehJson) {
    const dados = JSON.parse(texto);
    const arr = Array.isArray(dados) ? dados : (Array.isArray(dados?.itens) ? dados.itens : null);
    if (!arr) throw new Error('JSON precisa ser um array de itens (ou objeto com chave "itens").');
    return arr.map((it: Record<string, unknown>, idx: number) => {
      const md = String(it.markdown || it.conteudo || it.content || it.md || '');
      if (!md.trim()) throw new Error(`Item ${idx + 1} sem campo markdown/conteudo.`);
      return {
        markdown: md,
        slug: it.slug ? String(it.slug) : undefined,
        categoria: it.category || it.categoria ? String(it.category || it.categoria) : undefined,
        tags: Array.isArray(it.tags) ? it.tags.join(', ') : (it.tags ? String(it.tags) : undefined),
        idExterno: it.idExterno || it.id_externo || it.id ? String(it.idExterno || it.id_externo || it.id) : undefined,
      };
    });
  }
  const divisores = [
    /\n---\n\n(?=# )/,
    /\n\n---\n\n(?=# )/,
    /\n##========\n/,
    /\n----+\n(?=# )/,
  ];
  let chunks: string[] = [];
  for (const d of divisores) {
    const tentativa = texto.split(d).filter((c) => c.trim().length > 20);
    if (tentativa.length > 1) { chunks = tentativa; break; }
  }
  if (chunks.length === 0) {
    const partes = texto.split(/\n(?=# )/g).filter((c) => c.trim().length > 20);
    if (partes.length > 1) chunks = partes;
  }
  if (chunks.length === 0) throw new Error(
    'Não consegui identificar divisões no .md. Use .json `[{slug, markdown}]` ou separe os blocos com `\\n---\\n\\n# `.',
  );
  return chunks.map((md) => ({ markdown: md.trim() }));
}

// Detecta a categoria que predomina num lote (se 100% dos itens têm a mesma).
function detectarCategoria(itens: ItemLote[]): string | undefined {
  if (itens.length === 0) return undefined;
  const primeira = (itens[0].categoria || '').trim();
  if (!primeira) return undefined;
  const todosIguais = itens.every((it) => (it.categoria || '').trim() === primeira);
  return todosIguais ? primeira : undefined;
}

interface Props {
  aberto: boolean;
  onClose: () => void;
  tipo: 'skills' | 'agents';
  rpcBulkSave: 'skillsBulkSave' | 'agentsBulkSave';
  onConcluido: () => void;
}

export default function ImportarLoteModal({ aberto, onClose, tipo, rpcBulkSave, onConcluido }: Props): React.ReactElement {
  const t = useTokens();
  // v1.151.2 — ref no <input file>. AntD <Button> é um <button> real e, dentro
  // de <label>, ele captura o clique e NÃO dispara o input. Disparamos via ref.
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [categoriaDefault, setCategoriaDefault] = useState('');
  // v1.156.0 — "segmento de destino": rota o pack inteiro pra uma seção própria
  // (ex.: Contabilidade), de onde se monta o kit dos sonhos daquele segmento.
  const [segmento, setSegmento] = useState('');
  const [modo, setModo] = useState<'upsert' | 'criar'>('upsert');
  const [importando, setImportando] = useState(false);
  // Progresso global agregado (todos os lotes).
  const [progGlobal, setProgGlobal] = useState({ loteAtual: 0, totalLotes: 0, itensFeitos: 0, totalItens: 0 });
  // Quando termina tudo, mostra resumo consolidado.
  const [resumoFinal, setResumoFinal] = useState<{ arquivos: number; total: number; criados: number; atualizados: number; pulados: number; ignorados: number; erros: number } | null>(null);

  const isSkills = tipo === 'skills';
  const corDestaque = isSkills ? t.accents.lavender : t.accents.blue;
  const label = isSkills ? 'skills' : 'agents';

  const totalItens = useMemo(() => lotes.reduce((acc, l) => acc + l.itens.length, 0), [lotes]);
  const totalArquivosValidos = useMemo(() => lotes.filter((l) => !l.erroParse).length, [lotes]);

  const aoSelecionarArquivos = (files: FileList) => {
    setResumoFinal(null);
    const arr = Array.from(files);
    const lerUm = (file: File) => new Promise<Lote>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const txt = String(e.target?.result || '');
        try {
          const itens = parsearArquivo(txt, file.name);
          resolve({
            id: novoId(), nome: file.name, itens,
            categoriaDetectada: detectarCategoria(itens),
            status: 'pendente',
          });
        } catch (err) {
          resolve({
            id: novoId(), nome: file.name, itens: [],
            status: 'erro',
            erroParse: err instanceof Error ? err.message : 'Erro ao parsear',
          });
        }
      };
      reader.readAsText(file);
    });
    void Promise.all(arr.map(lerUm)).then((novos) => {
      setLotes((prev) => [...prev, ...novos]);
    });
  };

  const removerLote = (id: string) => {
    setLotes((prev) => prev.filter((l) => l.id !== id));
  };

  const iniciar = async () => {
    const validos = lotes.filter((l) => !l.erroParse && l.itens.length > 0);
    if (validos.length === 0) return;
    setImportando(true);
    setResumoFinal(null);

    const total = validos.reduce((acc, l) => acc + l.itens.length, 0);
    setProgGlobal({ loteAtual: 0, totalLotes: validos.length, itensFeitos: 0, totalItens: total });

    const consolidado = { arquivos: 0, total: 0, criados: 0, atualizados: 0, pulados: 0, ignorados: 0, erros: 0 };
    let itensFeitos = 0;

    for (let li = 0; li < validos.length; li++) {
      const lote = validos[li];
      // marca o lote como "processando" na UI
      setLotes((prev) => prev.map((l) => l.id === lote.id ? { ...l, status: 'processando' } : l));
      setProgGlobal((p) => ({ ...p, loteAtual: li + 1, itensFeitos }));

      const relAcc: RelatorioLote = { total: 0, criados: 0, atualizados: 0, pulados: 0, erros: [], ignorados: [] };
      let loteErrou = false;
      try {
        for (let i = 0; i < lote.itens.length; i += CHUNK) {
          const chunk = lote.itens.slice(i, i + CHUNK);
          // v1.151.1 — Se o lote tem categoria detectada, NÃO mandamos override
          // (deixa o backend respeitar a category embutida em cada item).
          // categoriaDefault só vai pro backend quando o lote NÃO tem categoria
          // própria (cobre o caso de MD sem metadados).
          const r = await callServer<ServerResult>(rpcBulkSave, {
            itens: chunk,
            opcoes: {
              categoriaDefault: lote.categoriaDetectada ? undefined : (categoriaDefault.trim() || undefined),
              segmento: segmento.trim() || undefined,
              modo,
            },
          });
          if (!r || !r.ok) throw new Error((r && r.error) || 'Falha no backend');
          const rep = r.data as RelatorioLote;
          relAcc.total += rep.total;
          relAcc.criados += rep.criados;
          relAcc.atualizados += rep.atualizados;
          relAcc.pulados += rep.pulados;
          relAcc.erros.push(...rep.erros);
          if (rep.ignorados) relAcc.ignorados!.push(...rep.ignorados);
          itensFeitos += chunk.length;
          setProgGlobal((p) => ({ ...p, itensFeitos }));
        }
      } catch (e) {
        loteErrou = true;
        relAcc.erros.push({ slug: lote.nome, msg: e instanceof Error ? e.message : 'Erro' });
      }
      setLotes((prev) => prev.map((l) => l.id === lote.id
        ? { ...l, status: loteErrou && relAcc.criados + relAcc.atualizados === 0 ? 'erro' : 'ok', relatorio: relAcc }
        : l));

      consolidado.arquivos += 1;
      consolidado.total += relAcc.total;
      consolidado.criados += relAcc.criados;
      consolidado.atualizados += relAcc.atualizados;
      consolidado.pulados += relAcc.pulados;
      consolidado.ignorados += (relAcc.ignorados ? relAcc.ignorados.length : 0);
      consolidado.erros += relAcc.erros.length;
    }

    setResumoFinal(consolidado);
    setImportando(false);
    onConcluido();
    if (consolidado.erros === 0) {
      message.success(`✅ ${consolidado.arquivos} arquivos · ${consolidado.criados} criadas, ${consolidado.atualizados} atualizadas`);
    } else {
      message.warning(`Importação concluída com ${consolidado.erros} erro(s). Veja o relatório.`);
    }
  };

  const reset = () => {
    setLotes([]);
    setCategoriaDefault('');
    setSegmento('');
    setResumoFinal(null);
    setProgGlobal({ loteAtual: 0, totalLotes: 0, itensFeitos: 0, totalItens: 0 });
  };

  const fechar = () => {
    if (importando) return;
    reset();
    onClose();
  };

  const algumLoteSemCategoria = useMemo(() => lotes.some((l) => !l.erroParse && !l.categoriaDetectada), [lotes]);

  return (
    <Modal
      open={aberto}
      onCancel={fechar}
      width={720}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Boxes size={18} color={corDestaque} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
            Importar lote de {label}
          </span>
        </span>
      }
      footer={
        resumoFinal ? [
          <Button key="mais" onClick={reset}>Importar mais arquivos</Button>,
          <Button key="fechar" type="primary" onClick={fechar}>Fechar</Button>,
        ] : [
          <Button key="cancel" onClick={fechar} disabled={importando}>Cancelar</Button>,
          <Button
            key="ok"
            type="primary"
            onClick={iniciar}
            disabled={totalArquivosValidos === 0 || importando}
            loading={importando}
            style={{ background: corDestaque, borderColor: corDestaque }}
          >
            {importando
              ? `Processando arquivo ${progGlobal.loteAtual}/${progGlobal.totalLotes}…`
              : totalArquivosValidos > 1
                ? `Importar ${totalArquivosValidos} arquivos (${totalItens} ${label})`
                : `Importar ${totalItens} ${label}`
            }
          </Button>,
        ]
      }
    >
      {!resumoFinal && !importando && (
        <>
          <div style={{
            background: `${corDestaque}0d`, border: `1px solid ${corDestaque}40`,
            borderRadius: 10, padding: 12, marginBottom: 16,
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.6,
          }}>
            <strong style={{ color: t.text }}>Selecione 1 ou vários arquivos.</strong>{' '}
            Recomendado: <code style={{ fontFamily: FONTS.mono, background: t.surface, padding: '1px 5px', borderRadius: 4 }}>.json</code>{' '}
            no shape <code style={{ fontFamily: FONTS.mono, background: t.surface, padding: '1px 5px', borderRadius: 4 }}>
              [{'{ slug, markdown, category?, tags? }'}]
            </code>.<br/>
            Se cada arquivo já trouxer <code style={{ fontFamily: FONTS.mono }}>category</code> nos itens (caso da AI),
            a Forja vai <strong>respeitar a categoria de cada arquivo</strong> automaticamente —
            você não precisa digitar nada.
          </div>

          {/* v1.151.3 — trava de segurança: deixa explícito pro usuário que pode
              jogar tudo (até arquivos repetidos/regerados) sem medo de sujar. */}
          <div style={{
            background: `${t.accents.sage}0d`, border: `1px solid ${t.accents.sage}33`,
            borderRadius: 10, padding: '10px 12px', marginBottom: 16,
            fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.6,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <CheckCircle2 size={15} color={t.accents.sage} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong style={{ color: t.text }}>Pode jogar tudo sem medo.</strong> A importação tem
              trava de segurança: <strong>não duplica</strong> (dedup por <code style={{ fontFamily: FONTS.mono }}>slug</code> dentro
              do lote e contra o que já existe), <strong>ignora itens incompletos</strong> e, no modo
              upsert, <strong>nunca troca uma versão completa por uma pior</strong>. Se a AI regerou
              arquivos na mesma pasta, mande os dois — só o mais completo de cada um fica.
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <input
              ref={inputRef}
              type="file"
              accept=".json,.md,.txt"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) aoSelecionarArquivos(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              icon={<UploadIcon size={14} />}
              block
              size="large"
              style={{ height: 56 }}
              onClick={() => inputRef.current?.click()}
            >
              {lotes.length === 0
                ? 'Escolher arquivos (.json ou .md) — selecione vários com Ctrl/Cmd+clique'
                : `+ Adicionar mais arquivos (${lotes.length} selecionado${lotes.length === 1 ? '' : 's'})`
              }
            </Button>
          </div>

          {/* Lista de arquivos selecionados */}
          {lotes.length > 0 && (
            <div style={{
              border: `1px solid ${t.borderSoft}`, borderRadius: 10,
              maxHeight: 280, overflow: 'auto', marginBottom: 16,
            }}>
              {lotes.map((lote, i) => (
                <div
                  key={lote.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderBottom: i < lotes.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
                    background: lote.erroParse ? `#dc26260a` : 'transparent',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: lote.erroParse
                      ? `#dc26261a`
                      : lote.categoriaDetectada ? `${t.accents.sage}1a` : `${corDestaque}1a`,
                    color: lote.erroParse
                      ? '#dc2626'
                      : lote.categoriaDetectada ? t.accents.sage : corDestaque,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {lote.erroParse ? <AlertTriangle size={14} /> :
                      /\.json$/i.test(lote.nome) ? <FileJson size={14} /> : <FileText size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FONTS.mono, fontSize: 12, color: t.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {lote.nome}
                    </div>
                    <div style={{
                      fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 2,
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    }}>
                      {lote.erroParse ? (
                        <span style={{ color: '#dc2626' }}>{lote.erroParse}</span>
                      ) : (
                        <>
                          <span>{lote.itens.length} {label}</span>
                          {lote.categoriaDetectada && (
                            <span style={{
                              background: `${t.accents.sage}1a`, color: t.accents.sage,
                              padding: '1px 6px', borderRadius: 999,
                              fontWeight: 600, fontSize: 10,
                            }}>
                              ✓ {lote.categoriaDetectada}
                            </span>
                          )}
                          {!lote.categoriaDetectada && (
                            <span style={{ color: t.accents.peach }}>
                              sem categoria — usa o default abaixo
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    type="text" size="small" icon={<X size={14} />}
                    onClick={() => removerLote(lote.id)}
                    title="Remover este arquivo"
                  />
                </div>
              ))}
            </div>
          )}

          {totalArquivosValidos > 0 && (
            <div style={{
              background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
              borderRadius: 8, padding: 12, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CheckCircle2 size={18} color={t.accents.sage} />
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                Total: <strong>{totalItens}</strong> {label} em <strong>{totalArquivosValidos}</strong> arquivo{totalArquivosValidos === 1 ? '' : 's'}.
                {totalItens > CHUNK && (
                  <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>
                    Vai processar arquivo por arquivo, fatiando lotes maiores em chunks de {CHUNK}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Defaults só aparecem quando precisam (algum arquivo sem categoria) */}
          {totalArquivosValidos > 0 && (algumLoteSemCategoria || true) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {algumLoteSemCategoria && (
                <div>
                  <label style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    Categoria padrão <span style={{ color: t.textTertiary }}>(fallback — só usada quando o item não trouxer category próprio)</span>
                  </label>
                  <Input
                    value={categoriaDefault}
                    onChange={(e) => setCategoriaDefault(e.target.value)}
                    placeholder="ex.: ai-specialists, frontend, dev-tools…"
                  />
                </div>
              )}

              <div>
                <label style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                  Segmento de destino <span style={{ color: t.textTertiary }}>(cria/usa uma seção própria no Hub — depois você monta o kit dos sonhos dela)</span>
                </label>
                <Input
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                  placeholder="ex.: Contabilidade, Fiscal, Folha de pagamento, CRM…"
                />
              </div>

              <div>
                <label style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                  Se um <code style={{ fontFamily: FONTS.mono }}>slug</code> já existe:
                </label>
                <Radio.Group value={modo} onChange={(e) => setModo(e.target.value)}>
                  <Radio.Button value="upsert">Atualizar (upsert)</Radio.Button>
                  <Radio.Button value="criar">Pular existentes</Radio.Button>
                </Radio.Group>
              </div>
            </div>
          )}
        </>
      )}

      {importando && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Spin />
            <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.text }}>
              Arquivo <strong>{progGlobal.loteAtual}</strong> de <strong>{progGlobal.totalLotes}</strong> ·{' '}
              <strong>{progGlobal.itensFeitos}</strong>/{progGlobal.totalItens} {label}
            </div>
          </div>
          <Progress
            percent={Math.round((progGlobal.itensFeitos / Math.max(progGlobal.totalItens, 1)) * 100)}
            strokeColor={corDestaque}
          />
          {/* Status visual por arquivo durante o processo */}
          <div style={{
            border: `1px solid ${t.borderSoft}`, borderRadius: 10,
            maxHeight: 220, overflow: 'auto', marginTop: 14,
          }}>
            {lotes.filter((l) => !l.erroParse).map((lote, i, arr) => (
              <div key={lote.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
              }}>
                <div style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  {lote.status === 'pendente' && <Hourglass size={14} color={t.textTertiary} />}
                  {lote.status === 'processando' && <Spin size="small" />}
                  {lote.status === 'ok' && <CheckCircle2 size={14} color={t.accents.sage} />}
                  {lote.status === 'erro' && <AlertTriangle size={14} color="#dc2626" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: FONTS.mono, fontSize: 11.5, color: t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {lote.nome}
                  </div>
                  {lote.relatorio && (
                    <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary, marginTop: 1 }}>
                      {lote.relatorio.criados} criadas
                      {lote.relatorio.atualizados > 0 && ` · ${lote.relatorio.atualizados} atualizadas`}
                      {lote.relatorio.pulados > 0 && ` · ${lote.relatorio.pulados} puladas`}
                      {lote.relatorio.erros.length > 0 && (
                        <span style={{ color: '#dc2626' }}> · {lote.relatorio.erros.length} erros</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumoFinal && (
        <>
          <div style={{
            background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
            borderRadius: 10, padding: 14, marginBottom: 14,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <CheckCircle2 size={22} color={t.accents.sage} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 15, color: t.text, fontWeight: 600 }}>
                {resumoFinal.arquivos} arquivo{resumoFinal.arquivos === 1 ? '' : 's'} processado{resumoFinal.arquivos === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <Tag color="green" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                  {resumoFinal.criados} criada{resumoFinal.criados === 1 ? '' : 's'}
                </Tag>
                {resumoFinal.atualizados > 0 && (
                  <Tag color="blue" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {resumoFinal.atualizados} atualizada{resumoFinal.atualizados === 1 ? '' : 's'}
                  </Tag>
                )}
                {resumoFinal.ignorados > 0 && (
                  <Tag color="gold" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {resumoFinal.ignorados} barrada{resumoFinal.ignorados === 1 ? '' : 's'} pela trava (duplicada/incompleta)
                  </Tag>
                )}
                {resumoFinal.erros > 0 && (
                  <Tag color="error" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {resumoFinal.erros} erro{resumoFinal.erros === 1 ? '' : 's'}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {/* Lista detalhada por arquivo (clicável pra ver erros se houver) */}
          <div style={{
            border: `1px solid ${t.borderSoft}`, borderRadius: 10,
            maxHeight: 280, overflow: 'auto',
          }}>
            {lotes.filter((l) => l.relatorio).map((lote, i, arr) => (
              <div key={lote.id} style={{
                padding: '10px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {lote.status === 'ok'
                    ? <CheckCircle2 size={14} color={t.accents.sage} />
                    : <AlertTriangle size={14} color="#dc2626" />
                  }
                  <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.text, flex: 1 }}>
                    {lote.nome}
                  </span>
                  {lote.categoriaDetectada && (
                    <span style={{
                      fontFamily: FONTS.ui, fontSize: 10, fontWeight: 600,
                      color: t.accents.sage,
                    }}>
                      {lote.categoriaDetectada}
                    </span>
                  )}
                </div>
                {lote.relatorio && (
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 4, marginLeft: 22 }}>
                    {lote.relatorio.criados} criadas
                    {lote.relatorio.atualizados > 0 && ` · ${lote.relatorio.atualizados} atualizadas`}
                    {(lote.relatorio.ignorados?.length || 0) > 0 && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ color: t.accents.peach, cursor: 'pointer', fontWeight: 600 }}>
                          {lote.relatorio.ignorados!.length} barrada{lote.relatorio.ignorados!.length === 1 ? '' : 's'} pela trava
                        </summary>
                        <div style={{
                          marginTop: 6, paddingLeft: 8,
                          borderLeft: `2px solid ${t.accents.peach}40`,
                          maxHeight: 120, overflow: 'auto',
                        }}>
                          {lote.relatorio.ignorados!.slice(0, 30).map((ig, ii) => (
                            <div key={ii} style={{ fontSize: 10.5, marginBottom: 2 }}>
                              <strong>{ig.slug}:</strong> {ig.msg}
                            </div>
                          ))}
                          {lote.relatorio.ignorados!.length > 30 && (
                            <div style={{ fontSize: 10, color: t.textTertiary }}>
                              … e mais {lote.relatorio.ignorados!.length - 30}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                    {lote.relatorio.erros.length > 0 && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                          {lote.relatorio.erros.length} erro{lote.relatorio.erros.length === 1 ? '' : 's'}
                        </summary>
                        <div style={{
                          marginTop: 6, paddingLeft: 8,
                          borderLeft: `2px solid #dc262640`,
                          maxHeight: 100, overflow: 'auto',
                        }}>
                          {lote.relatorio.erros.slice(0, 20).map((er, ei) => (
                            <div key={ei} style={{ fontSize: 10.5, marginBottom: 2 }}>
                              <strong>{er.slug}:</strong> {er.msg}
                            </div>
                          ))}
                          {lote.relatorio.erros.length > 20 && (
                            <div style={{ fontSize: 10, color: t.textTertiary }}>
                              … e mais {lote.relatorio.erros.length - 20}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
