import { describe, it, expect } from "vitest";
import { parseXmlNfe } from "../src/utils/xmlParser";
import fs from "fs";

function loadFixture(name: string) {
  return fs.readFileSync(name, "utf-8");
}

describe("parseXmlNfe", () => {
  it("extrai campos principais de nota autorizada", () => {
    const xml = loadFixture("23250921578785000154650010000003251129107857-nfe.xml");
    const nota = parseXmlNfe(xml)!;
    expect(nota).toBeTruthy();
    expect(nota.autorizada).toBe(true);
    expect(nota.chave).toContain("23250921578785000154650010000003251129107857");
    expect(nota.itens.length).toBeGreaterThan(0);
    expect(nota.itens[0].cfop).toBe("5656");
    expect(nota.dhEmi).toBeDefined();
    if (nota.dhEmi) {
      expect(nota.dataEmissao).toBe(nota.dhEmi.slice(0, 10));
    }
  });

  it("identifica nota cancelada como não autorizada", () => {
    const xml = loadFixture("23250921578785000154650010000004611477751067-nfe.xml");
    const nota = parseXmlNfe(xml)!;
    expect(nota.autorizada).toBe(false);
  });
});
