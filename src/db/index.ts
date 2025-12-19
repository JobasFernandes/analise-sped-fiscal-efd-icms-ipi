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
  valorIpi?: number;
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
  valorIpi?: number;
  valorPis?: number;
  valorCofins?: number;
}

export class SpedDB extends Dexie {
  sped_files!: Table<SpedFileRow, number>;
  documents!: Table<DocumentRow, string>;
  items!: Table<ItemRow, string>;
  items_c170!: Table<ItemC170Row, string>;
  day_aggs!: Table<DayAggRow, number>;
  cfop_aggs!: Table<CfopAggRow, number>;
  day_cfop_aggs!: Table<DayCfopAggRow, number>;
  xml_notas!: Table<XmlNotaRow, string>;
  xml_day_cfop_aggs!: Table<XmlDayCfopAggRow, number>;
  divergences!: Table<DivergenceRow, number>;

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
    // v5: adicionar tabelas para resumos de XML (NFe / NFCe)
    this.version(5).stores({
      xml_notas: "id, chave, dataEmissao, cnpjEmit, cnpjDest", // id string (uuid)
      xml_day_cfop_aggs: "++id, [data+cfop], data, cfop",
    });
    // v6: adicionar dimensão cnpjRef para segmentar dados XML por empresa (CNPJ base do SPED)
    this.version(6)
      .stores({
        xml_notas: "id, chave, dataEmissao, cnpjEmit, cnpjDest, cnpjRef", // adiciona índice cnpjRef
        xml_day_cfop_aggs: "++id, [cnpjRef+data+cfop], cnpjRef, data, cfop", // agrega por CNPJ
      })
      .upgrade(async (trans) => {
        await trans.table("xml_notas").clear();
        await trans.table("xml_day_cfop_aggs").clear();
      });
    // v7: adicionar campo xmlContent para armazenar o XML original
    this.version(7).stores({
      xml_notas: "id, chave, dataEmissao, cnpjEmit, cnpjDest, cnpjRef",
    });
    // v8: adicionar tpNF para classificar entrada/saida
    this.version(8).stores({
      xml_notas: "id, chave, dataEmissao, cnpjEmit, cnpjDest, cnpjRef, tpNF",
    });
    // v9: adicionar tpNF na agregação para separar entrada/saida
    this.version(9)
      .stores({
        xml_day_cfop_aggs: "++id, [cnpjRef+data+cfop+tpNF], cnpjRef, data, cfop, tpNF",
      })
      .upgrade(async (trans) => {
        await trans.table("xml_day_cfop_aggs").clear();
      });
    // v10: adicionar tabela de divergências
    this.version(10).stores({
      divergences: "++id, accessKey, type, status, updatedAt",
    });
    // v11: adicionar índices compostos para performance
    this.version(11).stores({
      documents:
        "id, spedId, numeroDoc, chaveNfe, dataDocumento, indicadorOperacao, [spedId+chaveNfe]",
      items: "id, spedId, documentId, cfop, [spedId+documentId]",
    });
    // v12: adicionar tabela para armazenar conteúdo original do SPED
    this.version(12).stores({
      sped_contents: "id, spedId", // id (uuid), spedId (FK)
    });
    // v13: adicionar tabelas para movimentação de combustíveis (Registros 1300, 1310, 1320)
    this.version(13).stores({
      combustivel_mov_diaria:
        "++id, spedId, codItem, dtMov, [spedId+codItem+dtMov], [spedId+dtMov]",
      combustivel_tanque:
        "++id, spedId, codItem, dtMov, numTanque, [spedId+codItem+dtMov], [spedId+numTanque]",
      combustivel_bico:
        "++id, spedId, codItem, dtMov, numTanque, numBico, [spedId+codItem+dtMov], [spedId+numBico]",
      combustivel_inconsistencias:
        "++id, spedId, tipo, severidade, codItem, dtMov, [spedId+tipo], [spedId+dtMov], [spedId+severidade]",
    });
  }

  // Declaração das tabelas de combustíveis
  combustivel_mov_diaria!: Table<CombustivelMovDiariaRow, number>;
  combustivel_tanque!: Table<CombustivelTanqueRow, number>;
  combustivel_bico!: Table<CombustivelBicoRow, number>;
  combustivel_inconsistencias!: Table<CombustivelInconsistenciaRow, number>;
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

