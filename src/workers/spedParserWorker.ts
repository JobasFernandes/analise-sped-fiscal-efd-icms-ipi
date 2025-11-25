/// <reference lib="webworker" />

import { SpedParser } from "../utils/spedParser";

interface ParseMessage {
  type: "parse";
  file: File;
}

let continueResolver: (() => void) | null = null;

self.onmessage = async function (e: MessageEvent<any>) {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === "continue") {
    if (continueResolver) {
      continueResolver();
      continueResolver = null;
    }
    return;
  }

  if (msg.type !== "parse" || !msg.file) return;

  const parser = new SpedParser();
  // Use stream if available, otherwise fallback (though modern browsers support it)
  const stream = msg.file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder("latin1"); // SPED is usually latin1

  let buffer = "";
  let processedBytes = 0;
  const totalBytes = msg.file.size;
  const BATCH_SIZE = 5000;
  let linesProcessed = 0;
  let lastProgressEmit = 0;
  let isFirstChunk = true;
  let metadataSent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      processedBytes += value.length;
      buffer += decoder.decode(value, { stream: true });

      if (isFirstChunk) {
        if (!buffer.startsWith("|")) {
          throw new Error(
            "Arquivo inválido: Não parece ser um arquivo SPED (deve começar com '|')"
          );
        }
        isFirstChunk = false;
      }

      const lines = buffer.split("\n");
      // Keep the last part which might be incomplete
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        // Check for metadata in 0000 register
        if (!metadataSent && line.startsWith("|0000|")) {
          const fields = line.split("|");
          if (fields.length >= 8) {
            const dtIni = fields[4];
            const dtFin = fields[5];
            const cnpj = fields[7];

            // Convert DDMMYYYY to YYYY-MM-DD for consistency
            const parseDate = (d: string) => {
              if (d && d.length === 8) {
                return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
              }
              return null;
            };

            const periodoInicio = parseDate(dtIni);
            const periodoFim = parseDate(dtFin);

            if (cnpj && periodoInicio && periodoFim) {
              postMessage({
                type: "metadata",
                data: { cnpj, periodoInicio, periodoFim },
              });
              metadataSent = true;

              // Wait for confirmation from main thread
              await new Promise<void>((resolve) => {
                continueResolver = resolve;
              });
            }
          }
        }

        parser.processLine(line);

        linesProcessed++;

        if (linesProcessed % BATCH_SIZE === 0) {
          const batch = parser.getAndClearBatchData();
          if (batch.entradas.length > 0 || batch.saidas.length > 0) {
            (self as any).postMessage({ type: "batch", data: batch });
          }
        }
      }

      // Emit progress at most every 100ms to avoid flooding
      const now = Date.now();
      if (now - lastProgressEmit > 100) {
        (self as any).postMessage({
          type: "progress",
          progress: processedBytes / totalBytes,
          current: processedBytes,
          total: totalBytes,
        });
        lastProgressEmit = now;
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      parser.processLine(buffer);
    }

    parser.finish();

    // Send last batch
    const batch = parser.getAndClearBatchData();
    if (batch.entradas.length > 0 || batch.saidas.length > 0) {
      (self as any).postMessage({ type: "batch", data: batch });
    }

    // Send final result (totals)
    (self as any).postMessage({
      type: "result",
      data: parser.data, // This now contains totals and maps, but empty arrays for entradas/saidas
    });
  } catch (err: any) {
    (self as any).postMessage({
      type: "error",
      error: err?.message || "Erro desconhecido",
    });
  }
};
