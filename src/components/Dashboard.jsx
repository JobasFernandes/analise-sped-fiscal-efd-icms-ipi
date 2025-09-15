import React, { useEffect, useState } from "react";
import {
  FileText,
  DollarSign,
  Eye,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  formatarMoeda,
  formatarNumero,
  gerarResumoExecutivo,
  filtrarDadosProcessadosPorPeriodo,
  formatarData,
} from "../utils/dataProcessor";
import EntradasSaidasComparativoChart from "./charts/EntradasSaidasComparativoChart";
import VendasPorDiaChart from "./charts/VendasPorDiaChart";
import DistribuicaoCfopChart from "./charts/DistribuicaoCfopChart";
import CfopDetalhes from "./CfopDetalhes";

/**
 * Dashboard principal com resumo executivo e visualizações
 */
const Dashboard = ({ dados, arquivo }) => {
  const [cfopSelecionado, setCfopSelecionado] = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [visao, setVisao] = useState("saidas"); // 'saidas' | 'entradas' | 'ambas'

  // Define automaticamente o período do arquivo nos filtros quando os dados mudarem
  useEffect(() => {
    if (dados?.periodo?.inicio && dados?.periodo?.fim) {
      const ini = formatarData(dados.periodo.inicio, "yyyy-MM-dd");
      const fim = formatarData(dados.periodo.fim, "yyyy-MM-dd");
      setDataInicio(ini);
      setDataFim(fim);
    }
  }, [dados?.periodo?.inicio, dados?.periodo?.fim]);

  if (!dados) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum arquivo carregado
        </h3>
        <p className="text-gray-500">
          Faça o upload de um arquivo SPED fiscal para visualizar os dados
        </p>
      </div>
    );
  }

  const dadosFiltrados = filtrarDadosProcessadosPorPeriodo(
    dados,
    dataInicio || undefined,
    dataFim || undefined
  );
  const resumo = gerarResumoExecutivo(dadosFiltrados);
  const minPeriodo = dados?.periodo?.inicio
    ? formatarData(dados.periodo.inicio, "yyyy-MM-dd")
    : "";
  const maxPeriodo = dados?.periodo?.fim
    ? formatarData(dados.periodo.fim, "yyyy-MM-dd")
    : "";

  // Utilitário local: normaliza item para linha CSV
  const formatarValorCSV = (valor) => {
    if (valor === undefined || valor === null) return "";
    return Number(valor).toFixed(2).replace(".", ",");
  };

  const removerAcentos = (texto) => {
    if (!texto) return "";
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s\-_.,;/]/g, "");
  };

  const coletarItensDeNotas = (notas, filtroTipo) => {
    const itens = [];
    for (const nota of notas || []) {
      if (!nota.itens) continue;
      if (filtroTipo === "entrada" && nota.indicadorOperacao !== "0") continue;
      if (filtroTipo === "saida" && nota.indicadorOperacao !== "1") continue;
      for (const item of nota.itens) {
        itens.push({
          cfop: item.cfop,
          cstIcms: item.cstIcms,
          aliqIcms: item.aliqIcms,
          valorOperacao: item.valorOperacao,
          valorBcIcms: item.valorBcIcms,
          valorIcms: item.valorIcms,
          numeroDoc: nota.numeroDoc,
          chaveNfe: nota.chaveNfe,
          dataDocumento: nota.dataDocumento,
          dataEntradaSaida: nota.dataEntradaSaida,
          situacao: nota.situacao,
        });
      }
    }
    return itens;
  };

  const gerarCsvGeral = (tipo) => {
    // tipo: 'entradas' | 'saidas'
    const indice = dadosFiltrados.itensPorCfopIndex;
    let itens = [];
    if (indice) {
      // Usa índice já agrupado
      for (const cfopChave of Object.keys(indice)) {
        for (const item of indice[cfopChave]) {
          const isEntrada = parseInt(cfopChave, 10) < 4000;
          if (
            (tipo === "entradas" && isEntrada) ||
            (tipo === "saidas" && !isEntrada)
          ) {
            itens.push(item);
          }
        }
      }
    } else {
      // Fallback: reconstruir a partir das notas completas
      itens = coletarItensDeNotas(
        [
          ...dadosFiltrados.entradas,
          ...dadosFiltrados.saidas,
          ...(dadosFiltrados.vendas || []),
        ],
        tipo === "entradas" ? "entrada" : "saida"
      );
    }

    if (!itens.length) return;

    // Cabeçalho
    const headers = [
      "Tipo",
      "CFOP",
      "Numero NF",
      "Chave NFe",
      "Data Doc",
      "CST ICMS",
      "Aliq ICMS (%)",
      "Valor Operacao",
      "BC ICMS",
      "Valor ICMS",
    ];

    const linhas = itens.map((it) => [
      parseInt(it.cfop, 10) < 4000 ? "Entrada" : "Saida",
      removerAcentos(it.cfop),
      removerAcentos(it.numeroDoc),
      removerAcentos(it.chaveNfe),
      it.dataDocumento ? formatarData(it.dataDocumento) : "",
      removerAcentos(it.cstIcms),
      formatarValorCSV(it.aliqIcms),
      formatarValorCSV(it.valorOperacao),
      formatarValorCSV(it.valorBcIcms),
      formatarValorCSV(it.valorIcms),
    ]);

    const csv = [headers, ...linhas]
      .map((l) => l.map((c) => `"${c || ""}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const periodoTag =
      resumo.periodoAnalise?.replace(/\s|\//g, "_") || "periodo";
    link.href = URL.createObjectURL(blob);
    link.download = `cfops_${tipo}_${periodoTag}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Análise SPED Fiscal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Arquivo: {arquivo?.name || "Não identificado"}
            </p>
          </div>
          <div className="flex items-end space-x-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Visão</label>
              <select
                value={visao}
                onChange={(e) => setVisao(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="saidas">Saídas</option>
                <option value="entradas">Entradas</option>
                <option value="ambas">Comparativo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Data início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                min={minPeriodo}
                max={dataFim || maxPeriodo}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Data fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                min={dataInicio || minPeriodo}
                max={maxPeriodo}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="text-right ml-2">
              <p className="text-sm text-gray-500">Período</p>
              <p className="text-lg font-medium text-gray-900">
                {resumo.periodoAnalise || "Não identificado"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total de Entradas */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowDownCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Total de Entradas
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatarMoeda(resumo.totalEntradas)}
              </p>
            </div>
          </div>
        </div>

        {/* Total de Saídas */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowUpCircle className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Total de Saídas
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatarMoeda(resumo.totalSaidas)}
              </p>
            </div>
          </div>
        </div>

        {/* Notas de Entrada */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDown className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">NFe Entrada</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatarNumero(resumo.numeroNotasEntrada, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Notas de Saída */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">NFe Saída</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatarNumero(resumo.numeroNotasSaida, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos Dinâmicos conforme visão */}
      {visao === "saidas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <VendasPorDiaChart
              title="Saídas por Dia"
              labelOverride="Saídas"
              tooltipPrefix="Saídas"
              dados={
                dadosFiltrados.saidasPorDiaArray ||
                dadosFiltrados.vendasPorDiaArray
              }
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <DistribuicaoCfopChart
              title="Distribuição CFOPs de Saída"
              dados={
                dadosFiltrados.saidasPorCfopArray ||
                dadosFiltrados.vendasPorCfopArray
              }
            />
          </div>
        </div>
      )}
      {visao === "entradas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <VendasPorDiaChart
              title="Entradas por Dia"
              labelOverride="Entradas"
              tooltipPrefix="Entradas"
              dados={dadosFiltrados.entradasPorDiaArray}
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <DistribuicaoCfopChart
              title="Distribuição CFOPs de Entrada"
              dados={dadosFiltrados.entradasPorCfopArray}
            />
          </div>
        </div>
      )}
      {visao === "ambas" && (
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <EntradasSaidasComparativoChart
              title="Comparativo Entradas vs Saídas"
              entradas={dadosFiltrados.entradasPorDiaArray}
              saidas={
                dadosFiltrados.saidasPorDiaArray ||
                dadosFiltrados.vendasPorDiaArray
              }
            />
          </div>
        </div>
      )}

      {/* bloco antigo removido */}

      {/* Tabela de Detalhes por CFOP - Saídas */}
      {visao !== "entradas" &&
        dadosFiltrados.saidasPorCfopArray &&
        dadosFiltrados.saidasPorCfopArray.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4 gap-4 flex-col sm:flex-row">
              <h2 className="text-lg font-medium text-gray-900">
                Detalhes por CFOP - Saídas
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => gerarCsvGeral("saidas")}
                  disabled={!dadosFiltrados.saidasPorCfopArray?.length}
                  className="px-3 py-2 text-xs rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar Todos (CSV)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CFOP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % do Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dadosFiltrados.saidasPorCfopArray?.map((item, index) => {
                    const percentual =
                      resumo.totalSaidas > 0
                        ? (item.valor / resumo.totalSaidas) * 100
                        : 0;

                    return (
                      <tr
                        key={item.cfop}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.cfop}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.descricao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {formatarNumero(percentual, 1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setCfopSelecionado(item)}
                            className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Tabela de Detalhes por CFOP - Entradas */}
      {visao !== "saidas" &&
        dadosFiltrados.entradasPorCfopArray &&
        dadosFiltrados.entradasPorCfopArray.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4 gap-4 flex-col sm:flex-row">
              <h2 className="text-lg font-medium text-gray-900">
                Detalhes por CFOP - Entradas
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => gerarCsvGeral("entradas")}
                  disabled={!dadosFiltrados.entradasPorCfopArray?.length}
                  className="px-3 py-2 text-xs rounded-md border border-green-600 text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar Todos (CSV)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CFOP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % do Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dadosFiltrados.entradasPorCfopArray?.map((item, index) => {
                    const percentual =
                      resumo.totalEntradas > 0
                        ? (item.valor / resumo.totalEntradas) * 100
                        : 0;

                    return (
                      <tr
                        key={item.cfop}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.cfop}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.descricao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {formatarNumero(percentual, 1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setCfopSelecionado(item)}
                            className="inline-flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Rodapé com Informações */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
        <p>
          <strong>Dados processados:</strong> {resumo.numeroNotasEntrada} NFe de
          entrada e {resumo.numeroNotasSaida} NFe de saída |
          <strong> Total Entradas:</strong>{" "}
          {formatarMoeda(resumo.totalEntradas)} |<strong> Total Saídas:</strong>{" "}
          {formatarMoeda(resumo.totalSaidas)} |<strong> Período:</strong>{" "}
          {resumo.periodoAnalise || "N/A"}
        </p>
        <p className="mt-1">
          Apenas operações com situação normal foram consideradas na análise.
        </p>
      </div>

      {/* Modal de Detalhes do CFOP */}
      {cfopSelecionado && (
        <CfopDetalhes
          cfop={cfopSelecionado}
          dados={dadosFiltrados}
          onFechar={() => setCfopSelecionado(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