export interface SpedContentRow {
  id?: string; // uuid
  spedId: number;
  content: Blob | File;
}

// ---------------- XML STORAGE (v5) -----------------
export interface XmlNotaRow {
  id?: string; // uuid
  chave: string;
  dataEmissao: string; // yyyy-MM-dd
  modelo: string;
  serie: string;
  numero: string;
  cnpjEmit?: string;
  cnpjDest?: string;
  cnpjRef?: string;
  tpNF?: string;
  valorTotalProduto: number;
  qBCMonoRetTotal?: number;
  vICMSMonoRetTotal?: number;
  xmlContent?: string; // conteúdo XML original (v7)
  itens?: Array<{
    cfop: string;
    vProd: number;
    qBCMonoRet?: number;
    vICMSMonoRet?: number;
  }>;
}

export interface XmlDayCfopAggRow {
  id?: number;
  cnpjRef?: string; // segmentação
  data: string; // yyyy-MM-dd
  cfop: string;
  tpNF?: string; // "0" | "1"
  vProd: number;
  qBCMonoRet?: number;
  vICMSMonoRet?: number;
}

export interface DivergenceRow {
  id?: number;
  accessKey: string; // Chave única para identificar a divergência (ex: "DATA|CFOP" ou Chave NFe)
  type: string; // "SPED_XML_CFOP", "ORPHAN_XML", etc.
  status: "PENDING" | "RESOLVED" | "IGNORED" | "JUSTIFIED";
  comment?: string;
  updatedAt: string; // ISO
}

/**
 * Registro 1300 - Movimentação Diária de Combustíveis (por produto)
 */
export interface CombustivelMovDiariaRow {
  id?: number; // auto-increment PK
  spedId: number; // FK -> SpedFileRow.id
  codItem: string; // Código do produto combustível
  dtMov: string; // Data da movimentação (ISO yyyy-MM-dd)
  qtdIni: number; // Quantidade inicial (litros)
  qtdEntr: number; // Quantidade de entrada
  qtdDisponivel: number; // Total disponível
  qtdVendas: number; // Quantidade vendida
  qtdFimFisico: number; // Estoque físico final
  qtdPerda: number; // Perdas declaradas
  qtdSobra: number; // Sobras declaradas
  qtdFimContabil: number; // Estoque contábil final
}

/**
 * Registro 1310 - Movimentação por Tanque
 */
export interface CombustivelTanqueRow {
  id?: number;
  spedId: number;
  codItem: string; // Herdado do 1300 pai
  dtMov: string; // Herdado do 1300 pai
  numTanque: string;
  qtdIni: number;
  qtdEntr: number;
  qtdDisponivel: number;
  qtdVendas: number;
  qtdFimFisico: number;
  qtdPerda: number;
  qtdSobra: number;
  qtdFimContabil: number;
}

/**
 * Registro 1320 - Volume de Vendas por Bico
 */
export interface CombustivelBicoRow {
  id?: number;
  spedId: number;
  codItem: string;
  dtMov: string;
  numTanque: string;
  numBico: string;
  numInterv?: string;
  motInterv?: string;
  nomInterv?: string;
  encerranteIni: number;
  encerranteFim: number;
  qtdAfericao: number;
  qtdVendas: number;
}

/**
 * Inconsistências detectadas em combustíveis
 */
export interface CombustivelInconsistenciaRow {
  id?: number;
  spedId: number;
  tipo: string; // TipoInconsistenciaCombustivel
  severidade: "INFO" | "AVISO" | "CRITICO";
  codItem: string;
  descricaoProduto?: string;
  dtMov: string;
  numTanque?: string;
  numBico?: string;
  valorEsperado: number;
  valorEncontrado: number;
  diferenca: number;
  percentualDiferenca: number;
  descricao: string;
  documentosRelacionados?: string; // JSON stringified array
  detectedAt: string; // ISO timestamp
}
