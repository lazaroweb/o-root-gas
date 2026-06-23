// ImportarLoteModal — v1.151.0
// Modal genérico de import em lote pra Skills e Agents.
// Aceita .json no formato [{ slug, markdown, category?, tags? }] (recomendado)
// e .md único concatenado (fallback) com divisor `\n---\n\n# ` ou separador
// custom. Permite override de categoria/fonte e escolha entre upsert/criar.
import React, { useMemo, useState } from 'react';
import { Modal, Input, Radio, Button, Alert, Spin, Progress, message, Tag } from 'antd';
import { Upload as UploadIcon, FileText, CheckCircle2, AlertTriangle, Boxes } from 'lucide-react';
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
}

// Limites práticos:
// - O backend aceita 200 por chamada (limitado pelo timeout do GAS ~6min).
// - Fatiamos em chunks de 100 pra ter folga + mostrar progresso bonito.
const CHUNK = 100;

interface Props {
  aberto: boolean;
  onClose: () => void;
  // Tipo do lote — define o ícone, texto e qual RPC chama.
  tipo: 'skills' | 'agents';
  // RPC do backend (skillsBulkSave ou agentsBulkSave).
  rpcBulkSave: 'skillsBulkSave' | 'agentsBulkSave';
  // Callback quando termina (pra o Hub recarregar a lista).
  onConcluido: () => void;
}

