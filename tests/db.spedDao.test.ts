import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

globalThis.indexedDB = indexedDB as any;
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

let db: any;
let addSped: any, listSpeds: any, getSped: any, deleteSped: any;

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

describe("DAO SPED", () => {
  beforeAll(async () => {
    // Carrega módulos após configurar IndexedDB fake
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    addSped = daoMod.addSped;
    listSpeds = daoMod.listSpeds;
    getSped = daoMod.getSped;
    deleteSped = daoMod.deleteSped;
    await db.open();
    // limpar tabelas para estado limpo
    await db.transaction(
      "rw",
      db.sped_files,
      db.documents,
      db.items,
      async () => {
        await db.items.clear();
        await db.documents.clear();
        await db.sped_files.clear();
      }
    );
  });
  afterAll(async () => {
    await db.close();
  });

  it("insere, lista, carrega e apaga em cascade", async () => {
    const spedId = await addSped(makeSampleData(), {
      filename: "sample.txt",
      size: 1234,
    });
    expect(spedId).toBeTruthy();

    const list = await listSpeds();
    expect(list.length).toBe(1);
    expect(list[0].filename).toBe("sample.txt");

    const loaded = await getSped(spedId);
    expect(loaded.documents.length).toBe(2); // 1 entrada + 1 saida
    expect(loaded.items.length).toBe(2); // 2 itens

    await deleteSped(spedId);

    const listAfter = await listSpeds();
    expect(listAfter.length).toBe(0);

    // Confirm cascade: sem docs/itens
    const docsCount = await db.documents.count();
    const itemsCount = await db.items.count();
    expect(docsCount).toBe(0);
    expect(itemsCount).toBe(0);
  });

  it("deduplica por hash quando informado", async () => {
    const data = makeSampleData();
    const meta = { filename: "dup.txt", size: 1, contentHash: "abc123" } as any;
    const id1 = await addSped(data, meta);
    const id2 = await addSped(data, meta);
    expect(id1).toBe(id2);
    const list = await listSpeds();
    // Deve manter apenas um registro com esse hash
    const only = list.filter((s: any) => s.hash === "abc123");
    expect(only.length).toBe(1);
  });
});
