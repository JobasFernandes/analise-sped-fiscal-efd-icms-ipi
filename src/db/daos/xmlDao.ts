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

export type XmlNotaIgnoradaMotivo =
  | "arquivoInvalido"
  | "canceladaOuInvalida"
  | "cnpjDiferente"
  | "foraPeriodo"
  | "duplicada"
  | "semItensValidos";

export interface ImportarXmlResultado {
  inseridas: number;
  ignoradas: number;
  motivos: Record<XmlNotaIgnoradaMotivo, number>;
  detalhes: Record<XmlNotaIgnoradaMotivo, XmlNotaIgnoradaDetalhe[]>;
}

export interface XmlNotaIgnoradaDetalhe {
  motivo: XmlNotaIgnoradaMotivo;
  chave?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  arquivo?: string;
  cfopsOriginais?: string[];
}

const motivoKeys: XmlNotaIgnoradaMotivo[] = [
  "arquivoInvalido",
  "canceladaOuInvalida",
  "cnpjDiferente",
  "foraPeriodo",
  "duplicada",
  "semItensValidos",
];

const criarMapaMotivos = () => {
  return motivoKeys.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<XmlNotaIgnoradaMotivo, number>
  );
};

const criarMapaDetalhes = () => {
  return motivoKeys.reduce(
    (acc, key) => {
      acc[key] = [] as XmlNotaIgnoradaDetalhe[];
      return acc;
    },
    {} as Record<XmlNotaIgnoradaMotivo, XmlNotaIgnoradaDetalhe[]>
  );
};

const MAX_DETALHES_POR_MOTIVO = 1000;

