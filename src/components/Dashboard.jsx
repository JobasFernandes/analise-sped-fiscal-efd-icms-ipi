import React, { useEffect, useState } from "react";
import {
  FileText,
  Eye,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
} from "lucide-react";
import {
  formatarMoeda,
  formatarNumero,
  gerarResumoExecutivo,
  filtrarDadosProcessadosPorPeriodo,
  formatarData,
} from "../utils/dataProcessor";
import { generateReportConfig } from "../utils/reportExporter";
import EntradasSaidasComparativoChart from "./charts/EntradasSaidasComparativoChart";
import VendasPorDiaChart from "./charts/VendasPorDiaChart";
import DistribuicaoCfopChart from "./charts/DistribuicaoCfopChart";
import CfopDetalhes from "./CfopDetalhes";
import Card from "./ui/Card";
import Button from "./ui/Button";
import DateInput from "./ui/date-input";
import { ReportButton } from "./ui/ReportButton";
import { FiscalHelpSection } from "./ui/FiscalInsight";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import AbcAnalysis from "./analytics/AbcAnalysis";

const Dashboard = ({ dados, savedSpedId }) => {
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

  const getReportConfigTodosCfops = (tipo) => {
    const cfopsArray =
      tipo === "saidas"
        ? dadosFiltrados.saidasPorCfopArray
        : dadosFiltrados.entradasPorCfopArray;

    if (!cfopsArray || cfopsArray.length === 0) return null;

    const total = cfopsArray.reduce((acc, c) => acc + (c.valor || 0), 0);
    const data = cfopsArray.map((item) => ({
      cfop: item.cfop,
      descricao: item.descricao || "",
      valor: item.valor || 0,
      percentual: total > 0 ? ((item.valor || 0) / total) * 100 : 0,
    }));

    const tipoLabel = tipo === "saidas" ? "Saidas" : "Entradas";
    return {
      reportType: "todosCfops",
      title: `Relatorio de CFOPs - ${tipoLabel}`,
      subtitle: `Resumo de todos os CFOPs de ${tipoLabel.toLowerCase()} do periodo`,
      company: dados.razaoSocial || dados.empresa || "",
      cnpj: dados.cnpj || "",
      period: formatarPeriodo(dataInicio, dataFim) || resumo.periodoAnalise || "",
      columns: [
        { header: "CFOP", key: "cfop", width: 10 },
        { header: "Descricao", key: "descricao", width: 40 },
        { header: "Valor", key: "valor", format: "currency", width: 18 },
        { header: "% do Total", key: "percentual", format: "percent", width: 12 },
      ],
      data: data,
      totals: { valor: total },
      filename: `cfops_${tipo}_${(dados.cnpj || "").replace(/\D/g, "")}`,
      orientation: "portrait",
    };
  };

  const formatarPeriodo = (inicio, fim) => {
    const formatarData = (d) => {
      if (!d) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, dia] = d.split("-");
        return `${dia}/${m}/${y}`;
      }
      return d;
    };
    if (!inicio && !fim) return "";
    return `${formatarData(inicio)} a ${formatarData(fim)}`;
  };

  const handleExportResumo = async (format) => {
    const entradasArray = dadosFiltrados.entradasPorDiaArray || [];
    const saidasArray =
      dadosFiltrados.saidasPorDiaArray || dadosFiltrados.vendasPorDiaArray || [];
    const totalGeral = resumo.totalEntradas + resumo.totalSaidas;

    const cfopsSaida = (dadosFiltrados.saidasPorCfopArray || []).map((c) => ({
      cfop: c.cfop,
      valor: c.valor,
      percentual: totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0,
    }));
    const cfopsEntrada = (dadosFiltrados.entradasPorCfopArray || []).map((c) => ({
      cfop: c.cfop,
      valor: c.valor,
      percentual: totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0,
    }));
    const topCfops = [...cfopsSaida, ...cfopsEntrada]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const dadosResumo = {
      totalEntradas: resumo.totalEntradas,
      totalSaidas: resumo.totalSaidas,
      totalGeral,
      numeroNotasEntrada: resumo.numeroNotasEntrada,
      numeroNotasSaida: resumo.numeroNotasSaida,
      ticketMedioEntrada:
        resumo.numeroNotasEntrada > 0
          ? resumo.totalEntradas / resumo.numeroNotasEntrada
          : 0,
      ticketMedioSaida:
        resumo.numeroNotasSaida > 0 ? resumo.totalSaidas / resumo.numeroNotasSaida : 0,
      topCfops,
      entradasPorDia: entradasArray.map((e) => ({ data: e.data, valor: e.valor })),
      saidasPorDia: saidasArray.map((s) => ({ data: s.data, valor: s.valor })),
    };

    const periodoLabel = formatarPeriodo(
      dataInicio || dados?.periodo?.inicio,
      dataFim || dados?.periodo?.fim
    );

    const { gerarRelatorioResumoExecutivo } = await import("../utils/reportExporter");
    gerarRelatorioResumoExecutivo(
      dadosResumo,
      { company: dados?.companyName, cnpj: dados?.cnpj, period: periodoLabel },
      format
    );
  };

  const getResumoReportConfig = () => {
    const entradasArray = dadosFiltrados.entradasPorDiaArray || [];
    const saidasArray =
      dadosFiltrados.saidasPorDiaArray || dadosFiltrados.vendasPorDiaArray || [];
    const totalGeral = resumo.totalEntradas + resumo.totalSaidas;

    const cfopsSaida = (dadosFiltrados.saidasPorCfopArray || []).map((c) => ({
      cfop: c.cfop,
      valor: c.valor,
      percentual: totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0,
    }));
    const cfopsEntrada = (dadosFiltrados.entradasPorCfopArray || []).map((c) => ({
      cfop: c.cfop,
      valor: c.valor,
      percentual: totalGeral > 0 ? (c.valor / totalGeral) * 100 : 0,
    }));
    const topCfops = [...cfopsSaida, ...cfopsEntrada]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    const periodoLabel = formatarPeriodo(
      dataInicio || dados?.periodo?.inicio,
      dataFim || dados?.periodo?.fim
    );

    return generateReportConfig({
      reportType: "resumo-executivo",
      title: "Resumo Executivo",
      company: dados?.companyName,
      cnpj: dados?.cnpj,
      period: periodoLabel,
      filename: `resumo_executivo_${(dados?.cnpj || "").replace(/\D/g, "")}`,
      customData: {
        totalEntradas: resumo.totalEntradas,
        totalSaidas: resumo.totalSaidas,
        totalGeral,
        numeroNotasEntrada: resumo.numeroNotasEntrada,
        numeroNotasSaida: resumo.numeroNotasSaida,
        ticketMedioEntrada:
          resumo.numeroNotasEntrada > 0
            ? resumo.totalEntradas / resumo.numeroNotasEntrada
            : 0,
        ticketMedioSaida:
          resumo.numeroNotasSaida > 0
            ? resumo.totalSaidas / resumo.numeroNotasSaida
            : 0,
        topCfops,
        entradasPorDia: entradasArray.map((e) => ({ data: e.data, valor: e.valor })),
        saidasPorDia: saidasArray.map((s) => ({ data: s.data, valor: s.valor })),
      },
    });
  };

  return (
    <div className="space-y-3">
      <Card className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold">
              {dados?.companyName || "Análise SPED Fiscal"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatarPeriodo(dados?.periodo?.inicio, dados?.periodo?.fim)}
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

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Curva ABC</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 flex-shrink-0">
                  <DialogTitle>Análise de Curva ABC</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                  <AbcAnalysis spedId={savedSpedId} />
                </div>
              </DialogContent>
            </Dialog>

            <ReportButton
              onExport={handleExportResumo}
              reportConfig={getResumoReportConfig()}
              label="Resumo"
              size="default"
            />
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
              <p className="text-2xl font-bold">{formatarMoeda(resumo.totalSaidas)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDown className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">NFe Entrada</p>
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
              <p className="text-sm font-medium text-muted-foreground">NFe Saída</p>
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
                dadosFiltrados.saidasPorDiaArray || dadosFiltrados.vendasPorDiaArray
              }
            />
          </Card>
          <Card>
            <DistribuicaoCfopChart
              title="Distribuição CFOPs de Saída"
              dados={
                dadosFiltrados.saidasPorCfopArray || dadosFiltrados.vendasPorCfopArray
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
                dadosFiltrados.saidasPorDiaArray || dadosFiltrados.vendasPorDiaArray
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
                <ReportButton
                  reportConfig={() => getReportConfigTodosCfops("saidas")}
                  label="Exportar"
                  size="sm"
                  disabled={!dadosFiltrados.saidasPorCfopArray?.length}
                />
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
                        className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
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
                <ReportButton
                  reportConfig={() => getReportConfigTodosCfops("entradas")}
                  label="Exportar"
                  size="sm"
                  disabled={!dadosFiltrados.entradasPorCfopArray?.length}
                />
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
                        className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
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
          <strong>Dados processados:</strong> {resumo.numeroNotasEntrada} NFe de entrada
          e {resumo.numeroNotasSaida} NFe de saída |<strong> Total Entradas:</strong>{" "}
          {formatarMoeda(resumo.totalEntradas)} |<strong> Total Saídas:</strong>{" "}
          {formatarMoeda(resumo.totalSaidas)} |<strong> Período:</strong>{" "}
          {resumo.periodoAnalise || "N/A"}
        </p>
        <p className="mt-1">
          Apenas operações com situação normal foram consideradas na análise.
        </p>
      </div>

      {/* Insights fiscais do Dashboard */}
      <FiscalHelpSection
        title="Entendendo os dados do SPED Fiscal"
        items={[
          {
            title: "Entradas vs Saídas",
            text: "Entradas são operações de compra (CFOP iniciando com 1, 2 ou 3). Saídas são operações de venda (CFOP iniciando com 5, 6 ou 7).",
          },
          {
            title: "CFOPs importantes",
            text: "5102/6102 = Venda de mercadoria. 5405/6405 = Venda de produto ST. 5656/5667 = Venda de combustíveis. 5929/6929 = Cupom fiscal vinculado.",
          },
          {
            title: "Situação da nota",
            text: "Apenas notas com situação '00' (documento regular) são consideradas na análise. Notas canceladas ou inutilizadas são ignoradas.",
          },
          {
            title: "Registro C190",
            text: "Os valores exibidos vêm do registro C190 (analítico por CFOP), que agrupa os totais por código fiscal de operação.",
          },
          {
            title: "Filtro de período",
            text: "Use os filtros de data para analisar períodos específicos. Os dados são baseados na data do documento (DT_DOC) do SPED.",
          },
        ]}
      />

      {cfopSelecionado && (
        <CfopDetalhes
          cfop={cfopSelecionado}
          dados={dadosFiltrados}
          onFechar={() => setCfopSelecionado(null)}
          company={dados?.companyName}
          cnpj={dados?.cnpj}
          period={formatarPeriodo(
            dataInicio || dados?.periodo?.inicio,
            dataFim || dados?.periodo?.fim
          )}
        />
      )}
    </div>
  );
};

export default Dashboard;
