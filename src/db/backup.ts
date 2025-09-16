import { db } from "./index";

export type DbBackup = {
  version: number;
  exportedAt: string;
  sped_files: any[];
  documents: any[];
  items: any[];
  day_aggs: any[];
  cfop_aggs: any[];
  day_cfop_aggs: any[];
};

export async function exportDbToJson(): Promise<DbBackup> {
  const [sped_files, documents, items, day_aggs, cfop_aggs, day_cfop_aggs] =
    await Promise.all([
      db.sped_files.toArray(),
      db.documents.toArray(),
      db.items.toArray(),
      db.day_aggs.toArray(),
      db.cfop_aggs.toArray(),
      db.day_cfop_aggs.toArray(),
    ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sped_files,
    documents,
    items,
    day_aggs,
    cfop_aggs,
    day_cfop_aggs,
  };
}

export async function importDbFromJson(
  data: DbBackup,
  opts?: { clearBeforeImport?: boolean }
) {
  const clear = opts?.clearBeforeImport ?? false;
  await db.transaction(
    "rw",
    [
      db.sped_files,
      db.documents,
      db.items,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
    ],
    async () => {
      if (clear) {
        await db.day_cfop_aggs.clear();
        await db.cfop_aggs.clear();
        await db.day_aggs.clear();
        await db.items.clear();
        await db.documents.clear();
        await db.sped_files.clear();
      }

      if (data.sped_files?.length) await db.sped_files.bulkAdd(data.sped_files);
      if (data.documents?.length) await db.documents.bulkAdd(data.documents);
      if (data.items?.length) await db.items.bulkAdd(data.items);
      if (data.day_aggs?.length) await db.day_aggs.bulkAdd(data.day_aggs);
      if (data.cfop_aggs?.length) await db.cfop_aggs.bulkAdd(data.cfop_aggs);
      if (data.day_cfop_aggs?.length)
        await db.day_cfop_aggs.bulkAdd(data.day_cfop_aggs);
    }
  );
}
