import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { prepararDadosEntradasSaidasPorDia, formatarMoeda } from '../../utils/dataProcessor';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const EntradasSaidasComparativoChart = ({ entradas, saidas }) => {
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
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.y)}`,
        },
      },
    },
    interaction: { intersect: false, mode: 'index' },
    elements: { line: { tension: 0.2 }, point: { radius: 3, hoverRadius: 5 } },
  };
  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default EntradasSaidasComparativoChart;
