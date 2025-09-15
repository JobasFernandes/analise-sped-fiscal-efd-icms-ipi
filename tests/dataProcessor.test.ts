import { describe, it, expect } from "vitest";
import { formatarMoeda, prepararDadosVendasPorDia } from "../src/utils/dataProcessor";

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
