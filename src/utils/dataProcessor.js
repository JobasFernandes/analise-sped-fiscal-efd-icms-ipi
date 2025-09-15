import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Utilitários para processamento e formatação de dados do SPED
 */

/**
 * Formata valor monetário para exibição
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado em BRL
 */
export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

/**
 * Formata número para exibição
 * @param {number} numero - Número
 * @param {number} decimais - Número de casas decimais
 * @returns {string} Número formatado
 */
export function formatarNumero(numero, decimais = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  }).format(numero || 0);
}

/**
 * Formata data para exibição
 * @param {string|Date} data - Data
 * @param {string} formato - Formato da data
 * @returns {string} Data formatada
 */
export function formatarData(data, formato = 'dd/MM/yyyy') {
  if (!data) return '';
  
  try {
    const dataObj = typeof data === 'string' ? parseISO(data) : data;
    return format(dataObj, formato, { locale: ptBR });
  } catch (error) {
    console.warn('Erro ao formatar data:', data, error);
    return '';
  }
}

/**
 * Calcula estatísticas básicas dos dados
 * @param {Array} dados - Array de objetos com propriedade 'valor'
 * @returns {Object} Estatísticas calculadas
 */
export function calcularEstatisticas(dados) {
  if (!dados || dados.length === 0) {
    return {
      total: 0,
      media: 0,
      maximo: 0,
      minimo: 0,
      count: 0
    };
  }

  const valores = dados.map(item => item.valor || 0);
  const total = valores.reduce((acc, val) => acc + val, 0);
  const media = total / valores.length;
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);

  return {
    total,
    media,
    maximo,
    minimo,
    count: valores.length
  };
}

/**
 * Agrupa vendas por período (dia, semana, mês)
 * @param {Array} vendasPorDia - Array de vendas por dia
 * @param {string} periodo - Tipo de período ('dia', 'semana', 'mes')
 * @returns {Array} Dados agrupados por período
 */
export function agruparPorPeriodo(vendasPorDia, periodo = 'dia') {
  if (!vendasPorDia || vendasPorDia.length === 0) return [];

  const grupos = new Map();

  vendasPorDia.forEach(venda => {
    let chave;
    const data = parseISO(venda.data);

    switch (periodo) {
      case 'semana':
        // Primeira data da semana
        const inicioSemana = new Date(data);
        inicioSemana.setDate(data.getDate() - data.getDay());
        chave = format(inicioSemana, 'yyyy-MM-dd');
        break;
      
      case 'mes':
        chave = format(data, 'yyyy-MM');
        break;
      
      case 'dia':
      default:
        chave = venda.data;
        break;
    }

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        periodo: chave,
        valor: 0,
        count: 0
      });
    }

    const grupo = grupos.get(chave);
    grupo.valor += venda.valor;
    grupo.count += 1;
  });

  return Array.from(grupos.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/**
 * Filtra dados por período de datas
 * @param {Array} dados - Dados a serem filtrados
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @param {string} dataFim - Data de fim (YYYY-MM-DD)
 * @returns {Array} Dados filtrados
 */
export function filtrarPorPeriodo(dados, dataInicio, dataFim) {
  if (!dados || dados.length === 0) return [];
  if (!dataInicio && !dataFim) return dados;

  return dados.filter(item => {
    const dataItem = item.data || item.periodo;
    if (!dataItem) return true;

    if (dataInicio && dataItem < dataInicio) return false;
    if (dataFim && dataItem > dataFim) return false;

    return true;
  });
}

/**
 * Gera cores para gráficos
 * @param {number} quantidade - Número de cores necessárias
 * @returns {Array} Array de cores em hexadecimal
 */
export function gerarCores(quantidade) {
  const cores = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#14B8A6', // Teal
    '#F43F5E', // Rose
    '#8B5A2B', // Brown
    '#6366F1', // Indigo
    '#D97706'  // Amber
  ];

  const resultado = [];
  for (let i = 0; i < quantidade; i++) {
    resultado.push(cores[i % cores.length]);
  }

  return resultado;
}

/**
 * Gera dataset para Chart.js
 * @param {Array} dados - Dados para o gráfico
 * @param {string} label - Label do dataset
 * @param {string} tipo - Tipo de gráfico ('line', 'bar', 'pie', etc.)
 * @returns {Object} Dataset formatado para Chart.js
 */
export function gerarDataset(dados, label, tipo = 'bar') {
  const cores = gerarCores(dados.length);

  switch (tipo) {
    case 'line':
      return {
        label,
        data: dados.map(item => item.valor),
        borderColor: cores[0],
        backgroundColor: cores[0] + '20',
        tension: 0.1
      };

    case 'pie':
    case 'doughnut':
      return {
        label,
        data: dados.map(item => item.valor),
        backgroundColor: cores,
        borderColor: cores.map(cor => cor + 'CC'),
        borderWidth: 1
      };

    case 'bar':
    default:
      return {
        label,
        data: dados.map(item => item.valor),
        backgroundColor: cores[0] + '80',
        borderColor: cores[0],
        borderWidth: 1
      };
  }
}

