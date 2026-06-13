// ─── Estágios do ciclo de vida ───────────────────────────────────────────────

export type Estagio = 'faisca' | 'forja' | 'tempera' | 'prateleira';

// ─── Resposta padrão do servidor ─────────────────────────────────────────────

export interface ServerResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
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
}

export interface Recurso {
  id: string;
  sistemaId: string;
  tipo: 'endpoint' | 'db' | 'env';
  chave: string;
  descricao: string;
  link: string;
}

export interface Decisao {
  id: string;
  sistemaId: string;
  data: string;
  titulo: string;
  decisao: string;
  justificativa: string;
  status: string;
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

export interface Custo {
  id: string;
  sistemaId: string;
  fornecedor: string;
  valor: number;
  recorrencia: string;
  proximaCobranca: string;
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

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSistemas: number;
  ativos: number;
  saudeMedia: number;
  custoMensal: number;
}

// ─── Navegação (views internas) ──────────────────────────────────────────────

export type ViewName = 'bancada' | 'sistema-form' | 'sistema-detail' | 'ideias' | 'oportunidades' | 'pessoas' | 'genese';

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
