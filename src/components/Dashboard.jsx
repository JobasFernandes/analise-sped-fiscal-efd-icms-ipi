import React, { useEffect, useState } from "react";
import {
  FileText,
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
import Card from "./ui/Card";
import Button from "./ui/Button";
import DateInput from "./ui/date-input";

const Dashboard = ({ dados, arquivo }) => {
  const [cfopSelecionado, setCfopSelecionado] = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [visao, setVisao] = useState("saidas");

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
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
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
    const indice = dadosFiltrados.itensPorCfopIndex;
    let itens = [];
    if (indice) {
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

    let worker;
    try {
      // @ts-ignore
      worker = new Worker(
        new URL("../workers/csvExportWorker.ts", import.meta.url),
        { type: "module" }
      );
    } catch (e) {
      worker = null;
    }

    if (!worker) {
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
      return;
    }

    const encoder = new TextEncoder();
    const partes = [];
    const periodoTag =
      resumo.periodoAnalise?.replace(/\s|\//g, "_") || "periodo";
    const filename = `cfops_${tipo}_${periodoTag}.csv`;

    const onMessage = (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === "chunk") {
        partes.push(encoder.encode(msg.chunk || ""));
      } else if (msg.type === "done") {
        const blob = new Blob(partes, { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        worker.removeEventListener("message", onMessage);
        worker.terminate();
      } else if (msg.type === "error") {
        console.error("Erro no csvExportWorker:", msg.error);
        worker.removeEventListener("message", onMessage);
        worker.terminate();
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "exportCsvAll", items: itens, filename });
  };

  return (
    <div className="space-y-3">
      <Card className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold">Análise SPED Fiscal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Arquivo: {arquivo?.name || "Não identificado"}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Visão
              </label>
              <select
                value={visao}
                onChange={(e) => setVisao(e.target.value)}
                className="w-full h-9 px-3 py-2 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              >
                <option value="saidas">Saídas</option>
                <option value="entradas">Entradas</option>
                <option value="ambas">Comparativo</option>
              </select>
            </div>

            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data início
              </label>
              <DateInput
                value={dataInicio}
                onChange={setDataInicio}
                min={minPeriodo}
                max={dataFim || maxPeriodo}
                placeholder="Data início"
              />
            </div>

            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data fim
              </label>
              <DateInput
                value={dataFim}
                onChange={setDataFim}
                min={dataInicio || minPeriodo}
                max={maxPeriodo}
                placeholder="Data fim"
              />
            </div>

            <div className="min-w-[140px] text-right">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Período
              </p>
              <p className="text-sm font-semibold text-foreground h-9 flex items-center justify-end">
                {resumo.periodoAnalise || "Não identificado"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowDownCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total de Entradas
              </p>
              <p className="text-2xl font-bold">
                {formatarMoeda(resumo.totalEntradas)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowUpCircle className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total de Saídas
              </p>
              <p className="text-2xl font-bold">
                {formatarMoeda(resumo.totalSaidas)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDown className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                NFe Entrada
              </p>
              <p className="text-2xl font-bold">
                {formatarNumero(resumo.numeroNotasEntrada, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                NFe Saída
              </p>
              <p className="text-2xl font-bold">
                {formatarNumero(resumo.numeroNotasSaida, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {visao === "saidas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <VendasPorDiaChart
              title="Saídas por Dia"
              labelOverride="Saídas"
              tooltipPrefix="Saídas"
              dados={
                dadosFiltrados.saidasPorDiaArray ||
                dadosFiltrados.vendasPorDiaArray
              }
            />
          </Card>
          <Card>
            <DistribuicaoCfopChart
              title="Distribuição CFOPs de Saída"
              dados={
                dadosFiltrados.saidasPorCfopArray ||
                dadosFiltrados.vendasPorCfopArray
              }
            />
          </Card>
        </div>
      )}
      {visao === "entradas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <VendasPorDiaChart
              title="Entradas por Dia"
              labelOverride="Entradas"
              tooltipPrefix="Entradas"
              dados={dadosFiltrados.entradasPorDiaArray}
            />
          </Card>
          <Card>
            <DistribuicaoCfopChart
              title="Distribuição CFOPs de Entrada"
              dados={dadosFiltrados.entradasPorCfopArray}
            />
          </Card>
        </div>
      )}
      {visao === "ambas" && (
        <div className="grid grid-cols-1 gap-8">
          <Card>
            <EntradasSaidasComparativoChart
              title="Comparativo Entradas vs Saídas"
              entradas={dadosFiltrados.entradasPorDiaArray}
              saidas={
                dadosFiltrados.saidasPorDiaArray ||
                dadosFiltrados.vendasPorDiaArray
              }
            />
          </Card>
        </div>
      )}

      {visao !== "entradas" &&
        dadosFiltrados.saidasPorCfopArray &&
        dadosFiltrados.saidasPorCfopArray.length > 0 && (
          <Card>
            <div className="flex items-start justify-between mb-4 gap-4 flex-col sm:flex-row">
              <h2 className="text-sm font-medium text-muted-foreground">
                Detalhes por CFOP - Saídas
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => gerarCsvGeral("saidas")}
                  disabled={!dadosFiltrados.saidasPorCfopArray?.length}
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  size="sm"
                >
                  Exportar Todos (CSV)
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      CFOP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      % do Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {dadosFiltrados.saidasPorCfopArray?.map((item, index) => {
                    const percentual =
                      resumo.totalSaidas > 0
                        ? (item.valor / resumo.totalSaidas) * 100
                        : 0;

                    return (
                      <tr
                        key={item.cfop}
                        className={
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        }
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {item.cfop}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.descricao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                          {formatarNumero(percentual, 1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Button
                            onClick={() => setCfopSelecionado(item)}
                            className="inline-flex items-center gap-2"
                            size="sm"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      {visao !== "saidas" &&
        dadosFiltrados.entradasPorCfopArray &&
        dadosFiltrados.entradasPorCfopArray.length > 0 && (
          <Card>
            <div className="flex items-start justify-between mb-4 gap-4 flex-col sm:flex-row">
              <h2 className="text-sm font-medium text-muted-foreground">
                Detalhes por CFOP - Entradas
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => gerarCsvGeral("entradas")}
                  disabled={!dadosFiltrados.entradasPorCfopArray?.length}
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  size="sm"
                >
                  Exportar Todos (CSV)
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      CFOP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      % do Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {dadosFiltrados.entradasPorCfopArray?.map((item, index) => {
                    const percentual =
                      resumo.totalEntradas > 0
                        ? (item.valor / resumo.totalEntradas) * 100
                        : 0;

                    return (
                      <tr
                        key={item.cfop}
                        className={
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        }
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {item.cfop}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.descricao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                          {formatarNumero(percentual, 1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Button
                            onClick={() => setCfopSelecionado(item)}
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      <div className="bg-muted/40 rounded-lg p-4 text-xs text-muted-foreground">
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
