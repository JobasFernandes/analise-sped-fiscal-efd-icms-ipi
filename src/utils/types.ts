export type IndicadorOperacao = "0" | "1";

export interface NotaItem {
  cfop: string;
  valorOperacao: number;
  cstIcms: string;
  aliqIcms: number;
  valorBcIcms: number;
  valorIcms: number;
  valorIpi?: number;
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
  valorIpi?: number;
  valorPis?: number;
  valorCofins?: number;
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
  tpNF?: string;
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
  numero?: string;
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

// =====================================================
// TIPOS PARA MOVIMENTAÇÃO DE COMBUSTÍVEIS (Bloco 1)
// =====================================================

/**
 * Registro 1300 - Movimentação Diária de Combustíveis (por produto)
 * Campos: COD_ITEM | DT_MOV | QTD_INI | QTD_ENTR | QTD_DISPONIVEL | QTD_VENDAS | QTD_FIM_FISICO | QTD_PERDA | QTD_SOBRA | QTD_FIM_CONTABIL
 */
export interface MovimentacaoCombustivel1300 {
  codItem: string; // Código do produto combustível (ex: 740 = Diesel S10)
  dtMov: string; // Data da movimentação (ISO yyyy-MM-dd)
  qtdIni: number; // Quantidade inicial (litros)
  qtdEntr: number; // Quantidade de entrada (compras/recebimentos)
  qtdDisponivel: number; // Total disponível (INI + ENTR)
  qtdVendas: number; // Quantidade vendida
  qtdFimFisico: number; // Estoque físico final (medição)
  qtdPerda: number; // Perdas declaradas
  qtdSobra: number; // Sobras declaradas
  qtdFimContabil: number; // Estoque contábil final
}

/**
 * Registro 1310 - Movimentação Diária por Tanque
 * Mesmos campos de quantidade do 1300, mas por tanque específico
 */
export interface MovimentacaoTanque1310 {
  codItem: string; // Código do combustível (herdado do 1300 pai)
  dtMov: string; // Data da movimentação (herdado do 1300 pai)
  numTanque: string; // Número/identificador do tanque
  qtdIni: number;
  qtdEntr: number;
  qtdDisponivel: number;
  qtdVendas: number;
  qtdFimFisico: number;
  qtdPerda: number;
  qtdSobra: number;
  qtdFimContabil: number;
}

/**
 * Registro 1320 - Volume de Vendas por Bico (Encerrante)
 * Registra leituras de encerrante por bico de bomba
 */
export interface VolumeVendasBico1320 {
  codItem: string; // Código do combustível (herdado do 1300 pai)
  dtMov: string; // Data da movimentação (herdado do 1300 pai)
  numTanque: string; // Número do tanque (herdado do 1310 pai)
  numBico: string; // Número do bico
  numInterv: string; // Número de intervenção
  motInterv: string; // Motivo da intervenção
  nomInterv: string; // Nome do interventor
  encerranteIni: number; // Leitura inicial do encerrante
  encerranteFim: number; // Leitura final do encerrante
  qtdAfericao: number; // Quantidade de aferição
  qtdVendas: number; // Volume vendido pelo bico
}

/**
 * Tipo de inconsistência encontrada
 */
export type TipoInconsistenciaCombustivel =
  | "ESTOQUE_MAIOR_SEM_ENTRADA" // Estoque final > inicial sem NF de entrada
  | "PERDA_ACIMA_LIMITE" // Perda acima do limite legal (0.6% diesel, 1% gasolina)
  | "SOBRA_ACIMA_LIMITE" // Sobra acima do limite aceitável
  | "DIVERGENCIA_TANQUES" // Soma dos tanques ≠ total do produto
  | "DIVERGENCIA_BICOS" // Soma das vendas por bico ≠ vendas do tanque
  | "DIVERGENCIA_DOCUMENTOS" // Vendas declaradas ≠ soma NFC-e/NF-e
  | "ENTRADA_SEM_DOCUMENTO" // Entrada declarada sem NF-e correspondente
  | "ESTOQUE_NEGATIVO" // Estoque ficou negativo em algum momento
  | "VARIACAO_ANOMALA"; // Variação fora do padrão histórico

/**
 * Severidade da inconsistência
 */
export type SeveridadeInconsistencia = "INFO" | "AVISO" | "CRITICO";

/**
 * Inconsistência detectada na movimentação de combustíveis
 */
export interface InconsistenciaCombustivel {
  id?: string; // UUID
  spedId: number; // FK para o arquivo SPED
  tipo: TipoInconsistenciaCombustivel;
  severidade: SeveridadeInconsistencia;
  codItem: string;
  descricaoProduto?: string;
  dtMov: string; // Data da movimentação
  numTanque?: string; // Se aplicável
  numBico?: string; // Se aplicável
  valorEsperado: number;
  valorEncontrado: number;
  diferenca: number;
  percentualDiferenca: number;
  descricao: string; // Descrição legível da inconsistência
  documentosRelacionados?: string[]; // Chaves de NF-e/NFC-e relacionadas
  detectedAt: string; // ISO timestamp
}

/**
 * Resumo de movimentação por combustível agregado de todos os tanques
 */
export interface ResumoMovimentacaoCombustivel {
  codItem: string;
  descricaoProduto?: string;
  dtMov: string;
  tanques: MovimentacaoTanque1310[];
  // Totais agregados de todos os tanques
  totalQtdIni: number;
  totalQtdEntr: number;
  totalQtdDisponivel: number;
  totalQtdVendas: number;
  totalQtdFimFisico: number;
  totalQtdPerda: number;
  totalQtdSobra: number;
  totalQtdFimContabil: number;
  // Métricas calculadas
  percentualPerda: number;
  percentualSobra: number;
  diferencaFisicoContabil: number;
}

/**
 * Comparativo de vendas: SPED 1300 vs Documentos Fiscais
 */
export interface ComparativoVendasCombustivel {
  codItem: string;
  descricaoProduto?: string;
  dtMov: string;
  vendasSped: number; // Total vendas declarado no 1300
  vendasNfce: number; // Total vendas em NFC-e (CFOPs 5xxx)
  vendasNfe: number; // Total vendas em NF-e (CFOPs 5xxx/6xxx)
  totalDocumentos: number; // vendasNfce + vendasNfe
  diferenca: number; // vendasSped - totalDocumentos
  percentualDiferenca: number;
  documentosVenda: Array<{
    chave: string;
    numero: string;
    tipo: "NFE" | "NFCE";
    valor: number;
    quantidade: number;
  }>;
}
