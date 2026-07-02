// ─────────────────────────────────────────────────────────────────────────────
// FORJA — Formulário público de Discovery (projeto Apps Script SEPARADO)
//
// Segurança (OWASP 2025):
//  • Superfície mínima: este projeto expõe SÓ doGet + 2 funções (ler form por
//    token; gravar resposta). Nenhuma função administrativa da Forja existe aqui,
//    então não há o que vazar via google.script.run (A01 por construção).
//  • executeAs = dono (USER_DEPLOYING): grava na MESMA planilha (FORJA_SHEET_ID),
//    sem o visitante precisar autenticar.
//  • Toda entrada é tratada como hostil: validada, truncada e sanitizada (A05).
//  • Falha fechada com mensagens genéricas; nada de stack pro cliente (A10).
//  • Rate-limit leve por token + teto de respostas por token (A06).
//  • Token é UUID (não-sequencial): dificulta enumeração dos formulários.
// ─────────────────────────────────────────────────────────────────────────────

// Colunas espelhando forja/src/server.ts (SCHEMA). Mantenha em sincronia.
var COLS_FORMS = ['id', 'pessoaId', 'titulo', 'segmento', 'perguntasJson', 'token', 'status', 'criadoEm', 'publicadoEm'];
var COLS_RESP = ['id', 'formId', 'pessoaId', 'emailRespondente', 'nome', 'respostasJson', 'ferramentasJson', 'querAmostra', 'agendaPref', 'score', 'scoreBreakdownJson', 'criadoEm'];
var COLS_PESSOAS = [
  'id', 'nome', 'contato', 'papel', 'notas', 'email',
  'nomeContato', 'cargo', 'telefone',
  'empresa', 'cnpj', 'segmento', 'cidade', 'uf', 'site', 'instagram',
  'faturamentoFaixa', 'funcionariosFaixa', 'tempoOperacaoAnos',
  'ticketPrevisto', 'statusComercial', 'origemContato', 'proximaAcao',
];

// Limites anti-abuso (A06/A10).
var MAX_NOME = 120;
var MAX_EMAIL = 160;
var MAX_AGENDA = 240;
var MAX_RESP_LEN = 2000;
var MAX_RESPOSTAS = 200;
var MAX_FERRAMENTAS = 25;
var MAX_FERR_LEN = 80;
var MAX_RESP_POR_FORM = 50;
var THROTTLE_SEG = 4;

interface ServerOk { ok: boolean; error?: string; [k: string]: unknown; }

// ─── Planilha compartilhada ───────────────────────────────────────────────────

function _ss(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  var props = PropertiesService.getScriptProperties();
  var id = '';
  try { id = String(props.getProperty('FORJA_SHEET_ID') || '').trim(); } catch (e) { id = ''; }
  // Fallback: como rodamos como o dono, localizamos a planilha da Forja pelo nome
  // e cacheamos o ID — assim não exige configurar FORJA_SHEET_ID na mão.
  if (!id) {
    try {
      var it = DriveApp.getFilesByName('FORJA — Base de Dados');
      if (it.hasNext()) { id = it.next().getId(); props.setProperty('FORJA_SHEET_ID', id); }
    } catch (e2) { /* sem permissão de Drive ainda */ }
  }
  if (!id) throw new Error('CONFIG: defina a Script Property FORJA_SHEET_ID com o ID da planilha da Forja.');
  return SpreadsheetApp.openById(id);
}

// Rode 1x no editor (botão Executar) para autorizar os escopos do projeto.
function autorizar(): string {
  try { _ss(); } catch (e) { /* o consentimento já terá sido solicitado */ }
  return 'ok';
}

function _readRows(sheetName: string, cols: string[]): Record<string, unknown>[] {
  var sheet = _ss().getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return values.map(function (row) {
    var obj: Record<string, unknown> = {};
    cols.forEach(function (c, i) { obj[c] = row[i]; });
    return obj;
  });
}

function _append(sheetName: string, cols: string[], data: Record<string, unknown>): void {
  var sheet = _ss().getSheetByName(sheetName);
  if (!sheet) throw new Error('Planilha sem a aba ' + sheetName + '. Abra a Forja uma vez para criá-la.');
  var id = Utilities.getUuid();
  var row = cols.map(function (c) {
    if (c === 'id') return id;
    return data[c] !== undefined && data[c] !== null ? data[c] : '';
  });
  sheet.appendRow(row);
}

function _setEmailPessoaSeVazio(pessoaId: string, email: string): void {
  if (!pessoaId || !email) return;
  try {
    var sheet = _ss().getSheetByName('Pessoas');
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    var values = sheet.getRange(2, 1, lastRow - 1, COLS_PESSOAS.length).getValues();
    var idCol = COLS_PESSOAS.indexOf('id');
    var emailCol = COLS_PESSOAS.indexOf('email');
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][idCol]) === String(pessoaId)) {
        if (!String(values[i][emailCol] || '').trim()) {
          sheet.getRange(i + 2, emailCol + 1, 1, 1).setValues([[email]]);
        }
        return;
      }
    }
  } catch (e) { /* não-crítico */ }
}

