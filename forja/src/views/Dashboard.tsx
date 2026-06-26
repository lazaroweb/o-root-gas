import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Tag, Tooltip, Button } from 'antd';
import {
  HeartPulse, Sparkles, GitBranch, Server, Plus, AppWindow, Flame, FileCode, FileText,
  AlertTriangle, AlertCircle, Info, ListChecks, GitCommit, ChevronRight, CloudOff, Inbox,
  Cpu,
} from 'lucide-react';
import { Panel, Skeleton, RingProgress, LiveDot, EmptyArt, useCountUp } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import { pingMuitos, urlPingavel, type PingResult } from '../utils/pingServidor';
import type { DashboardData, StatusGeral, DashboardOperacional, ServerResponse, Servidor, ServerResult } from '../types';
import type { AtelierTab } from './Atelier';

interface DashboardProps {
  onSelectSistema: (id: string) => void;
  onNavigate: (view: 'financeiro' | 'sistemas' | 'operacoes' | 'relatorios' | 'ideias' | 'configuracoes') => void;
  onImportGAS?: () => void;
  // v1.4.4: abre o drawer de alertas (controlado em App.tsx). Quando ausente
  // (preview local), o link de "ver alertas" não aparece.
  onOpenAlertas?: () => void;
  // v1.146.1: navega direto pra uma estação específica do Atelier (ex.: Servidores).
  onOpenAtelierTab?: (tab: AtelierTab) => void;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Narrativa TÉCNICA (v1.4.4) — sem qualquer menção a dinheiro/lucro/MRR.
// Foco no que importa pra command center: saúde, atenção, próximas ações.
function narrativaTecnica(
  totais: { sistemas: number; ativos: number },
  saudeMedia: number,
  ops?: DashboardOperacional | null,
): string {
  if (totais.sistemas === 0) return 'Bancada vazia. Importe seus apps do GAS ou cadastre um do zero pra começar.';
  if (totais.ativos === 0) return 'Nenhum app ativo agora — bom momento pra retomar um projeto ou começar um novo.';
  const alertas = ops?.alertasNaoLidos || 0;
  const findings = ops?.findingsAbertos || 0;
  const atencao = ops?.breakdown?.atencao || 0;
  if (alertas > 0 && atencao > 0) return `${atencao} app${atencao > 1 ? 's' : ''} pedindo atenção e ${alertas} alerta${alertas > 1 ? 's' : ''} não lido${alertas > 1 ? 's' : ''} — vale dar uma olhada.`;
  if (atencao > 0) return `${atencao} app${atencao > 1 ? 's' : ''} no status atenção — confere o que tá rolando.`;
  if (alertas > 0) return `${alertas} alerta${alertas > 1 ? 's' : ''} técnico${alertas > 1 ? 's' : ''} pendente${alertas > 1 ? 's' : ''} no painel.`;
  if (findings > 5) return `${findings} findings de auditoria em aberto. Bora resolver um por dia.`;
  if (saudeMedia < 50) return 'Saúde média abaixo de 50 — vários apps pedindo atenção.';
  if (saudeMedia < 75) return 'Algumas pendências leves pra revisar — nada urgente.';
  return 'Tudo rodando bem. Bom momento pra avançar com features novas.';
}

const MOCK: DashboardData = {
  kpis: { mrr: 0, custoMensal: 0, lucro: 0, saudeMedia: 88 },
  mrrSeries: [],
  apps: [
    { id: '1', nome: 'ClientFlow', estagio: 'tempera', cliente: '', mrr: 0, saude: 92, status: 'ativo' },
    { id: '2', nome: 'FORJA', estagio: 'forja', cliente: '', mrr: 0, saude: 85, status: 'ativo' },
  ],
  contas: [],
  totais: { sistemas: 3, ativos: 2, assinaturas: 0 },
};

export default function Dashboard({ onSelectSistema, onNavigate, onImportGAS, onOpenAlertas, onOpenAtelierTab }: DashboardProps): React.ReactElement {
  const t = useTokens();
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<StatusGeral | null>(null);
  const [ops, setOps] = useState<DashboardOperacional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // v1.143.0 (fusão Centelha): substituído por contagem do inbox de Ideias —
  // mesma semântica (captura bruta esperando triagem), feature unificada.
  const [ideiasInbox, setIdeiasInbox] = useState<number>(0);
  // Monitoramento ao vivo dos servidores cadastrados (v1.146.1).
  // Pingados no browser do user — único caminho pra alcançar localhost.
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [servidoresPings, setServidoresPings] = useState<Map<string, PingResult>>(new Map());

  useEffect(() => {
    callServer<ServerResponse<DashboardData>>('getDashboardData')
      .then(res => {
        if (res.ok && res.data) setData(res.data);
        else setError(res.error || 'Erro ao carregar');
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
    callServer<ServerResponse<StatusGeral>>('getStatusGeral')
      .then(res => { if (res.ok && res.data) setStatus(res.data as StatusGeral); })
      .catch(() => { /* preview local não valida */ });
    callServer<ServerResponse<DashboardOperacional>>('getDashboardOperacional')
      .then(res => { if (res.ok && res.data) setOps(res.data as DashboardOperacional); })
      .catch(() => { /* preview local */ });
    // Ideias no inbox (princípio #6: alerta sem tratativa proibido — o badge tem clique).
    callServer<ServerResponse<{ pendentes: number }>>('getIdeiasInboxCount')
      .then((res) => { if (res.ok && res.data) setIdeiasInbox(res.data.pendentes || 0); })
      .catch(() => { /* preview */ });
    // Servidores cadastrados + ping ao vivo no browser do user.
    // Falha silenciosa em preview local. Ping com timeout curto (3s) pra não
    // travar o Dashboard se algum endpoint estiver pendurado.
    callServer<ServerResult>('servidoresList')
      .then(async (res) => {
        if (res.ok && res.data) {
          const lista = res.data as Servidor[];
          setServidores(lista);
          const pingaveis = lista.filter((s) => !!urlPingavel(s));
          if (pingaveis.length > 0) {
            const mapa = await pingMuitos(pingaveis, 3000, 4);
            setServidoresPings(mapa);
          }
        }
      })
      .catch(() => { /* preview */ });
    // Sync silencioso com o GAS: se algo mudou (novo/removido), recarrega o painel.
    callServer<ServerResponse<{ novos: number; removidos: unknown[]; renomeados: unknown[]; restaurados: number; selfVinculado?: boolean }>>('sincronizarGAS')
      .then(res => {
        if (res.ok && res.data) {
          const d = res.data;
          if (d.novos > 0 || (d.removidos && d.removidos.length > 0) || (d.renomeados && d.renomeados.length > 0) || d.restaurados > 0 || d.selfVinculado) {
            callServer<ServerResponse<DashboardData>>('getDashboardData')
              .then(r => { if (r.ok && r.data) setData(r.data); })
              .catch(() => { /* mantém estado atual */ });
          }
        }
      })
      .catch(() => { /* sync é best-effort */ });
  }, []);

  // Contador animado do score (0 → valor) no mount. Chamado antes dos early
  // returns pra respeitar as regras de hooks; cai pra 0 enquanto carrega.
  const saudeAnim = Math.round(useCountUp(data?.kpis.saudeMedia ?? 0, 900));

  if (loading) {
    return (
      <div className="forja-view" style={{ padding: '68px 40px 56px', maxWidth: 1280, margin: '0 auto' }}>
        <Skeleton width={160} height={14} radius={6} />
        <div style={{ height: 14 }} />
        <Skeleton width={340} height={40} radius={8} />
        <div style={{ height: 28 }} />
        <Row gutter={[18, 18]}>
          <Col xs={24} lg={16}><div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 28, height: 280 }}><Skeleton width={180} height={14} /><div style={{ height: 18 }} /><Skeleton width={240} height={56} radius={10} /><div style={{ height: 28 }} /><Skeleton width="100%" height={120} radius={12} /></div></Col>
          <Col xs={24} lg={8}><div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: 22, height: 280 }}><Skeleton width={140} height={14} /><div style={{ height: 18 }} /><div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton width={128} height={128} radius={64} /></div></div></Col>
        </Row>
      </div>
    );
  }
  if (error) return <Alert type="error" message={error} showIcon style={{ margin: 24 }} />;
  if (!data) return <></>;

  const { kpis, apps } = data;

  const statusColor = (s: string) => s === 'ativo' ? t.accents.sage : s === 'atencao' ? t.accents.peach : s === 'arquivado' ? t.textTertiary : t.accents.blue;
  const statusLabel = (s: string) => s === 'ativo' ? 'Ativo' : s === 'atencao' ? 'Atenção' : s === 'arquivado' ? 'Arquivado' : 'Rascunho';

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const saudeCor = kpis.saudeMedia >= 75 ? t.accents.sage : kpis.saudeMedia >= 45 ? t.accents.peach : t.accents.rose;
  const saudeLabel = kpis.saudeMedia >= 75 ? 'Saudável' : kpis.saudeMedia >= 45 ? 'Atenção leve' : 'Crítico';

  const conta = narrativaTecnica(data.totais, kpis.saudeMedia, ops);
  const stagger = (i: number): React.CSSProperties => ({ animation: `forjaRise 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both` });

  // Breakdown técnico — usa dados operacionais ou cai pro mock
  const bk = ops?.breakdown || { rascunho: 0, forja: 0, tempera: 0, prateleira: 0, atencao: 0 };

  // Recomendação dinâmica pra saúde média — o que fazer pra chegar perto de 100.
  const saudeDica = kpis.saudeMedia >= 75
    ? 'Saudável. Pra manter perto de 100: monitore os Pulsos e resolva os findings da auditoria conforme aparecem.'
    : kpis.saudeMedia >= 45
      ? 'Atenção leve. Abra os apps com score mais baixo e feche os fatores vermelhos: custos, atividade (Pulsos) e riscos altos.'
      : 'Crítico. Priorize: em cada app abra a Saúde, clique nos fatores vermelhos e resolva — cadastrar custos, ligar monitoramento (Pulsos) e baixar riscos altos sobem o score rápido.';

  return (
    // minHeight 100vh: o fundo ambiente (aurora + dither) preenche a viewport
    // toda. Sem isso, quando o conteúdo é mais curto que a tela, a camada de
    // dither terminava no fim do conteúdo e o appBg puro aparecia abaixo —
    // criando uma faixa/serrilha horizontal. Agora a transição é uniforme.
    <div style={{ position: 'relative', zIndex: 0, minHeight: '100vh' }}>
      {/* Aurora ambiente — full-bleed: cobre TODA a área de conteúdo (não só a
          coluna de 1280), pra os brilhos sangrarem de ponta a ponta sem marcar
          bandas nas laterais. Cada mancha desvanece em radial, então o recorte
          acontece só na borda real do viewer. zIndex -1 = atrás de tudo. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }}>
        <span className="forja-aurora" style={{ width: 640, height: 640, top: -160, left: '2%', background: `radial-gradient(circle, ${t.accents.peach}, transparent 70%)`, opacity: 0.11, animation: 'forjaAurora 18s ease-in-out infinite' }} />
        <span className="forja-aurora" style={{ width: 560, height: 560, top: -120, right: '6%', background: `radial-gradient(circle, ${t.accents.clay}, transparent 70%)`, opacity: 0.075, animation: 'forjaAurora2 23s ease-in-out infinite' }} />
        <span className="forja-aurora" style={{ width: 520, height: 520, top: 200, left: '44%', background: `radial-gradient(circle, ${saudeCor}, transparent 72%)`, opacity: 0.09, animation: 'forjaAurora3 27s ease-in-out infinite' }} />
        <div className="forja-grain" />
      </div>
      <div style={{ padding: '68px 40px 56px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Hero editorial — sem números financeiros */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 28, ...stagger(0) }}>
        <div>
          <div style={{ fontSize: 12.5, color: t.textTertiary, textTransform: 'capitalize', letterSpacing: '0.04em', marginBottom: 6 }}>{dataHoje} · Forja</div>
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 44, lineHeight: 1.05, margin: 0, color: t.text, letterSpacing: '-0.022em' }}>
            {saudacao()}, <span style={{ fontStyle: 'italic', color: t.accents.clay }}>mestre</span>.
          </h1>
          <p style={{ margin: '10px 0 0', color: t.textSecondary, fontSize: 14.5, maxWidth: 560, lineHeight: 1.55 }}>{conta}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button icon={<FileText size={16} />} onClick={() => onNavigate('relatorios')}>Relatório do mês</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => onNavigate('sistemas')} style={{ boxShadow: `0 6px 18px ${t.accents.peach}4d` }}>Novo sistema</Button>
        </div>
      </header>

      {/* Hero operacional + Status técnico */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          {/* Hero técnico: saúde média grande + breakdown estágios + counts operacionais */}
          <div className="forja-lift" style={{
            ...stagger(1),
            position: 'relative',
            borderRadius: 22,
            border: `1px solid ${t.border}`,
            background: `linear-gradient(140deg, ${saudeCor}22 0%, ${saudeCor}0a 32%, ${t.surface} 64%)`,
            boxShadow: t.shadow,
            padding: 28,
            overflow: 'hidden',
            height: '100%',
            minHeight: 280,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${saudeCor}00, ${saudeCor}, ${saudeCor}00)`, opacity: 0.55 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <HeartPulse size={14} strokeWidth={1.8} color={saudeCor} /> Saúde operacional
              </span>
              <Tooltip title={<TipBox titulo={`Status: ${saudeLabel}`} dica={saudeDica} />} placement="left">
                <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 11, background: `${saudeCor}1a`, color: saudeCor, cursor: 'help' }}>{saudeLabel}</Tag>
              </Tooltip>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
              <Tooltip title={<TipBox titulo="Saúde média dos sistemas (0–100)" dica={saudeDica} />} placement="bottom">
                <span style={{
                  fontFamily: FONTS.display, fontWeight: 500, fontSize: 64,
                  color: t.text, lineHeight: 1, letterSpacing: '-0.025em',
                  fontVariantNumeric: 'tabular-nums', cursor: 'help',
                  textShadow: `0 2px 24px ${saudeCor}40`,
                }}>
                  {saudeAnim}
                  <span style={{ fontSize: 28, color: t.textTertiary, marginLeft: 4 }}>/100</span>
                </span>
              </Tooltip>
            </div>
            <Tooltip title={<TipBox titulo="Sistemas ativos vs. cadastrados" dica="Ativo = teve pulso/decisão/incidente recente. Apps parados não contam como ativos — registre atividade ou monitore a URL (Pulsos) pra reativar." />} placement="bottom">
              <div style={{ fontSize: 13, color: t.textTertiary, marginBottom: 22, display: 'inline-block', cursor: 'help' }}>
                <span style={{ fontWeight: 600, color: t.text }}>{data.totais.ativos}</span> ativo{data.totais.ativos !== 1 ? 's' : ''} de <span style={{ fontWeight: 600, color: t.text }}>{data.totais.sistemas}</span> sistema{data.totais.sistemas !== 1 ? 's' : ''} cadastrado{data.totais.sistemas !== 1 ? 's' : ''}
              </div>
            </Tooltip>

            {/* Mini-stats operacionais: estágios + counts */}
            <Row gutter={[18, 14]}>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Em forja"
                  valor={bk.forja}
                  cor={t.accents.peach}
                  hint="Em desenvolvimento"
                  dica="Sistemas em construção. Ação: abra cada um e complete o checklist de graduação (deploy, dossiê, custos, riscos, fluxo) pra graduar pra Têmpera."
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Têmpera"
                  valor={bk.tempera}
                  cor={t.accents.sage}
                  hint="No ar / em produção"
                  dica="No ar, em produção. Ação: monitore a URL (Pulsos), resolva findings da auditoria e mantenha custos/risco em dia. Quando aposentar ou pausar, mova pra Prateleira."
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Prateleira"
                  valor={bk.prateleira}
                  cor={t.textTertiary}
                  hint="Pausado / aposentado"
                  dica="Pausado ou aposentado. Ação: manutenção mínima — revise custos pra não pagar por algo parado e desligue monitoramento se não fizer mais sentido."
                />
              </Col>
              <Col xs={12} sm={6}>
                <TechMiniStat
                  titulo="Atenção"
                  valor={bk.atencao}
                  cor={bk.atencao > 0 ? t.accents.rose : t.textTertiary}
                  hint="Pedindo ação"
                  destaque={bk.atencao > 0}
                  dica={bk.atencao > 0
                    ? 'Apps com alerta crítico ou risco alto. Clique pra abrir a Bancada — você vai cair direto nos apps em atenção.'
                    : 'Nenhum app pedindo ação agora. Mantenha resolvendo alertas e findings assim que aparecem.'}
                  onClick={bk.atencao > 0 ? () => onNavigate('sistemas') : undefined}
                />
              </Col>
            </Row>

            {/* Linha de counts operacionais (rodapé do hero) */}
            {((ops && (ops.decisoesAbertas > 0 || ops.findingsAbertos > 0 || ops.alertasNaoLidos > 0)) || ideiasInbox > 0) && (
              <div style={{
                marginTop: 22, paddingTop: 16,
                borderTop: `1px solid ${t.borderSoft}`,
                display: 'flex', gap: 20, flexWrap: 'wrap',
                fontSize: 12.5, color: t.textTertiary,
              }}>
                {ideiasInbox > 0 && (
                  <Tooltip title={<TipBox titulo="Ideias no inbox" dica="Ideias capturadas brutas (sem categoria nem sistema). Ação: clique pra abrir Ideias na visão Inbox — você pode triar uma por uma ou entrar no Modo Foco pra despachar em batch." />}>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                      onClick={() => onNavigate('ideias')}
                    >
                      <Inbox size={13} color={t.accents.peach} />
                      <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ideiasInbox}</strong> ideia{ideiasInbox !== 1 ? 's' : ''} no inbox
                    </span>
                  </Tooltip>
                )}
                {ops && ops.decisoesAbertas > 0 && (
                  <Tooltip title={<TipBox titulo="Decisões em aberto" dica="Itens no backlog ainda não concluídos. Clique pra ver a Bancada — entre nos sistemas com mais pendência e mova pra 'Feito' o que já resolveu." />}>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                      onClick={() => onNavigate('sistemas')}
                    >
                      <ListChecks size={13} color={t.accents.lavender} />
                      <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.decisoesAbertas}</strong> decisões em aberto
                    </span>
                  </Tooltip>
                )}
                {ops && ops.findingsAbertos > 0 && (
                  <Tooltip title={<TipBox titulo="Findings de auditoria" dica="Achados da Forja IA ainda não tratados. Clique pra abrir a Bancada — entre nos sistemas com mais findings e resolva (ou registre como risco/decisão)." />}>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                      onClick={() => onNavigate('sistemas')}
                    >
                      <AlertTriangle size={13} color={t.accents.peach} />
                      <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.findingsAbertos}</strong> findings pra resolver
                    </span>
                  </Tooltip>
                )}
                {ops && ops.alertasNaoLidos > 0 && onOpenAlertas && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={onOpenAlertas}>
                    <AlertCircle size={13} color={t.accents.rose} />
                    <strong style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{ops.alertasNaoLidos}</strong> alertas não lidos
                  </span>
                )}
              </div>
            )}
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div className="forja-lift" style={{ ...stagger(2), borderRadius: 22, border: `1px solid ${t.border}`, background: t.surface, boxShadow: t.shadow, padding: 24, height: '100%', minHeight: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Server size={14} strokeWidth={1.8} color={t.accents.blue} /> Conexões
              </span>
              {status && (
                <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 11, fontWeight: 600, background: status.resumo.online === status.resumo.total ? `${t.accents.sage}1a` : `${t.accents.clay}1a`, color: status.resumo.online === status.resumo.total ? t.accents.sage : t.accents.clay }}>{status.resumo.online}/{status.resumo.total} online</Tag>
              )}
            </div>
            <Tooltip title={<TipBox titulo="Saúde média × apps ativos" dica={saudeDica} />} placement="bottom">
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px', cursor: 'help' }}>
                <RingProgress value={kpis.saudeMedia} color={saudeCor} size={132} sublabel={`${data.totais.ativos} apps ativos`} />
              </div>
            </Tooltip>
            <div style={{ borderTop: `1px solid ${t.borderSoft}`, paddingTop: 8 }}>
              {(status ? [
                { icon: <Sparkles size={14} strokeWidth={1.8} />, nome: 'IA — Proxy', live: status.llm, tip: status.llm.detalhe || 'Conexão com o proxy de LLM.', destino: 'configuracoes' as const },
                { icon: <GitBranch size={14} strokeWidth={1.8} />, nome: 'GitHub', live: status.github, tip: status.github.detalhe || 'Validação do token do GitHub.', destino: 'configuracoes' as const },
              ] : []).map((r, i) => {
                const cor = !r.live.configurado ? t.textTertiary : r.live.conectado ? t.accents.sage : t.accents.rose;
                // Tratativa: se está com problema (sem config ou desconectada),
                // clicar leva direto pra Configurações. Senão, leva pra Operações.
                const precisaAjuste = !r.live.configurado || !r.live.conectado;
                const tipFinal = precisaAjuste
                  ? `${r.tip}\n\nClique pra abrir Configurações e corrigir.`
                  : `${r.tip}\n\nClique pra ver detalhes em Operações.`;
                const onClick = () => onNavigate(precisaAjuste ? 'configuracoes' : 'operacoes');
                return (
                  <Tooltip key={i} title={tipFinal} placement="left">
                    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }}>
                      <LiveDot color={cor} live={r.live.conectado === true} />
                      <span style={{ color: t.textSecondary, display: 'inline-flex' }}>{r.icon}</span>
                      <span style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: 500 }}>{r.nome}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>
                        {!r.live.configurado ? 'Não config.' : r.live.conectado ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
              {status && (() => {
                const apisOnline = status.apis.filter(a => a.conectado).length;
                const total = status.apis.length;
                const cor = total === 0 ? t.textTertiary : apisOnline === total ? t.accents.sage : t.accents.rose;
                return (
                  <div onClick={() => onNavigate('operacoes')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }}>
                    <LiveDot color={cor} live={total > 0 && apisOnline > 0} />
                    <span style={{ color: t.textSecondary, display: 'inline-flex' }}><Server size={14} strokeWidth={1.8} /></span>
                    <span style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: 500 }}>Endpoints de APIs</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{total ? `${apisOnline}/${total}` : '—'}</span>
                  </div>
                );
              })()}
              {/* Servidores locais/cloud — pingados no browser do user. */}
              {(() => {
                const pingaveis = servidores.filter((s) => !!urlPingavel(s));
                if (servidores.length === 0) return null;
                const monit = pingaveis.length;
                let online = 0;
                let verificando = 0;
                pingaveis.forEach((s) => {
                  const p = servidoresPings.get(s.id);
                  if (p?.status === 'online') online++;
                  else if (p?.status === 'verificando' || !p) verificando++;
                });
                const cor = monit === 0
                  ? t.textTertiary
                  : online === monit ? t.accents.sage
                  : online === 0 ? t.accents.rose
                  : t.accents.peach;
                const tipText = monit === 0
                  ? `${servidores.length} servidores cadastrados sem URL pra pingar.`
                  : `${online}/${monit} servidores respondendo ao ping. Clica pra abrir a estação Servidores no Atelier.`;
                const onClick = onOpenAtelierTab ? () => onOpenAtelierTab('servidores') : undefined;
                return (
                  <Tooltip title={tipText} placement="left">
                    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: onClick ? 'pointer' : 'default' }}>
                      <LiveDot color={cor} live={online > 0} />
                      <span style={{ color: t.textSecondary, display: 'inline-flex' }}><Cpu size={14} strokeWidth={1.8} /></span>
                      <span style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: 500 }}>Servidores</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>
                        {monit === 0 ? '—' : verificando === monit ? '...' : `${online}/${monit}`}
                      </span>
                    </div>
                  </Tooltip>
                );
              })()}
            </div>
          </div>
        </Col>
      </Row>

      <div style={{ height: 20 }} />

      {/* Aplicações + Atividade técnica */}
      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} lg={16}>
          <div className="forja-lift" style={{ ...stagger(3), height: '100%' }}>
            <Panel
              title="Aplicações"
              extra={apps.length > 0 ? <a onClick={() => onNavigate('sistemas')} style={{ color: t.accents.peach, fontSize: 13, cursor: 'pointer' }}>Ver todas →</a> : undefined}
              padding={8}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: t.shadow }}
              bodyStyle={apps.length > 0 ? { flex: 1, minHeight: 0, position: 'relative', padding: 0 } : undefined}
            >
              {apps.length === 0 ? (
                <EmptyArt
                  icon={<Flame size={28} strokeWidth={1.6} />}
                  titulo="Sua bancada está vazia"
                  descricao="Importe seus apps do Google Apps Script ou cadastre um do zero — em segundos eles aparecem aqui com saúde e operação."
                  acao={
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      {onImportGAS && <Button type="primary" icon={<FileCode size={16} />} onClick={onImportGAS}>Importar do GAS</Button>}
                      <Button icon={<Plus size={16} />} onClick={() => onNavigate('sistemas')}>Cadastrar manualmente</Button>
                    </div>
                  }
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 8 }}>
                  {apps.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => onSelectSistema(a.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceMuted)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor(a.status)}22`, color: statusColor(a.status), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 600, fontSize: 16 }}>
                        {a.nome.charAt(0)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: t.text, fontWeight: 500, fontSize: 14 }}>{a.nome}</span>
                          {a.removidoNoGas && (
                            <Tooltip title="Não existe mais no seu Google Apps Script. Gerencie em Sistemas.">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: `${t.accents.rose}1f`, color: t.accents.rose, border: `1px solid ${t.accents.rose}66`, borderRadius: 999, padding: '0px 6px', fontSize: 9.5, fontWeight: 700 }}>
                                <CloudOff size={8} strokeWidth={2.4} /> GAS
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        <div style={{ color: t.textTertiary, fontSize: 12, textTransform: 'capitalize' }}>{a.estagio}</div>
                      </div>
                      <Tooltip title="Saúde do app (0–100): uptime, incidentes e manutenção.">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'flex-end', cursor: 'help' }}>
                          <HeartPulse size={13} strokeWidth={1.7} color={a.saude >= 75 ? t.accents.sage : a.saude >= 45 ? t.accents.peach : t.accents.rose} />
                          <span style={{ color: t.textSecondary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{a.saude || '—'}</span>
                        </div>
                      </Tooltip>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110, justifyContent: 'flex-end' }}>
                        <LiveDot color={statusColor(a.status)} live={a.status === 'ativo'} />
                        <span style={{ color: t.textSecondary, fontSize: 13 }}>{statusLabel(a.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div className="forja-lift" style={stagger(4)}>
            <AtividadePanel
              ops={ops}
              onAbrirAlertas={onOpenAlertas || (() => { /* sem callback: link omitido */ })}
              onAbrirSistema={(id) => onSelectSistema(id)}
              temAlertasCallback={!!onOpenAlertas}
            />
          </div>
        </Col>
      </Row>
      </div>
    </div>
  );
}

