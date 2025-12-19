import React, { useEffect, useState, useMemo } from "react";
import {
  Fuel,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  Droplets,
  BarChart3,
  RefreshCw,
  FileWarning,
  CheckCircle2,
  ExternalLink,
  Download,
} from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Spinner from "./ui/spinner";
import DateInput from "./ui/date-input";
import ComparativoDialog from "./ComparativoDialog";
import { ReportButton } from "./ui/ReportButton";
import {
  getMovimentacoesDiariasBySpedId,
  getTotaisPorProduto,
  getProdutosCombustivel,
  getInconsistenciasBySpedId,
} from "../db/daos/combustivelDao";
import {
  analisarInconsistencias,
  gerarResumoInconsistencias,
  getDescricaoTipoInconsistencia,
} from "../utils/combustivelService";
import { gerarRelatorioInconsistenciasCombustivel } from "../utils/reportExporter";

// =====================================================
// HELPERS DE FORMATAÇÃO
// =====================================================

const formatarVolume = (valor) => {
  if (valor === null || valor === undefined) return "-";
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(valor) + " L"
  );
};

const formatarPercentual = (valor) => {
  if (valor === null || valor === undefined) return "-";
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + "%"
  );
};

const formatarData = (dataISO) => {
  if (!dataISO) return "-";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

// Cores por severidade (com suporte a dark mode)
const coresSeveridade = {
  CRITICO:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60",
  AVISO:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-700/60",
  INFO: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
};

const iconesSeveridade = {
  CRITICO: AlertCircle,
  AVISO: AlertTriangle,
  INFO: Info,
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

const CombustivelDashboard = ({ spedId }) => {
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [inconsistencias, setInconsistencias] = useState([]);
  const [resumoInconsistencias, setResumoInconsistencias] = useState(null);
  const [totaisPorProduto, setTotaisPorProduto] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Estado para o dialog de comparativo
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCodItem, setDialogCodItem] = useState("");
  const [dialogDtMov, setDialogDtMov] = useState("");

  // Função para abrir o dialog de comparativo
  const abrirComparativo = (codItem, dtMov) => {
    setDialogCodItem(codItem);
    setDialogDtMov(dtMov);
    setDialogOpen(true);
  };

  // Função para exportar relatório de inconsistências
  const handleExportarInconsistencias = (format) => {
    if (!inconsistencias || inconsistencias.length === 0) return;

    const inconsistenciasFormatadas = inconsistencias.map((i) => ({
      tipo: i.tipo,
      tipoDescricao: getDescricaoTipoInconsistencia(i.tipo),
      severidade: i.severidade,
      codItem: i.codItem,
      dtMov: i.dtMov,
      valorEsperado: i.valorEsperado,
      valorEncontrado: i.valorEncontrado,
      diferenca: i.diferenca,
      percentualDiferenca: i.percentualDiferenca,
      descricao: i.descricao,
    }));

    const resumo = resumoInconsistencias || {
      total: inconsistencias.length,
      criticas: inconsistencias.filter((i) => i.severidade === "CRITICO").length,
      avisos: inconsistencias.filter((i) => i.severidade === "AVISO").length,
      informativas: inconsistencias.filter((i) => i.severidade === "INFO").length,
      porTipo: {},
    };

    // Período baseado nas datas das inconsistências
    const datas = inconsistencias.map((i) => i.dtMov).sort();
    const periodo =
      datas.length > 0
        ? `${formatarData(datas[0])} a ${formatarData(datas[datas.length - 1])}`
        : "";

    gerarRelatorioInconsistenciasCombustivel(
      inconsistenciasFormatadas,
      resumo,
      { period: periodo },
      format
    );
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [movs, prods, totais, incons] = await Promise.all([
        getMovimentacoesDiariasBySpedId(spedId),
        getProdutosCombustivel(spedId),
        getTotaisPorProduto(spedId),
        getInconsistenciasBySpedId(spedId),
      ]);

      setMovimentacoes(movs);
      setProdutos(prods);
      setTotaisPorProduto(totais);
      setInconsistencias(incons);

      if (incons.length > 0) {
        const resumo = await gerarResumoInconsistencias(spedId);
        setResumoInconsistencias(resumo);
      }

      // Definir período baseado nas movimentações
      if (movs.length > 0) {
        const datas = movs.map((m) => m.dtMov).sort();
        setDataInicio(datas[0]);
        setDataFim(datas[datas.length - 1]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de combustíveis:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (!spedId) return;
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spedId]);

  // Analisar inconsistências
  const handleAnalisarInconsistencias = async () => {
    setAnalisando(true);
    try {
      const novasInconsistencias = await analisarInconsistencias(spedId);
      setInconsistencias(novasInconsistencias);

      const resumo = await gerarResumoInconsistencias(spedId);
      setResumoInconsistencias(resumo);
    } catch (error) {
      console.error("Erro ao analisar inconsistências:", error);
    } finally {
      setAnalisando(false);
    }
  };

  // Filtrar movimentações por período e produto
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((m) => {
      const dentroPeríodo =
        (!dataInicio || m.dtMov >= dataInicio) && (!dataFim || m.dtMov <= dataFim);
      const produtoMatch = !produtoSelecionado || m.codItem === produtoSelecionado;
      return dentroPeríodo && produtoMatch;
    });
  }, [movimentacoes, dataInicio, dataFim, produtoSelecionado]);

  // Filtrar inconsistências por período e produto
  const inconsistenciasFiltradas = useMemo(() => {
    return inconsistencias.filter((i) => {
      const dentroPeríodo =
        (!dataInicio || i.dtMov >= dataInicio) && (!dataFim || i.dtMov <= dataFim);
      const produtoMatch = !produtoSelecionado || i.codItem === produtoSelecionado;
      return dentroPeríodo && produtoMatch;
    });
  }, [inconsistencias, dataInicio, dataFim, produtoSelecionado]);

  // Se não há dados de combustíveis
  if (!loading && movimentacoes.length === 0) {
    return (
      <div className="text-center py-12">
        <Fuel className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Nenhum dado de combustíveis encontrado
        </h3>
        <p className="text-gray-500 text-sm">
          Este arquivo SPED não contém registros de movimentação de combustíveis (Bloco
          1 - Registros 1300, 1310, 1320).
        </p>
        <p className="text-gray-400 text-xs mt-2">
          Os registros de combustíveis são obrigatórios apenas para postos de
          combustíveis.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
        <span className="ml-3 text-muted-foreground">
          Carregando dados de combustíveis...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Fuel className="h-6 w-6 text-orange-500" />
            Movimentação de Combustíveis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de movimentação diária, tanques e inconsistências
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalisarInconsistencias}
            disabled={analisando}
          >
            {analisando ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {analisando ? "Analisando..." : "Analisar Inconsistências"}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Produto
            </label>
            <select
              value={produtoSelecionado}
              onChange={(e) => setProdutoSelecionado(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Data Início
            </label>
            <DateInput
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Data Fim
            </label>
            <DateInput
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Tabs de navegação */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: "resumo", label: "Resumo", icon: BarChart3 },
            { id: "movimentacao", label: "Movimentação Diária", icon: Droplets },
            {
              id: "inconsistencias",
              label: `Inconsistências (${inconsistenciasFiltradas.length})`,
              icon: FileWarning,
            },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      {abaAtiva === "resumo" && (
        <ResumoTab
          totaisPorProduto={totaisPorProduto}
          resumoInconsistencias={resumoInconsistencias}
          movimentacoes={movimentacoesFiltradas}
        />
      )}

      {abaAtiva === "movimentacao" && (
        <MovimentacaoTab
          movimentacoes={movimentacoesFiltradas}
          onRowClick={abrirComparativo}
        />
      )}

      {abaAtiva === "inconsistencias" && (
        <InconsistenciasTab
          inconsistencias={inconsistenciasFiltradas}
          resumoInconsistencias={resumoInconsistencias}
          onCardClick={abrirComparativo}
          onExport={(format) => handleExportarInconsistencias(format)}
        />
      )}

      {/* Dialog de Comparativo */}
      <ComparativoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        spedId={spedId}
        codItem={dialogCodItem}
        dtMov={dialogDtMov}
      />
    </div>
  );
};

// =====================================================
// ABA RESUMO
// =====================================================

const ResumoTab = ({ totaisPorProduto, resumoInconsistencias, movimentacoes }) => {
  // Calcular totais gerais
  const totaisGerais = useMemo(() => {
    return movimentacoes.reduce(
      (acc, m) => ({
        entradas: acc.entradas + m.qtdEntr,
        vendas: acc.vendas + m.qtdVendas,
        perdas: acc.perdas + m.qtdPerda,
        sobras: acc.sobras + m.qtdSobra,
      }),
      { entradas: 0, vendas: 0, perdas: 0, sobras: 0 }
    );
  }, [movimentacoes]);

  return (
    <div className="space-y-6">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-lg font-semibold">
                {formatarVolume(totaisGerais.entradas)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Vendas</p>
              <p className="text-lg font-semibold">
                {formatarVolume(totaisGerais.vendas)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Perdas</p>
              <p className="text-lg font-semibold">
                {formatarVolume(totaisGerais.perdas)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sobras</p>
              <p className="text-lg font-semibold">
                {formatarVolume(totaisGerais.sobras)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Resumo de Inconsistências */}
      {resumoInconsistencias && resumoInconsistencias.total > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-500" />
            Resumo de Inconsistências
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800/50">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {resumoInconsistencias.porSeveridade.CRITICO}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">Críticas</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {resumoInconsistencias.porSeveridade.AVISO}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">Avisos</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800/50">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {resumoInconsistencias.porSeveridade.INFO}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">Informativas</p>
            </div>
          </div>
        </Card>
      )}

      {/* Totais por Produto */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Totais por Produto</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Código</th>
                <th className="text-right py-2 px-3">Entradas</th>
                <th className="text-right py-2 px-3">Vendas</th>
                <th className="text-right py-2 px-3">Perdas</th>
                <th className="text-right py-2 px-3">Sobras</th>
                <th className="text-right py-2 px-3">Dias</th>
              </tr>
            </thead>
            <tbody>
              {totaisPorProduto.map((p) => (
                <tr key={p.codItem} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{p.codItem}</td>
                  <td className="py-2 px-3 text-right">
                    {formatarVolume(p.totalEntradas)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatarVolume(p.totalVendas)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-600">
                    {formatarVolume(p.totalPerdas)}
                  </td>
                  <td className="py-2 px-3 text-right text-yellow-600">
                    {formatarVolume(p.totalSobras)}
                  </td>
                  <td className="py-2 px-3 text-right">{p.diasComMovimentacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// =====================================================
// ABA MOVIMENTAÇÃO
// =====================================================

const MovimentacaoTab = ({ movimentacoes, onRowClick }) => {
  // Ordenar por data
  const movimentacoesOrdenadas = useMemo(() => {
    return [...movimentacoes].sort((a, b) => b.dtMov.localeCompare(a.dtMov));
  }, [movimentacoes]);

  return (
    <Card className="p-4">
      <div className="mb-3 text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Clique em uma linha para ver o comparativo detalhado
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-left py-2 px-3">Produto</th>
              <th className="text-right py-2 px-3">Estoque Inicial</th>
              <th className="text-right py-2 px-3">Entradas</th>
              <th className="text-right py-2 px-3">Disponível</th>
              <th className="text-right py-2 px-3">Vendas</th>
              <th className="text-right py-2 px-3">Est. Físico</th>
              <th className="text-right py-2 px-3">Perdas</th>
              <th className="text-right py-2 px-3">Sobras</th>
              <th className="text-right py-2 px-3">Est. Contábil</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoesOrdenadas.map((m, idx) => (
              <tr
                key={`${m.codItem}-${m.dtMov}-${idx}`}
                className="border-b hover:bg-muted/50 cursor-pointer transition-colors hover:bg-primary/5"
                onClick={() => onRowClick?.(m.codItem, m.dtMov)}
                title="Clique para ver comparativo detalhado"
              >
                <td className="py-2 px-3">{formatarData(m.dtMov)}</td>
                <td className="py-2 px-3 font-medium">{m.codItem}</td>
                <td className="py-2 px-3 text-right">{formatarVolume(m.qtdIni)}</td>
                <td className="py-2 px-3 text-right text-green-600">
                  {m.qtdEntr > 0 ? formatarVolume(m.qtdEntr) : "-"}
                </td>
                <td className="py-2 px-3 text-right">
                  {formatarVolume(m.qtdDisponivel)}
                </td>
                <td className="py-2 px-3 text-right text-blue-600">
                  {formatarVolume(m.qtdVendas)}
                </td>
                <td className="py-2 px-3 text-right">
                  {formatarVolume(m.qtdFimFisico)}
                </td>
                <td className="py-2 px-3 text-right text-red-600">
                  {m.qtdPerda > 0 ? formatarVolume(m.qtdPerda) : "-"}
                </td>
                <td className="py-2 px-3 text-right text-yellow-600">
                  {m.qtdSobra > 0 ? formatarVolume(m.qtdSobra) : "-"}
                </td>
                <td className="py-2 px-3 text-right font-medium">
                  {formatarVolume(m.qtdFimContabil)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {movimentacoesOrdenadas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma movimentação encontrada para os filtros selecionados.
          </div>
        )}
      </div>
    </Card>
  );
};

// =====================================================
// ABA INCONSISTÊNCIAS
// =====================================================

const InconsistenciasTab = ({
  inconsistencias,
  resumoInconsistencias,
  onCardClick,
  onExport,
}) => {
  // Ordenar por severidade e data
  const inconsistenciasOrdenadas = useMemo(() => {
    const ordemSeveridade = { CRITICO: 0, AVISO: 1, INFO: 2 };
    return [...inconsistencias].sort((a, b) => {
      const sevA = ordemSeveridade[a.severidade] ?? 3;
      const sevB = ordemSeveridade[b.severidade] ?? 3;
      if (sevA !== sevB) return sevA - sevB;
      return b.dtMov.localeCompare(a.dtMov);
    });
  }, [inconsistencias]);

  if (inconsistencias.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-green-700 mb-2">
          Nenhuma inconsistência encontrada
        </h3>
        <p className="text-sm text-muted-foreground">
          A movimentação de combustíveis está consistente para os filtros selecionados.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com botão de exportar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em uma inconsistência para ver o comparativo detalhado
        </div>
        <ReportButton
          label="Exportar Relatório"
          size="sm"
          variant="outline"
          onExport={onExport}
        />
      </div>
      {inconsistenciasOrdenadas.map((i, idx) => {
        const IconeSeveridade = iconesSeveridade[i.severidade];
        const corClasse = coresSeveridade[i.severidade];

        return (
          <Card
            key={`${i.tipo}-${i.dtMov}-${i.codItem}-${idx}`}
            className={`p-4 border ${corClasse} cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]`}
            onClick={() => onCardClick?.(i.codItem, i.dtMov)}
            title="Clique para ver comparativo detalhado"
          >
            <div className="flex items-start gap-3">
              <IconeSeveridade className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">
                    {getDescricaoTipoInconsistencia(i.tipo)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-background">
                    {i.severidade}
                  </span>
                  <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                </div>
                <p className="text-sm mb-2">{i.descricao}</p>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    <strong>Data:</strong> {formatarData(i.dtMov)}
                  </span>
                  <span>
                    <strong>Produto:</strong> {i.codItem}
                  </span>
                  {i.numTanque && (
                    <span>
                      <strong>Tanque:</strong> {i.numTanque}
                    </span>
                  )}
                  <span>
                    <strong>Diferença:</strong> {formatarVolume(i.diferenca)} (
                    {formatarPercentual(i.percentualDiferenca)})
                  </span>
                </div>
                {i.documentosRelacionados && i.documentosRelacionados.length > 0 && (
                  <div className="mt-2 text-xs">
                    <strong>Documentos relacionados:</strong>{" "}
                    {typeof i.documentosRelacionados === "string"
                      ? JSON.parse(i.documentosRelacionados).slice(0, 3).join(", ")
                      : i.documentosRelacionados.slice(0, 3).join(", ")}
                    {(typeof i.documentosRelacionados === "string"
                      ? JSON.parse(i.documentosRelacionados).length
                      : i.documentosRelacionados.length) > 3 && " ..."}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default CombustivelDashboard;
