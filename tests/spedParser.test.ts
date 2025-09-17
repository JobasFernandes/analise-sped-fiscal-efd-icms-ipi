import { describe, it, expect } from "vitest";
import { parseSpedFile } from "../src/utils/spedParser";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mkSped = (lines: string[]) => lines.join("\n");
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const readFixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

describe("SpedParser - casos de borda", () => {
  it("ignora documentos com COD_SIT != 00 e valores <= 0, e monta itensPorCfopIndex", () => {
    const content = mkSped([
      "|0000|0|0|01012025|31012025|...|",
      "|C100|1|0|00|0|00|55|123|CHAVEA|01012025|01012025|100,00|...|...|...|80,00|",
      "|C190|000|5102|18,00|100,00|100,00|18,00|",
      "|C100|1|0|02|0|02|55|124|CHAVEB|01012025|01012025|200,00|...|...|...|200,00|",
      "|C190|000|5102|18,00|200,00|200,00|36,00|",
      "|C100|0|0|00|0|00|55|125|CHAVEC|02012025|02012025|0,00|...|...|...|0,00|",
      "|C190|000|1102|18,00|0,00|0,00|0,00|",
    ]);

    const dados = parseSpedFile(content);
    expect(dados.totalGeral).toBeGreaterThan(0);
    expect(dados.saidas.length).toBe(1);
    expect(dados.entradas.length).toBe(0);
    expect(dados.itensPorCfopIndex).toBeTruthy();
    expect(dados.itensPorCfopIndex!["5102"]).toBeTruthy();
    expect(dados.itensPorCfopIndex!["5102"]!.length).toBe(1);
  });

  it("extrai companyName e cnpj do registro 0000", () => {
    const content = mkSped([
      "|0000|016|0|01012025|31012025|EMPRESA EXEMPLO LTDA|12345678000199|SP|",
      "|C100|1|0|00|0|00|55|123|CHAVEA|01012025|01012025|100,00|...|...|...|80,00|",
      "|C190|000|5102|18,00|100,00|100,00|18,00|",
    ]);
    const dados: any = parseSpedFile(content);
    expect(dados.cnpj).toBe("12345678000199");
    expect(dados.companyName).toMatch(/EMPRESA EXEMPLO/);
  });

  it("reporta progresso ao processar arquivo grande", () => {
    const linhas = ["|0000|0|0|01012025|31012025|...|"];
    for (let i = 0; i < 300; i++) {
      linhas.push(
        "|C100|1|0|00|0|00|55|" +
          (1000 + i) +
          "|CHAVE|01012025|01012025|1,00|...|...|...|1,00|"
      );
      linhas.push("|C190|000|5102|18,00|1,00|1,00|0,18|");
    }
    const content = mkSped(linhas);
    const calls: Array<[number, number]> = [];
    const dados = parseSpedFile(content, (c, t) => calls.push([c, t]));
    expect(dados.totalGeral).toBe(300);
    expect(calls.length).toBeGreaterThan(1);
    const last = calls[calls.length - 1];
    expect(last[0]).toBe(last[1]);
  });
});

describe("SpedParser - fixtures (happy path + canceladas)", () => {
  it("deve processar entradas e saídas básicas do SPED (happy path)", () => {
    const content = readFixture("sample_sped_minimo.txt");
    const dados: any = parseSpedFile(content);
    expect(dados.totalGeral).toBeCloseTo(1500.0, 6);
    expect(dados.totalSaidas).toBeCloseTo(500.0, 6);
    expect(dados.totalEntradas).toBeCloseTo(1000.0, 6);
    expect(dados.periodo.inicio).toBeInstanceOf(Date);
    expect(dados.periodo.fim).toBeInstanceOf(Date);
    expect(dados.saidasPorDiaArray.length).toBeGreaterThan(0);
    expect(dados.entradasPorDiaArray.length).toBeGreaterThan(0);
    const cfopSaida = dados.saidasPorCfopArray.find((c: any) => c.cfop === "5102");
    const cfopEntrada = dados.entradasPorCfopArray.find((c: any) => c.cfop === "1102");
    expect(cfopSaida).toBeTruthy();
    expect(cfopEntrada).toBeTruthy();
    expect(typeof cfopSaida.descricao).toBe("string");
  });

  it("deve ignorar notas não normais (canceladas, etc.)", () => {
    const content = readFixture("sample_sped_cancelada.txt");
    const dados: any = parseSpedFile(content);
    expect(dados.totalGeral).toBe(0);
    expect(dados.totalSaidas).toBe(0);
    expect(dados.saidas.length).toBe(0);
    expect(dados.saidasPorDiaArray.length).toBe(0);
    expect(dados.saidasPorCfopArray.length).toBe(0);
  });
});
