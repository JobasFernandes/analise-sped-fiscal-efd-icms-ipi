export interface OrphanAnalysisInput {
  spedEntries: {
    chaveNfe: string;
    numeroDoc: string;
    dataDocumento: string;
    indicadorOperacao: string; // "0" | "1"
    valorDocumento: number;
  }[];
  xmlEntries: {
    chave: string;
    numero: string;
    dataEmissao: string;
    tpNF: string; // "0" | "1"
    valorTotalProduto: number;
  }[];
}

export interface OrphanAnalysisResult {
  xmlsSemSped: any[];
  spedSemXml: any[];
}

self.onmessage = (e: MessageEvent<OrphanAnalysisInput>) => {
  const { spedEntries, xmlEntries } = e.data;

  const spedKeys = new Set(spedEntries.map((s) => s.chaveNfe));
  const xmlKeys = new Set(xmlEntries.map((x) => x.chave));

  const xmlsSemSped = xmlEntries.filter((x) => !spedKeys.has(x.chave));
  const spedSemXml = spedEntries.filter((s) => s.chaveNfe && !xmlKeys.has(s.chaveNfe));

  self.postMessage({ xmlsSemSped, spedSemXml });
};
