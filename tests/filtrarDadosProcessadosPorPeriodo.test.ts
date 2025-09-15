import { describe, it, expect } from 'vitest';
import { filtrarDadosProcessadosPorPeriodo } from '../src/utils/dataProcessor';

const baseDados = {
  periodo: { inicio: new Date('2025-06-01'), fim: new Date('2025-06-30') },
  entradas: [
    { dataDocumento: new Date('2025-06-01'), dataEntradaSaida: null, itens: [] },
    { dataDocumento: new Date('2025-06-15'), dataEntradaSaida: null, itens: [] },
    { dataDocumento: null, dataEntradaSaida: null, itens: [] }, // sem data, não deve ser descartada
  ],
  saidas: [],
  entradasPorDiaArray: [
    { data: '2025-06-01', valor: 100 },
    { data: '2025-06-15', valor: 50 },
  ],
  saidasPorDiaArray: [
    { data: '2025-06-02', valor: 200 },
  ],
  entradasPorDiaCfopArray: [
    { data: '2025-06-01', cfop: '1102', valor: 100 },
    { data: '2025-06-15', cfop: '1102', valor: 50 },
  ],
  saidasPorDiaCfopArray: [
    { data: '2025-06-02', cfop: '5102', valor: 200 },
  ],
};

describe('filtrarDadosProcessadosPorPeriodo', () => {
  it('filtra por faixa e re-agrega CFOPs corretamente', () => {
    const res = filtrarDadosProcessadosPorPeriodo(baseDados, '2025-06-01', '2025-06-15');
    expect(res.entradasPorDiaArray.length).toBe(2);
    expect(res.totalEntradas).toBe(150);
    expect(res.entradasPorCfopArray[0]).toEqual({ cfop: '1102', valor: 150 });
    expect(res.saidasPorCfopArray[0]).toEqual({ cfop: '5102', valor: 200 });
    expect(res.periodo).toEqual({ inicio: '2025-06-01', fim: '2025-06-15' });
  });

  it('inclui notas na faixa e ignora as sem data para o filtro', () => {
    const res = filtrarDadosProcessadosPorPeriodo(baseDados, '2025-06-01', '2025-06-15');
    // Pelo menos as duas que têm data dentro da faixa devem permanecer
    expect(res.entradas.length).toBe(2);
  });
});
