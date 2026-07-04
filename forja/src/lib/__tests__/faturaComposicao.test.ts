import { describe, it, expect } from 'vitest';
import {
  composicaoFaturaMes, mesDeLancamento, normalizarDescricao, selecionarRemocaoImportacao,
  type LancComposicao,
} from '../faturaComposicao';

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

  it('tolera vencimento como Date (células do Sheets no servidor)', () => {
    expect(mesDeLancamento({ vencimento: new Date(2026, 6, 10) })).toBe('2026-07');
  });
});

describe('selecionarRemocaoImportacao (desfazer importação do mês)', () => {
  // Cenário completo: importação de JUNHO (lote T1) provisionou parcelas pra
  // julho e agosto; importação de JULHO (lote T2) criou itens do mês + futuras
  // pra agosto/setembro. Desfazer JULHO deve: remover o que T2 criou (mês +
  // futuras), preservar a provisão de T1 que vence em julho, e não tocar em
  // nada de junho.
  const T1 = '2026-06-05T10:00:00.000Z';
  const T2 = '2026-07-04T22:00:00.000Z';
  const base = [
    // Lote T1 (fatura de junho)
    lanc({ id: 'jun-avista', vencimento: '2026-06-10', tags: 'fatura-importada', notas: 'Importado da fatura via IA', criadoEm: T1 }),
    lanc({ id: 'jul-prov-t1', vencimento: '2026-07-10', tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação', criadoEm: T1, parcelas: 5, parcelaAtual: 2 }),
    lanc({ id: 'ago-prov-t1', vencimento: '2026-08-10', tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação', criadoEm: T1, parcelas: 5, parcelaAtual: 3 }),
    // Lote T2 (fatura de julho)
    lanc({ id: 'jul-avista-t2', vencimento: '2026-07-10', tags: 'fatura-importada', notas: 'Importado da fatura via IA', criadoEm: T2 }),
    lanc({ id: 'jul-parc-t2', vencimento: '2026-07-10', tags: 'fatura-importada', notas: 'Importado da fatura via IA (parcelado)', criadoEm: T2, parcelas: 3, parcelaAtual: 1 }),
    lanc({ id: 'ago-prov-t2', vencimento: '2026-08-10', tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação', criadoEm: T2, parcelas: 3, parcelaAtual: 2 }),
    lanc({ id: 'set-prov-t2', vencimento: '2026-09-10', tags: 'fatura-importada', notas: 'Parcela futura provisionada na importação', criadoEm: T2, parcelas: 3, parcelaAtual: 3 }),
  ];

  it('remove o lote do mês + suas futuras; preserva provisões anteriores e outros meses', () => {
    const sel = selecionarRemocaoImportacao(base, '2026-07');
    expect(sel.removerIds.sort()).toEqual(['jul-avista-t2', 'jul-parc-t2']);
    expect(sel.futurasIds.sort()).toEqual(['ago-prov-t2', 'set-prov-t2']);
    expect(sel.preservados).toBe(1); // jul-prov-t1 fica
    const tocados = new Set([...sel.removerIds, ...sel.futurasIds]);
    expect(tocados.has('jun-avista')).toBe(false);
    expect(tocados.has('jul-prov-t1')).toBe(false);
    expect(tocados.has('ago-prov-t1')).toBe(false);
  });

  it('mês sem importação própria: nada a remover, provisões preservadas', () => {
    const sel = selecionarRemocaoImportacao(base, '2026-08');
    // Agosto só tem provisões (T1 e T2) — nenhuma linha criada POR uma
    // importação de agosto. Nada é removido; futuras não são arrastadas.
    expect(sel.removerIds).toEqual([]);
    expect(sel.futurasIds).toEqual([]);
    expect(sel.preservados).toBe(2);
  });
});
