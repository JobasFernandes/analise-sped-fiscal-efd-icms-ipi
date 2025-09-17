import React, { useRef } from "react";
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
import { prepararDadosVendasPorCfop, formatarMoeda } from "../../utils/dataProcessor";
import { downloadChartImage } from "../../utils/chartExport";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const VendasPorCfopChart = ({
  dados,
  limite = 10,
  exportFilename = "vendas_por_cfop",
  title = "Vendas por CFOP",
}) => {
  const chartRef = useRef(null);
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível para exibição</p>
      </div>
    );
  }

  const chartData = prepararDadosVendasPorCfop(dados, limite);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(0, 0, 0, 0.8)",
        borderWidth: 1,
        cornerRadius: 6,
        callbacks: {
          title: function (context) {
            const index = context[0].dataIndex;
            const cfop = dados[index];
            return `CFOP ${cfop.cfop}`;
          },
          label: function (context) {
            return `Vendas: ${formatarMoeda(context.parsed.y)}`;
          },
          afterLabel: function (context) {
            const index = context.dataIndex;
            const cfop = dados[index];
            return cfop.descricao;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          maxRotation: 45,
          callback: function (value, index) {
            const cfop = dados[index];
            return cfop ? cfop.cfop : "";
          },
        },
      },
      y: {
        grid: {
          display: true,
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          font: {
            size: 11,
          },
          callback: function (value) {
            return formatarMoeda(value);
          },
        },
      },
    },
    elements: {
      bar: {
        borderRadius: 4,
        borderSkipped: false,
      },
    },
  };

  const data = {
    ...chartData,
    datasets: chartData.datasets.map((dataset) => ({
      ...dataset,
      backgroundColor: "rgba(59, 130, 246, 0.7)",
      borderColor: "#3B82F6",
      borderWidth: 1,
      hoverBackgroundColor: "rgba(59, 130, 246, 0.9)",
      hoverBorderColor: "#1D4ED8",
    })),
  };

  return (
    <div className="h-80 w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => downloadChartImage(chartRef.current, exportFilename)}
            className="px-2 py-1 text-xs rounded bg-white border border-gray-300 hover:bg-gray-50 shadow-sm"
          >
            PNG
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-1.25rem)]">
        <Bar ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
};

export default VendasPorCfopChart;
