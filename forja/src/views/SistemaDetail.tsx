import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Spin, Alert, Descriptions, Divider, Tabs, App as AntApp, Tooltip, Popover, Progress } from 'antd';
import { ArrowLeft, Pencil, ExternalLink, GitBranch, RefreshCw, FileCode, Wand2, Globe2, CheckCircle2, XCircle, HeartPulse, Info, Plug, ClipboardList, ShieldAlert, Receipt, Activity, Layers, Bug, History } from 'lucide-react';
import StageBadge from '../components/StageBadge';
import { Panel } from '../components/ui';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import RecursosPanel from './RecursosPanel';
import DecisoesPanel from './DecisoesPanel';
import BacklogPanel from './BacklogPanel';
import BacklogDrawer from '../components/BacklogDrawer';
import IdeiasFaixa from '../components/IdeiasFaixa';
import RiscosPanel from './RiscosPanel';
import PulsosPanel from './PulsosPanel';
import PassaporteModal from './PassaporteModal';
import AuditoriaDrawer from '../components/AuditoriaDrawer';
import GraduacaoChecklist from '../components/GraduacaoChecklist';
import CustosTab from '../components/CustosTab';
import DividaTecnicaPanel from '../components/DividaTecnicaPanel';
import AuditoriasTab from '../components/AuditoriasTab';
import callServer from '../gas-client';
import type { Sistema, ServerResponse, ServerResult, SaudeBreakdown } from '../types';

const { Text, Paragraph } = Typography;

