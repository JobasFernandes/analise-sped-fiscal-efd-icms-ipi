export type IndicadorOperacao = "0" | "1"; // 0 = Entrada, 1 = Saída

export interface NotaItem {
  cfop: string;
  valorOperacao: number;
  cstIcms: string;
  aliqIcms: number;
  valorBcIcms: number;
  valorIcms: number;
}

export interface Nota {
  numeroDoc: string;
  chaveNfe: string;
  dataDocumento: Date | null;
  dataEntradaSaida: Date | null;
  valorDocumento: number;
  valorMercadoria: number;
  indicadorOperacao: IndicadorOperacao;
  situacao: string; // COD_SIT
  itens: NotaItem[];
}

export interface Periodo {
  // Mantemos Date | string para compatibilidade com filtros (yyyy-MM-dd)
  inicio: Date | string | null;
  fim: Date | string | null;
}

export interface DiaValor {
  data: string; // yyyy-MM-dd
  valor: number;
}

export interface CfopValor {
  cfop: string;
  valor: number;
  descricao?: string;
}

export interface DiaCfopValor {
  data: string; // yyyy-MM-dd
  cfop: string;
  valor: number;
}

export interface ItemDetalhado {
  cfop: string;
  valorOperacao: number;
  cstIcms: string;
  aliqIcms: number;
  valorBcIcms: number;
  valorIcms: number;
  numeroDoc: string;
  chaveNfe: string;
  dataDocumento: Date | null;
  dataEntradaSaida: Date | null;
  valorTotal?: number;
  situacao: string;
}

export interface ProcessedData {
  entradas: Nota[];
  saidas: Nota[];
  // Agregações como arrays já ordenadas
  entradasPorDiaArray?: DiaValor[];
  saidasPorDiaArray?: DiaValor[];
  entradasPorCfopArray?: CfopValor[];
  saidasPorCfopArray?: CfopValor[];
  entradasPorDiaCfopArray?: DiaCfopValor[];
  saidasPorDiaCfopArray?: DiaCfopValor[];
  // Índice serializado para abrir detalhes de CFOP instantaneamente
  itensPorCfopIndex?: Record<string, ItemDetalhado[]>;
  // Totais e período
  totalEntradas: number;
  totalSaidas: number;
  totalGeral: number;
  periodo: Periodo;
  // Compat/aliases usados em algumas partes da UI
  vendas?: Nota[]; // alias de saidas
  vendasPorDia?: Map<string, number> | undefined;
  vendasPorCfop?: Map<string, number> | undefined;
  vendasPorDiaArray?: DiaValor[];
  vendasPorCfopArray?: CfopValor[];
}

// Tipos simplificados de dataset para gráficos do Chart.js
export interface BasicDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  tension?: number;
  fill?: boolean;
}

export interface ChartDataShape {
  labels: string[];
  datasets: BasicDataset[];
}

export interface ResumoExecutivo {
  totalVendas: number;
  totalEntradas: number;
  totalSaidas: number;
  numeroNotas: number;
  numeroNotasEntrada: number;
  numeroNotasSaida: number;
  ticketMedio: number;
  cfopPrincipal: CfopValor | null;
  cfopPrincipalEntrada: CfopValor | null;
  cfopPrincipalSaida: CfopValor | null;
  periodoAnalise: string | null;
  tendencia: {
    tendencia: string;
    percentual: number;
    descricao: string;
  } | null;
}
