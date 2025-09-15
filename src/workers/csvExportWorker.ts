/// <reference lib="webworker" />
// Worker para exportação CSV em chunks.
// Mensagens recebidas:
//  { type: 'exportCsvAll', items: ItemDetalhado[], filename?: string }
// Mensagens enviadas:
//  { type: 'chunk', chunk: string }
//  { type: 'done', rows: number, durationMs: number }
//  { type: 'error', error: string }

import type { ItemDetalhado } from "../utils/types";
import { formatarData } from "../utils/dataProcessor";

type ExportMsg = {
  type: "exportCsvAll";
  items: ItemDetalhado[];
  filename?: string;
};

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e: MessageEvent<ExportMsg>) {
  const msg = e.data;
  if (!msg || msg.type !== "exportCsvAll") return;
  const start = performance.now();
  try {
    const items = msg.items || [];
    const header = [
      "Tipo",
      "CFOP",
      "Numero NF",
      "Chave NFe",
      "Data Doc",
      "CST ICMS",
      "Aliq ICMS (%)",
      "Valor Operacao",
      "BC ICMS",
      "Valor ICMS",
    ];
    const quote = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return '""';
      return `"${String(v).replace(/"/g, '""')}"`;
    };
    const fmtNum = (n: number | null | undefined) =>
      (n ?? 0).toFixed(2).replace(".", ",");
    const isEntrada = (cfop: string) => parseInt(cfop, 10) < 4000;

    // Envia o header primeiro
    // eslint-disable-next-line no-restricted-globals
    (self as any).postMessage({ type: "chunk", chunk: header.map((h) => `"${h}"`).join(";") + "\n" });

    let buffer = "";
    let rows = 0;
    const FLUSH_AT = 2000; // linhas por flush
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const linha = [
        isEntrada(it.cfop) ? "Entrada" : "Saida",
        it.cfop,
        it.numeroDoc || "",
        it.chaveNfe || "",
        it.dataDocumento ? formatarData(it.dataDocumento) : "",
        it.cstIcms || "",
        fmtNum(it.aliqIcms),
        fmtNum(it.valorOperacao),
        fmtNum(it.valorBcIcms),
        fmtNum(it.valorIcms),
      ]
        .map(quote)
        .join(";");
      buffer += linha + "\n";
      rows++;
      if (rows % FLUSH_AT === 0) {
        // eslint-disable-next-line no-restricted-globals
        (self as any).postMessage({ type: "chunk", chunk: buffer });
        buffer = "";
      }
    }
    if (buffer.length > 0) {
      // eslint-disable-next-line no-restricted-globals
      (self as any).postMessage({ type: "chunk", chunk: buffer });
    }
    const end = performance.now();
    // eslint-disable-next-line no-restricted-globals
    (self as any).postMessage({ type: "done", rows, durationMs: end - start });
  } catch (err: any) {
    // eslint-disable-next-line no-restricted-globals
    (self as any).postMessage({ type: "error", error: err?.message || "Erro ao gerar CSV" });
  }
};
