import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpedFile } from "../src/utils/spedParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readFixture = (name) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

describe("SpedParser", () => {
  it("deve processar entradas e saídas básicas do SPED (happy path)", () => {
    const content = readFixture("sample_sped_minimo.txt");
    const dados = parseSpedFile(content);

    expect(dados.totalGeral).toBeCloseTo(1500.0, 6);
    expect(dados.totalSaidas).toBeCloseTo(500.0, 6);
    expect(dados.totalEntradas).toBeCloseTo(1000.0, 6);

    expect(dados.periodo.inicio).toBeInstanceOf(Date);
    expect(dados.periodo.fim).toBeInstanceOf(Date);

    expect(dados.saidasPorDiaArray.length).toBeGreaterThan(0);
    expect(dados.entradasPorDiaArray.length).toBeGreaterThan(0);

    const cfopSaida = dados.saidasPorCfopArray.find((c) => c.cfop === "5102");
    const cfopEntrada = dados.entradasPorCfopArray.find(
      (c) => c.cfop === "1102"
    );
    expect(cfopSaida).toBeTruthy();
    expect(cfopEntrada).toBeTruthy();
    expect(typeof cfopSaida.descricao).toBe("string");
  });

  it("deve ignorar notas não normais (canceladas, etc.)", () => {
    const content = readFixture("sample_sped_cancelada.txt");
    const dados = parseSpedFile(content);

    expect(dados.totalGeral).toBe(0);
    expect(dados.totalSaidas).toBe(0);
    expect(dados.saidas.length).toBe(0);
    expect(dados.saidasPorDiaArray.length).toBe(0);
    expect(dados.saidasPorCfopArray.length).toBe(0);
  });
});
