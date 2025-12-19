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
let saveCombustivelBatch: any;
let getMovimentacoesDiariasBySpedId: any;
let getTanquesBySpedAndData: any;
let getProdutosCombustivel: any;
let getProdutosCombustivelComDescricao: any;
let saveProdutos: any;
let getDescricaoProduto: any;
let getTotaisPorProduto: any;
let deleteCombustivelBySpedId: any;

describe("combustivelDao", () => {
  let spedId: number;

  beforeAll(async () => {
    // Carrega módulos após configurar IndexedDB fake
    const dbMod = await import("../src/db/index");
    db = dbMod.db;

    const daoMod = await import("../src/db/daos/combustivelDao");
    saveMovimentacoesDiarias = daoMod.saveMovimentacoesDiarias;
    saveMovimentacoesTanques = daoMod.saveMovimentacoesTanques;
    saveVolumesBicos = daoMod.saveVolumesBicos;
    saveCombustivelBatch = daoMod.saveCombustivelBatch;
    getMovimentacoesDiariasBySpedId = daoMod.getMovimentacoesDiariasBySpedId;
    getTanquesBySpedAndData = daoMod.getTanquesBySpedAndData;
    getProdutosCombustivel = daoMod.getProdutosCombustivel;
    getProdutosCombustivelComDescricao = daoMod.getProdutosCombustivelComDescricao;
    saveProdutos = daoMod.saveProdutos;
    getDescricaoProduto = daoMod.getDescricaoProduto;
    getTotaisPorProduto = daoMod.getTotaisPorProduto;
    deleteCombustivelBySpedId = daoMod.deleteCombustivelBySpedId;

    // Abrir banco
    await db.open();

    // Criar um SPED base para os testes
    spedId = await db.sped_files.add({
      filename: "test_combustivel.txt",
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

  describe("saveMovimentacoesDiarias", () => {
    it("deve salvar movimentações diárias de combustível (1300)", async () => {
      const movimentacoes = [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 10000,
          qtdDisponivel: 15000,
          qtdVendas: 8000,
          qtdFimFisico: 6950,
          qtdPerda: 50,
          qtdSobra: 0,
          qtdFimContabil: 7000,
        },
      ];

      await saveMovimentacoesDiarias(spedId, movimentacoes);

      const saved = await db.combustivel_mov_diaria.where({ spedId }).toArray();
      expect(saved).toHaveLength(1);
      expect(saved[0].codItem).toBe("740");
      expect(saved[0].qtdIni).toBe(5000);
      expect(saved[0].qtdVendas).toBe(8000);
    });

    it("não deve fazer nada com array vazio", async () => {
      await saveMovimentacoesDiarias(spedId, []);

      const saved = await db.combustivel_mov_diaria.where({ spedId }).toArray();
      expect(saved).toHaveLength(0);
    });
  });

  describe("saveMovimentacoesTanques", () => {
    it("deve salvar movimentações por tanque (1310)", async () => {
      const tanques = [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "1",
          qtdIni: 2500,
          qtdEntr: 5000,
          qtdDisponivel: 7500,
          qtdVendas: 4000,
          qtdFimFisico: 3475,
          qtdPerda: 25,
          qtdSobra: 0,
          qtdFimContabil: 3500,
        },
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "2",
          qtdIni: 2500,
          qtdEntr: 5000,
          qtdDisponivel: 7500,
          qtdVendas: 4000,
          qtdFimFisico: 3475,
          qtdPerda: 25,
          qtdSobra: 0,
          qtdFimContabil: 3500,
        },
      ];

      await saveMovimentacoesTanques(spedId, tanques);

      const saved = await db.combustivel_tanque.where({ spedId }).toArray();
      expect(saved).toHaveLength(2);
      expect(saved[0].numTanque).toBe("1");
      expect(saved[1].numTanque).toBe("2");
    });
  });

  describe("saveVolumesBicos", () => {
    it("deve salvar volumes de vendas por bico (1320)", async () => {
      const bicos = [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "1",
          numBico: "01",
          numInterv: "",
          motInterv: "",
          nomInterv: "",
          encerranteIni: 100000,
          encerranteFim: 102000,
          qtdAfericao: 0,
          qtdVendas: 2000,
        },
      ];

      await saveVolumesBicos(spedId, bicos);

      const saved = await db.combustivel_bico.where({ spedId }).toArray();
      expect(saved).toHaveLength(1);
      expect(saved[0].numBico).toBe("01");
      expect(saved[0].encerranteIni).toBe(100000);
      expect(saved[0].encerranteFim).toBe(102000);
    });
  });

  describe("saveCombustivelBatch", () => {
    it("deve salvar todos os dados de combustível em batch", async () => {
      const data = {
        combustivelMovDiaria: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            qtdIni: 5000,
            qtdEntr: 10000,
            qtdDisponivel: 15000,
            qtdVendas: 8000,
            qtdFimFisico: 6950,
            qtdPerda: 50,
            qtdSobra: 0,
            qtdFimContabil: 7000,
          },
        ],
        combustivelTanques: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            numTanque: "1",
            qtdIni: 5000,
            qtdEntr: 10000,
            qtdDisponivel: 15000,
            qtdVendas: 8000,
            qtdFimFisico: 6950,
            qtdPerda: 50,
            qtdSobra: 0,
            qtdFimContabil: 7000,
          },
        ],
        combustivelBicos: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            numTanque: "1",
            numBico: "01",
            numInterv: "",
            motInterv: "",
            nomInterv: "",
            encerranteIni: 100000,
            encerranteFim: 108000,
            qtdAfericao: 0,
            qtdVendas: 8000,
          },
        ],
      };

      await saveCombustivelBatch(spedId, data);

      const movs = await db.combustivel_mov_diaria.where({ spedId }).toArray();
      const tanques = await db.combustivel_tanque.where({ spedId }).toArray();
      const bicos = await db.combustivel_bico.where({ spedId }).toArray();

      expect(movs).toHaveLength(1);
      expect(tanques).toHaveLength(1);
      expect(bicos).toHaveLength(1);
    });
  });

  describe("getMovimentacoesDiariasBySpedId", () => {
    it("deve retornar todas as movimentações do SPED", async () => {
      const movimentacoes = [
        {
          codItem: "740",
          dtMov: "2025-01-17",
          qtdIni: 7000,
          qtdEntr: 0,
          qtdDisponivel: 7000,
          qtdVendas: 3000,
          qtdFimFisico: 4000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 4000,
        },
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 10000,
          qtdDisponivel: 15000,
          qtdVendas: 8000,
          qtdFimFisico: 7000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 7000,
        },
      ];

      await saveMovimentacoesDiarias(spedId, movimentacoes);

      const result = await getMovimentacoesDiariasBySpedId(spedId);
      expect(result).toHaveLength(2);

      // Verificar que ambas as datas existem (sem assumir ordenação)
      const datas = result.map((r: { dtMov: string }) => r.dtMov).sort();
      expect(datas).toEqual(["2025-01-15", "2025-01-17"]);
    });
  });

  describe("getTanquesBySpedAndData", () => {
    it("deve filtrar tanques por data", async () => {
      const tanques = [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          numTanque: "1",
          qtdIni: 2500,
          qtdEntr: 5000,
          qtdDisponivel: 7500,
          qtdVendas: 4000,
          qtdFimFisico: 3500,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 3500,
        },
        {
          codItem: "4",
          dtMov: "2025-01-16", // Dia diferente
          numTanque: "2",
          qtdIni: 3000,
          qtdEntr: 0,
          qtdDisponivel: 3000,
          qtdVendas: 1500,
          qtdFimFisico: 1500,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 1500,
        },
      ];

      await saveMovimentacoesTanques(spedId, tanques);

      // Função filtra apenas por spedId e dtMov
      const result = await getTanquesBySpedAndData(spedId, "2025-01-15");
      expect(result).toHaveLength(1);
      expect(result[0].numTanque).toBe("1");
    });
  });

  describe("getProdutosCombustivel", () => {
    it("deve retornar lista única de códigos de produto", async () => {
      const movimentacoes = [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 0,
          qtdDisponivel: 5000,
          qtdVendas: 2000,
          qtdFimFisico: 3000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 3000,
        },
        {
          codItem: "4",
          dtMov: "2025-01-15",
          qtdIni: 3000,
          qtdEntr: 0,
          qtdDisponivel: 3000,
          qtdVendas: 1000,
          qtdFimFisico: 2000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 2000,
        },
        {
          codItem: "740",
          dtMov: "2025-01-16",
          qtdIni: 3000,
          qtdEntr: 5000,
          qtdDisponivel: 8000,
          qtdVendas: 3000,
          qtdFimFisico: 5000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 5000,
        },
      ];

      await saveMovimentacoesDiarias(spedId, movimentacoes);

      const produtos = await getProdutosCombustivel(spedId);
      expect(produtos).toHaveLength(2);
      expect(produtos).toContain("4");
      expect(produtos).toContain("740");
    });
  });

  describe("saveProdutos e getProdutosCombustivelComDescricao", () => {
    it("deve salvar produtos e retornar com descrição", async () => {
      // Primeiro salvar movimentações para ter produtos
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 0,
          qtdDisponivel: 5000,
          qtdVendas: 2000,
          qtdFimFisico: 3000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 3000,
        },
        {
          codItem: "4",
          dtMov: "2025-01-15",
          qtdIni: 3000,
          qtdEntr: 0,
          qtdDisponivel: 3000,
          qtdVendas: 1000,
          qtdFimFisico: 2000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 2000,
        },
      ]);

      // Salvar descrições dos produtos (registro 0200)
      await saveProdutos(spedId, [
        { codItem: "740", descrItem: "DIESEL S10", unidInv: "L", tipoItem: "00" },
        {
          codItem: "4",
          descrItem: "GASOLINA COMUM C",
          unidInv: "L",
          tipoItem: "00",
        },
      ]);

      const produtos = await getProdutosCombustivelComDescricao(spedId);
      expect(produtos).toHaveLength(2);

      const diesel = produtos.find((p: { codItem: string }) => p.codItem === "740");
      const gasolina = produtos.find((p: { codItem: string }) => p.codItem === "4");

      expect(diesel?.descricao).toBe("DIESEL S10");
      expect(gasolina?.descricao).toBe("GASOLINA COMUM C");
    });

    it("deve retornar produtos sem descrição se não houver registro 0200", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 0,
          qtdDisponivel: 5000,
          qtdVendas: 2000,
          qtdFimFisico: 3000,
          qtdPerda: 0,
          qtdSobra: 0,
          qtdFimContabil: 3000,
        },
      ]);

      const produtos = await getProdutosCombustivelComDescricao(spedId);
      expect(produtos).toHaveLength(1);
      expect(produtos[0].codItem).toBe("740");
      expect(produtos[0].descricao).toBe("");
    });
  });

  describe("getDescricaoProduto", () => {
    it("deve retornar descrição de um produto específico", async () => {
      await saveProdutos(spedId, [
        { codItem: "740", descrItem: "DIESEL S10", unidInv: "L", tipoItem: "00" },
      ]);

      const descricao = await getDescricaoProduto(spedId, "740");
      expect(descricao).toBe("DIESEL S10");
    });

    it("deve retornar null se produto não existir", async () => {
      const descricao = await getDescricaoProduto(spedId, "999");
      expect(descricao).toBeNull();
    });
  });

  describe("getTotaisPorProduto", () => {
    it("deve calcular totais por produto", async () => {
      await saveMovimentacoesDiarias(spedId, [
        {
          codItem: "740",
          dtMov: "2025-01-15",
          qtdIni: 5000,
          qtdEntr: 10000,
          qtdDisponivel: 15000,
          qtdVendas: 8000,
          qtdFimFisico: 6950,
          qtdPerda: 50,
          qtdSobra: 0,
          qtdFimContabil: 7000,
        },
        {
          codItem: "740",
          dtMov: "2025-01-16",
          qtdIni: 7000,
          qtdEntr: 0,
          qtdDisponivel: 7000,
          qtdVendas: 3000,
          qtdFimFisico: 3980,
          qtdPerda: 20,
          qtdSobra: 0,
          qtdFimContabil: 4000,
        },
      ]);

      const totais = await getTotaisPorProduto(spedId);
      expect(totais).toHaveLength(1);
      expect(totais[0].codItem).toBe("740");
      expect(totais[0].totalVendas).toBe(11000); // 8000 + 3000
      expect(totais[0].totalEntradas).toBe(10000);
      expect(totais[0].totalPerdas).toBe(70); // 50 + 20
    });
  });

  describe("deleteCombustivelBySpedId", () => {
    it("deve deletar todos os dados de combustível de um SPED", async () => {
      // Inserir dados
      await saveCombustivelBatch(spedId, {
        combustivelMovDiaria: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            qtdIni: 5000,
            qtdEntr: 0,
            qtdDisponivel: 5000,
            qtdVendas: 2000,
            qtdFimFisico: 3000,
            qtdPerda: 0,
            qtdSobra: 0,
            qtdFimContabil: 3000,
          },
        ],
        combustivelTanques: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            numTanque: "1",
            qtdIni: 5000,
            qtdEntr: 0,
            qtdDisponivel: 5000,
            qtdVendas: 2000,
            qtdFimFisico: 3000,
            qtdPerda: 0,
            qtdSobra: 0,
            qtdFimContabil: 3000,
          },
        ],
        combustivelBicos: [
          {
            codItem: "740",
            dtMov: "2025-01-15",
            numTanque: "1",
            numBico: "01",
            numInterv: "",
            motInterv: "",
            nomInterv: "",
            encerranteIni: 100000,
            encerranteFim: 102000,
            qtdAfericao: 0,
            qtdVendas: 2000,
          },
        ],
      });

      // Verificar que dados existem
      let movs = await db.combustivel_mov_diaria.where({ spedId }).toArray();
      expect(movs.length).toBeGreaterThan(0);

      // Deletar
      await deleteCombustivelBySpedId(spedId);

      // Verificar que foram removidos
      movs = await db.combustivel_mov_diaria.where({ spedId }).toArray();
      const tanques = await db.combustivel_tanque.where({ spedId }).toArray();
      const bicos = await db.combustivel_bico.where({ spedId }).toArray();

      expect(movs).toHaveLength(0);
      expect(tanques).toHaveLength(0);
      expect(bicos).toHaveLength(0);
    });
  });
});
