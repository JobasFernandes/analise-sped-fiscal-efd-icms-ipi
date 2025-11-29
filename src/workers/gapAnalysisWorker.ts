export interface GapAnalysisInput {
  documents: {
    chave: string;
    data: string;
  }[];
}

export interface Gap {
  serie: string;
  modelo: string;
  inicio: number;
  fim: number;
  qtd: number;
}

self.onmessage = (e: MessageEvent<GapAnalysisInput>) => {
  const { documents } = e.data;
  const gaps: Gap[] = [];

  // Group by Model-Series
  const groups: Record<string, number[]> = {};

  documents.forEach((doc) => {
    if (!doc.chave || doc.chave.length !== 44) return;

    const modelo = doc.chave.substring(20, 22);
    const serie = doc.chave.substring(22, 25);
    const numero = parseInt(doc.chave.substring(25, 34), 10);

    const key = `${modelo}-${serie}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(numero);
  });

  // Analyze each group
  Object.entries(groups).forEach(([key, numeros]) => {
    const [modelo, serie] = key.split("-");

    // Sort unique numbers
    const sorted = [...new Set(numeros)].sort((a, b) => a - b);

    // Find gaps
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (next > current + 1) {
        gaps.push({
          serie,
          modelo,
          inicio: current + 1,
          fim: next - 1,
          qtd: next - 1 - (current + 1) + 1,
        });
      }
    }
  });

  self.postMessage(gaps);
};
