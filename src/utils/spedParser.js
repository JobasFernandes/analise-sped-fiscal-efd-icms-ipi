import { format, parse } from 'date-fns';
import { getDescricaoCfop, getTipoCfop } from './cfopService';

/**
 * Parser para arquivos SPED fiscal
 * Extrai informações de entradas e saídas por dia e CFOP dos registros C100 e C190
 */
export class SpedParser {
  constructor() {
    this.data = {
      // Dados originais
      entradas: [],
      saidas: [],
      
      // Dados consolidados por dia
      entradasPorDia: new Map(),
      saidasPorDia: new Map(),
      
      // Dados consolidados por CFOP
      entradasPorCfop: new Map(),
      saidasPorCfop: new Map(),
      
      // Dados consolidados por dia e CFOP
      entradasPorDiaCfop: new Map(),
      saidasPorDiaCfop: new Map(),
      
      // Totais
      totalEntradas: 0,
      totalSaidas: 0,
      totalGeral: 0,
      
      // Período
      periodo: {
        inicio: null,
        fim: null
      }
    };
  }

  /**
   * Processa o conteúdo do arquivo SPED
   * @param {string} fileContent - Conteúdo do arquivo SPED
   * @returns {Object} Dados processados
   */
  parse(fileContent) {
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    // Reinicia os dados
    this.resetData();
    
    let currentNota = null;
    
    for (const line of lines) {
      const registro = this.parseRegistro(line);
      
      if (registro.tipo === 'C100') {
        currentNota = this.processC100(registro);
      } else if (registro.tipo === 'C190' && currentNota) {
        this.processC190(registro, currentNota);
      }
    }
    
    // Processa os dados finais
    this.processarDadosFinais();
    
    return this.data;
  }

  /**
   * Reinicia os dados para um novo parsing
   */
  resetData() {
    this.data = {
      // Dados originais
      entradas: [],
      saidas: [],
      
      // Dados consolidados por dia
      entradasPorDia: new Map(),
      saidasPorDia: new Map(),
      
      // Dados consolidados por CFOP
      entradasPorCfop: new Map(),
      saidasPorCfop: new Map(),
      
      // Dados consolidados por dia e CFOP
      entradasPorDiaCfop: new Map(),
      saidasPorDiaCfop: new Map(),
      
      // Totais
      totalEntradas: 0,
      totalSaidas: 0,
      totalGeral: 0,
      
      // Período
      periodo: {
        inicio: null,
        fim: null
      }
    };
  }

  /**
   * Faz o parse de uma linha do arquivo SPED
   * @param {string} line - Linha do arquivo
   * @returns {Object} Objeto com dados do registro
   */
  parseRegistro(line) {
    const campos = line.split('|').filter((_, index) => index > 0 && index < line.split('|').length - 1);
    
    if (campos.length === 0) return { tipo: null };
    
    const tipo = campos[0];
    
    return {
      tipo,
      campos,
      linha: line
    };
  }

  /**
   * Processa registro C100 (Nota Fiscal)
   * @param {Object} registro - Dados do registro
   * @returns {Object} Dados da nota fiscal
   */
  processC100(registro) {
    const campos = registro.campos;
    
    // Campos do registro C100 conforme layout SPED:
    // [0] = REG, [1] = IND_OPER, [2] = IND_EMIT, [3] = COD_PART, [4] = COD_MOD, 
    // [5] = COD_SIT, [6] = SER, [7] = NUM_DOC, [8] = CHV_NFE, [9] = DT_DOC, 
    // [10] = DT_E_S, [11] = VL_DOC, [12] = IND_PGTO, [13] = VL_DESC, [14] = VL_ABAT_NT,
    // [15] = VL_MERC, [16] = IND_FRT, [17] = VL_FRT, [18] = VL_SEG, [19] = VL_OUT_DA,
    // [20] = VL_BC_ICMS, [21] = VL_ICMS, [22] = VL_BC_ICMS_ST, [23] = VL_ICMS_ST,
    // [24] = VL_IPI, [25] = VL_PIS, [26] = VL_COFINS, [27] = VL_PIS_ST, [28] = VL_COFINS_ST
    
    if (campos.length < 12) return null;
    
    const dataDoc = this.parseDate(campos[9]);
    const dataES = this.parseDate(campos[10]);
    const valorDoc = this.parseValor(campos[11]);
    const valorMerc = this.parseValor(campos[15]);
    const indicadorOperacao = campos[1]; // 0=Entrada, 1=Saída
    const situacao = campos[5];
    
    const nota = {
      numeroDoc: campos[7],
      chaveNfe: campos[8],
      dataDocumento: dataDoc,
      dataEntradaSaida: dataES,
      valorDocumento: valorDoc,
      valorMercadoria: valorMerc,
      indicadorOperacao,
      situacao,
      itens: []
    };
    
    // Processa tanto entradas quanto saídas com valor > 0 e situação normal
    if (valorDoc > 0 && situacao === '00') {
      if (indicadorOperacao === '0') {
        // Entrada
        this.data.entradas.push(nota);
      } else if (indicadorOperacao === '1') {
        // Saída
        this.data.saidas.push(nota);
      }
      
      // Atualiza período
      if (dataDoc) {
        if (!this.data.periodo.inicio || dataDoc < this.data.periodo.inicio) {
          this.data.periodo.inicio = dataDoc;
        }
        if (!this.data.periodo.fim || dataDoc > this.data.periodo.fim) {
          this.data.periodo.fim = dataDoc;
        }
      }
    }
    
    return nota;
  }

