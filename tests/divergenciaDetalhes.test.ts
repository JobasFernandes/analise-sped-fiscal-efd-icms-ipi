import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

globalThis.indexedDB = indexedDB as any;
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

let db: any;
let obterDetalhesDivergencia: any;
let spedId: number;

async function seed() {
  const tables = [
    db.items,
    db.documents,
    db.sped_files,
    db.xml_notas,
    db.xml_day_cfop_aggs,
  ].filter(Boolean);
  for (const t of tables) {
    try {
      await t.clear();
    } catch {}
  }
  // SPED base
  spedId = await db.sped_files.add({
    filename: "teste.txt",
    size: 1,
    importedAt: new Date().toISOString(),
    periodoInicio: "2025-08-01",
    periodoFim: "2025-08-31",
    totalEntradas: 0,
    totalSaidas: 0,
    totalGeral: 0,
    numeroNotasEntrada: 0,
    numeroNotasSaida: 0,
    hash: null,
    companyName: "Empresa",
    cnpj: "12345678000199",
  } as any);
  const docId = "DOC1";
  await db.documents.add({
    id: docId,
    spedId,
    numeroDoc: "1",
    chaveNfe: "CHAVE-SPED-1",
    dataDocumento: "2025-08-10",
    dataEntradaSaida: "2025-08-10",
    indicadorOperacao: "1",
    situacao: "00",
    valorDocumento: 100,
    valorMercadoria: 100,
  });
  await db.items.add({
    id: "IT1",
    spedId,
    documentId: docId,
    cfop: "5102",
    valorOperacao: 60,
    cstIcms: "000",
    aliqIcms: 0,
    valorBcIcms: 0,
    valorIcms: 0,
  } as any);
  await db.items.add({
    id: "IT2",
    spedId,
    documentId: docId,
    cfop: "5102",
    valorOperacao: 40,
    cstIcms: "000",
    aliqIcms: 0,
    valorBcIcms: 0,
    valorIcms: 0,
  } as any);
  // Notas XML
  await db.xml_notas.add({
    id: "XML1",
    chave: "CHAVE-XML-UNICA",
    dataEmissao: "2025-08-10",
    modelo: "55",
    serie: "1",
    numero: "10",
    cnpjEmit: "12345678000199",
    cnpjDest: "11111111000111",
    cnpjRef: "12345678000199",
    valorTotalProduto: 50,
    itens: [{ cfop: "5102", vProd: 50 }],
  } as any);
  await db.xml_notas.add({
    id: "XML2",
    chave: "CHAVE-SPED-1",
    dataEmissao: "2025-08-10",
    modelo: "55",
    serie: "1",
    numero: "11",
    cnpjEmit: "12345678000199",
    cnpjDest: "11111111000111",
    cnpjRef: "12345678000199",
    valorTotalProduto: 120,
    itens: [{ cfop: "5102", vProd: 120 }],
  } as any);
}

describe("obterDetalhesDivergencia", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const comp = await import("../src/utils/comparisonService");
    obterDetalhesDivergencia = comp.obterDetalhesDivergencia;
    if (!db.isOpen()) {
      await db.open();
    }
    await seed();
  });

  afterAll(async () => {
    await db.close();
  });

  it("classifica notas em somente XML, somente SPED e ambos", async () => {
    const r = await obterDetalhesDivergencia(spedId, "2025-08-10", "5102");
    const byTipo = (tipo: string) => r.notas.filter((n: any) => n.tipo === tipo);
    expect(byTipo("SOMENTE_XML").length).toBe(1);
    expect(byTipo("SOMENTE_SPED").length).toBe(0); // não há nota só no SPED (a chave tem correspondente XML)
    expect(byTipo("AMBOS").length).toBe(1);
    const ambos = byTipo("AMBOS")[0];
    expect(ambos.valorSped).toBe(100); // 60+40
    expect(ambos.valorXml).toBe(120);
    expect(r.totalSped).toBe(100);
    expect(r.totalXml).toBe(170); // 120 + 50
    expect(r.diffAbs).toBe(70);
  });
});
