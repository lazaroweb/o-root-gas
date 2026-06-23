// FinAssinaturas — aba de assinaturas recorrentes do Financeiro Pessoal.
//
// Entidade própria (separada dos lançamentos) pra controlar o "custo
// comprometido" mensal de serviços recorrentes: streaming, música, IA, SaaS,
// cloud, jogos. Componente presentational: recebe dados + onRecarregar do
// FinPessoal (fonte única da verdade), renderiza KPIs ricos + grid de cards +
// modal de cadastro com presets das marcas mais populares.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag,
  Segmented, App as AntApp, Popconfirm, Empty, Tooltip, Progress,
} from 'antd';
import {
  Plus, Pencil, Trash2, PauseCircle, PlayCircle, CalendarClock,
  Tv, Music, Sparkles, Laptop, Cloud, Gamepad2, GraduationCap, BookOpen,
  Dumbbell, Package, Play, CreditCard, Repeat, Smartphone, Signal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Panel, formatBRL } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import CartaoSelectorModal, { descreverCartao } from '../components/CartaoSelectorModal';
import type {
  AssinaturaPessoal, ResumoAssinaturas, CartaoPessoal, ServerResponse,
  StatusAssinatura,
} from '../types';

// ─── Registro de ícones ──────────────────────────────────────────────────────
const ICONES: Record<string, LucideIcon> = {
  tv: Tv, music: Music, sparkles: Sparkles, laptop: Laptop, cloud: Cloud,
  'gamepad-2': Gamepad2, 'graduation-cap': GraduationCap, 'book-open': BookOpen,
  dumbbell: Dumbbell, package: Package, play: Play,
  smartphone: Smartphone, signal: Signal,
};
function getIcone(nome?: string): LucideIcon {
  return (nome && ICONES[nome]) || Package;
}

// ─── Categorias de assinatura ─────────────────────────────────────────────────
interface CategoriaAss { value: string; label: string; icone: string; cor: string }
const CATEGORIAS_ASS: CategoriaAss[] = [
  { value: 'streaming', label: 'Streaming', icone: 'tv', cor: '#E50914' },
  { value: 'musica', label: 'Música', icone: 'music', cor: '#1DB954' },
  { value: 'ia', label: 'IA', icone: 'sparkles', cor: '#10A37F' },
  { value: 'software', label: 'Software', icone: 'laptop', cor: '#3b82f6' },
  { value: 'cloud', label: 'Armazenamento', icone: 'cloud', cor: '#4285F4' },
  { value: 'jogos', label: 'Jogos', icone: 'gamepad-2', cor: '#107C10' },
  { value: 'telecom', label: 'Telefonia/Internet', icone: 'smartphone', cor: '#0891b2' },
  { value: 'educacao', label: 'Educação', icone: 'graduation-cap', cor: '#a855f7' },
  { value: 'noticias', label: 'Notícias/Leitura', icone: 'book-open', cor: '#d97706' },
  { value: 'fitness', label: 'Saúde/Fitness', icone: 'dumbbell', cor: '#ef4444' },
  { value: 'outros', label: 'Outros', icone: 'package', cor: '#6b7280' },
];
function catInfo(value: string): CategoriaAss {
  return CATEGORIAS_ASS.find((c) => c.value === value) || CATEGORIAS_ASS[CATEGORIAS_ASS.length - 1];
}