  /**
   * Processa registro C190 (Resumo dos itens por CFOP)
   * @param {Object} registro - Dados do registro
   * @param {Object} nota - Nota fiscal atual
   */
  processC190(registro, nota) {
    const campos = registro.campos;
    
    // Campos do registro C190:
    // [0] = REG, [1] = CST_ICMS, [2] = CFOP, [3] = ALIQ_ICMS, [4] = VL_OPR,
    // [5] = VL_BC_ICMS, [6] = VL_ICMS, [7] = VL_BC_ICMS_ST, [8] = VL_ICMS_ST,
    // [9] = VL_RED_BC, [10] = VL_IPI, [11] = COD_OBS
    
    if (campos.length < 5) return;
    
    const cfop = campos[2];
    const valorOperacao = this.parseValor(campos[4]);
    
    if (valorOperacao > 0 && nota.situacao === '00') {
      const item = {
        cfop,
        valorOperacao,
        cstIcms: campos[1],
        aliqIcms: this.parseValor(campos[3]),
        valorBcIcms: this.parseValor(campos[5]),
        valorIcms: this.parseValor(campos[6])
      };
      
      nota.itens.push(item);
      
      // Acumula dados
      const dataKey = this.formatDateKey(nota.dataDocumento);
      if (dataKey) {
        if (nota.indicadorOperacao === '0') {
          // Entrada
          this.acumularEntradaPorDia(dataKey, valorOperacao);
          this.acumularEntradaPorCfop(cfop, valorOperacao);
          this.acumularEntradaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalEntradas += valorOperacao;
        } else if (nota.indicadorOperacao === '1') {
          // Saída
          this.acumularSaidaPorDia(dataKey, valorOperacao);
          this.acumularSaidaPorCfop(cfop, valorOperacao);
          this.acumularSaidaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalSaidas += valorOperacao;
        }
      }
      
      this.data.totalGeral += valorOperacao;
    }
  }

