import { describe, it, expect } from "vitest";
import { parseSpedFile } from "../src/utils/spedParser";

const mk = (lines: string[]) => lines.join("\n");

describe("Parser C170 - itens por nota", () => {
  it("deve popular itensC170 na nota correspondente", () => {
    const content = mk([
      "|0000|0|0|01062025|30062025|EMPRESA|12345678000100|SP|||",
      // C100: Saída, situação 00, modelo 55, numero 123, chave, data e valor
      "|C100|1|0|00|0|00|55|123|CHAVEA|01062025|01062025|100,00|0|0|0|100,00|",
      // C170: item da nota 123 (campos conforme índice usado no parser)
      // |C170|NUM|COD|DESCR|QTD|UNID|VL_ITEM|VL_DESC|...|CFOP|CST|...|ALIQ|BC|ICMS|
      "|C170|1|PROD01|Produto teste|2,000|UN|50,00|0,00|||5102|000||18,00|50,00|9,00|",
      // C190: mantém agregações por CFOP
      "|C190|000|5102|18,00|100,00|100,00|18,00|",
    ]);
    const dados = parseSpedFile(content);
    expect(dados.saidas.length).toBe(1);
    const nota = dados.saidas[0];
    expect(nota.numeroDoc).toBe("123");
    expect(nota.itensC170 && nota.itensC170.length).toBeGreaterThan(0);
    const it = nota.itensC170![0];
    expect(it.codItem).toBe("PROD01");
    expect(it.descrCompl).toBe("Produto teste");
    expect(it.quantidade).toBeCloseTo(2);
    expect(it.valorItem).toBeCloseTo(50);
    expect(it.cfop).toBe("5102");
    expect(it.cstIcms).toBe("000");
    expect(it.aliqIcms).toBeCloseTo(18);
    expect(nota.itens.length).toBeGreaterThan(0); // C190 ainda popula itens agregados
  });
});
