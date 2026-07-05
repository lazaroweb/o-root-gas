// Composição da fatura de um mês — funções PURAS usadas pela gaveta do cartão
// (importadas como módulo pelo client React) e testadas no vitest.
//
// Motivação: depois de importar uma fatura, o total do mês na gaveta é a soma
// de QUATRO origens diferentes — e quando ele não bate com o total do PDF, o
// usuário precisa ver O QUE somou:
//   • importados desta fatura (parcela atual + à vista, criados na importação);
//   • parcelas PROVISIONADAS por importações de faturas anteriores que vencem
//     neste mês (a "regra": a importação deve CONCILIAR com elas, não duplicar);
//   • recorrências (clones automáticos de assinaturas/mensalidades);
//   • lançamentos manuais.
// Além do raio-X, detecta DUPLICIDADE suspeita: a mesma parcela (x/y) da mesma
// compra aparecendo 2+ vezes no mês — o sintoma clássico de conciliação que
// falhou (IA extraiu descrição/valor diferente do provisionado).

export interface LancComposicao {
  id: string;
  descricao: string;
  valor: number;
  data?: string;
  vencimento?: string;
  tags?: string;
  notas?: string;
  parcelas?: number;
  parcelaAtual?: number;
  recorrencia?: string;
  recorrenciaOrigemId?: string;
  status?: string;
  criadoEm?: string;
}

export interface GrupoComposicao {
  total: number;
  qtd: number;
  ids: string[];
}

export interface SuspeitaDuplicidade {
  descricao: string;      // descrição da linha mantida (referência)
  parcela: string;        // 'x/y' ou '' (à vista)
  qtd: number;            // quantas cópias existem (>= 2)
  valorExcedente: number; // soma das cópias além da primeira
  ids: string[];          // ids de TODAS as cópias
}

export interface ComposicaoMes {
  mes: string;
  total: number;
  importadosAgora: GrupoComposicao;
  provisionadosAnteriores: GrupoComposicao;
  recorrencias: GrupoComposicao;
  manuais: GrupoComposicao;
  suspeitas: SuspeitaDuplicidade[];
  totalExcedente: number; // soma dos excedentes de todas as suspeitas
}

