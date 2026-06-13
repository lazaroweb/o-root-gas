/// <reference types="google-apps-script" />

// ═══════════════════════════════════════════════════════════════════════════════
// FORJA — SheetDB Engine + Server Functions
// Motor genérico de CRUD sobre Google Sheets
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Schema Definition ───────────────────────────────────────────────────────

interface SheetSchema {
  name: string;
  columns: string[];
}

const SCHEMA: SheetSchema[] = [
  { name: 'Sistemas', columns: ['id', 'nome', 'codinome', 'estagio', 'proposito', 'stack', 'urlProd', 'scoreSaude'] },
  { name: 'Recursos', columns: ['id', 'sistemaId', 'tipo', 'chave', 'descricao', 'link'] },
  { name: 'Decisoes', columns: ['id', 'sistemaId', 'data', 'titulo', 'decisao', 'justificativa', 'status'] },
  { name: 'Riscos', columns: ['id', 'sistemaId', 'area', 'descricao', 'gravidade', 'historicoIncidentes'] },
  { name: 'Ideias', columns: ['id', 'titulo', 'descricao', 'notaImpacto', 'notaEsforco', 'estado'] },
  { name: 'Oportunidades', columns: ['id', 'titulo', 'pessoaId', 'valorEstimado', 'estado', 'proximoPasso'] },
  { name: 'Pessoas', columns: ['id', 'nome', 'contato', 'papel', 'notas'] },
  { name: 'Custos', columns: ['id', 'sistemaId', 'fornecedor', 'valor', 'recorrencia', 'proximaCobranca'] },
  { name: 'Pulsos', columns: ['id', 'sistemaId', 'urlCheck', 'ultimoStatus', 'latenciaMs'] },
  { name: 'Timeline', columns: ['id', 'sistemaId', 'data', 'tipo', 'texto'] },
];

// ─── SheetDB Core Engine ─────────────────────────────────────────────────────

function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('FORJA_SHEET_ID');

  // Se já temos um ID salvo, tenta abrir
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch {
      // ID inválido ou sem permissão — recria
    }
  }

  // Cria uma planilha nova
  const ss = SpreadsheetApp.create('FORJA — Base de Dados');
  props.setProperty('FORJA_SHEET_ID', ss.getId());

  // Remove a aba padrão "Sheet1" depois de criar as demais
  return ss;
}

