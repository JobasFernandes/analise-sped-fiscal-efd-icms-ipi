import { db, type XmlNotaRow, type XmlDayCfopAggRow } from "../index";
import { parseXmlNfe } from "../../utils/xmlParser";

export interface ImportarXmlOptions {
  cnpjBase?: string;
  dataInicio?: string;
  dataFim?: string;
  cfopsExcluir?: string[];
  somenteVendasDiretas?: boolean;
  cfopsVendaPermitidos?: string[];
}

const genId = () =>
  (globalThis as any).crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function importarXmlNotas(
  arquivos: { name: string; content: string }[],
  opts: ImportarXmlOptions = {}
): Promise<{ inseridas: number; ignoradas: number }> {
  let inseridas = 0;
  let ignoradas = 0;
  const excluirSet = new Set((opts.cfopsExcluir || ["5929", "6929"]).map(String));
  const vendasPermitidasSet = new Set((opts.cfopsVendaPermitidos || []).map(String));
  await db.transaction("rw", [db.xml_notas, db.xml_day_cfop_aggs], async () => {
    for (const a of arquivos) {
      const nota = parseXmlNfe(a.content);
      if (!nota || !nota.autorizada) {
        ignoradas++;
        continue;
      }
      if (opts.cnpjBase) {
        const cnpjBase = opts.cnpjBase.replace(/\D/g, "");
        const emit = (nota.cnpjEmit || "").replace(/\D/g, "");
        const dest = (nota.cnpjDest || "").replace(/\D/g, "");
        if (emit !== cnpjBase && dest !== cnpjBase) {
          ignoradas++;
          continue;
        }
      }
      if (opts.dataInicio && nota.dataEmissao < opts.dataInicio) {
        ignoradas++;
        continue;
      }
      if (opts.dataFim && nota.dataEmissao > opts.dataFim) {
        ignoradas++;
        continue;
      }
      const existing = await db.xml_notas.where({ chave: nota.chave }).first();
      if (existing) {
        ignoradas++;
        continue;
      }
      const itensFiltrados = (nota.itens || []).filter((i) => {
        if (!i.cfop) return false;
        if (excluirSet.has(i.cfop)) return false;
        if (
          opts.somenteVendasDiretas &&
          vendasPermitidasSet.size > 0 &&
          !vendasPermitidasSet.has(i.cfop)
        )
          return false;
        return true;
      });
      if (itensFiltrados.length === 0) {
        ignoradas++;
        continue;
      }
      const cnpjRef = opts.cnpjBase ? opts.cnpjBase.replace(/\D/g, "") : undefined;
      const row: XmlNotaRow = {
        id: genId(),
        chave: nota.chave,
        dataEmissao: nota.dataEmissao,
        modelo: nota.modelo,
        serie: nota.serie,
        numero: nota.numero,
        cnpjEmit: nota.cnpjEmit,
        cnpjDest: nota.cnpjDest,
        cnpjRef,
        valorTotalProduto: nota.valorTotalProduto,
        qBCMonoRetTotal: nota.qBCMonoRetTotal,
        vICMSMonoRetTotal: nota.vICMSMonoRetTotal,
        itens: itensFiltrados.map((i) => ({
          cfop: i.cfop,
          vProd: i.vProd,
          qBCMonoRet: i.qBCMonoRet,
          vICMSMonoRet: i.vICMSMonoRet,
        })),
      };
      await db.xml_notas.add(row);
      for (const it of row.itens || []) {
        let existingAgg: XmlDayCfopAggRow | undefined;
        if (cnpjRef) {
          existingAgg = await db.xml_day_cfop_aggs
            .where("[cnpjRef+data+cfop]")
            .equals([cnpjRef, row.dataEmissao, it.cfop])
            .first();
        } else {
          existingAgg = await db.xml_day_cfop_aggs
            .where("data")
            .equals(row.dataEmissao)
            .and((a) => a.cfop === it.cfop && !a.cnpjRef)
            .first();
        }
        if (existingAgg) {
          await db.xml_day_cfop_aggs.update(existingAgg.id!, {
            vProd: existingAgg.vProd + it.vProd,
            qBCMonoRet: (existingAgg.qBCMonoRet || 0) + (it.qBCMonoRet || 0),
            vICMSMonoRet: (existingAgg.vICMSMonoRet || 0) + (it.vICMSMonoRet || 0),
          });
        } else {
          const agg: XmlDayCfopAggRow = {
            cnpjRef,
            data: row.dataEmissao,
            cfop: it.cfop,
            vProd: it.vProd,
            qBCMonoRet: it.qBCMonoRet,
            vICMSMonoRet: it.vICMSMonoRet,
          };
          await db.xml_day_cfop_aggs.add(agg);
        }
      }
      inseridas++;
    }
  });
  return { inseridas, ignoradas };
}

export interface XmlAggConsultaFiltro {
  dataInicio?: string;
  dataFim?: string;
  cnpjRef?: string;
}

export async function listarAggDiaCfop(
  filtro: XmlAggConsultaFiltro = {}
): Promise<XmlDayCfopAggRow[]> {
  let coll = db.xml_day_cfop_aggs.toCollection();
  if (filtro.cnpjRef) {
    const cnpjRef = filtro.cnpjRef.replace(/\D/g, "");
    coll = coll.filter((r) => (r.cnpjRef || "") === cnpjRef);
  }
  if (filtro.dataInicio) coll = coll.filter((r) => r.data >= filtro.dataInicio!);
  if (filtro.dataFim) coll = coll.filter((r) => r.data <= filtro.dataFim!);
  return coll.sortBy("data");
}

export async function limparXmlDados(): Promise<void> {
  await db.transaction("rw", [db.xml_notas, db.xml_day_cfop_aggs], async () => {
    await db.xml_notas.clear();
    await db.xml_day_cfop_aggs.clear();
  });
}

export async function limparXmlDadosPorCnpj(cnpjBase: string): Promise<void> {
  const cnpjRef = cnpjBase.replace(/\D/g, "");
  await db.transaction("rw", [db.xml_notas, db.xml_day_cfop_aggs], async () => {
    const notas = await db.xml_notas
      .filter((n) => (n.cnpjRef || "") === cnpjRef)
      .toArray();
    for (const n of notas) await db.xml_notas.delete(n.id!);
    const aggs = await db.xml_day_cfop_aggs
      .filter((a) => (a.cnpjRef || "") === cnpjRef)
      .toArray();
    for (const a of aggs) await db.xml_day_cfop_aggs.delete(a.id!);
  });
}