interface SistemaDetailProps {
  sistemaId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

// Mock data para preview local
const MOCK_SISTEMA: Sistema = {
  id: 'mock-1',
  nome: 'FORJA',
  codinome: 'forja',
  estagio: 'forja',
  proposito: 'Central de comando e governança de sistemas',
  stack: 'GAS, React, TypeScript, Ant Design',
  urlProd: '',
  scoreSaude: 85,
};

export default function SistemaDetail({ sistemaId, onBack, onEdit }: SistemaDetailProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [saude, setSaude] = useState<SaudeBreakdown | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [ultimaAuditoria, setUltimaAuditoria] = useState<{ criadoEm: string; numFindings: number; modeloUsado: string; totalAuditorias: number } | null>(null);
  // Sinal pra a aba "Auditorias" recarregar o histórico após rodar nova auditoria.
  const [auditoriasReload, setAuditoriasReload] = useState(0);
  // Contagem do backlog deste sistema (aFazer + fazendo + alta) — alimenta o
  // badge no tab "Backlog" pra você saber se tem trabalho pendente sem clicar.
  const [backlogCount, setBacklogCount] = useState<{ aFazer: number; fazendo: number; alta: number; total: number } | null>(null);
  // v1.147.0 — resumo da dívida técnica (alimenta badge da aba + widget compacto).
  const [dividaResumo, setDividaResumo] = useState<{ total: number; debts: number; todos: number; fixmes: number; hacks: number; alta: number } | null>(null);
  // Drawer full-screen do Kanban — espaço apertado dentro da tab não dá conta
  const [backlogDrawerOpen, setBacklogDrawerOpen] = useState(false);
  // Aba ativa controlada — permite que clicar num fator da Saúde leve direto
  // pra aba que resolve aquele item (Custos, Riscos, Pulsos).
  const [activeTab, setActiveTab] = useState('recursos');
  const tabsRef = React.useRef<HTMLDivElement>(null);
  // Sinal pra forçar o checklist de graduação a recarregar após mudanças.
  const [graduacaoReload, setGraduacaoReload] = useState(0);

  const irParaAba = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const carregarUltimaAuditoria = () => {
    callServer<ServerResult>('getUltimaAuditoria', sistemaId)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as { criadoEm: string; numFindings: number; modeloUsado: string; totalAuditorias?: number };
          setUltimaAuditoria({ criadoEm: d.criadoEm, numFindings: d.numFindings, modeloUsado: d.modeloUsado, totalAuditorias: d.totalAuditorias || 0 });
        } else { setUltimaAuditoria(null); }
      })
      .catch(() => { /* preview */ });
    setAuditoriasReload((n) => n + 1);
  };

  const carregarBacklogCount = () => {
    callServer<ServerResult>('getBacklogSumario')
      .then((r) => {
        if (r.ok && r.data) {
          const tudo = r.data as Record<string, { aFazer: number; fazendo: number; alta: number; total: number }>;
          setBacklogCount(tudo[sistemaId] || null);
        }
      })
      .catch(() => { /* preview */ });
  };

  // Resumo cheap pro badge da aba Dívida. Lê só os ATIVOS — não chama GitHub
  // (o scan real só roda quando o user abre a aba).
  const carregarDividaResumo = () => {
    callServer<ServerResult>('getDebitosResumo', sistemaId)
      .then((r) => {
        if (r.ok && r.data) setDividaResumo(r.data as { total: number; debts: number; todos: number; fixmes: number; hacks: number; alta: number });
      })
      .catch(() => { /* preview */ });
  };

  useEffect(() => {
    if (sistemaId) {
      carregarUltimaAuditoria();
      carregarBacklogCount();
      carregarDividaResumo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId]);

  const recalcularSaude = async () => {
    setRecalculando(true);
    try {
      const r = await callServer<ServerResult>('atualizarSaudeReal', sistemaId);
      if (r.ok && r.data) {
        const d = r.data as SaudeBreakdown;
        setSaude(d);
        if (sistema) setSistema({ ...sistema, scoreSaude: d.score });
        message.success(`Saúde recalculada: ${d.score === 0 ? 'não avaliado' : d.score + '%'}`);
      } else {
        message.error(r.error || 'Erro');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setRecalculando(false);
    }
  };

  // Recalcula E persiste o score sempre que abre o sistema — assim o número
  // fica sempre fresco sem depender do botão, e as listas (Bancada/Dashboard)
  // refletem o valor atual automaticamente.
  useEffect(() => {
    if (!sistemaId) return;
    callServer<ServerResult>('atualizarSaudeReal', sistemaId)
      .then((r) => {
        if (r.ok && r.data) {
          const d = r.data as SaudeBreakdown;
          setSaude(d);
          setSistema((s) => (s ? { ...s, scoreSaude: d.score } : s));
        }
      })
      .catch(() => { /* preview local */ });
  }, [sistemaId]);

  useEffect(() => {
    setLoading(true);
    callServer<ServerResponse<Sistema>>('getSistemaById', sistemaId)
      .then((sRes) => {
        if (sRes.ok && sRes.data) setSistema(sRes.data);
        else setError(sRes.error || 'Sistema não encontrado');
      })
      .catch(() => { setSistema(MOCK_SISTEMA); })
      .finally(() => setLoading(false));
  }, [sistemaId]);

  const handleSyncGAS = async () => {
    setSyncing(true);
    try {
      const res = await callServer<ServerResponse<{ atualizado: boolean; sistema: Sistema }>>('syncGASMetadata', sistemaId);
      if (res.ok && res.data) {
        if (res.data.atualizado) {
          setSistema(res.data.sistema);
          message.success('Sincronizado: nome/URL atualizados.');
        } else {
          message.info('Tudo em dia — nada mudou no GAS.');
        }
      } else {
        message.error(res.error || 'Erro ao sincronizar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (error || !sistema) return <Alert type="error" message={error || 'Erro'} showIcon style={{ margin: 24 }} />;

  const tabItems = [
    {
      key: 'recursos',
      label: <TabLabel emoji={<Plug size={14} strokeWidth={1.7} />} label="Recursos" />,
      children: (
        <TabBody titulo="Recursos & integrações" hint="APIs, serviços externos, dependências, credenciais e chaves usadas por este sistema. Registre tudo que tem ID/URL/token pra mapear sua superfície de risco.">
          <RecursosPanel sistemaId={sistemaId} />
        </TabBody>
      ),
    },
    {
      key: 'auditorias',
      label: (
        <TabLabel
          emoji={<History size={14} strokeWidth={1.7} />}
          label="Auditorias"
          badge={ultimaAuditoria && ultimaAuditoria.totalAuditorias > 0
            ? { numero: ultimaAuditoria.totalAuditorias }
            : undefined}
        />
      ),
      children: (
        <TabBody titulo="Histórico de auditorias Forja IA" hint="Linha do tempo de todas as auditorias que você rodou neste sistema — evolução do score ao longo do tempo. Clique numa rodada pra reabrir os achados daquela auditoria (problema, evidência, solução e prompt).">
          <AuditoriasTab
            sistemaId={sistemaId}
            sistemaNome={sistema.nome}
            onAbrirAuditoria={() => setAuditOpen(true)}
            reloadSignal={auditoriasReload}
          />
        </TabBody>
      ),
    },
    {
      key: 'backlog',
      label: (
        <TabLabel
          emoji={<Layers size={14} strokeWidth={1.7} />}
          label="Backlog"
          badge={backlogCount && (backlogCount.aFazer + backlogCount.fazendo) > 0
            ? { numero: backlogCount.aFazer + backlogCount.fazendo, urgente: backlogCount.alta > 0 }
            : undefined}
        />
      ),
      children: (
        <TabBody titulo="Backlog" hint="Itens a fazer, fazendo, pausados, feitos e cancelados. Abra o Kanban em tela cheia pra gestão completa. Achados da Auditoria Forja IA aterrissam em 'A fazer' — arraste pra 'Fazendo' quando começar e pra 'Feito' quando concluir.">
          <IdeiasFaixa sistemaId={sistemaId} sistemaNome={sistema.nome} onPromovido={carregarBacklogCount} />
          <BacklogTabResumo
            sistemaId={sistemaId}
            sistemaNome={sistema.nome}
            backlogCount={backlogCount}
            onAbrirKanban={() => setBacklogDrawerOpen(true)}
          />
        </TabBody>
      ),
    },
    {
      key: 'divida',
      label: (
        <TabLabel
          emoji={<Bug size={14} strokeWidth={1.7} />}
          label="Dívida"
          badge={dividaResumo && dividaResumo.total > 0
            ? { numero: dividaResumo.total, urgente: dividaResumo.alta > 0 }
            : undefined}
        />
      ),
      children: (
        <TabBody titulo="Dívida técnica" hint="TODO, FIXME, HACK e DEBT(area,sev) detectados no código do repositório. Sincroniza automaticamente quando o repo muda; itens que somem do código fecham sozinhos. Promova pro Backlog quando for hora de pagar.">
          <DividaTecnicaPanel
            sistemaId={sistemaId}
            repoUrl={sistema.repoUrl}
            scriptId={sistema.scriptId}
            onPromovido={() => { carregarBacklogCount(); carregarDividaResumo(); }}
          />
        </TabBody>
      ),
    },
    {
      key: 'decisoes',
      label: <TabLabel emoji={<ClipboardList size={14} strokeWidth={1.7} />} label="Decisões" />,
      children: (
        <TabBody titulo="Histórico de decisões (ADR)" hint="Timeline cronológica do QUE você escolheu e POR QUÊ. Complementa o Backlog acima: aqui é o registro histórico, lá é o que ainda tem que acontecer.">
          <DecisoesPanel sistemaId={sistemaId} />
        </TabBody>
      ),
    },
    {
      key: 'riscos',
      label: <TabLabel emoji={<ShieldAlert size={14} strokeWidth={1.7} />} label="Riscos" />,
      children: (
        <TabBody titulo="Riscos abertos" hint="Vulnerabilidades técnicas, operacionais, de segurança, dependências ou financeiras conhecidas. Use o botão 'Auditar com IA' lá em cima pra a Forja IA descobrir riscos novos pra você.">
          <RiscosPanel sistemaId={sistemaId} onChanged={() => { recalcularSaude(); setGraduacaoReload((n) => n + 1); }} />
        </TabBody>
      ),
    },
    {
      key: 'custos',
      label: <TabLabel emoji={<Receipt size={14} strokeWidth={1.7} />} label="Custos" />,
      children: (
        <TabBody titulo="Custos recorrentes" hint="Hospedagem, APIs, domínios, assinaturas. Tudo que sai da sua conta pra esse sistema ficar de pé.">
          <CustosTab
            sistemaId={sistemaId}
            onChanged={() => { recalcularSaude(); setGraduacaoReload((n) => n + 1); }}
          />
        </TabBody>
      ),
    },
    {
      key: 'pulsos',
      label: <TabLabel emoji={<Activity size={14} strokeWidth={1.7} />} label="Pulsos" />,
      children: (
        <TabBody titulo="Pulsos & timeline" hint="Heartbeat do sistema — deploys, incidentes, marcos, mudanças importantes. O que aconteceu, quando, e quem mexeu.">
          <PulsosPanel sistemaId={sistemaId} />
        </TabBody>
      ),
    },
  ];

  return (
    <div className="forja-view" style={{ padding: '36px 40px', maxWidth: 920, margin: '0 auto', animation: 'forjaFadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
        <Space align="center">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={onBack} style={{ color: t.textSecondary }} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500, fontSize: 26, color: t.text }}>{sistema.nome}</span>
          <StageBadge estagio={sistema.estagio} />
        </Space>
        <Space wrap>
          {(sistema.dominioCustomizado || sistema.urlProd) && (
            <Tooltip title={sistema.dominioCustomizado ? `Abrir domínio próprio (${sistema.dominioCustomizado})` : 'Abrir URL de produção'}>
              <Button
                icon={sistema.dominioCustomizado ? <Globe2 size={15} /> : <ExternalLink size={15} />}
                href={sistema.dominioCustomizado ? `https://${sistema.dominioCustomizado.replace(/^https?:\/\//, '')}` : sistema.urlProd}
                target="_blank"
              />
            </Tooltip>
          )}
          {sistema.repoUrl && (
            <Tooltip title="Abrir repositório">
              <Button icon={<GitBranch size={15} />} href={sistema.repoUrl} target="_blank" />
            </Tooltip>
          )}
          {sistema.scriptId && (
            <>
              <Tooltip title="Abrir projeto no editor do Apps Script">
                <Button icon={<FileCode size={15} />} href={`https://script.google.com/d/${sistema.scriptId}/edit`} target="_blank" />
              </Tooltip>
              <Tooltip title="Reler nome e deploy do GAS (Sincronizar)">
                <Button icon={<RefreshCw size={15} className={syncing ? 'forja-spin' : undefined} />} loading={syncing} onClick={handleSyncGAS} />
              </Tooltip>
            </>
          )}
          <PassaporteModal sistemaId={sistemaId} sistemaNome={sistema.nome} />
          <AuditarButton
            ultima={ultimaAuditoria}
            onClick={() => setAuditOpen(true)}
          />
          <Button type="primary" icon={<Pencil size={15} />} onClick={() => onEdit(sistema.id)}>Editar</Button>
        </Space>
      </div>

      <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: t.textTertiary, display: 'block', marginBottom: 16 }}>#{sistema.codinome}</Text>

      {sistema.proposito && (
        <Paragraph style={{ color: t.textSecondary, fontSize: 15, marginBottom: 24 }}>{sistema.proposito}</Paragraph>
      )}

      <Panel style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" labelStyle={{ color: t.textTertiary }} contentStyle={{ color: t.text }}>
          <Descriptions.Item label="Stack">{sistema.stack || '—'}</Descriptions.Item>
          <Descriptions.Item label="Estágio"><StageBadge estagio={sistema.estagio} /></Descriptions.Item>
          {sistema.dominioCustomizado && (
            <Descriptions.Item label="Domínio próprio" span={2}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Globe2 size={13} color={t.accents.sage} />
                <a href={`https://${sistema.dominioCustomizado.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: t.accents.sage, fontFamily: FONTS.mono }}>{sistema.dominioCustomizado}</a>
              </span>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="URL Produção" span={1}>
            {sistema.urlProd ? <a href={sistema.urlProd} target="_blank" rel="noopener noreferrer" style={{ color: t.accents.blue }}>{sistema.urlProd}</a> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Repositório" span={1}>
            {sistema.repoUrl ? <a href={sistema.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.accents.blue }}>{sistema.repoUrl}</a> : '—'}
          </Descriptions.Item>
          {sistema.scriptId && (
            <Descriptions.Item label="Apps Script" span={2}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12 }}>{sistema.scriptId}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Panel>

      {/* Bloco de Saúde com breakdown */}
      <Panel style={{ marginBottom: 24 }} padding={18}>
        <SaudeBlock
          saude={saude}
          score={sistema.scoreSaude}
          recalcular={recalcularSaude}
          recalculando={recalculando}
          onAuditarIA={() => setAuditOpen(true)}
          onEditar={() => onEdit(sistemaId)}
          onIrPara={irParaAba}
        />
      </Panel>

      {/* v1.147.0 — widget compacto de dívida técnica.
          Só aparece quando há débitos detectados (zero ruído quando código tá limpo). */}
      {dividaResumo && dividaResumo.total > 0 && (
        <DividaWidgetCompacto
          resumo={dividaResumo}
          onAbrir={() => irParaAba('divida')}
        />
      )}

      {sistema.estagio === 'forja' && (
        <GraduacaoChecklist
          sistemaId={sistemaId}
          reloadSignal={graduacaoReload}
          onGraduated={() => {
            setSistema((s) => (s ? { ...s, estagio: 'tempera' } : s));
            recalcularSaude();
          }}
        />
      )}

      <Divider style={{ borderColor: t.borderSoft, marginBottom: 8 }} />
      <div ref={tabsRef}>
        <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      <AuditoriaDrawer
        sistemaId={sistemaId}
        sistemaNome={sistema.nome}
        repoUrl={sistema.repoUrl}
        scriptId={sistema.scriptId}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        onAuditoriaAtualizada={carregarUltimaAuditoria}
        onSaudeRecalculada={(novoScore) => {
          setSistema((s) => s ? { ...s, scoreSaude: novoScore } : s);
          // recarrega o breakdown
          callServer<ServerResult>('calcularSaudeReal', sistemaId)
            .then((r) => { if (r.ok && r.data) setSaude(r.data as SaudeBreakdown); })
            .catch(() => { /* segue */ });
        }}
      />

      <BacklogDrawer
        sistemaId={sistemaId}
        sistemaNome={sistema.nome}
        open={backlogDrawerOpen}
        onClose={() => {
          setBacklogDrawerOpen(false);
          carregarBacklogCount(); // atualiza badge ao fechar
        }}
      />
    </div>
  );
}

// Resumo inline da tab Backlog: mostra contagens + CTA pra abrir Kanban
// completo no Drawer. Mantém a tab limpa em vez de espremer 5 colunas
// num espaço estreito.
interface BacklogTabResumoProps {
  sistemaId: string;
  sistemaNome: string;
  backlogCount: { aFazer: number; fazendo: number; alta: number; total: number } | null;
  onAbrirKanban: () => void;
}

function BacklogTabResumo({ sistemaNome, backlogCount, onAbrirKanban }: BacklogTabResumoProps): React.ReactElement {
  const t = useTokens();
  const aFazer = backlogCount?.aFazer || 0;
  const fazendo = backlogCount?.fazendo || 0;
  const alta = backlogCount?.alta || 0;
  const total = aFazer + fazendo;
  const temAlta = alta > 0;

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        boxShadow: t.shadowSoft,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${t.accents.peach}33, ${t.accents.peach}0c)`,
            border: `1px solid ${t.accents.peach}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Layers size={26} color={t.accents.peach} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 17, fontWeight: 500, color: t.text }}>
            Backlog do {sistemaNome}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, marginTop: 2, lineHeight: 1.5 }}>
            {total === 0
              ? 'Nenhum trabalho pendente. Rode uma auditoria pra capturar achados.'
              : `${total} item(s) abertos${temAlta ? ` · ${alta} de prioridade alta` : ''}.`}
          </div>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<Layers size={16} />}
          onClick={onAbrirKanban}
          style={{ background: t.accents.peach, borderColor: t.accents.peach }}
        >
          Abrir Kanban
        </Button>
      </div>

      {/* Métricas em mini cards lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <MetricaMini emoji="📥" label="A fazer" valor={aFazer} cor={t.accents.peach} />
        <MetricaMini emoji="🔨" label="Fazendo" valor={fazendo} cor={t.accents.blue} />
        <MetricaMini emoji="🔥" label="Alta prioridade" valor={alta} cor={alta > 0 ? t.accents.rose : t.textTertiary} destaque={alta > 0} />
      </div>

      <div
        style={{
          fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, lineHeight: 1.6,
          padding: '12px 14px', background: t.surfaceMuted, borderRadius: 10,
          border: `1px dashed ${t.borderSoft}`,
        }}
      >
        💡 <strong style={{ color: t.textSecondary }}>Dica:</strong> abra o Kanban em tela cheia pra arrastar itens entre colunas, exportar tudo como prompt pro Cursor/Claude, ou adicionar novos itens manualmente. As Auditorias da Forja IA enviam achados direto pra cá.
      </div>
    </div>
  );
}

function MetricaMini({ emoji, label, valor, cor, destaque }: { emoji: string; label: string; valor: number; cor: string; destaque?: boolean }): React.ReactElement {
  const t = useTokens();
  return (
    <div
      className={destaque ? 'forja-pulse' : undefined}
      style={{
        background: destaque ? `${cor}10` : t.surfaceMuted,
        border: `1px solid ${destaque ? `${cor}55` : t.borderSoft}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: cor, lineHeight: 1 }}>{valor}</div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// Mapeia o nome de um fator de saúde pra uma ação que leva o usuário pra onde
// resolver (editar a ficha, ou abrir a aba certa). Retorna null se não houver
// destino acionável (ex.: alertas, que vivem fora do detalhe).
function acaoDoFator(
  nome: string,
  handlers: { onEditar: () => void; onIrPara: (tab: string) => void },
): { label: string; run: () => void } | null {
  const n = nome.toLowerCase();
  if (n.includes('propósito') || n.includes('proposito') || n.includes('stack') || n.includes('acessível') || n.includes('acessivel') || n.includes('repositório') || n.includes('repositorio')) {
    return { label: 'Editar ficha', run: handlers.onEditar };
  }
  if (n.includes('custo') || n.includes('receita')) {
    return { label: 'Abrir Custos', run: () => handlers.onIrPara('custos') };
  }
  if (n.includes('atividade')) {
    return { label: 'Abrir Pulsos', run: () => handlers.onIrPara('pulsos') };
  }
  if (n.includes('risco')) {
    return { label: 'Abrir Riscos', run: () => handlers.onIrPara('riscos') };
  }
  return null;
}

// Bloco visual de Saúde: barra + score + breakdown clicável (Popover)
function SaudeBlock({
  saude, score, recalcular, recalculando, onAuditarIA, onEditar, onIrPara,
}: {
  saude: SaudeBreakdown | null;
  score: number;
  recalcular: () => void;
  recalculando: boolean;
  onAuditarIA: () => void;
  onEditar: () => void;
  onIrPara: (tab: string) => void;
}): React.ReactElement {
  const t = useTokens();
  const [popOpen, setPopOpen] = useState(false);
  const scoreReal = saude ? saude.score : score;
  const cor = scoreReal === 0 ? t.textTertiary : scoreReal >= 70 ? t.accents.sage : scoreReal >= 40 ? t.accents.peach : t.accents.rose;

  const breakdownContent = saude ? (
    <div style={{ maxWidth: 380 }}>
      <p style={{ fontSize: 11.5, color: t.textTertiary, margin: '0 0 10px', lineHeight: 1.55 }}>
        Score é determinístico (sem IA). Clique num fator pendente pra ir direto onde resolver.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {saude.fatores.map((f, i) => {
          const acao = !f.ok ? acaoDoFator(f.nome, { onEditar, onIrPara }) : null;
          const clicavel = !!acao;
          return (
            <li
              key={i}
              onClick={clicavel ? () => { acao!.run(); setPopOpen(false); } : undefined}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: FONTS.ui, fontSize: 12, color: t.textSecondary,
                padding: '5px 6px', borderRadius: 8, cursor: clicavel ? 'pointer' : 'default',
                transition: 'background 0.12s',
              }}
              onMouseEnter={clicavel ? (e) => { (e.currentTarget as HTMLElement).style.background = t.surfaceMuted; } : undefined}
              onMouseLeave={clicavel ? (e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; } : undefined}
            >
              {f.ok ? <CheckCircle2 size={13} color={t.accents.sage} style={{ marginTop: 2, flexShrink: 0 }} /> : <XCircle size={13} color={t.accents.rose} style={{ marginTop: 2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: t.text }}>{f.nome}</div>
                <div style={{ color: t.textTertiary, fontSize: 11, marginTop: 1 }}>{f.detalhe}</div>
                {clicavel && (
                  <div style={{ color: cor, fontSize: 11, marginTop: 3, fontWeight: 600 }}>{acao!.label} →</div>
                )}
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, flexShrink: 0 }}>{f.pontos}/{f.max}</span>
            </li>
          );
        })}
      </ul>
    </div>
  ) : <span style={{ color: t.textTertiary, fontSize: 12 }}>Carregando…</span>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeartPulse size={17} color={cor} />
          <span style={{ fontFamily: FONTS.ui, fontWeight: 500, color: t.text, fontSize: 14 }}>Saúde</span>
          <Tooltip title="Score de 0 a 100 calculado a partir de sinais reais do sistema. Clique pra ver o breakdown.">
            <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} />
          </Tooltip>
          <Popover content={breakdownContent} title="Como esse score é calculado" trigger="click" placement="bottomLeft" open={popOpen} onOpenChange={setPopOpen}>
            <span
              style={{
                fontFamily: FONTS.display, fontSize: 22, fontWeight: 500, color: cor, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 8,
                background: `${cor}11`, border: `1px dashed ${cor}55`,
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${cor}22`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${cor}11`; }}
            >
              {scoreReal === 0 ? 'Não avaliado' : `${scoreReal}%`}
              <Info size={11} style={{ opacity: 0.7 }} />
            </span>
          </Popover>
          {saude && saude.calculadoEm && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
              calculado {new Date(saude.calculadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <Space size={6}>
          <Tooltip title="Recalcula o score localmente, sem IA. Instantâneo.">
            <Button size="small" icon={<RefreshCw size={13} />} loading={recalculando} onClick={recalcular}>Recalcular</Button>
          </Tooltip>
          <Tooltip title="A Forja IA analisa todos os dados deste sistema e propõe achados com problema, evidência, solução e prompt pronto pra colar no Cursor/Claude.">
            <Button size="small" type="primary" icon={<Wand2 size={13} />} onClick={onAuditarIA} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
              Auditar com IA
            </Button>
          </Tooltip>
        </Space>
      </div>
      {scoreReal > 0 && (
        <Progress percent={scoreReal} showInfo={false} strokeColor={cor} trailColor={t.borderSoft} />
      )}
      {scoreReal === 0 && (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
          Clique em <strong>Auditar com IA</strong> pra a Forja analisar e propor achados, ou em <strong>Recalcular</strong> pra avaliar sem IA.
        </div>
      )}
    </div>
  );
}

// Botão "Auditar com IA" com badge sutil quando já existe auditoria anterior.
function AuditarButton({ ultima, onClick }: { ultima: { criadoEm: string; numFindings: number; modeloUsado: string } | null; onClick: () => void }): React.ReactElement {
  const t = useTokens();
  const temAudit = !!ultima;
  const rel = ultima ? relativoBR(ultima.criadoEm) : '';
  const tooltipMsg = temAudit
    ? `Última auditoria ${rel} · ${ultima.numFindings} achado(s). Abre o resultado salvo — clique em "Nova auditoria" no drawer pra rodar de novo.`
    : 'A Forja IA analisa o sistema, propõe riscos, decisões, oportunidades e gera um backlog .md.';

  return (
    <Tooltip title={tooltipMsg}>
      <Button
        icon={<Wand2 size={15} />}
        onClick={onClick}
        style={{
          borderColor: temAudit ? t.accents.sage : t.accents.peach,
          color: temAudit ? t.accents.sage : t.accents.peach,
          position: 'relative',
        }}
      >
        Auditar com IA
        {temAudit && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontFamily: FONTS.ui,
              background: `${t.accents.sage}1f`,
              color: t.accents.sage,
              padding: '1px 7px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {rel}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}

function relativoBR(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// Label de tab com ícone outline (substitui os emojis).
function TabLabel({ emoji, label, badge }: { emoji: React.ReactNode; label: string; badge?: { numero: number; urgente?: boolean } }): React.ReactElement {
  const t = useTokens();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {emoji}
      {label}
      {badge && (
        <span
          className={badge.urgente ? 'forja-pulse' : undefined}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: badge.urgente ? t.accents.rose : t.accents.peach,
            color: '#fff',
            lineHeight: 1, fontFamily: FONTS.ui,
          }}
        >
          {badge.numero}
        </span>
      )}
    </span>
  );
}

// Corpo da tab com cabeçalho descritivo + info icon.
function TabBody({ titulo, hint, children }: { titulo: string; hint: string; children: React.ReactNode }): React.ReactElement {
  const t = useTokens();
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{titulo}</span>
        <Tooltip title={hint} placement="bottomLeft">
          <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} />
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

// Widget compacto de dívida técnica — aparece no resumo do Sistema só quando
// há débitos detectados. Clique abre a aba "Dívida" com escopo já filtrado.
function DividaWidgetCompacto({ resumo, onAbrir }: {
  resumo: { total: number; debts: number; todos: number; fixmes: number; hacks: number; alta: number };
  onAbrir: () => void;
}): React.ReactElement {
  const t = useTokens();
  return (
    <div
      onClick={onAbrir}
      role="button"
      style={{
        marginBottom: 24,
        background: t.surface,
        border: `1px solid ${resumo.alta > 0 ? `${t.accents.rose}55` : t.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: t.shadowSoft,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = t.shadowSoft; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: resumo.alta > 0 ? `${t.accents.rose}1f` : `${t.accents.peach}1f`,
        color: resumo.alta > 0 ? t.accents.rose : t.accents.peach,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Bug size={18} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{resumo.total}</span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
            {resumo.total === 1 ? 'débito técnico ativo' : 'débitos técnicos ativos'}
          </span>
          {resumo.alta > 0 && (
            <span style={{ fontFamily: FONTS.ui, fontSize: 11, fontWeight: 700, color: t.accents.rose, padding: '2px 8px', background: `${t.accents.rose}1a`, borderRadius: 999 }}>
              {resumo.alta} alta
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {resumo.debts > 0 && <span>{resumo.debts} estruturado{resumo.debts > 1 ? 's' : ''} (DEBT)</span>}
          {resumo.todos > 0 && <span>{resumo.todos} TODO</span>}
          {resumo.fixmes > 0 && <span>{resumo.fixmes} FIXME</span>}
          {resumo.hacks > 0 && <span>{resumo.hacks} HACK</span>}
        </div>
      </div>
      <Bug size={14} color={t.textTertiary} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, flexShrink: 0 }}>Abrir aba</span>
    </div>
  );
}
