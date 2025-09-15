import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  ChartDataShape,
  BasicDataset,
  DiaValor,
  CfopValor,
  ProcessedData,
  ResumoExecutivo,
} from "./types";

export function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

export function formatarNumero(
  numero: number | null | undefined,
  decimais: number = 2
): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(numero || 0);
}

export function formatarData(
  data: string | Date | null | undefined,
  formato: string = "dd/MM/yyyy"
): string {
  if (!data) return "";
  try {
    const dataObj = typeof data === "string" ? parseISO(data) : data;
    return format(dataObj as Date, formato, { locale: ptBR });
  } catch (error) {
    console.warn("Erro ao formatar data:", data, error);
    return "";
  }
}

export function calcularEstatisticas(dados: Array<{ valor: number }>): {
  total: number;
  media: number;
  maximo: number;
  minimo: number;
  count: number;
} {
  if (!dados || dados.length === 0) {
    return { total: 0, media: 0, maximo: 0, minimo: 0, count: 0 };
  }
  const valores = dados.map((item) => item.valor || 0);
  const total = valores.reduce((acc, val) => acc + val, 0);
  const media = total / valores.length;
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  return { total, media, maximo, minimo, count: valores.length };
}

export function agruparPorPeriodo(
  vendasPorDia: DiaValor[],
  periodo: "dia" | "semana" | "mes" = "dia"
): Array<{ periodo: string; valor: number; count: number }> {
  if (!vendasPorDia || vendasPorDia.length === 0) return [];
  const grupos = new Map<
    string,
    { periodo: string; valor: number; count: number }
  >();
  vendasPorDia.forEach((venda) => {
    let chave: string;
    const data = parseISO(venda.data);
    switch (periodo) {
      case "semana":
        const inicioSemana = new Date(data);
        inicioSemana.setDate(data.getDate() - data.getDay());
        chave = format(inicioSemana, "yyyy-MM-dd");
        break;
      case "mes":
        chave = format(data, "yyyy-MM");
        break;
      case "dia":
      default:
        chave = venda.data;
        break;
    }
    if (!grupos.has(chave)) {
      grupos.set(chave, { periodo: chave, valor: 0, count: 0 });
    }
    const grupo = grupos.get(chave)!;
    grupo.valor += venda.valor;
    grupo.count += 1;
  });
  return Array.from(grupos.values()).sort((a, b) =>
    a.periodo.localeCompare(b.periodo)
  );
}

export function filtrarPorPeriodo(
  dados: Array<{ data?: string; periodo?: string }> ,
  dataInicio?: string,
  dataFim?: string
): Array<{ data?: string; periodo?: string }> {
  if (!dados || dados.length === 0) return [];
  if (!dataInicio && !dataFim) return dados;
  return dados.filter((item) => {
    const dataItem = (item as any).data || (item as any).periodo;
    if (!dataItem) return true;
    if (dataInicio && dataItem < dataInicio) return false;
    if (dataFim && dataItem > dataFim) return false;
    return true;
  });
}

export function gerarCores(quantidade: number): string[] {
  const cores = [
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#F97316",
    "#06B6D4",
    "#84CC16",
    "#EC4899",
    "#6B7280",
    "#14B8A6",
    "#F43F5E",
    "#8B5A2B",
    "#6366F1",
    "#D97706",
  ];
  const resultado: string[] = [];
  for (let i = 0; i < quantidade; i++) resultado.push(cores[i % cores.length]);
  return resultado;
}

export function gerarDataset(
  dados: Array<{ valor: number }>,
  label: string,
  tipo: "line" | "bar" | "pie" | "doughnut" = "bar"
): BasicDataset {
  const cores = gerarCores(dados.length);
  switch (tipo) {
    case "line":
      return {
        label,
        data: dados.map((i) => i.valor),
        borderColor: cores[0],
        backgroundColor: cores[0] + "20",
        tension: 0.1,
      };
    case "pie":
    case "doughnut":
      return {
        label,
        data: dados.map((i) => i.valor),
        backgroundColor: cores,
        borderColor: cores.map((c) => c + "CC"),
        borderWidth: 1,
      };
    case "bar":
    default:
      return {
        label,
        data: dados.map((i) => i.valor),
        backgroundColor: cores[0] + "80",
        borderColor: cores[0],
        borderWidth: 1,
      };
  }
}

