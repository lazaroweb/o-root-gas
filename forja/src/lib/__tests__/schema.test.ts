import { describe, it, expect } from 'vitest';
import { COLS_DISCOVERY_FORMS, COLS_DISCOVERY_RESPOSTAS, COLS_PESSOAS_SCHEMA } from '../schema';

// Invariantes do schema compartilhado (forja + forja-public gravam nas mesmas
// abas). Como a fonte agora é única, o drift entre projetos é impossível por
// construção — estes testes travam os erros que AINDA são possíveis: coluna
// duplicada (indexOf acha a errada) e quebra da regra append-only no `id`.

const TODAS = [
  ['COLS_DISCOVERY_FORMS', COLS_DISCOVERY_FORMS],
  ['COLS_DISCOVERY_RESPOSTAS', COLS_DISCOVERY_RESPOSTAS],
  ['COLS_PESSOAS_SCHEMA', COLS_PESSOAS_SCHEMA],
] as const;

describe('schema compartilhado Discovery/Pessoas', () => {
  it.each(TODAS)('%s: sem colunas duplicadas', (_nome, cols) => {
    expect(new Set(cols).size).toBe(cols.length);
  });

  it.each(TODAS)('%s: id é a primeira coluna (chave do SheetDB)', (_nome, cols) => {
    expect(cols[0]).toBe('id');
  });

  it.each(TODAS)('%s: nomes não-vazios e sem espaços', (_nome, cols) => {
    for (const c of cols) expect(c).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
  });

  it('respostas referenciam formId e pessoaId (elo com forms/pessoas)', () => {
    expect(COLS_DISCOVERY_RESPOSTAS).toContain('formId');
    expect(COLS_DISCOVERY_RESPOSTAS).toContain('pessoaId');
    expect(COLS_DISCOVERY_FORMS).toContain('token');
  });
});
