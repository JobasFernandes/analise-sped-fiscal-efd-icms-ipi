import React, { useEffect, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import DateInput from "./ui/date-input";
import { FiscalInsight, FiscalBadge } from "./ui/FiscalInsight";
import { ReportButton } from "./ui/ReportButton";
import {
  gerarComparativoSpedXml,
  obterDetalhesDivergencia,
} from "../utils/comparisonService";
import { formatarMoeda } from "../utils/dataProcessor";
import Spinner from "./ui/spinner";
import { useFilters } from "../contexts/FilterContext";
import FilterBar from "./ui/FilterBar";
import DivergenceStatusBadge from "./DivergenceStatusBadge";
import XmlViewerModal from "./XmlViewerModal";
import { generateRiskReportPDF } from "../utils/riskReportGenerator";
import { db } from "../db";
import { FileWarning, FilePlus } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { addSpedLineFromXml } from "../utils/spedUpdater";

export default function SpedXmlComparison({
  spedId,
  periodo,
  reloadKey,
  company,
  cnpj,
}) {
  const { toast } = useToast();
  const [dataInicio, setDataInicio] = useState(periodo?.inicio || "");
  const [dataFim, setDataFim] = useState(periodo?.fim || "");
  const [linhas, setLinhas] = useState([]);
  const [totais, setTotais] = useState({ totalSped: 0, totalXml: 0 });
  const [loading, setLoading] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);
  const [xmlViewerChave, setXmlViewerChave] = useState(null);
  const { filters } = useFilters();

  const carregar = async () => {
    if (!spedId) return;
    setLoading(true);
    try {
      const r = await gerarComparativoSpedXml(
        spedId,
        {
          inicio: dataInicio || undefined,
          fim: dataFim || undefined,
        },
        filters
      );
      setLinhas(r.linhas);
      setTotais({ totalSped: r.totalSped, totalXml: r.totalXml });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spedId, reloadKey, filters]);

  const resumo = React.useMemo(() => {
    const totalXml = totais.totalXml;
    const totalSped = totais.totalSped;
    const diffAbs = totalXml - totalSped;
    const diffPerc = totalSped === 0 ? 0 : (diffAbs / totalSped) * 100;
    return { totalXml, totalSped, diffAbs, diffPerc };
  }, [totais]);

  const diffsCriticos = linhas.filter((l) => Math.abs(l.diffPerc) > 0);

  const abrirDetalhe = async (linha) => {
    setLinhaSelecionada(linha);
    setDetalhe(null);
    setDetalheAberto(true);
    setDetalheLoading(true);
    try {
      const d = await obterDetalhesDivergencia(spedId, linha.data, linha.cfop);
      setDetalhe(d);
    } catch (e) {
      setDetalhe({ erro: e.message || "Falha ao carregar detalhes." });
    } finally {
      setDetalheLoading(false);
    }
  };

  const formatarPeriodoLabel = () => {
    const fmt = (d) => {
      if (!d) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, dia] = d.split("-");
        return `${dia}/${m}/${y}`;
      }
      return d;
    };
    const ini = dataInicio || periodo?.inicio;
    const fim = dataFim || periodo?.fim;
    if (!ini && !fim) return "";
    return `${fmt(ini)} a ${fmt(fim)}`;
  };

  const handleExportReport = async (format) => {
    if (!linhas.length || !spedId) return;

    const divergenciasComDetalhes = await Promise.all(
      linhas.map(async (l) => {
        const temDivergencia = Math.abs(l.diffPerc) > 0;
        let notas = undefined;

        if (temDivergencia) {
          try {
            const detalhes = await obterDetalhesDivergencia(spedId, l.data, l.cfop);
            notas = detalhes.notas;
          } catch (e) {
            console.warn(`Erro ao buscar detalhes para ${l.data}/${l.cfop}:`, e);
          }
        }

        return {
          data: l.data,
          cfop: l.cfop,
          valorXml: l.xmlVProd,
          valorSped: l.spedValorOperacao,
          diferenca: l.diffAbs,
          diferencaPercent: l.diffPerc,
          status: temDivergencia ? "Divergente" : "OK",
          notas,
        };
      })
    );

    const { gerarRelatorioDivergenciasDetalhado } = await import(
      "../utils/reportExporter"
    );
    gerarRelatorioDivergenciasDetalhado(
      divergenciasComDetalhes,
      { company, cnpj, period: formatarPeriodoLabel() },
      format
    );
  };

  const handleRiskReport = () => {
    if (!linhas.length) return;
    generateRiskReportPDF(linhas, formatarPeriodoLabel(), cnpj);
  };

  const handleAddToSped = async (chave) => {
    try {
      const nota = await db.xml_notas.where({ chave }).first();
      if (!nota || !nota.xmlContent) {
        toast({
          title: "XML não encontrado",
          description:
            "O conteúdo XML desta nota não foi encontrado no banco de dados.",
          variant: "destructive",
        });
        return;
      }

      await addSpedLineFromXml(spedId, nota.xmlContent, cnpj);

      toast({
        title: "Adicionado ao SPED!",
        description: "A nota foi inserida no SPED e os totais foram atualizados.",
        variant: "success",
      });

      carregar();
      setDetalheAberto(false);
    } catch (e) {
      console.error("Erro ao adicionar linha SPED:", e);
      toast({
        title: "Erro ao adicionar",
        description: e.message || "Não foi possível adicionar a nota ao SPED.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h3 className="text-lg font-semibold">Comparativo SPED x XML (Saídas)</h3>
          <p className="text-xs text-muted-foreground">
            Diferenças por Dia + CFOP. Critério: valores SPED (C190) vs soma vProd dos
            XML autorizados.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-medium mb-1">Data início</label>
            <DateInput value={dataInicio} onChange={setDataInicio} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Data fim</label>
            <DateInput value={dataFim} onChange={setDataFim} />
          </div>
          <Button onClick={carregar} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Atualizando…
              </span>
            ) : (
              "Atualizar"
            )}
          </Button>
          <ReportButton
            onExport={handleExportReport}
            disabled={loading || linhas.length === 0}
            label="Relatorio"
            size="default"
          />
          <Button
            variant="outline"
            onClick={handleRiskReport}
            disabled={loading || linhas.length === 0}
            title="Gerar Relatório de Riscos Fiscais"
          >
            <FileWarning className="w-4 h-4 mr-2" />
            Riscos
          </Button>
        </div>
      </div>

      <FilterBar />

      {/* Status do comparativo */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {diffsCriticos.length} divergência(s)
        </span>
        {diffsCriticos.length === 0 ? (
          <FiscalBadge status="ok">✓ Conferido</FiscalBadge>
        ) : diffsCriticos.length <= 5 ? (
          <FiscalBadge status="warning">Atenção</FiscalBadge>
        ) : (
          <FiscalBadge status="error">Divergências</FiscalBadge>
        )}
      </div>

      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total XML
            </div>
            <div className="font-medium tabular-nums">
              {formatarMoeda(resumo.totalXml)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total SPED
            </div>
            <div className="font-medium tabular-nums">
              {formatarMoeda(resumo.totalSped)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Dif. Abs
            </div>
            <div
              className={`font-medium tabular-nums ${Math.abs(resumo.diffAbs) > 0.009 ? "text-red-600 dark:text-red-400" : ""}`}
            >
              {formatarMoeda(Math.abs(resumo.diffAbs) < 0.00001 ? 0 : resumo.diffAbs)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Dif. %
            </div>
            <div
              className={`font-medium tabular-nums ${Math.abs(resumo.diffPerc) > 0 ? "text-red-600 dark:text-red-400" : ""}`}
            >
              {resumo.diffPerc.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-2 py-1 text-left">Data</th>
              <th className="px-2 py-1 text-left">CFOP</th>
              <th className="px-2 py-1 text-right">Valor XML</th>
              <th className="px-2 py-1 text-right">Valor SPED</th>
              <th className="px-2 py-1 text-right">Dif. R$</th>
              <th className="px-2 py-1 text-right">Dif. %</th>
              <th className="px-2 py-1 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {!loading && linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Sem dados
                </td>
              </tr>
            )}
            {!loading &&
              linhas.map((l, idx) => {
                const diffPercFmt = l.diffPerc.toFixed(2);
                const critico = Math.abs(l.diffPerc) > 0;
                const diffAbsFmt = formatarMoeda(l.diffAbs === 0 ? 0 : l.diffAbs);
                return (
                  <tr
                    key={idx}
                    className={
                      (critico
                        ? "bg-red-50 dark:bg-red-900/20 "
                        : idx % 2
                          ? "bg-muted/30 "
                          : "") + "cursor-pointer hover:bg-primary/10"
                    }
                    onClick={() => abrirDetalhe(l)}
                    title="Ver detalhes da divergência"
                  >
                    <td className="px-2 py-1 whitespace-nowrap">{l.data}</td>
                    <td className="px-2 py-1 whitespace-nowrap font-mono">{l.cfop}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {formatarMoeda(l.xmlVProd)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {formatarMoeda(l.spedValorOperacao)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{diffAbsFmt}</td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums ${critico ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}
                    >
                      {diffPercFmt}%
                    </td>
                    <td
                      className="px-2 py-1 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DivergenceStatusBadge accessKey={`${l.data}|${l.cfop}`} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Notas: Dif% = (XML - SPED)/SPED. SPED=0 =&gt; 0% para evitar divisão por zero.
        Apenas CFOPs de saída (dir=1).
      </p>

      {/* Dica de divergências */}
      {diffsCriticos.length > 0 && (
        <FiscalInsight
          type="warning"
          title={`${diffsCriticos.length} divergência(s) encontrada(s)`}
          collapsible
          defaultExpanded={true}
          dismissible
        >
          <p>
            Clique em uma linha da tabela para ver os detalhes e identificar quais notas
            estão causando a diferença. Causas comuns incluem:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>
              <strong>XML faltando:</strong> Nota consta no SPED mas o XML não foi
              importado
            </li>
            <li>
              <strong>Nota cancelada:</strong> XML foi ignorado por estar cancelado
              (cStat≠100)
            </li>
            <li>
              <strong>Data de competência:</strong> Nota com emissão em um mês e
              autorização em outro
            </li>
            <li>
              <strong>CFOP divergente:</strong> O CFOP no XML difere do escriturado no
              SPED
            </li>
          </ul>
        </FiscalInsight>
      )}

      {diffsCriticos.length === 0 && linhas.length > 0 && (
        <FiscalInsight type="info" title="Conferência OK" dismissible>
          <p>
            Todos os valores do SPED conferem com os XMLs importados. Os totais por dia
            e CFOP estão batendo corretamente.
          </p>
        </FiscalInsight>
      )}

      {detalheAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-2">
          <div className="bg-card text-card-foreground rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h4 className="font-semibold text-base">Detalhes Dia+CFOP</h4>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {linhaSelecionada?.data} / CFOP {linhaSelecionada?.cfop}
                  </p>
                  <DivergenceStatusBadge
                    accessKey={`${linhaSelecionada?.data}|${linhaSelecionada?.cfop}`}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 overflow-auto text-sm grow">
              {detalheLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Spinner /> Carregando…
                </div>
              )}
              {!detalheLoading && detalhe?.erro && (
                <div className="text-red-600 text-sm">{detalhe.erro}</div>
              )}
              {!detalheLoading && detalhe && !detalhe.erro && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 rounded bg-muted/40">
                      <div className="uppercase text-[10px] text-muted-foreground">
                        Total XML
                      </div>
                      <div className="font-medium tabular-nums">
                        {formatarMoeda(detalhe.totalXml)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/40">
                      <div className="uppercase text-[10px] text-muted-foreground">
                        Total SPED
                      </div>
                      <div className="font-medium tabular-nums">
                        {formatarMoeda(detalhe.totalSped)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/40">
                      <div className="uppercase text-[10px] text-muted-foreground">
                        Dif. Abs
                      </div>
                      <div
                        className={
                          "font-medium tabular-nums " +
                          (Math.abs(detalhe.diffAbs) > 0.009
                            ? "text-red-600 dark:text-red-400"
                            : "")
                        }
                      >
                        {formatarMoeda(
                          Math.abs(detalhe.diffAbs) < 0.00001 ? 0 : detalhe.diffAbs
                        )}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/40">
                      <div className="uppercase text-[10px] text-muted-foreground">
                        Notas
                      </div>
                      <div className="font-medium tabular-nums">
                        {detalhe.notas.length}
                      </div>
                    </div>
                  </div>
                  <table className="min-w-full border text-[11px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left">Nº Nota</th>
                        <th className="px-2 py-1 text-left">Chave</th>
                        <th className="px-2 py-1 text-right">Valor XML</th>
                        <th className="px-2 py-1 text-right">Valor SPED</th>
                        <th className="px-2 py-1 text-right">Dif.</th>
                        <th className="px-2 py-1 text-left">Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.notas.map((n, i) => {
                        const diff = n.diff || (n.valorXml || 0) - (n.valorSped || 0);
                        const crit = Math.abs(diff) > 0.009;
                        return (
                          <tr key={i} className={i % 2 ? "bg-muted/30" : ""}>
                            <td className="px-2 py-1 text-left tabular-nums font-medium">
                              {n.numero || "-"}
                            </td>
                            <td
                              className="px-2 py-1 font-mono whitespace-nowrap max-w-[350px]"
                              title={n.chave}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="truncate">{n.chave}</span>
                                {n.tipo !== "SOMENTE_SPED" && (
                                  <div className="flex items-center gap-1 ml-2 shrink-0">
                                    <button
                                      onClick={() => setXmlViewerChave(n.chave)}
                                      className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-1 rounded border border-primary/20"
                                      title="Visualizar XML Original"
                                    >
                                      XML
                                    </button>
                                    {(n.tipo === "SOMENTE_XML" ||
                                      (n.tipo === "AMBOS" && crit)) && (
                                      <button
                                        onClick={() => handleAddToSped(n.chave)}
                                        className="text-[10px] bg-green-100 hover:bg-green-200 text-green-700 px-1 rounded border border-green-200 flex items-center gap-1"
                                        title="Adicionar Nota ao SPED (C100+C170)"
                                      >
                                        <FilePlus className="w-3 h-3" />
                                        Add SPED
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {formatarMoeda(n.valorXml || 0)}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {formatarMoeda(n.valorSped || 0)}
                            </td>
                            <td
                              className={
                                "px-2 py-1 text-right tabular-nums " +
                                (crit
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : "")
                              }
                            >
                              {formatarMoeda(Math.abs(diff) < 0.00001 ? 0 : diff)}
                            </td>
                            <td className="px-2 py-1">
                              {n.tipo === "AMBOS"
                                ? "Ambos"
                                : n.tipo === "SOMENTE_XML"
                                  ? "XML"
                                  : "SPED"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground">
                    Chaves presentes em ambos mostram diferenças linha a linha. Valores
                    são soma dos itens da nota para o CFOP selecionado.
                  </p>

                  {/* Dicas de resolução baseadas no tipo de divergência */}
                  {detalhe.notas?.some((n) => n.tipo === "SOMENTE_SPED") && (
                    <FiscalInsight
                      type="tip"
                      title="Notas apenas no SPED"
                      className="mt-3"
                    >
                      <p>
                        Existem notas escrituradas no SPED que não foram encontradas nos
                        XMLs. Verifique se:
                      </p>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        <li>O arquivo XML foi incluído na importação</li>
                        <li>A nota não foi cancelada após a emissão</li>
                        <li>A data de emissão está dentro do período filtrado</li>
                      </ul>
                    </FiscalInsight>
                  )}

                  {detalhe.notas?.some((n) => n.tipo === "SOMENTE_XML") && (
                    <FiscalInsight
                      type="tip"
                      title="Notas apenas no XML"
                      className="mt-3"
                    >
                      <p>
                        Existem XMLs importados que não aparecem no SPED. Possíveis
                        causas:
                      </p>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        <li>Nota não foi escriturada no SPED fiscal</li>
                        <li>CFOP diferente no SPED vs XML</li>
                        <li>Erro na digitação da chave de acesso no SPED</li>
                      </ul>
                    </FiscalInsight>
                  )}

                  {detalhe.notas?.some(
                    (n) =>
                      n.tipo === "AMBOS" &&
                      Math.abs((n.valorXml || 0) - (n.valorSped || 0)) > 0.01
                  ) && (
                    <FiscalInsight
                      type="tip"
                      title="Diferença de valores"
                      className="mt-3"
                    >
                      <p>
                        Notas presentes em ambos mas com valores diferentes. Verifique:
                      </p>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        <li>Descontos ou acréscimos não refletidos no SPED</li>
                        <li>Arredondamentos diferentes entre sistemas</li>
                        <li>Itens com CFOPs diferentes na mesma nota</li>
                      </ul>
                    </FiscalInsight>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetalheAberto(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {xmlViewerChave && (
        <XmlViewerModal
          chave={xmlViewerChave}
          onClose={() => setXmlViewerChave(null)}
        />
      )}
    </Card>
  );
}
