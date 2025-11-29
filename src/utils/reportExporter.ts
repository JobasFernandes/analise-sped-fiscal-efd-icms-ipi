import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function formatCnpjForFilename(cnpj?: string): string {
  if (!cnpj) return "";
  return cnpj.replace(/\D/g, "");
}

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: "currency" | "number" | "percent" | "date";
}

export interface ReportConfig {
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

export interface ExtendedReportConfig extends Omit<ReportConfig, "columns" | "data"> {
  reportType?: string;
  columns?: ReportColumn[];
  data?: Record<string, unknown>[];
  customData?: unknown;
}

export function generateReportConfig(params: {
  reportType?: string;
  title: string;
  subtitle?: string;
  company?: string;
  cnpj?: string;
  period?: string;
  columns?: ReportColumn[];
  data?: Record<string, unknown>[];
  totals?: Record<string, number>;
  filename: string;
  orientation?: "portrait" | "landscape";
  customData?: unknown;
}): ExtendedReportConfig {
  return {
    reportType: params.reportType,
    title: params.title,
    subtitle: params.subtitle,
    company: params.company,
    cnpj: params.cnpj,
    period: params.period,
    columns: params.columns,
    data: params.data,
    totals: params.totals,
    filename: params.filename,
    orientation: params.orientation || "portrait",
    customData: params.customData,
  };
}

function toRecordArray<T extends object>(arr: T[]): Record<string, unknown>[] {
  return arr as unknown as Record<string, unknown>[];
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
    if (!v) return "—";
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-");
      return `${d}/${m}/${y}`;
    }
    return str;
  },
};

const formatValue = (value: unknown, format?: ReportColumn["format"]): string => {
  if (value === null || value === undefined) return "—";
  if (!format) return String(value);
  return formatters[format]?.(value) ?? String(value);
};

/**
 * Gera PDF minimalista com tabela de dados
 */
export function exportToPdf(config: ReportConfig): void {
  const {
    title,
    subtitle,
    company,
    cnpj,
    period,
    columns,
    data,
    totals,
    filename,
    orientation = "portrait",
  } = config;

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

  const tableHeaders = columns.map((c) => c.header);
  const tableData = data.map((row) =>
    columns.map((col) => formatValue(row[col.key], col.format))
  );

  if (totals && Object.keys(totals).length > 0) {
    const totalRow = columns.map((col) => {
      if (col.key === columns[0].key) return "TOTAL";
      if (totals[col.key] !== undefined)
        return formatValue(totals[col.key], col.format);
      return "";
    });
    tableData.push(totalRow);
  }

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

  if (totals && Object.keys(totals).length > 0) {
    // melhoria futura
  }

  doc.save(`${filename}.pdf`);
}

