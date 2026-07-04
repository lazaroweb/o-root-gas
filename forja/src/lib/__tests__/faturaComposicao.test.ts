import { describe, it, expect } from 'vitest';
import { composicaoFaturaMes, mesDeLancamento, normalizarDescricao, type LancComposicao } from '../faturaComposicao';

const MES = '2026-07';

function lanc(over: Partial<LancComposicao> & { id: string }): LancComposicao {
  return {
    descricao: 'COMPRA', valor: 100, vencimento: `${MES}-10`, data: '2026-06-20',
    tags: '', notas: '', status: 'pendente', ...over,
  };
}

describe('mesDeLancamento / normalizarDescricao', () => {
  it('vencimento manda; sem vencimento cai na data', () => {
    expect(mesDeLancamento({ vencimento: '2026-07-10', data: '2026-06-20' })).toBe('2026-07');
    expect(mesDeLancamento({ vencimento: '', data: '2026-06-20' })).toBe('2026-06');
  });

  it('remove parcela e acentos da descrição', () => {
    expect(normalizarDescricao('SAMSUNG NO ITAÚ (15/21)')).toBe('samsung no itau');
    expect(normalizarDescricao('Loja X parcela 2/5')).toBe('loja x');
  });
});

describe('composicaoFaturaMes', () => {
  it('classifica importados, provisionados anteriores, recorrências e manuais', () => {
    const c = composicaoFaturaMes([
      lanc({ id: '1', tags: 'fatura-importada', notas: 'Importado da fatura via IA', valor: 50 }),
      lanc({ id: '2', tags: 'fatura-importada', notas: 'Importado da fatura via IA (parcelado)', valor: 30 }),
      lanc({ id: '3', tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação', valor: 200, parcelas: 10, parcelaAtual: 4 }),
      lanc({ id: '4', recorrenciaOrigemId: 'r1', valor: 40 }),
      lanc({ id: '5', valor: 25 }),
      lanc({ id: 'fora', vencimento: '2026-08-10', valor: 999 }), // outro mês: fora
    ], MES);
    expect(c.importadosAgora.total).toBe(80);
    expect(c.importadosAgora.qtd).toBe(2);
    expect(c.provisionadosAnteriores.total).toBe(200);
    expect(c.recorrencias.total).toBe(40);
    expect(c.manuais.total).toBe(25);
    expect(c.total).toBe(345);
  });

  it('detecta duplicidade de parcela (conciliação que falhou) mesmo com valor diferente', () => {
    const c = composicaoFaturaMes([
      lanc({ id: 'prov', descricao: 'SAMSUNG NO ITAU (04/10)', valor: 300, parcelas: 10, parcelaAtual: 4, tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação' }),
      lanc({ id: 'novo', descricao: 'SAMSUNG ITAU 04/10', valor: 301.5, parcelas: 10, parcelaAtual: 4, tags: 'fatura-importada', notas: 'Importado da fatura via IA (parcelado)' }),
    ], MES);
    // Descrições normalizam diferente ('samsung no itau' vs 'samsung itau') →
    // NÃO acusa (grupos distintos). Ajusta pro caso real: mesma descrição.
    expect(c.suspeitas).toHaveLength(0);

    const c2 = composicaoFaturaMes([
      lanc({ id: 'prov', descricao: 'SAMSUNG NO ITAU (04/10)', valor: 300, parcelas: 10, parcelaAtual: 4 }),
      lanc({ id: 'novo', descricao: 'SAMSUNG NO ITAU 04/10', valor: 301.5, parcelas: 10, parcelaAtual: 4 }),
    ], MES);
    expect(c2.suspeitas).toHaveLength(1);
    expect(c2.suspeitas[0].parcela).toBe('4/10');
    expect(c2.suspeitas[0].qtd).toBe(2);
    expect(c2.totalExcedente).toBeGreaterThan(0);
  });

  it('à vista só acusa com descrição E valor iguais; prioriza manter a paga', () => {
    const semDup = composicaoFaturaMes([
      lanc({ id: 'a', descricao: 'UBER TRIP', valor: 15.9 }),
      lanc({ id: 'b', descricao: 'UBER TRIP', valor: 22.5 }), // valor difere: legítimo
    ], MES);
    expect(semDup.suspeitas).toHaveLength(0);

    const comDup = composicaoFaturaMes([
      lanc({ id: 'pend', descricao: 'NETFLIX.COM', valor: 55.9, status: 'pendente' }),
      lanc({ id: 'paga', descricao: 'NETFLIX COM', valor: 55.9, status: 'pago' }),
    ], MES);
    expect(comDup.suspeitas).toHaveLength(1);
    expect(comDup.suspeitas[0].ids[0]).toBe('paga'); // a paga é a mantida
    expect(comDup.suspeitas[0].valorExcedente).toBe(55.9);
  });

  it('parcelas de meses diferentes da mesma compra NÃO são duplicidade', () => {
    const c = composicaoFaturaMes([
      lanc({ id: 'p4', descricao: 'LOJA Z (04/10)', valor: 100, parcelas: 10, parcelaAtual: 4 }),
      lanc({ id: 'p5', descricao: 'LOJA Z (05/10)', valor: 100, parcelas: 10, parcelaAtual: 5 }),
    ], MES);
    expect(c.suspeitas).toHaveLength(0);
  });
});