/**
 * Prepara dados para gráfico de vendas por dia
 * @param {Array} vendasPorDia - Dados de vendas por dia
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosVendasPorDia(vendasPorDia) {
  if (!vendasPorDia || vendasPorDia.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const labels = vendasPorDia.map(item => formatarData(item.data, 'dd/MM'));
  const dataset = gerarDataset(vendasPorDia, 'Vendas', 'line');

  return {
    labels,
    datasets: [dataset]
  };
}

/**
 * Prepara dados para gráfico de vendas por CFOP
 * @param {Array} vendasPorCfop - Dados de vendas por CFOP
 * @param {number} limite - Limite de CFOPs a exibir
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosVendasPorCfop(vendasPorCfop, limite = 10) {
  if (!vendasPorCfop || vendasPorCfop.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  // Pega os top CFOPs
  const topCfops = vendasPorCfop.slice(0, limite);
  
  const labels = topCfops.map(item => `${item.cfop}\n${item.descricao.substring(0, 30)}...`);
  const dataset = gerarDataset(topCfops, 'Vendas por CFOP', 'bar');

  return {
    labels,
    datasets: [dataset]
  };
}

/**
 * Prepara dados para gráfico de distribuição de CFOPs (pizza)
 * @param {Array} vendasPorCfop - Dados de vendas por CFOP
 * @param {number} limite - Limite de CFOPs a exibir
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosDistribuicaoCfop(vendasPorCfop, limite = 8) {
  if (!vendasPorCfop || vendasPorCfop.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  let dados = [...vendasPorCfop];
  
  // Se há mais CFOPs que o limite, agrupa os menores em "Outros"
  if (dados.length > limite) {
    const principais = dados.slice(0, limite - 1);
    const outros = dados.slice(limite - 1);
    const valorOutros = outros.reduce((acc, item) => acc + item.valor, 0);
    
    dados = [
      ...principais,
      {
        cfop: 'OUTROS',
        valor: valorOutros,
        descricao: 'Outros CFOPs'
      }
    ];
  }

  const labels = dados.map(item => item.cfop);
  const dataset = gerarDataset(dados, 'Distribuição por CFOP', 'doughnut');

  return {
    labels,
    datasets: [dataset]
  };
}

/**
 * Calcula tendência de crescimento
 * @param {Array} dados - Dados ordenados por data
 * @returns {Object} Informações sobre a tendência
 */
export function calcularTendencia(dados) {
  if (!dados || dados.length < 2) {
    return {
      tendencia: 'neutro',
      percentual: 0,
      descricao: 'Dados insuficientes'
    };
  }

  const primeiro = dados[0].valor;
  const ultimo = dados[dados.length - 1].valor;
  const percentual = primeiro === 0 ? 0 : ((ultimo - primeiro) / primeiro) * 100;

  let tendencia;
  let descricao;

  if (percentual > 5) {
    tendencia = 'crescimento';
    descricao = `Crescimento de ${formatarNumero(percentual, 1)}%`;
  } else if (percentual < -5) {
    tendencia = 'queda';
    descricao = `Queda de ${formatarNumero(Math.abs(percentual), 1)}%`;
  } else {
    tendencia = 'estavel';
    descricao = 'Estável';
  }

  return {
    tendencia,
    percentual,
    descricao
  };
}

