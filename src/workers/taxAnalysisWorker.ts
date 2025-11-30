interface TaxStat {
  totalDebito: number;
  totalCredito: number;
  byCfop: Record<string, { debito: number; credito: number }>;
}

interface TaxStats {
  icms: TaxStat;
  ipi: TaxStat;
  pis: TaxStat;
  cofins: TaxStat;
}

interface WorkerInput {
  docs: { id: string; date?: string | null; type: "0" | "1" }[];
  itemsC190: {
    documentId: string;
    cfop: string;
    valorIcms: number;
    valorIpi: number;
  }[];
  itemsC170: {
    documentId: string;
    cfop: string;
    valorPis: number;
    valorCofins: number;
  }[];
}

self.onmessage = (e: MessageEvent) => {
  const { docs, itemsC190, itemsC170 } = e.data as WorkerInput;

  try {
    const docMap = new Map<string, { date?: string | null; type: "0" | "1" }>();

    docs.forEach((d) => {
      docMap.set(d.id, { date: d.date, type: d.type });
    });

    const taxStats: TaxStats = {
      icms: { totalDebito: 0, totalCredito: 0, byCfop: {} },
      ipi: { totalDebito: 0, totalCredito: 0, byCfop: {} },
      pis: { totalDebito: 0, totalCredito: 0, byCfop: {} },
      cofins: { totalDebito: 0, totalCredito: 0, byCfop: {} },
    };

    const addToStats = (
      taxType: keyof TaxStats,
      type: "0" | "1",
      cfop: string,
      value?: number
    ) => {
      if (!value) return;
      const target = taxStats[taxType];
      if (type === "0") target.totalCredito += value;
      else if (type === "1") target.totalDebito += value;

      if (!target.byCfop[cfop]) target.byCfop[cfop] = { debito: 0, credito: 0 };
      if (type === "0") target.byCfop[cfop].credito += value;
      else target.byCfop[cfop].debito += value;
    };

    itemsC190.forEach((item) => {
      const doc = docMap.get(item.documentId);
      if (!doc) return;
      addToStats("icms", doc.type, item.cfop, item.valorIcms);
      addToStats("ipi", doc.type, item.cfop, item.valorIpi);
    });

    itemsC170.forEach((item) => {
      const doc = docMap.get(item.documentId);
      if (!doc) return;
      addToStats("pis", doc.type, item.cfop || "0000", item.valorPis);
      addToStats("cofins", doc.type, item.cfop || "0000", item.valorCofins);
    });

    const formatChartData = (taxData: TaxStat) => {
      const cfops = Object.keys(taxData.byCfop)
        .map((cfop) => ({
          cfop,
          debito: taxData.byCfop[cfop].debito,
          credito: taxData.byCfop[cfop].credito,
          total: taxData.byCfop[cfop].debito + taxData.byCfop[cfop].credito,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        totalDebito: taxData.totalDebito,
        totalCredito: taxData.totalCredito,
        topCfops: cfops,
      };
    };

    const result = {
      icms: formatChartData(taxStats.icms),
      ipi: formatChartData(taxStats.ipi),
      pis: formatChartData(taxStats.pis),
      cofins: formatChartData(taxStats.cofins),
    };

    self.postMessage(result);
  } catch (error: any) {
    console.error("Tax Analysis Error", error);
    self.postMessage({ error: error.message });
  }
};
