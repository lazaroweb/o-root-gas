// ─── Estágios do ciclo de vida ───────────────────────────────────────────────

export type Estagio = 'faisca' | 'forja' | 'tempera' | 'prateleira';

// ─── Resposta padrão do servidor ─────────────────────────────────────────────

export interface ServerResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ServerResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─── Controle de acesso (RBAC) ───────────────────────────────────────────────

export type PapelAcesso = 'admin' | 'operacional' | 'leitor';

export interface MeuAcesso {
  email: string;
  nome: string;
  foto?: string;
  papel: PapelAcesso | null;
  isOwner: boolean;
  autenticado: boolean;
}

export interface UsuarioAcesso {
  id: string;
  email: string;
  nome: string;
  papel: string;
  ativo: boolean;
  criadoEm: string;
  isOwner: boolean;
}

// ─── Entidades (10 abas no Google Sheets) ────────────────────────────────────

export interface Sistema {
  id: string;
  nome: string;
  codinome: string;
  estagio: Estagio;
  proposito: string;
  stack: string;
  urlProd: string;
  scoreSaude: number;
  repoUrl?: string;
  scriptId?: string;
  webAppUrl?: string;
  dominioCustomizado?: string;
  saudeBreakdown?: string;
  saudeCalculadaEm?: string;
  removidoNoGas?: boolean | string;
  removidoNoGasEm?: string;
}

export interface SaudeBreakdown {
  score: number;
  fatores: Array<{ nome: string; pontos: number; max: number; ok: boolean; detalhe: string }>;
  calculadoEm: string;
}

export type AuditSeveridade = 'alta' | 'media' | 'baixa';

export interface AuditFinding {
  id: string;
  titulo: string;
  severidade: AuditSeveridade;
  area: string;
  problema: string;
  evidencia: string;
  solucao: string;
  prompt: string;
  toolSugerida?: string;
  toolParams?: Record<string, unknown>;
}

export interface AuditPayload {
  estadoGeral: string;
  oQueEmpolga: string[];
  proximosPassos: string;
  findings: AuditFinding[];
}

export interface AuditFontes {
  custos: number;
  decisoes: number;
  riscos: number;
  alertas: number;
  timeline: number;
  oportunidades: number;
  temProposito: boolean;
  temStack: boolean;
  temUrl: boolean;
  temRepo: boolean;
}

// Estado por finding registrado: persiste o vínculo audit ↔ entidade criada
// (decisão/risco/oportunidade) pra evitar registros duplicados ao reabrir.
export interface RegistroFinding {
  tipo: string;
  idCriado: string;
  registradoEm: string;
}

export interface AuditResult {
  id?: string;
  texto: string;
  payload: AuditPayload | null;
  fontes: AuditFontes;
  saudeAtual: SaudeBreakdown | null;
  modeloUsado: string;
  duracaoMs?: number;
  criadoEm?: string;
  registros?: Record<string, RegistroFinding>;
}

export interface UltimaAuditoriaInfo {
  id: string;
  sistemaId: string;
  criadoEm: string;
  modeloUsado: string;
  duracaoMs: number;
  scoreNoMomento: number;
  numFindings: number;
  texto: string;
  payload: AuditPayload | null;
  fontes: AuditFontes | null;
  saudeAtual: SaudeBreakdown | null;
  totalAuditorias: number;
  registros?: Record<string, RegistroFinding>;
}

export interface GASProjectCandidate {
  scriptId: string;
  nome: string;
  ultimaModificacao: string;
  webAppUrl?: string;
  descricao?: string;
  jaImportado: boolean;
  ownedByMe?: boolean;
  emSharedDrive?: boolean;
}

export type AlertaSeveridade = 'info' | 'aviso' | 'critico';

export interface Alerta {
  id: string;
  tipo: string;
  severidade: AlertaSeveridade;
  titulo: string;
  mensagem: string;
  sistemaId?: string;
  criadoEm: string;
  lidoEm?: string;
  dedupeKey: string;
  link?: string;
}

export interface RelatorioMensal {
  periodo: { mes: number; ano: number; mesNome: string; inicio: string; fim: string };
  kpis: {
    totalSistemas: number;
    totalClientes: number;
    totalIdeias: number;
    saudeMedia: number;
    custoMensal: number;
    mrr: number;
    lucro: number;
  };
  sistemas: Array<{
    id: string; nome: string; codinome: string; estagio: string; stack: string;
    scoreSaude: number; urlProd: string; custoMensal: number; incidentes: number;
  }>;
  clientes: Array<{ id: string; nome: string; contato: string }>;
  alertas: Array<{ tipo: string; severidade: string; titulo: string; mensagem: string; criadoEm: string }>;
  proximasContas: Array<{ fornecedor: string; valor: number; proximaCobranca: string; sistemaId: string }>;
  timelineRecente: Array<{ data: string; tipo: string; texto: string; sistemaId: string }>;
  resumoIA: string;
  geradoEm: string;
}

