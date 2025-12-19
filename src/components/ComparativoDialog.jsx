import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Fuel,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Gauge,
} from "lucide-react";
import Spinner from "./ui/spinner";
import { FiscalInsight } from "./ui/FiscalInsight";
import {
  getComparativoVendasDia,
  getMovimentacaoDia,
  getDescricaoTipoInconsistencia,
} from "../utils/combustivelService";

export default function ComparativoDialog({
  open,
  onOpenChange,
  spedId,
  codItem,
  dtMov,
}) {
  const [loading, setLoading] = useState(true);
  const [comparativo, setComparativo] = useState(null);
  const [movimentacao, setMovimentacao] = useState(null);
  const [tanques, setTanques] = useState([]);
  const [bicos, setBicos] = useState([]);
  const [inconsistencias, setInconsistencias] = useState([]);

  useEffect(() => {
    async function carregarDados() {
      if (!open || !spedId || !codItem || !dtMov) return;

      setLoading(true);
      try {
        const [comp, mov] = await Promise.all([
          getComparativoVendasDia(spedId, codItem, dtMov),
          getMovimentacaoDia(spedId, codItem, dtMov),
        ]);

        setComparativo(comp);
        setMovimentacao(mov.movimento);
        setTanques(mov.tanques);
        setBicos(mov.bicos);
        setInconsistencias(mov.inconsistencias);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [open, spedId, codItem, dtMov]);

  const formatarData = (data) => {
    if (!data) return "-";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const formatarLitros = (valor) => {
    if (valor === null || valor === undefined) return "-";
    return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} L`;
  };

  const formatarValor = (valor) => {
    if (valor === null || valor === undefined) return "-";
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const coresSeveridade = {
    INFO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    AVISO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    CRITICO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };

  const IconeDiferenca = ({ valor }) => {
    if (valor > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (valor < 0) return <TrendingDown className="h-4 w-4 text-amber-500" />;
    return <Minus className="h-4 w-4 text-green-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader className="pb-4">
          <div className="flex-1 pr-8">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Fuel className="h-5 w-5 text-amber-500" />
              Comparativo de Movimentação
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              {codItem} • {formatarData(dtMov)}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="overflow-auto max-h-[65vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-2 text-muted-foreground">Carregando dados...</span>
            </div>
          ) : !movimentacao && !comparativo ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado encontrado para esta data/produto.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grid principal: Movimentação vs Documentos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna Esquerda: Dados SPED 1300 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    Registro 1300 (SPED)
                  </h3>

                  {movimentacao ? (
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard
                        label="Estoque Inicial"
                        value={formatarLitros(movimentacao.estqIni)}
                      />
                      <InfoCard
                        label="Estoque Final"
                        value={formatarLitros(movimentacao.estqFin)}
                      />
                      <InfoCard
                        label="Entradas"
                        value={formatarLitros(movimentacao.qtdEntr)}
                        highlight="green"
                      />
                      <InfoCard
                        label="Recebimentos"
                        value={formatarLitros(movimentacao.qtdRec)}
                      />
                      <InfoCard
                        label="Volume Vendido"
                        value={formatarLitros(movimentacao.volDispVenda)}
                        highlight="blue"
                      />
                      <InfoCard
                        label="Perdas"
                        value={formatarLitros(movimentacao.qtdPerda)}
                        highlight="red"
                      />
                      <InfoCard
                        label="Sobras"
                        value={formatarLitros(movimentacao.qtdSobra)}
                        highlight="amber"
                      />
                      <InfoCard
                        label="Consumo Próprio"
                        value={formatarLitros(movimentacao.consoPropria)}
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Sem dados de movimentação
                    </p>
                  )}

                  {/* Tanques */}
                  {tanques.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Gauge className="h-4 w-4" />
                        Tanques ({tanques.length})
                      </h4>
                      <div className="space-y-2">
                        {tanques.map((t) => (
                          <div
                            key={t.id}
                            className="bg-muted/50 dark:bg-muted/20 rounded-lg p-3 text-sm"
                          >
                            <div className="font-medium">Tanque {t.numTanque}</div>
                            <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-muted-foreground">
                              <span>Inicial: {formatarLitros(t.estqIni)}</span>
                              <span>Final: {formatarLitros(t.estqFin)}</span>
                              <span>Vendido: {formatarLitros(t.volDispVenda)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bicos */}
                  {bicos.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">
                        Bicos ({bicos.length})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {bicos.map((b) => (
                          <div
                            key={b.id}
                            className="bg-muted/50 dark:bg-muted/20 rounded-lg p-2 text-xs"
                          >
                            <div className="font-medium">Bico {b.numBico}</div>
                            <div className="text-muted-foreground">
                              Aferido: {formatarLitros(b.qtdVendaAfer)}
                            </div>
                            <div className="text-muted-foreground text-[11px]">
                              Enc: {b.encerranteIni?.toFixed(0)} →{" "}
                              {b.encerranteFim?.toFixed(0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Documentos Fiscais */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <FileText className="h-5 w-5 text-green-500" />
                    Documentos Fiscais
                  </h3>

                  {/* Aviso sobre C170 */}
                  {comparativo &&
                    comparativo.totalDocumentos === 0 &&
                    comparativo.vendasSped > 0 && (
                      <FiscalInsight
                        type="warning"
                        title="Nenhum documento fiscal encontrado"
                        collapsible
                        defaultExpanded={true}
                      >
                        <p>
                          O arquivo SPED pode não conter os registros C170 (itens das
                          notas). Esses registros são essenciais para identificar quais
                          produtos foram vendidos em cada nota fiscal.
                        </p>
                        <p className="mt-1">
                          Sem os C170, não é possível cruzar as vendas declaradas no LMC
                          (registro 1300) com os documentos fiscais emitidos.
                        </p>
                      </FiscalInsight>
                    )}

                  {comparativo &&
                    comparativo.totalDocumentos > 0 &&
                    comparativo.documentosVenda?.length > 0 && (
                      <FiscalInsight
                        type="info"
                        title="Comparativo detalhado disponível"
                        collapsible
                        defaultExpanded={false}
                      >
                        <p>
                          Este comparativo utiliza os registros C170 do SPED para
                          identificar as vendas de combustível por produto. A comparação
                          cruza o volume vendido declarado no LMC (registro 1300) com as
                          quantidades nos itens das notas fiscais (C170).
                        </p>
                        <p className="mt-1">
                          CFOPs considerados para venda de combustível: 5102, 5405,
                          5656, 5667, 6102, 6405, 6656.
                        </p>
                      </FiscalInsight>
                    )}

                  {comparativo ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoCard
                          label="Vendas NFC-e"
                          value={formatarLitros(comparativo.vendasNfce)}
                          highlight="green"
                        />
                        <InfoCard
                          label="Vendas NF-e"
                          value={formatarLitros(comparativo.vendasNfe)}
                          highlight="blue"
                        />
                        <InfoCard
                          label="Total Documentos"
                          value={formatarLitros(comparativo.totalDocumentos)}
                        />
                        <InfoCard
                          label="Vendas SPED"
                          value={formatarLitros(comparativo.vendasSped)}
                        />
                      </div>

                      {/* Resumo da Diferença */}
                      <div
                        className={`rounded-lg p-4 ${
                          Math.abs(comparativo.diferenca) < 1
                            ? "bg-green-100 dark:bg-green-900/30"
                            : comparativo.diferenca > 0
                              ? "bg-red-100 dark:bg-red-900/30"
                              : "bg-amber-100 dark:bg-amber-900/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <IconeDiferenca valor={comparativo.diferenca} />
                            <span className="font-medium">Diferença</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {formatarLitros(Math.abs(comparativo.diferenca))}
                            </div>
                            <div className="text-sm opacity-75">
                              {comparativo.percentualDiferenca.toFixed(2)}%
                              {comparativo.diferenca > 0
                                ? " (SPED > Docs)"
                                : comparativo.diferenca < 0
                                  ? " (Docs > SPED)"
                                  : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Documentos */}
                      {comparativo.documentosVenda &&
                        comparativo.documentosVenda.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-2">
                              Documentos Encontrados (
                              {comparativo.documentosVenda.length})
                            </h4>
                            <div className="max-h-[200px] overflow-y-auto border rounded-lg dark:border-neutral-700">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50 dark:bg-muted/20 sticky top-0">
                                  <tr>
                                    <th className="text-left p-2">Tipo</th>
                                    <th className="text-left p-2">Número</th>
                                    <th className="text-right p-2">Qtd (L)</th>
                                    <th className="text-right p-2">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-neutral-700">
                                  {comparativo.documentosVenda.map((doc, idx) => (
                                    <tr
                                      key={idx}
                                      className="hover:bg-muted/30 dark:hover:bg-muted/10"
                                    >
                                      <td className="p-2">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            doc.tipo === "NFCE"
                                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                          }`}
                                        >
                                          {doc.tipo}
                                        </span>
                                      </td>
                                      <td className="p-2 font-mono">{doc.numero}</td>
                                      <td className="p-2 text-right">
                                        {doc.quantidade.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 3,
                                        })}
                                      </td>
                                      <td className="p-2 text-right">
                                        {formatarValor(doc.valor)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      {(!comparativo.documentosVenda ||
                        comparativo.documentosVenda.length === 0) && (
                        <div className="text-center py-6 text-muted-foreground bg-muted/30 dark:bg-muted/10 rounded-lg">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum documento fiscal encontrado para esta data.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Sem dados de comparativo
                    </p>
                  )}
                </div>
              </div>

              {/* Inconsistências relacionadas */}
              {inconsistencias.length > 0 && (
                <div className="border-t pt-4 dark:border-neutral-700">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Inconsistências Detectadas ({inconsistencias.length})
                  </h3>
                  <div className="space-y-2">
                    {inconsistencias.map((inc) => (
                      <div
                        key={inc.id}
                        className={`rounded-lg p-3 ${coresSeveridade[inc.severidade]}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">
                              {getDescricaoTipoInconsistencia(inc.tipo)}
                            </div>
                            <div className="text-sm mt-1 opacity-90">
                              {inc.descricao}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium">
                              {inc.percentualDiferenca?.toFixed(2)}%
                            </div>
                            <div className="text-xs opacity-75">
                              Δ {formatarLitros(inc.diferenca)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <div className="flex items-center justify-between w-full text-xs">
            <span>
              Produto: <strong>{codItem}</strong>
            </span>
            <span>
              Data: <strong>{formatarData(dtMov)}</strong>
            </span>
            <span>
              Limite ANP: <strong>0,6%</strong> (Res. ANP nº 23/2004)
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Card de informação simples
 */
function InfoCard({ label, value, highlight }) {
  const bgColors = {
    green: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    red: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? bgColors[highlight]
          : "bg-muted/30 border-muted dark:bg-muted/10 dark:border-neutral-700"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
