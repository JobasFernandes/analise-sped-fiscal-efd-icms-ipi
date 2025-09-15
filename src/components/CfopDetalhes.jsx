import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Filter, 
  Search,
  FileText,
  DollarSign
} from 'lucide-react';
import { formatarMoeda, formatarData, formatarNumero } from '../utils/dataProcessor';

/**
 * Função para remover acentos e caracteres especiais
 */
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_.,;/]/g, '');
};

/**
 * Função para formatar valor com vírgula
 */
const formatarValorCSV = (valor) => {
  if (!valor && valor !== 0) return '';
  return valor.toFixed(2).replace('.', ',');
};

/**
 * Componente para exibir detalhes das notas fiscais de um CFOP específico
 */
const CfopDetalhes = ({ cfop, dados, onFechar }) => {
  const [filtroTexto, setFiltroTexto] = useState('');
  const [ordenacao, setOrdenacao] = useState({ campo: 'dataDocumento', direcao: 'desc' });

  if (!cfop || !dados) return null;

  // Estilos inline para garantir renderização limpa
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 10000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    margin: 0,
    boxSizing: 'border-box',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none'
  };

  const modalContentStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    width: '100%',
    maxWidth: '95vw',
    maxHeight: '90vh',
    height: 'auto',
    overflow: 'hidden',
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  };

  // Filtra as notas que contêm itens do CFOP específico
  // Inclui tanto entradas quanto saídas
  const todasNotas = [
    ...(dados.entradas || []),
    ...(dados.saidas || []),
    ...(dados.vendas || []) // fallback para compatibilidade
  ];
  
  const notasComCfop = todasNotas.filter(nota => 
    nota.itens?.some(item => item.cfop === cfop.cfop)
  );

  // Cria lista detalhada com todos os itens do CFOP
  const itensDetalhados = [];
  notasComCfop.forEach(nota => {
    nota.itens
      .filter(item => item.cfop === cfop.cfop)
      .forEach(item => {
        itensDetalhados.push({
          ...item,
          numeroDoc: nota.numeroDoc,
          chaveNfe: nota.chaveNfe,
          dataDocumento: nota.dataDocumento,
          dataEntradaSaida: nota.dataEntradaSaida,
          valorTotal: nota.valorDocumento,
          situacao: nota.situacao
        });
      });
  });

  // Aplica filtro de texto - apenas por número da NF, data, valor e chave
  const itensFiltrados = itensDetalhados.filter(item => {
    if (!filtroTexto) return true;
    const texto = filtroTexto.toLowerCase();
    
    // Filtrar por número da NF
    if (item.numeroDoc?.toLowerCase().includes(texto)) return true;
    
    // Filtrar por chave NFe
    if (item.chaveNfe?.toLowerCase().includes(texto)) return true;
    
    // Filtrar por data formatada
    if (formatarData(item.dataDocumento)?.toLowerCase().includes(texto)) return true;
    
    // Filtrar por valor
    if (formatarMoeda(item.valorOperacao)?.toLowerCase().includes(texto)) return true;
    
    return false;
  });

  // Aplica ordenação
  const itensOrdenados = [...itensFiltrados].sort((a, b) => {
    const { campo, direcao } = ordenacao;
    let valorA = a[campo];
    let valorB = b[campo];

    // Tratamento especial para datas
    if (campo === 'dataDocumento' || campo === 'dataEntradaSaida') {
      valorA = new Date(valorA || 0);
      valorB = new Date(valorB || 0);
    }

    // Tratamento especial para números
    if (typeof valorA === 'number' && typeof valorB === 'number') {
      return direcao === 'asc' ? valorA - valorB : valorB - valorA;
    }

    // Tratamento para strings
    const result = String(valorA || '').localeCompare(String(valorB || ''));
    return direcao === 'asc' ? result : -result;
  });

  const handleOrdenacao = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportarCSV = () => {
    const headers = [
      'Numero NF',
      'Chave NFe',
      'Data Documento',
      'CFOP',
      'CST ICMS',
      'Valor Operacao',
      'Aliq ICMS (%)',
      'BC ICMS',
      'Valor ICMS'
    ];

    // Ordena por número da nota de forma crescente para exportação
    const itensParaExportar = [...itensOrdenados].sort((a, b) => {
      const numA = parseInt(a.numeroDoc) || 0;
      const numB = parseInt(b.numeroDoc) || 0;
      return numA - numB;
    });

    const linhas = itensParaExportar.map(item => [
      removerAcentos(item.numeroDoc),
      removerAcentos(item.chaveNfe),
      removerAcentos(formatarData(item.dataDocumento)),
      removerAcentos(item.cfop),
      removerAcentos(item.cstIcms),
      formatarValorCSV(item.valorOperacao),
      formatarValorCSV(item.aliqIcms),
      formatarValorCSV(item.valorBcIcms),
      formatarValorCSV(item.valorIcms)
    ]);

    const csv = [headers, ...linhas]
      .map(linha => linha.map(campo => `"${campo || ''}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `detalhes_cfop_${cfop.cfop}.csv`;
    link.click();
  };

  const totalItens = itensOrdenados.length;
  const valorTotalFiltrado = itensOrdenados.reduce((acc, item) => acc + (item.valorOperacao || 0), 0);
  const totalIcms = itensOrdenados.reduce((acc, item) => acc + (item.valorIcms || 0), 0);

  // Determina o tipo de operação baseado no CFOP
  const getTipoOperacao = (cfop) => {
    const numero = parseInt(cfop);
    if (numero >= 1000 && numero <= 3999) {
      return { tipo: 'Entrada', cor: 'text-green-600', bg: 'bg-green-100' };
    } else if (numero >= 5000 && numero <= 7999) {
      return { tipo: 'Saída', cor: 'text-blue-600', bg: 'bg-blue-100' };
    }
    return { tipo: 'Indefinido', cor: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const tipoOperacao = getTipoOperacao(cfop.cfop);

  return (
    <div 
      style={modalOverlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onFechar();
        }
      }}
    >
      <div 
        style={modalContentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '24px', 
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Detalhes do CFOP {cfop.cfop}
                </h2>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${tipoOperacao.bg} ${tipoOperacao.cor}`}>
                  {tipoOperacao.tipo}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {cfop.descricao}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportarCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={onFechar}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          padding: '24px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total de Registros</p>
              <p className="text-lg font-bold text-gray-900">{formatarNumero(totalItens, 0)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Valor Total</p>
              <p className="text-lg font-bold text-gray-900">{formatarMoeda(valorTotalFiltrado)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Total de ICMS</p>
              <p className="text-lg font-bold text-gray-900">
                {formatarMoeda(totalIcms)}
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por número da NF, chave NFe, data ou valor..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              <span>{itensFiltrados.length} de {totalItens} registros</span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'white' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('numeroDoc')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Núm. NF</span>
                    {ordenacao.campo === 'numeroDoc' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('dataDocumento')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Data Doc.</span>
                    {ordenacao.campo === 'dataDocumento' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CST ICMS
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('valorOperacao')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Valor Operação</span>
                    {ordenacao.campo === 'valorOperacao' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('aliqIcms')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Alíq ICMS (%)</span>
                    {ordenacao.campo === 'aliqIcms' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('valorBcIcms')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>BC ICMS</span>
                    {ordenacao.campo === 'valorBcIcms' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('valorIcms')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Valor ICMS</span>
                    {ordenacao.campo === 'valorIcms' && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chave NFe
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {itensOrdenados.map((item, index) => (
                <tr 
                  key={`${item.numeroDoc}-${item.cfop}-${index}`} 
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.numeroDoc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatarData(item.dataDocumento)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.cstIcms}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {formatarMoeda(item.valorOperacao)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatarNumero(item.aliqIcms, 2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatarMoeda(item.valorBcIcms)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {formatarMoeda(item.valorIcms)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                    <div className="max-w-xs truncate" title={item.chaveNfe}>
                      {item.chaveNfe || 'N/A'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mensagem quando não há dados */}
          {itensOrdenados.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum registro encontrado
              </h3>
              <p className="text-gray-500">
                {filtroTexto 
                  ? 'Tente ajustar os filtros de pesquisa'
                  : 'Não há registros para este CFOP'
                }
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              Exibindo {itensFiltrados.length} de {totalItens} registros • 
              Total: {formatarMoeda(valorTotalFiltrado)}
            </div>
            <div>
              CFOP {cfop.cfop} • {cfop.descricao}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CfopDetalhes; 