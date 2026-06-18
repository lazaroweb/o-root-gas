import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input, Alert, Checkbox, App as AntApp, Tabs } from 'antd';
import { FileCode, Search, ExternalLink, Check, Link as LinkIcon, ShieldCheck, RefreshCw } from 'lucide-react';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import { Skeleton, EmptyArt } from './ui';
import type { GASProjectCandidate, ServerResponse } from '../types';

interface ImportGASModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (qtd: number) => void;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const dias = Math.floor(diff / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    if (dias < 365) return `há ${Math.floor(dias / 30)} meses`;
    return `há ${Math.floor(dias / 365)} anos`;
  } catch { return ''; }
}

function extractScriptId(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  const m = raw.match(/\/(?:d|projects|s)\/([A-Za-z0-9_-]{15,})/);
  if (m) return m[1];
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

export default function ImportGASModal({ open, onClose, onImported }: ImportGASModalProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<GASProjectCandidate[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<'lista' | 'id'>('lista');
  const [manualId, setManualId] = useState('');
  const [importingId, setImportingId] = useState(false);
  const [authEditorUrl, setAuthEditorUrl] = useState<string>('');

  const recarregar = () => {
    setLoading(true);
    setError(null);
    setAuthEditorUrl('');
    callServer<ServerResponse<GASProjectCandidate[]>>('listGASProjects')
      .then((res) => {
        if (res.ok && res.data) setItems(res.data);
        else {
          const err = res.error || 'Erro ao listar projetos';
          if (err.startsWith('AUTH_NEEDED::')) {
            setAuthEditorUrl(err.replace('AUTH_NEEDED::', ''));
            setError(null);
          } else {
            setError(err);
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set());
    setAba('lista');
    setManualId('');
    recarregar();
  }, [open]);

  const handleImportById = async () => {
    const id = extractScriptId(manualId);
    if (!id) { message.error('Cole a URL do projeto ou o scriptId.'); return; }
    setImportingId(true);
    try {
      const res = await callServer<ServerResponse<{ criados: number }>>('importGASById', id);
      if (res.ok && res.data) {
        message.success('App importado.');
        onImported(res.data.criados || 1);
        onClose();
      } else {
        message.error(res.error || 'Erro ao importar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImportingId(false);
    }
  };

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.nome.toLowerCase().includes(q));
  }, [items, busca]);

  const importaveisVisiveis = useMemo(() => filtered.filter((i) => !i.jaImportado), [filtered]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (importaveisVisiveis.every((i) => selecionados.has(i.scriptId))) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(importaveisVisiveis.map((i) => i.scriptId)));
    }
  };

  const handleImportar = async () => {
    const escolhidos = items.filter((i) => selecionados.has(i.scriptId));
    if (escolhidos.length === 0) return;
    setImporting(true);
    try {
      const res = await callServer<ServerResponse<{ criados: number }>>('importGASProjects',
        escolhidos.map((i) => ({ scriptId: i.scriptId, nome: i.nome })));
      if (res.ok && res.data) {
        message.success(`${res.data.criados} app${res.data.criados === 1 ? '' : 's'} importado${res.data.criados === 1 ? '' : 's'}`);
        onImported(res.data.criados);
        onClose();
      } else {
        message.error(res.error || 'Erro ao importar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const todosVisiveisSelecionados = importaveisVisiveis.length > 0 && importaveisVisiveis.every((i) => selecionados.has(i.scriptId));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      centered
      destroyOnClose
      styles={{
        body: { padding: 0 },
        content: { background: t.surface, borderRadius: 18, padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ padding: '24px 26px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: `${t.accents.blue}20`, color: t.accents.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode size={18} strokeWidth={1.7} />
          </span>
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 22, margin: 0, color: t.text, letterSpacing: '-0.015em' }}>
            Importar do Google Apps Script
          </h2>
        </div>
        <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.55, margin: '6px 0 8px' }}>
          A Forja puxa cada projeto e cria um Sistema na sua Bancada — já com link do web app, nome e <code>scriptId</code> registrados pra futura sincronização.
        </p>
      </div>

      {authEditorUrl && (
        <div style={{ margin: '4px 26px 14px', border: `1px solid ${t.accents.peach}55`, background: `${t.accents.peach}10`, borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: `${t.accents.peach}26`, color: t.accents.peach, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={17} strokeWidth={1.7} />
            </span>
            <div style={{ fontFamily: FONTS.display, fontSize: 17, color: t.text, fontWeight: 500 }}>Falta autorizar o acesso ao Drive</div>
          </div>
          <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
            Os scopes de Drive e Apps Script foram adicionados depois do seu primeiro acesso ao web app. O Google <strong>não</strong> reautoriza sozinho nesse caso. Escolha um dos caminhos:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Opção A — recomendada */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: t.accents.sage, background: `${t.accents.sage}22`, padding: '2px 8px', borderRadius: 999 }}>RECOMENDADO</span>
                <div style={{ fontFamily: FONTS.ui, fontWeight: 600, fontSize: 14, color: t.text }}>Revogar e reautorizar (3 cliques)</div>
              </div>
              <ol style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.65, paddingLeft: 18, margin: '0 0 10px' }}>
                <li>Abra <strong>Acessos de terceiros</strong> da sua conta Google.</li>
                <li>Encontre <strong>"FORJA"</strong> (ou o nome do seu projeto Apps Script) e clique em <strong>Remover acesso</strong>.</li>
                <li>Recarregue esta página (F5). O Google vai pedir autorização do zero, agora com todos os scopes.</li>
              </ol>
              <Button type="primary" icon={<ExternalLink size={14} />} onClick={() => window.open('https://myaccount.google.com/connections', '_blank', 'noopener')}>
                Abrir acessos da conta Google
              </Button>
            </div>

            {/* Opção B — editor */}
            <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontFamily: FONTS.ui, fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 6 }}>Alternativa: executar uma função no editor</div>
              <ol style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.65, paddingLeft: 18, margin: '0 0 10px' }}>
                <li>Abra o editor do Apps Script.</li>
                <li>No seletor de funções (topo), escolha <code>forjaForcarReautorizacao</code> e clique em <strong>Executar</strong>.</li>
                <li>Aprove os scopes na janela que abrir, volte aqui e clique em <strong>Tentar de novo</strong>.</li>
              </ol>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button icon={<ExternalLink size={14} />} onClick={() => window.open(authEditorUrl, '_blank', 'noopener')}>
                  Abrir editor
                </Button>
                <Button icon={<RefreshCw size={14} />} onClick={recarregar}>
                  Tentar de novo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!authEditorUrl && (
      <Tabs
        activeKey={aba}
        onChange={(k) => setAba(k as 'lista' | 'id')}
        style={{ padding: '0 26px' }}
        items={[
          {
            key: 'lista',
            label: 'Meus projetos standalone',
            children: (
              <div style={{ marginTop: 8 }}>
                <Input
                  allowClear
                  prefix={<Search size={14} color={t.textTertiary} />}
                  placeholder="Buscar pelo nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${t.borderSoft}`, borderRadius: 12 }}>
                  {loading ? (
                    <div style={{ padding: 16 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px dashed ${t.borderSoft}` }}>
                          <Skeleton width={18} height={18} radius={4} />
                          <div style={{ flex: 1 }}>
                            <Skeleton width="60%" height={14} />
                            <div style={{ height: 6 }} />
                            <Skeleton width="30%" height={11} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <Alert type="error" message={error} showIcon style={{ margin: 16 }} />
                  ) : filtered.length === 0 ? (
                    items.length === 0 ? (
                      <div style={{ padding: '22px 22px 24px', textAlign: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${t.accents.blue}15`, color: t.accents.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                          <FileCode size={24} strokeWidth={1.6} />
                        </div>
                        <div style={{ fontFamily: FONTS.display, fontSize: 17, color: t.text, marginBottom: 6 }}>Nada standalone no seu Drive</div>
                        <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.6, margin: '0 auto 14px', maxWidth: 380 }}>
                          O Google só devolve aqui os <strong>scripts standalone</strong> (criados direto em <code>script.google.com</code>).
                          Apps atrelados a Planilha, Doc, Formulário <strong>não aparecem</strong> nessa listagem — eles ficam invisíveis pra Drive API.
                          <br /><br />
                          Use a aba ao lado pra importar pelo <strong>scriptId</strong> (encontra no editor → Configurações do projeto).
                        </p>
                        <Button type="primary" icon={<LinkIcon size={14} />} onClick={() => setAba('id')}>
                          Ir para "Tenho o scriptId"
                        </Button>
                      </div>
                    ) : (
                      <EmptyArt
                        icon={<FileCode size={26} strokeWidth={1.6} />}
                        titulo='Nada bate com sua busca'
                        descricao='Tente outras palavras.'
                      />
                    )
                  ) : (
                    <>
                      {importaveisVisiveis.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px dashed ${t.borderSoft}`, background: t.surfaceMuted }}>
                          <Checkbox checked={todosVisiveisSelecionados} onChange={toggleTodos}>
                            <span style={{ fontSize: 12.5, color: t.textSecondary }}>Selecionar todos ({importaveisVisiveis.length})</span>
                          </Checkbox>
                        </div>
                      )}
                      {filtered.map((p) => {
                        const checked = selecionados.has(p.scriptId);
                        const disabled = p.jaImportado;
                        return (
                          <label
                            key={p.scriptId}
                            htmlFor={`gas-${p.scriptId}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                              borderBottom: `1px dashed ${t.borderSoft}`,
                              cursor: disabled ? 'default' : 'pointer',
                              opacity: disabled ? 0.55 : 1,
                              background: checked ? `${t.accents.blue}0d` : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            <Checkbox id={`gas-${p.scriptId}`} checked={checked} disabled={disabled} onChange={() => toggle(p.scriptId)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 500, fontSize: 14, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                                {disabled && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: t.accents.sage, background: `${t.accents.sage}1a`, padding: '1px 8px', borderRadius: 999 }}>
                                    <Check size={11} strokeWidth={2.4} /> já importado
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: t.textTertiary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span>Modificado {formatRelative(p.ultimaModificacao)}</span>
                                {p.emSharedDrive && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: t.accents.lavender, background: `${t.accents.lavender}1a`, padding: '1px 7px', borderRadius: 999 }}>shared drive</span>
                                )}
                                {p.ownedByMe === false && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: t.textTertiary, background: `${t.border}55`, padding: '1px 7px', borderRadius: 999 }}>compartilhado</span>
                                )}
                                <a href={`https://script.google.com/d/${p.scriptId}/edit`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: t.textTertiary }}>
                                  <ExternalLink size={11} /> abrir no GAS
                                </a>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'id',
            label: 'Tenho o scriptId',
            children: (
              <div style={{ marginTop: 8, paddingBottom: 4 }}>
                <p style={{ color: t.textSecondary, fontSize: 13, lineHeight: 1.55, marginTop: 0, marginBottom: 12 }}>
                  Pra apps atrelados a planilha/doc (que o Drive não lista), cole o <strong>scriptId</strong> ou a URL completa do editor. Encontra em <code>script.google.com</code> → seu projeto → Configurações.
                </p>
                <Input
                  size="large"
                  prefix={<LinkIcon size={15} color={t.textTertiary} />}
                  placeholder="Cole a URL ou o scriptId..."
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onPressEnter={handleImportById}
                  allowClear
                />
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: t.surfaceMuted, fontSize: 12, color: t.textTertiary, lineHeight: 1.55 }}>
                  Exemplos válidos:<br />
                  <code style={{ fontSize: 11.5 }}>1aBcDeFGhIJklMNoPqrStUvwxyZ_1234567890</code><br />
                  <code style={{ fontSize: 11.5 }}>https://script.google.com/d/1aBcDeFGhIJklMNoPqrStUvwxyZ_1234567890/edit</code>
                </div>
              </div>
            ),
          },
        ]}
      />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 26px', borderTop: `1px solid ${t.borderSoft}` }}>
        <span style={{ fontSize: 12.5, color: t.textTertiary }}>
          {aba === 'lista' ? (selecionados.size === 0 ? 'Nenhum selecionado' : `${selecionados.size} selecionado${selecionados.size === 1 ? '' : 's'}`) : ' '}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose}>{authEditorUrl ? 'Fechar' : 'Cancelar'}</Button>
          {!authEditorUrl && (aba === 'lista' ? (
            <Button type="primary" onClick={handleImportar} loading={importing} disabled={selecionados.size === 0}>
              Importar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
            </Button>
          ) : (
            <Button type="primary" onClick={handleImportById} loading={importingId} disabled={!manualId.trim()}>
              Importar por ID
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
