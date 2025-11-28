export const generateSpedText = (treeData: any[], editData: any) => {
  let spedText = "";

  const flatNodes: any[] = [];
  treeData.forEach((node: any) => {
    flatNodes.push(node);
    if (node.children) {
      node.children.forEach((child: any) => {
        flatNodes.push(child);
        if (child.children) {
          flatNodes.push(...child.children);
        }
      });
    }
  });

  const registrosPorTipo = flatNodes.reduce((acc: any, node: any) => {
    const tipo = node.type;
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(node);
    return acc;
  }, {});

  if (editData.companyName || editData.cnpj) {
    spedText += `|0000|014|0|${editData.periodo?.inicio || ""}|${editData.periodo?.fim || ""}|${editData.companyName || ""}|${editData.cnpj || ""}|${editData.inscricaoEstadual || ""}|||\n`;
  }

  if (registrosPorTipo["C100"]) {
    registrosPorTipo["C100"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|C100|0|1|${dados.chaveNfe || ""}|2|00|${dados.numeroNota}|${dados.serie}|${dados.dataEmissao}|${dados.participante}|${dados.valorTotal}|${dados.baseCalculoIcms || ""}|${dados.valorIcms || ""}|${dados.valorIpi || ""}|${dados.valorPis || ""}|${dados.valorCofins || ""}|\n`;
    });
  }

  if (registrosPorTipo["C170"]) {
    registrosPorTipo["C170"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|C170|${dados.numeroItem}|${dados.codigoProduto}|${dados.descricaoProduto}|${dados.cfop}|${dados.unidade}|${dados.quantidade}|${dados.valorUnitario}|${dados.valorTotal}|${dados.aliqIcms || ""}|${dados.valorBcIcms || ""}|${dados.valorIcms || ""}|${dados.cstIpi || ""}|${dados.aliqIpi || ""}|${dados.vlIpi || ""}|${dados.cstPis || ""}|${dados.aliqPis || ""}|${dados.vlPis || ""}|${dados.cstCofins || ""}|${dados.aliqCofins || ""}|${dados.vlCofins || ""}|\n`;
    });
  }

  if (registrosPorTipo["C190"]) {
    registrosPorTipo["C190"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|C190|${dados.cstIcms || ""}|${dados.cfop || ""}|${dados.aliquota || ""}|${dados.valorOperacao || ""}|${dados.valorBcIcms || ""}|${dados.valorIcms || ""}|${dados.valorBcIcmsSt || ""}|${dados.valorIcmsSt || ""}|${dados.valorReducaoBC || ""}|${dados.valorIpi || ""}|\n`;
    });
  }

  if (registrosPorTipo["D100"]) {
    registrosPorTipo["D100"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|D100|0|1|${dados.chaveNfe || ""}|2|00|${dados.numeroNota}|${dados.serie}|${dados.dataEmissao}|${dados.participante}|${dados.valorTotal}|${dados.baseCalculoIcms || ""}|${dados.valorIcms || ""}|${dados.valorIpi || ""}|${dados.valorPis || ""}|${dados.valorCofins || ""}|\n`;
    });
  }

  if (registrosPorTipo["D170"]) {
    registrosPorTipo["D170"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|D170|${dados.numeroItem}|${dados.codigoProduto}|${dados.descricaoProduto}|${dados.cfop}|${dados.unidade}|${dados.quantidade}|${dados.valorUnitario}|${dados.valorTotal}|${dados.aliqIcms || ""}|${dados.valorBcIcms || ""}|${dados.valorIcms || ""}|${dados.cstIpi || ""}|${dados.aliqIpi || ""}|${dados.vlIpi || ""}|${dados.cstPis || ""}|${dados.aliqPis || ""}|${dados.vlPis || ""}|${dados.cstCofins || ""}|${dados.aliqCofins || ""}|${dados.vlCofins || ""}|\n`;
    });
  }

  if (registrosPorTipo["D190"]) {
    registrosPorTipo["D190"].forEach((node: any) => {
      const dados = node.dados;
      spedText += `|D190|${dados.cstIcms || ""}|${dados.cfop || ""}|${dados.aliquota || ""}|${dados.valorOperacao || ""}|${dados.valorBcIcms || ""}|${dados.valorIcms || ""}|${dados.valorBcIcmsSt || ""}|${dados.valorIcmsSt || ""}|${dados.valorReducaoBC || ""}|${dados.valorIpi || ""}|\n`;
    });
  }

  spedText += "|E001|0|\n";
  spedText += "|E100|0|\n";
  spedText += "|E200|0|\n";
  spedText += "|H001|0|\n";
  spedText += "|H005|0|\n";
  spedText += "|G001|0|\n";
  spedText += "|9001|0|\n";
  spedText += "|9900|0000|1|\n";
  spedText += "|9999|1|\n";

  return spedText;
};