export function exportToExcel(config: ReportConfig): void {
  const { title, company, cnpj, period, columns, data, totals, filename } = config;

  const wsData: (string | number)[][] = [];

  wsData.push([title]);
  if (company) wsData.push([`Empresa: ${company}`]);
  if (cnpj) wsData.push([`CNPJ: ${cnpj}`]);
  if (period) wsData.push([`Periodo: ${period}`]);
  wsData.push([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
  wsData.push([]);

  wsData.push(columns.map((c) => c.header));

  data.forEach((row) => {
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
  });

  if (totals && Object.keys(totals).length > 0) {
    wsData.push(
      columns.map((col) => {
        if (col.key === columns[0].key) return "TOTAL";
        if (totals[col.key] !== undefined) return totals[col.key];
        return "";
      })
    );
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((col) => ({ wch: col.width || 15 }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Relatorio");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportReport(config: ReportConfig, format: "pdf" | "excel"): void {
  if (format === "pdf") {
    exportToPdf(config);
  } else {
    exportToExcel(config);
  }
}

export interface DivergenciaItem {
  data: string;
  cfop: string;
  valorXml: number;
  valorSped: number;
  diferenca: number;
  diferencaPercent: number;
  status: string;
}

export function gerarRelatorioDivergencias(
  divergencias: DivergenciaItem[],
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel"
): void {
  const config: ReportConfig = {
    title: "Relatorio de Divergencias SPED x XML",
    subtitle: "Comparativo de valores por data e CFOP",
    company: meta.company,
    cnpj: meta.cnpj,
    period: meta.period,
    columns: [
      { header: "Data", key: "data", format: "date", width: 12 },
      { header: "CFOP", key: "cfop", width: 8 },
      { header: "Valor XML", key: "valorXml", format: "currency", width: 15 },
      { header: "Valor SPED", key: "valorSped", format: "currency", width: 15 },
      { header: "Diferenca R$", key: "diferenca", format: "currency", width: 15 },
      { header: "Diferenca %", key: "diferencaPercent", format: "percent", width: 12 },
      { header: "Status", key: "status", width: 12 },
    ],
    data: toRecordArray(divergencias),
    totals: {
      valorXml: divergencias.reduce((acc, d) => acc + d.valorXml, 0),
      valorSped: divergencias.reduce((acc, d) => acc + d.valorSped, 0),
      diferenca: divergencias.reduce((acc, d) => acc + d.diferenca, 0),
    },
    filename: `divergencias_sped_xml_${formatCnpjForFilename(meta.cnpj)}`,
    orientation: "landscape",
  };

  exportReport(config, format);
}

export interface DivergenciaNotaDetalhe {
  chave: string;
  numero?: string;
  valorXml?: number;
  valorSped?: number;
  diff: number;
  tipo: "AMBOS" | "SOMENTE_XML" | "SOMENTE_SPED";
}

export interface DivergenciaItemDetalhado extends DivergenciaItem {
  notas?: DivergenciaNotaDetalhe[];
}

export function gerarRelatorioDivergenciasDetalhado(
  divergencias: DivergenciaItemDetalhado[],
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel"
): void {
  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Relatorio de Divergencias SPED x XML", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Comparativo detalhado por data, CFOP e notas", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 5;

    doc.setFontSize(9);
    doc.setTextColor(100);
    if (meta.company) {
      doc.text(meta.company, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    if (meta.cnpj) {
      doc.text(`CNPJ: ${meta.cnpj}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    if (meta.period) {
      doc.text(`Periodo: ${meta.period}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 8;
    doc.setTextColor(0);

    for (const div of divergencias) {
      const temDivergencia = Math.abs(div.diferencaPercent) > 0;
      const temDetalhes = div.notas && div.notas.length > 0;

      const alturaEstimada =
        temDivergencia && temDetalhes ? 15 + div.notas!.length * 6 : 12;
      if (yPos + alturaEstimada > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFillColor(
        temDivergencia ? 254 : 240,
        temDivergencia ? 242 : 253,
        temDivergencia ? 242 : 244
      );
      doc.rect(14, yPos - 4, pageWidth - 28, 10, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(
        temDivergencia ? 185 : 22,
        temDivergencia ? 28 : 163,
        temDivergencia ? 28 : 74
      );

      const dataFormatada = formatters.date(div.data);
      doc.text(`${dataFormatada} - CFOP ${div.cfop}`, 16, yPos);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const statusText = temDivergencia
        ? `DIVERGENTE (${formatters.percent(div.diferencaPercent)})`
        : "OK";
      doc.text(statusText, pageWidth - 16, yPos, { align: "right" });
      yPos += 8;

      doc.setTextColor(100);
      doc.setFontSize(8);
      const resumoText = `XML: ${formatters.currency(div.valorXml)} | SPED: ${formatters.currency(div.valorSped)} | Dif: ${formatters.currency(div.diferenca)}`;
      doc.text(resumoText, 16, yPos);
      yPos += 6;
      doc.setTextColor(0);

      if (temDivergencia && temDetalhes) {
        const notasComStatus = div.notas!.map((n) => ({
          ...n,
          isDivergente: Math.abs(n.diff) > 0.01 || n.tipo !== "AMBOS",
        }));

        autoTable(doc, {
          startY: yPos,
          head: [
            ["Numero", "Chave NFe", "Valor XML", "Valor SPED", "Diferenca", "Situacao"],
          ],
          body: notasComStatus.map((n) => [
            n.numero || "-",
            n.chave.length > 30 ? n.chave.substring(0, 30) + "..." : n.chave,
            n.valorXml ? formatters.currency(n.valorXml) : "-",
            n.valorSped ? formatters.currency(n.valorSped) : "-",
            formatters.currency(n.diff),
            n.tipo === "AMBOS"
              ? Math.abs(n.diff) > 0.01
                ? "Valor diferente"
                : "OK"
              : n.tipo === "SOMENTE_XML"
                ? "So no XML"
                : "So no SPED",
          ]),
          theme: "plain",
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: {
            fillColor: [250, 250, 250],
            fontStyle: "bold",
            textColor: [80, 80, 80],
          },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 65 },
            2: { halign: "right", cellWidth: 25 },
            3: { halign: "right", cellWidth: 25 },
            4: { halign: "right", cellWidth: 25 },
            5: { cellWidth: 28 },
          },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === "body") {
              const rowIndex = data.row.index;
              const nota = notasComStatus[rowIndex];
              if (nota && nota.isDivergente) {
                data.cell.styles.fillColor = [254, 226, 226];
                data.cell.styles.textColor = [153, 27, 27];
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 6;
      } else {
        yPos += 2;
      }
    }

    if (yPos + 20 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      yPos = 15;
    }

    doc.setDrawColor(200);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAIS GERAIS", 16, yPos);
    yPos += 5;

    const totalXml = divergencias.reduce((acc, d) => acc + d.valorXml, 0);
    const totalSped = divergencias.reduce((acc, d) => acc + d.valorSped, 0);
    const totalDif = divergencias.reduce((acc, d) => acc + d.diferenca, 0);
    const qtdDivergentes = divergencias.filter(
      (d) => Math.abs(d.diferencaPercent) > 0
    ).length;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Total XML: ${formatters.currency(totalXml)}`, 16, yPos);
    doc.text(`Total SPED: ${formatters.currency(totalSped)}`, 80, yPos);
    doc.text(`Diferenca Total: ${formatters.currency(totalDif)}`, 150, yPos);
    doc.text(`Divergencias: ${qtdDivergentes} de ${divergencias.length}`, 220, yPos);

    doc.save(`divergencias_detalhado_${formatCnpjForFilename(meta.cnpj)}.pdf`);
  } else {
    const wb = XLSX.utils.book_new();

    const resumoData: (string | number)[][] = [
      ["Relatorio de Divergencias SPED x XML - Detalhado"],
      [meta.company || ""],
      [meta.cnpj ? `CNPJ: ${meta.cnpj}` : ""],
      [meta.period ? `Periodo: ${meta.period}` : ""],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      [
        "Data",
        "CFOP",
        "Valor XML",
        "Valor SPED",
        "Diferenca R$",
        "Diferenca %",
        "Status",
      ],
      ...divergencias.map((d) => [
        formatters.date(d.data),
        d.cfop,
        d.valorXml,
        d.valorSped,
        d.diferenca,
        d.diferencaPercent,
        d.status,
      ]),
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const detalhesData: (string | number)[][] = [
      ["Detalhes das Divergencias"],
      [],
      [
        "Data",
        "CFOP",
        "Numero NF",
        "Chave NFe",
        "Valor XML",
        "Valor SPED",
        "Diferenca",
        "Situacao",
      ],
    ];

    for (const div of divergencias) {
      if (Math.abs(div.diferencaPercent) > 0 && div.notas && div.notas.length > 0) {
        for (const nota of div.notas) {
          detalhesData.push([
            formatters.date(div.data),
            div.cfop,
            nota.numero || "-",
            nota.chave,
            nota.valorXml || 0,
            nota.valorSped || 0,
            nota.diff,
            nota.tipo === "AMBOS"
              ? "Valor diferente"
              : nota.tipo === "SOMENTE_XML"
                ? "So no XML"
                : "So no SPED",
          ]);
        }
      }
    }

    if (detalhesData.length > 3) {
      const wsDetalhes = XLSX.utils.aoa_to_sheet(detalhesData);
      XLSX.utils.book_append_sheet(wb, wsDetalhes, "Detalhes Divergencias");
    }

    XLSX.writeFile(
      wb,
      `divergencias_detalhado_${formatCnpjForFilename(meta.cnpj)}.xlsx`
    );
  }
}

export interface ResumoExecutivoData {
  totalEntradas: number;
  totalSaidas: number;
  totalGeral: number;
  numeroNotasEntrada: number;
  numeroNotasSaida: number;
  ticketMedioEntrada: number;
  ticketMedioSaida: number;
  topCfops: Array<{ cfop: string; valor: number; percentual: number }>;
  entradasPorDia: Array<{ data: string; valor: number }>;
  saidasPorDia: Array<{ data: string; valor: number }>;
}

export function gerarRelatorioResumoExecutivo(
  dados: ResumoExecutivoData,
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel"
): void {
  const indicadores = [
    { indicador: "Total de Entradas", valor: dados.totalEntradas },
    { indicador: "Total de Saidas", valor: dados.totalSaidas },
    { indicador: "Total Geral", valor: dados.totalGeral },
    { indicador: "Qtd. Notas de Entrada", valor: dados.numeroNotasEntrada },
    { indicador: "Qtd. Notas de Saida", valor: dados.numeroNotasSaida },
    { indicador: "Ticket Medio Entrada", valor: dados.ticketMedioEntrada },
    { indicador: "Ticket Medio Saida", valor: dados.ticketMedioSaida },
  ];

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Executivo", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (meta.company) {
      doc.text(meta.company, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    if (meta.cnpj) {
      doc.text(`CNPJ: ${meta.cnpj}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    if (meta.period) {
      doc.text(`Periodo: ${meta.period}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 10;
    doc.setTextColor(0);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Indicadores Principais", 14, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["Indicador", "Valor"]],
      body: indicadores.map((i) => [
        i.indicador,
        i.indicador.includes("Qtd")
          ? i.valor.toLocaleString("pt-BR")
          : formatters.currency(i.valor),
      ]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    if (dados.topCfops && dados.topCfops.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Top CFOPs por Valor", 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [["CFOP", "Valor", "% do Total"]],
        body: dados.topCfops.map((c) => [
          c.cfop,
          formatters.currency(c.valor),
          formatters.percent(c.percentual),
        ]),
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      });
    }

    doc.save(`resumo_executivo_${formatCnpjForFilename(meta.cnpj)}.pdf`);
  } else {
    const wb = XLSX.utils.book_new();

    const wsIndicadores = XLSX.utils.aoa_to_sheet([
      ["Resumo Executivo"],
      [meta.company || ""],
      [meta.cnpj ? `CNPJ: ${meta.cnpj}` : ""],
      [meta.period ? `Periodo: ${meta.period}` : ""],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["Indicador", "Valor"],
      ...indicadores.map((i) => [i.indicador, i.valor]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsIndicadores, "Indicadores");

    if (dados.topCfops && dados.topCfops.length > 0) {
      const wsCfops = XLSX.utils.aoa_to_sheet([
        ["Top CFOPs por Valor"],
        [],
        ["CFOP", "Valor", "% do Total"],
        ...dados.topCfops.map((c) => [c.cfop, c.valor, c.percentual]),
      ]);
      XLSX.utils.book_append_sheet(wb, wsCfops, "Top CFOPs");
    }

    if (dados.entradasPorDia?.length > 0 || dados.saidasPorDia?.length > 0) {
      const diasMap = new Map<string, { entrada: number; saida: number }>();
      dados.entradasPorDia?.forEach((e) => {
        const atual = diasMap.get(e.data) || { entrada: 0, saida: 0 };
        atual.entrada = e.valor;
        diasMap.set(e.data, atual);
      });
      dados.saidasPorDia?.forEach((s) => {
        const atual = diasMap.get(s.data) || { entrada: 0, saida: 0 };
        atual.saida = s.valor;
        diasMap.set(s.data, atual);
      });

      const movDiaria = Array.from(diasMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, vals]) => [
          data,
          vals.entrada,
          vals.saida,
          vals.saida - vals.entrada,
        ]);

      const wsMov = XLSX.utils.aoa_to_sheet([
        ["Movimentacao Diaria"],
        [],
        ["Data", "Entradas", "Saidas", "Saldo"],
        ...movDiaria,
      ]);
      XLSX.utils.book_append_sheet(wb, wsMov, "Movimentacao Diaria");
    }

    XLSX.writeFile(wb, `resumo_executivo_${formatCnpjForFilename(meta.cnpj)}.xlsx`);
  }
}

export interface CfopDetalheItem {
  cfop: string;
  descricaoCfop?: string;
  numeroDoc: string;
  chaveNfe?: string;
  dataDocumento: string;
  cstIcms?: string;
  aliqIcms?: number;
  valorOperacao: number;
  valorBcIcms?: number;
  valorIcms?: number;
  codItem?: string;
  descricaoItem?: string;
  quantidade?: number;
  unidade?: string;
  valorUnitario?: number;
}

export function gerarRelatorioPorCfop(
  items: CfopDetalheItem[],
  cfop: string,
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel",
  incluiC170: boolean = false
): void {
  const columnsBasic: ReportColumn[] = [
    { header: "N. Doc", key: "numeroDoc", width: 10 },
    { header: "Data", key: "dataDocumento", format: "date", width: 12 },
    { header: "CST", key: "cstIcms", width: 6 },
    { header: "Aliq.", key: "aliqIcms", format: "number", width: 8 },
    { header: "Valor Op.", key: "valorOperacao", format: "currency", width: 14 },
    { header: "BC ICMS", key: "valorBcIcms", format: "currency", width: 14 },
    { header: "Valor ICMS", key: "valorIcms", format: "currency", width: 14 },
  ];

  const columnsC170: ReportColumn[] = [
    { header: "N. Doc", key: "numeroDoc", width: 10 },
    { header: "Data", key: "dataDocumento", format: "date", width: 12 },
    { header: "Cod. Item", key: "codItem", width: 12 },
    { header: "Descricao", key: "descricaoItem", width: 25 },
    { header: "Qtd", key: "quantidade", format: "number", width: 10 },
    { header: "Unid.", key: "unidade", width: 6 },
    { header: "Vlr Unit.", key: "valorUnitario", format: "currency", width: 12 },
    { header: "Valor Op.", key: "valorOperacao", format: "currency", width: 14 },
    { header: "CST", key: "cstIcms", width: 6 },
    { header: "BC ICMS", key: "valorBcIcms", format: "currency", width: 12 },
    { header: "Valor ICMS", key: "valorIcms", format: "currency", width: 12 },
  ];

  const columns = incluiC170 ? columnsC170 : columnsBasic;
  const descCfop = items[0]?.descricaoCfop || "";

  const config: ReportConfig = {
    title: `Relatorio CFOP ${cfop}`,
    subtitle: descCfop,
    company: meta.company,
    cnpj: meta.cnpj,
    period: meta.period,
    columns,
    data: toRecordArray(items),
    totals: {
      valorOperacao: items.reduce((acc, i) => acc + (i.valorOperacao || 0), 0),
      valorBcIcms: items.reduce((acc, i) => acc + (i.valorBcIcms || 0), 0),
      valorIcms: items.reduce((acc, i) => acc + (i.valorIcms || 0), 0),
    },
    filename: `relatorio_cfop_${cfop}_${formatCnpjForFilename(meta.cnpj)}`,
    orientation: "landscape",
  };

  exportReport(config, format);
}

export interface XmlIgnoradoItem {
  arquivo: string;
  chave?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  motivo: string;
  cfopsOriginais?: string[];
}

export function gerarRelatorioXmlsIgnorados(
  items: XmlIgnoradoItem[],
  totaisPorMotivo: Record<string, number>,
  meta: { company?: string; cnpj?: string },
  format: "pdf" | "excel"
): void {
  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Relatorio de XMLs Ignorados na Importacao", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (meta.company) {
      doc.text(meta.company, pageWidth / 2, yPos, { align: "center" });
      yPos += 4;
    }
    if (meta.cnpj) {
      doc.text(`CNPJ: ${meta.cnpj}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 5;
    }
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 8;
    doc.setTextColor(0);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo por Motivo", 14, yPos);
    yPos += 5;

    const motivoLabels: Record<string, string> = {
      arquivoInvalido: "Arquivo invalido",
      canceladaOuInvalida: "Cancelada/Invalida",
      cnpjDiferente: "CNPJ diferente",
      foraPeriodo: "Fora do periodo",
      duplicada: "Duplicada",
      semItensValidos: "Sem itens validos",
    };

    const resumoData = Object.entries(totaisPorMotivo)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => [motivoLabels[k] || k, v.toString()]);

    if (resumoData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [["Motivo", "Quantidade"]],
        body: resumoData,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" } },
        tableWidth: 80,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    if (items.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Detalhamento", 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [["Arquivo", "Chave NFe", "Numero", "Data", "Motivo", "CFOPs"]],
        body: items.map((i) => [
          i.arquivo || "-",
          i.chave || "-",
          i.numero || "-",
          formatters.date(i.dataEmissao),
          motivoLabels[i.motivo] || i.motivo,
          i.cfopsOriginais?.join(", ") || "-",
        ]),
        theme: "plain",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [245, 245, 245], fontStyle: "bold" },
      });
    }

    doc.save(`xmls_ignorados_${formatCnpjForFilename(meta.cnpj)}.pdf`);
  } else {
    const wb = XLSX.utils.book_new();

    const motivoLabels: Record<string, string> = {
      arquivoInvalido: "Arquivo invalido",
      canceladaOuInvalida: "Cancelada/Invalida",
      cnpjDiferente: "CNPJ diferente",
      foraPeriodo: "Fora do periodo",
      duplicada: "Duplicada",
      semItensValidos: "Sem itens validos",
    };

    const wsResumo = XLSX.utils.aoa_to_sheet([
      ["XMLs Ignorados na Importacao"],
      [meta.company || ""],
      [meta.cnpj ? `CNPJ: ${meta.cnpj}` : ""],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["Resumo por Motivo"],
      ["Motivo", "Quantidade"],
      ...Object.entries(totaisPorMotivo)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => [motivoLabels[k] || k, v]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    if (items.length > 0) {
      const wsDetalhes = XLSX.utils.aoa_to_sheet([
        ["Detalhamento de XMLs Ignorados"],
        [],
        [
          "Arquivo",
          "Chave NFe",
          "Numero",
          "Serie",
          "Data Emissao",
          "Motivo",
          "CFOPs Originais",
        ],
        ...items.map((i) => [
          i.arquivo || "",
          i.chave || "",
          i.numero || "",
          i.serie || "",
          i.dataEmissao || "",
          motivoLabels[i.motivo] || i.motivo,
          i.cfopsOriginais?.join(", ") || "",
        ]),
      ]);
      XLSX.utils.book_append_sheet(wb, wsDetalhes, "Detalhes");
    }

    XLSX.writeFile(wb, `xmls_ignorados_${formatCnpjForFilename(meta.cnpj)}.xlsx`);
  }
}

export interface NotaFiscalItem {
  numeroDoc: string;
  serie?: string;
  chaveNfe?: string;
  dataDocumento: string;
  dataEntradaSaida?: string;
  tipo: "Entrada" | "Saida";
  situacao?: string;
  valorTotal: number;
  cnpjParticipante?: string;
}

export function gerarRelatorioNotas(
  notas: NotaFiscalItem[],
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel"
): void {
  const config: ReportConfig = {
    title: "Relatorio de Notas Fiscais",
    subtitle: "Listagem completa do periodo",
    company: meta.company,
    cnpj: meta.cnpj,
    period: meta.period,
    columns: [
      { header: "Numero", key: "numeroDoc", width: 10 },
      { header: "Serie", key: "serie", width: 6 },
      { header: "Data Doc.", key: "dataDocumento", format: "date", width: 12 },
      { header: "Data E/S", key: "dataEntradaSaida", format: "date", width: 12 },
      { header: "Tipo", key: "tipo", width: 10 },
      { header: "Situacao", key: "situacao", width: 10 },
      { header: "Valor Total", key: "valorTotal", format: "currency", width: 15 },
      { header: "CNPJ Part.", key: "cnpjParticipante", width: 18 },
    ],
    data: toRecordArray(notas),
    totals: {
      valorTotal: notas.reduce((acc, n) => acc + (n.valorTotal || 0), 0),
    },
    filename: `notas_fiscais_${formatCnpjForFilename(meta.cnpj)}`,
    orientation: "landscape",
  };

  exportReport(config, format);
}

export interface CfopResumoItem {
  cfop: string;
  descricao?: string;
  valor: number;
  percentual?: number;
}

export function gerarRelatorioTodosCfops(
  items: CfopResumoItem[],
  tipo: "entradas" | "saidas",
  meta: { company?: string; cnpj?: string; period?: string },
  format: "pdf" | "excel"
): void {
  const tipoLabel = tipo === "entradas" ? "Entradas" : "Saidas";
  const total = items.reduce((acc, i) => acc + (i.valor || 0), 0);

  const itemsComPercentual = items.map((item) => ({
    ...item,
    percentual: total > 0 ? (item.valor / total) * 100 : 0,
  }));

  const config: ReportConfig = {
    title: `Relatorio de CFOPs - ${tipoLabel}`,
    subtitle: `Resumo de todos os CFOPs de ${tipoLabel.toLowerCase()} do periodo`,
    company: meta.company,
    cnpj: meta.cnpj,
    period: meta.period,
    columns: [
      { header: "CFOP", key: "cfop", width: 10 },
      { header: "Descricao", key: "descricao", width: 40 },
      { header: "Valor", key: "valor", format: "currency", width: 18 },
      { header: "% do Total", key: "percentual", format: "percent", width: 12 },
    ],
    data: toRecordArray(itemsComPercentual),
    totals: {
      valor: total,
    },
    filename: `cfops_${tipo}_${formatCnpjForFilename(meta.cnpj)}`,
    orientation: "portrait",
  };

  exportReport(config, format);
}
