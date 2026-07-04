// Parsing de JSON vindo de LLM (fatura de cartão e afins) — funções PURAS,
// testadas no vitest e injetadas no topo do dist/Server.js pelo esbuild.mjs
// (GAS não tem ESM). A cadeia completa está em extrairJsonFaturaCore:
//
//   1. remove blocos <think> (modelos "thinking" prefixam raciocínio);
//   2. tenta o parse direto (tolerando cercas markdown e texto ao redor);
//   3. repara números em formato BR ("valor": 1.285,90 quebra o JSON.parse);
//   4. repara JSON TRUNCADO pelo limite de tokens (corta no último objeto
//      completo e fecha o que ficou aberto) — fatura grande estourava o limite
//      de saída e a importação falhava inteira; agora recupera os itens
//      completos e a conciliação aponta o que faltou.

// Remove raciocínio de modelos "thinking". Blocos fechados somem; um <think>
// ABERTO (resposta truncada no meio do raciocínio) derruba tudo dali em diante
// — se o JSON não começou, não há o que aproveitar.
export function limparPensamentoCore(texto: string): string {
  let s = String(texto || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const aberto = s.indexOf('<think>');
  if (aberto >= 0) s = s.slice(0, aberto).trim();
  return s;
}

// Extrai JSON de uma resposta do LLM (tolera ```json e texto ao redor).
export function extrairJsonCore(texto: string): unknown {
  let s = String(texto || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(s); } catch { /* tenta recortar */ }
  const ini = Math.min(...[s.indexOf('{'), s.indexOf('[')].filter(i => i >= 0).concat([Infinity]));
  const fim = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (ini !== Infinity && fim > ini) {
    try { return JSON.parse(s.slice(ini, fim + 1)); } catch { /* falhou */ }
  }
  throw new Error('A IA não retornou um JSON válido.');
}

// A IA às vezes escreve valores no formato BR (ex.: 1.285,90) dentro dos campos
// numéricos da fatura — o que quebra o JSON.parse (vírgula no meio do número).
// Normaliza SÓ os campos conhecidos (valor/total) pra ponto decimal e remove
// separador de milhar; também converte de string ("1285,90") pra número.
export function repararNumerosFaturaCore(s: string): string {
  return String(s || '').replace(
    /("(?:valor|total)"\s*:\s*)"?(-?\d[\d.]*(?:,\d+)?)"?/g,
    (_m, pre: string, num: string) => {
      let n = num;
      if (n.indexOf(',') >= 0) n = n.replace(/\./g, '').replace(',', '.');
      return `${pre}${n}`;
    },
  );
}

// Repara um JSON TRUNCADO (resposta cortada pelo limite de tokens): corta no
// último '}' completo e fecha as chaves/colchetes que ficaram abertos, tentando
// do fim pro começo até parsear. Recupera os objetos completos e descarta só o
// que ficou pela metade — muito melhor que perder o lote inteiro.
export function repararJsonTruncadoCore(s: string): unknown | null {
  let str = String(s || '').trim();
  const ini = str.indexOf('{');
  if (ini < 0) return null;
  str = str.slice(ini);
  for (let cut = str.length; cut > 1;) {
    const idx = str.lastIndexOf('}', cut - 1);
    if (idx < 0) return null;
    const frag = str.slice(0, idx + 1);
    // Rastreia aberturas fora de strings pra saber o que falta fechar.
    let dentroStr = false, esc = false;
    const pilha: string[] = [];
    for (let i = 0; i < frag.length; i++) {
      const ch = frag[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { dentroStr = !dentroStr; continue; }
      if (dentroStr) continue;
      if (ch === '{' || ch === '[') pilha.push(ch);
      else if (ch === '}' || ch === ']') pilha.pop();
    }
    if (!dentroStr) {
      const fecho = pilha.reverse().map((c) => (c === '{' ? '}' : ']')).join('');
      try { return JSON.parse(frag + fecho); } catch { /* recua mais um objeto */ }
    }
    cut = idx;
  }
  return null;
}

// Parser tolerante usado pelos extratores de fatura (texto e Gemini). Ordem:
// parse normal → números BR reparados → reparo de truncamento. Lança se nada
// aproveitável sobrar.
export function extrairJsonFaturaCore(texto: string): unknown {
  const semThink = limparPensamentoCore(texto);
  try { return extrairJsonCore(semThink); } catch { /* segue a cadeia */ }
  const numerado = repararNumerosFaturaCore(semThink);
  try { return extrairJsonCore(numerado); } catch { /* segue a cadeia */ }
  const reparado = repararJsonTruncadoCore(numerado) ?? repararJsonTruncadoCore(semThink);
  if (reparado !== null) return reparado;
  throw new Error('A IA não retornou um JSON válido.');
}