export function prepararDadosVendasPorDia(
  vendasPorDia: DiaValor[]
): ChartDataShape {
  if (!vendasPorDia || vendasPorDia.length === 0)
    return { labels: [], datasets: [] };
  const labels = vendasPorDia.map((item) => formatarData(item.data, "dd/MM"));
  const dataset = gerarDataset(vendasPorDia, "Vendas", "line");
  return { labels, datasets: [dataset] };
}

export function prepararDadosVendasPorCfop(
  vendasPorCfop: Array<{ cfop: string; descricao: string; valor: number }>,
  limite: number = 10
): ChartDataShape {
  if (!vendasPorCfop || vendasPorCfop.length === 0)
    return { labels: [], datasets: [] };
  const topCfops = vendasPorCfop.slice(0, limite);
  const labels = topCfops.map(
    (item) => `${item.cfop}\n${item.descricao.substring(0, 30)}...`
  );
  const dataset = gerarDataset(topCfops, "Vendas por CFOP", "bar");
  return { labels, datasets: [dataset] };
}

export function prepararDadosDistribuicaoCfop(
  vendasPorCfop: Array<{ cfop: string; descricao?: string; valor: number }>,
  limite: number = 8
): ChartDataShape {
  if (!vendasPorCfop || vendasPorCfop.length === 0)
    return { labels: [], datasets: [] };
  let dados = [...vendasPorCfop];
  if (dados.length > limite) {
    const principais = dados.slice(0, limite - 1);
    const outros = dados.slice(limite - 1);
    const valorOutros = outros.reduce((acc, item) => acc + item.valor, 0);
    dados = [
      ...principais,
      { cfop: "OUTROS", valor: valorOutros, descricao: "Outros CFOPs" },
    ];
  }
  const labels = dados.map((item) => item.cfop);
  const dataset = gerarDataset(dados, "Distribuição por CFOP", "doughnut");
  return { labels, datasets: [dataset] };
}

export function calcularTendencia(dados: Array<{ valor: number }>) {
  if (!dados || dados.length < 2)
    return {
      tendencia: "neutro",
      percentual: 0,
      descricao: "Dados insuficientes",
    };
  const primeiro = dados[0].valor;
  const ultimo = dados[dados.length - 1].valor;
  const percentual =
    primeiro === 0 ? 0 : ((ultimo - primeiro) / primeiro) * 100;
  if (percentual > 5)
    return {
      tendencia: "crescimento",
      percentual,
      descricao: `Crescimento de ${formatarNumero(percentual, 1)}%`,
    };
  if (percentual < -5)
    return {
      tendencia: "queda",
      percentual,
      descricao: `Queda de ${formatarNumero(Math.abs(percentual), 1)}%`,
    };
  return { tendencia: "estavel", percentual, descricao: "Estável" };
}

export function prepararDadosEntradasPorDia(
  entradasPorDia: DiaValor[]
): ChartDataShape {
  if (!entradasPorDia || entradasPorDia.length === 0)
    return { labels: [], datasets: [] };
  const labels = entradasPorDia.map((item) => formatarData(item.data));
  const valores = entradasPorDia.map((item) => item.valor);
  return {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: valores,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        borderColor: "#10B981",
        borderWidth: 2,
        fill: false,
      },
    ],
  };
}

export function prepararDadosSaidasPorDia(
  saidasPorDia: DiaValor[]
): ChartDataShape {
  if (!saidasPorDia || saidasPorDia.length === 0)
    return { labels: [], datasets: [] };
  const labels = saidasPorDia.map((item) => formatarData(item.data));
  const valores = saidasPorDia.map((item) => item.valor);
  return {
    labels,
    datasets: [
      {
        label: "Saídas",
        data: valores,
        backgroundColor: "rgba(59, 130, 246, 0.7)",
        borderColor: "#3B82F6",
        borderWidth: 2,
        fill: false,
      },
    ],
  };
}

