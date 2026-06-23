import React, { useMemo, useState } from 'react';
import { Modal, Button, Empty, Input } from 'antd';
import {
  CreditCard, Search, Check, X as XIcon, ExternalLink,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import type { CartaoPessoal } from '../types';

// Bandeira agora é texto secundário neutro, não chip colorido. Cores oficiais
// das marcas (Visa azul-marinho, Mastercard vermelho-Pantone) ficavam horríveis
// no dark mode — perdiam contraste ou viravam neons agressivos. Padrão Stripe/
// Linear: bandeira é metadado, não enfeite.
const BANDEIRAS: Record<string, string> = {
  visa: 'Visa',
  master: 'Mastercard',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'Amex',
  hiper: 'Hipercard',
  hipercard: 'Hipercard',
  outra: 'Outra',
};

function bandeiraLabel(b: string): string {
  const k = String(b || '').toLowerCase().trim();
  return BANDEIRAS[k] || 'Outra';
}

// Resumo curto pra mostrar fora do modal (no formaPagamento da Conta, p.ex.).
// Ex.: "Cartão Nubank (Master)" — preferimos apelido > nome.
export function descreverCartao(c: CartaoPessoal | null | undefined): string {
  if (!c) return '';
  const nome = String(c.apelido || c.nome || '').trim();
  const banda = bandeiraLabel(c.bandeira);
  if (!nome) return `Cartão ${banda}`;
  return `Cartão ${nome} (${banda})`;
}

interface Props {
  open: boolean;
  cartoes: CartaoPessoal[];
  /** id do cartão atualmente selecionado (controla destaque inicial) */
  selectedId?: string | null;
  /** chamado quando o user confirma. cartao=null significa "limpar seleção" se allowNone=true */
  onSelect: (cartao: CartaoPessoal | null) => void;
  onClose: () => void;
  /** mostra botão "Sem cartão" pra limpar uma seleção antiga (default true) */
  allowNone?: boolean;
  /** título customizado (default: "Escolha um cartão") */
  title?: string;
}

// Modal visual de seleção de cartão — mesmo componente serve pra Assinaturas
// e pra Atelier > Contas. Foco em escaneabilidade: ver a cara do cartão e
// clicar; nada de dropdown plano onde tudo parece igual.
export default function CartaoSelectorModal({
  open, cartoes, selectedId, onSelect, onClose, allowNone = true, title = 'Escolha um cartão',
}: Props): React.ReactElement {
  const t = useTokens();
  const [busca, setBusca] = useState('');
  const [picked, setPicked] = useState<string | null>(selectedId || null);

  // Reset da seleção sempre que o modal abre — evita "memória fantasma" entre
  // aberturas com cartões diferentes.
  React.useEffect(() => {
    if (open) {
      setPicked(selectedId || null);
      setBusca('');
    }
  }, [open, selectedId]);

  const ativos = useMemo(() => cartoes.filter((c) => c.ativo !== 'nao'), [cartoes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ativos;
    return ativos.filter((c) =>
      String(c.apelido || '').toLowerCase().indexOf(q) >= 0
      || String(c.nome || '').toLowerCase().indexOf(q) >= 0
      || String(c.bandeira || '').toLowerCase().indexOf(q) >= 0);
  }, [ativos, busca]);

  const confirmar = () => {
    if (!picked) { onClose(); return; }
    const c = cartoes.find((x) => x.id === picked) || null;
    onSelect(c);
  };

  const limpar = () => {
    onSelect(null);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={620}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: `${t.accents.lavender}1f`, color: t.accents.lavender, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={16} />
          </span>
          <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text }}>{title}</span>
        </div>
      }
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allowNone && selectedId && (
            <Button danger type="text" icon={<XIcon size={14} />} onClick={limpar}>
              Remover cartão
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" onClick={confirmar} disabled={!picked}>
            Selecionar
          </Button>
        </div>
      )}
    >
      <div style={{ marginTop: 4 }}>
        {ativos.length > 0 && (
          <Input
            prefix={<Search size={13} color={t.textTertiary} />}
            placeholder="Buscar por apelido, banco ou bandeira…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            allowClear
            style={{ marginBottom: 14 }}
          />
        )}

        {ativos.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
                Nenhum cartão cadastrado ainda.
                <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
                  Cadastre seus cartões em <strong>Financeiro &gt; Pessoal &gt; Cartões</strong>.
                </div>
              </div>
            )}
          >
            <Button icon={<ExternalLink size={13} />} onClick={onClose}>
              Fechar
            </Button>
          </Empty>
        ) : filtrados.length === 0 ? (
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, textAlign: 'center', padding: '24px 0' }}>
            Nenhum cartão combina com a busca.
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))', gap: 12,
            maxHeight: '52vh', overflowY: 'auto', paddingRight: 4,
          }}>
            {filtrados.map((c) => (
              <CartaoMiniCard
                key={c.id}
                cartao={c}
                selecionado={picked === c.id}
                onPick={() => setPicked(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Card visual compacto — usa a cor que o user escolheu no cadastro do cartão
// como detalhe sutil (ícone + fio no topo + borda quando selecionado). Bandeira
// fica como metadado em texto neutro, junto com vencimento/limite.
function CartaoMiniCard({ cartao, selecionado, onPick }: {
  cartao: CartaoPessoal;
  selecionado: boolean;
  onPick: () => void;
}): React.ReactElement {
  const t = useTokens();
  const [hover, setHover] = useState(false);
  const cor = cartao.cor || t.accents.lavender;
  const banda = bandeiraLabel(cartao.bandeira);
  const display = String(cartao.apelido || cartao.nome || '').trim() || 'Cartão sem nome';
  const subtitle = cartao.apelido && cartao.nome && cartao.apelido !== cartao.nome
    ? cartao.nome
    : '';

  // Metadados em uma linha só (bandeira · vence dia X · R$ Y) — leve e legível.
  const metaParts: string[] = [banda];
  if (cartao.diaVencimento > 0) metaParts.push(`vence dia ${cartao.diaVencimento}`);
  if (typeof cartao.limite === 'number' && cartao.limite > 0) {
    metaParts.push(`R$ ${cartao.limite.toLocaleString('pt-BR')}`);
  }

  return (
    <button
      type="button"
      onClick={onPick}
      onDoubleClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', textAlign: 'left',
        background: selecionado
          ? `linear-gradient(135deg, ${cor}1a, ${cor}08)`
          : hover ? t.surfaceMuted : t.surface,
        border: `1.5px solid ${selecionado ? cor : hover ? `${cor}55` : t.border}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: selecionado ? `0 0 0 3px ${cor}22` : 'none',
        display: 'flex', alignItems: 'center', gap: 11,
      }}
    >
      {/* fio de cor no topo, igual aos StatTile — dá identidade visual */}
      <span aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${cor}00, ${cor}, ${cor}00)`,
        borderRadius: '12px 12px 0 0', opacity: selecionado ? 1 : 0.55,
      }} />
      <span style={{
        width: 36, height: 36, borderRadius: 9, background: `${cor}1f`, color: cor,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <CreditCard size={18} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: FONTS.ui, fontSize: 13.5, fontWeight: 600, color: t.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {display}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
        )}
        <div style={{
          fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {metaParts.join(' · ')}
        </div>
      </div>
      {selecionado && (
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: cor, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
