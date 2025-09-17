import type { DocumentRow, ItemRow, ItemC170Row, SpedFileRow } from "../index";
import type {
  ProcessedData,
  Nota,
  NotaItem,
  DiaValor,
  CfopValor,
  DiaCfopValor,
} from "../../utils/types";
import { getDescricaoCfop } from "../../utils/cfopService";
import { parse } from "date-fns";

function ensureISO(d?: string | null) {
  return d || null;
}

function parseLocalDate(iso?: string | null): Date | null {
  if (!iso) return null;
  try {
    return parse(iso, "yyyy-MM-dd", new Date());
  } catch {
    return new Date(iso);
  }
}

export function toProcessedData(
  sped: SpedFileRow,
  documents: DocumentRow[],
  items: ItemRow[],
  itemsC170?: ItemC170Row[]
): ProcessedData {
  const notasPorId = new Map<string, Nota>();
  const entradas: Nota[] = [];
  const saidas: Nota[] = [];

  for (const d of documents) {
    const nota: Nota = {
      numeroDoc: d.numeroDoc,
      chaveNfe: d.chaveNfe,
      dataDocumento: parseLocalDate(d.dataDocumento),
      dataEntradaSaida: parseLocalDate(d.dataEntradaSaida),
      valorDocumento: d.valorDocumento || 0,
      valorMercadoria: d.valorMercadoria || 0,
      indicadorOperacao: d.indicadorOperacao,
      situacao: d.situacao,
      itens: [],
      itensC170: [],
    };
    notasPorId.set(d.id!, nota);
    if (d.indicadorOperacao === "0") entradas.push(nota);
    else saidas.push(nota);
  }

  const c170ByDoc = new Map<string, ItemC170Row[]>();
  for (const it of itemsC170 || []) {
    const arr = c170ByDoc.get(it.documentId) || [];
    arr.push(it);
    c170ByDoc.set(it.documentId, arr);
  }

  for (const it of items) {
    const nota = notasPorId.get(it.documentId);
    if (!nota) continue;
    const item: NotaItem = {
      cfop: it.cfop,
      valorOperacao: it.valorOperacao || 0,
      cstIcms: it.cstIcms,
      aliqIcms: it.aliqIcms || 0,
      valorBcIcms: it.valorBcIcms || 0,
      valorIcms: it.valorIcms || 0,
    };
    nota.itens.push(item);
    const extras = c170ByDoc.get(it.documentId);
    if (extras && extras.length && nota.itensC170 && !nota.itensC170.length) {
      for (const ex of extras) {
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
    }
  }

  const mapEntradasPorDia = new Map<string, number>();
  const mapSaidasPorDia = new Map<string, number>();
  const mapEntradasPorCfop = new Map<string, number>();
  const mapSaidasPorCfop = new Map<string, number>();
  const mapEntradasPorDiaCfop = new Map<string, DiaCfopValor>();
  const mapSaidasPorDiaCfop = new Map<string, DiaCfopValor>();
  const itensPorCfop = new Map<string, any[]>();

  const addDia = (m: Map<string, number>, key: string, v: number) => {
    m.set(key, (m.get(key) || 0) + v);
  };
  const addDiaCfop = (
    m: Map<string, DiaCfopValor>,
    key: string,
    data: string,
    cfop: string,
    v: number
  ) => {
    const cur = m.get(key) || { data, cfop, valor: 0 };
    cur.valor += v;
    m.set(key, cur);
  };
  const addCfop = (m: Map<string, number>, cfop: string, v: number) => {
    m.set(cfop, (m.get(cfop) || 0) + v);
  };

  const yyyyMMdd = (d?: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`
      : null;

  for (const lista of [entradas, saidas]) {
    for (const n of lista) {
      const dataKey = yyyyMMdd(n.dataDocumento);
      if (!n.itens || !n.itens.length || !dataKey) continue;
      for (const it of n.itens) {
        const isEntrada = n.indicadorOperacao === "0";
        const valor = it.valorOperacao || 0;
        const cfop = it.cfop;
        if (!itensPorCfop.has(cfop)) itensPorCfop.set(cfop, []);
        itensPorCfop.get(cfop)!.push({
          cfop,
          valorOperacao: it.valorOperacao,
          cstIcms: it.cstIcms,
          aliqIcms: it.aliqIcms,
          valorBcIcms: it.valorBcIcms,
          valorIcms: it.valorIcms,
          numeroDoc: n.numeroDoc,
          chaveNfe: n.chaveNfe,
          dataDocumento: n.dataDocumento,
          dataEntradaSaida: n.dataEntradaSaida,
          valorTotal: n.valorDocumento,
          situacao: n.situacao,
        });
        if (isEntrada) {
          addDia(mapEntradasPorDia, dataKey, valor);
          addCfop(mapEntradasPorCfop, cfop, valor);
          addDiaCfop(mapEntradasPorDiaCfop, `${dataKey}-${cfop}`, dataKey, cfop, valor);
        } else {
          addDia(mapSaidasPorDia, dataKey, valor);
          addCfop(mapSaidasPorCfop, cfop, valor);
          addDiaCfop(mapSaidasPorDiaCfop, `${dataKey}-${cfop}`, dataKey, cfop, valor);
        }
      }
    }
  }

  const toDiaArray = (m: Map<string, number>): DiaValor[] =>
    Array.from(m.entries())
      .map(([data, valor]) => ({ data, valor }))
      .sort((a, b) => a.data.localeCompare(b.data));
  const toCfopArray = (m: Map<string, number>): CfopValor[] =>
    Array.from(m.entries())
      .map(([cfop, valor]) => ({
        cfop,
        valor,
        descricao: getDescricaoCfop(cfop),
      }))
      .sort((a, b) => b.valor - a.valor);
  const toDiaCfopArray = (m: Map<string, DiaCfopValor>): DiaCfopValor[] =>
    Array.from(m.values()).sort(
      (a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop)
    );

  const entradasPorDiaArray = toDiaArray(mapEntradasPorDia);
  const saidasPorDiaArray = toDiaArray(mapSaidasPorDia);
  const entradasPorCfopArray = toCfopArray(mapEntradasPorCfop);
  const saidasPorCfopArray = toCfopArray(mapSaidasPorCfop);
  const entradasPorDiaCfopArray = toDiaCfopArray(mapEntradasPorDiaCfop);
  const saidasPorDiaCfopArray = toDiaCfopArray(mapSaidasPorDiaCfop);

  const totalEntradas = entradasPorDiaArray.reduce((acc, i) => acc + i.valor, 0);
  const totalSaidas = saidasPorDiaArray.reduce((acc, i) => acc + i.valor, 0);
  const totalGeral = totalEntradas + totalSaidas;

  const periodo = {
    inicio: ensureISO(sped.periodoInicio) as any,
    fim: ensureISO(sped.periodoFim) as any,
  };

  const itensPorCfopIndex: Record<string, any[]> = {};
  for (const [cfop, arr] of itensPorCfop.entries()) itensPorCfopIndex[cfop] = arr;

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
    vendas: saidas,
    vendasPorDia: new Map<string, number>(
      saidasPorDiaArray.map((i) => [i.data, i.valor])
    ) as any,
    vendasPorCfop: new Map<string, number>(
      saidasPorCfopArray.map((i) => [i.cfop, i.valor])
    ) as any,
    vendasPorDiaArray: saidasPorDiaArray,
    vendasPorCfopArray: saidasPorCfopArray,
  } as unknown as ProcessedData;
}
