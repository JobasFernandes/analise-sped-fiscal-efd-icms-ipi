import { XmlNotaResumo, XmlItemResumo } from "./types";

function extract(tag: string, xml: string): string | null {
  try {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    const m = re.exec(xml);
    return m && m[1] !== undefined ? m[1].trim() : null;
  } catch {
    return null;
  }
}
function extractAttr(tag: string, attr: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`));
  return m ? m[1].trim() : null;
}
function extractAll(reg: RegExp, xml: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = reg.exec(xml))) out.push(m[1]);
  return out;
}

function toNumber(v?: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
}

export function parseXmlNfe(content: string): XmlNotaResumo | null {
  try {
    const xml = content.replace(/xmlns(:\w+)?="[^"]*"/g, "");

    const cStat = extract("cStat", xml);
    const autorizada = cStat === "100";

    const infNFeId = extractAttr("infNFe", "Id", xml) || "";
    const chave = extract("chNFe", xml) || infNFeId.replace(/^NFe/, "");

    const dhEmi = extract("dhEmi", xml) || "";
    const dhRecbto = extract("dhRecbto", xml) || "";

    const usado = dhEmi || dhRecbto;
    const dataEmissao = usado ? usado.slice(0, 10) : "";

    const modelo = extract("mod", xml) || "";
    const serie = extract("serie", xml) || "";
    const numero = extract("nNF", xml) || "";

    const cnpjEmit = extract("CNPJ", extract("emit", xml) || "") || undefined;
    const destBlock = extract("dest", xml) || "";
    let cnpjDest: string | undefined = undefined;
    if (destBlock) {
      const cnpjMatch = destBlock.match(/<CNPJ>(\d+)<\/CNPJ>/);
      if (cnpjMatch) cnpjDest = cnpjMatch[1];
    }

    const totalBlock = extract("ICMSTot", xml) || "";
    const vProd = toNumber(extract("vProd", totalBlock));
    const qBCMonoRetTotal = toNumber(extract("qBCMonoRet", totalBlock));
    const vICMSMonoRetTotal = toNumber(extract("vICMSMonoRet", totalBlock));

    const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g;
    const dets = extractAll(detRegex, xml);
    const itens: XmlItemResumo[] = dets
      .map((detXml) => {
        const prodBlock = extract("prod", detXml) || "";
        const impostoBlock = extract("imposto", detXml) || "";
        const icms61Block = extract("ICMS61", impostoBlock) || "";
        return {
          cfop: extract("CFOP", prodBlock) || "",
          vProd: toNumber(extract("vProd", prodBlock)),
          qCom: toNumber(extract("qCom", prodBlock)) || undefined,
          qBCMonoRet: toNumber(extract("qBCMonoRet", icms61Block)) || undefined,
          vICMSMonoRet: toNumber(extract("vICMSMonoRet", icms61Block)) || undefined,
        };
      })
      .filter((it) => it.cfop && it.vProd > 0);

    const nota: XmlNotaResumo = {
      chave,
      dhEmi,
      dhRecbto: dhRecbto || undefined,
      dataEmissao,
      modelo,
      serie,
      numero,
      cnpjEmit,
      cnpjDest,
      autorizada,
      valorTotalProduto: vProd,
      qBCMonoRetTotal: qBCMonoRetTotal || undefined,
      vICMSMonoRetTotal: vICMSMonoRetTotal || undefined,
      itens,
    };

    return nota;
  } catch (e) {
    console.warn("Falha ao parsear XML NFe:", e);
    return null;
  }
}

export interface BatchXmlParseResult {
  notas: XmlNotaResumo[];
  ignoradas: number;
}

export function parseXmlBatch(
  files: { name: string; content: string }[]
): BatchXmlParseResult {
  const notas: XmlNotaResumo[] = [];
  let ignoradas = 0;
  for (const f of files) {
    const n = parseXmlNfe(f.content);
    if (!n || !n.autorizada) {
      ignoradas++;
      continue;
    }
    notas.push(n);
  }
  return { notas, ignoradas };
}
