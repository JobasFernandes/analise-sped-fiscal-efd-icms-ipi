import React, { useEffect, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Spinner from "../ui/spinner";
import Card from "../ui/Card";
import { formatarMoeda } from "../../utils/dataProcessor";
import { db } from "../../db";
import { AlertCircle, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function TaxCharts({ spedId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    if (!spedId) return;

    const fetchDataAndProcess = async () => {
      setLoading(true);
      try {
        const [docs, itemsC190, itemsC170] = await Promise.all([
          db.documents.where({ spedId }).toArray(),
          db.items.where({ spedId }).toArray(),
          db.items_c170.where({ spedId }).toArray(),
        ]);

        const workerInput = {
          docs: docs.map((d) => ({
            id: d.id,
            date: d.dataDocumento,
            type: d.indicadorOperacao,
          })),
          itemsC190: itemsC190.map((i) => ({
            documentId: i.documentId,
            cfop: i.cfop,
            valorIcms: i.valorIcms,
            valorIpi: i.valorIpi,
          })),
          itemsC170: itemsC170.map((i) => ({
            documentId: i.documentId,
            cfop: i.cfop,
            valorPis: i.valorPis,
            valorCofins: i.valorCofins,
          })),
        };

        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL("../../workers/taxAnalysisWorker.ts", import.meta.url),
            { type: "module" }
          );
        }

        workerRef.current.onmessage = (e) => {
          if (e.data.error) {
            console.error(e.data.error);
          } else {
            setData(e.data);
          }
          setLoading(false);
        };

        workerRef.current.postMessage(workerInput);
      } catch (error) {
        console.error("Error preparing tax data:", error);
        setLoading(false);
      }
    };

    fetchDataAndProcess();
  }, [spedId]);

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Spinner />
      </div>
    );
  if (!data) return null;

  const taxes = [
    { key: "icms", label: "ICMS", color: "#3B82F6" },
    { key: "ipi", label: "IPI", color: "#F59E0B" },
    { key: "pis", label: "PIS", color: "#10B981" },
    { key: "cofins", label: "COFINS", color: "#EF4444" },
  ];

  const chartData = {
    labels: taxes.map((t) => t.label),
    datasets: [
      {
        label: "Débitos (Saídas)",
        data: taxes.map((t) => data[t.key].totalDebito),
        backgroundColor: "rgba(239, 68, 68, 0.7)",
        borderRadius: 4,
      },
      {
        label: "Créditos (Entradas)",
        data: taxes.map((t) => data[t.key].totalCredito),
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { boxWidth: 12, usePointStyle: true },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${formatarMoeda(context.raw)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { borderDash: [2, 2] },
        ticks: {
          callback: (value) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(0) + "k";
            return value;
          },
          font: { size: 10 },
        },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  const hasPisCofins =
    data.pis.totalDebito > 0 ||
    data.pis.totalCredito > 0 ||
    data.cofins.totalDebito > 0 ||
    data.cofins.totalCredito > 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {!hasPisCofins && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r text-yellow-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>
            Atenção: Não foram identificados valores de PIS/COFINS nos registros C170
            deste arquivo. Verifique se a empresa apura estes impostos pelo SPED Fiscal.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {taxes.map((tax) => {
          const info = data[tax.key];
          const saldo = info.totalDebito - info.totalCredito;
          const isZero = info.totalDebito === 0 && info.totalCredito === 0;

          return (
            <Card
              key={tax.key}
              className={`p-3 border-l-4 shadow-sm hover:shadow-md transition-shadow ${isZero ? "opacity-70" : ""}`}
              style={{ borderLeftColor: tax.color }}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {tax.label}
                </h3>
                {isZero && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    Sem movimento
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-red-400" /> Débito
                  </span>
                  <span className="font-semibold text-gray-700">
                    {formatarMoeda(info.totalDebito)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-green-400" /> Crédito
                  </span>
                  <span className="font-semibold text-gray-700">
                    {formatarMoeda(info.totalCredito)}
                  </span>
                </div>
                <div className="pt-1.5 mt-1 border-t border-dashed flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-600">Saldo</span>
                  <span
                    className={
                      saldo > 0
                        ? "text-red-600"
                        : saldo < 0
                          ? "text-green-600"
                          : "text-gray-400"
                    }
                  >
                    {formatarMoeda(Math.abs(saldo))}{" "}
                    {saldo > 0 ? " (Pagar)" : saldo < 0 ? " (Cred)" : ""}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-500" />
            Comparativo de Carga Tributária
          </h3>
          <div className="h-64">
            <Bar data={chartData} options={options} />
          </div>
        </Card>

        <Card className="p-0 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Maiores Impactos (ICMS)
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 p-0">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">CFOP</th>
                  <th className="px-3 py-2 text-right font-medium">Débito</th>
                  <th className="px-3 py-2 text-right font-medium">Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.icms.topCfops.length > 0 ? (
                  data.icms.topCfops.map((item) => (
                    <tr key={item.cfop} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">
                        {item.cfop}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {formatarMoeda(item.debito)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-600">
                        {formatarMoeda(item.credito)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                      Nenhum dado disponível
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