  /**
   * Converte string de data do formato DDMMAAAA para Date
   * @param {string} dateStr - Data no formato DDMMAAAA
   * @returns {Date|null} Objeto Date ou null se inválido
   */
  parseDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    
    try {
      return parse(dateStr, 'ddMMyyyy', new Date());
    } catch (error) {
      console.warn(`Data inválida: ${dateStr}`);
      return null;
    }
  }

  /**
   * Converte string de valor para número
   * @param {string} valorStr - Valor como string
   * @returns {number} Valor numérico
   */
  parseValor(valorStr) {
    if (!valorStr) return 0;
    
    // Remove espaços e converte vírgula para ponto
    const cleanValue = valorStr.replace(/\s/g, '').replace(',', '.');
    const valor = parseFloat(cleanValue);
    
    return isNaN(valor) ? 0 : valor;
  }

  /**
   * Formata data para chave (YYYY-MM-DD)
   * @param {Date} date - Data
   * @returns {string|null} Data formatada ou null
   */
  formatDateKey(date) {
    if (!date) return null;
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Acumula entradas por dia
   * @param {string} dataKey - Chave da data
   * @param {number} valor - Valor da entrada
   */
  acumularEntradaPorDia(dataKey, valor) {
    if (!this.data.entradasPorDia.has(dataKey)) {
      this.data.entradasPorDia.set(dataKey, 0);
    }
    this.data.entradasPorDia.set(dataKey, this.data.entradasPorDia.get(dataKey) + valor);
  }

  /**
   * Acumula saídas por dia
   * @param {string} dataKey - Chave da data
   * @param {number} valor - Valor da saída
   */
  acumularSaidaPorDia(dataKey, valor) {
    if (!this.data.saidasPorDia.has(dataKey)) {
      this.data.saidasPorDia.set(dataKey, 0);
    }
    this.data.saidasPorDia.set(dataKey, this.data.saidasPorDia.get(dataKey) + valor);
  }

  /**
   * Acumula entradas por CFOP
   * @param {string} cfop - Código CFOP
   * @param {number} valor - Valor da entrada
   */
  acumularEntradaPorCfop(cfop, valor) {
    if (!this.data.entradasPorCfop.has(cfop)) {
      this.data.entradasPorCfop.set(cfop, 0);
    }
    this.data.entradasPorCfop.set(cfop, this.data.entradasPorCfop.get(cfop) + valor);
  }

  /**
   * Acumula saídas por CFOP
   * @param {string} cfop - Código CFOP
   * @param {number} valor - Valor da saída
   */
  acumularSaidaPorCfop(cfop, valor) {
    if (!this.data.saidasPorCfop.has(cfop)) {
      this.data.saidasPorCfop.set(cfop, 0);
    }
    this.data.saidasPorCfop.set(cfop, this.data.saidasPorCfop.get(cfop) + valor);
  }

  /**
   * Acumula entradas por dia e CFOP
   * @param {string} dataKey - Chave da data
   * @param {string} cfop - Código CFOP
   * @param {number} valor - Valor da entrada
   */
  acumularEntradaPorDiaCfop(dataKey, cfop, valor) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.entradasPorDiaCfop.has(key)) {
      this.data.entradasPorDiaCfop.set(key, {
        data: dataKey,
        cfop,
        valor: 0
      });
    }
    const item = this.data.entradasPorDiaCfop.get(key);
    item.valor += valor;
  }

  /**
   * Acumula saídas por dia e CFOP
   * @param {string} dataKey - Chave da data
   * @param {string} cfop - Código CFOP
   * @param {number} valor - Valor da saída
   */
  acumularSaidaPorDiaCfop(dataKey, cfop, valor) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.saidasPorDiaCfop.has(key)) {
      this.data.saidasPorDiaCfop.set(key, {
        data: dataKey,
        cfop,
        valor: 0
      });
    }
    const item = this.data.saidasPorDiaCfop.get(key);
    item.valor += valor;
  }

  /**
   * Processa dados finais para facilitar visualização
   */
  processarDadosFinais() {
    // Converte Maps para Arrays ordenados - ENTRADAS
    this.data.entradasPorDiaArray = Array.from(this.data.entradasPorDia.entries())
      .map(([data, valor]) => ({ data, valor }))
      .sort((a, b) => a.data.localeCompare(b.data));

    this.data.entradasPorCfopArray = Array.from(this.data.entradasPorCfop.entries())
      .map(([cfop, valor]) => ({ cfop, valor, descricao: getDescricaoCfop(cfop) }))
      .sort((a, b) => b.valor - a.valor);

    this.data.entradasPorDiaCfopArray = Array.from(this.data.entradasPorDiaCfop.values())
      .sort((a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));

    // Converte Maps para Arrays ordenados - SAÍDAS
    this.data.saidasPorDiaArray = Array.from(this.data.saidasPorDia.entries())
      .map(([data, valor]) => ({ data, valor }))
      .sort((a, b) => a.data.localeCompare(b.data));

    this.data.saidasPorCfopArray = Array.from(this.data.saidasPorCfop.entries())
      .map(([cfop, valor]) => ({ cfop, valor, descricao: getDescricaoCfop(cfop) }))
      .sort((a, b) => b.valor - a.valor);

    this.data.saidasPorDiaCfopArray = Array.from(this.data.saidasPorDiaCfop.values())
      .sort((a, b) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));

    // Mantém compatibilidade com o código anterior (vendas = saídas)
    this.data.vendas = this.data.saidas;
    this.data.vendasPorDia = this.data.saidasPorDia;
    this.data.vendasPorCfop = this.data.saidasPorCfop;
    this.data.vendasPorDiaCfop = this.data.saidasPorDiaCfop;
    this.data.vendasPorDiaArray = this.data.saidasPorDiaArray;
    this.data.vendasPorCfopArray = this.data.saidasPorCfopArray;
    this.data.vendasPorDiaCfopArray = this.data.saidasPorDiaCfopArray;
  }
}

/**
 * Função helper para parsing rápido de arquivos SPED
 * @param {string} fileContent - Conteúdo do arquivo
 * @returns {Object} Dados processados
 */
export function parseSpedFile(fileContent) {
  const parser = new SpedParser();
  return parser.parse(fileContent);
} 