export type IndicadorOperacao = "0" | "1";

export interface NotaItem {
  cfop: string;
  valorOperacao: number;
  cstIcms: string;
  aliqIcms: number;
  valorBcIcms: number;
  valorIcms: number;
}

export interface NotaItemC170 {
  numItem?: number;
  codItem?: string;
  descrCompl?: string;
  quantidade?: number;
  unidade?: string;
  valorItem?: number;
  valorDesconto?: number;
  cfop?: string;
  cstIcms?: string;
  aliqIcms?: number;
  valorBcIcms?: number;
  valorIcms?: number;
}

export interface Nota {
  numeroDoc: string;
  chaveNfe: string;
  dataDocumento: Date | null;
  dataEntradaSaida: Date | null;
  valorDocumento: number;
  valorMercadoria: number;
  indicadorOperacao: IndicadorOperacao;
  situacao: string;
  itens: NotaItem[];
  itensC170?: NotaItemC170[];
}

export interface Periodo {
  inicio: Date | string | null;
  fim: Date | string | null;
}

export interface DiaValor {
  data: string;
  valor: number;
}

export interface CfopValor {
  cfop: string;
  valor: number;
  descricao?: string;
}

export interface DiaCfopValor {
  data: string;
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
  entradasPorDiaArray?: DiaValor[];
  saidasPorDiaArray?: DiaValor[];
  entradasPorCfopArray?: CfopValor[];
  saidasPorCfopArray?: CfopValor[];
  entradasPorDiaCfopArray?: DiaCfopValor[];
  saidasPorDiaCfopArray?: DiaCfopValor[];
  itensPorCfopIndex?: Record<string, ItemDetalhado[]>;
  totalEntradas: number;
  totalSaidas: number;
  totalGeral: number;
  periodo: Periodo;
  vendas?: Nota[];
  vendasPorDia?: Map<string, number> | undefined;
  vendasPorCfop?: Map<string, number> | undefined;
  vendasPorDiaArray?: DiaValor[];
  vendasPorCfopArray?: CfopValor[];
  // Metadados do arquivo (registro 0000)
  companyName?: string;
  cnpj?: string;
}

export type FilteredProcessedData = Omit<
  ProcessedData,
  | "entradasPorDiaArray"
  | "saidasPorDiaArray"
  | "entradasPorDiaCfopArray"
  | "saidasPorDiaCfopArray"
  | "entradasPorCfopArray"
  | "saidasPorCfopArray"
  | "vendasPorDiaArray"
  | "vendasPorCfopArray"
> & {
  entradasPorDiaArray: DiaValor[];
  saidasPorDiaArray: DiaValor[];
  entradasPorDiaCfopArray: DiaCfopValor[];
  saidasPorDiaCfopArray: DiaCfopValor[];
  entradasPorCfopArray: CfopValor[];
  saidasPorCfopArray: CfopValor[];
  vendasPorDiaArray: DiaValor[];
  vendasPorCfopArray: CfopValor[];
};

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