// ─── Presets das marcas mais populares (autofill no cadastro) ─────────────────
// Valores aproximados em BRL (jun/2026) — o user ajusta após selecionar.
interface Preset { nome: string; categoria: string; cor: string; icone: string; valor: number }
const PRESETS: Preset[] = [
  // Streaming
  { nome: 'Netflix', categoria: 'streaming', cor: '#E50914', icone: 'tv', valor: 44.90 },
  { nome: 'Prime Video', categoria: 'streaming', cor: '#00A8E1', icone: 'tv', valor: 19.90 },
  { nome: 'Max', categoria: 'streaming', cor: '#0046FF', icone: 'tv', valor: 29.90 },
  { nome: 'Disney+', categoria: 'streaming', cor: '#113CCF', icone: 'tv', valor: 43.90 },
  { nome: 'Globoplay', categoria: 'streaming', cor: '#FF4C00', icone: 'tv', valor: 22.90 },
  { nome: 'Apple TV+', categoria: 'streaming', cor: '#1A1A1A', icone: 'tv', valor: 21.90 },
  { nome: 'Paramount+', categoria: 'streaming', cor: '#0064FF', icone: 'tv', valor: 18.90 },
  { nome: 'Crunchyroll', categoria: 'streaming', cor: '#F47521', icone: 'tv', valor: 14.99 },
  { nome: 'YouTube Premium', categoria: 'streaming', cor: '#FF0000', icone: 'play', valor: 24.90 },
  // Música
  { nome: 'Spotify', categoria: 'musica', cor: '#1DB954', icone: 'music', valor: 21.90 },
  { nome: 'Apple Music', categoria: 'musica', cor: '#FA243C', icone: 'music', valor: 21.90 },
  { nome: 'Deezer', categoria: 'musica', cor: '#A238FF', icone: 'music', valor: 20.90 },
  { nome: 'YouTube Music', categoria: 'musica', cor: '#FF0000', icone: 'music', valor: 21.90 },
  // IA
  { nome: 'ChatGPT Plus', categoria: 'ia', cor: '#10A37F', icone: 'sparkles', valor: 110.00 },
  { nome: 'Claude Pro', categoria: 'ia', cor: '#D97757', icone: 'sparkles', valor: 110.00 },
  { nome: 'Gemini Advanced', categoria: 'ia', cor: '#1A73E8', icone: 'sparkles', valor: 97.00 },
  { nome: 'Cursor', categoria: 'ia', cor: '#6B7280', icone: 'sparkles', valor: 110.00 },
  // Software
  { nome: 'GitHub Copilot', categoria: 'software', cor: '#6E40C9', icone: 'laptop', valor: 50.00 },
  { nome: 'Microsoft 365', categoria: 'software', cor: '#D83B01', icone: 'laptop', valor: 35.00 },
  { nome: 'Adobe CC', categoria: 'software', cor: '#FA0F00', icone: 'laptop', valor: 119.00 },
  { nome: 'Notion', categoria: 'software', cor: '#1A1A1A', icone: 'laptop', valor: 50.00 },
  // Cloud
  { nome: 'Google One', categoria: 'cloud', cor: '#4285F4', icone: 'cloud', valor: 9.99 },
  { nome: 'iCloud+', categoria: 'cloud', cor: '#3693F3', icone: 'cloud', valor: 12.90 },
  { nome: 'Dropbox', categoria: 'cloud', cor: '#0061FF', icone: 'cloud', valor: 39.90 },
  // Jogos
  { nome: 'Xbox Game Pass', categoria: 'jogos', cor: '#107C10', icone: 'gamepad-2', valor: 44.99 },
  { nome: 'PlayStation Plus', categoria: 'jogos', cor: '#003791', icone: 'gamepad-2', valor: 34.90 },
  // Telecom / TV
  { nome: 'ClaroTV+', categoria: 'streaming', cor: '#DA291C', icone: 'tv', valor: 49.90 },
  { nome: 'Claro', categoria: 'telecom', cor: '#DA291C', icone: 'smartphone', valor: 79.90 },
  { nome: 'TIM', categoria: 'telecom', cor: '#00499C', icone: 'smartphone', valor: 59.90 },
  { nome: 'Vivo', categoria: 'telecom', cor: '#660099', icone: 'smartphone', valor: 89.90 },
  { nome: 'OI', categoria: 'telecom', cor: '#6EBE49', icone: 'signal', valor: 59.90 },
];