function getOrCreateSheet(sheetName: string, columns: string[]): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initDatabase(): void {
  const ss = getSpreadsheet();
  for (const schema of SCHEMA) {
    getOrCreateSheet(schema.name, schema.columns);
  }
  // Remove a aba padrão "Sheet1" se existir (criada automaticamente pelo Sheets)
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

function generateId(): string {
  return Utilities.getUuid();
}

function sheetToObjects(sheetName: string): Record<string, unknown>[] {
  const schema = SCHEMA.find(s => s.name === sheetName);
  if (!schema) return [];
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, schema.columns.length).getValues();
  return data.map(row => {
    const obj: Record<string, unknown> = {};
    schema.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function dbGetAll(sheetName: string): Record<string, unknown>[] {
  return sheetToObjects(sheetName);
}

function dbGetById(sheetName: string, id: string): Record<string, unknown> | null {
  const all = sheetToObjects(sheetName);
  return all.find(row => row['id'] === id) || null;
}

function dbCreate(sheetName: string, data: Record<string, unknown>): Record<string, unknown> {
  const schema = SCHEMA.find(s => s.name === sheetName);
  if (!schema) throw new Error(`Sheet ${sheetName} not in schema`);
  const sheet = getOrCreateSheet(sheetName, schema.columns);
  const id = generateId();
  const row = schema.columns.map(col => {
    if (col === 'id') return id;
    return data[col] !== undefined ? data[col] : '';
  });
  sheet.appendRow(row);
  const obj: Record<string, unknown> = {};
  schema.columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

function dbUpdate(sheetName: string, id: string, data: Record<string, unknown>): Record<string, unknown> | null {
  const schema = SCHEMA.find(s => s.name === sheetName);
  if (!schema) throw new Error(`Sheet ${sheetName} not in schema`);
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const allData = sheet.getRange(2, 1, lastRow - 1, schema.columns.length).getValues();
  const idCol = schema.columns.indexOf('id');
  const rowIndex = allData.findIndex(row => row[idCol] === id);
  if (rowIndex === -1) return null;
  const updatedRow = schema.columns.map((col, i) => {
    if (col === 'id') return id;
    return data[col] !== undefined ? data[col] : allData[rowIndex][i];
  });
  sheet.getRange(rowIndex + 2, 1, 1, schema.columns.length).setValues([updatedRow]);
  const obj: Record<string, unknown> = {};
  schema.columns.forEach((col, i) => { obj[col] = updatedRow[i]; });
  return obj;
}

function dbQuery(sheetName: string, filters: Record<string, unknown>): Record<string, unknown>[] {
  const all = sheetToObjects(sheetName);
  return all.filter(row => {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  });
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

function seedDatabase(): void {
  const sistemas = dbGetAll('Sistemas');
  if (sistemas.length > 0) return; // já tem dados

  // Sistemas de exemplo
  const forjaId = generateId();
  const saasId = generateId();
  const ideiaId = generateId();

  const seedSistemas = [
    { id: forjaId, nome: 'FORJA', codinome: 'forja', estagio: 'forja', proposito: 'Central de comando e governança de sistemas', stack: 'GAS, React, TypeScript, Ant Design', urlProd: '', scoreSaude: 85 },
    { id: saasId, nome: 'ClientFlow', codinome: 'cflow', estagio: 'tempera', proposito: 'CRM simplificado para freelancers', stack: 'Next.js, Supabase, Vercel', urlProd: 'https://clientflow.app', scoreSaude: 92 },
    { id: ideiaId, nome: 'QuoteForge', codinome: 'qforge', estagio: 'faisca', proposito: 'Gerador de propostas comerciais com IA', stack: '', urlProd: '', scoreSaude: 0 },
  ];

  const sistemasSheet = getOrCreateSheet('Sistemas', SCHEMA[0].columns);
  for (const s of seedSistemas) {
    const row = SCHEMA[0].columns.map(col => (s as Record<string, unknown>)[col] ?? '');
    sistemasSheet.appendRow(row);
  }

  // Custos de exemplo
  const seedCustos = [
    { sistemaId: saasId, fornecedor: 'Vercel', valor: 20, recorrencia: 'mensal', proximaCobranca: '2026-07-01' },
    { sistemaId: saasId, fornecedor: 'Supabase', valor: 25, recorrencia: 'mensal', proximaCobranca: '2026-07-05' },
    { sistemaId: forjaId, fornecedor: 'Google Workspace', valor: 0, recorrencia: 'mensal', proximaCobranca: '' },
  ];

  const custosSheet = getOrCreateSheet('Custos', SCHEMA[7].columns);
  for (const c of seedCustos) {
    const id = generateId();
    const row = SCHEMA[7].columns.map(col => {
      if (col === 'id') return id;
      return (c as Record<string, unknown>)[col] ?? '';
    });
    custosSheet.appendRow(row);
  }
}

// ─── Funções Expostas ao Cliente ─────────────────────────────────────────────

interface ServerResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function initApp(): ServerResult {
  try {
    initDatabase();
    seedDatabase();
    const sistemas = dbGetAll('Sistemas');
    const custos = dbGetAll('Custos');
    const totalCusto = custos.reduce((sum, c) => sum + Number(c['valor'] || 0), 0);
    const ativos = sistemas.filter(s => s['estagio'] === 'forja' || s['estagio'] === 'tempera');
    const saudeMedia = ativos.length > 0
      ? Math.round(ativos.reduce((sum, s) => sum + Number(s['scoreSaude'] || 0), 0) / ativos.length)
      : 0;
    return {
      ok: true,
      data: {
        sistemas,
        stats: {
          totalSistemas: sistemas.length,
          ativos: ativos.length,
          saudeMedia,
          custoMensal: totalCusto,
        },
      },
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao inicializar' };
  }
}

function getSistemas(): ServerResult {
  try {
    return { ok: true, data: dbGetAll('Sistemas') };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar sistemas' };
  }
}

function getSistemaById(id: string): ServerResult {
  try {
    const sistema = dbGetById('Sistemas', id);
    if (!sistema) return { ok: false, error: 'Sistema não encontrado' };
    return { ok: true, data: sistema };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar sistema' };
  }
}

function createSistema(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Sistemas', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar sistema' };
  }
}

function updateSistema(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Sistemas', id, data);
    if (!updated) return { ok: false, error: 'Sistema não encontrado' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar sistema' };
  }
}

function getCustosBySistema(id: string): ServerResult {
  try {
    const custos = dbQuery('Custos', { sistemaId: id });
    return { ok: true, data: custos };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar custos' };
  }
}

function getDashboardStats(): ServerResult {
  try {
    const sistemas = dbGetAll('Sistemas');
    const custos = dbGetAll('Custos');
    const totalCusto = custos.reduce((sum, c) => sum + Number(c['valor'] || 0), 0);
    const ativos = sistemas.filter(s => s['estagio'] === 'forja' || s['estagio'] === 'tempera');
    const saudeMedia = ativos.length > 0
      ? Math.round(ativos.reduce((sum, s) => sum + Number(s['scoreSaude'] || 0), 0) / ativos.length)
      : 0;
    return {
      ok: true,
      data: { totalSistemas: sistemas.length, ativos: ativos.length, saudeMedia, custoMensal: totalCusto },
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao calcular stats' };
  }
}

// ─── Recursos ────────────────────────────────────────────────────────────────

function getRecursosBySistema(sistemaId: string): ServerResult {
  try {
    const recursos = dbQuery('Recursos', { sistemaId });
    return { ok: true, data: recursos };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar recursos' };
  }
}

function createRecurso(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Recursos', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar recurso' };
  }
}

function updateRecurso(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Recursos', id, data);
    if (!updated) return { ok: false, error: 'Recurso não encontrado' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar recurso' };
  }
}

function deleteRecurso(id: string): ServerResult {
  try {
    const schema = SCHEMA.find(s => s.name === 'Recursos');
    if (!schema) return { ok: false, error: 'Schema não encontrado' };
    const sheet = getSpreadsheet().getSheetByName('Recursos');
    if (!sheet) return { ok: false, error: 'Aba não encontrada' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { ok: false, error: 'Recurso não encontrado' };
    const data = sheet.getRange(2, 1, lastRow - 1, schema.columns.length).getValues();
    const rowIndex = data.findIndex(row => row[0] === id);
    if (rowIndex === -1) return { ok: false, error: 'Recurso não encontrado' };
    sheet.deleteRow(rowIndex + 2);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao deletar recurso' };
  }
}

// ─── Decisões ────────────────────────────────────────────────────────────────

function getDecisoesBySistema(sistemaId: string): ServerResult {
  try {
    const decisoes = dbQuery('Decisoes', { sistemaId });
    return { ok: true, data: decisoes };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar decisões' };
  }
}

function createDecisao(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Decisoes', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar decisão' };
  }
}

function updateDecisao(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Decisoes', id, data);
    if (!updated) return { ok: false, error: 'Decisão não encontrada' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar decisão' };
  }
}

// ─── Riscos (Mapa de Quebra) ─────────────────────────────────────────────────

function getRiscosBySistema(sistemaId: string): ServerResult {
  try {
    const riscos = dbQuery('Riscos', { sistemaId });
    return { ok: true, data: riscos };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar riscos' };
  }
}

function createRisco(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Riscos', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar risco' };
  }
}

