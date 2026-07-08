// KitMontagemModal — v1.268.0
// Acompanhamento premium da montagem de kit pela Lume, com fases REAIS:
// o frontend comanda as 4 etapas do server (preparar base → selecionar skills
// → selecionar agents → salvar), cada uma é 1 RPC curto (bem abaixo do timeout
// de 60s do UrlFetchApp que matava a chamada única antiga). Cronômetro por
// fase + total, erro fica visível NO modal (não some como toast) e a etapa que
// falhou pode ser re-tentada sozinha — o estado das anteriores sobrevive no
// cache do server por 30 min.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, message } from 'antd';
import { Sparkles, Check, Layers, Bot, BookMarked, Save, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import ModeloBadge from './ModeloBadge';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult } from '../types';

export interface MontagemParams {
  tipo: 'template' | 'dominio' | 'segmento';
  templateId?: string;
  nome: string;          // exibição no modal
  objetivo?: string;     // só pra tipo 'dominio'
  segKey?: string;       // só pra tipo 'segmento'
  alvoSkills?: number;
  alvoAgents?: number;
  accent?: string;       // cor do card de origem
}

interface Props {
  params: MontagemParams | null; // != null abre o modal e inicia a montagem
  onClose: () => void;
  // Chamado no fim com o id do kit salvo (pra recarregar lista / abrir drawer).
  onConcluido: (kitId: string) => void;
}

type EtapaId = 'preparar' | 'skills' | 'agents' | 'salvar';
type EtapaStatus = 'pendente' | 'ativa' | 'ok' | 'erro' | 'pulada';

interface EtapaVis {
  id: EtapaId;
  label: string;
  icone: React.ReactNode;
  status: EtapaStatus;
  detalhe?: string;   // ex.: "18 skills escolhidas"
  segundos?: number;  // duração da etapa concluída
}

const fmtSeg = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
};

