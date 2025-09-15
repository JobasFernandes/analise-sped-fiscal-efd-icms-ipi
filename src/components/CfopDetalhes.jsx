import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Download,
  Filter,
  Search,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  formatarMoeda,
  formatarData,
  formatarNumero,
} from "../utils/dataProcessor";

/**
 * Função para remover acentos e caracteres especiais
 */
const removerAcentos = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s\-_.,;/]/g, "");
};

/**
 * Função para formatar valor com vírgula
 */
const formatarValorCSV = (valor) => {
  if (!valor && valor !== 0) return "";
  return valor.toFixed(2).replace(".", ",");
};

/**
 * Componente para exibir detalhes das notas fiscais de um CFOP específico
 */
const CfopDetalhes = ({ cfop, dados, onFechar }) => {
  const [filtroTextoInput, setFiltroTextoInput] = useState("");
  const [filtroTextoDebounced, setFiltroTextoDebounced] = useState("");
  const [ordenacao, setOrdenacao] = useState({
    campo: "dataDocumento",
    direcao: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200); // renderiza 200 linhas por página

  // Debounce para filtro de texto (200ms)
  useEffect(() => {
    const t = setTimeout(
      () => setFiltroTextoDebounced(filtroTextoInput.trim()),
      200
    );
    return () => clearTimeout(t);
  }, [filtroTextoInput]);

  if (!cfop || !dados) return null;

  // Estilos inline para garantir renderização limpa
  const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 10000,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    margin: 0,
    boxSizing: "border-box",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  };

  const modalContentStyle = {
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    width: "100%",
    maxWidth: "95vw",
    maxHeight: "90vh",
    height: "auto",
    overflow: "hidden",
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  };

  // Usa índice pré-computado pelo parser (no Worker) para abrir instantaneamente
  const itensDetalhados = useMemo(() => {
    let base =
      (dados.itensPorCfopIndex && dados.itensPorCfopIndex[cfop.cfop]) || null;
    if (!base) {
      // Fallback compatibilidade
      const todasNotas = [
        ...(dados.entradas || []),
        ...(dados.saidas || []),
        ...(dados.vendas || []),
      ];
      const coletados = [];
      for (const nota of todasNotas) {
        if (!nota.itens) continue;
        for (const item of nota.itens) {
          if (item.cfop === cfop.cfop) {
            coletados.push({
              ...item,
              numeroDoc: nota.numeroDoc,
              chaveNfe: nota.chaveNfe,
              dataDocumento: nota.dataDocumento,
              dataEntradaSaida: nota.dataEntradaSaida,
              valorTotal: nota.valorDocumento,
              situacao: nota.situacao,
            });
          }
        }
      }
      base = coletados;
    }
    return base;
  }, [dados, cfop]);

  // Reset de página ao mudar filtro ou CFOP
  useEffect(() => {
    setPage(1);
  }, [filtroTextoDebounced, cfop]);

  // Aplica filtro de texto - apenas por número da NF, data, valor e chave
  const itensFiltrados = useMemo(() => {
    const texto = filtroTextoDebounced.toLowerCase();
    if (!texto) return itensDetalhados;
    return itensDetalhados.filter((item) => {
      if (item.numeroDoc?.toLowerCase().includes(texto)) return true;
      if (item.chaveNfe?.toLowerCase().includes(texto)) return true;
      const dataFmt = formatarData(item.dataDocumento)?.toLowerCase();
      if (dataFmt && dataFmt.includes(texto)) return true;
      const valorFmt = formatarMoeda(item.valorOperacao)?.toLowerCase();
      if (valorFmt && valorFmt.includes(texto)) return true;
      return false;
    });
  }, [itensDetalhados, filtroTextoDebounced]);

  // Aplica ordenação
  const itensOrdenados = useMemo(() => {
    const { campo, direcao } = ordenacao;
    return [...itensFiltrados].sort((a, b) => {
      let valorA = a[campo];
      let valorB = b[campo];
      if (campo === "dataDocumento" || campo === "dataEntradaSaida") {
        valorA = new Date(valorA || 0);
        valorB = new Date(valorB || 0);
      }
      if (typeof valorA === "number" && typeof valorB === "number") {
        return direcao === "asc" ? valorA - valorB : valorB - valorA;
      }
      const result = String(valorA || "").localeCompare(String(valorB || ""));
      return direcao === "asc" ? result : -result;
    });
  }, [itensFiltrados, ordenacao]);

  const totalItens = itensOrdenados.length;
  const pageCount = Math.max(1, Math.ceil(totalItens / pageSize));
  const paginaAtualItens = useMemo(() => {
    const start = (page - 1) * pageSize;
    return itensOrdenados.slice(start, start + pageSize);
  }, [itensOrdenados, page, pageSize]);

  const handleOrdenacao = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }));
  };

  const exportarCSV = () => {
    const headers = [
      "Numero NF",
      "Chave NFe",
      "Data Documento",
      "CFOP",
      "CST ICMS",
      "Valor Operacao",
      "Aliq ICMS (%)",
      "BC ICMS",
      "Valor ICMS",
    ];

    // Ordena por número da nota de forma crescente para exportação
    const itensParaExportar = [...itensOrdenados].sort((a, b) => {
      const numA = parseInt(a.numeroDoc) || 0;
      const numB = parseInt(b.numeroDoc) || 0;
      return numA - numB;
    });

    const linhas = itensParaExportar.map((item) => [
      removerAcentos(item.numeroDoc),
      removerAcentos(item.chaveNfe),
      removerAcentos(formatarData(item.dataDocumento)),
      removerAcentos(item.cfop),
      removerAcentos(item.cstIcms),
      formatarValorCSV(item.valorOperacao),
      formatarValorCSV(item.aliqIcms),
      formatarValorCSV(item.valorBcIcms),
      formatarValorCSV(item.valorIcms),
    ]);

    const csv = [headers, ...linhas]
      .map((linha) => linha.map((campo) => `"${campo || ""}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `detalhes_cfop_${cfop.cfop}.csv`;
    link.click();
  };

  const valorTotalFiltrado = useMemo(
    () =>
      itensOrdenados.reduce((acc, item) => acc + (item.valorOperacao || 0), 0),
    [itensOrdenados]
  );
  const totalIcms = useMemo(
    () => itensOrdenados.reduce((acc, item) => acc + (item.valorIcms || 0), 0),
    [itensOrdenados]
  );

  // Determina o tipo de operação baseado no CFOP
  const getTipoOperacao = (cfop) => {
    const numero = parseInt(cfop);
    if (numero >= 1000 && numero <= 3999) {
      return { tipo: "Entrada", cor: "text-green-600", bg: "bg-green-100" };
    } else if (numero >= 5000 && numero <= 7999) {
      return { tipo: "Saída", cor: "text-blue-600", bg: "bg-blue-100" };
    }
    return { tipo: "Indefinido", cor: "text-gray-600", bg: "bg-gray-100" };
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
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "white",
          }}
        >
          <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Detalhes do CFOP {cfop.cfop}
                </h2>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${tipoOperacao.bg} ${tipoOperacao.cor}`}
                >
                  {tipoOperacao.tipo}
                </span>
              </div>
              <p className="text-sm text-gray-500">{cfop.descricao}</p>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            padding: "24px",
            backgroundColor: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total de Registros</p>
              <p className="text-lg font-bold text-gray-900">
                {formatarNumero(totalItens, 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Valor Total</p>
              <p className="text-lg font-bold text-gray-900">
                {formatarMoeda(valorTotalFiltrado)}
              </p>
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
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "white",
          }}
        >
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por número da NF, chave NFe, data ou valor..."
                value={filtroTextoInput}
                onChange={(e) => setFiltroTextoInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              <span>
                {itensFiltrados.length} de {totalItens} registros
              </span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflow: "auto", backgroundColor: "white" }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("numeroDoc")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Núm. NF</span>
                    {ordenacao.campo === "numeroDoc" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("dataDocumento")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Data Doc.</span>
                    {ordenacao.campo === "dataDocumento" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CST ICMS
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("valorOperacao")}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Valor Operação</span>
                    {ordenacao.campo === "valorOperacao" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("aliqIcms")}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Alíq ICMS (%)</span>
                    {ordenacao.campo === "aliqIcms" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("valorBcIcms")}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>BC ICMS</span>
                    {ordenacao.campo === "valorBcIcms" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("valorIcms")}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Valor ICMS</span>
                    {ordenacao.campo === "valorIcms" && (
                      <span className="text-blue-500">
                        {ordenacao.direcao === "asc" ? "↑" : "↓"}
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
              {paginaAtualItens.map((item, index) => (
                <tr
                  key={`${item.numeroDoc}-${item.cfop}-${
                    (page - 1) * pageSize + index
                  }`}
                  className={
                    ((page - 1) * pageSize + index) % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50"
                  }
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
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                    <div className="max-w-xs truncate" title={item.chaveNfe}>
                      {item.chaveNfe || "N/A"}
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
                {filtroTextoDebounced
                  ? "Tente ajustar os filtros de pesquisa"
                  : "Não há registros para este CFOP"}
              </p>
            </div>
          )}
        </div>

        {/* Paginação */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-gray-500">
            Página {page} de {pageCount} • Exibindo {paginaAtualItens.length} de{" "}
            {totalItens}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1 text-xs rounded border ${
                page === 1
                  ? "text-gray-300 border-gray-200"
                  : "text-gray-600 hover:bg-gray-50 border-gray-300"
              }`}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className={`px-3 py-1 text-xs rounded border ${
                page === pageCount
                  ? "text-gray-300 border-gray-200"
                  : "text-gray-600 hover:bg-gray-50 border-gray-300"
              }`}
            >
              Próxima
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs border-gray-300 rounded px-2 py-1"
            >
              {[50, 100, 200, 500].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}/pág
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rodapé */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
          }}
        >
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