function updateRisco(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Riscos', id, data);
    if (!updated) return { ok: false, error: 'Risco não encontrado' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar risco' };
  }
}

// ─── Passaporte do Sistema ───────────────────────────────────────────────────

function gerarPassaporte(sistemaId: string): ServerResult {
  try {
    const sistema = dbGetById('Sistemas', sistemaId);
    if (!sistema) return { ok: false, error: 'Sistema não encontrado' };

    const recursos = dbQuery('Recursos', { sistemaId });
    const decisoes = dbQuery('Decisoes', { sistemaId });
    const riscos = dbQuery('Riscos', { sistemaId });
    const timeline = dbQuery('Timeline', { sistemaId });
    const custos = dbQuery('Custos', { sistemaId });

    let md = `# ${sistema['nome']} (${sistema['codinome']})\n\n`;
    md += `> ${sistema['proposito']}\n\n`;
    md += `**Estágio:** ${sistema['estagio']} | **Saúde:** ${sistema['scoreSaude']}%\n`;
    md += `**Stack:** ${sistema['stack']}\n`;
    if (sistema['urlProd']) md += `**URL:** ${sistema['urlProd']}\n`;
    md += `\n---\n\n`;

    // Recursos
    md += `## Recursos\n\n`;
    if (recursos.length === 0) {
      md += `_Nenhum recurso registrado._\n\n`;
    } else {
      for (const r of recursos) {
        md += `### [${r['tipo']}] ${r['chave']}\n`;
        if (r['descricao']) md += `${r['descricao']}\n`;
        if (r['link']) md += `Link: ${r['link']}\n`;
        md += `\n`;
      }
    }

    // Decisões
    md += `## Decisões Técnicas\n\n`;
    if (decisoes.length === 0) {
      md += `_Nenhuma decisão registrada._\n\n`;
    } else {
      for (const d of decisoes) {
        md += `### ${d['titulo']} (${d['data']})\n`;
        md += `**Decisão:** ${d['decisao']}\n`;
        md += `**Justificativa:** ${d['justificativa']}\n`;
        md += `**Status:** ${d['status']}\n\n`;
      }
    }

    // Riscos (Mapa de Quebra)
    md += `## ⚠️ Mapa de Quebra (Riscos)\n\n`;
    if (riscos.length === 0) {
      md += `_Nenhum risco mapeado._\n\n`;
    } else {
      for (const r of riscos) {
        const gravidade = Number(r['gravidade'] || 0);
        const emoji = gravidade >= 8 ? '🔴' : gravidade >= 5 ? '🟡' : '🟢';
        md += `### ${emoji} ${r['area']} (gravidade: ${gravidade}/10)\n`;
        md += `${r['descricao']}\n`;
        if (r['historicoIncidentes']) md += `_Histórico: ${r['historicoIncidentes']}_\n`;
        md += `\n`;
      }
    }

    // Custos
    md += `## Custos\n\n`;
    if (custos.length === 0) {
      md += `_Nenhum custo registrado._\n\n`;
    } else {
      md += `| Fornecedor | Valor | Recorrência |\n|---|---|---|\n`;
      for (const c of custos) {
        md += `| ${c['fornecedor']} | R$ ${Number(c['valor'] || 0).toFixed(2)} | ${c['recorrencia']} |\n`;
      }
      md += `\n`;
    }

    // Timeline
    md += `## Timeline\n\n`;
    if (timeline.length === 0) {
      md += `_Nenhum evento registrado._\n\n`;
    } else {
      for (const t of timeline) {
        const emoji = t['tipo'] === 'ship' ? '🚀' : '🚨';
        md += `- ${emoji} **${t['data']}** — ${t['texto']}\n`;
      }
      md += `\n`;
    }

    md += `---\n_Gerado pela FORJA em ${new Date().toISOString().split('T')[0]}_\n`;

    return { ok: true, data: md };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao gerar passaporte' };
  }
}

