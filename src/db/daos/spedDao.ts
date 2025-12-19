import {
  db,
  type SpedFileRow,
  type DocumentRow,
  type ItemRow,
  type ItemC170Row,
  type DayAggRow,
  type CfopAggRow,
  type DayCfopAggRow,
} from "../index";
import type { ProcessedData } from "../../utils/types";
import {
  saveCombustivelBatch,
  deleteCombustivelBySpedId,
  saveProdutos,
} from "./combustivelDao";

export interface AddSpedMetadata {
  filename: string;
  size: number;
  contentHash?: string | null;
  file?: File;
}

export async function findSpedByCnpjAndPeriod(
  cnpj: string,
  inicio: string,
  fim: string
): Promise<SpedFileRow | undefined> {
  return await db.sped_files
    .where("cnpj")
    .equals(cnpj)
    .and((item) => item.periodoInicio === inicio && item.periodoFim === fim)
    .first();
}

export async function getSpedContent(spedId: number): Promise<Blob | File | undefined> {
  const row = await db.table("sped_contents").where({ spedId }).first();
  return row?.content;
}

export async function addSped(
  data: ProcessedData,
  meta: AddSpedMetadata
): Promise<number> {
  if (meta.contentHash) {
    const existing = await db.sped_files.where({ hash: meta.contentHash }).first();
    if (existing?.id) return existing.id;
  }
  const periodoInicio = data.periodo?.inicio
    ? new Date(data.periodo.inicio as any).toISOString().slice(0, 10)
    : null;
  const periodoFim = data.periodo?.fim
    ? new Date(data.periodo.fim as any).toISOString().slice(0, 10)
    : null;
  const numeroNotasEntrada = data.entradas?.length || 0;
  const numeroNotasSaida = data.saidas?.length || 0;

  const genId = () =>
    (globalThis as any).crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const toLocalISOWithOffset = () => {
    const d = new Date();
    const tz = -d.getTimezoneOffset();
    const sign = tz >= 0 ? "+" : "-";
    const abs = Math.abs(tz);
    const hh = String(Math.trunc(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    const pad = (n: number) => String(n).padStart(2, "0");
    const Y = d.getFullYear();
    const M = pad(d.getMonth() + 1);
    const D = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${Y}-${M}-${D}T${h}:${m}:${s}${sign}${hh}:${mm}`;
  };

  return await db.transaction(
    "rw",
    [
      db.sped_files,
      db.documents,
      db.items,
      db.items_c170,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      db.table("sped_contents"),
    ],
    async () => {
      const spedId = await db.sped_files.add({
        filename: meta.filename,
        size: meta.size,
        importedAt: toLocalISOWithOffset(),
        periodoInicio,
        periodoFim,
        totalEntradas: data.totalEntradas || 0,
        totalSaidas: data.totalSaidas || 0,
        totalGeral: data.totalGeral || 0,
        numeroNotasEntrada,
        numeroNotasSaida,
        hash: meta.contentHash || null,
        companyName: (data as any).companyName || null,
        cnpj: (data as any).cnpj || null,
      } as SpedFileRow);

      if (meta.file) {
        await db.table("sped_contents").add({
          id: genId(),
          spedId,
          content: meta.file,
        });
      }

      const dayAggMap = new Map<string, number>();
      const cfopAggMap = new Map<string, number>();
      const dayCfopAggMap = new Map<string, number>();

      const addAgg = (
        indicador: "0" | "1",
        dateKey: string | null,
        cfop: string | null,
        valor: number
      ) => {
        if (!dateKey && !cfop) return;
        if (dateKey) {
          const k = `${indicador}|${dateKey}`;
          dayAggMap.set(k, (dayAggMap.get(k) || 0) + valor);
        }
        if (cfop) {
          const k = `${indicador}|${cfop}`;
          cfopAggMap.set(k, (cfopAggMap.get(k) || 0) + valor);
        }
        if (dateKey && cfop) {
          const k = `${indicador}|${dateKey}|${cfop}`;
          dayCfopAggMap.set(k, (dayCfopAggMap.get(k) || 0) + valor);
        }
      };

      const toDateKeyFromISO = (iso?: string | null) => (iso ? iso : null);

      const saveDoc = async (nota: any, indicador: "0" | "1") => {
        const docId = genId();
        const doc: DocumentRow = {
          id: docId,
          spedId,
          numeroDoc: nota.numeroDoc,
          chaveNfe: nota.chaveNfe,
          dataDocumento: nota.dataDocumento
            ? new Date(nota.dataDocumento).toISOString().slice(0, 10)
            : null,
          dataEntradaSaida: nota.dataEntradaSaida
            ? new Date(nota.dataEntradaSaida).toISOString().slice(0, 10)
            : null,
          indicadorOperacao: indicador,
          situacao: nota.situacao,
          valorDocumento: nota.valorDocumento || 0,
          valorMercadoria: nota.valorMercadoria || 0,
        };
        await db.documents.add(doc);
        for (const it of nota.itens || []) {
          const item: ItemRow = {
            id: genId(),
            spedId,
            documentId: docId,
            cfop: it.cfop,
            valorOperacao: it.valorOperacao || 0,
            cstIcms: it.cstIcms,
            aliqIcms: it.aliqIcms || 0,
            valorBcIcms: it.valorBcIcms || 0,
            valorIcms: it.valorIcms || 0,
          };
          await db.items.add(item);
          const dateKey = toDateKeyFromISO(doc.dataDocumento || null);
          addAgg(indicador, dateKey, item.cfop, item.valorOperacao || 0);
        }
        for (const it of nota.itensC170 || []) {
          const item: ItemC170Row = {
            id: genId(),
            spedId,
            documentId: docId,
            numItem: it.numItem,
            codItem: it.codItem,
            descrCompl: it.descrCompl,
            quantidade: it.quantidade,
            unidade: it.unidade,
            valorItem: it.valorItem,
            valorDesconto: it.valorDesconto,
            cfop: it.cfop,
            cstIcms: it.cstIcms,
            aliqIcms: it.aliqIcms,
            valorBcIcms: it.valorBcIcms,
            valorIcms: it.valorIcms,
          };
          await db.items_c170.add(item);
        }
      };

      for (const e of data.entradas || []) await saveDoc(e, "0");
      for (const s of data.saidas || []) await saveDoc(s, "1");

      for (const [k, valor] of dayAggMap.entries()) {
        const [dir, date] = k.split("|");
        const row: DayAggRow = { spedId, date, dir: dir as any, valor };
        await db.day_aggs.add(row);
      }
      for (const [k, valor] of cfopAggMap.entries()) {
        const [dir, cfop] = k.split("|");
        const row: CfopAggRow = { spedId, cfop, dir: dir as any, valor };
        await db.cfop_aggs.add(row);
      }
      for (const [k, valor] of dayCfopAggMap.entries()) {
        const [dir, date, cfop] = k.split("|");
        const row: DayCfopAggRow = {
          spedId,
          date,
          cfop,
          dir: dir as any,
          valor,
        };
        await db.day_cfop_aggs.add(row);
      }

      return spedId;
    }
  );
}

export async function listSpeds(): Promise<SpedFileRow[]> {
  return db.sped_files.orderBy("importedAt").reverse().toArray();
}

export async function deleteSped(spedId: number): Promise<void> {
  // Deletar dados de combustíveis (fora da transação principal pois usa outras tabelas)
  await deleteCombustivelBySpedId(spedId);

  // Deletar produtos
  try {
    await db.produtos.where({ spedId }).delete();
  } catch {
    // Tabela pode não existir em versões antigas
  }

  await db.transaction(
    "rw",
    [
      db.sped_files,
      db.documents,
      db.items,
      db.items_c170,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      db.table("sped_contents"),
    ],
    async () => {
      const docs = await db.documents.where({ spedId }).toArray();
      const docIds = docs.map((d: any) => d.id).filter(Boolean);
      if (docIds.length) {
        await db.items.where("documentId").anyOf(docIds).delete();
        await db.items_c170.where("documentId").anyOf(docIds).delete();
      }
      await db.documents.where({ spedId }).delete();
      await db.day_aggs.where({ spedId }).delete();
      await db.cfop_aggs.where({ spedId }).delete();
      await db.day_cfop_aggs.where({ spedId }).delete();
      await db.table("sped_contents").where({ spedId }).delete();
      await db.sped_files.delete(spedId);
    }
  );
}

export interface LoadedSpedData {
  sped: SpedFileRow;
  documents: DocumentRow[];
  items: ItemRow[];
}

export async function getSped(spedId: number): Promise<LoadedSpedData> {
  const sped = await db.sped_files.get(spedId);
  if (!sped) throw new Error("SPED não encontrado");
  const documents = await db.documents.where({ spedId }).toArray();
  const docIds = documents.map((d) => d.id!).filter(Boolean) as string[];
  const items = docIds.length
    ? await db.items.where("documentId").anyOf(docIds).toArray()
    : [];
  return { sped, documents, items };
}

export async function recalcularIndicadores(spedId: number): Promise<void> {
  const { documents, items } = await getSped(spedId);
  const dayAggMap = new Map<string, number>();
  const cfopAggMap = new Map<string, number>();
  const dayCfopAggMap = new Map<string, number>();
  const docById = new Map(documents.map((d) => [d.id!, d]));
  const toDateKey = (iso?: string | null) => (iso ? iso : null);

  for (const it of items) {
    const doc = docById.get(it.documentId);
    if (!doc) continue;
    const dir = doc.indicadorOperacao;
    const dateKey = toDateKey(doc.dataDocumento || null);
    const cfop = it.cfop;
    const valor = it.valorOperacao || 0;
    if (!dateKey) continue;
    const kDay = `${dir}|${dateKey}`;
    const kCfop = `${dir}|${cfop}`;
    const kDayCfop = `${dir}|${dateKey}|${cfop}`;
    dayAggMap.set(kDay, (dayAggMap.get(kDay) || 0) + valor);
    cfopAggMap.set(kCfop, (cfopAggMap.get(kCfop) || 0) + valor);
    dayCfopAggMap.set(kDayCfop, (dayCfopAggMap.get(kDayCfop) || 0) + valor);
  }

  await db.transaction(
    "rw",
    [db.day_aggs, db.cfop_aggs, db.day_cfop_aggs],
    async () => {
      await db.day_aggs.where({ spedId }).delete();
      await db.cfop_aggs.where({ spedId }).delete();
      await db.day_cfop_aggs.where({ spedId }).delete();
      for (const [k, valor] of dayAggMap.entries()) {
        const [dir, date] = k.split("|");
        await db.day_aggs.add({ spedId, date, dir: dir as any, valor });
      }
      for (const [k, valor] of cfopAggMap.entries()) {
        const [dir, cfop] = k.split("|");
        await db.cfop_aggs.add({ spedId, cfop, dir: dir as any, valor });
      }
      for (const [k, valor] of dayCfopAggMap.entries()) {
        const [dir, date, cfop] = k.split("|");
        await db.day_cfop_aggs.add({
          spedId,
          date,
          cfop,
          dir: dir as any,
          valor,
        });
      }
    }
  );
}

export async function recalcularIndicadoresTodos(): Promise<void> {
  const speds = await db.sped_files.toArray();
  for (const s of speds) {
    await recalcularIndicadores(s.id!);
  }
}

export async function possuiIndicadores(spedId: number): Promise<boolean> {
  const one = await db.day_aggs.where({ spedId }).first();
  return Boolean(one);
}

export const rebuildAggregates = recalcularIndicadores;
export const rebuildAggregatesForAll = recalcularIndicadoresTodos;
export const hasAggregates = possuiIndicadores;

export async function createSpedFile(meta: AddSpedMetadata): Promise<number> {
  if (meta.contentHash) {
    const existing = await db.sped_files.where({ hash: meta.contentHash }).first();
    if (existing?.id) return existing.id;
  }

  const toLocalISOWithOffset = () => {
    const d = new Date();
    const tz = -d.getTimezoneOffset();
    const sign = tz >= 0 ? "+" : "-";
    const abs = Math.abs(tz);
    const hh = String(Math.trunc(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    const pad = (n: number) => String(n).padStart(2, "0");
    const Y = d.getFullYear();
    const M = pad(d.getMonth() + 1);
    const D = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${Y}-${M}-${D}T${h}:${m}:${s}${sign}${hh}:${mm}`;
  };

  const genId = () =>
    (globalThis as any).crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const id = await db.transaction(
    "rw",
    [db.sped_files, db.table("sped_contents")],
    async () => {
      const spedId = await db.sped_files.add({
        filename: meta.filename,
        size: meta.size,
        importedAt: toLocalISOWithOffset(),
        periodoInicio: null,
        periodoFim: null,
        totalEntradas: 0,
        totalSaidas: 0,
        totalGeral: 0,
        numeroNotasEntrada: 0,
        numeroNotasSaida: 0,
        hash: meta.contentHash || null,
        companyName: null,
        cnpj: null,
      } as SpedFileRow);

      if (meta.file) {
        await db.table("sped_contents").add({
          id: genId(),
          spedId,
          content: meta.file,
        });
      }
      return spedId;
    }
  );

  return id;
}

export async function saveSpedBatch(
  spedId: number,
  data: {
    entradas: any[];
    saidas: any[];
    combustivelMovDiaria?: any[];
    combustivelTanques?: any[];
    combustivelBicos?: any[];
    produtos?: any[];
  }
): Promise<void> {
  const docs: DocumentRow[] = [];
  const items: ItemRow[] = [];
  const itemsC170: ItemC170Row[] = [];

  const genId = () =>
    (globalThis as any).crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const processNota = (nota: any, indicador: "0" | "1") => {
    const docId = genId();

    docs.push({
      id: docId,
      spedId,
      numeroDoc: nota.numeroDoc,
      chaveNfe: nota.chaveNfe,
      dataDocumento: nota.dataDocumento
        ? new Date(nota.dataDocumento).toISOString().slice(0, 10)
        : null,
      dataEntradaSaida: nota.dataEntradaSaida
        ? new Date(nota.dataEntradaSaida).toISOString().slice(0, 10)
        : null,
      valorDocumento: nota.valorDocumento,
      valorMercadoria: nota.valorMercadoria,
      indicadorOperacao: indicador,
      situacao: nota.situacao,
    } as DocumentRow);

    if (nota.itens && Array.isArray(nota.itens)) {
      for (const it of nota.itens) {
        items.push({
          id: genId(),
          spedId,
          documentId: docId,
          cfop: it.cfop,
          valorOperacao: it.valorOperacao,
          cstIcms: it.cstIcms,
          aliqIcms: it.aliqIcms,
          valorBcIcms: it.valorBcIcms,
          valorIcms: it.valorIcms,
        } as ItemRow);
      }
    }
    if (nota.itensC170 && Array.isArray(nota.itensC170)) {
      for (const it of nota.itensC170) {
        itemsC170.push({
          id: genId(),
          spedId,
          documentId: docId,
          numItem: it.numItem,
          codItem: it.codItem,
          descrCompl: it.descrCompl,
          quantidade: it.quantidade,
          unidade: it.unidade,
          valorItem: it.valorItem,
          valorDesconto: it.valorDesconto,
          cfop: it.cfop,
          cstIcms: it.cstIcms,
          aliqIcms: it.aliqIcms,
          valorBcIcms: it.valorBcIcms,
          valorIcms: it.valorIcms,
        } as ItemC170Row);
      }
    }
  };

  for (const n of data.entradas) processNota(n, "0");
  for (const n of data.saidas) processNota(n, "1");

  await db.transaction("rw", [db.documents, db.items, db.items_c170], async () => {
    if (docs.length) await db.documents.bulkAdd(docs);
    if (items.length) await db.items.bulkAdd(items);
    if (itemsC170.length) await db.items_c170.bulkAdd(itemsC170);
  });

  // Salvar dados de combustíveis se presentes
  if (
    (data.combustivelMovDiaria && data.combustivelMovDiaria.length > 0) ||
    (data.combustivelTanques && data.combustivelTanques.length > 0) ||
    (data.combustivelBicos && data.combustivelBicos.length > 0)
  ) {
    await saveCombustivelBatch(spedId, {
      combustivelMovDiaria: data.combustivelMovDiaria,
      combustivelTanques: data.combustivelTanques,
      combustivelBicos: data.combustivelBicos,
    });
  }

  // Salvar produtos (registro 0200) se presentes
  if (data.produtos && data.produtos.length > 0) {
    await saveProdutos(spedId, data.produtos);
  }
}

export async function updateSpedTotals(
  id: number,
  totals: {
    totalEntradas: number;
    totalSaidas: number;
    totalGeral: number;
    numeroNotasEntrada: number;
    numeroNotasSaida: number;
    periodoInicio?: Date | string | null;
    periodoFim?: Date | string | null;
    companyName?: string;
    cnpj?: string;
  }
) {
  const updateData: any = {
    totalEntradas: totals.totalEntradas,
    totalSaidas: totals.totalSaidas,
    totalGeral: totals.totalGeral,
    numeroNotasEntrada: totals.numeroNotasEntrada,
    numeroNotasSaida: totals.numeroNotasSaida,
  };

  if (totals.periodoInicio) {
    updateData.periodoInicio =
      typeof totals.periodoInicio === "string"
        ? totals.periodoInicio
        : new Date(totals.periodoInicio).toISOString().slice(0, 10);
  }
  if (totals.periodoFim) {
    updateData.periodoFim =
      typeof totals.periodoFim === "string"
        ? totals.periodoFim
        : new Date(totals.periodoFim).toISOString().slice(0, 10);
  }
  if (totals.companyName) updateData.companyName = totals.companyName;
  if (totals.cnpj) updateData.cnpj = totals.cnpj;

  await db.sped_files.update(id, updateData);
}

export async function saveSpedAggregations(
  spedId: number,
  data: {
    entradasPorDiaArray?: { data: string; valor: number }[];
    saidasPorDiaArray?: { data: string; valor: number }[];
    entradasPorCfopArray?: { cfop: string; valor: number }[];
    saidasPorCfopArray?: { cfop: string; valor: number }[];
    entradasPorDiaCfopArray?: { data: string; cfop: string; valor: number }[];
    saidasPorDiaCfopArray?: { data: string; cfop: string; valor: number }[];
  }
) {
  const dayAggs: DayAggRow[] = [];
  const cfopAggs: CfopAggRow[] = [];
  const dayCfopAggs: DayCfopAggRow[] = [];

  // Entradas
  if (data.entradasPorDiaArray) {
    for (const item of data.entradasPorDiaArray) {
      dayAggs.push({ spedId, date: item.data, dir: "0", valor: item.valor });
    }
  }
  if (data.entradasPorCfopArray) {
    for (const item of data.entradasPorCfopArray) {
      cfopAggs.push({ spedId, cfop: item.cfop, dir: "0", valor: item.valor });
    }
  }
  if (data.entradasPorDiaCfopArray) {
    for (const item of data.entradasPorDiaCfopArray) {
      dayCfopAggs.push({
        spedId,
        date: item.data,
        cfop: item.cfop,
        dir: "0",
        valor: item.valor,
      });
    }
  }

  // Saidas
  if (data.saidasPorDiaArray) {
    for (const item of data.saidasPorDiaArray) {
      dayAggs.push({ spedId, date: item.data, dir: "1", valor: item.valor });
    }
  }
  if (data.saidasPorCfopArray) {
    for (const item of data.saidasPorCfopArray) {
      cfopAggs.push({ spedId, cfop: item.cfop, dir: "1", valor: item.valor });
    }
  }
  if (data.saidasPorDiaCfopArray) {
    for (const item of data.saidasPorDiaCfopArray) {
      dayCfopAggs.push({
        spedId,
        date: item.data,
        cfop: item.cfop,
        dir: "1",
        valor: item.valor,
      });
    }
  }

  await db.transaction(
    "rw",
    [db.day_aggs, db.cfop_aggs, db.day_cfop_aggs],
    async () => {
      await db.day_aggs.bulkAdd(dayAggs);
      await db.cfop_aggs.bulkAdd(cfopAggs);
      await db.day_cfop_aggs.bulkAdd(dayCfopAggs);
    }
  );
}
