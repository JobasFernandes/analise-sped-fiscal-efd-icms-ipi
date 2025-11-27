import React, { useEffect, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import DateInput from "./ui/date-input";
import {
  gerarComparativoSpedXml,
  obterDetalhesDivergencia,
} from "../utils/comparisonService";
import { formatarMoeda } from "../utils/dataProcessor";
import Spinner from "./ui/spinner";

export default function SpedXmlComparison({ spedId, periodo, reloadKey }) {
  const [dataInicio, setDataInicio] = useState(periodo?.inicio || "");
  const [dataFim, setDataFim] = useState(periodo?.fim || "");
  const [linhas, setLinhas] = useState([]);
  const [totais, setTotais] = useState({ totalSped: 0, totalXml: 0 });
  const [loading, setLoading] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);

  const carregar = async () => {
    if (!spedId) return;
    setLoading(true);
    try {
      const r = await gerarComparativoSpedXml(spedId, {
        inicio: dataInicio || undefined,
        fim: dataFim || undefined,
      });
      setLinhas(r.linhas);
      setTotais({ totalSped: r.totalSped, totalXml: r.totalXml });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spedId, reloadKey]);

  const resumo = React.useMemo(() => {
    const totalXml = totais.totalXml;
    const totalSped = totais.totalSped;
    const diffAbs = totalXml - totalSped;
    const diffPerc = totalSped === 0 ? 0 : (diffAbs / totalSped) * 100;
    return { totalXml, totalSped, diffAbs, diffPerc };
  }, [totais]);

  const diffsCriticos = linhas.filter((l) => Math.abs(l.diffPerc) > 0); // tolerância 0%

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
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {diffsCriticos.length} divergência(s) (tolerância 0%)
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
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {!loading && linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Sem dados
                </td>
              </tr>
            )}
            {!loading &&
              linhas.map((l, idx) => {
                const diffPercFmt = l.diffPerc.toFixed(2);
                const critico = Math.abs(l.diffPerc) > 0; // qualquer diferença
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

      {detalheAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-2">
          <div className="bg-card text-card-foreground rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h4 className="font-semibold text-base">Detalhes Dia+CFOP</h4>
                <p className="text-xs text-muted-foreground">
                  {linhaSelecionada?.data} / CFOP {linhaSelecionada?.cfop}
                </p>
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
                            <td
                              className="px-2 py-1 font-mono whitespace-nowrap max-w-[200px] truncate"
                              title={n.chave}
                            >
                              {n.chave}
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
    </Card>
  );
}
