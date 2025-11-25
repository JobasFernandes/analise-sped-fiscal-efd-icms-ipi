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
  numeroNotasEntrada?: number;
  numeroNotasSaida?: number;

  // Novos blocos
  participantes?: Participante[];
  produtos?: Produto[];
  apuracaoICMS?: ApuracaoICMS[];
  inventario?: Inventario[];
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

export interface XmlItemResumo {
  cfop: string;
  vProd: number;
  qCom?: number;
  qBCMonoRet?: number;
  vICMSMonoRet?: number;
}

export interface XmlNotaResumo {
  chave: string;
  dhEmi: string;
  dhRecbto?: string;
  dataEmissao: string;
  modelo: string;
  serie: string;
  numero: string;
  cnpjEmit?: string;
  cnpjDest?: string;
  autorizada: boolean;
  valorTotalProduto: number;
  qBCMonoRetTotal?: number;
  vICMSMonoRetTotal?: number;
  itens: XmlItemResumo[];
}

export interface XmlAggDiaCfop {
  data: string;
  cfop: string;
  vProd: number;
  qBCMonoRet?: number;
  vICMSMonoRet?: number;
}

export interface XmlComparativoLinha {
  data: string;
  cfop: string;
  xmlVProd: number;
  spedValorOperacao: number;
  diffAbs: number;
  diffPerc: number;
}

export type DivergenciaLinhaTipo = "AMBOS" | "SOMENTE_XML" | "SOMENTE_SPED";
export interface DivergenciaNotaResumo {
  chave: string;
  valorXml?: number;
  valorSped?: number;
  diff?: number;
  tipo: DivergenciaLinhaTipo;
}
export interface DivergenciaDetalheResultado {
  data: string;
  cfop: string;
  totalXml: number;
  totalSped: number;
  diffAbs: number;
  notas: DivergenciaNotaResumo[];
}

export interface Participante {
  codPart: string;
  nome: string;
  cnpj?: string;
  cpf?: string;
  ie?: string;
  codMun?: string;
}

export interface Produto {
  codItem: string;
  descrItem: string;
  unidInv: string;
  tipoItem: string;
}

export interface ApuracaoICMS {
  dtIni: Date | null;
  dtFim: Date | null;
  vlTotDebitos: number;
  vlTotCreditos: number;
  vlSaldoDevedor: number;
  vlSaldoCredor: number;
}

export interface ItemInventario {
  codItem: string;
  qtd: number;
  vlUnit: number;
  vlItem: number;
  indProp: string;
}

export interface Inventario {
  dtInv: Date | null;
  vlInv: number;
  itens: ItemInventario[];
}

export interface RegistroSped {
  tipo: string | null;
  campos: string[];
  linha: string;
}
