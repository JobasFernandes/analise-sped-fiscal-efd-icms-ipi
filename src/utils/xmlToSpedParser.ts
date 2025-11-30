export interface SpedC100Data {
  indOper: "0" | "1";
  indEmit: "0" | "1";
  codPart: string;
  codMod: string;
  codSit: string;
  ser: string;
  numDoc: string;
  chvNfe: string;
  dtDoc: string;
  dtES: string;
  vlDoc: number;
  indPgto: string;
  vlDesc: number;
  vlAbatNt: number;
  vlMerc: number;
  indFrt: string;
  vlFrt: number;
  vlSeg: number;
  vlOutDa: number;
  vlBcIcms: number;
  vlIcms: number;
  vlBcIcmsSt: number;
  vlIcmsSt: number;
  vlIpi: number;
  vlPis: number;
  vlCofins: number;
  vlPisSt: number;
  vlCofinsSt: number;
}

export interface SpedC170Data {
  numItem: number;
  codItem: string;
  descrCompl: string;
  qtd: number;
  unid: string;
  vlItem: number;
  vlDesc: number;
  indMov: string;
  cstIcms: string;
  cfop: string;
  codNat: string;
  vlBcIcms: number;
  aliqIcms: number;
  vlIcms: number;
  vlBcIcmsSt: number;
  aliqIcmsSt: number;
  vlIcmsSt: number;
  indApur: string;
  cstIpi: string;
  codEnq: string;
  vlBcIpi: number;
  aliqIpi: number;
  vlIpi: number;
  cstPis: string;
  vlBcPis: number;
  aliqPis: number;
  quantBcPis: number;
  aliqPisReais: number;
  vlPis: number;
  cstCofins: string;
  vlBcCofins: number;
  aliqCofins: number;
  quantBcCofins: number;
  aliqCofinsReais: number;
  vlCofins: number;
  codCta: string;
  vlAbatNt: number;
}

function getText(
  parent: Element | Document | null | undefined,
  tagName: string
): string | null {
  if (!parent || !parent.getElementsByTagName) return null;
  const collection = parent.getElementsByTagName(tagName);
  if (!collection || collection.length === 0) return null;
  const el = collection[0];
  return el?.textContent?.trim() || null;
}

function toNumber(v?: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
}