// ─── Sub-componentes técnicos ────────────────────────────────────────────────

// Conteúdo padrão de tooltip "didático": título + recomendação acionável.
function TipBox({ titulo, dica }: { titulo: string; dica: string }): React.ReactElement {
  return (
    <div style={{ maxWidth: 250 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 12, opacity: 0.88, lineHeight: 1.5 }}>{dica}</div>
    </div>
  );
}

function TechMiniStat({ titulo, valor, cor, hint, destaque, dica, onClick }: {
  titulo: string; valor: number; cor: string; hint?: string; destaque?: boolean; dica?: string;
  // v1.147 — stat fica clicável quando tem ação (princípio "alerta sem ação proibido").
  onClick?: () => void;
}): React.ReactElement {
  const t = useTokens();
  const conteudo = (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : dica ? 'help' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titulo}</span>
      </div>
      <div style={{
        fontFamily: FONTS.display, fontSize: 28, fontWeight: 500,
        color: destaque ? cor : t.text, marginTop: 4,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>
        {valor}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: onClick ? cor : t.textTertiary, marginTop: 2, fontWeight: onClick ? 600 : 400 }}>
        {hint}{onClick ? ' →' : ''}
      </div>}
    </div>
  );
  return dica
    ? <Tooltip title={<TipBox titulo={titulo} dica={dica} />} placement="bottom">{conteudo}</Tooltip>
    : conteudo;
}

