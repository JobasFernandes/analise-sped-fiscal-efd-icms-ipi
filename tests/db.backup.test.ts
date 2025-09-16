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
let addSped: any, listSpeds: any;
let exportDbToJson: any, importDbFromJson: any;

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

describe("Backup JSON do IndexedDB", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    addSped = daoMod.addSped;
    listSpeds = daoMod.listSpeds;
    const backupMod = await import("../src/db/backup");
    exportDbToJson = backupMod.exportDbToJson;
    importDbFromJson = backupMod.importDbFromJson;
    await db.open();
    // limpar todas as tabelas
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

  it("exporta, limpa, importa e reconta registros", async () => {
    const id1 = await addSped(makeSampleData(), {
      filename: "b1.txt",
      size: 1,
      contentHash: "h1",
    });
    const id2 = await addSped(makeSampleData(), {
      filename: "b2.txt",
      size: 1,
      contentHash: "h2",
    });
    expect(id1).not.toBe(id2);

    const before = await exportDbToJson();
    expect(before.sped_files.length).toBe(2);

    // limpa banco
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
    const emptyCount = await db.sped_files.count();
    expect(emptyCount).toBe(0);

    // importa
    await importDbFromJson(before, { clearBeforeImport: false });
    const list = await listSpeds();
    expect(list.length).toBe(2);

    // checa agregados presentes após import
    const ids = list.map((s: any) => s.id);
    for (const spedId of ids) {
      const dayAggs = await db.day_aggs.where({ spedId }).count();
      const cfopAggs = await db.cfop_aggs.where({ spedId }).count();
      expect(dayAggs).toBeGreaterThan(0);
      expect(cfopAggs).toBeGreaterThan(0);
    }
  });
});
