import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: "currency" | "number" | "percent" | "date";
}

interface ReportConfig {
  title: string;
  subtitle?: string;
  company?: string;
  cnpj?: string;
  period?: string;
  columns: ReportColumn[];
  data: Record<string, unknown>[];
  totals?: Record<string, number>;
  filename: string;
  orientation?: "portrait" | "landscape";
}

interface WorkerMessage {
  type: string;
  config?: ReportConfig;
  format?: "pdf" | "excel";
  reportType?: string;
  dados?: unknown;
  meta?: { company?: string; cnpj?: string; period?: string };
}

const formatters = {
  currency: (v: unknown) => {
    const num = Number(v) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },
  number: (v: unknown) => {
    const num = Number(v) || 0;
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },
  percent: (v: unknown) => {
    const num = Number(v) || 0;
    return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  },
  date: (v: unknown) => {
    if (!v) return "-";
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-");
      return `${d}/${m}/${y}`;
    }
    return str;
  },
};

const formatValue = (value: unknown, format?: ReportColumn["format"]): string => {
  if (value === null || value === undefined) return "-";
  if (!format) return String(value);
  return formatters[format]?.(value) ?? String(value);
};

function sendProgress(percent: number, message: string) {
  self.postMessage({ type: "progress", percent, message });
}

function generatePdf(config: ReportConfig): ArrayBuffer {
  const {
    title,
    subtitle,
    company,
    cnpj,
    period,
    columns,
    data,
    totals,
    orientation = "portrait",
  } = config;

  sendProgress(10, "Inicializando documento...");

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 15;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, yPos, { align: "center" });
  yPos += 6;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(100);
  if (company) {
    doc.text(company, pageWidth / 2, yPos, { align: "center" });
    yPos += 4;
  }
  if (cnpj) {
    doc.text(`CNPJ: ${cnpj}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 4;
  }
  if (period) {
    doc.text(`Periodo: ${period}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 4;
  }

  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, yPos, {
    align: "center",
  });
  yPos += 8;
  doc.setTextColor(0);

  sendProgress(20, "Preparando dados da tabela...");

  const tableHeaders = columns.map((c) => c.header);
  const totalRows = data.length;
  const tableData: string[][] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    tableData.push(columns.map((col) => formatValue(row[col.key], col.format)));

    if (i % 500 === 0) {
      const pct = 20 + Math.floor((i / totalRows) * 50);
      sendProgress(pct, `Processando linha ${i + 1} de ${totalRows}...`);
    }
  }

  if (totals && Object.keys(totals).length > 0) {
    const totalRow = columns.map((col) => {
      if (col.key === columns[0].key) return "TOTAL";
      if (totals[col.key] !== undefined)
        return formatValue(totals[col.key], col.format);
      return "";
    });
    tableData.push(totalRow);
  }

  sendProgress(75, "Gerando tabela no PDF...");

  const columnStyles: Record<number, { halign: "left" | "center" | "right" }> = {};
  columns.forEach((col, idx) => {
    if (col.align) {
      columnStyles[idx] = { halign: col.align };
    } else if (
      col.format === "currency" ||
      col.format === "number" ||
      col.format === "percent"
    ) {
      columnStyles[idx] = { halign: "right" };
    }
  });

  autoTable(doc, {
    startY: yPos,
    head: [tableHeaders],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
      fontStyle: "bold",
      lineWidth: 0.2,
      lineColor: [180, 180, 180],
    },
    bodyStyles: {
      textColor: [60, 60, 60],
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles,
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Pagina ${hookData.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  sendProgress(95, "Finalizando PDF...");

  return doc.output("arraybuffer");
}

function generateExcel(config: ReportConfig): ArrayBuffer {
  const { title, company, cnpj, period, columns, data, totals } = config;

  sendProgress(10, "Inicializando planilha...");

  const wsData: (string | number)[][] = [];

  wsData.push([title]);
  if (company) wsData.push([`Empresa: ${company}`]);
  if (cnpj) wsData.push([`CNPJ: ${cnpj}`]);
  if (period) wsData.push([`Periodo: ${period}`]);
  wsData.push([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
  wsData.push([]);

  wsData.push(columns.map((c) => c.header));

  sendProgress(20, "Processando dados...");

  const totalRows = data.length;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    wsData.push(
      columns.map((col) => {
        const val = row[col.key];
        if (
          col.format === "currency" ||
          col.format === "number" ||
          col.format === "percent"
        ) {
          return Number(val) || 0;
        }
        return formatValue(val, col.format);
      })
    );

    if (i % 500 === 0) {
      const pct = 20 + Math.floor((i / totalRows) * 60);
      sendProgress(pct, `Processando linha ${i + 1} de ${totalRows}...`);
    }
  }

  if (totals && Object.keys(totals).length > 0) {
    wsData.push(
      columns.map((col) => {
        if (col.key === columns[0].key) return "TOTAL";
        if (totals[col.key] !== undefined) return totals[col.key];
        return "";
      })
    );
  }

  sendProgress(85, "Gerando arquivo Excel...");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((col) => ({ wch: col.width || 15 }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Relatorio");

  sendProgress(95, "Finalizando Excel...");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return wbout;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, config, format } = e.data;

  try {
    if (type === "generate" && config && format) {
      sendProgress(5, "Iniciando geracao do relatorio...");

      let result: ArrayBuffer;
      if (format === "pdf") {
        result = generatePdf(config);
      } else {
        result = generateExcel(config);
      }

      sendProgress(100, "Concluido!");

      self.postMessage({
        type: "done",
        data: result,
        filename: `${config.filename}.${format === "pdf" ? "pdf" : "xlsx"}`,
        mimeType:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
