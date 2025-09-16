export function downloadChartImage(chart, filenameBase = "grafico") {
  if (!chart) return;
  try {
    const ts = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
    const filename = `${filenameBase}_${ts}.png`;

    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#0b1220" : "#ffffff";

    const srcCanvas = chart.canvas;
    const tmp = document.createElement("canvas");
    tmp.width = srcCanvas.width;
    tmp.height = srcCanvas.height;
    const ctx = tmp.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(srcCanvas, 0, 0);

    const link = document.createElement("a");
    link.href = tmp.toDataURL("image/png", 1);
    link.download = filename;
    link.click();
  } catch (e) {
    console.warn("Falha ao exportar gráfico", e);
  }
}
