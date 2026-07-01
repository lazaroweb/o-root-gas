import React, { useState, useEffect } from 'react';
import { Drawer, Button, Spin, Empty, App as AntApp, Tag, Popover, Alert, Divider, Segmented, Input, Popconfirm, Progress, Skeleton, Tooltip } from 'antd';
import {
  Wand2, RefreshCw, CheckCircle2, XCircle, Sparkles, FileSearch, Info, Database, Download, Clock, History, Code2, GitBranch, FileCode2, ExternalLink, ListChecks, Trash2, Link2, Copy, Check, Rocket, ArrowUp, ArrowDown, PartyPopper, AlertCircle, Minus, ClipboardCheck, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useTokens } from '../themeContext';
import { FONTS } from '../theme';
import callServer from '../gas-client';
import type { ServerResult, SaudeBreakdown, AuditResult, UltimaAuditoriaInfo, StatusAuditoriaCodigo, HistoricoAuditoriaItem } from '../types';
import FindingCard from './FindingCard';

interface AuditoriaDrawerProps {
  sistemaId: string;
  sistemaNome: string;
  repoUrl?: string;
  scriptId?: string;
  open: boolean;
  onClose: () => void;
  onSaudeRecalculada?: (novoScore: number) => void;
  onAuditoriaAtualizada?: () => void;
}

type AuditModo = 'completa' | 'codigo' | 'governanca';

