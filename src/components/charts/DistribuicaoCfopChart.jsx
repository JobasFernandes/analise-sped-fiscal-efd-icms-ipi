import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { prepararDadosDistribuicaoCfop, formatarMoeda, formatarNumero } from '../../utils/dataProcessor';

// Registra os componentes necessários do Chart.js
ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Componente de gráfico de rosca para distribuição por CFOP
 */
const DistribuicaoCfopChart = ({ dados, limite = 8 }) => {
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Nenhum dado disponível para exibição</p>
      </div>
    );
  }

  const chartData = prepararDadosDistribuicaoCfop(dados, limite);
  const total = dados.reduce((acc, item) => acc + item.valor, 0);

  // Configurações do gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 11
          },
          padding: 15,
          generateLabels: function(chart) {
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
                index: index
              };
            });
          }
        }
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
            const cfopData = dados[index];
            return cfopData ? `CFOP ${cfopData.cfop}` : context[0].label;
          },
          label: function(context) {
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return [
              `Valor: ${formatarMoeda(value)}`,
              `Participação: ${percentage}%`
            ];
          },
          afterLabel: function(context) {
            const index = context.dataIndex;
            const cfopData = dados[index];
            if (cfopData && cfopData.descricao && cfopData.cfop !== 'OUTROS') {
              return cfopData.descricao;
            }
            return null;
          }
        }
      }
    },
    cutout: '60%',
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    }
  };

  // Centro do gráfico com total
  const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: function(chart) {
      const { width, height, ctx } = chart;
      ctx.restore();
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Texto principal
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#374151';
      ctx.fillText('Total', centerX, centerY - 10);
      
      // Valor
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#059669';
      ctx.fillText(formatarMoeda(total), centerX, centerY + 10);
      
      ctx.save();
    }
  };

  return (
    <div className="h-64 w-full">
      <Doughnut data={chartData} options={options} plugins={[centerTextPlugin]} />
    </div>
  );
};

export default DistribuicaoCfopChart; 