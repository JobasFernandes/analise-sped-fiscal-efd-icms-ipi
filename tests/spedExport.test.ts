import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import {
  readFileAsText,
  stringToIso88591Blob,
  filterSpedContent,
} from "../src/utils/spedExportUtils";

globalThis.indexedDB = indexedDB as any;
(globalThis as any).IDBKeyRange = IDBKeyRange as any;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

class MockFileReader {
  onload: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  readAsText(blob: Blob, encoding: string) {
    blob.arrayBuffer().then((buffer) => {
      try {
        const decoder = new TextDecoder(encoding || "utf-8");
        const result = decoder.decode(buffer);
        if (this.onload) {
          this.onload({ target: { result } });
        }
      } catch (e) {
        if (this.onerror) this.onerror(e);
      }
    });
  }
}
global.FileReader = MockFileReader as any;

let db: any;
let createSpedFile: any;
let getSpedContent: any;
let deleteSped: any;
let listSpeds: any;

describe("SPED Export & Storage", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const daoMod = await import("../src/db/daos/spedDao");
    createSpedFile = daoMod.createSpedFile;
    getSpedContent = daoMod.getSpedContent;
    deleteSped = daoMod.deleteSped;
    listSpeds = daoMod.listSpeds;

    await db.open();
    await db.transaction("rw", db.sped_files, db.table("sped_contents"), async () => {
      await db.sped_files.clear();
      await db.table("sped_contents").clear();
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe("Utils: Encoding & Filtering", () => {
    it("converts string to ISO-8859-1 Blob correctly", async () => {
      const input = "Ação";
      const blob = stringToIso88591Blob(input);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toContain("iso-8859-1");

      const buf = await blob.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      expect(uint8.length).toBe(4);
      expect(uint8[0]).toBe(65);
      expect(uint8[1]).toBe(231);
      expect(uint8[2]).toBe(227);
      expect(uint8[3]).toBe(111);
    });

    it("replaces unsupported characters with '?'", async () => {
      const input = "Test €";
      const blob = stringToIso88591Blob(input);
      const buf = await blob.arrayBuffer();
      const uint8 = new Uint8Array(buf);

      expect(uint8[5]).toBe(63);
    });

    it("reads Blob as Text with encoding", async () => {
      const input = "Ação";
      const blob = stringToIso88591Blob(input);
      const text = await readFileAsText(blob, "iso-8859-1");
      expect(text).toBe(input);
    });

    it("filters C170 records from SAIDA documents only", async () => {
      const content = `|0000|...|
|C100|1|0||65|00|001|123|...|
|C170|Item 1|
|C170|Item 2|
|C190|...|
|C990|10|
|9900|C170|2|
|9990|5|
|9999|15|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).not.toContain("|C170|");
      expect(filteredText).toContain("|C100|");
      expect(filteredText).toContain("|C190|");
      expect(filteredText).toContain("|C990|8|");
      expect(filteredText).toContain("|9999|12|");
    });

    it("keeps C170 records from ENTRADA documents", async () => {
      const content = `|0000|...|
|C100|0|1|40052|55|00|003|456|...|
|C170|Item Entrada 1|
|C170|Item Entrada 2|
|C190|...|
|C990|10|
|9900|C170|2|
|9990|5|
|9999|15|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).toContain("|C170|Item Entrada 1|");
      expect(filteredText).toContain("|C170|Item Entrada 2|");
      expect(filteredText).toContain("|C100|");
      expect(filteredText).toContain("|C190|");
      expect(filteredText).toContain("|C990|10|");
      expect(filteredText).toContain("|9999|15|");
    });

    it("filters C170 from SAIDA but keeps from ENTRADA in mixed content", async () => {
      const content = `|0000|...|
|C100|0|1|40052|55|00|003|111|...|
|C170|Item Entrada|
|C190|...|
|C100|1|0||65|00|001|222|...|
|C170|Item Saida|
|C190|...|
|C990|12|
|9900|C170|2|
|9990|5|
|9999|18|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).toContain("|C170|Item Entrada|");
      expect(filteredText).not.toContain("|C170|Item Saida|");
      expect(filteredText).toContain("|C990|11|");
    });

    it("filters C170 and child records (C171-C179) from SAIDA", async () => {
      const content = `|0000|...|
|C100|1|0||65|00|001|123|...|
|C170|Item 1|
|C171|002|5000,000|
|C170|Item 2|
|C175|VIN123|
|C190|...|
|C990|12|
|9900|C170|2|
|9900|C171|1|
|9900|C175|1|
|9990|7|
|9999|18|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).not.toContain("|C170|");
      expect(filteredText).not.toContain("|C171|");
      expect(filteredText).not.toContain("|C175|");
      expect(filteredText).toContain("|C100|");
      expect(filteredText).toContain("|C190|");
      expect(filteredText).toContain("|C990|8|");
      expect(filteredText).toContain("|9999|11|");
    });

    it("keeps C170 and child records (C171-C179) from ENTRADA", async () => {
      const content = `|0000|...|
|C100|0|1|40052|55|00|003|456|...|
|C170|Item Entrada|
|C171|002|5000,000|
|C190|...|
|C990|10|
|9900|C170|1|
|9900|C171|1|
|9990|6|
|9999|16|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).toContain("|C170|Item Entrada|");
      expect(filteredText).toContain("|C171|002|5000,000|");
      expect(filteredText).toContain("|C990|10|");
      expect(filteredText).toContain("|9999|16|");
    });

    it("updates 9900|9900| counter when 9900 lines are removed", async () => {
      const content = `|0000|...|
|C100|1|0||65|00|001|123|...|
|C170|Item 1|
|C170|Item 2|
|C190|...|
|C990|10|
|9900|0000|1|
|9900|C100|1|
|9900|C170|2|
|9900|C190|1|
|9900|C990|1|
|9900|9900|8|
|9900|9990|1|
|9900|9999|1|
|9990|8|
|9999|18|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      expect(filteredText).not.toContain("|C170|Item");

      expect(filteredText).not.toContain("|9900|C170|");

      expect(filteredText).toContain("|9900|9900|7|");

      expect(filteredText).toContain("|C990|8|");
      expect(filteredText).toContain("|9990|7|");
      expect(filteredText).toContain("|9999|15|");
    });

    it("clears NFC-e C100 fields that are not allowed without items", async () => {
      const c100 =
        "|C100|1|0|PART123|65|00|A1|123|CHV|01122025|01122025|100,00|0|0,00|0,00|100,00|0|0,00|0,00|0,00|100,00|18,00|10,00|2,00|1,00|0,65|3,00|0,10|0,20|";

      const content = `|0000|...|
${c100}
|C170|Item 1|
|C190|...|
|C990|5|
|9999|7|`;

      const blob = stringToIso88591Blob(content);
      const filteredBlob = await filterSpedContent(blob, true);
      const filteredText = await readFileAsText(filteredBlob, "iso-8859-1");

      const c100Line = filteredText
        .split(/\r?\n/)
        .find((l) => l.trim().startsWith("|C100|"));
      expect(c100Line).toBeTruthy();

      const parts = (c100Line as string).split("|");
      expect(parts[4]).toBe("");
      expect(parts[5]).toBe("65");

      expect(parts[23]).toBe("");
      expect(parts[24]).toBe("");
      expect(parts[25]).toBe("");
      expect(parts[26]).toBe("");
      expect(parts[27]).toBe("");
      expect(parts[28]).toBe("");
      expect(parts[29]).toBe("");
    });

    it("pads CST_ICMS to 3 digits in generated C190 for added docs", async () => {
      const { generateC190Line } = await import("../src/utils/spedLineGenerator");

      const line = generateC190Line({
        cstIcms: "61",
        cfop: "5656",
        aliqIcms: 0,
        valorOperacao: 100,
        valorBcIcms: 0,
        valorIcms: 0,
        valorIpi: 0,
      } as any);

      expect(line).toContain("|C190|061|5656|");
    });

    it("sets IND_EMIT=0 for NFC-e (65) SAIDA added docs", async () => {
      const { generateC100Line } = await import("../src/utils/spedLineGenerator");

      const doc = {
        indicadorOperacao: "1",
        situacao: "00",
        numeroDoc: "626684",
        chaveNfe: "26251108106732000253650010006266841531307360",
        dataDocumento: "2025-11-02",
        dataEntradaSaida: "2025-11-02",
        valorDocumento: 100,
        valorMercadoria: 100,
      } as any;

      const line = generateC100Line(doc, []);
      expect(line).toContain("|C100|1|0|");
      expect(line).toContain("|65|");
    });

    it("fills mandatory C190 numeric fields with 0,00", async () => {
      const { generateC190Line } = await import("../src/utils/spedLineGenerator");

      const line = generateC190Line({
        cstIcms: "061",
        cfop: "5656",
        aliqIcms: 0,
        valorOperacao: 100,
        valorBcIcms: 0,
        valorIcms: 0,
        valorIpi: 0,
      } as any);

      expect(line).toContain("|0,00|0,00|0,00|");
    });

    it("returns original content if filter is false", async () => {
      const content = `|C170|Item 1|`;
      const blob = stringToIso88591Blob(content);
      const result = await filterSpedContent(blob, false);

      const text = await readFileAsText(result, "iso-8859-1");
      expect(text).toBe(content);
    });
  });

  describe("DAO: File Storage", () => {
    it("stores and retrieves file content", async () => {
      const content = "Conteúdo do arquivo SPED";
      const file = new File([content], "teste.txt", { type: "text/plain" });

      const id = await createSpedFile({
        filename: "teste.txt",
        size: file.size,
        file: file,
      });

      expect(id).toBeTruthy();

      const retrievedBlob = await getSpedContent(id);
      expect(retrievedBlob).toBeDefined();

      const text = await readFileAsText(retrievedBlob as Blob, "utf-8");
      expect(text).toBe(content);
    });

    it("deletes file content when SPED is deleted", async () => {
      const file = new File(["Delete me"], "delete.txt");
      const id = await createSpedFile({
        filename: "delete.txt",
        size: file.size,
        file: file,
      });

      const before = await getSpedContent(id);
      expect(before).toBeDefined();

      await deleteSped(id);

      const after = await getSpedContent(id);
      expect(after).toBeUndefined();

      const row = await db.table("sped_contents").where({ spedId: id }).first();
      expect(row).toBeUndefined();
    });
  });
});
