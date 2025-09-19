import { listarAggDiaCfop } from "../db/daos/xmlDao";
import { db } from "../db";
import type {
  XmlComparativoLinha,
  DivergenciaDetalheResultado,
  DivergenciaNotaResumo,
} from "./types";

export async function gerarComparativoSpedXml(
  spedId: number,
  periodo?: { inicio?: string; fim?: string }
): Promise<{ linhas: XmlComparativoLinha[]; totalSped: number; totalXml: number }> {
  const spedMeta = await db.sped_files.get(spedId);
  const cnpjRef = spedMeta?.cnpj ? spedMeta.cnpj.replace(/\D/g, "") : undefined;
  const spedDayCfop = await db.day_cfop_aggs.where({ spedId }).toArray();
  const cfopsExcluir = new Set(["5929", "6929"]);
  const inicio = periodo?.inicio;
  const fim = periodo?.fim;
  const filtrados = spedDayCfop.filter((r) => {
    if (inicio && r.date < inicio) return false;
    if (fim && r.date > fim) return false;
    if (cfopsExcluir.has(r.cfop)) return false;
    return true;
  });
  const mapSped = new Map<string, number>();
  for (const r of filtrados) {
    if (r.dir !== "1") continue;
    const k = `${r.date}|${r.cfop}`;
    mapSped.set(k, (mapSped.get(k) || 0) + r.valor);
  }

  const xmlAgg = await listarAggDiaCfop({ dataInicio: inicio, dataFim: fim, cnpjRef });
  const linhas: XmlComparativoLinha[] = [];
  const usados = new Set<string>();

  for (const a of xmlAgg) {
    if (cfopsExcluir.has(a.cfop)) continue;
    const k = `${a.data}|${a.cfop}`;
    const spedValor = mapSped.get(k) || 0;
    let diffAbs = a.vProd - spedValor;
    if (Math.abs(diffAbs) < 0.00001) diffAbs = 0; // normaliza -0
    let diffPerc = spedValor === 0 ? 0 : (diffAbs / spedValor) * 100;
    if (Math.abs(diffPerc) < 0.00001) diffPerc = 0;
    linhas.push({
      data: a.data,
      cfop: a.cfop,
      xmlVProd: a.vProd,
      spedValorOperacao: spedValor,
      diffAbs,
      diffPerc,
    });
    usados.add(k);
  }
  for (const [k, spedValor] of mapSped.entries()) {
    if (usados.has(k)) continue;
    const [data, cfop] = k.split("|");
    if (cfopsExcluir.has(cfop)) continue;
    let diffAbs = 0 - spedValor;
    if (Math.abs(diffAbs) < 0.00001) diffAbs = 0;
    let diffPerc = spedValor === 0 ? 0 : (-spedValor / spedValor) * 100; // -100
    if (Math.abs(diffPerc) < 0.00001) diffPerc = 0;
    linhas.push({
      data,
      cfop,
      xmlVProd: 0,
      spedValorOperacao: spedValor,
      diffAbs,
      diffPerc,
    });
  }
  const sorted = linhas.sort(
    (a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop)
  );
  const totalSped = sorted.reduce((acc, l) => acc + l.spedValorOperacao, 0);
  const totalXml = sorted.reduce((acc, l) => acc + l.xmlVProd, 0);
  return { linhas: sorted, totalSped, totalXml };
}

export async function obterDetalhesDivergencia(
  spedId: number,
  data: string,
  cfop: string
): Promise<DivergenciaDetalheResultado> {
  const spedMeta = await db.sped_files.get(spedId);
  if (!spedMeta) throw new Error("SPED não encontrado");
  const cnpjRef = spedMeta.cnpj ? spedMeta.cnpj.replace(/\D/g, "") : undefined;
  const docs = await db.documents.where({ spedId }).toArray();
  const docById = new Map(docs.map((d) => [d.id!, d]));
  const itensSped = await db.items.where({ spedId }).toArray();
  const spedAgrupado = new Map<string, number>();
  for (const it of itensSped) {
    const doc = docById.get(it.documentId);
    if (!doc) continue;
    if (doc.indicadorOperacao !== "1") continue;
    if (doc.dataDocumento !== data) continue;
    if (it.cfop !== cfop) continue;
    const chave = doc.chaveNfe || doc.numeroDoc || `DOC-${doc.id}`;
    spedAgrupado.set(chave, (spedAgrupado.get(chave) || 0) + (it.valorOperacao || 0));
  }
  let xmlNotas = await db.xml_notas.where({ dataEmissao: data }).toArray();
  if (cnpjRef) xmlNotas = xmlNotas.filter((n) => (n.cnpjRef || "") === cnpjRef);
  const xmlAgrupado = new Map<string, number>();
  for (const nota of xmlNotas) {
    const somaCfop = (nota.itens || [])
      .filter((i) => i.cfop === cfop)
      .reduce((acc, i) => acc + (i.vProd || 0), 0);
    if (somaCfop > 0) {
      xmlAgrupado.set(nota.chave, (xmlAgrupado.get(nota.chave) || 0) + somaCfop);
    }
  }
  const chaves = new Set<string>([...xmlAgrupado.keys(), ...spedAgrupado.keys()]);
  const notas: DivergenciaNotaResumo[] = [];
  for (const chave of chaves) {
    const vXml = xmlAgrupado.get(chave) || 0;
    const vSped = spedAgrupado.get(chave) || 0;
    const tipo: DivergenciaNotaResumo["tipo"] =
      vXml > 0 && vSped > 0 ? "AMBOS" : vXml > 0 ? "SOMENTE_XML" : "SOMENTE_SPED";
    const diff = vXml - vSped;
    notas.push({
      chave,
      valorXml: vXml || undefined,
      valorSped: vSped || undefined,
      diff,
      tipo,
    });
  }
  notas.sort(
    (a, b) => (b.diff ? Math.abs(b.diff) : 0) - (a.diff ? Math.abs(a.diff) : 0)
  );
  const totalXml = Array.from(xmlAgrupado.values()).reduce((a, b) => a + b, 0);
  const totalSped = Array.from(spedAgrupado.values()).reduce((a, b) => a + b, 0);
  const diffAbs = totalXml - totalSped;
  return { data, cfop, totalXml, totalSped, diffAbs, notas };
}
