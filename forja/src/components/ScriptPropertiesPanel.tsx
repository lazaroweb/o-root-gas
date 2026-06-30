import React, { useEffect, useMemo, useState } from 'react';
import { Input, Button, App as AntApp, Tooltip, Tag, Skeleton, Alert, Modal, Popconfirm, Empty } from 'antd';
import { KeyRound, Plus, Search, RefreshCw, Pencil, Trash2, Eye, EyeOff, Copy, ExternalLink, Lock } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

interface PropItem {
  chave: string;
  valor: string;
  sensivel: boolean;
  tamanho: number;
  preview: string;
}
interface ListaResp {
  itens: PropItem[];
  total: number;
  settingsUrl: string;
}

export default function ScriptPropertiesPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<PropItem[]>([]);
  const [settingsUrl, setSettingsUrl] = useState('');
  const [busca, setBusca] = useState('');
  const [revelados, setRevelados] = useState<Record<string, string>>({});

  // Editor (criar/editar) via modal.
  const [editorAberto, setEditorAberto] = useState(false);
  const [editChave, setEditChave] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editNova, setEditNova] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = (silencioso = false) => {
    if (!silencioso) setLoading(true);
    callServer<ServerResult>('listScriptProperties')
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as ListaResp;
          setItens(d.itens || []);
          setSettingsUrl(d.settingsUrl || '');
          setRevelados({});
          if (silencioso) message.success('Lista atualizada.');
        } else {
          message.error(r.error || 'Erro ao listar propriedades.');
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) => i.chave.toLowerCase().includes(q) || (!i.sensivel && i.valor.toLowerCase().includes(q)));
  }, [itens, busca]);

  const abrirNova = () => {
    setEditNova(true); setEditChave(''); setEditValor(''); setEditorAberto(true);
  };
  const abrirEdicao = (item: PropItem) => {
    setEditNova(false); setEditChave(item.chave);
    // Pra sensíveis, começa vazio (não revela sem querer); o usuário digita o novo valor.
    setEditValor(item.sensivel ? (revelados[item.chave] ?? '') : item.valor);
    setEditorAberto(true);
  };

  const salvar = async () => {
    const k = editChave.trim();
    if (!k) { message.error('A chave não pode ficar vazia.'); return; }
    if (editNova && itens.some((i) => i.chave === k)) {
      message.error('Já existe uma propriedade com essa chave.'); return;
    }
    setSalvando(true);
    try {
      const r = await callServer<ServerResult>('setScriptProperty', k, editValor);
      if (r.ok) {
        message.success(editNova ? 'Propriedade criada.' : 'Propriedade salva.');
        setEditorAberto(false);
        carregar(true);
      } else { message.error(r.error || 'Erro ao salvar.'); }
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  };

  const remover = async (chave: string) => {
    try {
      const r = await callServer<ServerResult>('deleteScriptProperty', chave);
      if (r.ok) { message.success(`Removida: ${chave}`); carregar(true); }
      else { message.error(r.error || 'Erro ao remover.'); }
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const revelar = async (chave: string) => {
    if (revelados[chave] !== undefined) {
      // Já revelado: oculta de novo.
      setRevelados((prev) => { const n = { ...prev }; delete n[chave]; return n; });
      return;
    }
    try {
      const r = await callServer<ServerResult>('revealScriptProperty', chave);
      if (r.ok && r.data) {
        const d = r.data as { chave: string; valor: string };
        setRevelados((prev) => ({ ...prev, [chave]: d.valor }));
      } else { message.error(r.error || 'Erro ao revelar.'); }
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro'); }
  };

  const copiar = (texto: string, rotulo: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(texto);
      message.success(`Copiado: ${rotulo}`);
    }
  };

  const acoes = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Button size="small" icon={<RefreshCw size={13} />} onClick={() => carregar(true)}>Atualizar</Button>
      {settingsUrl && (
        <Tooltip title="Abre a tela de Script Properties no editor do Apps Script">
          <Button size="small" icon={<ExternalLink size={13} />} href={settingsUrl} target="_blank" rel="noopener noreferrer">
            Abrir no GAS
          </Button>
        </Tooltip>
      )}
      <Button size="small" type="primary" icon={<Plus size={14} />} onClick={abrirNova}>Nova propriedade</Button>
    </div>
  );

  const valorExibido = (item: PropItem): { texto: string; mono: boolean; tom: string } => {
    if (item.sensivel) {
      const rev = revelados[item.chave];
      if (rev !== undefined) return { texto: rev || '(vazio)', mono: true, tom: t.text };
      return { texto: item.preview || '••••••', mono: true, tom: t.textTertiary };
    }
    if (!item.valor) return { texto: '(vazio)', mono: false, tom: t.textTertiary };
    const cortado = item.tamanho > 160;
    return { texto: item.preview + (cortado ? '…' : ''), mono: true, tom: t.textSecondary };
  };

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={17} strokeWidth={1.6} color={t.accents.blue} />
          Script Properties
          {!loading && <Tag bordered={false} style={{ background: `${t.accents.blue}1a`, color: t.accents.blue, fontFamily: FONTS.ui }}>{itens.length}</Tag>}
        </span>
      }
      extra={acoes}
    >
      <Alert
        type="info"
        showIcon
        icon={<Lock size={15} color={t.accents.blue} />}
        style={{ marginBottom: 16, background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
        message={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}><strong>Editor interno das Script Properties.</strong> Contorna o limite de 50 da tela do Apps Script.</span>}
        description={
          <span style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
            Valores sensíveis (tokens, chaves, senhas) aparecem mascarados — clique no olho pra revelar sob demanda.
            Cuidado: apagar uma chave pode quebrar integrações. Limite de ~9KB por valor.
          </span>
        }
      />

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Input
            allowClear
            prefix={<Search size={14} color={t.textTertiary} />}
            placeholder="Buscar por chave ou valor…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ marginBottom: 14, maxWidth: 360 }}
          />

          {filtradas.length === 0 ? (
            <Empty description={busca ? 'Nenhuma propriedade encontrada.' : 'Nenhuma propriedade.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${t.borderSoft}`, borderRadius: 12, overflow: 'hidden' }}>
              {filtradas.map((item, idx) => {
                const ve = valorExibido(item);
                const revelado = revelados[item.chave] !== undefined;
                return (
                  <div
                    key={item.chave}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderTop: idx === 0 ? 'none' : `1px solid ${t.borderSoft}`,
                      background: idx % 2 ? t.surfaceMuted : t.surface,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          onClick={() => copiar(item.chave, item.chave)}
                          title="Clique pra copiar a chave"
                          style={{ fontFamily: FONTS.mono, fontSize: 12.5, fontWeight: 600, color: t.text, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {item.chave}
                        </span>
                        {item.sensivel && (
                          <Tag bordered={false} style={{ margin: 0, fontSize: 10, background: `${t.accents.peach}1f`, color: t.accents.peach }}>sensível</Tag>
                        )}
                        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, color: t.textTertiary }}>{item.tamanho} chars</span>
                      </div>
                      <div style={{ fontFamily: ve.mono ? FONTS.mono : FONTS.ui, fontSize: 11.5, color: ve.tom, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all' }}>
                        {ve.texto}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {item.sensivel && (
                        <Tooltip title={revelado ? 'Ocultar' : 'Revelar valor'}>
                          <Button size="small" type="text" icon={revelado ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => revelar(item.chave)} />
                        </Tooltip>
                      )}
                      <Tooltip title="Copiar valor">
                        <Button
                          size="small" type="text" icon={<Copy size={13} />}
                          onClick={() => {
                            const v = item.sensivel ? revelados[item.chave] : item.valor;
                            if (item.sensivel && v === undefined) { message.info('Revele o valor primeiro (ícone do olho).'); return; }
                            copiar(v || '', item.chave);
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Editar">
                        <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => abrirEdicao(item)} />
                      </Tooltip>
                      <Popconfirm
                        title={`Remover "${item.chave}"?`}
                        description="Pode quebrar integrações que dependem dessa chave."
                        okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}
                        onConfirm={() => remover(item.chave)}
                      >
                        <Tooltip title="Remover">
                          <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={editorAberto}
        onCancel={() => setEditorAberto(false)}
        onOk={salvar}
        okText={editNova ? 'Criar' : 'Salvar'}
        cancelText="Cancelar"
        confirmLoading={salvando}
        title={editNova ? 'Nova propriedade' : `Editar ${editChave}`}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>Chave</div>
            <Input
              value={editChave}
              onChange={(e) => setEditChave(e.target.value)}
              placeholder="EX_MINHA_CHAVE"
              disabled={!editNova}
              style={{ fontFamily: FONTS.mono }}
            />
          </div>
          <div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>Valor</div>
            <Input.TextArea
              value={editValor}
              onChange={(e) => setEditValor(e.target.value)}
              placeholder={!editNova && /(TOKEN|SECRET|KEY|PASSWORD|PAT)/i.test(editChave) ? 'Deixe em branco pra apagar o valor, ou digite o novo' : 'Valor da propriedade'}
              autoSize={{ minRows: 3, maxRows: 10 }}
              style={{ fontFamily: FONTS.mono, fontSize: 12.5 }}
            />
            <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 4 }}>{editValor.length} / 9000 caracteres</div>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
