import React, { useEffect, useState } from 'react';
import { Button, Select, Popconfirm, Tag, Empty, App as AntApp, Spin } from 'antd';
import { Brain, Trash2, RefreshCw } from 'lucide-react';
import { Panel } from './ui';
import { useTokens } from '../themeContext';
import callServer from '../gas-client';
import type { ServerResponse, CategoriaPessoal } from '../types';

interface RegraCategoria {
  id: string;
  assinatura: string;
  categoria: string;
  origem?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

// Painel de gerenciamento das regras de categoria aprendidas (comércio →
// categoria). Permite revisar, trocar a categoria de uma regra ou apagá-la.
export default function RegrasCategoriaPanel(): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [regras, setRegras] = useState<RegraCategoria[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPessoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      callServer<ServerResponse<RegraCategoria[]>>('getRegrasCategoria'),
      callServer<ServerResponse<CategoriaPessoal[]>>('getCategoriasPessoais'),
    ])
      .then(([r, c]) => {
        if (r?.ok && r.data) setRegras(r.data as RegraCategoria[]);
        if (c?.ok && c.data) setCategorias(c.data as CategoriaPessoal[]);
      })
      .catch(() => { /* preview local */ })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const labelCat = (nome: string): string => {
    const c = categorias.find((x) => x.nome === nome);
    return c ? (c.label || c.nome) : nome;
  };

  const trocar = async (r: RegraCategoria, novaCat: string) => {
    if (!novaCat || novaCat === r.categoria) return;
    setSalvandoId(r.id);
    const res = await callServer<ServerResponse<unknown>>('atualizarRegraCategoria', r.id, novaCat);
    setSalvandoId(null);
    if (res?.ok) { message.success('Regra atualizada'); setRegras((prev) => prev.map((x) => (x.id === r.id ? { ...x, categoria: novaCat } : x))); }
    else message.error((res && res.error) || 'Erro ao atualizar regra');
  };

  const remover = async (id: string) => {
    const res = await callServer<ServerResponse<unknown>>('deletarRegraCategoria', id);
    if (res?.ok) { message.success('Regra removida'); setRegras((prev) => prev.filter((x) => x.id !== id)); }
    else message.error((res && res.error) || 'Erro ao remover regra');
  };

  const opcoes = categorias
    .filter((c) => c.ativo !== 'nao')
    .map((c) => ({ value: c.nome, label: c.label || c.nome }));

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Brain size={18} strokeWidth={1.6} color={t.accents.lavender} /> Regras de categoria aprendidas</span>}
      extra={<Button size="small" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>Atualizar</Button>}
    >
      <div style={{ fontSize: 12.5, color: t.textTertiary, marginBottom: 14 }}>
        Cada regra liga um comércio (descrição normalizada) a uma categoria. Elas são criadas quando você
        recategoriza um lançamento ou quando a IA acerta — e são reaplicadas automaticamente em itens iguais
        e nas próximas importações.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : regras.length === 0 ? (
        <Empty description="Nenhuma regra ainda. Recategorize um lançamento ou use 'Reclassificar com IA' que elas aparecem aqui." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {regras.map((r) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 12px', background: t.surfaceMuted,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: t.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.assinatura}
                </div>
                <div style={{ marginTop: 2 }}>
                  <Tag bordered={false} style={{ fontSize: 10.5, background: r.origem === 'ia' ? `${t.accents.lavender}1a` : `${t.accents.sage}1a`, color: r.origem === 'ia' ? t.accents.lavender : t.accents.sage }}>
                    {r.origem === 'ia' ? 'aprendida pela IA' : 'manual'}
                  </Tag>
                </div>
              </div>
              <Select
                size="small"
                value={r.categoria}
                loading={salvandoId === r.id}
                onChange={(v) => void trocar(r, v)}
                style={{ width: 170, flexShrink: 0 }}
                options={opcoes.length > 0 ? opcoes : [{ value: r.categoria, label: labelCat(r.categoria) }]}
              />
              <Popconfirm title="Remover esta regra?" onConfirm={() => void remover(r.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
                <Button type="text" size="small" icon={<Trash2 size={15} />} style={{ color: t.textTertiary, flexShrink: 0 }} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