export interface WhatsappConfig {
  provider: 'meta' | 'twilio';
  destinos: string[];
  // Meta WhatsApp Cloud API
  metaToken: string;
  metaPhoneNumberId: string;
  metaTemplate: string;     // nome do template aprovado (vazio = manda texto: número de teste / janela 24h)
  metaTemplateLang: string; // ex.: pt_BR
  // Twilio WhatsApp
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;       // ex.: whatsapp:+14155238886
  // Flags read-only devolvidas pelo servidor (segredos nunca voltam preenchidos)
  metaTokenSet?: boolean;
  twilioTokenSet?: boolean;
}

export interface AutomationConfig {
  ativo: boolean;
  intervaloMin: number;
  canais: { email: boolean; webhook: boolean; whatsapp: boolean };
  webhookUrl: string;
  whatsapp: WhatsappConfig;
  regras: {
    appOffline: { ativo: boolean };
    apiOffline: { ativo: boolean };
    contaVence: { ativo: boolean; diasAntes: number };
    saudeBaixa: { ativo: boolean; minimo: number };
    custoSubiu: { ativo: boolean; pctLimite: number };
    mrrCaiu: { ativo: boolean; pctLimite: number };
    auditoriaAgendada: {
      ativo: boolean;
      frequenciaDias: number;
      maxPorCiclo: number;
      alertarSeAlta: boolean;
      pularAposentados: boolean;
    };
  };
  ultimaExec?: string;
}

export interface AuditoriaAgendadaStatus {
  ativo: boolean;
  frequenciaDias: number;
  maxPorCiclo: number;
  ultimoCiclo: string;
  proximoCicloEm: string;
  sistemas: {
    total: number;
    nuncaAuditados: number;
    stale: number;
    recentes: number;
    aposentadosPulados: number;
  };
  elegiveis: number;
}

export interface Recurso {
  id: string;
  sistemaId: string;
  tipo: 'endpoint' | 'db' | 'env';
  chave: string;
  descricao: string;
  link: string;
}

// Status do backlog Kanban:
// 'backlog'  → a fazer (entrada padrão de itens criados pela auditoria da IA)
// 'fazendo'  → em execução (geralmente quando você está codando isso no Cursor)
// 'feito'    → concluído
// 'pausado'  → revista/aguardando decisão externa
// 'cancelado'→ revertida/descartada
// Mantemos 'ativa', 'revista', 'revertida' como aliases legados pra não quebrar dados antigos.
export type DecisaoStatus = 'backlog' | 'fazendo' | 'feito' | 'pausado' | 'cancelado' | 'ativa' | 'revista' | 'revertida';

export interface Decisao {
  id: string;
  sistemaId: string;
  data: string;
  titulo: string;
  decisao: string;
  justificativa: string;
  status: DecisaoStatus | string;
  prioridade?: 'alta' | 'media' | 'baixa' | string;
  tags?: string;
  estimativa?: string;
}

export interface Risco {
  id: string;
  sistemaId: string;
  area: string;
  descricao: string;
  gravidade: number;
  historicoIncidentes: string;
}

export interface Ideia {
  id: string;
  titulo: string;
  descricao: string;
  notaImpacto: number;
  notaEsforco: number;
  estado: string;
}

export interface Oportunidade {
  id: string;
  titulo: string;
  pessoaId: string;
  valorEstimado: number;
  estado: string;
  proximoPasso: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  contato: string;
  papel: 'cliente' | 'parceiro';
  notas: string;
}

export interface AnaliseEntrevista {
  resumo: string;
  dores: string[];
  objetivos: string[];
  requisitos: string[];
  perguntasAbertas: string[];
  oportunidade: string;
}

export interface Entrevista {
  id: string;
  pessoaId: string;
  data: string;
  tipo: string;
  transcricao: string;
  resumoIA: string;
  requisitos: string;
  pessoaNome?: string;
  analise?: AnaliseEntrevista | null;
}

export interface Custo {
  id: string;
  sistemaId: string;
  fornecedor: string;
  valor: number;
  recorrencia: string;
  proximaCobranca: string;
  categoria?: string;
  sistemaNome?: string;
}

