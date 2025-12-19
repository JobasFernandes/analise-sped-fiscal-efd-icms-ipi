import { db, DocumentRow, ItemRow, ItemC170Row } from "../db";

function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  return value.toFixed(decimals).replace(".", ",");
}

function normalizeCstIcms(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed) && trimmed.length < 3) {
    return trimmed.padStart(3, "0");
  }
  return trimmed;
}

function formatDateToSped(dateISO: string | null | undefined): string {
  if (!dateISO) return "";
  const [year, month, day] = dateISO.split("-");
  return `${day}${month}${year}`;
}

export interface AddedDocument {
  document: DocumentRow;
  itemsC170: ItemC170Row[];
  itemsC190: ItemRow[];
}

export async function getAddedDocuments(spedId: number): Promise<AddedDocument[]> {
  const documents = await db.documents
    .where({ spedId })
    .filter((doc) => doc.source === "added")
    .toArray();

  const result: AddedDocument[] = [];

  for (const doc of documents) {
    const itemsC170 = await db.items_c170
      .where({ spedId, documentId: doc.id! })
      .toArray();

    const itemsC190 = await db.items.where({ spedId, documentId: doc.id! }).toArray();

    result.push({ document: doc, itemsC170, itemsC190 });
  }

  return result;
}

export function generateC100Line(doc: DocumentRow, itemsC170: ItemC170Row[]): string {
  let vlBcIcms = 0;
  let vlIcms = 0;
  let vlIpi = 0;
  let vlPis = 0;
  let vlCofins = 0;
  let vlDesc = 0;

  for (const item of itemsC170) {
    vlBcIcms += item.valorBcIcms || 0;
    vlIcms += item.valorIcms || 0;
    vlIpi += item.valorIpi || 0;
    vlPis += item.valorPis || 0;
    vlCofins += item.valorCofins || 0;
    vlDesc += item.valorDesconto || 0;
  }

  const chave = doc.chaveNfe || "";
  const serie =
    chave.length >= 25 ? chave.substring(22, 25).replace(/^0+/, "") || "1" : "";
  const codMod = chave.length >= 22 ? chave.substring(20, 22) : "55";

  const codPart = "";

  const indEmit = doc.indicadorOperacao === "1" ? "0" : "1";

  const fields = [
    "C100",
    doc.indicadorOperacao,
    indEmit,
    codPart,
    codMod,
    doc.situacao || "00",
    serie,
    doc.numeroDoc,
    doc.chaveNfe,
    formatDateToSped(doc.dataDocumento),
    formatDateToSped(doc.dataEntradaSaida),
    formatNumber(doc.valorDocumento),
    "0",
    formatNumber(vlDesc),
    "",
    formatNumber(doc.valorMercadoria),
    "9",
    "",
    "",
    "",
    formatNumber(vlBcIcms),
    formatNumber(vlIcms),
    "",
    "",
    formatNumber(vlIpi),
    formatNumber(vlPis),
    formatNumber(vlCofins),
    "",
    "",
  ];

  return `|${fields.join("|")}|`;
}

export function generateC170Line(item: ItemC170Row): string {
  const fields = [
    "C170",
    String(item.numItem || 1),
    item.codItem || "",
    item.descrCompl || "",
    formatNumber(item.quantidade, 5),
    item.unidade || "UN",
    formatNumber(item.valorItem),
    formatNumber(item.valorDesconto),
    "0",
    normalizeCstIcms(item.cstIcms),
    item.cfop || "",
    "",
    formatNumber(item.valorBcIcms),
    formatNumber(item.aliqIcms),
    formatNumber(item.valorIcms),
    "",
    "",
    "",
    "0",
    "",
    "",
    "",
    "",
    formatNumber(item.valorIpi),
    "",
    "",
    "",
    "",
    "",
    formatNumber(item.valorPis),
    "",
    "",
    "",
    "",
    "",
    formatNumber(item.valorCofins),
    "",
    "",
  ];

  return `|${fields.join("|")}|`;
}

export function generateC190Line(item: ItemRow): string {
  const fields = [
    "C190",
    normalizeCstIcms(item.cstIcms),
    item.cfop || "",
    formatNumber(item.aliqIcms),
    formatNumber(item.valorOperacao),
    formatNumber(item.valorBcIcms),
    formatNumber(item.valorIcms),
    formatNumber(0),
    formatNumber(0),
    formatNumber(0),
    formatNumber(item.valorIpi),
    "",
  ];

  return `|${fields.join("|")}|`;
}

/**
 * @param spedId
 * @param includeC170
 * @returns
 */
export async function generateAddedDocumentLines(
  spedId: number,
  includeC170: boolean
): Promise<{
  lines: string[];
  counts: {
    C100: number;
    C170: number;
    C190: number;
  };
}> {
  const addedDocs = await getAddedDocuments(spedId);
  const lines: string[] = [];
  const counts = { C100: 0, C170: 0, C190: 0 };

  for (const { document, itemsC170, itemsC190 } of addedDocs) {
    lines.push(generateC100Line(document, itemsC170));
    counts.C100++;

    if (includeC170) {
      for (const item of itemsC170) {
        lines.push(generateC170Line(item));
        counts.C170++;
      }
    }

    for (const item of itemsC190) {
      lines.push(generateC190Line(item));
      counts.C190++;
    }
  }

  return { lines, counts };
}
