import { XmlNotaResumo, XmlItemResumo } from "./types";

function getText(parent: Element | Document, tagName: string): string | null {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || null;
}

function getAttr(
  parent: Element | Document,
  tagName: string,
  attr: string
): string | null {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.getAttribute(attr) || null;
}

function getElement(parent: Element | Document, tagName: string): Element | null {
  return parent.getElementsByTagName(tagName)[0] || null;
}

function getElements(parent: Element | Document, tagName: string): Element[] {
  return Array.from(parent.getElementsByTagName(tagName));
}

function toNumber(v?: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
}

function extractRegex(tag: string, xml: string): string | null {
  try {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    const m = re.exec(xml);
    return m && m[1] !== undefined ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export function parseXmlNfe(content: string): XmlNotaResumo | null {
  try {
    let xml = content;
    if (xml.charCodeAt(0) === 0xfeff) {
      xml = xml.slice(1);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return parseXmlNfeRegex(content);
    }

    const cStat = getText(doc, "cStat");
    const autorizada = cStat === "100";

    const infNFeId = getAttr(doc, "infNFe", "Id") || "";
    const chave = getText(doc, "chNFe") || infNFeId.replace(/^NFe/, "");

    const ideEl = getElement(doc, "ide");
    const tpNF = ideEl ? getText(ideEl, "tpNF") || "" : "";

    const dhEmi = getText(doc, "dhEmi") || "";
    const dhRecbto = getText(doc, "dhRecbto") || "";
    const usado = dhEmi || dhRecbto;
    const dataEmissao = usado ? usado.slice(0, 10) : "";

    const modelo = getText(doc, "mod") || "";
    const serie = getText(doc, "serie") || "";
    const numero = getText(doc, "nNF") || "";

    const emitEl = getElement(doc, "emit");
    const cnpjEmit = emitEl ? getText(emitEl, "CNPJ") || undefined : undefined;

    const destEl = getElement(doc, "dest");
    const cnpjDest = destEl ? getText(destEl, "CNPJ") || undefined : undefined;

    const totalEl = getElement(doc, "ICMSTot");
    const vProd = totalEl ? toNumber(getText(totalEl, "vProd")) : 0;
    const qBCMonoRetTotal = totalEl ? toNumber(getText(totalEl, "qBCMonoRet")) : 0;
    const vICMSMonoRetTotal = totalEl ? toNumber(getText(totalEl, "vICMSMonoRet")) : 0;

    const detElements = getElements(doc, "det");
    const itens: XmlItemResumo[] = detElements
      .map((detEl) => {
        const prodEl = getElement(detEl, "prod");
        const impostoEl = getElement(detEl, "imposto");
        const icms61El = impostoEl ? getElement(impostoEl, "ICMS61") : null;

        return {
          cfop: prodEl ? getText(prodEl, "CFOP") || "" : "",
          vProd: prodEl ? toNumber(getText(prodEl, "vProd")) : 0,
          qCom: prodEl ? toNumber(getText(prodEl, "qCom")) || undefined : undefined,
          qBCMonoRet: icms61El
            ? toNumber(getText(icms61El, "qBCMonoRet")) || undefined
            : undefined,
          vICMSMonoRet: icms61El
            ? toNumber(getText(icms61El, "vICMSMonoRet")) || undefined
            : undefined,
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
      tpNF,
      autorizada,
      valorTotalProduto: vProd,
      qBCMonoRetTotal: qBCMonoRetTotal || undefined,
      vICMSMonoRetTotal: vICMSMonoRetTotal || undefined,
      itens,
    };

    return nota;
  } catch (e) {
    console.warn("Falha ao parsear XML NFe com DOMParser, tentando regex:", e);
    return parseXmlNfeRegex(content);
  }
}

function parseXmlNfeRegex(content: string): XmlNotaResumo | null {
  try {
    const xml = content.replace(/xmlns(:\w+)?="[^"]*"/g, "");

    const cStat = extractRegex("cStat", xml);
    const autorizada = cStat === "100";

    const infNFeMatch = xml.match(/<infNFe[^>]*Id="([^"]+)"/);
    const infNFeId = infNFeMatch ? infNFeMatch[1] : "";
    const chave = extractRegex("chNFe", xml) || infNFeId.replace(/^NFe/, "");

    const tpNF = extractRegex("tpNF", xml) || "";

    const dhEmi = extractRegex("dhEmi", xml) || "";
    const dhRecbto = extractRegex("dhRecbto", xml) || "";

    const usado = dhEmi || dhRecbto;
    const dataEmissao = usado ? usado.slice(0, 10) : "";

    const modelo = extractRegex("mod", xml) || "";
    const serie = extractRegex("serie", xml) || "";
    const numero = extractRegex("nNF", xml) || "";

    const emitMatch = xml.match(/<emit>([\s\S]*?)<\/emit>/);
    const cnpjEmit = emitMatch
      ? extractRegex("CNPJ", emitMatch[1]) || undefined
      : undefined;

    const destMatch = xml.match(/<dest>([\s\S]*?)<\/dest>/);
    let cnpjDest: string | undefined = undefined;
    if (destMatch) {
      const cnpjMatch = destMatch[1].match(/<CNPJ>(\d+)<\/CNPJ>/);
      if (cnpjMatch) cnpjDest = cnpjMatch[1];
    }

    const totalMatch = xml.match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/);
    const totalBlock = totalMatch ? totalMatch[1] : "";
    const vProd = toNumber(extractRegex("vProd", totalBlock));
    const qBCMonoRetTotal = toNumber(extractRegex("qBCMonoRet", totalBlock));
    const vICMSMonoRetTotal = toNumber(extractRegex("vICMSMonoRet", totalBlock));

    const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g;
    const dets: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = detRegex.exec(xml))) dets.push(m[1]);

    const itens: XmlItemResumo[] = dets
      .map((detXml) => {
        const prodMatch = detXml.match(/<prod>([\s\S]*?)<\/prod>/);
        const prodBlock = prodMatch ? prodMatch[1] : "";
        const impostoMatch = detXml.match(/<imposto>([\s\S]*?)<\/imposto>/);
        const impostoBlock = impostoMatch ? impostoMatch[1] : "";
        const icms61Match = impostoBlock.match(/<ICMS61>([\s\S]*?)<\/ICMS61>/);
        const icms61Block = icms61Match ? icms61Match[1] : "";

        return {
          cfop: extractRegex("CFOP", prodBlock) || "",
          vProd: toNumber(extractRegex("vProd", prodBlock)),
          qCom: toNumber(extractRegex("qCom", prodBlock)) || undefined,
          qBCMonoRet: toNumber(extractRegex("qBCMonoRet", icms61Block)) || undefined,
          vICMSMonoRet:
            toNumber(extractRegex("vICMSMonoRet", icms61Block)) || undefined,
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
      tpNF,
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
