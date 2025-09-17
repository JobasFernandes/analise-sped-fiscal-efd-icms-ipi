import { db } from "../index";
import type { ItemC170Row } from "../index";
import type { ProcessedData } from "../../utils/types";
import { getDescricaoCfop } from "../../utils/cfopService";
import { parse } from "date-fns";

function parseLocalDate(iso?: string | null): Date | null {
  if (!iso) return null;
  try {
    return parse(iso, "yyyy-MM-dd", new Date());
  } catch {
    return new Date(iso);
  }
}

export async function getSpedProcessed(spedId: number): Promise<ProcessedData> {
  const sped = await db.sped_files.get(spedId);
  if (!sped) throw new Error("SPED não encontrado");
  const [documents, items, dayAggs, cfopAggs, dayCfopAggs, itemsC170] =
    await Promise.all([
      db.documents.where({ spedId }).toArray(),
      db.items.where({ spedId }).toArray(),
      db.day_aggs.where({ spedId }).toArray(),
      db.cfop_aggs.where({ spedId }).toArray(),
      db.day_cfop_aggs.where({ spedId }).toArray(),
      db.items_c170
        .where({ spedId })
        .toArray()
        .catch(() => [] as ItemC170Row[]),
    ]);

  const notasMap = new Map<string, any>();
  const entradas: any[] = [];
  const saidas: any[] = [];
  for (const d of documents) {
    const nota = {
      numeroDoc: d.numeroDoc,
      chaveNfe: d.chaveNfe,
      dataDocumento: parseLocalDate(d.dataDocumento),
      dataEntradaSaida: parseLocalDate(d.dataEntradaSaida),
      valorDocumento: d.valorDocumento || 0,
      valorMercadoria: d.valorMercadoria || 0,
      indicadorOperacao: d.indicadorOperacao,
      situacao: d.situacao,
      itens: [] as any[],
      itensC170: [] as any[],
    };
    notasMap.set(d.id!, nota);
    if (d.indicadorOperacao === "0") entradas.push(nota);
    else saidas.push(nota);
  }
  for (const it of items) {
    const nota = notasMap.get(it.documentId);
    if (!nota) continue;
    nota.itens.push({
      cfop: it.cfop,
      valorOperacao: it.valorOperacao || 0,
      cstIcms: it.cstIcms,
      aliqIcms: it.aliqIcms || 0,
      valorBcIcms: it.valorBcIcms || 0,
      valorIcms: it.valorIcms || 0,
    });
  }

  for (const ex of itemsC170) {
    const nota = notasMap.get(ex.documentId);
    if (!nota) continue;
    nota.itensC170.push({
      numItem: ex.numItem,
      codItem: ex.codItem,
      descrCompl: ex.descrCompl,
      quantidade: ex.quantidade,
      unidade: ex.unidade,
      valorItem: ex.valorItem,
      valorDesconto: ex.valorDesconto,
      cfop: ex.cfop,
      cstIcms: ex.cstIcms,
      aliqIcms: ex.aliqIcms,
      valorBcIcms: ex.valorBcIcms,
      valorIcms: ex.valorIcms,
    } as any);
  }

  const entradasPorDiaArray = dayAggs
    .filter((d) => d.dir === "0")
    .map((d) => ({ data: d.date, valor: d.valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const saidasPorDiaArray = dayAggs
    .filter((d) => d.dir === "1")
    .map((d) => ({ data: d.date, valor: d.valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const entradasPorCfopArray = cfopAggs
    .filter((d) => d.dir === "0")
    .map((d) => ({
      cfop: d.cfop,
      valor: d.valor,
      descricao: getDescricaoCfop(d.cfop),
    }))
    .sort((a, b) => b.valor - a.valor);
  const saidasPorCfopArray = cfopAggs
    .filter((d) => d.dir === "1")
    .map((d) => ({
      cfop: d.cfop,
      valor: d.valor,
      descricao: getDescricaoCfop(d.cfop),
    }))
    .sort((a, b) => b.valor - a.valor);
  const entradasPorDiaCfopArray = dayCfopAggs
    .filter((d) => d.dir === "0")
    .map((d) => ({ data: d.date, cfop: d.cfop, valor: d.valor }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));
  const saidasPorDiaCfopArray = dayCfopAggs
    .filter((d) => d.dir === "1")
    .map((d) => ({ data: d.date, cfop: d.cfop, valor: d.valor }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));

  const totalEntradas = entradasPorDiaArray.reduce((acc, i) => acc + i.valor, 0);
  const totalSaidas = saidasPorDiaArray.reduce((acc, i) => acc + i.valor, 0);
  const totalGeral = totalEntradas + totalSaidas;

  const periodo = {
    inicio: sped.periodoInicio as any,
    fim: sped.periodoFim as any,
  };
  const vendas = saidas;
  const vendasPorDiaArray = saidasPorDiaArray;
  const vendasPorCfopArray = saidasPorCfopArray;

  const itensPorCfopIndex: Record<string, any[]> = {};
  for (const it of items) {
    const d = documents.find((doc) => doc.id === it.documentId);
    const key = it.cfop;
    if (!itensPorCfopIndex[key]) itensPorCfopIndex[key] = [];
    itensPorCfopIndex[key].push({
      cfop: it.cfop,
      valorOperacao: it.valorOperacao,
      cstIcms: it.cstIcms,
      aliqIcms: it.aliqIcms,
      valorBcIcms: it.valorBcIcms,
      valorIcms: it.valorIcms,
      numeroDoc: d?.numeroDoc,
      chaveNfe: d?.chaveNfe,
      dataDocumento: parseLocalDate(d?.dataDocumento || null),
      dataEntradaSaida: parseLocalDate(d?.dataEntradaSaida || null),
      valorTotal: d?.valorDocumento,
      situacao: d?.situacao || "00",
    });
  }

  return {
    entradas,
    saidas,
    entradasPorDiaArray,
    saidasPorDiaArray,
    entradasPorCfopArray,
    saidasPorCfopArray,
    entradasPorDiaCfopArray,
    saidasPorDiaCfopArray,
    itensPorCfopIndex,
    totalEntradas,
    totalSaidas,
    totalGeral,
    periodo,
    vendas,
    vendasPorDia: undefined as any,
    vendasPorCfop: undefined as any,
    vendasPorDiaArray,
    vendasPorCfopArray,
  } as unknown as ProcessedData;
}
