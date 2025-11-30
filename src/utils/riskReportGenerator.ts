import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { XmlComparativoLinha } from "./types";

export type RiskLevel = "ALTO" | "MEDIO" | "BAIXO";

export interface RiskAnalysis {
  level: RiskLevel;
  description: string;
  score: number;
}

export function calculateRisk(linha: XmlComparativoLinha): RiskAnalysis {
  const diffAbs = Math.abs(linha.diffAbs);
  const diffPerc = Math.abs(linha.diffPerc);

  if (diffAbs > 1000 || diffPerc > 5) {
    return {
      level: "ALTO",
      description:
        "Divergência significativa de valores. Possível omissão de entrada ou crédito indevido.",
      score: 80 + Math.min(20, diffPerc),
    };
  }

  if (diffAbs > 100 || diffPerc > 1) {
    return {
      level: "MEDIO",
      description:
        "Divergência moderada. Verificar lançamentos parciais ou erros de digitação.",
      score: 50 + Math.min(29, diffPerc * 5),
    };
  }

  return {
    level: "BAIXO",
    description:
      "Divergência pequena. Provável arredondamento ou diferenças de centavos.",
    score: Math.min(49, diffPerc * 10),
  };
}

export function generateRiskReportPDF(
  linhas: XmlComparativoLinha[],
  periodo: string,
  cnpj: string
) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Relatório de Riscos Fiscais - Cruzamento SPED vs XML", 14, 20);

  doc.setFontSize(12);
  doc.text(`Período: ${periodo}`, 14, 30);
  doc.text(`CNPJ: ${cnpj}`, 14, 36);
  doc.text(`Data de Geração: ${new Date().toLocaleDateString()}`, 14, 42);

  const risks = linhas.map((l) => ({ ...l, risk: calculateRisk(l) }));
  const highRisks = risks.filter((r) => r.risk.level === "ALTO");
  const mediumRisks = risks.filter((r) => r.risk.level === "MEDIO");
  const lowRisks = risks.filter((r) => r.risk.level === "BAIXO");

  doc.text(`Resumo de Riscos:`, 14, 52);
  doc.setFontSize(10);
  doc.setTextColor(220, 53, 69);
  doc.text(`- Alto Risco: ${highRisks.length} ocorrências`, 20, 58);
  doc.setTextColor(255, 193, 7);
  doc.text(`- Médio Risco: ${mediumRisks.length} ocorrências`, 20, 64);
  doc.setTextColor(40, 167, 69);
  doc.text(`- Baixo Risco: ${lowRisks.length} ocorrências`, 20, 70);
  doc.setTextColor(0, 0, 0);

  const tableData = risks
    .sort((a, b) => b.risk.score - a.risk.score)
    .map((row) => [
      row.data.split("-").reverse().join("/"),
      row.cfop,
      row.xmlVProd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      row.spedValorOperacao.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      row.diffAbs.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      row.risk.level,
    ]);

  autoTable(doc, {
    startY: 80,
    head: [["Data", "CFOP", "Valor XML", "Valor SPED", "Diferença", "Risco"]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 15 },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 20, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const riskLevel = data.cell.raw;
        if (riskLevel === "ALTO") {
          data.cell.styles.textColor = [220, 53, 69];
          data.cell.styles.fontStyle = "bold";
        } else if (riskLevel === "MEDIO") {
          data.cell.styles.textColor = [211, 84, 0];
        } else {
          data.cell.styles.textColor = [40, 167, 69];
        }
      }
    },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width - 20,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`Relatorio_Riscos_${periodo.replace(/\//g, "-")}.pdf`);
}