export function prepararDadosEntradasSaidasPorDia(
  entradasPorDia?: DiaValor[],
  saidasPorDia?: DiaValor[]
): ChartDataShape {
  const todasDatas = new Set<string>();
  if (entradasPorDia)
    entradasPorDia.forEach((item) => todasDatas.add(item.data));
  if (saidasPorDia) saidasPorDia.forEach((item) => todasDatas.add(item.data));
  const datasOrdenadas = Array.from(todasDatas).sort();
  if (datasOrdenadas.length === 0) return { labels: [], datasets: [] };
  const labels = datasOrdenadas.map((data) => formatarData(data));
  const entradasMap = new Map<string, number>();
  const saidasMap = new Map<string, number>();
  if (entradasPorDia)
    entradasPorDia.forEach((item) => entradasMap.set(item.data, item.valor));
  if (saidasPorDia)
    saidasPorDia.forEach((item) => saidasMap.set(item.data, item.valor));
  const valoresEntradas = datasOrdenadas.map(
    (data) => entradasMap.get(data) || 0
  );
  const valoresSaidas = datasOrdenadas.map((data) => saidasMap.get(data) || 0);
  return {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: valoresEntradas,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        borderColor: "#10B981",
        borderWidth: 2,
        fill: false,
      },
      {
        label: "Saídas",
        data: valoresSaidas,
        backgroundColor: "rgba(59, 130, 246, 0.7)",
        borderColor: "#3B82F6",
        borderWidth: 2,
        fill: false,
      },
    ],
  };
}

export function prepararDadosEntradasPorCfop(
  entradasPorCfop: Array<{ cfop: string; valor: number }>,
  limite: number = 10
): ChartDataShape {
  if (!entradasPorCfop || entradasPorCfop.length === 0)
    return { labels: [], datasets: [] };
  const dadosLimitados = entradasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map((item) => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map((item) => item.valor);
  return {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: valores,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        borderColor: "#10B981",
        borderWidth: 1,
      },
    ],
  };
}

