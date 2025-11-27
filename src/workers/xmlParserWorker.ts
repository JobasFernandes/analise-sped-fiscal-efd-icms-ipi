/// <reference lib="webworker" />
import { parseXmlNfe } from "../utils/xmlParser";

interface ParseXmlMessage {
  type: "parse-xml";
  files: File[];
}
interface ParseXmlLegacyMessage {
  type: "parse-xml";
  files: { name: string; content: string }[];
}
interface ProgressMessage {
  type: "progress";
  progress: number; // 0-1
  current: number;
  total: number;
}
interface ResultMessage {
  type: "result";
  notas: any[];
  ignoradas: number;
  durationMs: number;
}
interface ErrorMessage {
  type: "error";
  error: string;
}

// Detectar se é File ou objeto legado
function isFileArray(files: any[]): files is File[] {
  return files.length > 0 && files[0] instanceof File;
}

// Ler arquivo com streaming para XMLs grandes
async function readFileAsText(file: File): Promise<string> {
  // XMLs geralmente são pequenos, mas usamos stream para consistência
  // e para não bloquear com arquivos maiores
  if (file.size < 1024 * 1024) {
    // < 1MB: usar text() direto (mais rápido)
    return await file.text();
  }

  // >= 1MB: usar streaming
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush remaining
  return result;
}

self.onmessage = async function (
  e: MessageEvent<ParseXmlMessage | ParseXmlLegacyMessage>
) {
  const msg = e.data;
  if (!msg || msg.type !== "parse-xml") return;

  const total = msg.files.length;
  const notas: any[] = [];
  let ignoradas = 0;
  const start = performance.now();
  let processed = 0;
  let lastProgressEmit = 0;

  try {
    // Suporte a ambos os formatos: File[] ou { name, content }[]
    const isFiles = isFileArray(msg.files as any[]);

    for (const f of msg.files as any[]) {
      try {
        let content: string;

        if (isFiles) {
          // Novo formato: File handle com streaming
          content = await readFileAsText(f as File);
        } else {
          // Formato legado: conteúdo já lido
          content = f.content;
        }

        const n = parseXmlNfe(content);
        if (!n || !n.autorizada) {
          ignoradas++;
        } else {
          notas.push(n);
        }
      } catch (err) {
        ignoradas++;
      } finally {
        processed++;

        // Throttle progress updates (a cada 50ms ou 10 arquivos)
        const now = Date.now();
        if (
          now - lastProgressEmit > 50 ||
          processed % 10 === 0 ||
          processed === total
        ) {
          const progress: ProgressMessage = {
            type: "progress",
            progress: processed / total,
            current: processed,
            total,
          };
          (self as any).postMessage(progress);
          lastProgressEmit = now;
        }
      }
    }

    const end = performance.now();
    const result: ResultMessage = {
      type: "result",
      notas,
      ignoradas,
      durationMs: end - start,
    };
    (self as any).postMessage(result);
  } catch (err: any) {
    const error: ErrorMessage = {
      type: "error",
      error: err?.message || "Erro desconhecido ao processar XMLs",
    };
    (self as any).postMessage(error);
  }
};
