import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

// Setup fake-indexeddb antes de importar o db
globalThis.indexedDB = indexedDB as any;
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

let db: any;
let addSped: any;
let updateSpedDocuments: any;
let updateSpedTotals: any;

describe("updateSpedDocuments", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    addSped = daoMod.addSped;
    updateSpedDocuments = daoMod.updateSpedDocuments;
    updateSpedTotals = daoMod.updateSpedTotals;
  });
  beforeEach(async () => {
    await db.sped_files.clear();
    await db.documents.clear();
    await db.items.clear();
    await db.items_c170.clear();
    await db.day_aggs.clear();
    await db.cfop_aggs.clear();
    await db.day_cfop_aggs.clear();
  });

  afterEach(async () => {
    await db.sped_files.clear();
    await db.documents.clear();
    await db.items.clear();
    await db.items_c170.clear();
    await db.day_aggs.clear();
    await db.cfop_aggs.clear();
    await db.day_cfop_aggs.clear();
  });

  it("atualiza documento de saída pelo índice", async () => {
    // Usar chaves únicas para este teste
    const uniqueKey1 = `test1-${Date.now()}-001`;
    const uniqueKey2 = `test1-${Date.now()}-002`;

    // Criar SPED com dados
    const spedId = await addSped(
      {
        saidas: [
          {
            numeroDoc: "001",
            chaveNfe: uniqueKey1,
            valorDocumento: 1000,
            situacao: "00",
            itens: [
              {
                cfop: "5102",
                valorOperacao: 1000,
                cstIcms: "00",
                aliqIcms: 18,
                valorBcIcms: 1000,
                valorIcms: 180,
              },
            ],
          },
          {
            numeroDoc: "002",
            chaveNfe: uniqueKey2,
            valorDocumento: 2000,
            situacao: "00",
            itens: [
              {
                cfop: "5102",
                valorOperacao: 2000,
                cstIcms: "00",
                aliqIcms: 18,
                valorBcIcms: 2000,
                valorIcms: 360,
              },
            ],
          },
        ],
        entradas: [],
        totalSaidas: 3000,
        totalEntradas: 0,
        totalGeral: 3000,
      } as any,
      { filename: "test.txt", size: 1000 }
    );

    // Atualizar segundo documento (saida-1)
    await updateSpedDocuments(spedId, {
      "saida-1": { valorDocumento: 2500, situacao: "02" },
    });

    // Verificar - usar chaveNfe para identificar os documentos
    const docs = await db.documents.where({ spedId }).toArray();
    const saidas = docs.filter((d: any) => d.indicadorOperacao === "1");

    // Ordenar pela mesma lógica usada na função updateSpedDocuments
    saidas.sort((a: any, b: any) => (a.id || "").localeCompare(b.id || ""));

    // Encontrar pelos valores que sabemos
    const doc001 = saidas.find((d: any) => d.chaveNfe === uniqueKey1);
    const doc002 = saidas.find((d: any) => d.chaveNfe === uniqueKey2);

    expect(doc002!.valorDocumento).toBe(2500);
    expect(doc002!.situacao).toBe("02");
    // Primeiro documento não deve ter mudado
    expect(doc001!.valorDocumento).toBe(1000);
    expect(doc001!.situacao).toBe("00");
  });

  it("atualiza documento de entrada pelo índice", async () => {
    const spedId = await addSped(
      {
        entradas: [
          {
            numeroDoc: "E001",
            chaveNfe: "ENT001",
            valorDocumento: 500,
            situacao: "00",
            itens: [
              {
                cfop: "1102",
                valorOperacao: 500,
                cstIcms: "00",
                aliqIcms: 18,
                valorBcIcms: 500,
                valorIcms: 90,
              },
            ],
          },
        ],
        saidas: [],
        totalEntradas: 500,
        totalSaidas: 0,
        totalGeral: 500,
      } as any,
      { filename: "test.txt", size: 1000 }
    );

    await updateSpedDocuments(spedId, {
      "entrada-0": { valorDocumento: 750 },
    });

    const docs = await db.documents.where({ spedId }).toArray();
    const entradas = docs.filter((d: any) => d.indicadorOperacao === "0");

    expect(entradas[0].valorDocumento).toBe(750);
  });

  it("atualiza múltiplos documentos em uma chamada", async () => {
    const spedId = await addSped(
      {
        saidas: [
          {
            numeroDoc: "S001",
            chaveNfe: "S001",
            valorDocumento: 100,
            situacao: "00",
            itens: [],
          },
          {
            numeroDoc: "S002",
            chaveNfe: "S002",
            valorDocumento: 200,
            situacao: "00",
            itens: [],
          },
        ],
        entradas: [
          {
            numeroDoc: "E001",
            chaveNfe: "E001",
            valorDocumento: 300,
            situacao: "00",
            itens: [],
          },
        ],
        totalSaidas: 300,
        totalEntradas: 300,
        totalGeral: 600,
      } as any,
      { filename: "test.txt", size: 1000 }
    );

    await updateSpedDocuments(spedId, {
      "saida-0": { valorDocumento: 150 },
      "saida-1": { valorDocumento: 250 },
      "entrada-0": { valorDocumento: 350, situacao: "02" },
    });

    const docs = await db.documents.where({ spedId }).toArray();
    const saidas = docs
      .filter((d: any) => d.indicadorOperacao === "1")
      .sort((a: any, b: any) => (a.id || "").localeCompare(b.id || ""));
    const entradas = docs.filter((d: any) => d.indicadorOperacao === "0");

    expect(saidas[0].valorDocumento).toBe(150);
    expect(saidas[1].valorDocumento).toBe(250);
    expect(entradas[0].valorDocumento).toBe(350);
    expect(entradas[0].situacao).toBe("02");
  });

  it("updateSpedTotals atualiza totais corretamente", async () => {
    const spedId = await addSped(
      {
        saidas: [],
        entradas: [],
        totalSaidas: 1000,
        totalEntradas: 500,
        totalGeral: 1500,
      } as any,
      { filename: "test.txt", size: 1000 }
    );

    await updateSpedTotals(spedId, {
      totalSaidas: 2000,
      totalEntradas: 800,
      totalGeral: 2800,
      numeroNotasEntrada: 10,
      numeroNotasSaida: 20,
    });

    const sped = await db.sped_files.get(spedId);
    expect(sped?.totalSaidas).toBe(2000);
    expect(sped?.totalEntradas).toBe(800);
    expect(sped?.totalGeral).toBe(2800);
    expect(sped?.numeroNotasEntrada).toBe(10);
    expect(sped?.numeroNotasSaida).toBe(20);
  });
});