export interface Financeiro {
  kpis: {
    mrr: number; custoMensal: number; lucro: number; margem: number; margemRecorrente: number;
    assinaturasAtivas: number; aReceber45: number; aPagar45: number;
    despesasMes: number; saidaMes: number; resultadoMes: number;
  };
  porApp: Array<{ sistemaId: string; nome: string; mrr: number; custo: number; despesa: number; lucro: number }>;
  serie: Array<{ label: string; mrr: number; custo: number; despesa: number }>;
  vencimentos: Array<{ tipo: string; nome: string; descricao: string; valor: number; data: string; dias: number }>;
}

export interface Stack {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  docsUrl: string;
}

export interface Receita {
  id: string;
  sistemaId: string;
  pessoaId: string;
  plano: string;
  valor: number;
  recorrencia: string;
  status: string;
  inicio: string;
  proximaCobranca: string;
  canceladaEm?: string;
}

// ─── Receita recorrente (SaaS) — painel "A receber" enriquecido (v1.16) ────────

export interface MrrPorApp {
  sistemaId: string;
  nome: string;
  mrr: number;
  assinaturas: number;
  clientes: number;
}

export interface ProximaCobrancaReceita {
  id: string;
  sistemaId: string;
  app: string;
  cliente: string;
  plano: string;
  valor: number;
  recorrencia: string;
  proximaCobranca: string;
  dias: number; // negativo = atrasada
}

export interface ResumoReceitas {
  mrr: number;
  arr: number;
  assinaturasAtivas: number;
  clientesAtivos: number;
  arpu: number;
  novoMrrMes: number;
  novasAssinaturasMes: number;
  churnMrr: number;
  churnQtd: number;
  avulsasMesValor: number;
  avulsasMesQtd: number;
  recebidoMes: number;
  recebimentosMesQtd: number;
  inadimplenciaValor: number;
  inadimplenciaQtd: number;
  porApp: MrrPorApp[];
  proximas: ProximaCobrancaReceita[];
  aReceber45: number;
}

export interface Recebimento {
  id: string;
  receitaId: string;
  sistemaId: string;
  pessoaId: string;
  competencia: string;
  valor: number;
  data: string;
  recorrencia: string;
  notas?: string;
  criadoEm?: string;
}