export function parseXmlToSped(
  xmlContent: string,
  cnpjSped: string
): { c100: SpedC100Data; c170: SpedC170Data[] } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "application/xml");

    const infNFe = doc.getElementsByTagName("infNFe")[0];
    if (!infNFe) return null;

    const ide = infNFe.getElementsByTagName("ide")[0];
    const emit = infNFe.getElementsByTagName("emit")[0];
    const dest = infNFe.getElementsByTagName("dest")[0];
    const total = infNFe.getElementsByTagName("total")[0];
    const ICMSTot = total?.getElementsByTagName("ICMSTot")[0];

    const cnpjEmit = getText(emit, "CNPJ");
    const cnpjDest = getText(dest, "CNPJ");

    let indOper: "0" | "1" = "0";
    let indEmit: "0" | "1" = "0";

    if (cnpjEmit === cnpjSped) {
      indEmit = "0";
      const tpNF = getText(ide, "tpNF");
      indOper = tpNF === "1" ? "1" : "0";
    } else {
      indEmit = "1";
      indOper = "0";
    }

    const codPart =
      indEmit === "0"
        ? getText(dest, "CNPJ") || getText(dest, "CPF") || ""
        : getText(emit, "CNPJ") || getText(emit, "CPF") || "";

    const dtEmi = getText(ide, "dhEmi") || getText(ide, "dEmi");
    const dtDoc = dtEmi ? dtEmi.slice(0, 10).split("-").reverse().join("") : "";

    const c100: SpedC100Data = {
      indOper,
      indEmit,
      codPart,
      codMod: getText(ide, "mod") || "55",
      codSit: "00",
      ser: getText(ide, "serie") || "",
      numDoc: getText(ide, "nNF") || "",
      chvNfe: (infNFe.getAttribute("Id") || "").replace("NFe", ""),
      dtDoc,
      dtES: dtDoc,
      vlDoc: toNumber(getText(ICMSTot, "vNF")),
      indPgto: getText(ide, "indPag") || "0",
      vlDesc: toNumber(getText(ICMSTot, "vDesc")),
      vlAbatNt: 0,
      vlMerc: toNumber(getText(ICMSTot, "vProd")),
      indFrt: getText(doc.getElementsByTagName("transp")[0], "modFrete") || "9",
      vlFrt: toNumber(getText(ICMSTot, "vFrete")),
      vlSeg: toNumber(getText(ICMSTot, "vSeg")),
      vlOutDa: toNumber(getText(ICMSTot, "vOutro")),
      vlBcIcms: toNumber(getText(ICMSTot, "vBC")),
      vlIcms: toNumber(getText(ICMSTot, "vICMS")),
      vlBcIcmsSt: toNumber(getText(ICMSTot, "vBCST")),
      vlIcmsSt: toNumber(getText(ICMSTot, "vST")),
      vlIpi: toNumber(getText(ICMSTot, "vIPI")),
      vlPis: toNumber(getText(ICMSTot, "vPIS")),
      vlCofins: toNumber(getText(ICMSTot, "vCOFINS")),
      vlPisSt: 0,
      vlCofinsSt: 0,
    };

    const dets = Array.from(infNFe.getElementsByTagName("det"));
    const c170: SpedC170Data[] = dets.map((det, index) => {
      const prod = det.getElementsByTagName("prod")[0];
      const imposto = det.getElementsByTagName("imposto")[0];

      const icms = imposto.getElementsByTagName("ICMS")[0];
      const icmsChild = icms?.children[0];

      const ipi = imposto.getElementsByTagName("IPI")[0];
      const ipiTrib = ipi?.getElementsByTagName("IPITrib")[0];

      const pis = imposto.getElementsByTagName("PIS")[0];
      const pisChild = pis?.children[0];

      const cofins = imposto.getElementsByTagName("COFINS")[0];
      const cofinsChild = cofins?.children[0];

      return {
        numItem: index + 1,
        codItem: getText(prod, "cProd") || "",
        descrCompl: getText(prod, "xProd") || "",
        qtd: toNumber(getText(prod, "qCom")),
        unid: getText(prod, "uCom") || "",
        vlItem: toNumber(getText(prod, "vProd")),
        vlDesc: toNumber(getText(prod, "vDesc")),
        indMov: "0",
        cstIcms: getText(icmsChild, "CST") || getText(icmsChild, "CSOSN") || "",
        cfop: getText(prod, "CFOP") || "",
        codNat: "",
        vlBcIcms: toNumber(getText(icmsChild, "vBC")),
        aliqIcms: toNumber(getText(icmsChild, "pICMS")),
        vlIcms: toNumber(getText(icmsChild, "vICMS")),
        vlBcIcmsSt: toNumber(getText(icmsChild, "vBCST")),
        aliqIcmsSt: toNumber(getText(icmsChild, "pICMSST")),
        vlIcmsSt: toNumber(getText(icmsChild, "vICMSST")),
        indApur: "0",
        cstIpi: getText(ipiTrib, "CST") || "",
        codEnq: getText(ipi, "cEnq") || "",
        vlBcIpi: toNumber(getText(ipiTrib, "vBC")),
        aliqIpi: toNumber(getText(ipiTrib, "pIPI")),
        vlIpi: toNumber(getText(ipiTrib, "vIPI")),
        cstPis: getText(pisChild, "CST") || "",
        vlBcPis: toNumber(getText(pisChild, "vBC")),
        aliqPis: toNumber(getText(pisChild, "pPIS")),
        quantBcPis: toNumber(getText(pisChild, "qBCProd")),
        aliqPisReais: toNumber(getText(pisChild, "vAliqProd")),
        vlPis: toNumber(getText(pisChild, "vPIS")),
        cstCofins: getText(cofinsChild, "CST") || "",
        vlBcCofins: toNumber(getText(cofinsChild, "vBC")),
        aliqCofins: toNumber(getText(cofinsChild, "pCOFINS")),
        quantBcCofins: toNumber(getText(cofinsChild, "qBCProd")),
        aliqCofinsReais: toNumber(getText(cofinsChild, "vAliqProd")),
        vlCofins: toNumber(getText(cofinsChild, "vCOFINS")),
        codCta: "",
        vlAbatNt: 0,
      };
    });

    return { c100, c170 };
  } catch (e) {
    console.error("Error parsing XML for SPED", e);
    return null;
  }
}
