import Dexie, { Table } from "dexie";

export interface SpedFileRow {
  id?: number; // auto-increment PK
  filename: string;
  size: number;
  importedAt: string; // ISO
  periodoInicio?: string | null; // ISO yyyy-MM-dd
  periodoFim?: string | null; // ISO yyyy-MM-dd
  totalEntradas: number;
  totalSaidas: number;
  totalGeral: number;
  numeroNotasEntrada: number;
  numeroNotasSaida: number;
  hash?: string | null;
}

export interface DocumentRow {
  id?: string; // uuid
  spedId: number; // FK -> SpedFileRow.id
  numeroDoc: string;
  chaveNfe: string;
  dataDocumento?: string | null; // ISO yyyy-MM-dd
  dataEntradaSaida?: string | null; // ISO yyyy-MM-dd
  indicadorOperacao: "0" | "1";
  situacao: string;
  valorDocumento: number;
  valorMercadoria: number;
}

export interface ItemRow {
  id?: string; // uuid
  spedId: number; // FK
  documentId: string; // FK -> DocumentRow.id
  cfop: string;
  valorOperacao: number;
  cstIcms: string;
  aliqIcms: number;
  valorBcIcms: number;
  valorIcms: number;
}

export class SpedDB extends Dexie {
  sped_files!: Table<SpedFileRow, number>;
  documents!: Table<DocumentRow, string>;
  items!: Table<ItemRow, string>;
  day_aggs!: Table<DayAggRow, number>;
  cfop_aggs!: Table<CfopAggRow, number>;
  day_cfop_aggs!: Table<DayCfopAggRow, number>;

  constructor() {
    super("sped-db");
    this.version(1).stores({
      // PK++ for auto-increment
      sped_files:
        "++id, importedAt, periodoInicio, periodoFim, totalGeral, hash",
      // string PK (uuid). Indexes: spedId, chaveNfe, dataDocumento
      documents:
        "id, spedId, numeroDoc, chaveNfe, dataDocumento, indicadorOperacao",
      // string PK (uuid). Indexes: spedId, documentId, cfop
      items: "id, spedId, documentId, cfop",
    });
    this.version(2).stores({
      day_aggs: "++id, [spedId+date+dir], spedId, date, dir",
      cfop_aggs: "++id, [spedId+cfop+dir], spedId, cfop, dir",
      day_cfop_aggs: "++id, [spedId+date+cfop+dir], spedId, date, cfop, dir",
    });
  }
}

export const db = new SpedDB();

// Tipos para v2 (agregados)
export interface DayAggRow {
  id?: number;
  spedId: number;
  date: string; // yyyy-MM-dd
  dir: "0" | "1"; // 0 entrada, 1 saida
  valor: number;
}
export interface CfopAggRow {
  id?: number;
  spedId: number;
  cfop: string;
  dir: "0" | "1";
  valor: number;
}
export interface DayCfopAggRow {
  id?: number;
  spedId: number;
  date: string;
  cfop: string;
  dir: "0" | "1";
  valor: number;
}
