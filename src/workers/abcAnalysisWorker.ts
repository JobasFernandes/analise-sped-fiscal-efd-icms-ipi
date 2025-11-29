export interface AbcInput {
  items: {
    codItem: string;
    valor: number;
    quantidade?: number;
    descricao?: string;
  }[];
}

export interface AbcResult {
  codItem: string;
  descricao?: string;
  valorTotal: number;
  percentual: number;
  acumulado: number;
  classe: "A" | "B" | "C";
}

self.onmessage = (e: MessageEvent<AbcInput>) => {
  const { items } = e.data;
  const map = new Map<string, { valor: number; qtd: number; desc?: string }>();

  // Aggregate
  for (const item of items) {
    if (!item.codItem) continue;
    const current = map.get(item.codItem) || { valor: 0, qtd: 0, desc: item.descricao };
    current.valor += item.valor || 0;
    current.qtd += item.quantidade || 0;
    if (!current.desc && item.descricao) current.desc = item.descricao;
    map.set(item.codItem, current);
  }

  // Sort by Value Descending
  const sorted = Array.from(map.entries())
    .map(([cod, data]) => ({
      codItem: cod,
      descricao: data.desc,
      valorTotal: data.valor,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const totalGeral = sorted.reduce((acc, item) => acc + item.valorTotal, 0);

  // Calculate ABC
  let acumulado = 0;
  const result: AbcResult[] = sorted.map((item) => {
    const percentual = totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0;
    acumulado += percentual;
    let classe: "A" | "B" | "C" = "C";

    // Adjust class boundaries slightly to handle edge cases
    if (acumulado <= 80.0001) classe = "A";
    else if (acumulado <= 95.0001) classe = "B";

    return {
      ...item,
      percentual,
      acumulado,
      classe,
    };
  });

  self.postMessage(result);
};
