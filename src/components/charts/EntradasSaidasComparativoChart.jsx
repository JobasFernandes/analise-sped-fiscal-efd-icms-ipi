import React, { useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  prepararDadosEntradasSaidasPorDia,
  formatarMoeda,
} from "../../utils/dataProcessor";
import { downloadChartImage } from "../../utils/chartExport";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const EntradasSaidasComparativoChart = ({
  entradas,
  saidas,
  exportFilename = "comparativo_entradas_saidas",
  title = "Comparativo Entradas vs Saídas",
}) => {
  const chartRef = useRef(null);
  if ((!entradas || entradas.length === 0) && (!saidas || saidas.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível</p>
      </div>
    );
  }
  const chartData = prepararDadosEntradasSaidasPorDia(entradas, saidas);
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.y)}`,
        },
      },
    },
    interaction: { intersect: false, mode: "index" },
    elements: { line: { tension: 0.2 }, point: { radius: 3, hoverRadius: 5 } },
  };
  return (
    <div className="h-64 w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => downloadChartImage(chartRef.current, exportFilename)}
            className="px-2 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-200"
          >
            PNG
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-1.25rem)]">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

export default EntradasSaidasComparativoChart;
