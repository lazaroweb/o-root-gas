// FinPerfilIdeal — "Perfil familiar ideal": o orçamento-ALVO, construído 100%
// por você. Esta tela mostra SÓ o ideal — nada da sua realidade. A comparação
// com o gasto real vive em outra seção (Ideal × Real), sob demanda.
//
// Visão premium e leve: um cabeçalho enxuto (total + essencial × desejável) e as
// despesas agrupadas por categoria em blocos colapsáveis, com bastante respiro.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Select, Switch, App as AntApp,
  Popconfirm, Tooltip, Collapse,
} from 'antd';
import {
  Home, Plus, Pencil, Trash2, Star, ChevronRight,
} from 'lucide-react';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { PerfilIdealItem, CategoriaPessoal, ServerResponse } from '../types';

export default function FinPerfilIdeal({ categorias }: { categorias: CategoriaPessoal[] }): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [itens, setItens] = useState<PerfilIdealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; item: PerfilIdealItem | null; catInicial?: string }>({ open: false, item: null });

  const recarregar = useCallback(() => {
    setLoading(true);
    callServer<ServerResponse<PerfilIdealItem[]>>('getPerfilIdeal')
      .then((r) => { if (r.ok && r.data) setItens(r.data as PerfilIdealItem[]); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(recarregar, [recarregar]);

  const catLabel = useCallback((slug: string): string => {
    const c = categorias.find((x) => x.nome === slug);
    if (c) return c.label;
    return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Outros';
  }, [categorias]);
  const corCat = useCallback((slug: string): string => {
    const c = categorias.find((x) => x.nome === slug);
    return c?.cor || t.accents.sage;
  }, [categorias, t]);

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('removerItemPerfilIdeal', id)
      .then((r) => { if (r.ok) { message.success('Removido'); recarregar(); } else message.error(r.error || 'Erro'); })
      .catch(() => message.error('Erro ao remover'));
  };

  const total = useMemo(() => itens.reduce((s, i) => s + i.valorMensal, 0), [itens]);
  const totalEssencial = useMemo(() => itens.filter((i) => i.essencial).reduce((s, i) => s + i.valorMensal, 0), [itens]);
  const totalDesejavel = total - totalEssencial;

  // Agrupa por categoria (ordenado por valor).
  const grupos = useMemo(() => {
    const m: Record<string, PerfilIdealItem[]> = {};
    for (const it of itens) { (m[it.categoria] = m[it.categoria] || []).push(it); }
    return Object.keys(m)
      .map((cat) => ({ cat, itens: m[cat], total: m[cat].reduce((s, i) => s + i.valorMensal, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [itens]);

  if (loading && itens.length === 0) {
    return <Panel padding={40}><div style={{ textAlign: 'center', color: t.textTertiary }}>Carregando seu perfil…</div></Panel>;
  }

  if (itens.length === 0) {
    return (
      <>
        <Onboarding onNovo={() => setModal({ open: true, item: null })} />
        <ModalItem open={modal.open} item={modal.item} catInicial={modal.catInicial} categorias={categorias} onClose={() => setModal({ open: false, item: null })} onSaved={() => { setModal({ open: false, item: null }); recarregar(); }} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Hero total={total} totalEssencial={totalEssencial} totalDesejavel={totalDesejavel} qtd={itens.length}
        onNovo={() => setModal({ open: true, item: null })} />

      <Collapse
        bordered={false}
        expandIcon={({ isActive }) => <ChevronRight size={15} style={{ transform: `rotate(${isActive ? 90 : 0}deg)`, transition: 'transform 0.18s', color: t.textTertiary }} />}
        style={{ background: 'transparent' }}
        items={grupos.map((g) => ({
          key: g.cat,
          style: { marginBottom: 10, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' },
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: corCat(g.cat), flexShrink: 0 }} />
              <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 500, color: t.text }}>{catLabel(g.cat)}</span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>· {g.itens.length} item(s)</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(g.total)}<span style={{ fontSize: 11, color: t.textTertiary }}>/mês</span></span>
            </div>
          ),
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.itens.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', borderRadius: 10, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: FONTS.ui, fontSize: 13.5, color: t.text }}>{it.descricao}</span>
                      {it.essencial
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: FONTS.ui, fontSize: 10, color: t.accents.sage, background: `${t.accents.sage}1c`, padding: '1px 7px', borderRadius: 20 }}><Star size={10} /> essencial</span>
                        : <span style={{ fontFamily: FONTS.ui, fontSize: 10, color: t.textTertiary, background: t.surface, border: `1px solid ${t.borderSoft}`, padding: '1px 7px', borderRadius: 20 }}>desejável</span>}
                    </div>
                    {it.notas && <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>{it.notas}</div>}
                  </div>
                  <span style={{ fontFamily: FONTS.display, fontSize: 13.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.valorMensal)}</span>
                  <Tooltip title="Editar"><Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => setModal({ open: true, item: it })} /></Tooltip>
                  <Popconfirm title="Remover esta despesa?" okText="Remover" cancelText="Cancelar" onConfirm={() => remover(it.id)}>
                    <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
                  </Popconfirm>
                </div>
              ))}
              <Button type="text" size="small" icon={<Plus size={13} />} onClick={() => setModal({ open: true, item: null, catInicial: g.cat })}
                style={{ alignSelf: 'flex-start', color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12 }}>
                Adicionar em {catLabel(g.cat)}
              </Button>
            </div>
          ),
        }))}
      />

      <ModalItem open={modal.open} item={modal.item} catInicial={modal.catInicial} categorias={categorias} onClose={() => setModal({ open: false, item: null })} onSaved={() => { setModal({ open: false, item: null }); recarregar(); }} />
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function Onboarding({ onNovo }: { onNovo: () => void }): React.ReactElement {
  const t = useTokens();
  return (
    <Panel padding={0}>
      <div style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 580, margin: '0 auto' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px',
          background: `${t.accents.sage}18`, color: t.accents.sage,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Home size={32} strokeWidth={1.6} />
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: t.text, marginBottom: 8 }}>
          Construa seu perfil ideal
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 14, color: t.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
          Aqui é só o <strong>seu ideal</strong> — desenhe, do zero, quanto cada despesa que sustenta a sua
          família <em>deveria</em> custar por mês. Sem ruído da realidade: primeiro a gente define o destino.
          Depois, na seção <strong>Ideal × Real</strong>, a IA compara com o que você gasta hoje e mostra o que
          regular pra chegar lá.
        </div>
        <Button type="primary" size="large" icon={<Plus size={16} />} onClick={onNovo} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
          Definir primeira despesa
        </Button>
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 16 }}>
          Marque cada item como <strong>essencial</strong> (vital) ou <strong>desejável</strong> (qualidade de vida).
        </div>
      </div>
    </Panel>
  );
}