// ─── Ideias (Faísca) ─────────────────────────────────────────────────────────

function getIdeias(): ServerResult {
  try {
    return { ok: true, data: dbGetAll('Ideias') };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar ideias' };
  }
}

function createIdeia(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Ideias', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar ideia' };
  }
}

function updateIdeia(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Ideias', id, data);
    if (!updated) return { ok: false, error: 'Ideia não encontrada' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar ideia' };
  }
}

// ─── Pessoas (Mini-CRM) ─────────────────────────────────────────────────────

function getPessoas(): ServerResult {
  try {
    return { ok: true, data: dbGetAll('Pessoas') };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar pessoas' };
  }
}

function createPessoa(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Pessoas', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar pessoa' };
  }
}

function updatePessoa(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Pessoas', id, data);
    if (!updated) return { ok: false, error: 'Pessoa não encontrada' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar pessoa' };
  }
}

// ─── Oportunidades ───────────────────────────────────────────────────────────

function getOportunidades(): ServerResult {
  try {
    return { ok: true, data: dbGetAll('Oportunidades') };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar oportunidades' };
  }
}

function createOportunidade(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Oportunidades', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar oportunidade' };
  }
}

function updateOportunidade(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Oportunidades', id, data);
    if (!updated) return { ok: false, error: 'Oportunidade não encontrada' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar oportunidade' };
  }
}

// ─── Gênese (transformar Ideia em Sistema) ───────────────────────────────────

