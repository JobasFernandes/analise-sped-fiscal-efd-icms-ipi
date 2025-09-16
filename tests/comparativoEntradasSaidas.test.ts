import { describe, it, expect } from "vitest";
import { prepararDadosEntradasSaidasPorDia } from "../src/utils/dataProcessor";

describe("prepararDadosEntradasSaidasPorDia", () => {
  it("gera dois datasets com labels alinhados", () => {
    const entradas = [
      { data: "2025-06-01", valor: 100 },
      { data: "2025-06-03", valor: 50 },
    ];
    const saidas = [
      { data: "2025-06-02", valor: 200 },
      { data: "2025-06-03", valor: 25 },
    ];
    const res = prepararDadosEntradasSaidasPorDia(entradas, saidas);
    expect(res.labels.length).toBe(3);
    expect(res.datasets.length).toBe(2);
    const entradasDataset = res.datasets.find((d) => d.label === "Entradas");
    const saidasDataset = res.datasets.find((d) => d.label === "Saídas");
    expect(entradasDataset).toBeDefined();
    expect(saidasDataset).toBeDefined();
    expect(entradasDataset!.data).toEqual([100, 0, 50]);
    expect(saidasDataset!.data).toEqual([0, 200, 25]);
  });
});