// 'YYYY-MM' de um valor que pode ser string ISO OU Date — no servidor (GAS) o
// Sheets converte células de data em objetos Date, e String(Date) quebraria o
// substring. No client os valores já chegam sanitizados como string.
function _mesDe(v: unknown): string {
  if (v && typeof v === 'object' && typeof (v as Date).getFullYear === 'function') {
    const d = v as Date;
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const s = String(v || '');
  return s.length >= 7 ? s.substring(0, 7) : '';
}

// Mês contábil da linha: vencimento manda; sem vencimento, mês da data.
export function mesDeLancamento(l: { vencimento?: unknown; data?: unknown }): string {
  const v = _mesDe(l.vencimento);
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  const d = _mesDe(l.data);
  return /^\d{4}-\d{2}$/.test(d) ? d : '';
}

// Espelha _normDescFatura/_descSemParcela do servidor: remove o "(x/y)" e
// normaliza (sem acento, minúscula, alfanumérica) pra agrupar a mesma compra.
export function normalizarDescricao(desc: string): string {
  return String(desc || '')
    .replace(/\bparc(?:ela)?\.?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/gi, ' ')
    .replace(/\(?\b\d{1,2}\s*\/\s*\d{1,2}\b\)?/g, ' ')
    .replace(/\b\d{1,2}\s+de\s+\d{1,2}\b/gi, ' ')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const NOTA_PROVISIONADA = 'Parcela futura provisionada';

// ─── Identidade de parcela (conciliação e dedupe) ─────────────────────────────
// Decide se duas linhas de parcela x/y (JÁ ancoradas por cartão + total de
// parcelas + nº da parcela) são a MESMA compra.
//
// Regra: VALOR é obrigatório + pelo menos um de (mês, descrição).
//
// Por quê valor obrigatório: duas compras DIFERENTES no mesmo estabelecimento,
// parceladas no mesmo nº de vezes e vencendo no mesmo mês (ex.: duas idas ao
// mercado, ambas em 2x, na mesma fatura) só se distinguem pelo VALOR. A regra
// antiga ("2 de 3 sinais") casava mês+descrição e FUNDIA as duas — a segunda
// compra sumia da fatura (caso real: 2x Atakarejo 01/02 na fatura Porto,
// R$ 415,86 e R$ 97,36; o total ficava R$ 97,36 menor).
//
// Por quê mês OU descrição (não ambos): cobre os dois desvios legítimos —
//   • parcela provisionada num mês e faturada no mês seguinte (mês difere);
//   • descrição truncada/variando entre faturas (descrição difere).
// Se o VALOR divergir (IA leu errado, juros embutido), NÃO concilia: a linha
// duplicada fica visível no painel de composição pro humano decidir — melhor
// um duplicado visível do que uma compra sumindo em silêncio.
export interface SinaisParcela {
  valorCents: number; // valor em centavos (arredondado)
  mes: string;        // competência 'YYYY-MM' ('' se desconhecida)
  desc: string;       // descrição normalizada (sem x/y, sem acento, minúscula)
}

export function parcelaConfere(a: SinaisParcela, b: SinaisParcela): boolean {
  const valOk = a.valorCents === b.valorCents;
  const mesOk = !!a.mes && a.mes === b.mes;
  const descOk = !!a.desc && a.desc === b.desc;
  return valOk && (mesOk || descOk);
}

function grupoVazio(): GrupoComposicao { return { total: 0, qtd: 0, ids: [] }; }

function acumula(g: GrupoComposicao, l: LancComposicao): void {
  g.total += Number(l.valor || 0);
  g.qtd += 1;
  g.ids.push(String(l.id));
}

// ─── Guarda anti-importação dupla ─────────────────────────────────────────────
// Resumo da importação JÁ existente de um mês (linhas com tag fatura-importada
// criadas POR uma importação daquele mês — provisões de faturas anteriores não
// contam). Se devolver algo, o mês já foi importado: o servidor bloqueia uma
// nova importação e a UI avisa, exigindo ação consciente (remover a anterior
// ou forçar). Vale pra qualquer cartão — a regra é sobre o conjunto de linhas.
export interface ImportacaoExistente {
  qtd: number;      // linhas criadas pela importação do mês
  total: number;    // soma delas
  ultimaEm: string; // criadoEm mais recente (quando foi importada)
}

export function resumoImportacaoDoMes(itens: LancComposicao[], mes: string): ImportacaoExistente | null {
  const doMes = itens.filter((l) =>
    String(l.tags || '').indexOf('fatura-importada') >= 0
    && String(l.notas || '').indexOf(NOTA_PROVISIONADA) < 0
    && mesDeLancamento(l) === mes);
  if (doMes.length === 0) return null;
  const total = Math.round(doMes.reduce((s, l) => s + Number(l.valor || 0), 0) * 100) / 100;
  const ultimaEm = doMes.reduce((m, l) => (String(l.criadoEm || '') > m ? String(l.criadoEm || '') : m), '');
  return { qtd: doMes.length, total, ultimaEm };
}

export function composicaoFaturaMes(itens: LancComposicao[], mes: string): ComposicaoMes {
  const doMes = itens.filter((l) => mesDeLancamento(l) === mes);

  const out: ComposicaoMes = {
    mes,
    total: 0,
    importadosAgora: grupoVazio(),
    provisionadosAnteriores: grupoVazio(),
    recorrencias: grupoVazio(),
    manuais: grupoVazio(),
    suspeitas: [],
    totalExcedente: 0,
  };

  for (const l of doMes) {
    out.total += Number(l.valor || 0);
    const importado = String(l.tags || '').indexOf('fatura-importada') >= 0;
    if (importado && String(l.notas || '').indexOf(NOTA_PROVISIONADA) >= 0) {
      // Criada por uma importação ANTERIOR como provisão de parcela futura —
      // pertence à cadeia da fatura antiga, ainda que vença neste mês.
      acumula(out.provisionadosAnteriores, l);
    } else if (importado) {
      acumula(out.importadosAgora, l);
    } else if (l.recorrenciaOrigemId || (l.recorrencia && l.recorrencia !== 'unica')) {
      acumula(out.recorrencias, l);
    } else {
      acumula(out.manuais, l);
    }
  }

  // Duplicidade suspeita no mês:
  //   • PARCELADA: a mesma parcela x/y da mesma compra (descrição normalizada)
  //     2+ vezes — impossível numa fatura legítima, mesmo com valor divergindo
  //     (juros/ajuste); é conciliação que falhou.
  //   • À VISTA: mesma descrição normalizada E mesmo valor (centavos) 2+ vezes —
  //     PODE ser legítimo (2 corridas iguais no mesmo mês), por isso é só
  //     "suspeita" pro humano decidir; não remove nada sozinho.
  const grupos = new Map<string, LancComposicao[]>();
  for (const l of doMes) {
    const totalParc = Number(l.parcelas || 0);
    const chave = totalParc > 1
      ? `p|${normalizarDescricao(l.descricao)}|${totalParc}|${Number(l.parcelaAtual || 0)}`
      : `a|${normalizarDescricao(l.descricao)}|${Math.round(Number(l.valor || 0) * 100)}`;
    const arr = grupos.get(chave) || [];
    arr.push(l);
    grupos.set(chave, arr);
  }
  for (const [chave, arr] of grupos) {
    if (arr.length < 2) continue;
    if (!normalizarDescricao(arr[0].descricao)) continue; // sem descrição útil, não acusa
    // Mesmo LOTE de importação (mesmo criadoEm): as linhas vieram juntas do
    // MESMO PDF — se a fatura listou as duas, são compras distintas legítimas
    // (ex.: duas compras no mesmo mercado, ambas 01/02, valores diferentes).
    // Duplicidade real de conciliação falhada é sempre ENTRE lotes/origens.
    const lotes = new Set(arr.map((l) => String(l.criadoEm || '')));
    if (lotes.size === 1 && !lotes.has('')) continue;
    // Mantém a "melhor" como referência: paga > agendada > pendente.
    const rank = (s?: string) => (s === 'pago' ? 0 : s === 'agendado' ? 1 : 2);
    const ordenado = [...arr].sort((a, b) => rank(a.status) - rank(b.status));
    const excedente = ordenado.slice(1).reduce((s, l) => s + Number(l.valor || 0), 0);
    const totalParc = Number(ordenado[0].parcelas || 0);
    out.suspeitas.push({
      descricao: String(ordenado[0].descricao || ''),
      parcela: chave.startsWith('p|') && totalParc > 1 ? `${Number(ordenado[0].parcelaAtual || 0)}/${totalParc}` : '',
      qtd: arr.length,
      valorExcedente: Math.round(excedente * 100) / 100,
      ids: ordenado.map((l) => String(l.id)),
    });
  }
  out.suspeitas.sort((a, b) => b.valorExcedente - a.valorExcedente);
  out.totalExcedente = Math.round(out.suspeitas.reduce((s, x) => s + x.valorExcedente, 0) * 100) / 100;
  out.total = Math.round(out.total * 100) / 100;
  return out;
}

// ─── Seleção do "desfazer importação do mês" ──────────────────────────────────
// Regras (itens já filtrados pelo cartão; todos com tag fatura-importada):
//   • REMOVE o que a importação do mês criou NO mês (parcela atual + à vista);
//   • REMOVE as parcelas FUTURAS que ESSA MESMA importação provisionou nos
//     meses à frente — identificadas pelo lote: toda linha de uma importação
//     nasce com o MESMO `criadoEm` (timestamp único do batch);
//   • PRESERVA as provisões criadas por importações ANTERIORES que vencem no
//     mês (cadeia da fatura antiga — o acidente do "sumiu a fatura anterior").
export interface SelecaoRemocaoImportacao {
  removerIds: string[];        // linhas do mês criadas pela importação
  futurasIds: string[];        // futuras provisionadas por ELA nos meses à frente
  preservados: number;         // provisões de importações anteriores mantidas
}

export function selecionarRemocaoImportacao(itens: LancComposicao[], mes: string): SelecaoRemocaoImportacao {
  const ehProvisao = (l: LancComposicao) => String(l.notas || '').indexOf(NOTA_PROVISIONADA) >= 0;
  const doMes = itens.filter((l) => mesDeLancamento(l) === mes);
  const remover = doMes.filter((l) => !ehProvisao(l));
  const preservados = doMes.length - remover.length;

  // Lote(s) da importação do mês: timestamps de criação das linhas removidas.
  const lotes = new Set(remover.map((l) => String(l.criadoEm || '')).filter(Boolean));
  const futuras = lotes.size === 0 ? [] : itens.filter((l) =>
    ehProvisao(l)
    && mesDeLancamento(l) > mes
    && lotes.has(String(l.criadoEm || '')));

  return {
    removerIds: remover.map((l) => String(l.id)),
    futurasIds: futuras.map((l) => String(l.id)),
    preservados,
  };
}
