import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

// Configura IndexedDB fake
// @ts-ignore
globalThis.indexedDB = indexedDB as any;
// @ts-ignore
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

let db: any;
let addSped: any, getSpedProcessed: any, deleteSped: any;

function makeAugustData(): any {
  return {
    entradas: [],
    saidas: [
      {
        numeroDoc: "S1",
        chaveNfe: "CHAVE-S1",
        dataDocumento: new Date("2025-08-01"),
        dataEntradaSaida: new Date("2025-08-01"),
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
    totalEntradas: 0,
    totalSaidas: 200,
    totalGeral: 200,
    periodo: { inicio: new Date("2025-08-01"), fim: new Date("2025-08-31") },
  } as any;
}

describe("Parsing local de yyyy-MM-dd ao recarregar", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    addSped = daoMod.addSped;
    deleteSped = daoMod.deleteSped;
    const procMod = await import("../src/db/daos/spedProcessedDao");
    getSpedProcessed = procMod.getSpedProcessed;
    await db.open();
    // limpar
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

  it("mantém 2025-08-01 como primeiro dia após reabrir", async () => {
    const spedId = await addSped(makeAugustData(), {
      filename: "aug.txt",
      size: 1,
    });
    const data = await getSpedProcessed(spedId);
    // Checa que saidasPorDiaArray começa em 2025-08-01
    expect(data.saidasPorDiaArray?.[0]?.data).toBe("2025-08-01");

    // E que itensPorCfopIndex preserva Date sem ir para 2025-07-31
    const cfop5102 = data.itensPorCfopIndex["5102"][0];
    const d = cfop5102?.dataDocumento as Date | null;
    expect(d).toBeTruthy();
    // Formata como yyyy-MM-dd local
    const y = (d as Date).getFullYear();
    const m = String((d as Date).getMonth() + 1).padStart(2, "0");
    const day = String((d as Date).getDate()).padStart(2, "0");
    expect(`${y}-${m}-${day}`).toBe("2025-08-01");

    await deleteSped(spedId);
  });
});