export interface PlanoApp {
  id: string;
  sistemaId: string;
  nome: string;
  valor: number;
  recorrencia: string;
  descricao?: string;
  ativo?: string;
  ordem?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface ApiEndpoint {
  id: string;
  nome: string;
  provider: string;
  categoria: string;
  baseUrl: string;
  healthUrl: string;
  modelo: string;
  chaveRef: string;
  ultimoStatus: number;
  latenciaMs: number;
  sistemaId?: string;
}

export interface GitHubRepo {
  nome: string;
  fullName: string;
  descricao: string;
  url: string;
  linguagem: string;
  pushedAt: string;
  stars: number;
  issues: number;
  privado: boolean;
  sistemaId: string;
  sistemaNome: string;
}

export interface AppStatusItem {
  id: string;
  nome: string;
  estagio: Estagio;
  urlProd: string;
  temUrl: boolean;
  status: number;
  latenciaMs: number;
  conectado: boolean;
  endpoints: Array<{ id: string; nome: string; status: number; latenciaMs: number; conectado: boolean }>;
}

export interface MonitorStatus {
  ativo: boolean;
  intervaloMin: number;
  ultimaExec: string;
  snapshot: Array<{ tipo: string; nome: string; conectado: boolean; status: number }>;
}

export interface StatusGeral {
  llm: { configurado: boolean; conectado: boolean; latenciaMs?: number; detalhe: string };
  github: { configurado: boolean; conectado: boolean; latenciaMs?: number; detalhe: string };
  apis: { id: string; status: number; latenciaMs: number; conectado: boolean }[];
  resumo: { online: number; total: number };
}

// ─── Finanças Pessoais (v1.3) ────────────────────────────────────────────────

// Métodos de pagamento aceitos. Strings simples pra facilitar serialização no
// Sheet — sem precisar de tabela de lookup.
export type MetodoPagamento = 'cartao' | 'pix' | 'debito' | 'dinheiro' | 'boleto' | 'transferencia';

// Status do lançamento. 'agendado' = compromisso futuro já marcado no calendário.
export type StatusLancamento = 'pago' | 'pendente' | 'agendado';

// Tipo do lançamento. Despesa subtrai do saldo, entrada soma.
export type TipoLancamento = 'despesa' | 'entrada';

// Recorrência. MVP só usa 'unica' e 'mensal' nos cálculos — semanal/anual entram
// como metadados pra futura automação de parcelas/recorrências.
export type RecorrenciaPessoal = 'unica' | 'mensal' | 'semanal' | 'anual';

// Lançamento individual: uma despesa ou entrada.
// `valor` é sempre positivo; o `tipo` dita o sinal.
// `cartaoId` só faz sentido quando `metodo === 'cartao'`.
// `parcelas`/`parcelaAtual`: pra compras parceladas (3 de 12 → 3/12 no UI).
export interface LancamentoPessoal {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  categoria: string;
  metodo: MetodoPagamento;
  cartaoId?: string;
  status: StatusLancamento;
  vencimento?: string; // YYYY-MM-DD — relevante quando status=pendente|agendado
  parcelas?: number;
  parcelaAtual?: number;
  recorrencia?: RecorrenciaPessoal;
  tags?: string;
  notas?: string;
  // v1.3.1: grupo de parcelas (mesmo grupoId = mesma compra) e rastreio de recorrência
  parcelaGrupoId?: string;
  recorrenciaOrigemId?: string; // se preenchido, esse lançamento é um clone gerado
  recorrenciaAtiva?: 'sim' | 'nao'; // se 'nao', agendador para de gerar clones
  criadoEm?: string;
  atualizadoEm?: string;
}

// Recorrência enriquecida com info de quantos clones já foram gerados.
export interface RecorrenciaAtiva extends LancamentoPessoal {
  totalGerados: number;
  ultimoGeradoEm: string | null;
}

// Orçamento por categoria. Limite mensal opcional; quando zero, só conta gasto.
export interface OrcamentoPessoal {
  id: string;
  categoria: string;
  limiteMensal: number;
  cor?: string;
  ativo: 'sim' | 'nao';
  criadoEm?: string;
  atualizadoEm?: string;
}

// Categoria gerenciada (v1.3.2). `nome` é a chave normalizada (lowercase,
// sem acentos, espaços→underscore) usada nos lançamentos. `label` é o display.
// `ordem` controla posição na lista (ASC). Stats `qtdMes`, `totalMes`,
// `qtdTotal` vêm enriquecidas pelo server pra exibição.
export interface CategoriaPessoal {
  id: string;
  nome: string;
  label: string;
  emoji: string;
  // Nome do ícone lucide-react (kebab-case ex: 'shopping-cart'). A UI resolve
  // pra um componente real via mapa. Se vazio, usa fallback 'tag'.
  icone?: string;
  cor: string;
  ordem: number;
  ativo: 'sim' | 'nao';
  criadoEm?: string;
  atualizadoEm?: string;
  // Stats agregadas (preenchidas pelo server)
  qtdMes?: number;
  totalMes?: number;
  qtdTotal?: number;
}

// Progresso de orçamento no mês: usado pra renderizar barras de progresso.
export interface ProgressoOrcamentoItem {
  id: string;
  categoria: string;
  limite: number;
  cor: string;
  gasto: number;
  restante: number;
  pct: number;
  status: 'ok' | 'atencao' | 'estouro';
}
export interface ProgressoOrcamentos {
  mes: string;
  itens: ProgressoOrcamentoItem[];
}

// Cartão de crédito cadastrado pra cálculo de fatura aberta.
// `diaFechamento`/`diaVencimento`: 1-31 (UI lida com meses curtos).
export interface CartaoPessoal {
  id: string;
  nome: string;
  bandeira: string; // visa, master, elo, amex, hiper, outra
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  cor: string; // hex pra UI
  apelido?: string;
  ativo: 'sim' | 'nao';
  criadoEm?: string;
  atualizadoEm?: string;
  emAberto?: number; // soma dos lançamentos de cartão não pagos (enriquecido no get)
  disponivel?: number; // limite - emAberto (enriquecido no get)
  aPagarMes?: number; // pendente da fatura do mês selecionado (competência); 0 = paga
}

// Resumo agregado de um mês: alimenta os cards do dashboard pessoal.
export interface ResumoFinPessoal {
  mes: string; // YYYY-MM
  mesAnterior: string;
  totalDespesas: number;
  totalEntradas: number;
  saldo: number;
  totalDespesasAnt: number;
  deltaPct: number;
  deltaAbs: number;
  totalPendente: number;
  qtdPendentes: number;
  aPagarMes: number;
  qtdAPagarMes: number;
  pagoMes: number;
  qtdPagoMes: number;
  pendentesLista?: LancamentoPessoal[];
  totalProximos7d: number;
  qtdProximos7d: number;
  porCategoria: Record<string, number>;
  porMetodo: Record<string, number>;
  totalLancamentos: number;
}

// Fatura aberta de um cartão: janela atual + lançamentos contabilizados.
export interface FaturaAberta {
  cartao: CartaoPessoal;
  mes: string;
  inicio: string; // YYYY-MM-DD do dia seguinte ao fechamento anterior
  fim: string; // YYYY-MM-DD do dia de fechamento desse mês
  diaVencimento: number;
  total: number;
  limite: number;
  pctLimite: number;
  disponivel: number;
  lancamentos: LancamentoPessoal[];
  qtdLancamentos: number;
}

// Lançamentos de um cartão (qualquer mês/status) — alimenta a gaveta de fatura
// pra encontrar e remover itens fora da janela atual.
export interface LancamentosCartao {
  lancamentos: LancamentoPessoal[];
  total: number;
  qtd: number;
  qtdImportados: number;
}

// ─── Assinaturas (v1.8) ──────────────────────────────────────────────────────

export type CicloAssinatura = 'mensal' | 'anual';
export type StatusAssinatura = 'ativa' | 'pausada' | 'cancelada';

// Serviço recorrente (Netflix, Spotify, ChatGPT...). `valor` é o preço por
// ciclo; o custo mensal equivalente normaliza anual→mensal (valor/12).
export interface AssinaturaPessoal {
  id: string;
  nome: string;
  categoria: string; // streaming, musica, software, ia, cloud, jogos, etc.
  valor: number;
  ciclo: CicloAssinatura;
  diaCobranca: number; // 1-31
  metodo: MetodoPagamento;
  cartaoId?: string;
  status: StatusAssinatura;
  dataInicio?: string; // YYYY-MM-DD
  cor: string; // hex da marca
  icone?: string; // nome lucide kebab-case
  plano?: string; // ex: "Premium 4K", "Família"
  notas?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

// ─── Importação de fatura via IA (v1.10) ──────────────────────────────────────

// Item extraído de uma fatura pela IA (uma compra/lançamento).
export interface FaturaItemIA {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  categoria: string;
  conta?: string; // conta do plano de contas (quando classificado pelo Gemini)
  grupo?: string; // grupo/centro de custo do plano de contas
}

// Resultado da interpretação de uma fatura pela IA.
export interface FaturaInterpretada {
  emissor: string;
  periodo: string;
  total: number;
  itens: FaturaItemIA[];
  modelo?: string;
  fonte?: string; // 'gemini' | 'proxy'
}

// ─── Despesas da empresa: livro-caixa mensal (v1.15) ──────────────────────────

export type StatusDespesa = 'pago' | 'pendente' | 'agendado';

export interface DespesaEmpresa {
  id: string;
  data: string; // YYYY-MM-DD
  competencia: string; // YYYY-MM (mês de referência)
  fornecedor: string;
  descricao: string;
  categoria: string;
  valor: number;
  sistemaId?: string; // app/sistema vinculado (opcional)
  status: StatusDespesa;
  formaPagamento?: string;
  origem?: 'manual' | 'import';
  documento?: string; // nome do PDF importado
  notas?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface ResumoDespesasEmpresa {
  competencia: string;
  total: number;
  pago: number;
  pendente: number;
  qtd: number;
  deltaPct: number | null;
  porCategoria: Array<{ categoria: string; total: number }>;
  serie: Array<{ label: string; total: number }>;
  porApp: Array<{ sistemaId: string; nome: string; total: number }>;
}

// Item extraído de uma conta/recibo pela IA (Gemini multimodal).
export interface ReciboItemIA {
  data: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  categoria: string;
}

export interface ReciboInterpretado {
  fornecedor: string;
  data: string;
  total: number;
  categoria: string;
  itens: ReciboItemIA[];
  modelo?: string;
  fonte?: string; // 'gemini'
}

// ─── Família: membros + cobranças compartilhadas (v1.12) ──────────────────────

export interface FamiliaMembro {
  id: string;
  nome: string;
  relacao?: string; // filha, irmã, cunhada…
  cor: string;
  emoji?: string;
  pix?: string; // chave PIX exibida no PDF de cobrança
  telefone?: string;
  ativo: 'sim' | 'nao';
  notas?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export type StatusCobranca = 'pendente' | 'pago';
export type OrigemCobranca = 'manual' | 'lancamento' | 'assinatura';

export interface Cobranca {
  id: string;
  membroId: string;
  descricao: string;
  valor: number;
  competencia: string; // YYYY-MM
  status: StatusCobranca;
  origem: OrigemCobranca;
  origemId?: string;
  recorrente: 'sim' | 'nao';
  dataPagamento?: string;
  notas?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface MembroResumo {
  membro: FamiliaMembro;
  totalPendente: number;
  totalPago: number;
  qtdCobrancas: number;
  qtdPendentes: number;
}

export interface NaoAtribuido {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  cartaoId: string;
}

export interface ResumoFamilia {
  competencia: string;
  membros: MembroResumo[];
  totalAReceber: number;
  totalRecebido: number;
  qtdMembros: number;
  naoAtribuidos: NaoAtribuido[];
  totalNaoAtribuido: number;
}

// Conta do plano de contas / centro de custo.
export interface PlanoConta {
  id: string;
  codigo: string;
  grupo: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  descricao?: string;
  cor: string;
  ordem: number;
  ativo: 'sim' | 'nao';
  criadoEm?: string;
  atualizadoEm?: string;
}

// Próxima cobrança de uma assinatura no mês corrente.
export interface ProximaCobranca {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  diaCobranca: number;
  valorMes: number;
  ciclo: string;
  jaPassou: boolean;
}

// Resumo agregado das assinaturas: alimenta os KPIs e gráficos da aba.
export interface ResumoAssinaturas {
  totalMensal: number; // custo mensal equivalente das ativas
  totalAnual: number; // totalMensal * 12
  qtdAtivas: number;
  qtdPausadas: number;
  qtdCanceladas: number;
  mediaPorAssinatura: number;
  porCategoria: Record<string, number>; // custo mensal equivalente por categoria
  proximasCobrancas: ProximaCobranca[];
  maisCara: { nome: string; valorMes: number; cor: string } | null;
}

// ─── Inteligência financeira / Norte (v1.9) ──────────────────────────────────

export interface ConfigFinanceira {
  rendaMensal: number;
  metaReservaMeses: number;
  reservaAtual: number;
  rendimentoAnual: number; // % a.a. usado nas projeções de patrimônio
}

// Item de despesa fixa (origem: recorrência de lançamento ou assinatura).
export interface FixaItem {
  id: string;
  nome: string;
  valorMes: number; // já normalizado pra mensal
  categoria: string;
  cartaoId: string;
  metodo: string;
  origem: 'recorrencia' | 'assinatura' | string;
  ciclo: string;
}

export interface PlanoReducaoItem {
  id: string;
  tipo: string; // consolidar | alerta | habito
  severidade: 'alta' | 'media' | 'baixa' | string;
  titulo: string;
  descricao: string;
  economiaEstimadaMes: number;
  itens?: string[];
}

export interface InsightFinanceiro {
  tipo: 'positivo' | 'alerta' | 'neutro' | string;
  texto: string;
}

export interface CartaoComprometimento {
  id: string;
  nome: string;
  cor: string;
  limite: number;
  totalFixoMes: number;
  qtdItens: number;
  pctLimite: number;
}

export interface ReservaInfo {
  metaMeses: number;
  metaValor: number;
  reservaAtual: number;
  faltaReserva: number;
  progressoReserva: number; // 0..1
  mesesParaMeta: number | null;
}

export interface ProjMes { mes: string; label: string; saldo: number }
export interface ProjAno { ano: number; patrimonio: number; aportado: number }

export interface InteligenciaFinanceira {
  configurado: boolean;
  rendaMensal: number;
  rendaFonte: 'declarada' | 'recorrencias' | 'media3m' | string;
  rendaDeclarada: number;
  rendaDerivada: number;
  totalFixasMensal: number;
  despesasVariaveisMedia: number;
  variaveisPorCategoria: Record<string, number>;
  variaveisMesesBase: number;
  custoMensalTotal: number;
  capacidadePoupanca: number;
  comprometimento: number; // 0..1
  taxaPoupanca: number; // 0..1
  score: number | null;
  fixasItens: FixaItem[];
  porCategoria: Record<string, number>;
  porCartao: CartaoComprometimento[];
  semCartao: number;
  qtdFixas: number;
  reserva: ReservaInfo;
  proj12: ProjMes[];
  projLongo: ProjAno[];
  rendimentoAnual: number;
  plano: PlanoReducaoItem[];
  economiaPotencialMes: number;
  insights: InsightFinanceiro[];
}

export interface PlanoIA {
  texto: string;
  modelo: string;
  latenciaMs?: number;
  criadoEm: string;
}

// ─── Perfil familiar ideal (orçamento-alvo) ───────────────────────────────────

export interface PerfilIdealItem {
  id: string;
  categoria: string;
  descricao: string;
  valorMensal: number;
  essencial: boolean;
  ordem: number;
  notas: string;
}

export interface PerfilIdealComparativoLinha {
  categoria: string;
  ideal: number;
  real: number;
  diff: number;
  status: 'dentro' | 'atencao' | 'acima' | 'sem_meta' | 'sem_gasto' | string;
}

export interface PerfilIdealComparativo {
  configurado: boolean;
  rendaMensal: number;
  rendaConfigurada: boolean;
  itens: PerfilIdealItem[];
  comparativo: PerfilIdealComparativoLinha[];
  totalIdeal: number;
  totalIdealEssencial: number;
  totalReal: number;
  diferencaTotal: number;
  saldoIdeal: number;
  saldoReal: number;
  qtdItens: number;
}

// ─── Ideal × Real (de-para + comparação) ──────────────────────────────────────

export interface IdealComparavelLinha {
  categoria: string;
  ideal: number;
  real: number;
  diff: number;
  status: 'dentro' | 'atencao' | 'acima' | 'sem_gasto' | string;
  fontes: Array<{ categoriaReal: string; valor: number }>;
}

export interface IdealForaLinha {
  categoriaReal: string;
  real: number;
  destino: '' | 'cortar' | 'fora' | string;
}

export interface IdealComparativo {
  rendaMensal: number;
  rendaConfigurada: boolean;
  temIdeal: boolean;
  idealCategorias: string[];
  totalIdeal: number;
  comparaveis: IdealComparavelLinha[];
  foraDoIdeal: IdealForaLinha[];
  totalRealComparavel: number;
  totalFora: number;
  totalCortar: number;
  qtdFora: number;
}

export interface IdealAnaliseIA {
  mapeamentos: Array<{ categoriaReal: string; destino: string; motivo: string }>;
  resumo: string;
  modelo: string;
}

export interface OfensorIdeal {
  categoria: string;
  tipo: 'cortar' | 'adequar' | 'extra' | 'rever' | string;
  atual: number;
  alvo: number;
  economia: number;
}

export interface PlanoIdealRegistro {
  texto: string;
  modelo: string;
  criadoEm: string;
}

export interface PlanoIdealResumo {
  renda: number;
  rendaConfigurada: boolean;
  totalIdeal: number;
  totalRealAtual: number;
  gap: number;
  economiaPotencial: number;
  sobraNoIdeal: number;
  pctAlinhado: number;
  ofensores: OfensorIdeal[];
  ultimoPlano: PlanoIdealRegistro | null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardData {
  kpis: { mrr: number; custoMensal: number; lucro: number; saudeMedia: number };
  mrrSeries: Array<{ label: string; valor: number }>;
  custoSerie?: number[];
  lucroSerie?: number[];
  apps: Array<{ id: string; nome: string; estagio: Estagio; cliente: string; mrr: number; saude: number; status: string; removidoNoGas?: boolean }>;
  contas: Array<{ tipo: string; nome: string; descricao: string; valor: number; data: string; dias: number }>;
  totais: { sistemas: number; ativos: number; assinaturas: number };
}

export interface Settings {
  llm: { baseUrl: string; modelo: string; provider: string; temChave: boolean };
  gemini?: { modelo: string; temChave: boolean };
  github: { usuario: string; temToken: boolean };
}

export interface Pulso {
  id: string;
  sistemaId: string;
  urlCheck: string;
  ultimoStatus: number;
  latenciaMs: number;
}

export interface TimelineEntry {
  id: string;
  sistemaId: string;
  data: string;
  tipo: 'ship' | 'incidente';
  texto: string;
}

// ─── Códex (v1.4) ────────────────────────────────────────────────────────────
// O "DNA de desenvolvimento" do usuário. Padrões reutilizáveis organizados em
// seções, com opt-in pra alimentar a Forja IA como contexto vivo.

export interface CodexSecao {
  id: string;
  key: string;
  label: string;
  // Nome do ícone lucide kebab-case (ex: 'palette', 'layers').
  icone: string;
  descricao: string;
  ordem: number;
  criadoEm?: string;
  // Enriquecido pelo server em getCodex():
  cards?: CodexCard[];
  qtdCards?: number;
}

export interface CodexCard {
  id: string;
  secaoId: string;
  titulo: string;
  // Conteúdo principal. Aceita markdown — quebras de linha viram <br>.
  valor: string;
  // URL opcional (link pra docs, figma, exemplo).
  referencia?: string;
  // CSV (ex: "design,icone,foundation").
  tags?: string;
  // 'sim' ou 'nao'. Default 'sim' — opt-out explícito pra excluir da IA.
  incluirEmIa?: 'sim' | 'nao';
  ordem: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface CodexPreview {
  texto: string;
  caracteres: number;
  // Estimativa ~ chars/4 (regra prática Anthropic).
  tokens: number;
}

// ─── Dashboard Operacional (v1.4.4) ──────────────────────────────────────────
// Dashboard repaginado pra ser técnico/operacional. Lucro/MRR/contas saíram
// pra Financeiro (privacidade + foco). Este payload alimenta o hero técnico
// + painel de alertas e atividade recente.

export interface DashboardOperacional {
  alertasNaoLidos: number;
  alertasTop: Alerta[];
  decisoesAbertas: number;
  decisoesRecentes: Array<{
    id: string;
    sistemaId: string;
    sistemaNome: string;
    titulo: string;
    status: string;
    prioridade: string;
    data: string;
  }>;
  findingsAbertos: number;
  breakdown: {
    rascunho: number;
    forja: number;
    tempera: number;
    prateleira: number;
    atencao: number;
  };
}

// ─── Modelo LLM badge (v1.4.3) ───────────────────────────────────────────────
// Suporta o componente ModeloBadge que mostra qual LLM está sendo usado
// em cada operação, com sugestão contextual quando há modelo melhor pro uso.

export type ModeloTier = 'premium' | 'balanceado' | 'rapido' | 'economico' | 'desconhecido';

export interface ModeloInfo {
  configurado: boolean;
  modelo: string;
  tier: ModeloTier;
  familia: 'anthropic' | 'openai' | 'google' | 'meta' | 'mistral' | 'outros';
  rotulo: string;
  provider?: string;
  // Sugestão opcional quando há modelo melhor pro contexto de uso
  sugestao?: {
    motivo: string;
    modeloSugerido?: string;
  };
  // Farol de saúde baseado na última chamada LLM (verde/vermelho/cinza)
  saude?: 'verde' | 'vermelho' | 'desconhecido';
  ultimaChamada?: {
    ts: number;
    ok: boolean;
    modelo: string;
    latenciaMs?: number;
    erro?: string;
  } | null;
}

// ─── Receituário (v1.4.2) ────────────────────────────────────────────────────
// Catálogo de features reutilizáveis que o user já construiu. Cada receita
// descreve uma feature transferível com passo-a-passo de implementação.

export type ComplexidadeReceita = 'baixa' | 'media' | 'alta';

export interface Receita {
  id: string;
  nome: string;
  descricao: string;
  // Categoria-chave (ui, ai, data, finance, security, deploy, integration, etc.)
  categoria: string;
  // Markdown longo: como funciona, dependências, passo-a-passo de replicação.
  conteudo: string;
  // CSV (ex: "kanban,backlog,decisao")
  tags?: string;
  complexidade?: ComplexidadeReceita;
  // String livre — "1h", "3-4h", "1 dia", "1 semana"
  tempoEstimado?: string;
  // CSV de arquivos relacionados no projeto fonte (opcional, ajuda achar)
  arquivos?: string;
  // CSV das tecnologias compatíveis (ex: "react,typescript,gas")
  stack?: string;
  // Nome do ícone lucide kebab-case
  icone?: string;
  ordem: number;
  // 'sim' fixa no topo da lista
  destaque?: 'sim' | 'nao';
  // Markdown com exemplo concreto (geralmente um trecho de código) do que a
  // receita faz na prática — renderizado em bloco destacado no drawer.
  exemplo?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSistemas: number;
  ativos: number;
  saudeMedia: number;
  custoMensal: number;
}

// ─── Navegação (views internas) ──────────────────────────────────────────────

export type ViewName =
  | 'dashboard'
  | 'clientes'
  | 'ideias'
  | 'sistemas'
  | 'operacoes'
  | 'financeiro'
  | 'forja-ia'
  | 'relatorios'
  | 'atelier'
  | 'configuracoes'
  | 'sistema-form'
  | 'sistema-detail'
  | 'oportunidades'
  | 'genese';

// ─── google.script.run type declaration ──────────────────────────────────────

interface GoogleScriptRun {
  withSuccessHandler<T>(handler: (result: T) => void): GoogleScriptRun;
  withFailureHandler(handler: (err: Error) => void): GoogleScriptRun;
  [fnName: string]: unknown;
}

declare const google: {
  script: {
    run: GoogleScriptRun & Record<string, (...args: unknown[]) => void>;
  };
};