const METODOS_ASS = [
  { value: 'cartao', label: 'Cartão' },
  { value: 'pix', label: 'Pix' },
  { value: 'debito', label: 'Débito' },
  { value: 'boleto', label: 'Boleto' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

interface FinAssinaturasProps {
  assinaturas: AssinaturaPessoal[];
  resumo: ResumoAssinaturas | null;
  cartoes: CartaoPessoal[];
  loading: boolean;
  onRecarregar: () => void;
}

export default function FinAssinaturas({
  assinaturas, resumo, cartoes, loading, onRecarregar,
}: FinAssinaturasProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<AssinaturaPessoal | null>(null);
  const [filtro, setFiltro] = useState<'ativa' | 'pausada' | 'todas'>('ativa');

  const abrirNovo = () => { setEditando(null); setModalOpen(true); };
  const abrirEditar = (a: AssinaturaPessoal) => { setEditando(a); setModalOpen(true); };

  const alternar = (a: AssinaturaPessoal) => {
    const novo: StatusAssinatura = a.status === 'ativa' ? 'pausada' : 'ativa';
    callServer<ServerResponse<unknown>>('alternarStatusAssinatura', a.id, novo).then((res) => {
      if (res.ok) { message.success(novo === 'pausada' ? 'Assinatura pausada' : 'Assinatura reativada'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const remover = (id: string) => {
    callServer<ServerResponse<unknown>>('deletarAssinatura', id).then((res) => {
      if (res.ok) { message.success('Assinatura removida'); onRecarregar(); }
      else message.error(res.error || 'Erro');
    });
  };

  const filtradas = useMemo(() => {
    const arr = filtro === 'todas' ? assinaturas : assinaturas.filter((a) => a.status === filtro);
    // ativas primeiro, depois por valor mensal desc
    return [...arr].sort((a, b) => {
      const va = a.ciclo === 'anual' ? a.valor / 12 : a.valor;
      const vb = b.ciclo === 'anual' ? b.valor / 12 : b.valor;
      return vb - va;
    });
  }, [assinaturas, filtro]);

  const cartaoNome = (id?: string) => {
    if (!id) return '';
    const c = cartoes.find((x) => x.id === id);
    return c ? (c.apelido || c.nome) : '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero — número principal + stats secundárias inline, sem caixas */}
      <HeroAssinaturas resumo={resumo} />

      {(resumo && (resumo.qtdAtivas > 0 || resumo.qtdPausadas > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Por categoria */}
          <Panel title="Por categoria" padding={16}>
            <PorCategoria resumo={resumo} />
          </Panel>
          {/* Próximas cobranças */}
          <Panel
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarClock size={15} color={t.accents.blue} />
                <span>Cobranças do mês</span>
              </div>
            }
            padding={16}
          >
            <ProximasCobrancas resumo={resumo} />
          </Panel>
        </div>
      )}

      {/* Grid de assinaturas */}
      <Panel
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Minhas assinaturas</span>
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>{assinaturas.length}</Tag>
          </div>
        }
        extra={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Segmented
              size="small"
              value={filtro}
              onChange={(v) => setFiltro(v as typeof filtro)}
              options={[
                { value: 'ativa', label: 'Ativas' },
                { value: 'pausada', label: 'Pausadas' },
                { value: 'todas', label: 'Todas' },
              ]}
            />
            <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
              Nova assinatura
            </Button>
          </div>
        }
        padding={filtradas.length === 0 ? 32 : 16}
      >
        {filtradas.length === 0 ? (
          <Empty
            description={
              <div>
                <div style={{ color: t.textSecondary, fontFamily: FONTS.ui, fontSize: 14 }}>
                  {loading ? 'Carregando…' : filtro === 'ativa' ? 'Nenhuma assinatura ativa' : 'Nada por aqui'}
                </div>
                <div style={{ color: t.textTertiary, fontFamily: FONTS.ui, fontSize: 12.5, marginTop: 4 }}>
                  Cadastre Netflix, Spotify, ChatGPT e cia. pra controlar seu gasto recorrente.
                </div>
              </div>
            }
          >
            {!loading && (
              <Button type="primary" icon={<Plus size={14} />} onClick={abrirNovo}>
                Cadastrar primeira assinatura
              </Button>
            )}
          </Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtradas.map((a) => (
              <AssinaturaCard
                key={a.id}
                ass={a}
                cartaoNome={cartaoNome(a.cartaoId)}
                onEditar={() => abrirEditar(a)}
                onAlternar={() => alternar(a)}
                onRemover={() => remover(a.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <ModalAssinatura
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        assinatura={editando}
        cartoes={cartoes}
        onSaved={() => { setModalOpen(false); onRecarregar(); }}
      />
    </div>
  );
}

// ─── Hero — visão de topo, premium e arejada ──────────────────────────────────
// Em vez de 4 caixas iguais, um único bloco: número principal grande à esquerda
// e stats secundárias como texto puro à direita, separadas por divisores finos.
// Dá respiro e hierarquia clara sem poluir com cor/box repetidos.

function HeroAssinaturas({ resumo }: { resumo: ResumoAssinaturas | null }): React.ReactElement {
  const t = useTokens();
  const totalMensal = resumo?.totalMensal || 0;
  const qtdAtivas = resumo?.qtdAtivas || 0;
  const qtdPausadas = resumo?.qtdPausadas || 0;
  const sub = qtdAtivas > 0
    ? `${qtdAtivas} ativa${qtdAtivas > 1 ? 's' : ''}${qtdPausadas > 0 ? ` · ${qtdPausadas} pausada${qtdPausadas > 1 ? 's' : ''}` : ''}`
    : 'nenhuma assinatura ativa';

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 18,
      padding: '24px 28px',
      display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      boxShadow: t.shadowSoft,
    }}>
      {/* Bloco principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 220 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 15,
          background: `${t.accents.peach}14`, color: t.accents.peach,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Repeat size={24} strokeWidth={1.7} />
        </div>
        <div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.5, color: t.textTertiary, textTransform: 'uppercase' }}>
            Custo mensal em assinaturas
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 34, fontWeight: 500, color: t.text, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            {formatBRL(totalMensal)}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
            {sub}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 12 }} />

      {/* Stats secundárias inline — texto puro, divisores finos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <MiniStat label="Projeção anual" valor={formatBRL(resumo?.totalAnual || 0)} />
        <DividerVert />
        <MiniStat label="Média / serviço" valor={qtdAtivas > 0 ? formatBRL(resumo?.mediaPorAssinatura || 0) : '—'} />
        <DividerVert />
        <MiniStat
          label="Mais cara"
          valor={resumo?.maisCara ? formatBRL(resumo.maisCara.valorMes) : '—'}
          sub={resumo?.maisCara?.nome}
          corSub={resumo?.maisCara?.cor}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, valor, sub, corSub }: {
  label: string; valor: string; sub?: string; corSub?: string;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONTS.ui, fontSize: 10.5, letterSpacing: 0.4, color: t.textTertiary, textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valor}
      </div>
      {sub && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: corSub || t.textTertiary, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DividerVert(): React.ReactElement {
  const t = useTokens();
  return <div style={{ width: 1, alignSelf: 'stretch', minHeight: 40, background: t.borderSoft }} />;
}

// ─── Por categoria (barras) ───────────────────────────────────────────────────

function PorCategoria({ resumo }: { resumo: ResumoAssinaturas }): React.ReactElement {
  const t = useTokens();
  const entries = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div style={{ color: t.textTertiary, fontSize: 13, fontFamily: FONTS.ui }}>Sem assinaturas ativas.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(([cat, valor]) => {
        const info = catInfo(cat);
        const Icon = getIcone(info.icone);
        const pct = resumo.totalMensal > 0 ? (valor / resumo.totalMensal) * 100 : 0;
        return (
          <div key={cat}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>
                <Icon size={14} color={info.cor} strokeWidth={1.7} />
                {info.label}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 13, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBRL(valor)}
                </span>
                <span style={{ fontSize: 11, color: t.textTertiary, fontFamily: FONTS.ui, minWidth: 34, textAlign: 'right' }}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div style={{ height: 6, background: t.surfaceMuted, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: info.cor, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Próximas cobranças (timeline do mês) ─────────────────────────────────────

function ProximasCobrancas({ resumo }: { resumo: ResumoAssinaturas }): React.ReactElement {
  const t = useTokens();
  const hoje = dayjs().date();
  const cobrancas = resumo.proximasCobrancas;
  if (cobrancas.length === 0) {
    return <div style={{ color: t.textTertiary, fontSize: 13, fontFamily: FONTS.ui }}>Sem cobranças ativas.</div>;
  }
  // Prioriza as que ainda vão cair esse mês; passadas vão pro fim com opacidade.
  const pendentes = cobrancas.filter((c) => !c.jaPassou);
  const passadas = cobrancas.filter((c) => c.jaPassou);
  const ordenadas = [...pendentes, ...passadas];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 230, overflowY: 'auto' }}>
      {ordenadas.map((c, i) => {
        const Icon = getIcone(c.icone);
        return (
          <div
            key={c.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: i < ordenadas.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
              opacity: c.jaPassou ? 0.5 : 1,
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: `${c.cor}18`, color: c.cor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={15} strokeWidth={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.nome}
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                dia {c.diaCobranca}{c.jaPassou ? ' · já cobrado' : c.diaCobranca === hoje ? ' · hoje' : ''}
              </div>
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: 13, color: t.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {formatBRL(c.valorMes)}
              {c.ciclo === 'anual' && <span style={{ fontSize: 10, color: t.textTertiary }}>/mês</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card de assinatura ───────────────────────────────────────────────────────

function AssinaturaCard({ ass, cartaoNome, onEditar, onAlternar, onRemover }: {
  ass: AssinaturaPessoal;
  cartaoNome: string;
  onEditar: () => void;
  onAlternar: () => void;
  onRemover: () => void;
}): React.ReactElement {
  const t = useTokens();
  const Icon = getIcone(ass.icone);
  const pausada = ass.status === 'pausada';
  const cancelada = ass.status === 'cancelada';
  const valorMes = ass.ciclo === 'anual' ? ass.valor / 12 : ass.valor;
  const info = catInfo(ass.categoria);

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 16, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
      opacity: pausada || cancelada ? 0.55 : 1,
      transition: 'transform 0.15s, border-color 0.15s',
    }}>
      {/* Header: logo + nome + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${ass.cor}18`, border: `1px solid ${ass.cor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={22} color={ass.cor} strokeWidth={1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ass.nome}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
            {info.label}{ass.plano ? ` · ${ass.plano}` : ''}
          </div>
        </div>
        {pausada && <Tag color="default" style={{ marginInlineEnd: 0, fontSize: 10 }}>pausada</Tag>}
        {cancelada && <Tag color="default" style={{ marginInlineEnd: 0, fontSize: 10 }}>cancelada</Tag>}
      </div>

      {/* Valor */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
          {formatBRL(ass.valor)}
        </span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
          /{ass.ciclo === 'anual' ? 'ano' : 'mês'}
        </span>
        {ass.ciclo === 'anual' && (
          <Tooltip title="Custo mensal equivalente">
            <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.accents.peach, marginLeft: 4 }}>
              ≈ {formatBRL(valorMes)}/mês
            </span>
          </Tooltip>
        )}
      </div>

      {/* Meta: dia de cobrança + método */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary,
        paddingTop: 10, borderTop: `1px dashed ${t.borderSoft}`,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CalendarClock size={13} /> dia {ass.diaCobranca}
        </span>
        {ass.metodo === 'cartao' && cartaoNome && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CreditCard size={13} /> {cartaoNome}
          </span>
        )}
        {ass.metodo !== 'cartao' && (
          <span style={{ textTransform: 'capitalize' }}>{ass.metodo}</span>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {!cancelada && (
          <Tooltip title={pausada ? 'Reativar' : 'Pausar'}>
            <Button size="small" type="text" icon={pausada ? <PlayCircle size={14} /> : <PauseCircle size={14} />} onClick={onAlternar} />
          </Tooltip>
        )}
        <Tooltip title="Editar">
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={onEditar} />
        </Tooltip>
        <Popconfirm title="Remover essa assinatura?" onConfirm={onRemover} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
          <Button size="small" type="text" icon={<Trash2 size={13} />} danger />
        </Popconfirm>
      </div>
    </div>
  );
}

// ─── Modal de cadastro/edição ─────────────────────────────────────────────────

function ModalAssinatura({ open, onClose, assinatura, cartoes, onSaved }: {
  open: boolean;
  onClose: () => void;
  assinatura: AssinaturaPessoal | null;
  cartoes: CartaoPessoal[];
  onSaved: () => void;
}): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [cor, setCor] = useState('#8b5cf6');
  const [icone, setIcone] = useState('tv');
  const [categoria, setCategoria] = useState('streaming');
  const [metodo, setMetodo] = useState('cartao');
  const [nomePreview, setNomePreview] = useState('');
  const [cartaoModalOpen, setCartaoModalOpen] = useState(false);
  const cartaoIdSel = Form.useWatch('cartaoId', form) as string | undefined;

  useEffect(() => {
    if (open) {
      if (assinatura) {
        form.setFieldsValue({
          ...assinatura,
          dataInicio: assinatura.dataInicio ? dayjs(assinatura.dataInicio) : null,
        });
        setCor(assinatura.cor || '#8b5cf6');
        setIcone(assinatura.icone || 'tv');
        setCategoria(assinatura.categoria || 'streaming');
        setMetodo(assinatura.metodo || 'cartao');
        setNomePreview(assinatura.nome || '');
      } else {
        form.resetFields();
        form.setFieldsValue({
          ciclo: 'mensal', diaCobranca: 5, metodo: 'cartao', status: 'ativa', categoria: 'streaming',
        });
        setCor('#8b5cf6'); setIcone('tv'); setCategoria('streaming'); setMetodo('cartao'); setNomePreview('');
      }
    }
  }, [open, assinatura, form]);

  // Aplica um preset: preenche nome, categoria, cor, ícone, valor.
  const aplicarPreset = (p: Preset) => {
    form.setFieldsValue({ nome: p.nome, categoria: p.categoria, valor: p.valor });
    setCor(p.cor); setIcone(p.icone); setCategoria(p.categoria); setNomePreview(p.nome);
  };

  // Ao trocar categoria manualmente, sugere ícone/cor da categoria (se não veio de preset).
  const onCategoriaChange = (v: string) => {
    setCategoria(v);
    const info = catInfo(v);
    setIcone(info.icone);
    // só troca cor se ainda for a default ou de outra categoria
    setCor((prev) => (PRESETS.some((p) => p.cor === prev) ? prev : info.cor));
  };

  const salvar = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        ...v,
        id: assinatura?.id,
        cor, icone,
        dataInicio: v.dataInicio ? (v.dataInicio as Dayjs).format('YYYY-MM-DD') : '',
      };
      const res = await callServer<ServerResponse<unknown>>('salvarAssinatura', payload);
      if (res.ok) {
        message.success(assinatura ? 'Assinatura atualizada' : 'Assinatura cadastrada');
        onSaved();
      } else {
        message.error(res.error || 'Erro ao salvar');
      }
    } catch {
      message.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const PreviewIcon = getIcone(icone);
  const isCartao = metodo === 'cartao';

  return (
    <Modal
      title={assinatura ? 'Editar assinatura' : 'Nova assinatura'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Salvar"
      cancelText="Cancelar"
      width={640}
      destroyOnClose
    >
      {/* Presets — só no cadastro novo */}
      {!assinatura && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
            Atalho — escolha um serviço pra preencher automático:
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 96, overflowY: 'auto' }}>
            {PRESETS.map((p) => {
              const Ic = getIcone(p.icone);
              return (
                <button
                  key={p.nome}
                  onClick={() => aplicarPreset(p)}
                  type="button"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                    background: `${p.cor}12`, border: `1px solid ${p.cor}33`,
                    color: t.text, fontFamily: FONTS.ui, fontSize: 12,
                  }}
                >
                  <Ic size={13} color={p.cor} strokeWidth={1.8} />
                  {p.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview ao vivo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 16,
        background: `${cor}10`, border: `1px solid ${cor}30`, borderRadius: 10,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: `${cor}1f`, border: `1px solid ${cor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PreviewIcon size={24} color={cor} strokeWidth={1.7} />
        </div>
        <div>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>
            {nomePreview || 'Sua assinatura'}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2 }}>
            {catInfo(categoria).label}
          </div>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <Form.Item name="nome" label="Nome do serviço" rules={[{ required: true, message: 'Informe o nome' }]}>
            <Input placeholder="Ex: Netflix" autoFocus onChange={(e) => setNomePreview(e.target.value)} />
          </Form.Item>
          <Form.Item name="categoria" label="Categoria">
            <Select onChange={onCategoriaChange} options={CATEGORIAS_ASS.map((c) => ({ value: c.value, label: c.label }))} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item name="valor" label="Valor" rules={[{ required: true, type: 'number', min: 0.01, message: 'Informe o valor' }]}>
            <InputNumber style={{ width: '100%' }} prefix="R$" min={0} step={0.01} decimalSeparator="," precision={2} />
          </Form.Item>
          <Form.Item name="ciclo" label="Cobrança">
            <Select options={[{ value: 'mensal', label: 'Mensal' }, { value: 'anual', label: 'Anual' }]} />
          </Form.Item>
          <Form.Item name="diaCobranca" label="Dia da cobrança" tooltip="Dia do mês que cai a cobrança (1-31)">
            <InputNumber style={{ width: '100%' }} min={1} max={31} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="metodo" label="Método de pagamento">
            <Select onChange={setMetodo} options={METODOS_ASS} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={[
              { value: 'ativa', label: 'Ativa' },
              { value: 'pausada', label: 'Pausada' },
              { value: 'cancelada', label: 'Cancelada' },
            ]} />
          </Form.Item>
        </div>

        {isCartao && (
          <Form.Item name="cartaoId" label="Cartão">
            {/* trigger visual — abre o CartaoSelectorModal pra escolher um cartão
                cadastrado (Financeiro Pessoal). Decisão: mais escaneável que um
                Select plano, mesmo padrão usado em Atelier > Contas. */}
            <CartaoTrigger
              cartoes={cartoes}
              onOpen={() => setCartaoModalOpen(true)}
            />
          </Form.Item>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="plano" label="Plano (opcional)" tooltip="Ex: Premium 4K, Família, Individual">
            <Input placeholder="Ex: Premium 4K" />
          </Form.Item>
          <Form.Item name="dataInicio" label="Início (opcional)">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        {/* Cor da marca */}
        <Form.Item label="Cor">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['#E50914', '#00A8E1', '#0046FF', '#113CCF', '#FF4C00', '#1DB954', '#FA243C', '#A238FF',
              '#10A37F', '#D97757', '#1A73E8', '#3b82f6', '#4285F4', '#107C10', '#FF0000',
              '#DA291C', '#00499C', '#660099', '#6EBE49', '#0891b2', '#8b5cf6', '#6b7280'].map((c) => (
              <div
                key={c}
                onClick={() => setCor(c)}
                style={{
                  width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                  border: cor === c ? `3px solid ${t.text}` : '3px solid transparent',
                  transition: 'all 0.15s', boxShadow: cor === c ? `0 0 0 2px ${c}33` : 'none',
                }}
              />
            ))}
          </div>
        </Form.Item>

        <Form.Item name="notas" label="Notas (opcional)">
          <Input.TextArea rows={2} placeholder="Ex: conta dividida com a família, renova em dezembro…" />
        </Form.Item>
      </Form>

      <CartaoSelectorModal
        open={cartaoModalOpen}
        cartoes={cartoes}
        selectedId={cartaoIdSel}
        onClose={() => setCartaoModalOpen(false)}
        onSelect={(c) => {
          form.setFieldsValue({ cartaoId: c ? c.id : '' });
          setCartaoModalOpen(false);
        }}
        title="Cartão usado para esta assinatura"
      />
    </Modal>
  );
}

// ─── Trigger visual do cartão (substitui Select plano) ────────────────────────
// Recebe `value` e `onChange` do Form.Item via cloneElement — mantém integração
// com Ant Form sem reescrever a lógica de validação.
function CartaoTrigger({
  cartoes, onOpen, value, onChange,
}: {
  cartoes: CartaoPessoal[];
  onOpen: () => void;
  value?: string;
  onChange?: (v: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const selecionado = value ? cartoes.find((c) => c.id === value) || null : null;
  const cor = selecionado?.cor || t.accents.lavender;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 11px', borderRadius: 8, cursor: 'pointer',
          background: selecionado ? `${cor}10` : t.surface,
          border: `1px solid ${selecionado ? `${cor}55` : t.border}`,
          textAlign: 'left', minHeight: 36, transition: 'all 0.15s',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: `${cor}1f`, color: cor,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CreditCard size={13} />
        </span>
        <span style={{
          fontFamily: FONTS.ui, fontSize: 13, color: selecionado ? t.text : t.textTertiary,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: selecionado ? 500 : 400,
        }}>
          {selecionado
            ? descreverCartao(selecionado)
            : (cartoes.length ? 'Selecionar cartão…' : 'Nenhum cartão cadastrado')}
        </span>
      </button>
      {selecionado && (
        <Button type="text" size="small" onClick={() => onChange && onChange('')}>
          Limpar
        </Button>
      )}
    </div>
  );
}
