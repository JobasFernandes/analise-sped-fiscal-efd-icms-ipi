import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { prepararDadosVendasPorDia, formatarMoeda } from '../../utils/dataProcessor';
import { downloadChartImage } from '../../utils/chartExport';

// Registra os componentes necessários do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Componente de gráfico de vendas por dia
 */
const VendasPorDiaChart = ({ dados, labelOverride = 'Vendas', tooltipPrefix, exportFilename, title = labelOverride }) => {
  const chartRef = useRef(null);
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível para exibição</p>
      </div>
    );
  }

  const chartData = prepararDadosVendasPorDia(dados);
  if (chartData.datasets[0]) {
    chartData.datasets[0].label = labelOverride;
  }

  // Configurações do gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(0, 0, 0, 0.8)',
        borderWidth: 1,
        cornerRadius: 6,
        callbacks: {
          label: function(context) {
            const prefix = tooltipPrefix || labelOverride;
            return `${prefix}: ${formatarMoeda(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          maxRotation: 45
        }
      },
      y: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value) {
            return formatarMoeda(value);
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2
      },
      point: {
        radius: 4,
        hoverRadius: 6,
        backgroundColor: '#3B82F6',
        borderColor: '#ffffff',
        borderWidth: 2
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Dados do gráfico com gradiente
  const data = {
    ...chartData,
    datasets: chartData.datasets.map(dataset => ({
      ...dataset,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: '#3B82F6',
      fill: true
    }))
  };

  return (
    <div className="h-64 w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 tracking-tight">{title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => downloadChartImage(chartRef.current, (exportFilename || labelOverride).replace(/\s+/g,'_').toLowerCase())}
            className="px-2 py-1 text-xs rounded bg-white border border-gray-300 hover:bg-gray-50 shadow-sm"
          >PNG</button>
        </div>
      </div>
      <div className="h-[calc(100%-1.25rem)]">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
};

export default VendasPorDiaChart;