// ─── Hero (leve) ──────────────────────────────────────────────────────────────

function Hero({ total, totalEssencial, totalDesejavel, qtd, onNovo }: {
  total: number; totalEssencial: number; totalDesejavel: number; qtd: number; onNovo: () => void;
}): React.ReactElement {
  const t = useTokens();
  const pctEss = total > 0 ? (totalEssencial / total) * 100 : 0;
  const donut = `conic-gradient(${t.accents.sage} 0 ${pctEss}%, ${t.accents.lavender} ${pctEss}% 100%)`;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18,
      padding: '22px 26px', boxShadow: t.shadowSoft,
      display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 230 }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, background: `${t.accents.sage}18`, color: t.accents.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Home size={26} strokeWidth={1.7} />
        </div>
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.5, color: t.textTertiary, textTransform: 'uppercase' }}>Custo do meu ideal</div>
          <div style={{ fontFamily: FONTS.display, fontSize: 27, fontWeight: 500, color: t.text, lineHeight: 1.15, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(total)}<span style={{ fontSize: 14, color: t.textTertiary }}>/mês</span>
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>{qtd} despesa(s) no perfil</div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 12 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: donut, position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontSize: 13, fontWeight: 600, color: t.text }}>
            {pctEss.toFixed(0)}%
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <LegItem cor={t.accents.sage} label="Essencial" valor={formatBRL(totalEssencial)} />
          <LegItem cor={t.accents.lavender} label="Desejável" valor={formatBRL(totalDesejavel)} />
        </div>
      </div>

      <Button type="primary" icon={<Plus size={15} />} onClick={onNovo} style={{ background: t.accents.sage, borderColor: t.accents.sage }}>
        Nova despesa
      </Button>
    </div>
  );
}

function LegItem({ cor, label, valor }: { cor: string; label: string; valor: string }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: cor }} />
      <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, minWidth: 64 }}>{label}</span>
      <span style={{ fontFamily: FONTS.display, fontSize: 12.5, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}

// ─── Modal de item ────────────────────────────────────────────────────────────

function ModalItem({ open, item, catInicial, categorias, onClose, onSaved }: {
  open: boolean; item: PerfilIdealItem | null; catInicial?: string; categorias: CategoriaPessoal[];
  onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        descricao: item?.descricao || '',
        categoria: item?.categoria || catInicial || 'moradia',
        valorMensal: item?.valorMensal || undefined,
        essencial: item ? item.essencial : true,
        notas: item?.notas || '',
      });
    }
  }, [open, item, catInicial, form]);

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        id: item?.id,
        descricao: v['descricao'],
        categoria: v['categoria'],
        valorMensal: v['valorMensal'],
        essencial: v['essencial'] ? 'sim' : 'nao',
        notas: v['notas'],
      };
      const res = await callServer<ServerResponse<unknown>>('salvarItemPerfilIdeal', payload);
      if (res.ok) { message.success(item ? 'Atualizado' : 'Despesa adicionada'); onSaved(); }
      else message.error(res.error || 'Erro ao salvar');
    } catch { message.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const opcoes = categorias.filter((c) => c.ativo === 'sim').map((c) => ({ value: c.nome, label: c.label }));

  return (
    <Modal title={item ? 'Editar despesa ideal' : 'Nova despesa ideal'} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} okText="Salvar" cancelText="Cancelar" destroyOnClose>
      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <Form.Item name="descricao" label="O que é" rules={[{ required: true, message: 'Dê um nome' }]}>
          <Input placeholder="Ex: Aluguel, Mercado, Plano de saúde…" />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="categoria" label="Categoria">
            <Select showSearch options={opcoes} optionFilterProp="label" placeholder="Categoria" />
          </Form.Item>
          <Form.Item name="valorMensal" label="Valor ideal / mês" rules={[{ required: true, message: 'Informe o valor' }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={50} decimalSeparator="," precision={2} placeholder="0,00" />
          </Form.Item>
        </div>
        <Form.Item name="essencial" label="É essencial pra sustentar a família?" valuePropName="checked" tooltip="Essencial = vital (moradia, comida, saúde). Desejável = qualidade de vida (lazer, assinaturas).">
          <Switch checkedChildren="Essencial" unCheckedChildren="Desejável" />
        </Form.Item>
        <Form.Item name="notas" label="Observação (opcional)">
          <Input.TextArea rows={2} placeholder="Ex: meta é negociar pra R$ 1.800 até dezembro" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
