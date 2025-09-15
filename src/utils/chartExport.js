// Utilitário para exportar gráficos Chart.js como PNG
export function downloadChartImage(chart, filenameBase = 'grafico') {
  if (!chart) return;
  try {
    const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const filename = `${filenameBase}_${ts}.png`;
    const link = document.createElement('a');
    link.href = chart.toBase64Image('image/png', 1);
    link.download = filename;
    link.click();
  } catch (e) {
    console.warn('Falha ao exportar gráfico', e);
  }
}
