import React, { useState } from 'react';
import { Modal, Input, Button, Segmented, Tag, Checkbox, App as AntApp, Empty, Spin, Alert } from 'antd';
import { GitBranch, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import callServer from '../gas-client';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { ServerResult } from '../types';

interface RepoSugestao {
  sistemaId: string;
  nome: string;
  slug: string;
  repoUrl: string;
  existe: boolean | null;
}
interface ItemUI extends RepoSugestao {
  selected: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

export default function ConectarReposModal({ open, onClose, onDone }: Props): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [org, setOrg] = useState('');
  const [campo, setCampo] = useState<'nome' | 'codinome'>('nome');
  const [itens, setItens] = useState<ItemUI[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [semToken, setSemToken] = useState(false);

  const gerar = async () => {
    if (!org.trim()) { message.warning('Informe a organização do GitHub.'); return; }
    setLoading(true);
    try {
      const r = await callServer<ServerResult>('sugerirReposGitHub', org.trim(), campo);
      if (r.ok && r.data) {
        const d = r.data as { itens: RepoSugestao[]; semToken: boolean };
        setSemToken(!!d.semToken);
        setItens(d.itens.map((it) => ({ ...it, selected: it.existe === true })));
        if (d.itens.length === 0) message.info('Todos os sistemas já têm repositório conectado.');
      } else {
        message.error(r.error || 'Erro ao gerar sugestões');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const setItem = (id: string, patch: Partial<ItemUI>) =>
    setItens((prev) => (prev ? prev.map((x) => (x.sistemaId === id ? { ...x, ...patch } : x)) : prev));

  const selecionados = (itens || []).filter((x) => x.selected && x.repoUrl.trim());

  const aplicar = async () => {
    if (selecionados.length === 0) { message.warning('Selecione ao menos um repositório.'); return; }
    setApplying(true);
    try {
      const r = await callServer<ServerResult>(
        'conectarReposEmLote',
        selecionados.map((s) => ({ sistemaId: s.sistemaId, repoUrl: s.repoUrl.trim() })),
      );
      if (r.ok) {
        const n = (r.data as { conectados?: number } | undefined)?.conectados || 0;
        message.success(`${n} repositório(s) conectado(s).`);
        if (onDone) onDone();
        setItens(null);
        onClose();
      } else {
        message.error(r.error || 'Erro ao conectar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setApplying(false);
    }
  };

  const encontrados = (itens || []).filter((x) => x.existe === true).length;
  const naoEncontrados = (itens || []).filter((x) => x.existe === false).length;

  return (
    <Modal
      open={open}
      onCancel={() => { setItens(null); onClose(); }}
      width={760}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONTS.display }}>
          <GitBranch size={18} color={t.accents.blue} /> Conectar repositórios em lote
        </span>
      }
      footer={
        itens && itens.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginRight: 'auto' }}>
              {selecionados.length} selecionado(s) de {itens.length}
            </span>
            <Button onClick={() => { setItens(null); onClose(); }}>Cancelar</Button>
            <Button type="primary" loading={applying} onClick={aplicar} disabled={selecionados.length === 0}>
              Conectar selecionados ({selecionados.length})
            </Button>
          </div>
        ) : null
      }
    >
      <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Gera <code>github.com/&lt;org&gt;/&lt;slug&gt;</code> pra cada sistema <strong>sem repositório</strong>, verifica
        no GitHub quais existem e conecta os que você confirmar. O <code>slug</code> vem do campo escolhido (em minúsculas, sem acento).
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: 'block', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 4 }}>Organização / owner do GitHub</label>
          <Input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            onPressEnter={() => { if (!loading) void gerar(); }}
            placeholder="minha-org"
            style={{ fontFamily: FONTS.mono, fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 4 }}>Base do slug</label>
          <Segmented
            value={campo}
            onChange={(v) => setCampo(v as 'nome' | 'codinome')}
            options={[{ label: 'Nome', value: 'nome' }, { label: 'Codinome', value: 'codinome' }]}
          />
        </div>
        <Button type="primary" loading={loading} onClick={() => void gerar()}>Gerar sugestões</Button>
      </div>

      {semToken && itens && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={<span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}>Sem GITHUB_TOKEN — não dá pra verificar se os repos existem. Confira as URLs antes de conectar.</span>}
        />
      )}

      {itens && itens.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Tag color="green" style={{ marginInlineEnd: 0 }}>{encontrados} encontrado(s)</Tag>
            {naoEncontrados > 0 && <Tag color="red" style={{ marginInlineEnd: 0 }}>{naoEncontrados} não encontrado(s)</Tag>}
            <Button size="small" type="link" onClick={() => setItens((prev) => prev ? prev.map((x) => ({ ...x, selected: x.existe === true })) : prev)}>
              Selecionar só os encontrados
            </Button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {itens.map((it) => (
              <div
                key={it.sistemaId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 8, background: t.surface, border: `1px solid ${t.borderSoft}`,
                }}
              >
                <Checkbox checked={it.selected} onChange={(e) => setItem(it.sistemaId, { selected: e.target.checked })} />
                <div style={{ width: 150, minWidth: 0, fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.nome}>
                  {it.nome || '(sem nome)'}
                </div>
                <Input
                  size="small"
                  value={it.repoUrl}
                  onChange={(e) => setItem(it.sistemaId, { repoUrl: e.target.value })}
                  style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 11.5 }}
                />
                {it.existe === true && <CheckCircle2 size={16} color={t.accents.sage} />}
                {it.existe === false && <XCircle size={16} color={t.accents.rose} />}
                {it.existe === null && <HelpCircle size={16} color={t.textTertiary} />}
              </div>
            ))}
          </div>
        </>
      )}

      {itens && itens.length === 0 && (
        <Empty description="Nenhum sistema sem repositório — está tudo conectado." />
      )}

      {loading && !itens && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>
      )}
    </Modal>
  );
}
