import { describe, it, expect } from "vitest";
import {
  filtrarDadosProcessadosPorPeriodo,
  formatarMoeda,
  prepararDadosVendasPorDia,
} from "../src/utils/dataProcessor";
import type { ProcessedData } from "../src/utils/types";

function mkDadosBase(): ProcessedData {
  return {
    entradas: [],
    saidas: [],
    entradasPorDiaArray: [
      { data: "2025-01-01", valor: 10 },
      { data: "2025-01-02", valor: 20 },
    ],
    saidasPorDiaArray: [
      { data: "2025-01-01", valor: 100 },
      { data: "2025-01-03", valor: 300 },
    ],
    entradasPorDiaCfopArray: [
      { data: "2025-01-01", cfop: "1102", valor: 10 },
      { data: "2025-01-02", cfop: "1102", valor: 20 },
    ],
    saidasPorDiaCfopArray: [
      { data: "2025-01-01", cfop: "5102", valor: 100 },
      { data: "2025-01-03", cfop: "5102", valor: 300 },
    ],
    totalEntradas: 30,
    totalSaidas: 400,
    totalGeral: 430,
    periodo: { inicio: "2025-01-01", fim: "2025-01-03" },
    itensPorCfopIndex: {
      "1102": [],
      "5102": [],
    },
  };
}

describe("dataProcessor - filtros e totais", () => {
  it("recalcula totais ao filtrar por período", () => {
    const dados = mkDadosBase();
    const filtrado = filtrarDadosProcessadosPorPeriodo(
      dados,
      "2025-01-01",
      "2025-01-02"
    );
    expect(filtrado.totalEntradas).toBe(30);
    expect(filtrado.totalSaidas).toBe(100);
    expect(filtrado.totalGeral).toBe(130);
    expect(filtrado.entradasPorCfopArray?.reduce((a, i) => a + i.valor, 0)).toBe(30);
    expect(filtrado.saidasPorCfopArray?.reduce((a, i) => a + i.valor, 0)).toBe(100);
  });
});

describe("dataProcessor", () => {
  it("formata moeda em BRL", () => {
    expect(formatarMoeda(1234.56)).toContain("R$");
  });

  it("prepara labels e dataset por dia", () => {
    const input = [
      { data: "2024-01-01", valor: 10 },
      { data: "2024-01-02", valor: 20 },
    ];
    const out = prepararDadosVendasPorDia(input);
    expect(out.labels.length).toBe(2);
    expect(out.datasets.length).toBe(1);
  });
});
