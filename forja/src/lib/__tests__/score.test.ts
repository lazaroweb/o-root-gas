import { describe, it, expect } from 'vitest';
import { scoreOportunidadeCore } from '../score';

// Trava de regressão da fórmula compartilhada (forja + forja-public).
// Se alguém mexer nos pesos ou no clamp, estes testes quebram ANTES do
// número divergir silenciosamente entre o app principal e o discovery.

describe('scoreOportunidadeCore', () => {
  it('retorna 0 sem respostas e sem sinais', () => {
    const r = scoreOportunidadeCore({ respostas: {}, totalPerguntas: 10 });
    expect(r.score).toBe(0);
    expect(r.breakdown).toEqual({
      completude: 0, ferramentas: 0, riquezaTexto: 0,
      pediuAmostra: 0, agenda: 0, contato: 0,
    });
  });

  it('atinge 100 com tudo preenchido (e clampa, não passa de 100)', () => {
    // 5/5 respostas longas: completude 40 + riquezaTexto 18 (500 chars / 40 > 18)
    const respostas: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) respostas['p' + i] = 'x'.repeat(200);
    const r = scoreOportunidadeCore({
      respostas,
      totalPerguntas: 5,
      ferramentas: ['Planilha', 'WhatsApp', 'ERP', 'CRM'], // min(12, 4+4*2) = 12
      querAmostra: true,   // 15
      agendaPref: 'manhã', // 8
      nome: 'Maria',
      email: 'nu_test_maria@example.com', // contato 7
    });
    // 40 + 12 + 18 + 15 + 8 + 7 = 100 exato — e nunca acima.
    expect(r.score).toBe(100);
  });

  it('caso intermediário: metade das respostas, sem amostra nem agenda', () => {
    const r = scoreOportunidadeCore({
      respostas: { p1: 'resposta curta', p2: 'outra resposta' },
      totalPerguntas: 4,
      ferramentas: ['Planilha'], // min(12, 4+2) = 6
      querAmostra: false,
      agendaPref: '',
      nome: 'João',
      email: '', // sem email → contato 0
    });
    // completude: 2/4 * 40 = 20 · texto: 28 chars / 40 → 1
    expect(r.breakdown.completude).toBe(20);
    expect(r.breakdown.ferramentas).toBe(6);
    expect(r.breakdown.pediuAmostra).toBe(0);
    expect(r.breakdown.agenda).toBe(0);
    expect(r.breakdown.contato).toBe(0);
    expect(r.score).toBe(20 + 6 + r.breakdown.riquezaTexto);
  });

  it('ignora respostas vazias (string vazia, null, array vazio) na completude', () => {
    const r = scoreOportunidadeCore({
      respostas: { a: '', b: null, c: [], d: 'válida' },
      totalPerguntas: 4,
    });
    expect(r.breakdown.completude).toBe(10); // 1/4 * 40
  });

  it('não estoura com input vazio (defaults seguros)', () => {
    const r = scoreOportunidadeCore({});
    expect(r.score).toBe(0);
  });
});
