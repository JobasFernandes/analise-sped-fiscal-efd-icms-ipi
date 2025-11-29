import React, { useState, useMemo, useEffect } from "react";
import { Filter, Search, FileText, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import Button from "./ui/Button";
import { ReportButton } from "./ui/ReportButton";
import { formatarMoeda, formatarData, formatarNumero } from "../utils/dataProcessor";
import { FiscalInsight } from "./ui/FiscalInsight";

const CfopDetalhes = ({ cfop, dados, onFechar, company, cnpj, period }) => {
  const [filtroTextoInput, setFiltroTextoInput] = useState("");
  const [filtroTextoDebounced, setFiltroTextoDebounced] = useState("");
  const [ordenacao, setOrdenacao] = useState({
    campo: "dataDocumento",
    direcao: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);

  useEffect(() => {
    const t = setTimeout(() => setFiltroTextoDebounced(filtroTextoInput.trim()), 200);
    return () => clearTimeout(t);
  }, [filtroTextoInput]);

  const [open, setOpen] = useState(true);
  const [notaSelecionada, setNotaSelecionada] = useState(null);

  const hasData = !!(cfop && dados);

  const itensDetalhados = useMemo(() => {
    if (!hasData) return [];
    let base = (dados.itensPorCfopIndex && dados.itensPorCfopIndex[cfop.cfop]) || null;
    if (!base) {
      const todasNotas = [...(dados.entradas || []), ...(dados.saidas || [])];
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
    return base || [];
  }, [dados, cfop, hasData]);

  useEffect(() => {
    setPage(1);
  }, [filtroTextoDebounced, cfop]);

  const itensFiltrados = useMemo(() => {
    const texto = filtroTextoDebounced.toLowerCase();
    if (!texto) return itensDetalhados;
    return itensDetalhados.filter((item) => {
      if (item.numeroDoc?.toString().toLowerCase().includes(texto)) return true;
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
        const ta = valorA ? new Date(valorA).getTime() : Number.NEGATIVE_INFINITY;
        const tb = valorB ? new Date(valorB).getTime() : Number.NEGATIVE_INFINITY;
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

  const notaCompletaSelecionada = useMemo(() => {
    if (!notaSelecionada || !dados) return null;
    const todasNotas = [...(dados.entradas || []), ...(dados.saidas || [])];
    return (
      todasNotas.find(
        (n) =>
          n.numeroDoc === notaSelecionada.numeroDoc &&
          n.chaveNfe === notaSelecionada.chaveNfe
      ) || null
    );
  }, [notaSelecionada, dados]);

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

  const valorTotalFiltrado = useMemo(
    () => itensOrdenados.reduce((acc, item) => acc + (item.valorOperacao || 0), 0),
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

  const hasC170Data = useMemo(() => {
    if (!dados) return false;
    const todasNotas = [...(dados.entradas || []), ...(dados.saidas || [])];
    return todasNotas.some((n) => n.itensC170 && n.itensC170.length > 0);
  }, [dados]);

  const itensComC170 = useMemo(() => {
    if (!hasData || !hasC170Data) return null;
    const todasNotas = [...(dados.entradas || []), ...(dados.saidas || [])];
    const coletados = [];
    for (const nota of todasNotas) {
      if (!nota.itensC170?.length) continue;
      for (const itemC170 of nota.itensC170) {
        if (itemC170.cfop === cfop.cfop) {
          coletados.push({
            numeroDoc: nota.numeroDoc,
            chaveNfe: nota.chaveNfe,
            dataDocumento: nota.dataDocumento,
            cfop: itemC170.cfop,
            codItem: itemC170.codItem,
            descricaoItem: itemC170.descrCompl,
            quantidade: itemC170.quantidade,
            unidade: itemC170.unidade,
            valorUnitario:
              itemC170.valorItem && itemC170.quantidade
                ? itemC170.valorItem / itemC170.quantidade
                : undefined,
            valorOperacao: itemC170.valorItem || 0,
            cstIcms: itemC170.cstIcms,
            valorBcIcms: itemC170.valorBcIcms,
            valorIcms: itemC170.valorIcms,
          });
        }
      }
    }
    return coletados.length > 0 ? coletados : null;
  }, [dados, cfop, hasData, hasC170Data]);

  const getReportConfig = (_format) => {
    const itensParaExportar = itensComC170 || itensOrdenados;
    const temC170 = !!itensComC170;

    const itemsFormatados = itensParaExportar.map((item) => ({
      numeroDoc: item.numeroDoc || "",
      dataDocumento: item.dataDocumento
        ? typeof item.dataDocumento === "string"
          ? item.dataDocumento
          : item.dataDocumento.toISOString().split("T")[0]
        : "",
      cstIcms: item.cstIcms || "",
      aliqIcms: item.aliqIcms || 0,
      valorOperacao: item.valorOperacao || 0,
      valorBcIcms: item.valorBcIcms || 0,
      valorIcms: item.valorIcms || 0,
      codItem: item.codItem || "",
      descricaoItem: item.descricaoItem || "",
      quantidade: item.quantidade || 0,
      unidade: item.unidade || "",
      valorUnitario: item.valorUnitario || 0,
    }));

    const columnsBasic = [
      { header: "N Doc", key: "numeroDoc", width: 10 },
      { header: "Data", key: "dataDocumento", format: "date", width: 12 },
      { header: "CST", key: "cstIcms", width: 6 },
      { header: "Aliq.", key: "aliqIcms", format: "number", width: 8 },
      { header: "Valor Op.", key: "valorOperacao", format: "currency", width: 14 },
      { header: "BC ICMS", key: "valorBcIcms", format: "currency", width: 14 },
      { header: "Valor ICMS", key: "valorIcms", format: "currency", width: 14 },
    ];

    const columnsC170 = [
      { header: "N Doc", key: "numeroDoc", width: 10 },
      { header: "Data", key: "dataDocumento", format: "date", width: 12 },
      { header: "Cod. Item", key: "codItem", width: 12 },
      { header: "Descricao", key: "descricaoItem", width: 25 },
      { header: "Qtd", key: "quantidade", format: "number", width: 10 },
      { header: "Unid.", key: "unidade", width: 6 },
      { header: "Vlr Unit.", key: "valorUnitario", format: "currency", width: 12 },
      { header: "Valor Op.", key: "valorOperacao", format: "currency", width: 14 },
      { header: "CST", key: "cstIcms", width: 6 },
      { header: "BC ICMS", key: "valorBcIcms", format: "currency", width: 12 },
      { header: "Valor ICMS", key: "valorIcms", format: "currency", width: 12 },
    ];

    return {
      title: `Relatorio CFOP ${cfop.cfop}`,
      subtitle: cfop.descricao || "",
      company: company || "",
      cnpj: cnpj || "",
      period: period || "",
      columns: temC170 ? columnsC170 : columnsBasic,
      data: itemsFormatados,
      totals: {
        valorOperacao: itemsFormatados.reduce(
          (acc, i) => acc + (i.valorOperacao || 0),
          0
        ),
        valorBcIcms: itemsFormatados.reduce((acc, i) => acc + (i.valorBcIcms || 0), 0),
        valorIcms: itemsFormatados.reduce((acc, i) => acc + (i.valorIcms || 0), 0),
      },
      filename: `relatorio_cfop_${cfop.cfop}_${(cnpj || "").replace(/\D/g, "")}`,
      orientation: "landscape",
    };
  };

  const getDicaFiscalCfop = (cfopCode) => {
    const num = parseInt(cfopCode);
    if ([5656, 5667, 6656, 6667, 1656, 1667, 2656, 2667].includes(num)) {
      return {
        tipo: "info",
        titulo: "CFOP de Combustíveis",
        texto:
          "Este CFOP é utilizado para operações com combustíveis e derivados de petróleo. " +
          "Verifique se o ICMS Monofásico (ST) está sendo tratado corretamente no registro.",
      };
    }
    if ([5929, 6929].includes(num)) {
      return {
        tipo: "tip",
        titulo: "Cupom Fiscal Vinculado",
        texto:
          "Este CFOP representa operações já documentadas por cupom fiscal (ECF/SAT). " +
          "Geralmente deve ser excluído do comparativo XML para evitar duplicidade.",
      };
    }
    if ([5401, 5402, 5403, 5405, 6401, 6402, 6403, 6405].includes(num)) {
      return {
        tipo: "info",
        titulo: "Substituição Tributária",
        texto:
          "Este CFOP indica operação com mercadoria sujeita à substituição tributária. " +
          "O ICMS-ST já foi recolhido anteriormente na cadeia.",
      };
    }
    if ([5102, 5405, 6102, 6405].includes(num)) {
      return {
        tipo: "info",
        titulo: "Venda de Mercadoria",
        texto:
          "CFOP de venda de mercadoria adquirida ou recebida de terceiros. " +
          "Verifique a tributação de ICMS conforme o regime do contribuinte.",
      };
    }
    if (
      (num >= 5200 && num < 5300) ||
      (num >= 6200 && num < 6300) ||
      (num >= 1200 && num < 1300) ||
      (num >= 2200 && num < 2300)
    ) {
      return {
        tipo: "warning",
        titulo: "Operação de Devolução",
        texto:
          "Este CFOP indica devolução de mercadoria. Devoluções impactam o valor líquido " +
          "das operações e podem gerar créditos de ICMS.",
      };
    }
    if (
      (num >= 5150 && num < 5160) ||
      (num >= 6150 && num < 6160) ||
      (num >= 1150 && num < 1160) ||
      (num >= 2150 && num < 2160)
    ) {
      return {
        tipo: "info",
        titulo: "Transferência entre Estabelecimentos",
        texto:
          "Este CFOP indica transferência de mercadoria entre estabelecimentos da mesma empresa. " +
          "A tributação varia conforme a UF de origem e destino.",
      };
    }
    return null;
  };

  const dicaFiscal = hasData ? getDicaFiscalCfop(cfop.cfop) : null;

  const tipoOperacao = hasData
    ? getTipoOperacao(cfop.cfop)
    : { tipo: "", cor: "", bg: "" };

  if (!hasData) return null;

  return (
    <>
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
                  <h2 className="text-xl font-bold">Detalhes do CFOP {cfop.cfop}</h2>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${tipoOperacao.bg} ${tipoOperacao.cor}`}
                  >
                    {tipoOperacao.tipo}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{cfop.descricao}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ReportButton
                reportConfig={getReportConfig}
                label="Relatorio"
                size="default"
              />
            </div>
          </DialogHeader>

          {/* Dica fiscal contextual */}
          {dicaFiscal && (
            <div className="px-6 py-2">
              <FiscalInsight
                type={dicaFiscal.tipo}
                title={dicaFiscal.titulo}
                dismissible
              >
                <p>{dicaFiscal.texto}</p>
              </FiscalInsight>
            </div>
          )}

          <div className="px-6 pb-4 bg-muted/30"></div>

          <div
            className="grid gap-4 p-6 border-b bg-muted/40"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Registros</p>
                <p className="text-lg font-bold">{formatarNumero(totalItens, 0)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <DollarSign className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{formatarMoeda(valorTotalFiltrado)}</p>
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
                        ? "bg-background hover:bg-muted cursor-pointer"
                        : "bg-muted/20 hover:bg-muted cursor-pointer"
                    }
                    onClick={() =>
                      setNotaSelecionada({
                        numeroDoc: item.numeroDoc,
                        chaveNfe: item.chaveNfe,
                      })
                    }
                    role="button"
                    title="Clique para ver os itens (C170) desta nota"
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
                <h3 className="text-lg font-medium mb-2">Nenhum registro encontrado</h3>
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
                Exibindo {itensFiltrados.length} de {totalItens} registros • Total:{" "}
                {formatarMoeda(valorTotalFiltrado)}
              </div>
              <div>
                CFOP {cfop.cfop} • {cfop.descricao}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!notaSelecionada}
        onOpenChange={(v) => {
          if (!v) setNotaSelecionada(null);
        }}
      >
        <DialogContent className="w-[92vw] max-w-[1300px] max-h-[88vh] p-0 overflow-hidden bg-popover">
          <DialogHeader className="pr-16">
            <DialogTitle>Itens da Nota (C170)</DialogTitle>
            <DialogDescription className="truncate max-w-[65vw] sm:max-w-[70%] pr-8 text-xs sm:text-sm">
              {notaSelecionada
                ? `NF ${notaSelecionada.numeroDoc} • ${notaSelecionada.chaveNfe}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 text-sm text-muted-foreground">
            {notaCompletaSelecionada ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Data:</span>{" "}
                  {formatarData(notaCompletaSelecionada.dataDocumento)}
                </div>
                <div>
                  <span className="font-medium">Valor Documento:</span>{" "}
                  {formatarMoeda(notaCompletaSelecionada.valorDocumento || 0)}
                </div>
                <div>
                  <span className="font-medium">Situação:</span>{" "}
                  {notaCompletaSelecionada.situacao}
                </div>
                <div>
                  <span className="font-medium">Operação:</span>{" "}
                  {notaCompletaSelecionada.indicadorOperacao === "1"
                    ? "Saída"
                    : "Entrada"}
                </div>
              </div>
            ) : (
              <div>Localizando dados da nota...</div>
            )}
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="min-w-[900px] w-full divide-y divide-border">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    Código
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    Descrição
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    Qtd
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    Unid
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    Valor Item
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    Desconto
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    CFOP
                  </th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted-foreground">
                    CST
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    Alíquota
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    BC ICMS
                  </th>
                  <th className="px-4 py-2 text-right text-xs uppercase text-muted-foreground">
                    ICMS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(notaCompletaSelecionada?.itensC170 || []).map((it, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="px-4 py-2 text-sm">{it.numItem || idx + 1}</td>
                    <td className="px-4 py-2 text-sm">{it.codItem || ""}</td>
                    <td className="px-4 py-2 text-sm">{it.descrCompl || ""}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarNumero(it.quantidade || 0, 3)}
                    </td>
                    <td className="px-4 py-2 text-sm">{it.unidade || ""}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarMoeda(it.valorItem || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarMoeda(it.valorDesconto || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm">{it.cfop || ""}</td>
                    <td className="px-4 py-2 text-sm">{it.cstIcms || ""}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarNumero(it.aliqIcms || 0, 2)}%
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarMoeda(it.valorBcIcms || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatarMoeda(it.valorIcms || 0)}
                    </td>
                  </tr>
                ))}
                {(!notaCompletaSelecionada ||
                  (notaCompletaSelecionada?.itensC170 || []).length === 0) && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      Nenhum item C170 encontrado para esta nota.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter className="px-6 py-3">
            <Button variant="outline" onClick={() => setNotaSelecionada(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CfopDetalhes;
