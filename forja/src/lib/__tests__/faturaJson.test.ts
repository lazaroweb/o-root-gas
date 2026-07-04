import { describe, it, expect } from 'vitest';
import {
  limparPensamentoCore,
  extrairJsonCore,
  repararNumerosFaturaCore,
  repararJsonTruncadoCore,
  extrairJsonFaturaCore,
} from '../faturaJson';

type Fatura = { emissor?: string; total?: number; itens: Array<{ descricao: string; valor: number }> };

const faturaOk = '{"emissor":"Porto","periodo":"2026-06","total":1234.56,"itens":['
  + '{"data":"2026-06-01","descricao":"MERCADO X","valor":100.5,"categoria":"mercado"},'
  + '{"data":"2026-06-02","descricao":"LOJA Y (02/05)","valor":200,"categoria":"casa"}]}';

describe('extrairJsonCore', () => {
  it('parseia JSON puro', () => {
    expect((extrairJsonCore(faturaOk) as Fatura).total).toBe(1234.56);
  });

  it('tolera cercas markdown e texto ao redor', () => {
    const r = extrairJsonCore('Claro! Aqui está:\n```json\n' + faturaOk + '\n```') as Fatura;
    expect(r.itens).toHaveLength(2);
  });

  it('lança quando não há JSON', () => {
    expect(() => extrairJsonCore('não achei nada na fatura')).toThrow();
  });
});

describe('repararNumerosFaturaCore', () => {
  it('converte valor BR (1.285,90) pra ponto decimal', () => {
    const s = '{"total":"1.285,90","itens":[{"descricao":"A","valor":"12,34"}]}';
    const r = extrairJsonCore(repararNumerosFaturaCore(s)) as Fatura;
    expect(r.total).toBe(1285.9);
    expect(r.itens[0].valor).toBe(12.34);
  });

  it('preserva negativos (estorno)', () => {
    const s = '{"itens":[{"descricao":"ESTORNO","valor":"-22,00"}]}';
    const r = extrairJsonCore(repararNumerosFaturaCore(s)) as Fatura;
    expect(r.itens[0].valor).toBe(-22);
  });
});

describe('repararJsonTruncadoCore', () => {
  it('recupera itens completos de resposta cortada no meio de um item', () => {
    const truncado = faturaOk.slice(0, faturaOk.indexOf('"LOJA Y') + 4); // corta dentro do 2º item
    const r = repararJsonTruncadoCore(truncado) as Fatura;
    expect(r).not.toBeNull();
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].descricao).toBe('MERCADO X');
    expect(r.total).toBe(1234.56);
  });

  it('retorna null quando não há nenhum objeto completo', () => {
    expect(repararJsonTruncadoCore('{"emissor":"Por')).toBeNull();
  });
});

describe('limparPensamentoCore', () => {
  it('remove bloco <think> fechado', () => {
    expect(limparPensamentoCore('<think>hmm calculando</think>' + faturaOk)).toBe(faturaOk);
  });

  it('descarta <think> aberto (truncou no raciocínio)', () => {
    expect(limparPensamentoCore('oi <think>pensando sem fim')).toBe('oi');
  });
});

describe('extrairJsonFaturaCore (cadeia completa)', () => {
  it('JSON válido passa direto', () => {
    expect((extrairJsonFaturaCore(faturaOk) as Fatura).itens).toHaveLength(2);
  });

  it('think + números BR + truncamento juntos', () => {
    const bruto = '<think>vou extrair a fatura</think>```json\n'
      + '{"emissor":"Porto","total":"8.123,45","itens":['
      + '{"data":"2026-06-01","descricao":"POSTO Z","valor":"250,00","categoria":"transporte"},'
      + '{"data":"2026-06-03","descricao":"SEGURO AUTO (03/1'; // cortado pelo limite de tokens
    const r = extrairJsonFaturaCore(bruto) as Fatura;
    expect(r.total).toBe(8123.45);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].valor).toBe(250);
  });

  it('lança quando nada é aproveitável', () => {
    expect(() => extrairJsonFaturaCore('desculpe, não consegui ler o documento')).toThrow();
  });
});
