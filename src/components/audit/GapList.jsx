import React, { useEffect, useState, useRef, useCallback } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Spinner from "../ui/spinner";
import { FiscalInsight } from "../ui/FiscalInsight";
import { db } from "../../db";
import { ReportButton } from "../ui/ReportButton";
import { generateReportConfig } from "../../utils/reportExporter";

export default function GapList({ spedId }) {
  const [loading, setLoading] = useState(false);
  const [gaps, setGaps] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!spedId) return;
    setLoading(true);
    setGaps(null);

    try {
      // Fetch SPED Output Documents (Saídas)
      const docs = await db.documents
        .where({ spedId })
        .filter((d) => d.indicadorOperacao === "1") // Saídas
        .toArray();

      const documents = docs
        .filter((d) => d.chaveNfe && d.chaveNfe.length === 44)
        .map((d) => ({
          chave: d.chaveNfe,
          data: d.dataDocumento,
        }));

      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../../workers/gapAnalysisWorker.ts", import.meta.url),
          { type: "module" }
        );
      }

      workerRef.current.onmessage = (e) => {
        setGaps(e.data);
        setLoading(false);
      };

      workerRef.current.postMessage({ documents });
    } catch (e) {
      console.error("Gap Analysis failed", e);
      setLoading(false);
    }
  }, [spedId]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const getReportConfig = () => {
    if (!gaps || gaps.length === 0) return null;

    return generateReportConfig({
      title: "Relatório de Quebra de Sequência (Gaps)",
      filename: "auditoria_gaps_sequencia",
      columns: [
        { header: "Modelo", key: "modelo", width: 10 },
        { header: "Série", key: "serie", width: 10 },
        { header: "Início Gap", key: "inicio", width: 15 },
        { header: "Fim Gap", key: "fim", width: 15 },
        { header: "Qtd. Ausente", key: "qtd", width: 15 },
      ],
      data: gaps,
      totals: {
        qtd: gaps.reduce((acc, item) => acc + (item.qtd || 0), 0),
      },
    });
  };

  if (!gaps && !loading) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Análise de Sequência (Gaps)</h3>
          <p className="text-xs text-muted-foreground">
            Identificação de quebras na numeração sequencial de notas fiscais de saída.
          </p>
        </div>
        <div className="flex gap-2">
          <ReportButton
            reportConfig={getReportConfig}
            disabled={!gaps || gaps.length === 0}
            size="sm"
          />
          <Button onClick={runAnalysis} disabled={loading} size="sm">
            {loading ? <Spinner /> : "Atualizar"}
          </Button>
        </div>
      </div>

      <div className="overflow-auto max-h-[300px] border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left">Modelo</th>
              <th className="px-3 py-2 text-left">Série</th>
              <th className="px-3 py-2 text-left">Início Gap</th>
              <th className="px-3 py-2 text-left">Fim Gap</th>
              <th className="px-3 py-2 text-right">Qtd. Ausente</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <Spinner /> Analisando...
                </td>
              </tr>
            )}
            {!loading && gaps && gaps.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Nenhuma quebra de sequência encontrada.
                </td>
              </tr>
            )}
            {!loading &&
              gaps &&
              gaps.map((gap, idx) => (
                <tr key={idx} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">{gap.modelo}</td>
                  <td className="px-3 py-2">{gap.serie}</td>
                  <td className="px-3 py-2 font-mono">{gap.inicio}</td>
                  <td className="px-3 py-2 font-mono">{gap.fim}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-500">
                    {gap.qtd}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {gaps && gaps.length > 0 && (
        <FiscalInsight type="error" title="Quebra de Sequência">
          <p>
            Foram identificados números de notas fiscais pulados. Verifique se estas
            notas foram canceladas, inutilizadas ou se deixaram de ser escrituradas. A
            falta de inutilização de numeração não utilizada pode gerar multas.
          </p>
        </FiscalInsight>
      )}
    </Card>
  );
}
