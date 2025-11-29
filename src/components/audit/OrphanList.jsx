import React, { useEffect, useState, useRef, useCallback } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Spinner from "../ui/spinner";
import { FiscalInsight, FiscalBadge } from "../ui/FiscalInsight";
import { db } from "../../db";
import { formatarMoeda, formatarData } from "../../utils/dataProcessor";

export default function OrphanList({ spedId, reloadKey }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("xmlSemSped");
  const [filterDir, setFilterDir] = useState("all");
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!spedId) return;
    setLoading(true);
    setResult(null);

    try {
      const docs = await db.documents.where({ spedId }).toArray();
      const spedEntries = docs
        .filter((d) => d.chaveNfe && d.chaveNfe.length === 44)
        .map((d) => ({
          chaveNfe: d.chaveNfe,
          numeroDoc: d.numeroDoc,
          dataDocumento: d.dataDocumento,
          indicadorOperacao: d.indicadorOperacao,
          valorDocumento: d.valorDocumento,
        }));

      const spedFile = await db.sped_files.get(spedId);
      const cnpjRef = spedFile?.cnpj ? spedFile.cnpj.replace(/\D/g, "") : undefined;

      let xmlNotas = await db.xml_notas.toArray();
      if (cnpjRef) {
        xmlNotas = xmlNotas.filter((n) => (n.cnpjRef || "") === cnpjRef);
      }

      const xmlEntries = xmlNotas.map((n) => ({
        chave: n.chave,
        numero: n.numero,
        dataEmissao: n.dataEmissao,
        tpNF: n.tpNF,
        valorTotalProduto: n.valorTotalProduto,
      }));

      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../../workers/orphanAnalysisWorker.ts", import.meta.url),
          { type: "module" }
        );
      }

      workerRef.current.onmessage = (e) => {
        setResult(e.data);
        setLoading(false);
      };

      workerRef.current.postMessage({ spedEntries, xmlEntries });
    } catch (e) {
      console.error("Analysis failed", e);
      setLoading(false);
    }
  }, [spedId]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis, reloadKey]);

  const filteredList = React.useMemo(() => {
    if (!result) return [];
    const list = tab === "xmlSemSped" ? result.xmlsSemSped : result.spedSemXml;
    if (filterDir === "all") return list;
    return list.filter((item) => {
      const dir = item.tpNF || item.indicadorOperacao;
      return dir === filterDir;
    });
  }, [result, tab, filterDir]);

  if (!result && !loading) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Auditoria de Órfãos</h3>
          <p className="text-xs text-muted-foreground">
            Identificação de documentos presentes em apenas uma das fontes (SPED ou
            XML).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterDir === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterDir("all")}
          >
            Todos
          </Button>
          <Button
            variant={filterDir === "0" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterDir("0")}
          >
            Entradas
          </Button>
          <Button
            variant={filterDir === "1" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterDir("1")}
          >
            Saídas
          </Button>
          <Button onClick={runAnalysis} disabled={loading} size="sm">
            {loading ? <Spinner /> : "Atualizar"}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === "xmlSemSped"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("xmlSemSped")}
        >
          XML sem SPED ({result?.xmlsSemSped?.length || 0})
        </button>
        <button
          className={`pb-2 text-sm font-medium transition-colors ${
            tab === "spedSemXml"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("spedSemXml")}
        >
          SPED sem XML ({result?.spedSemXml?.length || 0})
        </button>
      </div>

      <div className="overflow-auto max-h-[400px] border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Número</th>
              <th className="px-3 py-2 text-left">Chave</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-right">Valor</th>
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
            {!loading && filteredList.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Nenhum documento encontrado nesta categoria.
                </td>
              </tr>
            )}
            {!loading &&
              filteredList.map((item, idx) => {
                const data = item.dataEmissao || item.dataDocumento;
                const numero = item.numero || item.numeroDoc;
                const chave = item.chave || item.chaveNfe;
                const valor = item.valorTotalProduto || item.valorDocumento;
                const dir = item.tpNF || item.indicadorOperacao;
                const tipoLabel = dir === "0" ? "Entrada" : "Saída";

                return (
                  <tr
                    key={idx}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatarData(data)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{numero}</td>
                    <td
                      className="px-3 py-2 font-mono text-xs truncate max-w-[200px]"
                      title={chave}
                    >
                      {chave}
                    </td>
                    <td className="px-3 py-2">
                      <FiscalBadge
                        status={dir === "0" ? "info" : "success"}
                        className="text-[10px]"
                      >
                        {tipoLabel}
                      </FiscalBadge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarMoeda(valor)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {tab === "xmlSemSped" && filteredList.length > 0 && (
        <FiscalInsight type="warning" title="Risco Fiscal Detectado">
          <p>
            Existem XMLs autorizados na SEFAZ que não foram escriturados no SPED. Isso
            pode gerar multas por omissão de receita (Saídas) ou perda de crédito
            (Entradas).
          </p>
        </FiscalInsight>
      )}
      {tab === "spedSemXml" && filteredList.length > 0 && (
        <FiscalInsight type="warning" title="Documento sem Lastro">
          <p>
            Existem lançamentos no SPED sem o arquivo XML correspondente importado.
            Verifique se o arquivo XML foi perdido ou se o lançamento foi feito
            indevidamente.
          </p>
        </FiscalInsight>
      )}
    </Card>
  );
}
