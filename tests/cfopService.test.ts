import { describe, it, expect } from "vitest";
import {
  CFOPS_ESTATICOS,
  getDescricaoCfop,
  getTipoCfop,
  filtrarCfopsPorTipo,
  getCfopsEntrada,
  getCfopsSaida,
} from "../src/utils/cfopService";

describe("cfopService", () => {
  describe("CFOPS_ESTATICOS", () => {
    it("deve ter CFOPs de entrada começando com 1 ou 2", () => {
      const cfopsEntrada = Object.keys(CFOPS_ESTATICOS).filter(
        (cfop) => cfop.startsWith("1") || cfop.startsWith("2")
      );
      expect(cfopsEntrada.length).toBeGreaterThan(0);
    });

    it("deve ter CFOPs de saída começando com 5 ou 6", () => {
      const cfopsSaida = Object.keys(CFOPS_ESTATICOS).filter(
        (cfop) => cfop.startsWith("5") || cfop.startsWith("6")
      );
      expect(cfopsSaida.length).toBeGreaterThan(0);
    });

    it("deve ter descrição para CFOPs comuns de venda", () => {
      expect(CFOPS_ESTATICOS["5102"]).toBeDefined();
      expect(CFOPS_ESTATICOS["5102"]).toContain("Venda");
      expect(CFOPS_ESTATICOS["6102"]).toBeDefined();
    });

    it("deve ter descrição para CFOPs comuns de compra", () => {
      expect(CFOPS_ESTATICOS["1102"]).toBeDefined();
      expect(CFOPS_ESTATICOS["1102"]).toContain("Compra");
      expect(CFOPS_ESTATICOS["2102"]).toBeDefined();
    });
  });

  describe("getDescricaoCfop", () => {
    it("deve retornar descrição de CFOP conhecido", () => {
      const descricao = getDescricaoCfop("5102");
      expect(descricao).toContain("Venda");
    });

    it("deve retornar fallback para CFOP desconhecido", () => {
      const descricao = getDescricaoCfop("9999");
      expect(descricao).toBe("CFOP 9999");
    });
  });

  describe("getTipoCfop", () => {
    it("deve retornar saida para CFOPs de saída (5xxx)", () => {
      expect(getTipoCfop("5102")).toBe("saida");
      expect(getTipoCfop("5405")).toBe("saida");
      expect(getTipoCfop("5656")).toBe("saida");
    });

    it("deve retornar saida para CFOPs de saída interestadual (6xxx)", () => {
      expect(getTipoCfop("6102")).toBe("saida");
      expect(getTipoCfop("6405")).toBe("saida");
    });

    it("deve retornar entrada para CFOPs de entrada (1xxx)", () => {
      expect(getTipoCfop("1102")).toBe("entrada");
      expect(getTipoCfop("1403")).toBe("entrada");
    });

    it("deve retornar entrada para CFOPs de entrada interestadual (2xxx)", () => {
      expect(getTipoCfop("2102")).toBe("entrada");
      expect(getTipoCfop("2403")).toBe("entrada");
    });
  });

  describe("filtrarCfopsPorTipo", () => {
    it("deve filtrar CFOPs por tipo de saída", () => {
      // A função espera objetos com cfop e descricao
      const cfops = [
        { cfop: "1102", descricao: "Compra" },
        { cfop: "5102", descricao: "Venda" },
        { cfop: "2102", descricao: "Compra interestadual" },
        { cfop: "6102", descricao: "Venda interestadual" },
      ];
      const filtrados = filtrarCfopsPorTipo(cfops, "saida");
      expect(filtrados).toHaveLength(2);
      expect(filtrados.map((c) => c.cfop)).toEqual(["5102", "6102"]);
    });

    it("deve filtrar CFOPs por tipo de entrada", () => {
      const cfops = [
        { cfop: "1102", descricao: "Compra" },
        { cfop: "5102", descricao: "Venda" },
        { cfop: "2102", descricao: "Compra interestadual" },
        { cfop: "6102", descricao: "Venda interestadual" },
      ];
      const filtrados = filtrarCfopsPorTipo(cfops, "entrada");
      expect(filtrados).toHaveLength(2);
      expect(filtrados.map((c) => c.cfop)).toEqual(["1102", "2102"]);
    });
  });

  describe("getCfopsEntrada", () => {
    it("deve retornar array de CFOPs de entrada com descrição", () => {
      const cfops = getCfopsEntrada();
      expect(cfops.length).toBeGreaterThan(0);
      expect(cfops[0]).toHaveProperty("cfop");
      expect(cfops[0]).toHaveProperty("descricao");
      // Verificar que todos os CFOPs são de entrada (1xxx-3xxx)
      expect(cfops.every((c) => c.cfop >= 1000 && c.cfop <= 3999)).toBe(true);
    });
  });

  describe("getCfopsSaida", () => {
    it("deve retornar array de CFOPs de saída com descrição", () => {
      const cfops = getCfopsSaida();
      expect(cfops.length).toBeGreaterThan(0);
      expect(cfops[0]).toHaveProperty("cfop");
      expect(cfops[0]).toHaveProperty("descricao");
      // Verificar que todos os CFOPs são de saída (5xxx-7xxx)
      expect(cfops.every((c) => c.cfop >= 5000 && c.cfop <= 7999)).toBe(true);
    });
  });
});
