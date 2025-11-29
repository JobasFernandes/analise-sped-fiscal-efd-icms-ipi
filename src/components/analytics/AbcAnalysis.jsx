import React, { useEffect, useState, useRef, useMemo } from "react";
import Card from "../ui/Card";
import Spinner from "../ui/spinner";
import { db } from "../../db";
import { formatarMoeda, formatarNumero } from "../../utils/dataProcessor";
import { ReportButton } from "../ui/ReportButton";
import { generateReportConfig } from "../../utils/reportExporter";
import { Search, Package } from "lucide-react";

export default function AbcAnalysis({ spedId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    const runAnalysis = async () => {
      if (!spedId) return;
      setLoading(true);
      setResult(null);

      try {
        const items = await db.items_c170.where({ spedId }).toArray();

        if (items.length === 0) {
          setLoading(false);
          return;
        }

        const workerInput = items.map((i) => ({
          codItem: i.codItem,
          valor: i.valorItem,
          quantidade: i.quantidade,
          descricao: i.descrCompl,
        }));

        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL("../../workers/abcAnalysisWorker.ts", import.meta.url),
            { type: "module" }
          );
        }

        workerRef.current.onmessage = (e) => {
          setResult(e.data);
          setLoading(false);
        };

        workerRef.current.postMessage({ items: workerInput });
      } catch (e) {
        console.error("ABC Analysis failed", e);
        setLoading(false);
      }
    };

    runAnalysis();
  }, [spedId]);

  const stats = useMemo(() => {
    if (!result) return null;
    const total = result.reduce((acc, r) => acc + r.valorTotal, 0);
    const countA = result.filter((r) => r.classe === "A").length;
    const countB = result.filter((r) => r.classe === "B").length;
    const countC = result.filter((r) => r.classe === "C").length;
    const valA = result
      .filter((r) => r.classe === "A")
      .reduce((acc, r) => acc + r.valorTotal, 0);
    const valB = result
      .filter((r) => r.classe === "B")
      .reduce((acc, r) => acc + r.valorTotal, 0);
    const valC = result
      .filter((r) => r.classe === "C")
      .reduce((acc, r) => acc + r.valorTotal, 0);

    return { total, countA, countB, countC, valA, valB, valC };
  }, [result]);

  const filteredResult = useMemo(() => {
    if (!result) return [];
    if (!searchTerm) return result;
    const lower = searchTerm.toLowerCase();
    return result.filter(
      (r) =>
        r.codItem.toLowerCase().includes(lower) ||
        (r.descricao && r.descricao.toLowerCase().includes(lower))
    );
  }, [result, searchTerm]);

  const getReportConfig = () => {
    if (!result) return null;
    return generateReportConfig({
      title: "Curva ABC de Produtos",
      filename: "curva_abc_produtos",
      columns: [
        { header: "Código", key: "codItem", width: 15 },
        { header: "Descrição", key: "descricao", width: 40 },
        { header: "Valor Total", key: "valorTotal", format: "currency", width: 15 },
        { header: "%", key: "percentual", format: "percent", width: 10 },
        { header: "% Acum.", key: "acumulado", format: "percent", width: 10 },
        { header: "Classe", key: "classe", width: 8, align: "center" },
      ],
      data: result,
      totals: {
        valorTotal: result.reduce((acc, r) => acc + r.valorTotal, 0),
      },
    });
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground animate-pulse">
          Calculando Curva ABC e classificando itens...
        </p>
      </div>
    );

  if (!result || result.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-2 opacity-20" />
        <p>Nenhum item encontrado para análise.</p>
      </div>
    );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Compact KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border-l-4 border-l-green-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Classe A
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-foreground">{stats.countA}</h3>
              <span className="text-xs text-muted-foreground">itens</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-green-600">
              {formatarMoeda(stats.valA)}
            </p>
            <p className="text-xs text-muted-foreground">Alta Importância</p>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Classe B
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-foreground">{stats.countB}</h3>
              <span className="text-xs text-muted-foreground">itens</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-yellow-600">
              {formatarMoeda(stats.valB)}
            </p>
            <p className="text-xs text-muted-foreground">Média Importância</p>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Classe C
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-foreground">{stats.countC}</h3>
              <span className="text-xs text-muted-foreground">itens</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-red-600">
              {formatarMoeda(stats.valC)}
            </p>
            <p className="text-xs text-muted-foreground">Baixa Importância</p>
          </div>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="flex flex-col shadow-sm border-border/60">
        <div className="p-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <ListIcon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">Detalhamento por Item</h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ReportButton
              reportConfig={getReportConfig}
              size="sm"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="overflow-auto max-h-[500px]">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50 uppercase tracking-wide sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">
                  Cls
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Item
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Valor Total
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  %
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">
                  % Acum.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredResult.slice(0, 100).map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                        item.classe === "A"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          : item.classe === "B"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {item.classe}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.codItem}
                      </span>
                      <span
                        className="font-medium truncate max-w-[250px]"
                        title={item.descricao}
                      >
                        {item.descricao || "Sem descrição"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {formatarMoeda(item.valorTotal)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatarNumero(item.percentual, 2)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{formatarNumero(item.acumulado, 2)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.acumulado <= 80
                              ? "bg-green-500"
                              : item.acumulado <= 95
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(item.acumulado, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredResult.length > 100 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-3 text-center text-muted-foreground bg-muted/10 text-xs"
                  >
                    Exibindo 100 de {filteredResult.length} itens.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ListIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}