function gerarGenese(ideiaId: string, respostas: Record<string, string>): ServerResult {
  try {
    const ideia = dbGetById('Ideias', ideiaId);
    if (!ideia) return { ok: false, error: 'Ideia não encontrada' };

    // Gera prompt de kickoff
    let prompt = `# Kickoff: ${ideia['titulo']}\n\n`;
    prompt += `## Contexto\n${ideia['descricao']}\n\n`;
    prompt += `## Validação\n`;
    prompt += `- **Público-alvo:** ${respostas['publico'] || 'Não definido'}\n`;
    prompt += `- **Problema que resolve:** ${respostas['problema'] || 'Não definido'}\n`;
    prompt += `- **Stack sugerida:** ${respostas['stack'] || 'A definir'}\n`;
    prompt += `- **MVP mínimo:** ${respostas['mvp'] || 'Não definido'}\n`;
    prompt += `- **Monetização:** ${respostas['monetizacao'] || 'Não definido'}\n\n`;
    prompt += `## Prompt para o Claude\n\n`;
    prompt += `> Você vai me ajudar a construir "${ideia['titulo']}". ${ideia['descricao']}. `;
    prompt += `O público-alvo é: ${respostas['publico'] || '—'}. `;
    prompt += `O problema que resolve: ${respostas['problema'] || '—'}. `;
    prompt += `Stack: ${respostas['stack'] || 'a definir'}. `;
    prompt += `MVP mínimo: ${respostas['mvp'] || '—'}. `;
    prompt += `Comece me ajudando a definir a arquitetura e os primeiros passos.\n`;

    // Atualiza estado da ideia para "em andamento"
    dbUpdate('Ideias', ideiaId, { estado: 'em andamento' });

    return { ok: true, data: prompt };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao gerar gênese' };
  }
}

// ─── Pulsos (Monitoramento de Uptime) ────────────────────────────────────────

function getPulsosBySistema(sistemaId: string): ServerResult {
  try {
    const pulsos = dbQuery('Pulsos', { sistemaId });
    return { ok: true, data: pulsos };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao buscar pulsos' };
  }
}

function createPulso(data: Record<string, unknown>): ServerResult {
  try {
    const created = dbCreate('Pulsos', data);
    return { ok: true, data: created };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao criar pulso' };
  }
}

function updatePulso(id: string, data: Record<string, unknown>): ServerResult {
  try {
    const updated = dbUpdate('Pulsos', id, data);
    if (!updated) return { ok: false, error: 'Pulso não encontrado' };
    return { ok: true, data: updated };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar pulso' };
  }
}