export default function KitMontagemModal({ params, onClose, onConcluido }: Props): React.ReactElement {
  const t = useTokens();
  const cor = params?.accent || t.accents.peach;

  const [etapas, setEtapas] = useState<EtapaVis[]>([]);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState('');
  const [etapaErro, setEtapaErro] = useState<EtapaId | null>(null);
  const [resultado, setResultado] = useState<{ id: string; skills: number; agents: number; justificativa: string } | null>(null);
  const [segundos, setSegundos] = useState(0);
  // Chave da montagem no cache do server (= templateId resolvido na etapa 1).
  const chaveRef = useRef('');
  const abortRef = useRef(false);
  // Etapas sem candidatos na base (decidido na preparação) — ref, não state:
  // o loop de etapas lê durante o async e state ficaria preso na closure.
  const puladasRef = useRef<Set<EtapaId>>(new Set());

  // Cronômetro global enquanto roda.
  useEffect(() => {
    if (!rodando) return undefined;
    const iv = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [rodando]);

  const marcar = (id: EtapaId, patch: Partial<EtapaVis>) => {
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const rodarEtapas = async (desde: EtapaId) => {
    if (!params) return;
    setRodando(true);
    setErro('');
    setEtapaErro(null);
    const ordem: EtapaId[] = ['preparar', 'skills', 'agents', 'salvar'];
    const aExecutar = ordem.slice(ordem.indexOf(desde));

    for (const id of aExecutar) {
      if (abortRef.current) { setRodando(false); return; }
      marcar(id, { status: 'ativa' });
      const t0 = Date.now();
      try {
        if (id === 'preparar') {
          const r = await callServer<ServerResult>('kitMontarIniciar', {
            tipo: params.tipo,
            templateId: params.templateId,
            nome: params.tipo === 'segmento' ? params.nome.replace(/^Segmento\s*[—-]\s*/, '') : params.nome,
            objetivo: params.objetivo,
            segKey: params.segKey,
            alvoSkills: params.alvoSkills,
            alvoAgents: params.alvoAgents,
          });
          if (!r.ok) throw new Error(r.error || 'Erro ao preparar');
          const d = r.data as { chave: string; poolSkills: number; poolAgents: number };
          chaveRef.current = d.chave;
          marcar(id, { status: 'ok', detalhe: `${d.poolSkills} skills + ${d.poolAgents} agents candidatos`, segundos: Math.round((Date.now() - t0) / 1000) });
          // Sem candidatos de um lado → a etapa dele será pulada.
          if (d.poolSkills === 0) { puladasRef.current.add('skills'); marcar('skills', { status: 'pulada', detalhe: 'sem candidatos na base' }); }
          if (d.poolAgents === 0) { puladasRef.current.add('agents'); marcar('agents', { status: 'pulada', detalhe: 'sem candidatos na base' }); }
        } else if (id === 'skills' || id === 'agents') {
          if (puladasRef.current.has(id)) continue;
          const r = await callServer<ServerResult>('kitMontarSelecionar', chaveRef.current, id);
          if (!r.ok) throw new Error(r.error || 'Erro na seleção');
          const d = r.data as { quantidade: number };
          marcar(id, { status: 'ok', detalhe: `${d.quantidade} ${id === 'skills' ? 'skills escolhidas' : 'agents escolhidos'}`, segundos: Math.round((Date.now() - t0) / 1000) });
        } else {
          const r = await callServer<ServerResult>('kitMontarFinalizar', chaveRef.current);
          if (!r.ok) throw new Error(r.error || 'Erro ao salvar');
          const d = r.data as { id: string; skills: number; agents: number; justificativa: string };
          marcar(id, { status: 'ok', segundos: Math.round((Date.now() - t0) / 1000) });
          setResultado(d);
        }
      } catch (e) {
        marcar(id, { status: 'erro', segundos: Math.round((Date.now() - t0) / 1000) });
        setErro(e instanceof Error ? e.message : 'Erro na montagem');
        setEtapaErro(id);
        setRodando(false);
        return;
      }
    }
    setRodando(false);
  };

  // Abre → reseta estado e dispara a montagem do zero.
  useEffect(() => {
    if (!params) return;
    abortRef.current = false;
    chaveRef.current = '';
    puladasRef.current = new Set();
    setSegundos(0);
    setErro('');
    setEtapaErro(null);
    setResultado(null);
    setEtapas([
      { id: 'preparar', label: 'Lendo sua base', icone: <BookMarked size={15} />, status: 'pendente' },
      { id: 'skills', label: 'Lume selecionando as skills', icone: <Layers size={15} />, status: 'pendente' },
      { id: 'agents', label: 'Lume selecionando os agents', icone: <Bot size={15} />, status: 'pendente' },
      { id: 'salvar', label: 'Salvando o kit', icone: <Save size={15} />, status: 'pendente' },
    ]);
    void rodarEtapas('preparar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const fechar = () => {
    abortRef.current = true;
    onClose();
  };

  const concluir = () => {
    if (resultado) {
      message.success(`Kit montado: ${resultado.skills} skills + ${resultado.agents} agents.`);
      onConcluido(resultado.id);
    }
    onClose();
  };

  const statusDot = (e: EtapaVis) => {
    const base: React.CSSProperties = {
      width: 26, height: 26, borderRadius: 999, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.25s ease',
    };
    if (e.status === 'ok') return <div style={{ ...base, background: `${t.accents.sage}26`, color: t.accents.sage }}><Check size={14} strokeWidth={2.4} /></div>;
    if (e.status === 'erro') return <div style={{ ...base, background: `${t.accents.rose}26`, color: t.accents.rose }}><AlertTriangle size={13} /></div>;
    if (e.status === 'ativa') {
      return (
        <div style={{ ...base, background: `${cor}22`, color: cor }}>
          <Sparkles size={13} className="forja-spin" style={{ animationDuration: '2.2s' }} />
        </div>
      );
    }
    // pendente / pulada
    return <div style={{ ...base, background: t.surfaceMuted, color: t.textTertiary }}>{e.icone}</div>;
  };

  return (
    <Modal
      open={!!params}
      onCancel={fechar}
      width={480}
      footer={
        resultado ? [
          <Button key="fechar" onClick={fechar}>Fechar</Button>,
          <Button key="ver" type="primary" icon={<Eye size={14} />} onClick={concluir}
            style={{ background: cor, borderColor: cor }}>
            Ver o kit
          </Button>,
        ] : erro ? [
          <Button key="fechar" onClick={fechar}>Fechar</Button>,
          <Button key="retry" type="primary" icon={<RotateCcw size={14} />}
            onClick={() => { if (etapaErro) void rodarEtapas(etapaErro); }}
            style={{ background: cor, borderColor: cor }}>
            Tentar essa etapa de novo
          </Button>,
        ] : [
          <Button key="cancelar" onClick={fechar}>Cancelar</Button>,
        ]
      }
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={17} color={cor} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500 }}>Montando — {params?.nome}</span>
        </span>
      }
    >
      {/* Modelo + cronômetro total */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
        padding: '8px 12px', borderRadius: 10,
        background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`,
      }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary }}>Curadoria:</span>
        <ModeloBadge uso="kit" size="medium" />
        <span style={{
          marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 12.5,
          color: rodando ? cor : t.textTertiary, fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtSeg(segundos)}
        </span>
      </div>

      {/* Trilha de fases */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {etapas.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {statusDot(e)}
              {i < etapas.length - 1 && (
                <div style={{
                  width: 2, flex: 1, minHeight: 18, margin: '3px 0',
                  background: e.status === 'ok' ? `${t.accents.sage}55` : t.borderSoft,
                  borderRadius: 2, transition: 'background 0.3s ease',
                }} />
              )}
            </div>
            <div style={{ paddingBottom: i < etapas.length - 1 ? 16 : 0, paddingTop: 3, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: FONTS.ui, fontSize: 13.5,
                  fontWeight: e.status === 'ativa' ? 600 : 500,
                  color: e.status === 'pendente' || e.status === 'pulada' ? t.textTertiary : t.text,
                  transition: 'color 0.25s ease',
                }}>
                  {e.label}
                </span>
                {e.segundos !== undefined && e.status !== 'ativa' && (
                  <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>{fmtSeg(e.segundos)}</span>
                )}
              </div>
              {e.status === 'ativa' && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, marginTop: 2 }}>
                  {e.id === 'skills' || e.id === 'agents'
                    ? 'a Lume está lendo o catálogo e escolhendo… (~30-60s com modelo de raciocínio)'
                    : 'um instante…'}
                </div>
              )}
              {e.detalhe && e.status !== 'ativa' && (
                <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: e.status === 'pulada' ? t.textTertiary : t.textSecondary, marginTop: 2 }}>
                  {e.detalhe}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Erro visível no modal (não some como toast) + CTA de retry no footer */}
      {erro && (
        <div style={{
          marginTop: 16, borderRadius: 10, padding: '10px 14px',
          background: `${t.accents.rose}1f`, border: `1px solid ${t.accents.rose}55`,
          fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, lineHeight: 1.6,
        }}>
          {erro}
        </div>
      )}

      {/* Resumo final */}
      {resultado && (
        <div style={{
          marginTop: 16, borderRadius: 10, padding: '12px 14px',
          background: `${t.accents.sage}1f`, border: `1px solid ${t.accents.sage}55`,
        }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
            {resultado.skills} skills + {resultado.agents} agents
          </div>
          {resultado.justificativa && (
            <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              {resultado.justificativa}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
