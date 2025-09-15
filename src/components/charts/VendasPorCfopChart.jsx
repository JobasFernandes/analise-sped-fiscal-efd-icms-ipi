import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { prepararDadosVendasPorCfop, formatarMoeda } from '../../utils/dataProcessor';

// Registra os componentes necessários do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Componente de gráfico de barras para vendas por CFOP
 */
const VendasPorCfopChart = ({ dados, limite = 10 }) => {
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível para exibição</p>
      </div>
    );
  }

  const chartData = prepararDadosVendasPorCfop(dados, limite);

  // Configurações do gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
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
          title: function(context) {
            const index = context[0].dataIndex;
            const cfop = dados[index];
            return `CFOP ${cfop.cfop}`;
          },
          label: function(context) {
            return `Vendas: ${formatarMoeda(context.parsed.y)}`;
          },
          afterLabel: function(context) {
            const index = context.dataIndex;
            const cfop = dados[index];
            return cfop.descricao;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          },
          maxRotation: 45,
          callback: function(value, index) {
            const cfop = dados[index];
            return cfop ? cfop.cfop : '';
          }
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
      bar: {
        borderRadius: 4,
        borderSkipped: false
      }
    }
  };

  // Dados do gráfico com cores gradientes
  const data = {
    ...chartData,
    datasets: chartData.datasets.map(dataset => ({
      ...dataset,
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3B82F6',
      borderWidth: 1,
      hoverBackgroundColor: 'rgba(59, 130, 246, 0.9)',
      hoverBorderColor: '#1D4ED8'
    }))
  };

  return (
    <div className="h-80 w-full">
      <Bar data={data} options={options} />
    </div>
  );
};

export default VendasPorCfopChart;