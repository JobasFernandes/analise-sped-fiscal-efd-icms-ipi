import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

// Configurar fake-indexeddb globalmente ANTES de qualquer import do db
globalThis.indexedDB = indexedDB as any;
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

// Variáveis para módulos carregados dinamicamente
let db: any;
let saveMovimentacoesDiarias: any;
let saveMovimentacoesTanques: any;
let saveVolumesBicos: any;
let analisarInconsistencias: any;
let gerarResumoInconsistencias: any;

describe("combustivelService", () => {
  let spedId: number;

  beforeAll(async () => {
    // Carrega módulos após configurar IndexedDB fake
    const dbMod = await import("../src/db/index");
    db = dbMod.db;

    const daoMod = await import("../src/db/daos/combustivelDao");
    saveMovimentacoesDiarias = daoMod.saveMovimentacoesDiarias;
    saveMovimentacoesTanques = daoMod.saveMovimentacoesTanques;
    saveVolumesBicos = daoMod.saveVolumesBicos;

    const serviceMod = await import("../src/utils/combustivelService");
    analisarInconsistencias = serviceMod.analisarInconsistencias;
    gerarResumoInconsistencias = serviceMod.gerarResumoInconsistencias;

    await db.open();

    spedId = await db.sped_files.add({
      filename: "test_combustivel_service.txt",
      size: 1000,
      totalEntradas: 0,
      totalSaidas: 0,
      totalGeral: 0,
      numeroNotasEntrada: 0,
      numeroNotasSaida: 0,
      importedAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await db.delete();
  });

  // Limpar tabelas de combustível antes de cada teste para evitar acumulação
  beforeEach(async () => {
    await db.combustivel_mov_diaria.clear();
    await db.combustivel_tanque.clear();
    await db.combustivel_bico.clear();
    await db.produtos.clear();
    await db.combustivel_inconsistencias.clear();
  });

  describe("analisarInconsistencias", () => {
    it("deve retornar array vazio se não houver movimentações", async () => {
      const result = await analisarInconsistencias(spedId);
      expect(result).toHaveLength(0);
    });

    it("deve detectar perda acima do limite ANP (0,6%)", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 4900, // Perda de 100L = 1% do disponível
          qtdPerda: 100,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
      ]);

      const result = await analisarInconsistencias(spedId);

      const perdaExcessiva = result.find((i: { tipo: string }) => i.tipo === "PERDA_ACIMA_LIMITE");
      expect(perdaExcessiva).toBeDefined();
      // 1% está entre 0.6% e 1.2% (2x limite), então é AVISO, não CRITICO
      expect(perdaExcessiva?.severidade).toBe("AVISO");
    });

    it("deve detectar sobra acima do limite ANP (0,6%)", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 5100, // Sobra de 100L = 1% do disponível
          qtdPerda: 0,
          qtdSobra: 100,
          qtdFimContabil: 5000,
        },
      ]);

      const result = await analisarInconsistencias(spedId);

      const sobraExcessiva = result.find((i: { tipo: string }) => i.tipo === "SOBRA_ACIMA_LIMITE");
      expect(sobraExcessiva).toBeDefined();
      // 1% está entre 0.6% e 1.2% (2x limite), então é AVISO, não CRITICO
      expect(sobraExcessiva?.severidade).toBe("AVISO");
    });

    it("não deve detectar inconsistência quando perda está dentro do limite", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 4970, // Perda de 30L = 0,3% do disponível (dentro do limite)
          qtdPerda: 30,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
      ]);

      const result = await analisarInconsistencias(spedId);

      const perdaExcessiva = result.find((i: { tipo: string }) => i.tipo === "PERDA_ACIMA_LIMITE");
      expect(perdaExcessiva).toBeUndefined();
    });

    it("deve detectar estoque maior sem nota de entrada", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 5000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
        {
          codItem: "740",
          dtMov: "2025-01-16",
          qtdIni: 8000, // Estoque inicial maior que final anterior sem entrada
          qtdEntr: 0,
          qtdDisponivel: 8000,
          qtdVendas: 3000,
          qtdFimFisico: 5000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
      ]);

      const result = await analisarInconsistencias(spedId);

      const estoqueSemEntrada = result.find(
        (i: { tipo: string }) => i.tipo === "ESTOQUE_MAIOR_SEM_ENTRADA"
      );
      expect(estoqueSemEntrada).toBeDefined();
    });

    it("deve detectar divergência entre soma dos tanques e total do produto", async () => {
      // Movimentação do produto
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 5000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
      ]);

      // Tanques com soma diferente
      await saveMovimentacoesTanques(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "1",
          qtdIni: 5000,
          qtdEntr: 0,
          qtdDisponivel: 5000,
          qtdVendas: 2000, // Soma será 4500, divergência de 500
          qtdFimFisico: 3000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 3000,
        },
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "2",
          qtdIni: 5000,
          qtdEntr: 0,
          qtdDisponivel: 5000,
          qtdVendas: 2500,
          qtdFimFisico: 2500,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 2500,
        },
      ]);

      const result = await analisarInconsistencias(spedId);

      const divergenciaTanques = result.find(
        (i: { tipo: string }) => i.tipo === "DIVERGENCIA_TANQUES"
      );
      expect(divergenciaTanques).toBeDefined();
    });
  });

  describe("gerarResumoInconsistencias", () => {
    it("deve retornar resumo agrupado por severidade e tipo", async () => {
      // Criar cenário com múltiplas inconsistências
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 10000,
          qtdEntr: 0,
          qtdDisponivel: 10000,
          qtdVendas: 5000,
          qtdFimFisico: 4900, // Perda de 100L = 1%
          qtdPerda: 100,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
        {
          codItem: "4",
          dtMov: "2025-01-15",
          qtdIni: 8000,
          qtdEntr: 0,
          qtdDisponivel: 8000,
          qtdVendas: 4000,
          qtdFimFisico: 4100, // Sobra de 100L = 1,25%
          qtdPerda: 0,
          qtdSobra: 100,
          qtdFimContabil: 4000,
        },
      ]);

      await analisarInconsistencias(spedId);
      const resumo = await gerarResumoInconsistencias(spedId);

      expect(resumo.total).toBeGreaterThan(0);
      expect(resumo.porSeveridade).toBeDefined();
      expect(resumo.porTipo).toBeDefined();
    });

    it("deve retornar resumo vazio se não houver inconsistências", async () => {
      const resumo = await gerarResumoInconsistencias(spedId);

      expect(resumo.total).toBe(0);
      expect(resumo.porSeveridade.CRITICO).toBe(0);
      expect(resumo.porSeveridade.AVISO).toBe(0);
      expect(resumo.porSeveridade.INFO).toBe(0);
    });
  });
});
