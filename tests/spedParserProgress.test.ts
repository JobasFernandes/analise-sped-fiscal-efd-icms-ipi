import { describe, it, expect } from "vitest";
import { parseSpedFile } from "../src/utils/spedParser";

function gerarLinhaC100({
  numero,
  tipo = "1",
  data = "01062025",
  valor = "100,00",
}: {
  numero: number;
  tipo?: "0" | "1";
  data?: string;
  valor?: string;
}) {
  const campos = [
    "C100",
    tipo,
    "0",
    "0",
    "55",
    "00",
    "0",
    String(numero),
    "NFECHAVE" + numero.toString().padStart(8, "0"),
    data,
    data,
    valor,
    "0",
    "0",
    "0",
    valor,
  ];
  return "|" + campos.join("|") + "|";
}

function gerarLinhaC190({
  cfop = "5102",
  valor = "100,00",
}: {
  cfop?: string;
  valor?: string;
}) {
  const campos = ["C190", "000", cfop, "18,00", valor, "100,00", "18,00"];
  return "|" + campos.join("|") + "|";
}

function gerarHeader0000() {
  return "|0000|015|0|01062025|30062025|Empresa Teste|12345678000100|SP|||\n";
}

describe("Progresso do parser", () => {
  it("emite múltiplos callbacks para arquivo grande", () => {
    const QUANTIDADE = 1200;
    let linhas = gerarHeader0000();
    for (let i = 1; i <= QUANTIDADE; i++) {
      linhas += gerarLinhaC100({ numero: i }) + "\n";
      linhas += gerarLinhaC190({ valor: "100,00" }) + "\n";
    }

    const chamadas: Array<{ current: number; total: number }> = [];
    const dados = parseSpedFile(linhas, (current, total) => {
      chamadas.push({ current, total });
    });

    expect(chamadas.length).toBeGreaterThan(5);

    const ultima = chamadas[chamadas.length - 1];
    expect(ultima.current).toBe(ultima.total);
    expect(ultima.total).toBeGreaterThan(2000);

    expect(dados.totalGeral).toBeGreaterThan(0);
  });

  it("emite ao menos um callback para arquivo pequeno", () => {
    let linhas = gerarHeader0000();
    linhas += gerarLinhaC100({ numero: 1 }) + "\n";
    linhas += gerarLinhaC190({ valor: "50,00" }) + "\n";

    const chamadas: Array<{ current: number; total: number }> = [];
    parseSpedFile(linhas, (current, total) => chamadas.push({ current, total }));

    expect(chamadas.length).toBe(1);
    expect(chamadas[0].current).toBe(chamadas[0].total);
    expect(chamadas[0].total).toBeGreaterThan(0);
  });
});
