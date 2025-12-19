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

    it("filters C170 records from content", async () => {
      const content = `|0000|...|
|C100|...|
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
      // Contadores devem ser atualizados
      expect(filteredText).toContain("|C990|8|"); // 10 - 2 C170
      expect(filteredText).toContain("|9999|12|"); // 15 - 2 C170 - 1 linha 9900 removida
    });

    it("filters C170 and child records (C171-C179)", async () => {
      const content = `|0000|...|
|C100|...|
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

      // C170 e filhos devem ser removidos
      expect(filteredText).not.toContain("|C170|");
      expect(filteredText).not.toContain("|C171|");
      expect(filteredText).not.toContain("|C175|");
      // Outros registros devem permanecer
      expect(filteredText).toContain("|C100|");
      expect(filteredText).toContain("|C190|");
      // Contadores devem ser atualizados
      expect(filteredText).toContain("|C990|8|"); // 12 - 4 (2 C170 + 1 C171 + 1 C175)
      expect(filteredText).toContain("|9999|11|"); // 18 - 4 registros - 3 linhas 9900 removidas
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
