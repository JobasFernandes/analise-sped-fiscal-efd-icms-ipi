import { describe, it, expect } from "vitest";
import { filtrarDadosProcessadosPorPeriodo } from "../src/utils/dataProcessor";
import type { ProcessedData } from "../src/utils/types";

const baseDados: ProcessedData = {
  periodo: {
    inicio: new Date("2025-06-01T12:00:00"),
    fim: new Date("2025-06-30T12:00:00"),
  },
  entradas: [
    {
      numeroDoc: "1",
      chaveNfe: "NFE1",
      dataDocumento: new Date("2025-06-01T12:00:00"),
      dataEntradaSaida: null,
      valorDocumento: 100,
      valorMercadoria: 100,
      indicadorOperacao: "0",
      situacao: "00",
      itens: [],
    },
    {
      numeroDoc: "2",
      chaveNfe: "NFE2",
      dataDocumento: new Date("2025-06-15T12:00:00"),
      dataEntradaSaida: null,
      valorDocumento: 50,
      valorMercadoria: 50,
      indicadorOperacao: "0",
      situacao: "00",
      itens: [],
    },
    {
      numeroDoc: "3",
      chaveNfe: "NFE3",
      dataDocumento: null,
      dataEntradaSaida: null,
      valorDocumento: 0,
      valorMercadoria: 0,
      indicadorOperacao: "0",
      situacao: "00",
      itens: [],
    },
  ],
  saidas: [],
  entradasPorDiaArray: [
    { data: "2025-06-01", valor: 100 },
    { data: "2025-06-15", valor: 50 },
  ],
  saidasPorDiaArray: [{ data: "2025-06-02", valor: 200 }],
  entradasPorDiaCfopArray: [
    { data: "2025-06-01", cfop: "1102", valor: 100 },
    { data: "2025-06-15", cfop: "1102", valor: 50 },
  ],
  saidasPorDiaCfopArray: [{ data: "2025-06-02", cfop: "5102", valor: 200 }],
  entradasPorCfopArray: [],
  saidasPorCfopArray: [],
  itensPorCfopIndex: {},
  totalEntradas: 150,
  totalSaidas: 200,
  totalGeral: 350,
};

describe("filtrarDadosProcessadosPorPeriodo", () => {
  it("filtra por faixa e re-agrega CFOPs corretamente", () => {
    const res = filtrarDadosProcessadosPorPeriodo(
      baseDados,
      "2025-06-01",
      "2025-06-15"
    );
    expect(res.entradasPorDiaArray.length).toBe(2);
    expect(res.totalEntradas).toBe(150);
    expect(res.entradasPorCfopArray[0]).toEqual({ cfop: "1102", valor: 150 });
    expect(res.saidasPorCfopArray[0]).toEqual({ cfop: "5102", valor: 200 });
    expect(res.periodo).toEqual({ inicio: "2025-06-01", fim: "2025-06-15" });
  });

  it("inclui notas na faixa e mantém notas sem data", () => {
    const res = filtrarDadosProcessadosPorPeriodo(
      baseDados,
      "2025-06-01",
      "2025-06-15"
    );
    // Apenas notas com data na faixa são incluídas
    expect(res.entradas.length).toBe(3);
  });
});