// Painel de atividade técnica — substitui "Contas a vencer" (que era $ no dashboard).
// Mostra alertas não lidos + decisões recentes em um único feed compacto.
function AtividadePanel({ ops, onAbrirAlertas, onAbrirSistema, temAlertasCallback }: {
  ops: DashboardOperacional | null;
  onAbrirAlertas: () => void;
  onAbrirSistema: (id: string) => void;
  temAlertasCallback: boolean;
}): React.ReactElement {
  const t = useTokens();

  const semConteudo = !ops || (ops.alertasTop.length === 0 && ops.decisoesRecentes.length === 0);

  if (!ops) {
    return (
      <Panel title="Atividade técnica" padding={8} style={{ boxShadow: t.shadow }}>
        <div style={{ padding: 20, color: t.textTertiary, fontSize: 13, textAlign: 'center' }}>
          Carregando...
        </div>
      </Panel>
    );
  }

  if (semConteudo) {
    return (
      <Panel title="Atividade técnica" padding={8} style={{ boxShadow: t.shadow }}>
        <EmptyArt
          icon={<AppWindow size={26} strokeWidth={1.6} />}
          titulo="Tudo silêncio"
          descricao="Sem alertas pendentes nem decisões recentes. Quando algo acontecer nos seus sistemas, aparece aqui."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Atividade técnica"
      extra={
        ops.alertasNaoLidos > 0 && temAlertasCallback
          ? <a onClick={onAbrirAlertas} style={{ color: t.accents.peach, fontSize: 13, cursor: 'pointer' }}>Ver alertas →</a>
          : undefined
      }
      padding={8}
      style={{ boxShadow: t.shadow }}
    >
      {/* Alertas não lidos (top 3) */}
      {ops.alertasTop.length > 0 && (
        <div>
          <div style={{
            padding: '8px 14px 4px',
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.08em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            Alertas
          </div>
          {ops.alertasTop.slice(0, 3).map((a) => {
            const cor = a.severidade === 'critico' ? t.accents.rose
              : a.severidade === 'aviso' ? t.accents.peach
              : t.accents.blue;
            const Ic = a.severidade === 'critico' ? AlertCircle
              : a.severidade === 'aviso' ? AlertTriangle
              : Info;
            return (
              <div
                key={a.id}
                onClick={() => a.sistemaId ? onAbrirSistema(a.sistemaId) : (temAlertasCallback ? onAbrirAlertas() : undefined)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderLeft: `2px solid ${cor}`,
                  background: `${cor}06`,
                  marginBottom: 1,
                }}
              >
                <Ic size={14} color={cor} strokeWidth={1.7} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: t.text, fontSize: 13, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.titulo}
                  </div>
                  <div style={{
                    color: t.textTertiary, fontSize: 11.5, marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.mensagem}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decisões recentes (top 3) */}
      {ops.decisoesRecentes.length > 0 && (
        <div style={{ marginTop: ops.alertasTop.length > 0 ? 10 : 0 }}>
          <div style={{
            padding: '8px 14px 4px',
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: '0.08em',
            color: t.textTertiary, textTransform: 'uppercase',
          }}>
            Decisões recentes
          </div>
          {ops.decisoesRecentes.slice(0, 3).map((d) => {
            const prioCor = d.prioridade === 'alta' ? t.accents.rose
              : d.prioridade === 'media' ? t.accents.peach
              : t.accents.sage;
            return (
              <div
                key={d.id}
                onClick={() => onAbrirSistema(d.sistemaId)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderTop: `1px solid ${t.borderSoft}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = t.surfaceMuted}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <GitCommit size={14} color={prioCor} strokeWidth={1.7} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: t.text, fontSize: 13, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {d.titulo}
                  </div>
                  <div style={{
                    color: t.textTertiary, fontSize: 11.5, marginTop: 1,
                  }}>
                    {d.sistemaNome}
                  </div>
                </div>
                <ChevronRight size={13} color={t.textTertiary} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
