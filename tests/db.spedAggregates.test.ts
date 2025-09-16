import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

// @ts-ignore
globalThis.indexedDB = indexedDB as any;
// @ts-ignore
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

let db: any;
let addSped: any,
  getSped: any,
  getSpedProcessed: any,
  recalcularIndicadores: any;
let toProcessedData: any;

function makeSampleData(): any {
  return {
    entradas: [
      {
        numeroDoc: "E1",
        chaveNfe: "CHAVE-E1",
        dataDocumento: new Date("2024-01-10"),
        dataEntradaSaida: new Date("2024-01-10"),
        valorDocumento: 100,
        valorMercadoria: 90,
        indicadorOperacao: "0",
        situacao: "00",
        itens: [
          {
            cfop: "1102",
            valorOperacao: 100,
            cstIcms: "00",
            aliqIcms: 18,
            valorBcIcms: 100,
            valorIcms: 18,
          },
        ],
      },
    ],
    saidas: [
      {
        numeroDoc: "S1",
        chaveNfe: "CHAVE-S1",
        dataDocumento: new Date("2024-01-12"),
        dataEntradaSaida: new Date("2024-01-12"),
        valorDocumento: 200,
        valorMercadoria: 180,
        indicadorOperacao: "1",
        situacao: "00",
        itens: [
          {
            cfop: "5102",
            valorOperacao: 200,
            cstIcms: "00",
            aliqIcms: 18,
            valorBcIcms: 200,
            valorIcms: 36,
          },
        ],
      },
    ],
    totalEntradas: 100,
    totalSaidas: 200,
    totalGeral: 300,
    periodo: { inicio: new Date("2024-01-01"), fim: new Date("2024-01-31") },
  } as any;
}

describe("Agregados v2 e getSpedProcessed", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    addSped = daoMod.addSped;
    getSped = daoMod.getSped;
    const procDao = await import("../src/db/daos/spedProcessedDao");
    getSpedProcessed = procDao.getSpedProcessed;
    const dao2 = await import("../src/db/daos/spedDao");
    recalcularIndicadores = dao2.recalcularIndicadores;
    const adapter = await import("../src/db/adapters/toProcessedData");
    toProcessedData = adapter.toProcessedData;
    await db.open();
    // limpar todas as tabelas (incluindo agregadas)
    await db.transaction(
      "rw",
      db.sped_files,
      db.documents,
      db.items,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      async () => {
        await db.day_cfop_aggs.clear();
        await db.cfop_aggs.clear();
        await db.day_aggs.clear();
        await db.items.clear();
        await db.documents.clear();
        await db.sped_files.clear();
      }
    );
  });
  afterAll(async () => {
    await db.close();
  });

  it("gera agregados e carrega ProcessedData pelos agregados", async () => {
    const spedId = await addSped(makeSampleData(), {
      filename: "sample.txt",
      size: 999,
    });

    // Verifica agregados gravados
    const dayAggs = await db.day_aggs.where({ spedId }).toArray();
    const cfopAggs = await db.cfop_aggs.where({ spedId }).toArray();
    const dayCfopAggs = await db.day_cfop_aggs.where({ spedId }).toArray();
    expect(dayAggs.length).toBe(2); // uma entrada e uma saída por dia
    expect(cfopAggs.length).toBe(2); // uma entrada e uma saída por CFOP
    expect(dayCfopAggs.length).toBe(2);

    const processedByAggs = await getSpedProcessed(spedId);
    const { sped, documents, items } = await getSped(spedId);
    const processedByAdapter = toProcessedData(sped, documents, items);

    // Totais iguais
    expect(processedByAggs.totalEntradas).toBe(
      processedByAdapter.totalEntradas
    );
    expect(processedByAggs.totalSaidas).toBe(processedByAdapter.totalSaidas);
    expect(processedByAggs.totalGeral).toBe(processedByAdapter.totalGeral);

    // Arrays principais iguais (por dia e por cfop)
    expect(processedByAggs.entradasPorDiaArray).toEqual(
      processedByAdapter.entradasPorDiaArray
    );
    expect(processedByAggs.saidasPorDiaArray).toEqual(
      processedByAdapter.saidasPorDiaArray
    );
    expect(processedByAggs.entradasPorCfopArray).toEqual(
      processedByAdapter.entradasPorCfopArray
    );
    expect(processedByAggs.saidasPorCfopArray).toEqual(
      processedByAdapter.saidasPorCfopArray
    );
    // day+cfop
    expect(processedByAggs.entradasPorDiaCfopArray).toEqual(
      processedByAdapter.entradasPorDiaCfopArray
    );
    expect(processedByAggs.saidasPorDiaCfopArray).toEqual(
      processedByAdapter.saidasPorDiaCfopArray
    );
  });

  it("reconstrói agregados após limpeza e mantém equivalência", async () => {
    const spedId = await addSped(makeSampleData(), {
      filename: "agg.txt",
      size: 10,
    });
    // limpar agregados
    await db.transaction(
      "rw",
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      async () => {
        await db.day_cfop_aggs.where({ spedId }).delete();
        await db.cfop_aggs.where({ spedId }).delete();
        await db.day_aggs.where({ spedId }).delete();
      }
    );
    // rebuild
    await recalcularIndicadores(spedId);
    const processedByAggs = await getSpedProcessed(spedId);
    const { sped, documents, items } = await getSped(spedId);
    const processedByAdapter = toProcessedData(sped, documents, items);
    expect(processedByAggs.totalGeral).toBe(processedByAdapter.totalGeral);
    expect(processedByAggs.saidasPorCfopArray).toEqual(
      processedByAdapter.saidasPorCfopArray
    );
  });
});