export function prepararDadosDistribuicaoCfopEntrada(
  entradasPorCfop: Array<{ cfop: string; valor: number }>,
  limite: number = 8
): ChartDataShape {
  if (!entradasPorCfop || entradasPorCfop.length === 0)
    return { labels: [], datasets: [] };
  const dadosLimitados = entradasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map((item) => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map((item) => item.valor);
  const cores = gerarCores(dadosLimitados.length);
  return {
    labels,
    datasets: [
      {
        label: "Entradas",
        data: valores,
        backgroundColor: cores,
        borderColor: cores.map((cor) => cor.replace("0.7", "1")),
        borderWidth: 1,
      },
    ],
  };
}

export function prepararDadosDistribuicaoCfopSaida(
  saidasPorCfop: Array<{ cfop: string; valor: number }>,
  limite: number = 8
): ChartDataShape {
  if (!saidasPorCfop || saidasPorCfop.length === 0)
    return { labels: [], datasets: [] };
  const dadosLimitados = saidasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map((item) => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map((item) => item.valor);
  const cores = gerarCores(dadosLimitados.length);
  return {
    labels,
    datasets: [
      {
        label: "Saídas",
        data: valores,
        backgroundColor: cores,
        borderColor: cores.map((cor) => cor.replace("0.7", "1")),
        borderWidth: 1,
      },
    ],
  };
}

export function gerarResumoExecutivo(dadosProcessados: ProcessedData | null): ResumoExecutivo {
  if (!dadosProcessados) {
    return {
      totalVendas: 0,
      totalEntradas: 0,
      totalSaidas: 0,
      numeroNotas: 0,
      numeroNotasEntrada: 0,
      numeroNotasSaida: 0,
      ticketMedio: 0,
      cfopPrincipal: null,
      cfopPrincipalEntrada: null,
      cfopPrincipalSaida: null,
      periodoAnalise: null,
      tendencia: null,
    };
  }
  const {
    totalGeral,
    totalEntradas,
    totalSaidas,
    entradas,
    saidas,
    vendas,
    vendasPorDiaArray,
    saidasPorDiaArray,
    entradasPorDiaArray,
    vendasPorCfopArray,
    saidasPorCfopArray,
    entradasPorCfopArray,
    periodo,
  } = dadosProcessados;
  const numeroNotasEntrada = entradas ? entradas.length : 0;
  const numeroNotasSaida = saidas ? saidas.length : 0;
  const numeroNotas = vendas
    ? vendas.length
    : numeroNotasEntrada + numeroNotasSaida;
  const ticketMedio = numeroNotas > 0 ? (totalGeral || 0) / numeroNotas : 0;
  const cfopPrincipal =
    vendasPorCfopArray && vendasPorCfopArray.length > 0
      ? vendasPorCfopArray[0]
      : null;
  const cfopPrincipalEntrada =
    entradasPorCfopArray && entradasPorCfopArray.length > 0
      ? entradasPorCfopArray[0]
      : null;
  const cfopPrincipalSaida =
    saidasPorCfopArray && saidasPorCfopArray.length > 0
      ? saidasPorCfopArray[0]
      : null;
  const periodoAnalise =
    periodo && periodo.inicio && periodo.fim
      ? `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`
      : null;
  const tendencia = calcularTendencia(
    (vendasPorDiaArray as DiaValor[] | undefined) || (saidasPorDiaArray as DiaValor[] | undefined) || (entradasPorDiaArray as DiaValor[] | undefined) || []
  );
  return {
    totalVendas: totalGeral || 0,
    totalEntradas: totalEntradas || 0,
    totalSaidas: totalSaidas || 0,
    numeroNotas,
    numeroNotasEntrada,
    numeroNotasSaida,
    ticketMedio,
    cfopPrincipal,
    cfopPrincipalEntrada,
    cfopPrincipalSaida,
    periodoAnalise,
    tendencia,
  };
}

// Filtra e re-agrega os dados processados pelo parser dentro do período informado (strings yyyy-MM-dd)
export function filtrarDadosProcessadosPorPeriodo(
  dados: ProcessedData,
  dataInicio?: string,
  dataFim?: string
) {
  if (!dados || (!dataInicio && !dataFim)) return dados;

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    if (dataInicio && dateStr < dataInicio) return false;
    if (dataFim && dateStr > dataFim) return false;
    return true;
  };

  // Filtrar arrays por dia
  const entradasPorDiaArray = (dados.entradasPorDiaArray || []).filter(
    (d) => inRange(d.data)
  );
  const saidasPorDiaArray = (dados.saidasPorDiaArray || []).filter((d) =>
    inRange(d.data)
  );

  // Filtrar arrays dia+cfop
  const entradasPorDiaCfopArray = (dados.entradasPorDiaCfopArray || []).filter(
    (d) => inRange(d.data)
  );
  const saidasPorDiaCfopArray = (dados.saidasPorDiaCfopArray || []).filter(
    (d) => inRange(d.data)
  );

  // Re-agrupar CFOPs com base nas versões filtradas por dia
  const agruparCfop = (arr: Array<{ cfop: string; valor: number }>) => {
    const mapa = new Map<string, number>();
    for (const item of arr) {
      mapa.set(item.cfop, (mapa.get(item.cfop) || 0) + (item.valor || 0));
    }
    return Array.from(mapa.entries())
      .map(([cfop, valor]) => ({ cfop, valor }))
      .sort((a, b) => b.valor - a.valor);
  };

  const entradasPorCfopArray = agruparCfop(entradasPorDiaCfopArray);
  const saidasPorCfopArray = agruparCfop(saidasPorDiaCfopArray);

  // Filtrar notas por data de referência: usa dataEntradaSaida se existir, senão dataDocumento
  // Mantém notas sem data (não exclui) para evitar perdas de contagem quando o arquivo tem falhas
  const filtrarNotas = (notas: Array<{
    dataEntradaSaida?: Date | null;
    dataDocumento?: Date | null;
  }>) =>
    (notas || []).filter((n) => {
      const refDate: Date | null | undefined =
        n?.dataEntradaSaida || n?.dataDocumento;
      if (!refDate) return true; // não descarta notas sem data
      const ref = format(refDate, "yyyy-MM-dd");
      return inRange(ref);
    });

  const entradas = filtrarNotas(dados.entradas || []);
  const saidas = filtrarNotas(dados.saidas || []);
  const vendas = saidas; // alias

  // Totais
  const totalEntradas = entradasPorDiaArray.reduce(
    (acc: number, i: any) => acc + (i.valor || 0),
    0
  );
  const totalSaidas = saidasPorDiaArray.reduce(
    (acc: number, i: any) => acc + (i.valor || 0),
    0
  );
  const totalGeral = totalEntradas + totalSaidas;

  // Período efetivo
  const periodo = {
    inicio: dataInicio || dados.periodo?.inicio || null,
    fim: dataFim || dados.periodo?.fim || null,
  };

  return {
    ...dados,
    entradas,
    saidas,
    vendas,
    entradasPorDiaArray,
    saidasPorDiaArray,
    entradasPorDiaCfopArray,
    saidasPorDiaCfopArray,
    entradasPorCfopArray,
    saidasPorCfopArray,
    totalEntradas,
    totalSaidas,
    totalGeral,
    periodo,
    // Compat: aliases usados na UI original
    vendasPorDiaArray: saidasPorDiaArray,
    vendasPorCfopArray: saidasPorCfopArray,
  };
}