// ─── Sanitização / validação ──────────────────────────────────────────────────

function _str(v: unknown, max: number): string {
  var s = (v === undefined || v === null) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function _emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= MAX_EMAIL;
}

function _sanitizeToken(t: unknown): string {
  return String(t || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

// Aceita perguntas como string (formato Leva 1) ou objeto estruturado.
function _normalizeBlocos(raw: unknown): Array<{ tema: string; perguntas: Array<{ id: string; texto: string; tipo: string; opcoes?: string[]; obrigatorio?: boolean; ajuda?: string }> }> {
  var blocos: unknown[] = [];
  try { var v = JSON.parse(String(raw || '[]')); if (Array.isArray(v)) blocos = v; } catch (e) { blocos = []; }
  return blocos.map(function (b: any, bi: number) {
    var perguntas = Array.isArray(b && b.perguntas) ? b.perguntas : [];
    return {
      tema: _str(b && b.tema, 160) || ('Bloco ' + (bi + 1)),
      perguntas: perguntas.map(function (p: any, pi: number) {
        if (typeof p === 'string') {
          return { id: 'b' + bi + 'q' + pi, texto: _str(p, 400), tipo: 'texto' };
        }
        var tipo = String((p && p.tipo) || 'texto');
        var opcoes = Array.isArray(p && p.opcoes) ? p.opcoes.map(function (o: unknown) { return _str(o, 80); }).filter(Boolean).slice(0, 8) : undefined;
        // Auto-injeta "Outro" como última opção em listas não-exaustivas (unica/multipla)
        // — assim roteiros antigos também ganham o campo aberto sem precisar republicar.
        if ((tipo === 'unica' || tipo === 'multipla') && opcoes && opcoes.length >= 2) {
          var temOutro = opcoes.some(function (o: string) { return /^outr[oa]s?\b/i.test(o); });
          if (!temOutro) opcoes = opcoes.concat(['Outro']);
        }
        return {
          id: _str((p && p.id) || ('b' + bi + 'q' + pi), 40),
          texto: _str(p && p.texto, 400),
          tipo: tipo,
          opcoes: opcoes,
          obrigatorio: !!(p && p.obrigatorio),
          ajuda: _str(p && p.ajuda, 200) || undefined,
        };
      }).filter(function (p: { texto: string }) { return !!p.texto; }),
    };
  });
}

// ─── Score determinístico (fonte única compartilhada) ─────────────────────────
// A fórmula vive em ../forja/src/lib/score.ts — o esbuild.mjs deste projeto
// injeta scoreOportunidadeCore no topo do Server.js. Antes era uma cópia
// literal da fórmula do app principal, que divergia silenciosamente a cada fix.

declare function scoreOportunidadeCore(input: {
  respostas?: Record<string, unknown>; ferramentas?: unknown[];
  querAmostra?: boolean; agendaPref?: string; nome?: string; email?: string; totalPerguntas?: number;
}): { score: number; breakdown: Record<string, number> };

function _scoreOportunidade(input: {
  respostas: Record<string, unknown>; ferramentas: string[];
  querAmostra: boolean; agendaPref: string; nome: string; email: string; totalPerguntas: number;
}): { score: number; breakdown: Record<string, number> } {
  return scoreOportunidadeCore(input);
}

// ─── Endpoints públicos ────────────────────────────────────────────────────────

function _formPorToken(token: string): Record<string, unknown> | null {
  var rows = _readRows('DiscoveryForms', COLS_FORMS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['token']) === token) return rows[i];
  }
  return null;
}

function getFormPublico(token: unknown): ServerOk {
  try {
    var t = _sanitizeToken(token);
    if (!t) return { ok: false, error: 'Formulário não encontrado.' };
    var form = _formPorToken(t);
    if (!form || String(form['status']) !== 'publicado') {
      return { ok: false, error: 'Este formulário não está disponível.' };
    }
    var blocos = _normalizeBlocos(form['perguntasJson']);
    var empresa = '';
    var primeiroNome = '';
    try {
      var pessoaId = String(form['pessoaId'] || '');
      if (pessoaId) {
        var ps = _readRows('Pessoas', COLS_PESSOAS);
        for (var i = 0; i < ps.length; i++) {
          if (String(ps[i]['id']) === pessoaId) {
            empresa = _str(ps[i]['empresa'], 120) || _str(ps[i]['nome'], 120);
            var nomeContato = _str(ps[i]['nomeContato'], 120);
            if (nomeContato) primeiroNome = nomeContato.split(/\s+/)[0];
            break;
          }
        }
      }
    } catch (e2) { /* fallback */ }
    return {
      ok: true,
      titulo: empresa || 'seu negócio',
      cliente: empresa, // compat com versões anteriores do front
      empresa: empresa,
      primeiroNome: primeiroNome,
      intro: 'Algumas perguntas pra entender como vocês trabalham hoje. A maioria é só clicar — e onde fizer sentido, você conta nos detalhes.',
      blocos: blocos,
    };
  } catch (e) {
    return { ok: false, error: 'Não foi possível carregar o formulário.' };
  }
}