// "há 2h", "há 3 dias", "agora" — pequeno helper humanizado
function relTempo(iso: string): string {
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

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

const MODO_HINT: Record<AuditModo, string> = {
  completa: 'Governança + código do repositório.',
  codigo: 'Só o código real do repositório.',
  governanca: 'Só metadados (custos, riscos, decisões).',
};

export default function AuditoriaDrawer({ sistemaId, sistemaNome, repoUrl, scriptId, open, onClose, onSaudeRecalculada, onAuditoriaAtualizada }: AuditoriaDrawerProps): React.ReactElement {
  const t = useTokens();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [loadingUltima, setLoadingUltima] = useState(false);
  const [resultado, setResultado] = useState<AuditResult | null>(null);
  const [ultima, setUltima] = useState<UltimaAuditoriaInfo | null>(null);
  const [verificouUltima, setVerificouUltima] = useState(false);

  // repoUrl pode ser conectado aqui mesmo (sem ir na ficha). Espelha o prop e
  // sincroniza quando o drawer abre pra outro sistema.
  const [repoUrlState, setRepoUrlState] = useState(String(repoUrl || ''));
  useEffect(() => { setRepoUrlState(String(repoUrl || '')); }, [repoUrl]);
  const repoAtual = String(repoUrlState || '').trim();

  // Fonte de código disponível define o modo padrão e se o seletor aparece.
  const temFonteCodigo = !!(repoAtual || String(scriptId || '').trim());
  const [modo, setModo] = useState<AuditModo>(temFonteCodigo ? 'completa' : 'governanca');
  useEffect(() => { setModo(temFonteCodigo ? 'completa' : 'governanca'); }, [temFonteCodigo]);

  // Conectar repositório (UI), limpeza de histórico (teste do zero).
  const [repoInput, setRepoInput] = useState('');
  const [conectando, setConectando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [copiadoPrompt, setCopiadoPrompt] = useState(false);

  // Progresso da auditoria EM LOTES (quando o diff é grande e roda batch a batch).
  const [batchProg, setBatchProg] = useState<{ feito: number; total: number } | null>(null);

  // Cronômetro ao vivo durante a auditoria — feedback de progresso e alerta de
  // que estamos chegando perto do limite de 6min do Apps Script.
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!loading) { setElapsedMs(0); return; }
    const inicio = Date.now();
    setElapsedMs(0);
    const iv = setInterval(() => setElapsedMs(Date.now() - inicio), 250);
    return () => clearInterval(iv);
  }, [loading]);

  // Status de frescor (Fase 2): o repo mudou desde a última auditoria?
  const [status, setStatus] = useState<StatusAuditoriaCodigo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [mostrarMudados, setMostrarMudados] = useState(false);

  // Histórico de auditorias (linha do tempo + evolução do score).
  const [historico, setHistorico] = useState<HistoricoAuditoriaItem[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const carregarHistorico = () => {
    setLoadingHistorico(true);
    callServer<ServerResult>('getHistoricoAuditorias', sistemaId)
      .then((r) => { if (r.ok && r.data) setHistorico(r.data as HistoricoAuditoriaItem[]); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoadingHistorico(false));
  };

  const carregarStatus = () => {
    if (!temFonteCodigo) { setStatus(null); return; }
    setLoadingStatus(true);
    callServer<ServerResult>('getStatusAuditoriaCodigo', sistemaId)
      .then((r) => { if (r.ok && r.data) setStatus(r.data as StatusAuditoriaCodigo); })
      .catch(() => { /* preview local */ })
      .finally(() => setLoadingStatus(false));
  };

  // Aplica um resultado de auditoria (vindo do fluxo inline OU do em lotes) na UI.
  const aplicarResultado = (novo: AuditResult) => {
    setResultado(novo);
    setUltima(null); // a "ultima" agora é a recém-rodada
    if (novo.semMudanca) {
      message.info('Sem mudanças desde a última auditoria — mostrando o resultado salvo.');
    }
    if (novo.fechadosAuto && novo.fechadosAuto.length > 0) {
      const n = novo.fechadosAuto.length;
      message.success(`${n} item(ns) do backlog fechado(s) automaticamente — o diff resolveu o achado.`);
    }
    if (onAuditoriaAtualizada) onAuditoriaAtualizada();
    carregarStatus(); // HEAD agora == commit auditado → banner fica "em dia"
    carregarHistorico();
  };

  const auditar = async (forcar?: boolean) => {
    setLoading(true);
    setBatchProg(null);
    try {
      // 1) Tenta o caminho EM LOTES resumível (diff grande, várias mudanças).
      //    O servidor decide: se não for o caso multi-batch, devolve {tipo:'inline'}
      //    e caímos no fluxo normal abaixo. Cada batch é uma chamada curta, então
      //    não estoura o limite de 6 min do Apps Script.
      try {
        const ini = await callServer<ServerResult>('auditarBatchIniciar', sistemaId, modo, !!forcar);
        const d = (ini && ini.ok) ? (ini.data as { tipo?: string; jobId?: string; totalBatches?: number } | undefined) : undefined;
        if (d && d.tipo === 'batch' && d.jobId && d.totalBatches) {
          const jobId = d.jobId;
          const total = d.totalBatches;
          setBatchProg({ feito: 0, total });
          for (let i = 0; i < total; i++) {
            // 2 tentativas por batch: um hiccup de rede não derruba o job inteiro.
            let okBatch = false;
            for (let tent = 0; tent < 2 && !okBatch; tent++) {
              try {
                const rb = await callServer<ServerResult>('auditarBatchProcessar', jobId, i);
                okBatch = !!(rb && rb.ok);
              } catch { okBatch = false; }
            }
            setBatchProg({ feito: i + 1, total });
          }
          const fin = await callServer<ServerResult>('auditarBatchFinalizar', jobId);
          if (fin.ok && fin.data) aplicarResultado(fin.data as AuditResult);
          else message.error(fin.error || 'Erro ao finalizar a auditoria em lotes');
          return;
        }
      } catch {
        // Falha ao preparar o job → segue pro caminho inline (não bloqueia).
      }

      // 2) Caminho inline (completa, incremental de 1 batch, governança, sem mudança).
      const r = await callServer<ServerResult>('acaoIAAuditarSistema', sistemaId, modo, !!forcar);
      if (r.ok && r.data) {
        aplicarResultado(r.data as AuditResult);
      } else {
        message.error(r.error || 'Erro ao auditar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
      setBatchProg(null);
    }
  };

  // Conecta o repoUrl na ficha do sistema (server) e já roda a auditoria completa,
  // que passa a ler o código via GitHub.
  const conectarRepo = async () => {
    const url = repoInput.trim();
    if (!/github\.com\/[^/]+\/[^/]+/.test(url) && !/^[^/]+\/[^/]+$/.test(url)) {
      message.warning('Use uma URL do tipo https://github.com/owner/repo');
      return;
    }
    setConectando(true);
    try {
      const r = await callServer<ServerResult>('updateSistema', sistemaId, { repoUrl: url });
      if (r.ok) {
        setRepoUrlState(url);
        setRepoInput('');
        setModo('completa');
        message.success('Repositório conectado — auditando o código…');
        if (onAuditoriaAtualizada) onAuditoriaAtualizada();
        reset();
        void auditar(true);
      } else {
        message.error(r.error || 'Não consegui conectar o repositório');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setConectando(false);
    }
  };

  // Apaga todo o histórico de auditorias do sistema (testar do zero).
  const limparAuditorias = async () => {
    setLimpando(true);
    try {
      const r = await callServer<ServerResult>('limparAuditoriasSistema', sistemaId);
      if (r.ok) {
        const n = (r.data as { removidas?: number } | undefined)?.removidas || 0;
        setResultado(null);
        setUltima(null);
        setVerificouUltima(true);
        setMostrarMudados(false);
        if (onAuditoriaAtualizada) onAuditoriaAtualizada();
        carregarStatus();
        setHistorico([]);
        setMostrarHistorico(false);
        message.success(`Histórico limpo (${n} auditoria${n === 1 ? '' : 's'} removida${n === 1 ? '' : 's'}).`);
      } else {
        message.error(r.error || 'Erro ao limpar');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLimpando(false);
    }
  };

  // Ao abrir, primeiro tenta carregar a última auditoria salva. Só roda nova se
  // o usuário pedir explicitamente. Economiza tokens e respeita o tempo do user.
  useEffect(() => {
    if (!open) return;
    if (resultado || ultima || verificouUltima) return;
    setLoadingUltima(true);
    callServer<ServerResult>('getUltimaAuditoria', sistemaId)
      .then((r) => {
        setVerificouUltima(true);
        if (r.ok && r.data) {
          setUltima(r.data as UltimaAuditoriaInfo);
        }
      })
      .catch(() => { /* preview local sem servidor */ })
      .finally(() => setLoadingUltima(false));
    carregarStatus();
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Quando o drawer fecha, esquecemos o estado pra próxima abertura recarregar
  useEffect(() => {
    if (!open) {
      setResultado(null);
      setUltima(null);
      setVerificouUltima(false);
      setStatus(null);
      setMostrarMudados(false);
      setHistorico([]);
      setMostrarHistorico(false);
    }
  }, [open]);

  // Adapta UltimaAuditoriaInfo (sem texto livre) pra formato AuditResult
  const ultimaComoResultado: AuditResult | null = ultima ? {
    id: ultima.id,
    texto: ultima.texto || '',
    payload: ultima.payload,
    fontes: ultima.fontes || { custos: 0, decisoes: 0, riscos: 0, alertas: 0, timeline: 0, oportunidades: 0, temProposito: false, temStack: false, temUrl: false, temRepo: false },
    saudeAtual: ultima.saudeAtual,
    modeloUsado: ultima.modeloUsado,
    duracaoMs: ultima.duracaoMs,
    criadoEm: ultima.criadoEm,
    registros: ultima.registros || {},
  } : null;

  const dadosExibidos = resultado || ultimaComoResultado;
  const auditoriaIdAtual = dadosExibidos?.id || '';
  const registrosAtuais = dadosExibidos?.registros || {};

  const recalcularSaude = async () => {
    try {
      const r = await callServer<ServerResult>('atualizarSaudeReal', sistemaId);
      if (r.ok && r.data) {
        const d = r.data as SaudeBreakdown;
        setResultado((cur) => cur ? { ...cur, saudeAtual: d } : cur);
        if (onSaudeRecalculada) onSaudeRecalculada(d.score);
        message.success(`Saúde atualizada: ${d.score === 0 ? 'não avaliado' : d.score + '%'}`);
      }
    } catch { /* segue */ }
  };

  // Quando o usuário registra um achado, atualizamos o estado local pra
  // o card já refletir o "Já registrado" sem precisar refetch.
  const aoRegistrar = (info: { findingId: string; tipo: string; idCriado: string }) => {
    const novoRegistro = { tipo: info.tipo.replace('registrar_', ''), idCriado: info.idCriado, registradoEm: new Date().toISOString() };
    if (resultado) {
      setResultado({ ...resultado, registros: { ...(resultado.registros || {}), [info.findingId]: novoRegistro } });
    } else if (ultima) {
      setUltima({ ...ultima, registros: { ...(ultima.registros || {}), [info.findingId]: novoRegistro } });
    }
    void recalcularSaude();
  };

  const reset = () => { setResultado(null); };

  const baixarRelatorioCompleto = () => {
    if (!dadosExibidos || !dadosExibidos.payload) return;
    const p = dadosExibidos.payload;
    const linhas: string[] = [];
    linhas.push(`# Auditoria — ${sistemaNome}`);
    linhas.push(`\n_Gerada pela Forja IA · ${new Date().toLocaleString('pt-BR')}_\n`);
    linhas.push('\n## Estado geral\n\n' + p.estadoGeral);
    if (p.oQueEmpolga.length > 0) {
      linhas.push('\n## O que empolga\n');
      for (const b of p.oQueEmpolga) linhas.push('- ' + b);
    }
    linhas.push('\n## Próximos passos estratégicos\n\n' + p.proximosPassos);
    linhas.push('\n## Achados detalhados\n');
    for (const f of p.findings) {
      linhas.push(`\n### [${f.severidade.toUpperCase()}] ${f.titulo}`);
      linhas.push(`_Área: ${f.area}_\n`);
      linhas.push(`**Problema:** ${f.problema}\n`);
      linhas.push(`**Evidência:** ${f.evidencia}\n`);
      linhas.push(`**Solução:** ${f.solucao}\n`);
      if (f.prompt) linhas.push('\n**Prompt pronto:**\n\n```\n' + f.prompt + '\n```\n');
    }
    downloadFile(`auditoria-${slugify(sistemaNome)}-${new Date().toISOString().slice(0, 10)}.md`, linhas.join('\n'), 'text/markdown');
    message.success('Auditoria completa baixada como .md');
  };

  // Prompt MESTRE: um .md único, pronto pra colar numa IA (Cursor/Claude) como
  // ordem de serviço — com TODAS as instruções pra implementar os ajustes.
  const gerarPromptMaster = (): string => {
    if (!dadosExibidos || !dadosExibidos.payload) return '';
    const p = dadosExibidos.payload;
    const rank = (s: string) => (s === 'alta' ? 0 : s === 'media' ? 1 : 2);
    const ordenados = [...p.findings].sort((a, b) => rank(a.severidade) - rank(b.severidade));
    const score = dadosExibidos.saudeAtual ? (dadosExibidos.saudeAtual as SaudeBreakdown).score : 0;
    const altas = p.findings.filter((f) => f.severidade === 'alta').length;
    const medias = p.findings.filter((f) => f.severidade === 'media').length;
    const baixas = p.findings.filter((f) => f.severidade === 'baixa').length;
    const repo = String(repoUrlState || '').trim();
    const commit = dadosExibidos.fontes?.commitSha || '';
    const L: string[] = [];
    L.push(`# Plano de ajustes — ${sistemaNome}`);
    L.push(`\n> Gerado pela Auditoria Forja · ${new Date().toLocaleString('pt-BR')}`);
    L.push(`> Score de saúde: ${score === 0 ? 'não avaliado' : score + '%'} · ${p.findings.length} achados (${altas} alta · ${medias} média · ${baixas} baixa)`);
    if (repo) L.push(`> Repositório: ${repo}${commit ? ` (commit ${commit})` : ''}`);
    L.push('\n---\n');
    L.push('## Instruções para a IA — IMPLEMENTE NO CÓDIGO\n');
    L.push('Você é um engenheiro de software sênior. Esta é uma **ORDEM DE SERVIÇO**, não um pedido de análise. Sua tarefa é **escrever código real** que corrige os achados abaixo, na ordem de prioridade (alta → baixa).\n');
    L.push('### Regras de execução (não negociáveis):\n');
    L.push('1. **O entregável é CÓDIGO**, não documentação. Para cada achado, edite os arquivos de código e faça um commit.');
    L.push('2. **Cada correção = 1 commit pequeno e atômico** com prefixo `fix:`, `feat:` ou `refactor:`. Mensagem clara dizendo o que muda e por quê. **NÃO use prefixo `docs:`**.');
    L.push('3. **NÃO crie arquivos `.md` consolidando ou analisando** os achados. Sem `AUDITORIA_REALIZADA.md`, sem `ANALISE.md`, sem cross-references. Se quiser registrar contexto, faça no corpo do commit ou em comentário inline do código.');
    L.push('4. **Se um achado for falso positivo na sua visão**, NÃO faça commit — me cite na conversa o ID/título e a justificativa, eu confirmo antes de descartar.');
    L.push('5. **Ao terminar**, faça `git push` e me avise: "implementei N achados, push feito". Aí a Forja IA re-audita e mede o que mudou de verdade.');
    L.push('\n### Fluxo por achado:\n');
    L.push('1. Entenda o **problema**.');
    L.push('2. Confirme a **evidência** no código (abra o arquivo citado).');
    L.push('3. Aplique a **solução** proposta — adapte se fizer sentido pro contexto real.');
    L.push('4. Adicione testes quando fizer sentido pra prevenir regressão.');
    L.push('5. `git commit -m "fix: ..."` com mensagem clara. Sem `docs:`.\n');
    L.push('Não quebre funcionalidades existentes.\n');
    L.push('\n## Estado geral\n\n' + p.estadoGeral + '\n');
    L.push('\n## Achados a corrigir (prioridade alta → baixa)\n');
    ordenados.forEach((f, i) => {
      L.push(`\n### ${i + 1}. [${f.severidade.toUpperCase()}] ${f.titulo}`);
      L.push(`_Área: ${f.area}${f.origem ? ` · ${f.origem}` : ''}_\n`);
      L.push(`**Problema:** ${f.problema}\n`);
      L.push(`**Evidência:** ${f.evidencia}\n`);
      L.push(`**Solução proposta:** ${f.solucao}\n`);
      if (f.prompt) L.push(`**Instrução detalhada:**\n\n${f.prompt}\n`);
    });
    if (p.resolvidos && p.resolvidos.length > 0) {
      L.push('\n## Já resolvidos (não precisa mexer)\n');
      p.resolvidos.forEach((r) => L.push(`- ${r}`));
    }
    L.push('\n## Ordem de execução sugerida\n');
    ordenados.forEach((f, i) => L.push(`${i + 1}. [${f.severidade.toUpperCase()}] ${f.titulo}`));
    if (p.proximosPassos) L.push('\n## Próximos passos estratégicos\n\n' + p.proximosPassos + '\n');
    L.push('\n---\n_Quando terminar, rode a auditoria de novo na Forja pra ver o que foi resolvido._\n');
    return L.join('\n');
  };

  const baixarPromptMaster = () => {
    const md = gerarPromptMaster();
    if (!md) return;
    downloadFile(`ajustes-${slugify(sistemaNome)}-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown');
    message.success('Prompt de ajustes baixado (.md)');
  };

  const copiarPromptMaster = async () => {
    const md = gerarPromptMaster();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopiadoPrompt(true);
      message.success('Prompt copiado — cole no Cursor/Claude.');
      setTimeout(() => setCopiadoPrompt(false), 2200);
    } catch {
      message.error('Não consegui copiar — use o botão de baixar.');
    }
  };

  // .md de "Auditoria realizada" — relatório oficial de baixa que o usuário leva
  // pra IA que executou as correções (Cursor/Claude), pra ela:
  //   1) marcar como concluídos os achados que foram resolvidos
  //   2) manter em aberto os que persistem
  //   3) adicionar ao backlog os novos detectados
  // Fecha o ciclo Forja → IA → Forja → IA sem ambiguidade.
  const gerarRelatorioBaixa = (): string => {
    if (!dadosExibidos || !dadosExibidos.payload) return '';
    const p = dadosExibidos.payload;
    const score = dadosExibidos.saudeAtual ? (dadosExibidos.saudeAtual as SaudeBreakdown).score : 0;
    const anterior = historico.length >= 2 ? historico[1] : null;
    const ehPrimeira = !anterior;
    const scoreDelta = anterior ? score - anterior.scoreNoMomento : 0;
    const sinalDelta = scoreDelta > 0 ? '+' : '';
    const setaDelta = scoreDelta > 0 ? '↑' : scoreDelta < 0 ? '↓' : '→';

    const resolvidos = p.resolvidos || [];
    const novos = p.findings.filter((f) => f.origem === 'novo');
    const persistem = p.findings.filter((f) => f.origem === 'persiste');
    // Se origem não vier (auditoria do zero ou modelo antigo), trata tudo como "atual"
    // — separamos só em "novos vs persistem" quando o backend marcou.
    const semOrigem = !ehPrimeira && novos.length === 0 && persistem.length === 0 && p.findings.length > 0;

    const commit = dadosExibidos.fontes?.commitSha || '';
    const commitBase = dadosExibidos.fontes?.baseCommit || '';
    const repo = String(repoUrlState || '').trim();
    const incremental = !!dadosExibidos.fontes?.incremental;
    const truncado = !!dadosExibidos.fontes?.codigoTruncado;
    const arquivos = dadosExibidos.fontes?.arquivosLidos || 0;
    const bytes = dadosExibidos.fontes?.bytesCodigo || 0;

    const L: string[] = [];
    L.push(`# Auditoria realizada — RELATÓRIO de baixa (não é ordem de serviço)`);
    L.push(`\n_Gerado pela Forja IA · ${new Date().toLocaleString('pt-BR')}_\n`);
    L.push(`> **⚠ LEIA PRIMEIRO — Este arquivo NÃO é uma ordem para escrever código.**`);
    L.push(`> Este é um **relatório de status** da Forja IA pra você atualizar o seu`);
    L.push(`> planning/backlog interno (anotações, TODOs, mensagens). **Não crie`);
    L.push(`> arquivos .md, não escreva código, não faça commits a partir deste`);
    L.push(`> documento.** Se houver código pra mudar, use o \`prompt-de-ajustes.md\``);
    L.push(`> (que é a ordem de serviço de verdade).\n`);

    // Bloco metadados (cabeçalho técnico)
    L.push('## Contexto');
    L.push(`- **Origem da solicitação:** Forja IA (auditoria automatizada)`);
    L.push(`- **Sistema:** ${sistemaNome}`);
    L.push(`- **Tipo de auditoria:** ${ehPrimeira ? 'baseline (primeira)' : incremental ? 'incremental (diff)' : 'completa (re-leitura do repo)'}`);
    if (repo) L.push(`- **Repositório:** ${repo}`);
    if (commitBase && commit) L.push(`- **Range auditado:** \`${commitBase}\` → \`${commit}\``);
    else if (commit) L.push(`- **Commit auditado:** \`${commit}\``);
    {
      const batches = dadosExibidos.fontes?.batchesUsados || 1;
      const ignorados = dadosExibidos.fontes?.arquivosIgnorados || [];
      const splitted = dadosExibidos.fontes?.arquivosSplitted || [];
      const partes: string[] = [];
      if (arquivos > 0) partes.push(`${arquivos} arquivo(s)${bytes ? ` · ~${Math.round(bytes / 1024)}KB` : ''}`);
      if (batches > 1) partes.push(`auditado em ${batches} batches`);
      if (splitted.length > 0) partes.push(`${splitted.length} arquivo(s) divididos em janelas`);
      if (ignorados.length > 0) partes.push(`**${ignorados.length} arquivo(s) ignorados pelo cap global** (${ignorados.slice(0, 3).join(', ')}${ignorados.length > 3 ? `, +${ignorados.length - 3}` : ''})`);
      else if (truncado && batches === 1) partes.push('diff truncado (auditoria antiga — re-audite p/ chunking automático)');
      if (partes.length > 0) L.push(`- **Volume lido pela IA:** ${partes.join(' · ')}`);
    }
    L.push(`- **Score de saúde:** ${score === 0 ? 'não avaliado' : score + '/100'}${anterior ? ` (${setaDelta} ${sinalDelta}${scoreDelta} pts vs. anterior de ${anterior.scoreNoMomento})` : ''}`);
    L.push('');

    // Instruções diretivas
    L.push('## Para você, IA — APENAS atualize o planning/backlog\n');
    L.push('**Não escreva código.** Não crie arquivos. **Não faça commits.** Sua ');
    L.push('única tarefa neste documento é refletir o status abaixo no seu ');
    L.push('planning interno (cursor TODOs, notas da sessão, mensagens de ');
    L.push('contexto). Se houver código pra mudar, isso é trabalho separado ');
    L.push('disparado pelo `prompt-de-ajustes.md` — não daqui.\n');
    if (ehPrimeira) {
      L.push('Esta é a **primeira auditoria** deste sistema. Não há backlog anterior pra atualizar — você pode iniciar um novo planning interno (em sua memória de contexto / TODOs) com os itens listados em **Achados detectados** abaixo. Não invente itens fora dessa lista.\n');
    } else {
      L.push('Eu (humano) rodei o `prompt-de-ajustes.md` que a Forja gerou antes, implementei as mudanças, e a Forja IA re-auditou o resultado. Abaixo está a **baixa oficial**. Apenas atualize seu planning seguindo estas regras:\n');
      L.push('1. **Marque como concluído** no SEU planning todo item listado em "Resolvidos pela Forja IA" — o diff confirmou a correção. **NÃO faça commit pra marcar isso** — só atualiza seu planning interno.');
      L.push('2. **Mantenha em aberto** no SEU planning os itens em "Persistem em aberto" — o esforço atual não fechou.');
      L.push('3. **Adicione ao SEU planning** os itens em "Novos detectados" — problemas que surgiram nesta rodada (regressões ou descobertas).');
      L.push('4. **Não invente itens fora desta lista.** Se um item do seu backlog interno não aparece aqui, mantenha como estava.');
      L.push('5. Se um item esperado **não foi marcado como resolvido** mesmo após o seu fix, é provável que: (a) o fix foi parcial, (b) a IA Forja foi conservadora demais, ou (c) o arquivo ficou na lista de "arquivos ignorados pelo cap global" (releia o cabeçalho desta auditoria). Verifique manualmente antes de fechar.');
      L.push('6. **Se você concluir o trabalho com base SÓ neste arquivo (criando `.md`, escrevendo análise, fazendo commits `docs:`) → você fez ERRADO.** Este arquivo é só relatório — não disparou trabalho novo.');
      L.push('');
    }

    // Saldo numérico — visão de uma olhada
    L.push('## Saldo desta rodada\n');
    L.push('| Métrica | Valor |');
    L.push('|---|---|');
    if (anterior) L.push(`| Achados na auditoria anterior | ${anterior.numFindings} |`);
    L.push(`| Resolvidos pelo diff | ${resolvidos.length} |`);
    if (!ehPrimeira && !semOrigem) {
      L.push(`| Persistem em aberto | ${persistem.length} |`);
      L.push(`| Novos detectados | ${novos.length} |`);
    }
    L.push(`| Total atual de achados abertos | ${p.findings.length} |`);
    if (score > 0) L.push(`| Score atual | ${score}/100${anterior ? ` (${sinalDelta}${scoreDelta} vs ${anterior.scoreNoMomento})` : ''} |`);
    L.push('');

    // Resolvidos (checklist [x])
    if (resolvidos.length > 0) {
      L.push(`## Resolvidos pela Forja IA (${resolvidos.length})\n`);
      L.push('_Marque como concluídos no seu backlog/planning._\n');
      resolvidos.forEach((r) => L.push(`- [x] ${r}`));
      L.push('');
    }

    // Persistem em aberto (checklist [ ] com detalhe)
    if (!ehPrimeira && persistem.length > 0) {
      L.push(`## Persistem em aberto (${persistem.length})\n`);
      L.push('_Continuam no backlog. O esforço atual não fechou — pode estar parcial._\n');
      persistem.forEach((f) => {
        L.push(`- [ ] **${f.titulo}** — _${f.severidade.toUpperCase()} · ${f.area}_`);
        L.push(`  - Problema: ${f.problema}`);
        L.push(`  - Evidência: ${f.evidencia}`);
        L.push(`  - Solução: ${f.solucao}`);
      });
      L.push('');
    }

    // Novos detectados (checklist [ ] com detalhe)
    const novosOuTodos = ehPrimeira ? p.findings : novos;
    const tituloNovos = ehPrimeira ? `Achados detectados (${novosOuTodos.length})` : `Novos detectados nesta rodada (${novosOuTodos.length})`;
    if (novosOuTodos.length > 0) {
      L.push(`## ${tituloNovos}\n`);
      L.push(ehPrimeira
        ? '_Adicione ao backlog. Esta é a baseline._\n'
        : '_Adicione ao backlog. Problemas surgidos no diff ou descobertos nesta rodada._\n');
      novosOuTodos.forEach((f) => {
        L.push(`- [ ] **${f.titulo}** — _${f.severidade.toUpperCase()} · ${f.area}_`);
        L.push(`  - Problema: ${f.problema}`);
        L.push(`  - Evidência: ${f.evidencia}`);
        L.push(`  - Solução: ${f.solucao}`);
      });
      L.push('');
    }

    // Caso especial: tem findings mas backend não preencheu origem (auditoria antiga)
    if (semOrigem) {
      L.push(`## Achados abertos atuais (${p.findings.length})\n`);
      L.push('_Esta rodada não distinguiu "novos" de "persistem" (modelo de IA mais antigo). Trate todos como o estado atual do backlog._\n');
      p.findings.forEach((f) => {
        L.push(`- [ ] **${f.titulo}** — _${f.severidade.toUpperCase()} · ${f.area}_`);
        L.push(`  - Problema: ${f.problema}`);
        L.push(`  - Evidência: ${f.evidencia}`);
        L.push(`  - Solução: ${f.solucao}`);
      });
      L.push('');
    }

    // Estado geral + próximos passos (contexto qualitativo)
    if (p.estadoGeral) {
      L.push('## Estado geral (avaliação da Forja IA)\n');
      L.push(p.estadoGeral + '\n');
    }
    if (p.proximosPassos) {
      L.push('## Próximos passos sugeridos\n');
      L.push(p.proximosPassos + '\n');
    }

    L.push('---');
    L.push('**Lembrete final:** este é um RELATÓRIO. Nenhum código novo deve ');
    L.push('surgir a partir dele. Pra implementar correções, use o ');
    L.push('`prompt-de-ajustes.md` (a ordem de serviço).');
    L.push('');
    L.push('_Procedimento padrão Forja: após implementar as correções (a partir do prompt-de-ajustes.md, não deste arquivo), rode a auditoria de novo na Forja IA pra gerar a próxima baixa._');

    return L.join('\n');
  };

  const baixarRelatorioBaixa = () => {
    const md = gerarRelatorioBaixa();
    if (!md) return;
    downloadFile(`auditoria-realizada-${slugify(sistemaNome)}-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown');
    message.success('Relatório de baixa baixado (.md) — entregue à IA pra atualizar o backlog.');
  };

  const comoFuncionaPopover = (
    <div style={{ maxWidth: 380, fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px' }}><strong>Como a Forja IA audita seu sistema:</strong></p>
      <ol style={{ paddingLeft: 18, margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <li><strong>Governança:</strong> lê os dados deste sistema (custos, decisões, riscos, alertas, timeline, metadados).</li>
        <li><strong>Código:</strong> abre o repositório (GitHub via repoUrl, ou projeto GAS) e lê os arquivos-chave dentro de um orçamento — citando arquivo e trecho como evidência.</li>
        <li><strong>Completa</strong> junta as duas. Escolha o escopo no seletor do topo.</li>
        <li>Identifica problemas concretos — só com evidência verificável.</li>
        <li>Pra cada problema, escreve: <em>problema, evidência, solução, e um prompt</em> pronto pra colar no Cursor/Claude.</li>
        <li>Sugere uma ação (Risco/Decisão/Oportunidade) que você aprova individualmente.</li>
      </ol>
      <p style={{ margin: 0, color: t.textTertiary, fontSize: 12 }}>
        Tag <strong style={{ color: t.accents.sage }}>verificada</strong> = dado direto. Tag <strong style={{ color: t.accents.peach }}>inferência</strong> = a IA deduziu — avalie com cuidado.
      </p>
    </div>
  );

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <Wand2 size={18} color={t.accents.peach} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 500, flexShrink: 0 }}>Auditoria Forja IA</span>
          <Tooltip title={sistemaNome}>
            <Tag color="orange" style={{ marginInlineEnd: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sistemaNome}</Tag>
          </Tooltip>
          <Popover content={comoFuncionaPopover} title={null} trigger="click" placement="bottomLeft">
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.ui, fontSize: 12, flexShrink: 0 }}>
              <Info size={13} /> como funciona?
            </button>
          </Popover>
        </div>
      }
      open={open}
      onClose={onClose}
      width={720}
      extra={
        dadosExibidos && (
          // Ações enxutas — só ícones com tooltip — pra não cobrir o nome do sistema
          // no header. Só o CTA principal ("Rodar de novo") mantém texto.
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {historico.length > 0 && (
              <Tooltip title={`Histórico (${historico.length} auditoria${historico.length === 1 ? '' : 's'})`}>
                <Button
                  icon={<History size={14} />}
                  type={mostrarHistorico ? 'primary' : 'text'}
                  size="small"
                  onClick={() => setMostrarHistorico((v) => !v)}
                  style={mostrarHistorico ? { background: t.accents.blue, borderColor: t.accents.blue } : undefined}
                />
              </Tooltip>
            )}
            {dadosExibidos.payload && (
              <Tooltip title="Baixar relatório completo (.md)">
                <Button icon={<Download size={14} />} type="text" size="small" onClick={baixarRelatorioCompleto} />
              </Tooltip>
            )}
            <Popconfirm
              title="Limpar histórico de auditorias?"
              description="Apaga todas as auditorias salvas deste sistema. Útil pra testar do zero. Não dá pra desfazer."
              okText="Limpar"
              okButtonProps={{ danger: true }}
              cancelText="Cancelar"
              onConfirm={limparAuditorias}
            >
              <Tooltip title="Limpar histórico de auditorias">
                <Button danger icon={<Trash2 size={14} />} type="text" size="small" loading={limpando} />
              </Tooltip>
            </Popconfirm>
            <Tooltip
              title={
                dadosExibidos
                  ? 'Re-analisa TUDO do zero (código + governança), mesmo se o repositório não mudou. Use depois de preencher dados na ficha, registrar decisões/riscos ou quando quiser uma 2ª opinião.'
                  : 'Roda a primeira auditoria. Analisa código (se há repo) + governança (custos, riscos, decisões).'
              }
            >
              <Button
                type="primary"
                icon={<RefreshCw size={14} />}
                size="small"
                onClick={() => { reset(); void auditar(true); }}
                loading={loading}
                style={{ background: t.accents.peach, borderColor: t.accents.peach, marginLeft: 4 }}
              >
                {dadosExibidos ? 'Rodar de novo' : 'Nova auditoria'}
              </Button>
            </Tooltip>
          </div>
        )
      }
    >
      {/* Histórico: linha do tempo dos runs + evolução do score */}
      {mostrarHistorico && (
        <HistoricoPanel t={t} itens={historico} loading={loadingHistorico} onFechar={() => setMostrarHistorico(false)} />
      )}

      {/* Seletor de escopo: governança (metadados) × código (repo real) × completa */}
      <div style={{ marginBottom: 18 }}>
        {temFonteCodigo ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Segmented
                value={modo}
                onChange={(v) => setModo(v as AuditModo)}
                options={[
                  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={13} /> Completa</span>, value: 'completa' },
                  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Code2 size={13} /> Código</span>, value: 'codigo' },
                  { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Database size={13} /> Governança</span>, value: 'governanca' },
                ]}
              />
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary }}>{MODO_HINT[modo]}</span>
            </div>
            <FrescorBanner
              t={t}
              modo={modo}
              loading={loadingStatus}
              status={status}
              auditando={loading}
              mostrarMudados={mostrarMudados}
              onToggleMudados={() => setMostrarMudados((v) => !v)}
              onAuditar={(forcar) => { reset(); void auditar(forcar); }}
            />
            {/* Alerta docs-only: a IA externa provavelmente só escreveu .md
                em vez de implementar as correções. Carrega CTA pra copiar
                um prompt corretivo pronto. */}
            {status && status.mudancasSaoDocsOnly && (
              <DocsOnlyAlerta t={t} status={status} />
            )}
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            icon={<GitBranch size={15} color={t.accents.blue} />}
            style={{ background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
            message={<span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>Auditando só <strong>governança</strong></span>}
            description={<span style={{ fontSize: 12, color: t.textSecondary }}>Sem repositório conectado, a IA não lê o código (segredos, dependências, testes, arquitetura). Conecte um logo abaixo pra desbloquear.</span>}
          />
        )}
      </div>

      {/* Conectar repositório sem sair do fluxo (quando não há repoUrl) */}
      {!repoAtual && (
        <div style={{ marginBottom: 18, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link2 size={14} color={t.accents.blue} />
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, fontWeight: 500 }}>Conectar repositório GitHub</span>
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, marginBottom: 8 }}>
            Salva o <strong>repoUrl</strong> na ficha e já audita o código de verdade (desbloqueia também a auditoria incremental).
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onPressEnter={() => { if (!conectando) void conectarRepo(); }}
              placeholder="https://github.com/owner/repo"
              style={{ flex: 1, minWidth: 220, fontFamily: FONTS.mono, fontSize: 12 }}
              disabled={conectando}
            />
            <Button type="primary" icon={<GitBranch size={14} />} loading={conectando} onClick={() => void conectarRepo()}>
              Conectar e auditar
            </Button>
          </div>
        </div>
      )}

      {/* Estado: carregando última auditoria */}
      {loadingUltima && !ultima && !resultado && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <Spin size="small" />
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textTertiary }}>Procurando auditoria anterior…</span>
        </div>
      )}

      {/* Estado: rodando nova auditoria */}
      {loading && !resultado && (() => {
        const seg = elapsedMs / 1000;
        // Em LOTES: barra determinística pelo progresso real (batches feitos/total)
        // — cada batch é uma chamada curta, então não há risco de timeout.
        const emLotes = !!batchProg && batchProg.total > 0;
        // Progresso assintótico: ~40s = "esperado" (90%), nunca chega a 100 até voltar.
        const pct = emLotes
          ? Math.round((batchProg!.feito / batchProg!.total) * 100)
          : Math.min(96, Math.round((1 - Math.exp(-seg / 22)) * 100));
        const perto = !emLotes && seg >= 240; // 4min → alerta (só no fluxo single)
        const corBarra = perto ? t.accents.rose : emLotes ? t.accents.blue : seg >= 60 ? t.accents.peach : t.accents.blue;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 500, color: corBarra, fontVariantNumeric: 'tabular-nums' }}>
              {emLotes
                ? `Lote ${Math.min(batchProg!.feito + 1, batchProg!.total)}/${batchProg!.total}`
                : (seg < 60 ? `${seg.toFixed(0)}s` : `${Math.floor(seg / 60)}m ${String(Math.floor(seg % 60)).padStart(2, '0')}s`)}
            </div>
            <div style={{ width: 320, maxWidth: '80%' }}>
              <Progress percent={pct} showInfo={false} strokeColor={corBarra} trailColor={t.borderSoft} size="small" />
            </div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, textAlign: 'center', maxWidth: 380 }}>
              {emLotes
                ? 'Diff grande — auditando em lotes, um após o outro. Cada lote é uma chamada curta, então não estoura o limite do Apps Script. Pode deixar rodando.'
                : modo === 'governanca'
                  ? 'A Forja IA está lendo o contexto deste sistema (custos, decisões, riscos, alertas, timeline) e montando uma análise crítica…'
                  : 'A Forja IA está abrindo o repositório, lendo os arquivos-chave do código e cruzando com o contexto do sistema…'}
            </div>
            {perto ? (
              <div style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.rose, textAlign: 'center', maxWidth: 380 }}>
                Já passou de 4min. O Apps Script corta execuções em ~6min — se estourar, tente o modo <strong>Código</strong> ou <strong>Governança</strong> (mais leves) ou um modelo mais rápido.
              </div>
            ) : (
              <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textAlign: 'center', maxWidth: 380 }}>
                Modelos rápidos (ex.: claude-3-5-haiku) levam ~5-10s · premium (Sonnet/Opus) 15-40s · limite do Apps Script: 6min.
              </div>
            )}
          </div>
        );
      })()}

      {/* Estado: nunca foi auditado */}
      {!loadingUltima && !loading && !dadosExibidos && verificouUltima && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.accents.peach}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={28} color={t.accents.peach} />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, color: t.text, marginBottom: 6, fontWeight: 500 }}>Primeira auditoria deste sistema</div>
            <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
              A Forja IA vai ler tudo que sabe sobre este sistema e propor achados estruturados com problema, evidência, solução e prompt pronto.
            </div>
          </div>
          <Button type="primary" size="large" icon={<Wand2 size={15} />} onClick={() => auditar()} loading={loading} style={{ background: t.accents.peach, borderColor: t.accents.peach }}>
            Auditar agora
          </Button>
        </div>
      )}

      {/* Banner de "última auditoria" quando estamos exibindo a salva (não a recém-rodada) */}
      {!resultado && ultima && (
        <Alert
          type="info"
          showIcon
          icon={<History size={16} color={t.accents.blue} />}
          style={{ marginBottom: 18, background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
          message={
            <span style={{ fontFamily: FONTS.ui, fontSize: 13 }}>
              <strong>Última auditoria {relTempo(ultima.criadoEm)}</strong>
              {ultima.modeloUsado && <span style={{ color: t.textTertiary, fontFamily: FONTS.mono, fontSize: 11, marginLeft: 8 }}>{ultima.modeloUsado}</span>}
              {ultima.duracaoMs > 0 && <span style={{ color: t.textTertiary, fontSize: 11, marginLeft: 8 }}><Clock size={10} style={{ verticalAlign: 'text-top' }} /> {(ultima.duracaoMs / 1000).toFixed(1)}s</span>}
              {ultima.totalAuditorias > 1 && <span style={{ color: t.textTertiary, fontSize: 11, marginLeft: 8 }}>· {ultima.totalAuditorias} no histórico</span>}
            </span>
          }
          description={
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              Você está vendo o resultado salvo. Quer pedir uma nova análise? Clique em <strong>Rodar de novo</strong> no canto superior direito.
            </span>
          }
        />
      )}

      {dadosExibidos && dadosExibidos.payload && (
        <>
          {/* Hero — agora só medidor de estado (score, severidades, delta).
              CTAs e listas foram movidos pra componentes dedicados abaixo. */}
          <ResultadoHero
            t={t}
            score={dadosExibidos.saudeAtual ? (dadosExibidos.saudeAtual as SaudeBreakdown).score : 0}
            payload={dadosExibidos.payload}
            modelo={dadosExibidos.modeloUsado}
            duracaoMs={dadosExibidos.duracaoMs}
            recente={!!resultado}
            historico={historico}
          />

          {/* Comparativo Antes vs Depois — só em re-auditorias (historico >= 2).
              Substitui o antigo MudancasDesdeUltima por uma visão 2-colunas
              mais didática (pedido direto do usuário: "me mostra o antes e
              depois, só isso"). */}
          <ComparativoAntesDepois
            t={t}
            historico={historico}
            currentFindings={dadosExibidos.payload.findings.length}
            resolvidos={dadosExibidos.payload.resolvidos || []}
            findings={dadosExibidos.payload.findings}
            currentScore={dadosExibidos.saudeAtual ? (dadosExibidos.saudeAtual as SaudeBreakdown).score : 0}
            currentCommit={dadosExibidos.fontes?.commitSha}
          />

          {/* Ação principal — UM card focal com o CTA certo pro momento:
              primeira auditoria → baixar prompt; re-auditoria → baixar baixa.
              Sem mais 2 sub-blocos competindo por atenção. */}
          <AcaoPrincipal
            t={t}
            ehPrimeiraAuditoria={historico.length < 2}
            onBaixarPrompt={baixarPromptMaster}
            onCopiarPrompt={copiarPromptMaster}
            onBaixarBaixa={baixarRelatorioBaixa}
            copiado={copiadoPrompt}
          />

          {/* Banner: auditoria de onboarding (sistema sem dados → checklist sem IA) */}
          {dadosExibidos.fontes && dadosExibidos.fontes.onboarding && (
            <Alert
              type="warning"
              showIcon
              icon={<ListChecks size={15} color={t.accents.peach} />}
              style={{ marginBottom: 18, background: `${t.accents.peach}12`, borderColor: `${t.accents.peach}55` }}
              message={<span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}><strong>Checklist de setup</strong> — este sistema ainda não tem dados pra uma auditoria crítica.</span>}
              description={<span style={{ fontSize: 12, color: t.textSecondary }}>Geramos um passo a passo (sem gastar IA). Conforme você preenche, a próxima auditoria fica mais profunda — com código conectado, a IA cita arquivo e trecho real.</span>}
            />
          )}

          {/* Fontes consultadas (rastreabilidade) */}
          <FontesBlock
            fontes={dadosExibidos.fontes}
            modelo={dadosExibidos.modeloUsado}
            reauditando={loading}
            onReauditarCodigo={() => { reset(); void auditar(true); }}
          />

          {/* Banner: esta auditoria rodou só sobre o diff (incremental) */}
          {dadosExibidos.fontes && dadosExibidos.fontes.incremental && (
            <Alert
              type="info"
              showIcon
              icon={<GitBranch size={15} color={t.accents.blue} />}
              style={{ marginBottom: 18, background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
              message={
                <span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}>
                  <strong>Auditoria incremental</strong> — reconciliou os achados anteriores contra o diff de{' '}
                  <strong>{dadosExibidos.fontes.arquivosLidos || 0}</strong> arquivo(s)
                  {dadosExibidos.fontes.baseCommit && dadosExibidos.fontes.commitSha && (
                    <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, marginLeft: 8 }}>
                      {dadosExibidos.fontes.baseCommit} → {dadosExibidos.fontes.commitSha}
                    </span>
                  )}
                </span>
              }
              description={<span style={{ fontSize: 12, color: t.textSecondary }}>Mais barato que reler o repositório inteiro. Pra uma varredura completa, use &ldquo;Auditar mesmo assim&rdquo; quando estiver em dia, ou conecte/force pelo cabeçalho.</span>}
            />
          )}

          {/* Banner: itens de backlog fechados automaticamente (o diff resolveu o achado) */}
          {resultado && resultado.fechadosAuto && resultado.fechadosAuto.length > 0 && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircle2 size={15} color={t.accents.sage} />}
              style={{ marginBottom: 18, background: `${t.accents.sage}10`, borderColor: `${t.accents.sage}55` }}
              message={<span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}><strong>{resultado.fechadosAuto.length} item(ns) do backlog fechado(s) automaticamente</strong></span>}
              description={
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: t.textSecondary }}>
                  {resultado.fechadosAuto.map((f, i) => (
                    <li key={i}>
                      <span style={{ textTransform: 'capitalize', color: t.textTertiary }}>{f.tipo}</span>: {f.titulo}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          {/* OBS.: A lista detalhada de "Resolvidos" agora vive dentro do
              card MudancasDesdeUltima (acima do banner incremental). Ali a
              narrativa é única: o que mudou, com celebração visual no que
              foi conquistado. */}

          {/* Estado geral — colapsado por padrão (texto longo, contextual) */}
          {dadosExibidos.payload.estadoGeral && (
            <Section
              titulo="Estado geral"
              icon={<Sparkles size={14} color={t.accents.peach} />}
              collapsible
              defaultOpen={false}
            >
              <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap' }}>
                {dadosExibidos.payload.estadoGeral}
              </div>
            </Section>
          )}

          {/* O que empolga — colapsado por padrão (positivo mas não acionável) */}
          {dadosExibidos.payload.oQueEmpolga.length > 0 && (
            <Section
              titulo="O que empolga"
              icon={<CheckCircle2 size={14} color={t.accents.sage} />}
              collapsible
              defaultOpen={false}
              badge={dadosExibidos.payload.oQueEmpolga.length}
            >
              <ul style={{ margin: 0, paddingLeft: 20, fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.65, color: t.textSecondary }}>
                {dadosExibidos.payload.oQueEmpolga.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </Section>
          )}

          {/* Achados detalhados (cards) — aberto, mas colapsável pra quem já leu */}
          {dadosExibidos.payload.findings.length > 0 && (
            <Section
              titulo="Achados detalhados"
              icon={<FileSearch size={14} color={t.accents.rose} />}
              badge={dadosExibidos.payload.findings.length}
              hint="Clique em cada card pra abrir. Pra cada achado: o problema, a evidência (verificada ou inferida), a solução em passos, e um prompt pronto pra colar no Cursor/Claude."
              collapsible
              defaultOpen
            >
              {dadosExibidos.payload.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  auditoriaId={auditoriaIdAtual}
                  sistemaId={sistemaId}
                  registro={registrosAtuais[f.id]}
                  onRegistered={aoRegistrar}
                />
              ))}
            </Section>
          )}

          {/* Próximos passos — colapsado por padrão (orientação geral) */}
          {dadosExibidos.payload.proximosPassos && (
            <Section
              titulo="Próximos passos estratégicos"
              icon={<Wand2 size={14} color={t.accents.peach} />}
              collapsible
              defaultOpen={false}
            >
              <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '12px 14px' }}>
                {dadosExibidos.payload.proximosPassos}
              </div>
            </Section>
          )}

          <Divider />

          {/* Score de saúde — colapsado por padrão (o número grande já está no hero) */}
          {dadosExibidos.saudeAtual && (
            <Section
              titulo="Composição do Score de Saúde"
              icon={<CheckCircle2 size={14} color={t.accents.sage} />}
              collapsible
              defaultOpen={false}
              hint="Detalhamento dos fatores que compõem o score: cada critério, pontuação e estado (OK/pendente)."
            >
              <SaudeBreakdownBlock saude={dadosExibidos.saudeAtual} onRecalcular={recalcularSaude} />
            </Section>
          )}
        </>
      )}

      {/* Fallback: payload não parseou — mostra texto bruto */}
      {resultado && !resultado.payload && (
        <>
          <Alert
            type="warning"
            showIcon
            message="Formato não estruturado"
            description="A IA não retornou os achados no formato esperado. Mostrando texto bruto abaixo."
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" type="primary" loading={loading} onClick={() => { reset(); void auditar(true); }}>
                Rodar de novo
              </Button>
            }
          />
          <div style={{ fontFamily: FONTS.ui, fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: 14 }}>
            {resultado.texto}
          </div>
        </>
      )}
    </Drawer>
  );
}

// Hero do resultado: score em destaque (dashboard), contagem por severidade,
// delta vs auditoria anterior e o CTA principal — baixar/copiar o "prompt de
// ajustes" pronto pra levar pra IA.
function ResultadoHero({ t, score, payload, modelo, duracaoMs, recente, historico }: {
  t: ReturnType<typeof useTokens>;
  score: number;
  payload: AuditResult['payload'];
  modelo: string;
  duracaoMs?: number;
  recente: boolean;
  historico: HistoricoAuditoriaItem[];
}): React.ReactElement | null {
  if (!payload) return null;
  const findings = payload.findings || [];
  const altas = findings.filter((f) => f.severidade === 'alta').length;
  const medias = findings.filter((f) => f.severidade === 'media').length;
  const baixas = findings.filter((f) => f.severidade === 'baixa').length;
  const corScore = score === 0 ? t.textTertiary : score >= 70 ? t.accents.sage : score >= 40 ? t.accents.peach : t.accents.rose;
  const rotulo = score === 0 ? 'sem score' : score >= 70 ? 'saudável' : score >= 40 ? 'atenção' : 'crítico';

  // Delta vs. auditoria anterior — historico vem ordenado newest-first do server.
  // [0] é a auditoria atual; [1] é a anterior. Mostramos delta só se rolou ≥2 runs.
  const auditoriaAnterior = historico.length >= 2 ? historico[1] : null;
  const scoreDelta = auditoriaAnterior ? score - auditoriaAnterior.scoreNoMomento : 0;
  const temDelta = !!auditoriaAnterior && scoreDelta !== 0;
  const corDelta = scoreDelta > 0 ? t.accents.sage : scoreDelta < 0 ? t.accents.rose : t.textTertiary;
  const sinalDelta = scoreDelta > 0 ? '+' : '';

  const chip = (n: number, cor: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cor}14`, border: `1px solid ${cor}44`, borderRadius: 999, padding: '3px 10px', fontFamily: FONTS.ui, fontSize: 12 }}>
      <strong style={{ color: cor, fontSize: 13 }}>{n}</strong>
      <span style={{ color: t.textSecondary }}>{label}</span>
    </span>
  );

  return (
    <div style={{ marginBottom: 18, borderRadius: 16, border: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${corScore}10, ${t.surface} 60%)`, padding: 18, boxShadow: t.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Progress
          type="dashboard"
          percent={score}
          size={104}
          strokeColor={corScore}
          trailColor={t.borderSoft}
          format={() => (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
              <span style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: corScore }}>{score === 0 ? '—' : score}</span>
              <span style={{ fontFamily: FONTS.ui, fontSize: 9.5, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{rotulo}</span>
            </div>
          )}
        />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <CheckCircle2 size={16} color={t.accents.sage} />
            <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 500, color: t.text }}>
              {recente ? 'Auditoria concluída' : 'Resultado da auditoria'}
            </span>
            {/* Delta do score — só aparece se houve mudança vs. auditoria anterior */}
            {temDelta && (
              <Tooltip title={`Score anterior: ${auditoriaAnterior!.scoreNoMomento === 0 ? '—' : auditoriaAnterior!.scoreNoMomento}. ${scoreDelta > 0 ? 'Melhorou!' : 'Caiu desde a última.'}`}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `${corDelta}1a`, border: `1px solid ${corDelta}55`,
                  borderRadius: 999, padding: '2px 9px',
                  fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: corDelta,
                }}>
                  {scoreDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {sinalDelta}{scoreDelta} pts
                </span>
              </Tooltip>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {chip(altas, t.accents.rose, altas === 1 ? 'alta' : 'altas')}
            {chip(medias, t.accents.peach, medias === 1 ? 'média' : 'médias')}
            {chip(baixas, t.accents.blue, baixas === 1 ? 'baixa' : 'baixas')}
          </div>
          <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{findings.length} achado(s)</span>
            {typeof duracaoMs === 'number' && duracaoMs > 0 && <span><Clock size={10} style={{ verticalAlign: 'text-top' }} /> {(duracaoMs / 1000).toFixed(1)}s</span>}
            {modelo && modelo !== 'desconhecido' && <span style={{ fontFamily: FONTS.mono }}>{modelo}</span>}
          </div>
        </div>
      </div>

      {/* CTAs do hero foram movidos pro componente AcaoPrincipal, que vive
          fora do hero (logo abaixo dele) e escolhe SOZINHO qual é a ação
          certa pro momento (primeira auditoria → baixar prompt; re-auditoria
          → baixar baixa). Hero agora é só medidor de estado. */}
    </div>
  );
}

// AcaoPrincipal — UM card focal com a ação certa pro momento do ciclo.
// Sem os 2 sub-blocos lado a lado (Prompt/Baixa) que confundiam — agora
// escolhemos AUTOMATICAMENTE qual CTA é o principal:
//   • Primeira auditoria → "Baixar prompt de ajustes" (CTA peach)
//   • Re-auditoria → "Baixar relatório de baixa" (CTA sage)
//
// A outra opção fica disponível mas em segundo plano (text button), pra
// quem quiser baixar os dois.
function AcaoPrincipal({ t, ehPrimeiraAuditoria, onBaixarPrompt, onCopiarPrompt, onBaixarBaixa, copiado }: {
  t: ReturnType<typeof useTokens>;
  ehPrimeiraAuditoria: boolean;
  onBaixarPrompt: () => void;
  onCopiarPrompt: () => void;
  onBaixarBaixa: () => void;
  copiado: boolean;
}): React.ReactElement {
  const corPrincipal = ehPrimeiraAuditoria ? t.accents.peach : t.accents.sage;
  const iconePrincipal = ehPrimeiraAuditoria ? <Rocket size={16} color={corPrincipal} /> : <ClipboardCheck size={16} color={corPrincipal} />;
  const tituloPrincipal = ehPrimeiraAuditoria ? 'Próximo passo: implementar as correções' : 'Próximo passo: avisar a IA o que foi resolvido';
  const descPrincipal = ehPrimeiraAuditoria
    ? 'Baixe o .md, cole no Cursor/Claude com a instrução "siga as instruções dentro do arquivo".'
    : 'Baixe o .md de baixa e entregue à mesma IA que implementou. Ela vai atualizar o planning/backlog dela.';
  const labelBotaoPrincipal = ehPrimeiraAuditoria ? 'Baixar prompt de ajustes (.md)' : 'Baixar relatório de baixa (.md)';
  const onClickPrincipal = ehPrimeiraAuditoria ? onBaixarPrompt : onBaixarBaixa;

  return (
    <div style={{
      marginBottom: 18,
      borderRadius: 14,
      border: `1px solid ${corPrincipal}55`,
      background: `linear-gradient(135deg, ${corPrincipal}10, ${t.surface} 70%)`,
      padding: 16,
      boxShadow: t.shadowSoft,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        {iconePrincipal}
        <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>{tituloPrincipal}</span>
      </div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, marginBottom: 12, lineHeight: 1.55 }}>
        {descPrincipal}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          type="primary"
          size="middle"
          icon={<Download size={14} />}
          onClick={onClickPrincipal}
          style={{ background: corPrincipal, borderColor: corPrincipal, fontWeight: 600 }}
        >
          {labelBotaoPrincipal}
        </Button>
        {ehPrimeiraAuditoria ? (
          <Button icon={copiado ? <Check size={14} color={t.accents.sage} /> : <Copy size={14} />} onClick={onCopiarPrompt}>
            {copiado ? 'Copiado!' : 'Copiar prompt'}
          </Button>
        ) : (
          <Button type="text" icon={<Rocket size={14} />} onClick={onBaixarPrompt} style={{ color: t.textTertiary }}>
            Também baixar prompt p/ novos achados
          </Button>
        )}
      </div>
    </div>
  );
}

// Comparativo Antes vs Depois — substitui o MudancasDesdeUltima por uma
// visão 2-colunas mais didática. Mostra lado a lado: o estado anterior, o
// estado atual, e no meio as listas Resolvidos (saíram) / Novos (entraram).
// Pedido direto do usuário: "quando eu voltar ele me mostra o antes e depois,
// só isso".
//
// Só aparece em re-auditorias (historico.length >= 2). Em primeira auditoria,
// não há "antes" pra mostrar — esse bloco fica oculto.
function ComparativoAntesDepois({ t, historico, currentFindings, resolvidos, findings, currentScore, currentCommit }: {
  t: ReturnType<typeof useTokens>;
  historico: HistoricoAuditoriaItem[];
  currentFindings: number;
  resolvidos: string[];
  findings: AuditFinding[];
  currentScore: number;
  currentCommit?: string;
}): React.ReactElement | null {
  const anterior = historico.length >= 2 ? historico[1] : null;
  if (!anterior) return null;

  const scoreDelta = currentScore - anterior.scoreNoMomento;
  const corDelta = scoreDelta > 0 ? t.accents.sage : scoreDelta < 0 ? t.accents.rose : t.textTertiary;
  const sinalDelta = scoreDelta > 0 ? '+' : '';

  const novos = findings.filter((f) => f.origem === 'novo');
  const persistemQtd = findings.filter((f) => f.origem === 'persiste').length;
  const saldo = currentFindings - anterior.numFindings;

  // Resumo do que mudou de fato — vira o subtítulo.
  const huboMudanca = resolvidos.length > 0 || novos.length > 0 || saldo !== 0;
  const tituloComparativo = !huboMudanca
    ? 'Nada mudou desde a última'
    : resolvidos.length > 0 && novos.length === 0
      ? `${resolvidos.length} ${resolvidos.length === 1 ? 'achado fechado' : 'achados fechados'}`
      : resolvidos.length === 0 && novos.length > 0
        ? `${novos.length} ${novos.length === 1 ? 'achado novo' : 'achados novos'}`
        : `${resolvidos.length} fechado(s) · ${novos.length} novo(s)`;

  const fmtData = (iso: string) => {
    try {
      const d = new Date(iso);
      const horas = Math.floor((Date.now() - d.getTime()) / 3600000);
      if (horas < 24) return horas <= 1 ? 'há 1h' : `há ${horas}h`;
      const dias = Math.floor(horas / 24);
      return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
    } catch { return ''; }
  };

  const Coluna = ({ titulo, sub, score, n, cor, badge, commit }: { titulo: string; sub?: string; score: number; n: number; cor: string; badge?: string; commit?: string }) => (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '14px 16px',
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 }}>{titulo}</span>
        {sub && <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>· {sub}</span>}
        {badge && (
          <span style={{ marginLeft: 'auto', fontFamily: FONTS.ui, fontSize: 11, fontWeight: 600, color: cor, background: `${cor}1a`, border: `1px solid ${cor}55`, padding: '1px 8px', borderRadius: 999 }}>{badge}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 32, fontWeight: 600, color: cor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score === 0 ? '—' : score}</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>de saúde</span>
      </div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.textSecondary }}>
        <strong style={{ color: t.text, fontWeight: 600 }}>{n}</strong> {n === 1 ? 'achado aberto' : 'achados abertos'}
      </div>
      {commit && (
        <div style={{ marginTop: 6, fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>commit {commit}</div>
      )}
    </div>
  );

  const corAtual = currentScore === 0 ? t.textTertiary : currentScore >= 70 ? t.accents.sage : currentScore >= 40 ? t.accents.peach : t.accents.rose;
  const corAntes = anterior.scoreNoMomento === 0 ? t.textTertiary : anterior.scoreNoMomento >= 70 ? t.accents.sage : anterior.scoreNoMomento >= 40 ? t.accents.peach : t.accents.rose;

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Faixa fina com título + delta + escopo da reconciliação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>Comparando</span>
        <span style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text, fontWeight: 500 }}>{tituloComparativo}</span>
        {scoreDelta !== 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${corDelta}1a`, border: `1px solid ${corDelta}55`,
            borderRadius: 999, padding: '2px 9px',
            fontFamily: FONTS.ui, fontSize: 12, fontWeight: 600, color: corDelta,
          }}>
            {scoreDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {sinalDelta}{scoreDelta} pts
          </span>
        )}
        <Tooltip
          title={
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>
              <div style={{ marginBottom: 4 }}>A IA reconciliou <strong>apenas os {anterior.numFindings} achado(s)</strong> da última auditoria contra o diff.</div>
              <div>Achados de auditorias mais antigas (já fechados ou sobrescritos) não entram no escopo — esse é o comportamento esperado.</div>
            </div>
          }
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary,
            cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 3,
          }}>
            <Info size={11} /> escopo: {anterior.numFindings} achado{anterior.numFindings === 1 ? '' : 's'} anterior{anterior.numFindings === 1 ? '' : 'es'}
          </span>
        </Tooltip>
      </div>

      {/* 2 colunas: Antes ─► Agora */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Coluna
          titulo="Antes"
          sub={fmtData(anterior.criadoEm)}
          score={anterior.scoreNoMomento}
          n={anterior.numFindings}
          cor={corAntes}
          commit={anterior.commitSha || undefined}
        />
        <div style={{ display: 'flex', alignItems: 'center', color: t.textTertiary, fontSize: 18, padding: '0 2px' }}>
          →
        </div>
        <Coluna
          titulo="Agora"
          sub="recém-auditado"
          score={currentScore}
          n={currentFindings}
          cor={corAtual}
          badge={scoreDelta > 0 ? 'melhorou' : scoreDelta < 0 ? 'piorou' : undefined}
          commit={currentCommit}
        />
      </div>

      {/* Listas: Resolvidos (saíram) | Novos (entraram) */}
      {(resolvidos.length > 0 || novos.length > 0) && (
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {/* Resolvidos */}
          {resolvidos.length > 0 && (
            <div style={{
              flex: 1, minWidth: 250,
              padding: '12px 14px',
              background: `${t.accents.sage}0c`,
              border: `1px solid ${t.accents.sage}44`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <CheckCircle2 size={14} color={t.accents.sage} />
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 700, color: t.accents.sage, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Resolvidos · saíram ({resolvidos.length})
                </span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {resolvidos.map((r, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontFamily: FONTS.ui, fontSize: 13, lineHeight: 1.5, color: t.textSecondary }}>
                    <Check size={13} color={t.accents.sage} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Novos */}
          {novos.length > 0 && (
            <div style={{
              flex: 1, minWidth: 250,
              padding: '12px 14px',
              background: `${t.accents.peach}0c`,
              border: `1px solid ${t.accents.peach}44`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Sparkles size={14} color={t.accents.peach} />
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 700, color: t.accents.peach, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Novos · entraram ({novos.length})
                </span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {novos.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontFamily: FONTS.ui, fontSize: 13, lineHeight: 1.5, color: t.textSecondary }}>
                    <span style={{ marginTop: 2, flexShrink: 0, fontFamily: FONTS.mono, fontSize: 11, color: t.accents.peach, fontWeight: 700 }}>+</span>
                    <span>
                      {f.titulo}
                      <span style={{ marginLeft: 6, fontSize: 10.5, color: t.textTertiary, textTransform: 'uppercase' }}>{f.severidade}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Persistem (se houver) — só uma linha discreta */}
      {persistemQtd > 0 && (
        <div style={{ marginTop: 10, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
          {persistemQtd} {persistemQtd === 1 ? 'achado persiste' : 'achados persistem'} em aberto · veja em <em>Achados detalhados</em> abaixo.
        </div>
      )}
    </div>
  );
}

// (Mantido) Card "Mudanças desde a última auditoria" — versão antiga, ainda
// usada como fallback caso ComparativoAntesDepois falhe ou no caso de uma
// primeira auditoria com algum resolvido isolado (raro).
function MudancasDesdeUltima({ t, historico, currentFindings, resolvidos }: {
  t: ReturnType<typeof useTokens>;
  historico: HistoricoAuditoriaItem[];
  currentFindings: number;
  resolvidos: string[];
}): React.ReactElement | null {
  const anterior = historico.length >= 2 ? historico[1] : null;
  const qtdResolvidos = resolvidos.length;
  // Só esconde quando não tem comparação E não tem resolvidos.
  if (!anterior && qtdResolvidos === 0) return null;

  // Saldo de findings: (anterior - resolvidos) seria o esperado.
  // O que está acima disso são NOVOS achados detectados nesta rodada.
  const anteriorFindings = anterior ? anterior.numFindings : currentFindings + qtdResolvidos;
  const novosDetectados = Math.max(0, currentFindings - (anteriorFindings - qtdResolvidos));
  const saldo = currentFindings - anteriorFindings; // <0 melhorou, >0 piorou

  // Tom geral do card:
  //   • verde se você melhorou (saldo < 0 OU resolvidos > 0 sem novos)
  //   • peach (neutro/atenção) se ficou igual
  //   • rose se piorou
  const melhorou = saldo < 0 || (qtdResolvidos > 0 && novosDetectados === 0);
  const piorou = saldo > 0 && novosDetectados > qtdResolvidos;
  const cor = melhorou ? t.accents.sage : piorou ? t.accents.rose : t.accents.peach;
  const titulo = melhorou
    ? (qtdResolvidos > 0 ? 'Você avançou no diff' : 'Saldo positivo')
    : piorou ? 'Surgiram mais achados que resolvidos'
    : (qtdResolvidos > 0 ? 'Saldo zero: você resolveu mas surgiram novos' : 'Sem alterações detectadas');
  const icone = melhorou ? <PartyPopper size={16} color={cor} /> : piorou ? <AlertCircle size={16} color={cor} /> : <Minus size={16} color={cor} />;

  const Stat = ({ valor, label, cor: c, icon, hint }: { valor: number; label: string; cor: string; icon: React.ReactNode; hint?: string }) => (
    <div style={{
      flex: 1, minWidth: 130,
      padding: '10px 12px',
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c, marginBottom: 4 }}>
        {icon}
        <span style={{ fontFamily: FONTS.ui, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valor === 0 ? '0' : (valor > 0 ? '+' : '') + valor}
      </div>
      {hint && <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{
      marginBottom: 18,
      borderRadius: 14,
      border: `1px solid ${cor}55`,
      background: `linear-gradient(135deg, ${cor}10, ${t.surface} 80%)`,
      padding: 16,
      boxShadow: t.shadowSoft,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        {icone}
        <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: t.text }}>{titulo}</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Mudanças desde a última auditoria
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat
          valor={qtdResolvidos}
          label="Resolvidos"
          cor={t.accents.sage}
          icon={<CheckCircle2 size={12} />}
          hint={qtdResolvidos === 0 ? 'nenhum achado anterior caiu no diff' : qtdResolvidos === 1 ? '1 achado fechado' : `${qtdResolvidos} achados fechados`}
        />
        <Stat
          valor={novosDetectados}
          label="Novos detectados"
          cor={novosDetectados === 0 ? t.textTertiary : t.accents.peach}
          icon={<Sparkles size={12} />}
          hint={novosDetectados === 0 ? 'nada novo nesse diff' : novosDetectados === 1 ? '1 achado novo' : `${novosDetectados} achados novos`}
        />
        <Stat
          valor={saldo}
          label="Saldo total"
          cor={cor}
          icon={saldo < 0 ? <ArrowDown size={12} /> : saldo > 0 ? <ArrowUp size={12} /> : <Minus size={12} />}
          hint={`${anteriorFindings} antes → ${currentFindings} agora`}
        />
      </div>

      {/* Lista celebratória dos resolvidos (substitui a section quieta antiga) */}
      {qtdResolvidos > 0 && (
        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: `${t.accents.sage}0c`,
          border: `1px solid ${t.accents.sage}33`,
          borderRadius: 10,
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <CheckCircle2 size={14} color={t.accents.sage} />
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, fontWeight: 600, color: t.accents.sage, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Resolvidos neste diff
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolvidos.map((r, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: FONTS.ui, fontSize: 13, lineHeight: 1.5, color: t.textSecondary }}>
                <Check size={14} color={t.accents.sage} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Painel de histórico: linha do tempo das auditorias + mini-gráfico (sparkline)
// da evolução do score. Sem dependência nova — o gráfico é um SVG inline.
function HistoricoPanel({ t, itens, loading, onFechar }: {
  t: ReturnType<typeof useTokens>;
  itens: HistoricoAuditoriaItem[];
  loading: boolean;
  onFechar: () => void;
}): React.ReactElement {
  const corScore = (s: number) => (s === 0 ? t.textTertiary : s >= 70 ? t.accents.sage : s >= 40 ? t.accents.peach : t.accents.rose);
  const fmtData = (iso: string) => {
    try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  // Sparkline: scores do mais antigo → mais recente.
  const serie = [...itens].reverse();
  const sparkline = (() => {
    if (serie.length < 2) return null;
    const W = 280; const H = 44; const pad = 4;
    const xs = (i: number) => pad + (i * (W - 2 * pad)) / (serie.length - 1);
    const ys = (s: number) => H - pad - (Math.max(0, Math.min(100, s)) / 100) * (H - 2 * pad);
    const pts = serie.map((it, i) => `${xs(i).toFixed(1)},${ys(it.scoreNoMomento).toFixed(1)}`);
    const ultimo = serie[serie.length - 1];
    return (
      <svg width={W} height={H} style={{ display: 'block' }}>
        <polyline points={pts.join(' ')} fill="none" stroke={t.accents.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((it, i) => (
          <circle key={i} cx={xs(i)} cy={ys(it.scoreNoMomento)} r={2.5} fill={corScore(it.scoreNoMomento)} />
        ))}
        <text x={xs(serie.length - 1)} y={ys(ultimo.scoreNoMomento) - 6} fontSize={10} fill={corScore(ultimo.scoreNoMomento)} textAnchor="end" fontWeight="600">{ultimo.scoreNoMomento}</text>
      </svg>
    );
  })();

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const delta = serie.length >= 2 ? ultimo.scoreNoMomento - primeiro.scoreNoMomento : 0;

  return (
    <div style={{ marginBottom: 18, borderRadius: 14, border: `1px solid ${t.border}`, background: t.surface, padding: 16, boxShadow: t.shadowSoft }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={15} color={t.accents.blue} />
          <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 500, color: t.text }}>Histórico de auditorias</span>
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>{itens.length} rodada(s)</span>
        </div>
        <Button type="text" size="small" icon={<XCircle size={15} />} onClick={onFechar} style={{ color: t.textTertiary }} />
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : itens.length === 0 ? (
        <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textTertiary, padding: '8px 0' }}>Nenhuma auditoria salva ainda.</div>
      ) : (
        <>
          {sparkline && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>Evolução do score</span>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, fontWeight: 600, color: delta > 0 ? t.accents.sage : delta < 0 ? t.accents.rose : t.textTertiary }}>
                  {delta > 0 ? `+${delta}` : delta} pts
                </span>
              </div>
              {sparkline}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {itens.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 9, background: t.surfaceMuted, border: `1px solid ${t.borderSoft}` }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${corScore(it.scoreNoMomento)}18`, border: `1px solid ${corScore(it.scoreNoMomento)}55` }}>
                  <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: corScore(it.scoreNoMomento) }}>{it.scoreNoMomento === 0 ? '—' : it.scoreNoMomento}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.text, fontWeight: 500 }}>{fmtData(it.criadoEm)}</span>
                    {it.incremental && <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}>incremental</Tag>}
                    {it.resolvidos > 0 && <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}>{it.resolvidos} resolvido(s)</Tag>}
                  </div>
                  <div style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    <span>{it.numFindings} achado(s)</span>
                    {it.duracaoMs > 0 && <span>{(it.duracaoMs / 1000).toFixed(1)}s</span>}
                    {it.modeloUsado && <span style={{ fontFamily: FONTS.mono }}>{it.modeloUsado}</span>}
                    {it.commitSha && <span style={{ fontFamily: FONTS.mono }}>{it.commitSha}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Section colapsável — quando `collapsible=true`, o cabeçalho vira botão
// e o conteúdo abre/fecha. `defaultOpen` decide o estado inicial.
// `badge` pinta uma micro-contagem ao lado do título (ex: "(7)") pra dar
// pista do tamanho do conteúdo sem precisar abrir.
function Section({ titulo, icon, hint, children, collapsible, defaultOpen = true, badge }: {
  titulo: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: string | number;
}): React.ReactElement {
  const t = useTokens();
  const [aberto, setAberto] = useState(defaultOpen);

  const headerContent = (
    <>
      {collapsible && (aberto
        ? <ChevronDown size={14} color={t.textTertiary} />
        : <ChevronRight size={14} color={t.textTertiary} />)}
      {icon}
      <span style={{ fontFamily: FONTS.ui, fontWeight: 500, fontSize: 14, color: t.text }}>{titulo}</span>
      {badge !== undefined && (
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
          {typeof badge === 'number' ? `(${badge})` : badge}
        </span>
      )}
      {hint && (
        <Popover content={<div style={{ maxWidth: 320, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>{hint}</div>} placement="bottomLeft">
          <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} onClick={(e) => e.stopPropagation()} />
        </Popover>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: aberto ? 10 : 0,
          }}
        >
          {headerContent}
        </button>
        {aberto && children}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {headerContent}
      </div>
      {children}
    </div>
  );
}

// Alerta "docs-only" — detecta o caso clássico em que o usuário pediu pra IA
// externa (Cursor/Claude) implementar correções, e ela respondeu só escrevendo
// docs (criando .md, fazendo cross-references). O backend marca a flag
// `mudancasSaoDocsOnly` quando o diff tem arquivos alterados mas NENHUM é
// código (todos passam pelo filtro de _codeArquivoRelevante).
//
// Aqui mostramos o alerta + um botão que copia um prompt corretivo pronto pra
// o usuário colar no Cursor, instruindo-o a finalmente IMPLEMENTAR.
function DocsOnlyAlerta({ t, status }: { t: ReturnType<typeof useTokens>; status: StatusAuditoriaCodigo }): React.ReactElement {
  const { message } = AntApp.useApp();
  const [copiado, setCopiado] = useState(false);
  const docs = status.listaDocsMudados || [];
  const total = status.arquivosMudadosTotal || docs.length;

  const promptCorretivo = `# Ordem de serviço — implementar as correções (não documentar mais)

Voce acabou de fazer commits que só mexem em arquivos de documentação
(${docs.slice(0, 5).join(', ')}${docs.length > 5 ? ', ...' : ''}). Reconheço
o trabalho de análise, mas o objetivo principal era IMPLEMENTAR as correções
no código de produção, não criar/atualizar docs.

## O que quero agora

1. **Implementar as correções de CÓDIGO** dos achados listados em
   \`prompt-de-ajustes.md\` (o arquivo original da Forja IA).
2. Cada correção = 1 commit pequeno e atômico com prefixo \`fix:\`, \`feat:\`
   ou \`refactor:\`. **NÃO use prefixo \`docs:\`**.
3. **NÃO crie mais arquivos .md** consolidando ou analisando os achados.
4. Se algum achado for falso positivo na sua visão, me cita aqui na
   conversa o título e a justificativa — eu confirmo antes de descartar.
5. Ao terminar, faça \`git push\` e me avise: "implementei N achados,
   push feito". Aí a Forja IA re-audita e mede o que mudou de verdade.

Comece pelo achado de severidade mais alta e vai descendo.
`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(promptCorretivo);
      setCopiado(true);
      message.success('Prompt corretivo copiado — cole no Cursor/Claude.');
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      message.error('Não consegui copiar. Selecione o texto manualmente.');
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <Alert
        type="warning"
        showIcon
        icon={<AlertCircle size={16} color={t.accents.peach} />}
        style={{
          background: `${t.accents.peach}14`,
          borderColor: `${t.accents.peach}66`,
        }}
        message={
          <span style={{ fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600 }}>
            A última rodada só teve commits de documentação
          </span>
        }
        description={
          <div style={{ fontFamily: FONTS.ui, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
            <p style={{ margin: '4px 0 8px' }}>
              <strong>{total}</strong> arquivo(s) mudaram desde a última auditoria, mas <strong>nenhum é de código</strong>.
              Isso geralmente significa que a IA externa (Cursor/Claude) <strong>analisou ou documentou</strong> os achados
              em vez de implementar as correções de fato.
            </p>
            {docs.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 }}>Arquivos só de docs detectados:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {docs.slice(0, 5).map((f) => (
                    <span key={f} style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary }}>
                      <FileCode2 size={11} color={t.textTertiary} style={{ verticalAlign: 'text-top', marginRight: 5 }} />
                      {f}
                    </span>
                  ))}
                  {docs.length > 5 && (
                    <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>+{docs.length - 5} outro(s)</span>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <Button
                size="small"
                type="primary"
                icon={copiado ? <Check size={13} color="#fff" /> : <Copy size={13} />}
                onClick={copiar}
                style={{ background: t.accents.peach, borderColor: t.accents.peach, fontWeight: 600 }}
              >
                {copiado ? 'Copiado!' : 'Copiar prompt corretivo'}
              </Button>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textTertiary, alignSelf: 'center' }}>
                cole no Cursor pra ele finalmente implementar as correções
              </span>
            </div>
          </div>
        }
      />
    </div>
  );
}

// Banner de frescor (Fase 2): mostra se o repositório mudou desde a última
// auditoria de código e adapta o botão de ação (auditar mudanças × forçar).
function FrescorBanner({ t, modo, loading, status, auditando, mostrarMudados, onToggleMudados, onAuditar }: {
  t: ReturnType<typeof useTokens>;
  modo: AuditModo;
  loading: boolean;
  status: StatusAuditoriaCodigo | null;
  auditando: boolean;
  mostrarMudados: boolean;
  onToggleMudados: () => void;
  onAuditar: (forcar?: boolean) => void;
}): React.ReactElement | null {
  if (modo === 'governanca') return null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary }}>
        <Spin size="small" /> Checando o repositório…
      </div>
    );
  }

  if (!status || !status.temFonte || status.nuncaAuditado) return null;

  const wrap = { marginTop: 10 } as React.CSSProperties;

  // Não deu pra comparar (sem token, repoUrl inválida, base sumiu, ou GAS).
  if (status.erro || status.semDiff || (status.mudou && status.arquivosMudados === 0)) {
    const msg = status.erro
      ? status.erro
      : status.fonte === 'gas'
        ? 'Projeto Apps Script — a auditoria roda completa a cada vez.'
        : 'O repositório mudou desde a última auditoria.';
    return (
      <div style={wrap}>
        <Alert
          type="info"
          showIcon
          icon={<GitBranch size={15} color={t.accents.blue} />}
          style={{ background: `${t.accents.blue}0e`, borderColor: `${t.accents.blue}44` }}
          message={<span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}>{msg}</span>}
          action={
            <Button size="small" type="primary" loading={auditando} onClick={() => onAuditar(true)}>Auditar</Button>
          }
        />
      </div>
    );
  }

  // Em dia: HEAD == commit auditado.
  if (!status.mudou) {
    return (
      <div style={wrap}>
        <Alert
          type="success"
          showIcon
          icon={<CheckCircle2 size={15} color={t.accents.sage} />}
          style={{ background: `${t.accents.sage}12`, borderColor: `${t.accents.sage}55` }}
          message={
            <span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}>
              Em dia com o commit <span style={{ fontFamily: FONTS.mono, fontSize: 11 }}>{status.headCommit || status.ultimoCommitAuditado}</span> — nada mudou desde a última auditoria.
            </span>
          }
          action={
            <Button size="small" loading={auditando} onClick={() => onAuditar(true)}>Auditar mesmo assim</Button>
          }
        />
      </div>
    );
  }

  // Mudou, com contagem de arquivos relevantes.
  return (
    <div style={wrap}>
      <Alert
        type="warning"
        showIcon
        icon={<GitBranch size={15} color={t.accents.peach} />}
        style={{ background: `${t.accents.peach}12`, borderColor: `${t.accents.peach}55` }}
        message={
          <span style={{ fontFamily: FONTS.ui, fontSize: 12.5 }}>
            <strong>{status.arquivosMudados}</strong> arquivo{status.arquivosMudados === 1 ? '' : 's'} de código mudaram desde a última auditoria
            {status.listaMudados.length > 0 && (
              <Button type="link" size="small" style={{ padding: '0 6px', height: 'auto', fontSize: 12 }} onClick={onToggleMudados}>
                {mostrarMudados ? 'ocultar' : 'ver arquivos'}
              </Button>
            )}
          </span>
        }
        description={
          mostrarMudados && status.listaMudados.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
              {status.listaMudados.map((f) => (
                <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.mono, fontSize: 11, color: t.textSecondary }}>
                  <FileCode2 size={11} color={t.textTertiary} /> {f}
                </span>
              ))}
              {status.arquivosMudados > status.listaMudados.length && (
                <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>+{status.arquivosMudados - status.listaMudados.length} outro(s)</span>
              )}
            </div>
          ) : null
        }
        action={
          <Button size="small" type="primary" loading={auditando} onClick={() => onAuditar(false)} className={auditando ? undefined : 'forja-pulse-audit'} style={{ background: t.accents.peach, borderColor: t.accents.peach, fontWeight: 600 }}>
            Auditar mudanças ({status.arquivosMudados})
          </Button>
        }
      />
    </div>
  );
}

function FontesBlock({ fontes, modelo, onReauditarCodigo, reauditando }: { fontes: AuditResult['fontes']; modelo: string; onReauditarCodigo?: () => void; reauditando?: boolean }): React.ReactElement {
  const t = useTokens();
  // Por padrão FECHADO — quase ninguém abre depois da primeira leitura. O resumo
  // do header já dá pista do que tem dentro; quem suspeita de "IA não viu X"
  // expande pra confirmar.
  const [aberto, setAberto] = useState(false);
  const erro = fontes.codigoErro || '';
  const apiDesativada = /apps script api/i.test(erro);
  const githubDesconectado = /github não conectado|sem token/i.test(erro);
  const semFonte = /sem reposit[óo]rio|fonte indispon[íi]vel/i.test(erro);
  const items: Array<{ label: string; valor: string | number; ok: boolean }> = [
    { label: 'Propósito', valor: fontes.temProposito ? 'sim' : 'não', ok: fontes.temProposito },
    { label: 'Stack', valor: fontes.temStack ? 'sim' : 'não', ok: fontes.temStack },
    { label: 'URL/Domínio', valor: fontes.temUrl ? 'sim' : 'não', ok: fontes.temUrl },
    { label: 'Repositório', valor: fontes.temRepo ? 'sim' : 'não', ok: fontes.temRepo },
    { label: 'Custos', valor: fontes.custos, ok: true },
    { label: 'Decisões', valor: fontes.decisoes, ok: true },
    { label: 'Riscos', valor: fontes.riscos, ok: true },
    { label: 'Alertas', valor: fontes.alertas, ok: true },
    { label: 'Timeline', valor: fontes.timeline, ok: true },
  ];
  // Resumo compacto pro header fechado — mostra rapidamente o que está OK.
  const textuais = items.filter((it) => typeof it.valor === 'string');
  const numericos = items.filter((it) => typeof it.valor === 'number');
  const okTextuais = textuais.filter((it) => it.ok).length;
  const okNumericos = numericos.filter((it) => Number(it.valor) > 0).length;
  const resumo = `${okTextuais}/${textuais.length} metadados · ${okNumericos}/${numericos.length} backlogs com dados`;

  return (
    <div style={{ background: t.surfaceMuted, border: `1px solid ${t.borderSoft}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
      {/* Header sempre visível — vira botão de colapso */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: aberto ? 8 : 0,
        }}
      >
        {aberto ? <ChevronDown size={13} color={t.textTertiary} /> : <ChevronRight size={13} color={t.textTertiary} />}
        <Database size={13} color={t.textTertiary} />
        <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fontes consultadas pela IA</span>
        {!aberto && (
          <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>· {resumo}</span>
        )}
        <Popover content={<div style={{ maxWidth: 320, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>O que a IA leu pra produzir esta auditoria. Se um número está em 0, ela não tem dado pra falar daquilo — qualquer achado relacionado deve estar marcado como "inferência".</div>} placement="bottomLeft">
          <Info size={12} color={t.textTertiary} style={{ cursor: 'help' }} onClick={(e) => e.stopPropagation()} />
        </Popover>
        {modelo && modelo !== 'desconhecido' && (
          <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 10, color: t.textTertiary }}>{modelo}</span>
        )}
      </button>

      {/* Chips detalhados — só aparecem quando aberto */}
      {aberto && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((item) => (
            <span
              key={item.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 999,
                padding: '2px 9px', fontFamily: FONTS.ui, fontSize: 11,
                color: item.ok && item.valor !== 0 && item.valor !== 'não' ? t.textSecondary : t.textTertiary,
              }}
            >
              {item.label}
              <strong style={{ color: item.ok && item.valor !== 0 && item.valor !== 'não' ? t.accents.sage : t.accents.rose, fontWeight: 600 }}>
                {item.valor}
              </strong>
            </span>
          ))}
        </div>
      )}

      {/* Leitura de código: SEMPRE visível — carrega o aviso CRÍTICO de
          "diff truncado" que afeta a confiabilidade dos resolvidos. */}
      {(fontes.fonteCodigo || fontes.codigoErro) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${t.borderSoft}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <FileCode2 size={13} color={fontes.codigoErro ? t.accents.rose : t.accents.sage} />
          {fontes.fonteCodigo && (fontes.arquivosLidos || 0) > 0 ? (
            <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>
                {fontes.incremental ? 'Diff lido de' : 'Código lido de'} <strong>{fontes.fonteCodigo === 'github' ? 'GitHub' : 'Apps Script'}</strong> ·{' '}
                <strong>{fontes.arquivosLidos}</strong> arquivo(s){fontes.bytesCodigo ? ` · ~${Math.round((fontes.bytesCodigo || 0) / 1024)}KB` : ''}
              </span>
              {fontes.commitSha ? <span style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: t.textTertiary }}>commit {fontes.commitSha}</span> : null}
              {/* v1.147: novos sinais do chunking — substituem o aviso silencioso "DIFF TRUNCADO".
                  Agora o user sabe EXATAMENTE quantos batches rodaram e o que (se algo) ficou de fora. */}
              {(fontes.batchesUsados || 0) > 1 && (
                <Tooltip title={`O diff foi grande — foi dividido em ${fontes.batchesUsados} pedaços auditados separadamente e os achados foram consolidados. Cobertura completa, sem truncamento.`}>
                  <Tag
                    style={{
                      background: `${t.accents.sage}14`,
                      color: t.accents.sage,
                      border: `1px solid ${t.accents.sage}55`,
                      fontFamily: FONTS.ui,
                      fontSize: 10.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginInlineEnd: 0,
                      paddingInline: 7,
                    }}
                  >
                    {fontes.batchesUsados} batches · coberto
                  </Tag>
                </Tooltip>
              )}
              {(fontes.arquivosSplitted || []).length > 0 && (
                <Tooltip title={`Arquivos individualmente grandes foram divididos em janelas com overlap pra não perder contexto: ${(fontes.arquivosSplitted || []).join(', ')}`}>
                  <Tag
                    style={{
                      background: `${t.accents.lavender}14`,
                      color: t.accents.lavender,
                      border: `1px solid ${t.accents.lavender}55`,
                      fontFamily: FONTS.ui,
                      fontSize: 10.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginInlineEnd: 0,
                      paddingInline: 7,
                    }}
                  >
                    {(fontes.arquivosSplitted || []).length} splitted
                  </Tag>
                </Tooltip>
              )}
              {(fontes.arquivosIgnorados || []).length > 0 ? (
                <Tooltip
                  title={
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{(fontes.arquivosIgnorados || []).length} arquivo(s) NÃO foram auditados (cap global de 5 batches):</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {(fontes.arquivosIgnorados || []).slice(0, 8).map((f) => <li key={f} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>{f}</li>)}
                        {(fontes.arquivosIgnorados || []).length > 8 && <li>+ {(fontes.arquivosIgnorados || []).length - 8} outros…</li>}
                      </ul>
                      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>Rode "Nova auditoria" depois de tratar os achados desta rodada — os arquivos não auditados podem virar achados novos.</div>
                    </div>
                  }
                >
                  <Tag
                    icon={<AlertCircle size={11} style={{ verticalAlign: 'text-top' }} />}
                    style={{
                      background: `${t.accents.peach}1a`,
                      color: t.accents.peach,
                      border: `1px solid ${t.accents.peach}66`,
                      fontFamily: FONTS.ui,
                      fontSize: 10.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginInlineEnd: 0,
                      paddingInline: 7,
                      cursor: 'help',
                    }}
                  >
                    {(fontes.arquivosIgnorados || []).length} arquivo(s) fora desta auditoria
                  </Tag>
                </Tooltip>
              ) : (fontes.codigoTruncado && !(fontes.batchesUsados && fontes.batchesUsados > 0)) ? (
                /* Fallback: auditoria antiga (pré-chunking) que tem só o flag binário. */
                <Tooltip title="O conteúdo enviado à IA passou do limite de contexto. Re-audite — a v1.147 fatia o diff automaticamente.">
                  <Tag
                    icon={<AlertCircle size={11} style={{ verticalAlign: 'text-top' }} />}
                    style={{
                      background: `${t.accents.peach}1a`,
                      color: t.accents.peach,
                      border: `1px solid ${t.accents.peach}66`,
                      fontFamily: FONTS.ui,
                      fontSize: 10.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginInlineEnd: 0,
                      paddingInline: 7,
                    }}
                  >
                    diff truncado (auditoria antiga)
                  </Tag>
                </Tooltip>
              ) : null}
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: FONTS.ui, fontSize: 11.5, color: t.accents.rose }}>
                Código não lido: {erro || 'fonte indisponível'}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {apiDesativada && (
                  <Button size="small" icon={<ExternalLink size={12} />} onClick={() => window.open('https://script.google.com/home/usersettings', '_blank', 'noopener')}>
                    Ativar Apps Script API
                  </Button>
                )}
                {(apiDesativada || githubDesconectado) && onReauditarCodigo && (
                  <Button size="small" type="primary" icon={<RefreshCw size={12} />} loading={reauditando} onClick={onReauditarCodigo}>
                    Tentar ler o código de novo
                  </Button>
                )}
                {(semFonte || fontes.fonteCodigo === 'gas' || apiDesativada) && (
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                    Versionado no GitHub? Conecte o <strong>repoUrl</strong> na ficha do sistema pra auditoria de código + incremental.
                  </span>
                )}
                {githubDesconectado && (
                  <span style={{ fontFamily: FONTS.ui, fontSize: 11, color: t.textTertiary }}>
                    Adicione o <strong>GITHUB_TOKEN</strong> em Configurações.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaudeBreakdownBlock({ saude, onRecalcular }: { saude: SaudeBreakdown; onRecalcular: () => void }): React.ReactElement {
  const t = useTokens();
  const cor = saude.score === 0 ? t.textTertiary : saude.score >= 70 ? t.accents.sage : saude.score >= 40 ? t.accents.peach : t.accents.rose;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONTS.ui, fontWeight: 500, fontSize: 14, color: t.text }}>Score de Saúde</span>
          <span style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 500, color: cor }}>
            {saude.score === 0 ? 'Não avaliado' : `${saude.score}%`}
          </span>
        </div>
        <Button size="small" icon={<RefreshCw size={13} />} onClick={onRecalcular}>Recalcular</Button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {saude.fatores.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, background: t.surface, border: `1px solid ${t.borderSoft}` }}>
            {f.ok ? <CheckCircle2 size={14} color={t.accents.sage} style={{ marginTop: 2, flexShrink: 0 }} /> : <XCircle size={14} color={t.accents.rose} style={{ marginTop: 2, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 13, color: t.text }}>{f.nome}</div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 12, color: t.textTertiary, marginTop: 1 }}>{f.detalhe}</div>
            </div>
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textTertiary, flexShrink: 0 }}>{f.pontos}/{f.max}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
