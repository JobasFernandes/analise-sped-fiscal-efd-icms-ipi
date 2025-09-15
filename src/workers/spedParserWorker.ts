/// <reference lib="webworker" />
// Web Worker para parsing assíncrono do arquivo SPED
// Recebe mensagens: { type: 'parse', content: string }
// Envia mensagens:
//  { type: 'progress', progress: number, current: number, total: number }
//  { type: 'result', data: any, durationMs: number }
//  { type: 'error', error: string }

import { parseSpedFile } from '../utils/spedParser';

// Tipagem básica das mensagens
interface ParseMessage { type: 'parse'; content: string }
interface ProgressMessage { type: 'progress'; progress: number; current: number; total: number }
interface ResultMessage { type: 'result'; data: any; durationMs: number }
interface ErrorMessage { type: 'error'; error: string }

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e: MessageEvent<ParseMessage>) {
  const msg = e.data;
  if (!msg || msg.type !== 'parse') return;
  const start = performance.now();
  try {
    const data = parseSpedFile(msg.content, (current, total) => {
      const progress: ProgressMessage = { type: 'progress', progress: current / total, current, total };
      // eslint-disable-next-line no-restricted-globals
      (self as any).postMessage(progress);
    });
    const end = performance.now();
    const result: ResultMessage = { type: 'result', data, durationMs: end - start };
    // eslint-disable-next-line no-restricted-globals
    (self as any).postMessage(result);
  } catch (err: any) {
    const error: ErrorMessage = { type: 'error', error: err?.message || 'Erro desconhecido ao processar SPED' };
    // eslint-disable-next-line no-restricted-globals
    (self as any).postMessage(error);
  }
};
