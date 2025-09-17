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
  companyName?: string | null;
  cnpj?: string | null;
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

export interface ItemC170Row {
  id?: string; // uuid
  spedId: number; // FK
  documentId: string; // FK -> DocumentRow.id
  numItem?: number;
  codItem?: string;
  descrCompl?: string;
  quantidade?: number;
  unidade?: string;
  valorItem?: number;
  valorDesconto?: number;
  cfop?: string;
  cstIcms?: string;
  aliqIcms?: number;
  valorBcIcms?: number;
  valorIcms?: number;
}

export class SpedDB extends Dexie {
  sped_files!: Table<SpedFileRow, number>;
  documents!: Table<DocumentRow, string>;
  items!: Table<ItemRow, string>;
  items_c170!: Table<ItemC170Row, string>;
  day_aggs!: Table<DayAggRow, number>;
  cfop_aggs!: Table<CfopAggRow, number>;
  day_cfop_aggs!: Table<DayCfopAggRow, number>;

  constructor() {
    super("sped-db");
    this.version(1).stores({
      // PK++ for auto-increment
      sped_files: "++id, importedAt, periodoInicio, periodoFim, totalGeral, hash",
      // string PK (uuid). Indexes: spedId, chaveNfe, dataDocumento
      documents: "id, spedId, numeroDoc, chaveNfe, dataDocumento, indicadorOperacao",
      // string PK (uuid). Indexes: spedId, documentId, cfop
      items: "id, spedId, documentId, cfop",
    });
    this.version(2).stores({
      day_aggs: "++id, [spedId+date+dir], spedId, date, dir",
      cfop_aggs: "++id, [spedId+cfop+dir], spedId, cfop, dir",
      day_cfop_aggs: "++id, [spedId+date+cfop+dir], spedId, date, cfop, dir",
    });
    this.version(3).stores({
      // string PK (uuid). Indexes: spedId, documentId, cfop
      items_c170: "id, spedId, documentId, cfop, codItem",
    });
    // v4: adicionar companyName e cnpj
    this.version(4).stores({
      sped_files: "++id, importedAt, periodoInicio, periodoFim, totalGeral, hash, cnpj",
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