/**
 * Prepara dados de entradas por dia para gráficos
 * @param {Array} entradasPorDia - Array de entradas por dia
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosEntradasPorDia(entradasPorDia) {
  if (!entradasPorDia || entradasPorDia.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const labels = entradasPorDia.map(item => formatarData(item.data));
  const valores = entradasPorDia.map(item => item.valor);

  return {
    labels,
    datasets: [{
      label: 'Entradas',
      data: valores,
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderColor: '#10B981',
      borderWidth: 2,
      fill: false
    }]
  };
}

/**
 * Prepara dados de saídas por dia para gráficos
 * @param {Array} saidasPorDia - Array de saídas por dia
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosSaidasPorDia(saidasPorDia) {
  if (!saidasPorDia || saidasPorDia.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const labels = saidasPorDia.map(item => formatarData(item.data));
  const valores = saidasPorDia.map(item => item.valor);

  return {
    labels,
    datasets: [{
      label: 'Saídas',
      data: valores,
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3B82F6',
      borderWidth: 2,
      fill: false
    }]
  };
}

/**
 * Prepara dados de entradas e saídas por dia para gráficos combinados
 * @param {Array} entradasPorDia - Array de entradas por dia
 * @param {Array} saidasPorDia - Array de saídas por dia
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosEntradasSaidasPorDia(entradasPorDia, saidasPorDia) {
  // Combina as datas de ambos os arrays
  const todasDatas = new Set();
  
  if (entradasPorDia) {
    entradasPorDia.forEach(item => todasDatas.add(item.data));
  }
  
  if (saidasPorDia) {
    saidasPorDia.forEach(item => todasDatas.add(item.data));
  }

  const datasOrdenadas = Array.from(todasDatas).sort();
  
  if (datasOrdenadas.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const labels = datasOrdenadas.map(data => formatarData(data));
  
  // Cria mapas para acesso rápido
  const entradasMap = new Map();
  const saidasMap = new Map();
  
  if (entradasPorDia) {
    entradasPorDia.forEach(item => entradasMap.set(item.data, item.valor));
  }
  
  if (saidasPorDia) {
    saidasPorDia.forEach(item => saidasMap.set(item.data, item.valor));
  }

  const valoresEntradas = datasOrdenadas.map(data => entradasMap.get(data) || 0);
  const valoresSaidas = datasOrdenadas.map(data => saidasMap.get(data) || 0);

  return {
    labels,
    datasets: [
      {
        label: 'Entradas',
        data: valoresEntradas,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10B981',
        borderWidth: 2,
        fill: false
      },
      {
        label: 'Saídas',
        data: valoresSaidas,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3B82F6',
        borderWidth: 2,
        fill: false
      }
    ]
  };
}

/**
 * Prepara dados de entradas por CFOP para gráficos
 * @param {Array} entradasPorCfop - Array de entradas por CFOP
 * @param {number} limite - Limite de CFOPs a exibir
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosEntradasPorCfop(entradasPorCfop, limite = 10) {
  if (!entradasPorCfop || entradasPorCfop.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const dadosLimitados = entradasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map(item => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map(item => item.valor);

  return {
    labels,
    datasets: [{
      label: 'Entradas',
      data: valores,
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderColor: '#10B981',
      borderWidth: 1
    }]
  };
}

/**
 * Prepara dados de distribuição de CFOPs de entrada para gráficos de pizza
 * @param {Array} entradasPorCfop - Array de entradas por CFOP
 * @param {number} limite - Limite de CFOPs a exibir
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosDistribuicaoCfopEntrada(entradasPorCfop, limite = 8) {
  if (!entradasPorCfop || entradasPorCfop.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const dadosLimitados = entradasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map(item => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map(item => item.valor);
  const cores = gerarCores(dadosLimitados.length);

  return {
    labels,
    datasets: [{
      data: valores,
      backgroundColor: cores,
      borderColor: cores.map(cor => cor.replace('0.7', '1')),
      borderWidth: 1
    }]
  };
}

/**
 * Prepara dados de distribuição de CFOPs de saída para gráficos de pizza
 * @param {Array} saidasPorCfop - Array de saídas por CFOP
 * @param {number} limite - Limite de CFOPs a exibir
 * @returns {Object} Dados formatados para Chart.js
 */
export function prepararDadosDistribuicaoCfopSaida(saidasPorCfop, limite = 8) {
  if (!saidasPorCfop || saidasPorCfop.length === 0) {
    return {
      labels: [],
      datasets: []
    };
  }

  const dadosLimitados = saidasPorCfop.slice(0, limite);
  const labels = dadosLimitados.map(item => `CFOP ${item.cfop}`);
  const valores = dadosLimitados.map(item => item.valor);
  const cores = gerarCores(dadosLimitados.length);

  return {
    labels,
    datasets: [{
      data: valores,
      backgroundColor: cores,
      borderColor: cores.map(cor => cor.replace('0.7', '1')),
      borderWidth: 1
    }]
  };
}

/**
 * Gera resumo executivo dos dados
 * @param {Object} dadosProcessados - Dados processados do SPED
 * @returns {Object} Resumo executivo
 */
export function gerarResumoExecutivo(dadosProcessados) {
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
      tendencia: null
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
    periodo 
  } = dadosProcessados;

  const numeroNotasEntrada = entradas ? entradas.length : 0;
  const numeroNotasSaida = saidas ? saidas.length : 0;
  const numeroNotas = vendas ? vendas.length : (numeroNotasEntrada + numeroNotasSaida);
  
  const ticketMedio = numeroNotas > 0 ? totalGeral / numeroNotas : 0;
  
  const cfopPrincipal = vendasPorCfopArray && vendasPorCfopArray.length > 0 
    ? vendasPorCfopArray[0] 
    : null;

  const cfopPrincipalEntrada = entradasPorCfopArray && entradasPorCfopArray.length > 0
    ? entradasPorCfopArray[0]
    : null;

  const cfopPrincipalSaida = saidasPorCfopArray && saidasPorCfopArray.length > 0
    ? saidasPorCfopArray[0]
    : null;

  const periodoAnalise = periodo && periodo.inicio && periodo.fim
    ? `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`
    : null;

  const tendencia = calcularTendencia(vendasPorDiaArray || saidasPorDiaArray || entradasPorDiaArray || []);

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
    tendencia
  };
} 