function _throttleOk(token: string): boolean {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'thr_' + token;
    if (cache.get(key)) return false;
    cache.put(key, '1', THROTTLE_SEG);
    return true;
  } catch (e) {
    // Fail-CLOSED (OWASP A10): se o CacheService falhar (quota/permissão), o
    // throttle bloqueia em vez de liberar — senão o teto anti-spam vira nominal
    // exatamente quando o atacante consegue degradar o cache.
    Logger.log('throttle degraded: ' + String(e));
    return false;
  }
}

function submitRespostaPublica(payload: unknown): ServerOk {
  try {
    var p = (payload || {}) as Record<string, unknown>;
    var token = _sanitizeToken(p['token']);
    if (!token) return { ok: false, error: 'Link inválido.' };
    if (!_throttleOk(token)) return { ok: false, error: 'Aguarde um instante e tente novamente.' };

    var form = _formPorToken(token);
    if (!form || String(form['status']) !== 'publicado') return { ok: false, error: 'Este formulário não está disponível.' };
    var formId = String(form['id'] || '');
    var formPessoaId = String(form['pessoaId'] || '');
    var formPerguntas = form['perguntasJson'];

    var nome = _str(p['nome'], MAX_NOME);
    var email = _str(p['email'], MAX_EMAIL).toLowerCase();
    if (!nome) return { ok: false, error: 'Conte pra gente seu nome.' };
    if (!_emailValido(email)) return { ok: false, error: 'Confira seu e-mail.' };

    // Sanitiza respostas: cap de chaves, cap de tamanho por valor.
    var respIn = (p['respostas'] && typeof p['respostas'] === 'object') ? p['respostas'] as Record<string, unknown> : {};
    var respostas: Record<string, unknown> = {};
    var keys = Object.keys(respIn).slice(0, MAX_RESPOSTAS);
    keys.forEach(function (k) {
      var key = _str(k, 60);
      var v = respIn[k];
      if (Array.isArray(v)) {
        respostas[key] = v.slice(0, 12).map(function (x) { return _str(x, MAX_RESP_LEN); }).filter(Boolean);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        respostas[key] = v;
      } else {
        respostas[key] = _str(v, MAX_RESP_LEN);
      }
    });

    var ferrIn = Array.isArray(p['ferramentas']) ? p['ferramentas'] as unknown[] : [];
    var ferramentas = ferrIn.slice(0, MAX_FERRAMENTAS).map(function (x) { return _str(x, MAX_FERR_LEN); }).filter(Boolean);

    var querAmostra = p['querAmostra'] === true || String(p['querAmostra']) === 'true';
    var agendaPref = _str(p['agendaPref'], MAX_AGENDA);

    // Teto de respostas por formulário (anti-spam).
    var existentes = _readRows('DiscoveryRespostas', COLS_RESP).filter(function (r) { return String(r['formId']) === formId; });
    if (existentes.length >= MAX_RESP_POR_FORM) return { ok: false, error: 'Recebemos respostas demais para este link. Fale com quem te enviou.' };

    var totalPerguntas = _normalizeBlocos(formPerguntas).reduce(function (s, b) { return s + b.perguntas.length; }, 0);
    var sc = _scoreOportunidade({
      respostas: respostas, ferramentas: ferramentas, querAmostra: querAmostra,
      agendaPref: agendaPref, nome: nome, email: email, totalPerguntas: totalPerguntas,
    });

    _append('DiscoveryRespostas', COLS_RESP, {
      formId: formId,
      pessoaId: formPessoaId,
      emailRespondente: email,
      nome: nome,
      respostasJson: JSON.stringify(respostas),
      ferramentasJson: JSON.stringify(ferramentas),
      querAmostra: querAmostra ? 'true' : 'false',
      agendaPref: agendaPref,
      score: sc.score,
      scoreBreakdownJson: JSON.stringify(sc.breakdown),
      criadoEm: new Date().toISOString(),
    });

    _setEmailPessoaSeVazio(formPessoaId, email);

    return { ok: true, mensagem: 'Recebido! Obrigado, ' + nome.split(' ')[0] + '.' };
  } catch (e) {
    return { ok: false, error: 'Não foi possível enviar agora. Tente novamente em instantes.' };
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────────

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  var token = '';
  try { token = (e && e.parameter && e.parameter.f) ? _sanitizeToken(e.parameter.f) : ''; } catch (x) { token = ''; }
  var content = HtmlService.createHtmlOutputFromFile('FormApp').getContent();
  content = content.replace('%%FORM_TOKEN%%', token);
  return HtmlService.createHtmlOutput(content)
    .setTitle('Discovery')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