export default function ImportarLoteModal({ aberto, onClose, tipo, rpcBulkSave, onConcluido }: Props): React.ReactElement {
  const t = useTokens();
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [categoriaDefault, setCategoriaDefault] = useState('');
  const [fonteDefault, setFonteDefault] = useState('');
  const [modo, setModo] = useState<'upsert' | 'criar'>('upsert');
  const [erroParse, setErroParse] = useState('');
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState({ chunkAtual: 0, totalChunks: 0, processados: 0 });
  const [relatorioFinal, setRelatorioFinal] = useState<RelatorioLote | null>(null);

  const isSkills = tipo === 'skills';
  const corDestaque = isSkills ? t.accents.lavender : t.accents.blue;
  const label = isSkills ? 'skills' : 'agents';
  const Label = isSkills ? 'Skills' : 'Agents';

  // ─── Parser dos formatos suportados ──────────────────────────────────────
  // Formato 1 (recomendado): JSON [{slug, markdown, category?, tags?}]
  //   - Detecta pelo content-type ou pelo `.json` no nome.
  //   - Aceita também variantes: `conteudo` em vez de `markdown`,
  //     `categoria`/`tags` no item-level.
  // Formato 2 (fallback): MD único concatenado com separadores comuns:
  //   - Linhas tipo `---` isoladas (divisor markdown horizontal) split por
  //     blocos que contenham `# ` ou `---` frontmatter no início.
  //   - Heurística: split por `\n---\n\n# ` (cada bloco começa com H1).
  const parsearArquivo = (texto: string, nome: string): ItemLote[] => {
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
    // Fallback: MD concatenado. Tenta divisores comuns nessa ordem.
    const divisores = [
      /\n---\n\n(?=# )/,    // \n---\n\n# Heading
      /\n\n---\n\n(?=# )/,
      /\n##========\n/,      // separador custom comum
      /\n----+\n(?=# )/,
    ];
    let chunks: string[] = [];
    for (const d of divisores) {
      const tentativa = texto.split(d).filter((c) => c.trim().length > 20);
      if (tentativa.length > 1) { chunks = tentativa; break; }
    }
    if (chunks.length === 0) {
      // Última tentativa: split por linhas que começam com `# ` (H1) — cada
      // ocorrência inicia uma skill nova.
      const partes = texto.split(/\n(?=# )/g).filter((c) => c.trim().length > 20);
      if (partes.length > 1) chunks = partes;
    }
    if (chunks.length === 0) throw new Error(
      'Não consegui identificar divisões no .md. Use .json `[{slug, markdown}]` ou separe os blocos com `\\n---\\n\\n# `.',
    );
    return chunks.map((md) => ({ markdown: md.trim() }));
  };

  const aoSelecionar = (file: File) => {
    setErroParse('');
    setRelatorioFinal(null);
    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const txt = String(e.target?.result || '');
        const lista = parsearArquivo(txt, file.name);
        setItens(lista);
      } catch (err) {
        setErroParse(err instanceof Error ? err.message : 'Erro ao parsear arquivo');
        setItens([]);
      }
    };
    reader.readAsText(file);
  };

  const totalChunks = useMemo(() => Math.ceil(itens.length / CHUNK), [itens]);

  const iniciar = async () => {
    if (itens.length === 0) return;
    setImportando(true);
    setRelatorioFinal(null);
    setProgresso({ chunkAtual: 0, totalChunks, processados: 0 });

    const acumulado: RelatorioLote = { total: 0, criados: 0, atualizados: 0, pulados: 0, erros: [] };
    try {
      for (let i = 0; i < itens.length; i += CHUNK) {
        const chunk = itens.slice(i, i + CHUNK);
        setProgresso({ chunkAtual: Math.floor(i / CHUNK) + 1, totalChunks, processados: i });
        const r = await callServer<ServerResult>(rpcBulkSave, {
          itens: chunk,
          opcoes: {
            categoriaDefault: categoriaDefault.trim() || undefined,
            fonteDefault: fonteDefault.trim() || undefined,
            modo,
          },
        });
        if (!r || !r.ok) {
          throw new Error((r && r.error) || `Falha no chunk ${i / CHUNK + 1}`);
        }
        const rep = r.data as RelatorioLote;
        acumulado.total += rep.total;
        acumulado.criados += rep.criados;
        acumulado.atualizados += rep.atualizados;
        acumulado.pulados += rep.pulados;
        acumulado.erros.push(...rep.erros);
      }
      setProgresso({ chunkAtual: totalChunks, totalChunks, processados: itens.length });
      setRelatorioFinal(acumulado);
      message.success(`Importação concluída: ${acumulado.criados} criadas, ${acumulado.atualizados} atualizadas`);
      onConcluido();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro no bulk');
      setRelatorioFinal({ ...acumulado });
    } finally {
      setImportando(false);
    }
  };

  const reset = () => {
    setItens([]);
    setNomeArquivo('');
    setCategoriaDefault('');
    setFonteDefault('');
    setErroParse('');
    setRelatorioFinal(null);
    setProgresso({ chunkAtual: 0, totalChunks: 0, processados: 0 });
  };

  const fechar = () => {
    if (importando) return; // não fecha mid-import
    reset();
    onClose();
  };

  return (
    <Modal
      open={aberto}
      onCancel={fechar}
      width={620}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Boxes size={18} color={corDestaque} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>
            Importar lote de {label}
          </span>
        </span>
      }
      footer={
        relatorioFinal ? [
          <Button key="fechar" type="primary" onClick={fechar}>Fechar</Button>,
        ] : [
          <Button key="cancel" onClick={fechar} disabled={importando}>Cancelar</Button>,
          <Button
            key="ok"
            type="primary"
            onClick={iniciar}
            disabled={itens.length === 0 || importando}
            loading={importando}
            style={{ background: corDestaque, borderColor: corDestaque }}
          >
            {importando
              ? `Processando lote ${progresso.chunkAtual}/${progresso.totalChunks}…`
              : `Importar ${itens.length} ${label}`
            }
          </Button>,
        ]
      }
    >
      {!relatorioFinal && !importando && (
        <>
          <div style={{
            background: `${corDestaque}0d`, border: `1px solid ${corDestaque}40`,
            borderRadius: 10, padding: 12, marginBottom: 16,
            fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.6,
          }}>
            <strong style={{ color: t.text }}>Formato recomendado:</strong>{' '}
            <code style={{ fontFamily: FONTS.mono, background: t.surface, padding: '1px 5px', borderRadius: 4 }}>
              .json
            </code> no shape <code style={{ fontFamily: FONTS.mono, background: t.surface, padding: '1px 5px', borderRadius: 4 }}>
              [{'{ slug, markdown, category?, tags? }'}]
            </code>.<br/>
            Aceita também <code style={{ fontFamily: FONTS.mono, background: t.surface, padding: '1px 5px', borderRadius: 4 }}>.md</code> único
            concatenado com divisor <code style={{ fontFamily: FONTS.mono }}>{'\\n---\\n\\n# '}</code>.
          </div>

          <label style={{ display: 'block', marginBottom: 16 }}>
            <Button icon={<UploadIcon size={14} />} block size="large" style={{ height: 64 }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span>{nomeArquivo || 'Escolher arquivo (.json ou .md)'}</span>
                {!nomeArquivo && <span style={{ fontSize: 11, color: t.textTertiary }}>JSON estruturado ou MD concatenado</span>}
              </span>
              <input
                type="file"
                accept=".json,.md,.txt"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) aoSelecionar(f);
                  e.target.value = '';
                }}
              />
            </Button>
          </label>

          {erroParse && (
            <Alert
              type="error" showIcon
              message="Falha ao ler arquivo"
              description={erroParse}
              style={{ marginBottom: 16 }}
            />
          )}

          {itens.length > 0 && (
            <>
              <div style={{
                background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
                borderRadius: 8, padding: 12, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <CheckCircle2 size={18} color={t.accents.sage} />
                <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                  <strong>{itens.length}</strong> {label} detectada{itens.length === 1 ? '' : 's'} em <code style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{nomeArquivo}</code>
                  {itens.length > CHUNK && (
                    <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>
                      Será processada em <strong>{Math.ceil(itens.length / CHUNK)} lotes</strong> de até {CHUNK} pra não estourar o GAS.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    Categoria deste lote <span style={{ color: t.textTertiary }}>(opcional — sobrescreve a vinda no arquivo)</span>
                  </label>
                  <Input
                    value={categoriaDefault}
                    onChange={(e) => setCategoriaDefault(e.target.value)}
                    placeholder="ex.: ai-specialists, frontend, dev-tools…"
                  />
                </div>

                <div>
                  <label style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, display: 'block', marginBottom: 4 }}>
                    Fonte / pasta <span style={{ color: t.textTertiary }}>(agrupa visualmente — vira a pasta no Hub)</span>
                  </label>
                  <Input
                    value={fonteDefault}
                    onChange={(e) => setFonteDefault(e.target.value)}
                    placeholder="ex.: vibeship-spawner, pack-ai-2026…"
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
            </>
          )}
        </>
      )}

      {importando && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Spin />
            <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.text }}>
              Processando lote <strong>{progresso.chunkAtual}</strong> de <strong>{progresso.totalChunks}</strong>…
            </div>
          </div>
          <Progress
            percent={Math.round((progresso.processados / Math.max(itens.length, 1)) * 100)}
            strokeColor={corDestaque}
          />
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 6 }}>
            {progresso.processados} de {itens.length} já enviadas ao backend
          </div>
        </div>
      )}

      {relatorioFinal && (
        <>
          <div style={{
            background: `${t.accents.sage}1a`, border: `1px solid ${t.accents.sage}40`,
            borderRadius: 10, padding: 14, marginBottom: 14,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <CheckCircle2 size={22} color={t.accents.sage} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 15, color: t.text, fontWeight: 600 }}>
                Lote concluído
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <Tag color="green" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                  {relatorioFinal.criados} criada{relatorioFinal.criados === 1 ? '' : 's'}
                </Tag>
                {relatorioFinal.atualizados > 0 && (
                  <Tag color="blue" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {relatorioFinal.atualizados} atualizada{relatorioFinal.atualizados === 1 ? '' : 's'}
                  </Tag>
                )}
                {relatorioFinal.pulados > 0 && (
                  <Tag style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {relatorioFinal.pulados} pulada{relatorioFinal.pulados === 1 ? '' : 's'} (slug existia)
                  </Tag>
                )}
                {relatorioFinal.erros.length > 0 && (
                  <Tag color="error" style={{ fontFamily: FONTS.ui, fontSize: 12 }}>
                    {relatorioFinal.erros.length} erro{relatorioFinal.erros.length === 1 ? '' : 's'}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {relatorioFinal.erros.length > 0 && (
            <Alert
              type="warning" showIcon icon={<AlertTriangle size={14} />}
              message={`${relatorioFinal.erros.length} item(s) falharam`}
              description={
                <div style={{ maxHeight: 180, overflow: 'auto', fontFamily: FONTS.mono, fontSize: 11 }}>
                  {relatorioFinal.erros.slice(0, 30).map((e, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <strong>{e.slug}:</strong> {e.msg}
                    </div>
                  ))}
                  {relatorioFinal.erros.length > 30 && (
                    <div style={{ color: t.textTertiary, marginTop: 4 }}>
                      … e mais {relatorioFinal.erros.length - 30}
                    </div>
                  )}
                </div>
              }
            />
          )}
        </>
      )}
    </Modal>
  );
}
