import { useMemo } from "react";
import { FileText, Package, BarChart3 } from "lucide-react";

export const useSpedTree = (editData) => {
  const treeData = useMemo(() => {
    if (!editData) return [];

    const tree = [];
    let nodeId = 0;

    const processSaidas = (notas) => {
      (notas || []).forEach((nota) => {
        const notaNode = {
          id: `c100-${nodeId++}`,
          type: "C100",
          categoria: "saidas",
          level: 0,
          isExpandable: true,
          icon: FileText,
          dados: {
            numeroNota: nota.numeroDoc || nota.numeroNota || "",
            serie: nota.serie || "001",
            dataEmissao: nota.dataDocumento || nota.dataEmissao || "",
            participante: nota.participante || "",
            valorTotal: nota.valorDocumento || nota.valorTotal || 0,
            cfop: nota.cfop || "",
            chaveNfe: nota.chaveNfe || "",
            situacao: nota.situacao || "",
            baseCalculoIcms: nota.baseCalculoIcms || 0,
            valorIcms: nota.valorIcms || 0,
            valorIpi: nota.valorIpi || 0,
            valorPis: nota.valorPis || 0,
            valorCofins: nota.valorCofins || 0,
          },
          children: [],
        };

        // Seção de Itens (C170)
        if (nota.itensC170 && nota.itensC170.length > 0) {
          const itensSection = {
            id: `itens-section-${nodeId++}`,
            type: "ITENS_SECTION",
            categoria: "saidas",
            level: 1,
            isExpandable: true,
            icon: Package,
            parentId: notaNode.id,
            dados: {
              titulo: "Itens da Nota (C170)",
              totalItens: nota.itensC170.length,
            },
            children: [],
          };

          nota.itensC170.forEach((item) => {
            itensSection.children.push({
              id: `c170-${nodeId++}`,
              type: "C170",
              categoria: "saidas",
              level: 2,
              isExpandable: false,
              icon: Package,
              parentId: itensSection.id,
              dados: {
                numeroItem: item.numeroItem || "",
                codigoProduto: item.codigoProduto || "",
                descricaoProduto: item.descricaoProduto || "",
                quantidade: item.quantidade || 0,
                unidade: item.unidade || "",
                valorUnitario: item.valorUnitario || 0,
                valorTotal: item.valorTotal || 0,
                cfop: item.cfop || "",
                cstIcms: item.cst || item.cstIcms || "",
                aliqIcms: item.aliqIcms || 0,
                valorBcIcms: item.valorBcIcms || 0,
                valorIcms: item.valorIcms || 0,
                cstIpi: item.cstIpi || "",
                aliqIpi: item.aliqIpi || 0,
                vlIpi: item.vlIpi || 0,
                cstPis: item.cstPis || "",
                aliqPis: item.aliqPis || 0,
                vlPis: item.vlPis || 0,
                cstCofins: item.cstCofins || "",
                aliqCofins: item.aliqCofins || 0,
                vlCofins: item.vlCofins || 0,
              },
            });
          });

          notaNode.children.push(itensSection);
        }

        // Seção de Totais por CFOP (C190)
        if (nota.itens && nota.itens.length > 0) {
          const totaisSection = {
            id: `totais-section-${nodeId++}`,
            type: "TOTAIS_SECTION",
            categoria: "saidas",
            level: 1,
            isExpandable: true,
            icon: BarChart3,
            parentId: notaNode.id,
            dados: {
              titulo: "Totais por CFOP (C190)",
              totalCfops: nota.itens.length,
            },
            children: [],
          };

          nota.itens.forEach((item) => {
            totaisSection.children.push({
              id: `c190-${nodeId++}`,
              type: "C190",
              categoria: "saidas",
              level: 2,
              isExpandable: false,
              icon: BarChart3,
              parentId: totaisSection.id,
              dados: {
                cfop: item.cfop || "",
                cstIcms: item.cstIcms || "",
                aliquota: item.aliquota || item.aliqIcms || 0,
                valorOperacao: item.valorOperacao || 0,
                valorTotal: item.valorTotal || 0,
                baseCalculo: item.baseCalculo || 0,
                valorBcIcms: item.valorBcIcms || 0,
                valorIcms: item.valorIcms || 0,
                valorBcIcmsSt: item.valorBcIcmsSt || 0,
                valorIcmsSt: item.valorIcmsSt || 0,
                valorReducaoBC: item.valorReducaoBC || 0,
                valorIpi: item.valorIpi || 0,
              },
            });
          });

          notaNode.children.push(totaisSection);
        }

        tree.push(notaNode);
      });
    };

    const processEntradas = (entradas) => {
      (entradas || []).forEach((entrada) => {
        const entradaNode = {
          id: `d100-${nodeId++}`,
          type: "D100",
          categoria: "entradas",
          level: 0,
          isExpandable: true,
          icon: FileText,
          dados: {
            numeroNota: entrada.numeroDoc || entrada.numeroNota || "",
            serie: entrada.serie || "001",
            dataEmissao: entrada.dataDocumento || entrada.dataEmissao || "",
            participante: entrada.participante || "",
            valorTotal: entrada.valorDocumento || entrada.valorTotal || 0,
            cfop: entrada.cfop || "",
            chaveNfe: entrada.chaveNfe || "",
            situacao: entrada.situacao || "",
            baseCalculoIcms: entrada.baseCalculoIcms || 0,
            valorIcms: entrada.valorIcms || 0,
            valorIpi: entrada.valorIpi || 0,
            valorPis: entrada.valorPis || 0,
            valorCofins: entrada.valorCofins || 0,
          },
          children: [],
        };

        // Seção de Itens (D170)
        if (entrada.itensD170 && entrada.itensD170.length > 0) {
          const itensSection = {
            id: `itens-section-${nodeId++}`,
            type: "ITENS_SECTION",
            categoria: "entradas",
            level: 1,
            isExpandable: true,
            icon: Package,
            parentId: entradaNode.id,
            dados: {
              titulo: "Itens da Nota (D170)",
              totalItens: entrada.itensD170.length,
            },
            children: [],
          };

          entrada.itensD170.forEach((item) => {
            itensSection.children.push({
              id: `d170-${nodeId++}`,
              type: "D170",
              categoria: "entradas",
              level: 2,
              isExpandable: false,
              icon: Package,
              parentId: itensSection.id,
              dados: {
                numeroItem: item.numeroItem || "",
                codigoProduto: item.codigoProduto || "",
                descricaoProduto: item.descricaoProduto || "",
                quantidade: item.quantidade || 0,
                unidade: item.unidade || "",
                valorUnitario: item.valorUnitario || 0,
                valorTotal: item.valorTotal || 0,
                cfop: item.cfop || "",
                cstIcms: item.cst || item.cstIcms || "",
                aliqIcms: item.aliqIcms || 0,
                valorBcIcms: item.valorBcIcms || 0,
                valorIcms: item.valorIcms || 0,
                cstIpi: item.cstIpi || "",
                aliqIpi: item.aliqIpi || 0,
                vlIpi: item.vlIpi || 0,
                cstPis: item.cstPis || "",
                aliqPis: item.aliqPis || 0,
                vlPis: item.vlPis || 0,
                cstCofins: item.cstCofins || "",
                aliqCofins: item.aliqCofins || 0,
                vlCofins: item.vlCofins || 0,
              },
            });
          });

          entradaNode.children.push(itensSection);
        }

        // Seção de Totais por CFOP (D190)
        if (entrada.itens && entrada.itens.length > 0) {
          const totaisSection = {
            id: `totais-section-${nodeId++}`,
            type: "TOTAIS_SECTION",
            categoria: "entradas",
            level: 1,
            isExpandable: true,
            icon: BarChart3,
            parentId: entradaNode.id,
            dados: {
              titulo: "Totais por CFOP (D190)",
              totalCfops: entrada.itens.length,
            },
            children: [],
          };

          entrada.itens.forEach((item) => {
            totaisSection.children.push({
              id: `d190-${nodeId++}`,
              type: "D190",
              categoria: "entradas",
              level: 2,
              isExpandable: false,
              icon: BarChart3,
              parentId: totaisSection.id,
              dados: {
                cfop: item.cfop || "",
                cstIcms: item.cstIcms || "",
                aliquota: item.aliquota || item.aliqIcms || 0,
                valorOperacao: item.valorOperacao || 0,
                valorTotal: item.valorTotal || 0,
                baseCalculo: item.baseCalculo || 0,
                valorBcIcms: item.valorBcIcms || 0,
                valorIcms: item.valorIcms || 0,
                valorBcIcmsSt: item.valorBcIcmsSt || 0,
                valorIcmsSt: item.valorIcmsSt || 0,
                valorReducaoBC: item.valorReducaoBC || 0,
                valorIpi: item.valorIpi || 0,
              },
            });
          });

          entradaNode.children.push(totaisSection);
        }

        tree.push(entradaNode);
      });
    };

    processSaidas(editData.saidas);
    processEntradas(editData.entradas);

    return tree;
  }, [editData]);

  return treeData;
};
