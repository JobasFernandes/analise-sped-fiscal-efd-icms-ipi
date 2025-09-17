import React, { useRef } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  prepararDadosDistribuicaoCfop,
  formatarMoeda,
} from "../../utils/dataProcessor";
import { downloadChartImage } from "../../utils/chartExport";

ChartJS.register(ArcElement, Tooltip, Legend);

const DistribuicaoCfopChart = ({
  dados,
  limite = 8,
  exportFilename = "distribuicao_cfop",
  title = "Distribuição CFOP",
}) => {
  const chartRef = useRef(null);
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível para exibição</p>
      </div>
    );
  }

  const chartData = prepararDadosDistribuicaoCfop(dados, limite);
  const total = dados.reduce((acc, item) => acc + item.valor, 0);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          font: {
            size: 11,
          },
          padding: 15,
          generateLabels: function (chart) {
            const data = chart.data;
            return data.labels.map((label, index) => {
              const value = data.datasets[0].data[index];
              const percentage = ((value / total) * 100).toFixed(1);
              return {
                text: `${label} (${percentage}%)`,
                fillStyle: data.datasets[0].backgroundColor[index],
                strokeStyle: data.datasets[0].borderColor[index],
                lineWidth: data.datasets[0].borderWidth,
                hidden: false,
                index: index,
              };
            });
          },
        },
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
            const cfopData = dados[index];
            return cfopData ? `CFOP ${cfopData.cfop}` : context[0].label;
          },
          label: function (context) {
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return [`Valor: ${formatarMoeda(value)}`, `Participação: ${percentage}%`];
          },
          afterLabel: function (context) {
            const index = context.dataIndex;
            const cfopData = dados[index];
            if (cfopData && cfopData.descricao && cfopData.cfop !== "OUTROS") {
              return cfopData.descricao;
            }
            return null;
          },
        },
      },
    },
    cutout: "60%",
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    },
  };

  const centerTextPlugin = {
    id: "centerText",
    afterDraw: function (chart) {
      const { ctx } = chart;
      ctx.save();

      let centerX;
      let centerY;
      const meta = chart.getDatasetMeta(0);
      if (meta && meta.data && meta.data.length) {
        centerX = meta.data[0].x;
        centerY = meta.data[0].y;
      } else if (chart.chartArea) {
        const { left, top, width, height } = chart.chartArea;
        centerX = left + width / 2;
        centerY = top + height / 2;
      } else {
        centerX = chart.width / 2;
        centerY = chart.height / 2;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#374151";
      ctx.fillText("Total", centerX, centerY - 10);

      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#059669";
      ctx.fillText(formatarMoeda(total), centerX, centerY + 10);

      ctx.restore();
    },
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
        <Doughnut
          ref={chartRef}
          data={chartData}
          options={options}
          plugins={[centerTextPlugin]}
        />
      </div>
    </div>
  );
};

export default DistribuicaoCfopChart;
