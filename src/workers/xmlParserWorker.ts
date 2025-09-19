/// <reference lib="webworker" />
import { parseXmlNfe } from "../utils/xmlParser";

interface ParseXmlMessage {
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

self.onmessage = function (e: MessageEvent<ParseXmlMessage>) {
  const msg = e.data;
  if (!msg || msg.type !== "parse-xml") return;
  const total = msg.files.length;
  const notas: any[] = [];
  let ignoradas = 0;
  const start = performance.now();
  let processed = 0;
  for (const f of msg.files) {
    try {
      const n = parseXmlNfe(f.content);
      if (!n || !n.autorizada) {
        ignoradas++;
      } else {
        notas.push(n);
      }
    } catch (err) {
      ignoradas++;
    } finally {
      processed++;
      if (processed % 10 === 0 || processed === total) {
        const progress: ProgressMessage = {
          type: "progress",
          progress: processed / total,
          current: processed,
          total,
        };
        (self as any).postMessage(progress);
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
};
