// Contrato compartilhado com o app principal (Forja). Mantém em sincronia com
// forja/src/types.ts (DiscoveryForm / perguntas estruturadas).

export type CampoTipo = 'sim_nao' | 'escala' | 'unica' | 'multipla' | 'texto' | 'texto_longo';

export interface PerguntaForm {
  id: string;
  texto: string;
  tipo: CampoTipo;
  opcoes?: string[];
  obrigatorio?: boolean;
  ajuda?: string;
}

export interface BlocoForm {
  tema: string;
  perguntas: PerguntaForm[];
}

export interface FormPublico {
  ok: boolean;
  error?: string;
  titulo?: string;
  cliente?: string;
  empresa?: string;
  primeiroNome?: string;
  intro?: string;
  blocos?: BlocoForm[];
}

export interface SubmitPayload {
  token: string;
  nome: string;
  email: string;
  respostas: Record<string, unknown>;
  ferramentas: string[];
  querAmostra: boolean;
  agendaPref: string;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  mensagem?: string;
}