function deletePulso(id: string): ServerResult {
  try {
    const schema = SCHEMA.find(s => s.name === 'Pulsos');
    if (!schema) return { ok: false, error: 'Schema não encontrado' };
    const sheet = getSpreadsheet().getSheetByName('Pulsos');
    if (!sheet) return { ok: false, error: 'Aba não encontrada' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { ok: false, error: 'Pulso não encontrado' };
    const data = sheet.getRange(2, 1, lastRow - 1, schema.columns.length).getValues();
    const rowIndex = data.findIndex(row => row[0] === id);
    if (rowIndex === -1) return { ok: false, error: 'Pulso não encontrado' };
    sheet.deleteRow(rowIndex + 2);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao deletar pulso' };
  }
}

// Trigger function — roda automaticamente via time-driven trigger
// Verifica todas as URLs monitoradas e atualiza status + latência
function executarPulsos(): void {
  initDatabase();
  const pulsos = dbGetAll('Pulsos');
  for (const pulso of pulsos) {
    const url = String(pulso['urlCheck'] || '');
    if (!url) continue;
    try {
      const start = Date.now();
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      const latencia = Date.now() - start;
      const status = response.getResponseCode();
      dbUpdate('Pulsos', String(pulso['id']), { ultimoStatus: status, latenciaMs: latencia });

      // Se status >= 500, atualiza scoreSaude do sistema
      if (status >= 500) {
        const sistemaId = String(pulso['sistemaId'] || '');
        if (sistemaId) {
          const sistema = dbGetById('Sistemas', sistemaId);
          if (sistema) {
            const currentScore = Number(sistema['scoreSaude'] || 0);
            const newScore = Math.max(0, currentScore - 10);
            dbUpdate('Sistemas', sistemaId, { scoreSaude: newScore });
          }
          // Registrar incidente na Timeline
          dbCreate('Timeline', {
            sistemaId,
            data: new Date().toISOString().split('T')[0],
            tipo: 'incidente',
            texto: `URL ${url} retornou status ${status}`,
          });
        }
      }
    } catch {
      // URL inacessível
      dbUpdate('Pulsos', String(pulso['id']), { ultimoStatus: 0, latenciaMs: 0 });
      const sistemaId = String(pulso['sistemaId'] || '');
      if (sistemaId) {
        dbCreate('Timeline', {
          sistemaId,
          data: new Date().toISOString().split('T')[0],
          tipo: 'incidente',
          texto: `URL ${url} inacessível (timeout/erro de rede)`,
        });
      }
    }
  }
}

// ─── Alertas de Renovação Financeira ─────────────────────────────────────────

// Trigger function — verifica custos com proximaCobranca nos próximos 7 dias
function verificarRenovacoes(): void {
  initDatabase();
  const custos = dbGetAll('Custos');
  const hoje = new Date();
  const em7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  const alertas: string[] = [];

  for (const custo of custos) {
    const proxCobranca = String(custo['proximaCobranca'] || '');
    if (!proxCobranca) continue;
    const dataCob = new Date(proxCobranca);
    if (dataCob >= hoje && dataCob <= em7Dias) {
      const sistema = custo['sistemaId'] ? dbGetById('Sistemas', String(custo['sistemaId'])) : null;
      const nomeSistema = sistema ? String(sistema['nome']) : 'Sem sistema';
      alertas.push(`• ${custo['fornecedor']} — R$ ${Number(custo['valor'] || 0).toFixed(2)} (${nomeSistema}) vence em ${proxCobranca}`);
    }
  }

  if (alertas.length > 0) {
    const email = Session.getActiveUser().getEmail();
    const corpo = `🔔 FORJA — Renovações nos próximos 7 dias:\n\n${alertas.join('\n')}\n\n---\nEnviado automaticamente pela FORJA.`;
    MailApp.sendEmail(email, '🔔 FORJA: Renovações próximas', corpo);
  }
}

// Configura os triggers automaticamente
function configurarTriggers(): ServerResult {
  try {
    // Remove triggers existentes da Forja para evitar duplicação
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      const handlerName = trigger.getHandlerFunction();
      if (handlerName === 'executarPulsos' || handlerName === 'verificarRenovacoes') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Pulsos: a cada 15 minutos
    ScriptApp.newTrigger('executarPulsos')
      .timeBased()
      .everyMinutes(15)
      .create();

    // Renovações: diariamente às 9h
    ScriptApp.newTrigger('verificarRenovacoes')
      .timeBased()
      .atHour(9)
      .everyDays(1)
      .create();

    return { ok: true, data: 'Triggers configurados: Pulsos a cada 15min, Renovações diárias às 9h' };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao configurar triggers' };
  }
}

// ─── Busca Global ────────────────────────────────────────────────────────────

interface SearchResult {
  tipo: string;
  id: string;
  titulo: string;
  subtitulo: string;
}

function buscaGlobal(query: string): ServerResult {
  try {
    if (!query || query.length < 2) return { ok: true, data: [] };
    const q = query.toLowerCase();
    const resultados: SearchResult[] = [];

    // Buscar em Sistemas
    const sistemas = dbGetAll('Sistemas');
    for (const s of sistemas) {
      const match = String(s['nome'] || '').toLowerCase().includes(q)
        || String(s['codinome'] || '').toLowerCase().includes(q)
        || String(s['proposito'] || '').toLowerCase().includes(q)
        || String(s['stack'] || '').toLowerCase().includes(q);
      if (match) {
        resultados.push({ tipo: 'sistema', id: String(s['id']), titulo: String(s['nome']), subtitulo: String(s['codinome']) });
      }
    }

    // Buscar em Ideias
    const ideias = dbGetAll('Ideias');
    for (const i of ideias) {
      const match = String(i['titulo'] || '').toLowerCase().includes(q)
        || String(i['descricao'] || '').toLowerCase().includes(q);
      if (match) {
        resultados.push({ tipo: 'ideia', id: String(i['id']), titulo: String(i['titulo']), subtitulo: String(i['estado'] || '') });
      }
    }

    // Buscar em Pessoas
    const pessoas = dbGetAll('Pessoas');
    for (const p of pessoas) {
      const match = String(p['nome'] || '').toLowerCase().includes(q)
        || String(p['contato'] || '').toLowerCase().includes(q);
      if (match) {
        resultados.push({ tipo: 'pessoa', id: String(p['id']), titulo: String(p['nome']), subtitulo: String(p['papel'] || '') });
      }
    }

    // Buscar em Oportunidades
    const oportunidades = dbGetAll('Oportunidades');
    for (const o of oportunidades) {
      const match = String(o['titulo'] || '').toLowerCase().includes(q);
      if (match) {
        resultados.push({ tipo: 'oportunidade', id: String(o['id']), titulo: String(o['titulo']), subtitulo: `R$ ${Number(o['valorEstimado'] || 0).toLocaleString()}` });
      }
    }

    return { ok: true, data: resultados.slice(0, 10) };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro na busca' };
  }
}

// ─── doGet — Entry point do Web App ──────────────────────────────────────────

function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('FORJA')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