export async function importarXmlNotas(
  arquivos: { name: string; content: string }[],
  opts: ImportarXmlOptions = {}
): Promise<ImportarXmlResultado> {
  let inseridas = 0;
  let ignoradas = 0;
  const motivos = criarMapaMotivos();
  const detalhes = criarMapaDetalhes();
  const excluirSet = new Set((opts.cfopsExcluir ?? []).map(String));
  const vendasPermitidasSet = new Set((opts.cfopsVendaPermitidos || []).map(String));
  const cnpjRef = opts.cnpjBase ? opts.cnpjBase.replace(/\D/g, "") : undefined;

  const registrarIgnorada = (
    motivo: XmlNotaIgnoradaMotivo,
    detalhe?: Omit<XmlNotaIgnoradaDetalhe, "motivo">
  ) => {
    ignoradas++;
    motivos[motivo]++;
    if (!detalhe) return;
    const lista = detalhes[motivo];
    if (lista.length >= MAX_DETALHES_POR_MOTIVO) return;
    lista.push({ motivo, ...detalhe });
  };

  const chavesExistentes = new Set<string>();
  const notasExistentes = await db.xml_notas.toArray();
  for (const n of notasExistentes) {
    chavesExistentes.add(n.chave);
  }

  const notasParaInserir: XmlNotaRow[] = [];

  const aggMap = new Map<
    string,
    { vProd: number; qBCMonoRet: number; vICMSMonoRet: number }
  >();

  const aggsExistentes = await db.xml_day_cfop_aggs.toArray();
  const aggIdMap = new Map<string, number>();
  for (const agg of aggsExistentes) {
    const k = `${agg.cnpjRef || ""}|${agg.data}|${agg.cfop}|${agg.tpNF || ""}`;
    aggMap.set(k, {
      vProd: agg.vProd,
      qBCMonoRet: agg.qBCMonoRet || 0,
      vICMSMonoRet: agg.vICMSMonoRet || 0,
    });
    if (agg.id) aggIdMap.set(k, agg.id);
  }

  for (const a of arquivos) {
    let nota;
    try {
      nota = parseXmlNfe(a.content);
    } catch (err) {
      registrarIgnorada("arquivoInvalido", { arquivo: a.name });
      continue;
    }
    if (!nota) {
      registrarIgnorada("arquivoInvalido", { arquivo: a.name });
      continue;
    }
    if (!nota.autorizada) {
      registrarIgnorada("canceladaOuInvalida", {
        chave: nota.chave,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        arquivo: a.name,
      });
      continue;
    }
    if (opts.cnpjBase) {
      const cnpjBase = opts.cnpjBase.replace(/\D/g, "");
      const emit = (nota.cnpjEmit || "").replace(/\D/g, "");
      const dest = (nota.cnpjDest || "").replace(/\D/g, "");
      if (emit !== cnpjBase && dest !== cnpjBase) {
        registrarIgnorada("cnpjDiferente", {
          chave: nota.chave,
          numero: nota.numero,
          serie: nota.serie,
          dataEmissao: nota.dataEmissao,
          arquivo: a.name,
        });
        continue;
      }
    }
    if (opts.dataInicio && nota.dataEmissao < opts.dataInicio) {
      registrarIgnorada("foraPeriodo", {
        chave: nota.chave,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        arquivo: a.name,
      });
      continue;
    }
    if (opts.dataFim && nota.dataEmissao > opts.dataFim) {
      registrarIgnorada("foraPeriodo", {
        chave: nota.chave,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        arquivo: a.name,
      });
      continue;
    }
    if (chavesExistentes.has(nota.chave)) {
      registrarIgnorada("duplicada", {
        chave: nota.chave,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        arquivo: a.name,
      });
      continue;
    }
    const itensFiltrados = (nota.itens || []).filter((i) => {
      if (!i.cfop) return false;
      if (excluirSet.has(i.cfop)) return false;

      const cnpjBase = opts.cnpjBase ? opts.cnpjBase.replace(/\D/g, "") : "";
      const emit = (nota.cnpjEmit || "").replace(/\D/g, "");
      const isEmitente = cnpjBase && emit === cnpjBase;

      if (
        isEmitente &&
        opts.somenteVendasDiretas &&
        vendasPermitidasSet.size > 0 &&
        !vendasPermitidasSet.has(i.cfop)
      )
        return false;
      return true;
    });
    if (itensFiltrados.length === 0) {
      const cfopsOriginais = Array.from(
        new Set((nota.itens || []).map((i) => i.cfop).filter(Boolean))
      );
      registrarIgnorada("semItensValidos", {
        chave: nota.chave,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        arquivo: a.name,
        cfopsOriginais,
      });
      continue;
    }

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
      tpNF: nota.tpNF,
      valorTotalProduto: nota.valorTotalProduto,
      qBCMonoRetTotal: nota.qBCMonoRetTotal,
      vICMSMonoRetTotal: nota.vICMSMonoRetTotal,
      xmlContent: a.content,
      itens: itensFiltrados.map((i) => ({
        cfop: i.cfop,
        vProd: i.vProd,
        qBCMonoRet: i.qBCMonoRet,
        vICMSMonoRet: i.vICMSMonoRet,
      })),
    };

    notasParaInserir.push(row);
    chavesExistentes.add(nota.chave);

    for (const it of row.itens || []) {
      const k = `${cnpjRef || ""}|${row.dataEmissao}|${it.cfop}|${row.tpNF || ""}`;
      const existing = aggMap.get(k);
      if (existing) {
        existing.vProd += it.vProd;
        existing.qBCMonoRet += it.qBCMonoRet || 0;
        existing.vICMSMonoRet += it.vICMSMonoRet || 0;
      } else {
        aggMap.set(k, {
          vProd: it.vProd,
          qBCMonoRet: it.qBCMonoRet || 0,
          vICMSMonoRet: it.vICMSMonoRet || 0,
        });
      }
    }
    inseridas++;
  }

  if (notasParaInserir.length > 0 || aggMap.size > 0) {
    await db.transaction("rw", [db.xml_notas, db.xml_day_cfop_aggs], async () => {
      if (notasParaInserir.length > 0) {
        await db.xml_notas.bulkAdd(notasParaInserir);
      }

      const aggsParaInserir: XmlDayCfopAggRow[] = [];
      const aggsParaAtualizar: { id: number; changes: Partial<XmlDayCfopAggRow> }[] =
        [];

      for (const [k, val] of aggMap.entries()) {
        const [ref, data, cfop, tpNF] = k.split("|");
        const existingId = aggIdMap.get(k);
        if (existingId) {
          aggsParaAtualizar.push({
            id: existingId,
            changes: {
              vProd: val.vProd,
              qBCMonoRet: val.qBCMonoRet,
              vICMSMonoRet: val.vICMSMonoRet,
            },
          });
        } else {
          aggsParaInserir.push({
            cnpjRef: ref || undefined,
            data,
            cfop,
            tpNF: tpNF || undefined,
            vProd: val.vProd,
            qBCMonoRet: val.qBCMonoRet || undefined,
            vICMSMonoRet: val.vICMSMonoRet || undefined,
          });
        }
      }

      if (aggsParaInserir.length > 0) {
        await db.xml_day_cfop_aggs.bulkAdd(aggsParaInserir);
      }
      for (const upd of aggsParaAtualizar) {
        await db.xml_day_cfop_aggs.update(upd.id, upd.changes);
      }
    });
  }

  return { inseridas, ignoradas, motivos, detalhes };
}

export interface XmlAggConsultaFiltro {
  dataInicio?: string;
  dataFim?: string;
  cnpjRef?: string;
  tpNF?: string;
}

export async function listarAggDiaCfop(
  filtro: XmlAggConsultaFiltro = {}
): Promise<XmlDayCfopAggRow[]> {
  let coll = db.xml_day_cfop_aggs.toCollection();
  if (filtro.cnpjRef) {
    const cnpjRef = filtro.cnpjRef.replace(/\D/g, "");
    coll = coll.filter((r) => (r.cnpjRef || "") === cnpjRef);
  }
  if (filtro.tpNF) {
    coll = coll.filter((r) => r.tpNF === filtro.tpNF);
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

export async function buscarXmlsPorCnpj(cnpjBase: string): Promise<XmlNotaRow[]> {
  const cnpjRef = cnpjBase.replace(/\D/g, "");
  return db.xml_notas
    .filter((n) => (n.cnpjRef || "") === cnpjRef && !!n.xmlContent)
    .toArray();
}

export async function contarXmlsPorCnpj(cnpjBase: string): Promise<number> {
  const cnpjRef = cnpjBase.replace(/\D/g, "");
  return db.xml_notas.filter((n) => (n.cnpjRef || "") === cnpjRef).count();
}

export async function contarXmlsExportaveisPorCnpj(cnpjBase: string): Promise<number> {
  const cnpjRef = cnpjBase.replace(/\D/g, "");
  return db.xml_notas
    .filter((n) => (n.cnpjRef || "") === cnpjRef && !!n.xmlContent)
    .count();
}
