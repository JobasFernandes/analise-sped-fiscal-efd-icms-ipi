import React, { useState, useMemo, useEffect } from "react";
import { Download, Filter, Search, FileText, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import Button from "./ui/button";
import {
  formatarMoeda,
  formatarData,
  formatarNumero,
} from "../utils/dataProcessor";

const removerAcentos = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s\-_.,;/]/g, "");
};

const formatarValorCSV = (valor) => {
  if (!valor && valor !== 0) return "";
  return valor.toFixed(2).replace(".", ",");
};

const CfopDetalhes = ({ cfop, dados, onFechar }) => {
  const [filtroTextoInput, setFiltroTextoInput] = useState("");
  const [filtroTextoDebounced, setFiltroTextoDebounced] = useState("");
  const [ordenacao, setOrdenacao] = useState({
    campo: "dataDocumento",
    direcao: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);

  useEffect(() => {
    const t = setTimeout(
      () => setFiltroTextoDebounced(filtroTextoInput.trim()),
      200
    );
    return () => clearTimeout(t);
  }, [filtroTextoInput]);

  if (!cfop || !dados) return null;

  const [open, setOpen] = useState(true);

  const itensDetalhados = useMemo(() => {
    let base =
      (dados.itensPorCfopIndex && dados.itensPorCfopIndex[cfop.cfop]) || null;
    if (!base) {
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

  useEffect(() => {
    setPage(1);
  }, [filtroTextoDebounced, cfop]);

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

  const itensOrdenados = useMemo(() => {
    const { campo, direcao } = ordenacao;
    const mult = direcao === "asc" ? 1 : -1;
    return [...itensFiltrados].sort((a, b) => {
      let valorA = a[campo];
      let valorB = b[campo];

      if (campo === "dataDocumento" || campo === "dataEntradaSaida") {
        const ta = valorA
          ? new Date(valorA).getTime()
          : Number.NEGATIVE_INFINITY;
        const tb = valorB
          ? new Date(valorB).getTime()
          : Number.NEGATIVE_INFINITY;
        if (ta !== tb) return (ta - tb) * mult;
        return 0;
      }

      if (campo === "numeroDoc") {
        const na = parseInt((valorA ?? "").toString().replace(/\D+/g, ""), 10);
        const nb = parseInt((valorB ?? "").toString().replace(/\D+/g, ""), 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb)
          return (na - nb) * mult;
        const sa = (valorA ?? "").toString();
        const sb = (valorB ?? "").toString();
        return (
          sa.localeCompare(sb, undefined, {
            numeric: true,
            sensitivity: "base",
          }) * mult
        );
      }

      if (typeof valorA === "number" && typeof valorB === "number") {
        if (valorA !== valorB) return (valorA - valorB) * mult;
        return 0;
      }

      const sa = (valorA ?? "").toString();
      const sb = (valorB ?? "").toString();
      if (sa === sb) return 0;
      return sa.localeCompare(sb) * mult;
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) onFechar();
      }}
    >
      <DialogContent className="flex flex-col min-h-[70vh] max-h-[92vh] overflow-hidden p-0 w-[98vw] max-w-[1400px]">
        <DialogHeader className="pr-16">
          <div className="sr-only">
            <DialogTitle>Detalhes do CFOP {cfop.cfop}</DialogTitle>
            <DialogDescription>
              {cfop.descricao || "Detalhes das notas por CFOP."}
            </DialogDescription>
          </div>
          <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl font-bold">
                  Detalhes do CFOP {cfop.cfop}
                </h2>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${tipoOperacao.bg} ${tipoOperacao.cor}`}
                >
                  {tipoOperacao.tipo}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{cfop.descricao}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={exportarCSV}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV</span>
            </Button>
          </div>
        </DialogHeader>

        <div
          className="grid gap-4 p-6 border-b bg-muted/40"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">
                Total de Registros
              </p>
              <p className="text-lg font-bold">
                {formatarNumero(totalItens, 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold">
                {formatarMoeda(valorTotalFiltrado)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="h-6 w-6 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total de ICMS</p>
              <p className="text-lg font-bold">{formatarMoeda(totalIcms)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b bg-card">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por número da NF, chave NFe, data ou valor..."
                value={filtroTextoInput}
                onChange={(e) => setFiltroTextoInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground shrink-0">
              <Filter className="h-4 w-4" />
              <span>
                {itensFiltrados.length} de {totalItens} registros
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-card custom-scroll">
          <table className="min-w-[1000px] w-full divide-y divide-border">
            <thead className="sticky top-[-1px] z-10 bg-card border-b border-border">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  CST ICMS
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                  className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                  className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                  className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted whitespace-nowrap"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Chave NFe
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {paginaAtualItens.map((item, index) => (
                <tr
                  key={`${item.numeroDoc}-${item.cfop}-${
                    (page - 1) * pageSize + index
                  }`}
                  className={
                    ((page - 1) * pageSize + index) % 2 === 0
                      ? "bg-background"
                      : "bg-muted/20"
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {item.numeroDoc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatarData(item.dataDocumento)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {item.cstIcms}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    {formatarMoeda(item.valorOperacao)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                    {formatarNumero(item.aliqIcms, 2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                    {formatarMoeda(item.valorBcIcms)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
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

          {itensOrdenados.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Nenhum registro encontrado
              </h3>
              <p className="text-muted-foreground">
                {filtroTextoDebounced
                  ? "Tente ajustar os filtros de pesquisa"
                  : "Não há registros para este CFOP"}
              </p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Página {page} de {pageCount} • Exibindo {paginaAtualItens.length} de{" "}
            {totalItens}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              variant="outline"
              size="sm"
            >
              Anterior
            </Button>
            <Button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              variant="outline"
              size="sm"
            >
              Próxima
            </Button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs border border-input bg-background rounded px-2 py-1"
            >
              {[50, 100, 200, 500].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}/pág
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Exibindo {itensFiltrados.length} de {totalItens} registros •
              Total: {formatarMoeda(valorTotalFiltrado)}
            </div>
            <div>
              CFOP {cfop.cfop} • {cfop.descricao}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CfopDetalhes;
