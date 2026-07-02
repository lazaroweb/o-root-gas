// Fonte ÚNICA do score determinístico de oportunidade (0-100) — compartilhada
// entre o app principal (forja) e o discovery público (forja-public). Os DOIS
// builds injetam este arquivo no início do dist/Server.js (ver esbuild.mjs de
// cada projeto), então a fórmula só existe aqui: corrigir num lugar corrige nos
// dois. Função PURA — sem dependência de GAS — pra ser testável com vitest.
//
// Componentes (máximos): completude 40 · ferramentas 12 · riquezaTexto 18 ·
// pediuAmostra 15 · agenda 8 · contato 7 = 100.

export interface ScoreOportunidadeInput {
  respostas?: Record<string, unknown>;
  ferramentas?: unknown[];
  querAmostra?: boolean;
  agendaPref?: string;
  nome?: string;
  email?: string;
  totalPerguntas?: number;
}

export interface ScoreOportunidadeResultado {
  score: number;
  breakdown: Record<string, number>;
}

export function scoreOportunidadeCore(input: ScoreOportunidadeInput): ScoreOportunidadeResultado {
  const respostas = input.respostas || {};
  const total = Math.max(1, Number(input.totalPerguntas || Object.keys(respostas).length) || 1);
  const respondidas = Object.keys(respostas).filter((k) => {
    const v = respostas[k];
    return v !== null && v !== undefined && String(v).trim() !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const completude = Math.round((respondidas / total) * 40); // até 40
  const ferramentas = Array.isArray(input.ferramentas) ? input.ferramentas.filter((x) => String(x || '').trim()) : [];
  const ferramentasPts = ferramentas.length ? Math.min(12, 4 + ferramentas.length * 2) : 0; // até 12
  // riqueza de texto livre — sinaliza clareza/engajamento
  let chars = 0;
  Object.keys(respostas).forEach((k) => { const v = respostas[k]; if (typeof v === 'string') chars += v.trim().length; });
  const textoPts = Math.min(18, Math.round(chars / 40)); // até 18
  const amostraPts = input.querAmostra ? 15 : 0;
  const agendaPts = String(input.agendaPref || '').trim() ? 8 : 0;
  const contatoPts = (String(input.nome || '').trim() && String(input.email || '').trim()) ? 7 : 0;
  const breakdown = {
    completude, ferramentas: ferramentasPts, riquezaTexto: textoPts,
    pediuAmostra: amostraPts, agenda: agendaPts, contato: contatoPts,
  };
  let score = completude + ferramentasPts + textoPts + amostraPts + agendaPts + contatoPts;
  if (score > 100) score = 100;
  return { score, breakdown };
}
