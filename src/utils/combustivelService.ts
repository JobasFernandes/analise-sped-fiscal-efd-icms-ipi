/**
 * Serviço de análise de inconsistências em movimentação de combustíveis
 *
 * Detecta:
 * - Estoque final > inicial sem nota de entrada
 * - Perdas/sobras acima do limite legal
 * - Divergências entre tanques e total do produto
 * - Divergências entre bicos e vendas do tanque
 * - Cruzamento com documentos fiscais (NFC-e/NF-e)
 */

import { db } from "../db/index";
import type {
  CombustivelMovDiariaRow,
  CombustivelTanqueRow,
  CombustivelBicoRow,
  CombustivelInconsistenciaRow,
  DocumentRow,
  ItemC170Row,
} from "../db/index";
import type {
  InconsistenciaCombustivel,
  TipoInconsistenciaCombustivel,
  SeveridadeInconsistencia,
  ComparativoVendasCombustivel,
} from "./types";
import {
  getMovimentacoesDiariasBySpedId,
  getTanquesBySpedAndData,
  getBicosByTanque,
  saveInconsistencias,
  clearInconsistencias,
} from "../db/daos/combustivelDao";

// =====================================================
// CONSTANTES E LIMITES LEGAIS
// =====================================================

/**
 * Limite de perda/sobra permitido para combustíveis (em %)
 * Conforme Resolução ANP nº 23/2004 - Art. 9º
 * O limite de 0,6% aplica-se a todos os combustíveis líquidos
 * derivados de petróleo e álcool combustível.
 */
const LIMITE_PERDA_ANP = 0.6;

/**
 * Limites de perda por tipo de combustível (em %)
 * Usando o limite único da ANP de 0,6% para todos
 */
const LIMITES_PERDA: Record<string, number> = {
  DEFAULT: LIMITE_PERDA_ANP,
};

/**
 * Limites de sobra por tipo de combustível (em %)
 * O mesmo limite de 0,6% da ANP aplica-se a sobras
 */
const LIMITES_SOBRA: Record<string, number> = {
  DEFAULT: LIMITE_PERDA_ANP,
};

/**
 * CFOPs de venda de combustíveis
 */
const CFOPS_VENDA_COMBUSTIVEL = [
  "5102", // Venda de mercadoria adquirida
  "5405", // Venda de mercadoria adquirida de terceiro, sujeita a ST
  "5656", // Venda de combustível ou lubrificante adquirido de terceiro (ST)
  "5667", // Venda de combustível a consumidor final
  "6102", // Venda de mercadoria interestadual
  "6405", // Venda de mercadoria interestadual (ST)
  "6656", // Venda de combustível interestadual (ST)
];

/**
 * CFOPs de entrada de combustíveis
 */
const CFOPS_ENTRADA_COMBUSTIVEL = [
  "1102", // Compra para comercialização
  "1403", // Compra para comercialização (ST)
  "1652", // Compra de combustível para comercialização
  "1653", // Compra de combustível de terceiro (ST)
  "2102", // Compra interestadual
  "2403", // Compra interestadual (ST)
  "2652", // Compra de combustível interestadual
  "2653", // Compra de combustível interestadual (ST)
];

// =====================================================
// FUNÇÕES DE DETECÇÃO DE INCONSISTÊNCIAS
// =====================================================

/**
 * Analisa todas as inconsistências de um arquivo SPED
 */
export async function analisarInconsistencias(
  spedId: number
): Promise<InconsistenciaCombustivel[]> {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  // Limpar inconsistências anteriores
  await clearInconsistencias(spedId);

  // Buscar movimentações diárias
  const movimentacoes = await getMovimentacoesDiariasBySpedId(spedId);

  if (movimentacoes.length === 0) {
    return [];
  }

  // 1. Verificar estoque inicial vs final sem entrada
  const inconsEstoque = await verificarEstoqueSemEntrada(spedId, movimentacoes);
  inconsistencias.push(...inconsEstoque);

  // 2. Verificar perdas/sobras acima do limite
  const inconsPerdasSobras = verificarPerdasSobrasAcimaLimite(spedId, movimentacoes);
  inconsistencias.push(...inconsPerdasSobras);

  // 3. Verificar divergências entre tanques e total do produto
  const inconsTanques = await verificarDivergenciasTanques(spedId, movimentacoes);
  inconsistencias.push(...inconsTanques);

  // 4. Verificar divergências entre bicos e vendas
  const inconsBicos = await verificarDivergenciasBicos(spedId);
  inconsistencias.push(...inconsBicos);

  // 5. Cruzar com documentos fiscais
  const inconsDocumentos = await cruzarComDocumentosFiscais(spedId, movimentacoes);
  inconsistencias.push(...inconsDocumentos);

  // Salvar inconsistências no banco
  await saveInconsistencias(inconsistencias);

  return inconsistencias;
}

/**
 * Verifica se houve aumento de estoque sem nota fiscal de entrada
 */
async function verificarEstoqueSemEntrada(
  spedId: number,
  movimentacoes: CombustivelMovDiariaRow[]
): Promise<InconsistenciaCombustivel[]> {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  // Agrupar por produto e ordenar por data
  const porProduto = new Map<string, CombustivelMovDiariaRow[]>();
  for (const m of movimentacoes) {
    if (!porProduto.has(m.codItem)) {
      porProduto.set(m.codItem, []);
    }
    porProduto.get(m.codItem)!.push(m);
  }

  for (const [codItem, movs] of porProduto.entries()) {
    // Ordenar por data
    movs.sort((a, b) => a.dtMov.localeCompare(b.dtMov));

    for (let i = 1; i < movs.length; i++) {
      const anterior = movs[i - 1];
      const atual = movs[i];

      // Se estoque final do dia anterior + entrada declarada < estoque inicial atual
      // Significa que houve "aparecimento" de combustível sem entrada
      const estoqueEsperado = anterior.qtdFimContabil;
      const estoqueInicial = atual.qtdIni;

      // Se entrada declarada é zero mas estoque aumentou
      if (atual.qtdEntr === 0 && estoqueInicial > estoqueEsperado + 0.01) {
        const diferenca = estoqueInicial - estoqueEsperado;
        const percentual =
          estoqueEsperado > 0 ? (diferenca / estoqueEsperado) * 100 : 100;

        inconsistencias.push({
          spedId,
          tipo: "ESTOQUE_MAIOR_SEM_ENTRADA",
          severidade: percentual > 5 ? "CRITICO" : "AVISO",
          codItem,
          dtMov: atual.dtMov,
          valorEsperado: estoqueEsperado,
          valorEncontrado: estoqueInicial,
          diferenca,
          percentualDiferenca: percentual,
          descricao: `Estoque inicial de ${estoqueInicial.toFixed(3)}L é maior que o esperado (${estoqueEsperado.toFixed(3)}L do dia anterior) sem nota de entrada declarada. Diferença: ${diferenca.toFixed(3)}L (${percentual.toFixed(2)}%)`,
          detectedAt: new Date().toISOString(),
        });
      }

      // Verificar estoque negativo
      if (atual.qtdFimFisico < 0 || atual.qtdFimContabil < 0) {
        inconsistencias.push({
          spedId,
          tipo: "ESTOQUE_NEGATIVO",
          severidade: "CRITICO",
          codItem,
          dtMov: atual.dtMov,
          valorEsperado: 0,
          valorEncontrado: Math.min(atual.qtdFimFisico, atual.qtdFimContabil),
          diferenca: Math.min(atual.qtdFimFisico, atual.qtdFimContabil),
          percentualDiferenca: 100,
          descricao: `Estoque negativo detectado: Físico=${atual.qtdFimFisico.toFixed(3)}L, Contábil=${atual.qtdFimContabil.toFixed(3)}L`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return inconsistencias;
}

/**
 * Verifica perdas e sobras acima do limite legal
 */
function verificarPerdasSobrasAcimaLimite(
  spedId: number,
  movimentacoes: CombustivelMovDiariaRow[]
): InconsistenciaCombustivel[] {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  for (const m of movimentacoes) {
    if (m.qtdDisponivel <= 0) continue;

    const limitePerda = LIMITES_PERDA[m.codItem] || LIMITES_PERDA.DEFAULT;
    const limiteSobra = LIMITES_SOBRA[m.codItem] || LIMITES_SOBRA.DEFAULT;

    const percentualPerda = (m.qtdPerda / m.qtdDisponivel) * 100;
    const percentualSobra = (m.qtdSobra / m.qtdDisponivel) * 100;

    // Verificar perda acima do limite
    if (percentualPerda > limitePerda) {
      inconsistencias.push({
        spedId,
        tipo: "PERDA_ACIMA_LIMITE",
        severidade: percentualPerda > limitePerda * 2 ? "CRITICO" : "AVISO",
        codItem: m.codItem,
        dtMov: m.dtMov,
        valorEsperado: (limitePerda / 100) * m.qtdDisponivel,
        valorEncontrado: m.qtdPerda,
        diferenca: m.qtdPerda - (limitePerda / 100) * m.qtdDisponivel,
        percentualDiferenca: percentualPerda,
        descricao: `Perda de ${m.qtdPerda.toFixed(3)}L (${percentualPerda.toFixed(2)}%) excede o limite de ${limitePerda}% para este combustível. Total disponível: ${m.qtdDisponivel.toFixed(3)}L`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Verificar sobra acima do limite
    if (percentualSobra > limiteSobra) {
      inconsistencias.push({
        spedId,
        tipo: "SOBRA_ACIMA_LIMITE",
        severidade: percentualSobra > limiteSobra * 2 ? "CRITICO" : "AVISO",
        codItem: m.codItem,
        dtMov: m.dtMov,
        valorEsperado: (limiteSobra / 100) * m.qtdDisponivel,
        valorEncontrado: m.qtdSobra,
        diferenca: m.qtdSobra - (limiteSobra / 100) * m.qtdDisponivel,
        percentualDiferenca: percentualSobra,
        descricao: `Sobra de ${m.qtdSobra.toFixed(3)}L (${percentualSobra.toFixed(2)}%) excede o limite de ${limiteSobra}%. Sobras excessivas podem indicar adulteração ou erro de medição.`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return inconsistencias;
}

/**
 * Verifica se a soma dos tanques bate com o total do produto (1300)
 */
async function verificarDivergenciasTanques(
  spedId: number,
  movimentacoes: CombustivelMovDiariaRow[]
): Promise<InconsistenciaCombustivel[]> {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  for (const m of movimentacoes) {
    const tanques = await getTanquesBySpedAndData(spedId, m.dtMov);
    const tanquesDoProduto = tanques.filter((t) => t.codItem === m.codItem);

    if (tanquesDoProduto.length === 0) continue;

    // Somar vendas de todos os tanques
    const somaVendasTanques = tanquesDoProduto.reduce((acc, t) => acc + t.qtdVendas, 0);
    const somaEntradasTanques = tanquesDoProduto.reduce((acc, t) => acc + t.qtdEntr, 0);

    // Verificar divergência nas vendas
    const difVendas = Math.abs(m.qtdVendas - somaVendasTanques);
    if (difVendas > 0.01) {
      // Tolerância de 0.01L
      const percentual = m.qtdVendas > 0 ? (difVendas / m.qtdVendas) * 100 : 100;

      inconsistencias.push({
        spedId,
        tipo: "DIVERGENCIA_TANQUES",
        severidade: percentual > 1 ? "CRITICO" : "AVISO",
        codItem: m.codItem,
        dtMov: m.dtMov,
        valorEsperado: m.qtdVendas,
        valorEncontrado: somaVendasTanques,
        diferenca: difVendas,
        percentualDiferenca: percentual,
        descricao: `Soma das vendas dos tanques (${somaVendasTanques.toFixed(3)}L) diverge do total do produto (${m.qtdVendas.toFixed(3)}L). ${tanquesDoProduto.length} tanque(s) encontrado(s).`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Verificar divergência nas entradas
    const difEntradas = Math.abs(m.qtdEntr - somaEntradasTanques);
    if (difEntradas > 0.01 && m.qtdEntr > 0) {
      const percentual = (difEntradas / m.qtdEntr) * 100;

      inconsistencias.push({
        spedId,
        tipo: "DIVERGENCIA_TANQUES",
        severidade: percentual > 1 ? "CRITICO" : "AVISO",
        codItem: m.codItem,
        dtMov: m.dtMov,
        valorEsperado: m.qtdEntr,
        valorEncontrado: somaEntradasTanques,
        diferenca: difEntradas,
        percentualDiferenca: percentual,
        descricao: `Soma das entradas dos tanques (${somaEntradasTanques.toFixed(3)}L) diverge do total do produto (${m.qtdEntr.toFixed(3)}L).`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return inconsistencias;
}

/**
 * Verifica se a soma das vendas por bico bate com as vendas do tanque
 */
async function verificarDivergenciasBicos(
  spedId: number
): Promise<InconsistenciaCombustivel[]> {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  // Buscar todos os tanques
  const tanques = await db.combustivel_tanque.where({ spedId }).toArray();

  for (const t of tanques) {
    const bicos = await getBicosByTanque(spedId, t.numTanque);
    const bicosDaData = bicos.filter((b) => b.dtMov === t.dtMov);

    if (bicosDaData.length === 0) continue;

    const somaVendasBicos = bicosDaData.reduce((acc, b) => acc + b.qtdVendas, 0);
    const difVendas = Math.abs(t.qtdVendas - somaVendasBicos);

    if (difVendas > 0.01) {
      const percentual = t.qtdVendas > 0 ? (difVendas / t.qtdVendas) * 100 : 100;

      inconsistencias.push({
        spedId,
        tipo: "DIVERGENCIA_BICOS",
        severidade: percentual > 1 ? "CRITICO" : "AVISO",
        codItem: t.codItem,
        dtMov: t.dtMov,
        numTanque: t.numTanque,
        valorEsperado: t.qtdVendas,
        valorEncontrado: somaVendasBicos,
        diferenca: difVendas,
        percentualDiferenca: percentual,
        descricao: `Soma das vendas dos bicos (${somaVendasBicos.toFixed(3)}L) diverge das vendas do tanque ${t.numTanque} (${t.qtdVendas.toFixed(3)}L). ${bicosDaData.length} bico(s).`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return inconsistencias;
}

/**
 * Cruza vendas declaradas no 1300 com documentos fiscais (NFC-e/NF-e)
 */
async function cruzarComDocumentosFiscais(
  spedId: number,
  movimentacoes: CombustivelMovDiariaRow[]
): Promise<InconsistenciaCombustivel[]> {
  const inconsistencias: InconsistenciaCombustivel[] = [];

  // Buscar documentos de saída (vendas) do SPED
  const documentos = await db.documents
    .where({ spedId, indicadorOperacao: "1" })
    .toArray();

  // Buscar itens C170 para obter detalhes de quantidade
  const itensC170 = await db.items_c170.where({ spedId }).toArray();

  // Criar mapa de itens por documento
  const itensPorDocumento = new Map<string, ItemC170Row[]>();
  for (const item of itensC170) {
    if (!itensPorDocumento.has(item.documentId)) {
      itensPorDocumento.set(item.documentId, []);
    }
    itensPorDocumento.get(item.documentId)!.push(item);
  }

  // Agrupar movimentações por data e produto
  const movsPorDiaProduto = new Map<string, CombustivelMovDiariaRow>();
  for (const m of movimentacoes) {
    const key = `${m.dtMov}|${m.codItem}`;
    movsPorDiaProduto.set(key, m);
  }

  // Agrupar vendas por data e código de item
  const vendasPorDiaProduto = new Map<
    string,
    { quantidade: number; valor: number; documentos: string[] }
  >();

  for (const doc of documentos) {
    if (!doc.dataDocumento) continue;

    const itens = itensPorDocumento.get(doc.id!) || [];

    for (const item of itens) {
      // Verificar se é venda de combustível
      if (!item.cfop || !CFOPS_VENDA_COMBUSTIVEL.includes(item.cfop)) continue;
      if (!item.codItem) continue;

      const key = `${doc.dataDocumento}|${item.codItem}`;

      if (!vendasPorDiaProduto.has(key)) {
        vendasPorDiaProduto.set(key, { quantidade: 0, valor: 0, documentos: [] });
      }

      const venda = vendasPorDiaProduto.get(key)!;
      venda.quantidade += item.quantidade || 0;
      venda.valor += item.valorItem || 0;
      if (doc.chaveNfe && !venda.documentos.includes(doc.chaveNfe)) {
        venda.documentos.push(doc.chaveNfe);
      }
    }
  }

  // Comparar movimentações com vendas em documentos
  for (const [key, mov] of movsPorDiaProduto.entries()) {
    const vendaDoc = vendasPorDiaProduto.get(key);

    if (!vendaDoc) {
      // Se há vendas declaradas mas não há documentos
      if (mov.qtdVendas > 0) {
        inconsistencias.push({
          spedId,
          tipo: "DIVERGENCIA_DOCUMENTOS",
          severidade: "AVISO",
          codItem: mov.codItem,
          dtMov: mov.dtMov,
          valorEsperado: mov.qtdVendas,
          valorEncontrado: 0,
          diferenca: mov.qtdVendas,
          percentualDiferenca: 100,
          descricao: `Vendas de ${mov.qtdVendas.toFixed(3)}L declaradas no registro 1300, mas nenhum documento fiscal de venda encontrado para este produto nesta data.`,
          detectedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Comparar quantidades
    const diferenca = Math.abs(mov.qtdVendas - vendaDoc.quantidade);
    const percentual = mov.qtdVendas > 0 ? (diferenca / mov.qtdVendas) * 100 : 100;

    // Tolerância de 1% ou 10 litros, o que for maior
    const tolerancia = Math.max(mov.qtdVendas * 0.01, 10);

    if (diferenca > tolerancia) {
      inconsistencias.push({
        spedId,
        tipo: "DIVERGENCIA_DOCUMENTOS",
        severidade: percentual > 5 ? "CRITICO" : "AVISO",
        codItem: mov.codItem,
        dtMov: mov.dtMov,
        valorEsperado: mov.qtdVendas,
        valorEncontrado: vendaDoc.quantidade,
        diferenca,
        percentualDiferenca: percentual,
        descricao: `Vendas declaradas (${mov.qtdVendas.toFixed(3)}L) divergem das vendas em documentos fiscais (${vendaDoc.quantidade.toFixed(3)}L). Diferença: ${diferenca.toFixed(3)}L (${percentual.toFixed(2)}%). ${vendaDoc.documentos.length} documento(s).`,
        documentosRelacionados: vendaDoc.documentos.slice(0, 10), // Limitar a 10 documentos
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Verificar entradas sem documentos
  for (const mov of movimentacoes) {
    if (mov.qtdEntr <= 0) continue;

    // Buscar documentos de entrada na data
    const docsEntrada = documentos.filter(
      (d) => d.dataDocumento === mov.dtMov && d.indicadorOperacao === "0"
    );

    // Se há entrada declarada mas não há documentos
    // Verificar nos itens se há entrada de combustível
    let totalEntradaDocs = 0;
    for (const doc of await db.documents
      .where({ spedId, indicadorOperacao: "0" })
      .toArray()) {
      if (doc.dataDocumento !== mov.dtMov) continue;

      const itens = itensPorDocumento.get(doc.id!) || [];
      for (const item of itens) {
        if (
          item.codItem === mov.codItem &&
          item.cfop &&
          CFOPS_ENTRADA_COMBUSTIVEL.includes(item.cfop)
        ) {
          totalEntradaDocs += item.quantidade || 0;
        }
      }
    }

    const diferenca = Math.abs(mov.qtdEntr - totalEntradaDocs);
    const tolerancia = Math.max(mov.qtdEntr * 0.01, 10);

    if (diferenca > tolerancia && totalEntradaDocs === 0) {
      inconsistencias.push({
        spedId,
        tipo: "ENTRADA_SEM_DOCUMENTO",
        severidade: "AVISO",
        codItem: mov.codItem,
        dtMov: mov.dtMov,
        valorEsperado: 0,
        valorEncontrado: mov.qtdEntr,
        diferenca: mov.qtdEntr,
        percentualDiferenca: 100,
        descricao: `Entrada de ${mov.qtdEntr.toFixed(3)}L declarada no registro 1300, mas nenhuma nota fiscal de entrada encontrada para este produto nesta data.`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return inconsistencias;
}

// =====================================================
// FUNÇÕES DE RELATÓRIO E COMPARATIVO
// =====================================================

/**
 * Gera comparativo de vendas: SPED 1300 vs Documentos Fiscais
 */
export async function gerarComparativoVendas(
  spedId: number
): Promise<ComparativoVendasCombustivel[]> {
  const comparativos: ComparativoVendasCombustivel[] = [];

  const movimentacoes = await getMovimentacoesDiariasBySpedId(spedId);
  const documentos = await db.documents
    .where({ spedId, indicadorOperacao: "1" })
    .toArray();
  const itensC170 = await db.items_c170.where({ spedId }).toArray();

  // Criar mapa de itens por documento
  const itensPorDocumento = new Map<string, ItemC170Row[]>();
  for (const item of itensC170) {
    if (!itensPorDocumento.has(item.documentId)) {
      itensPorDocumento.set(item.documentId, []);
    }
    itensPorDocumento.get(item.documentId)!.push(item);
  }

  for (const mov of movimentacoes) {
    const comparativo: ComparativoVendasCombustivel = {
      codItem: mov.codItem,
      dtMov: mov.dtMov,
      vendasSped: mov.qtdVendas,
      vendasNfce: 0,
      vendasNfe: 0,
      totalDocumentos: 0,
      diferenca: 0,
      percentualDiferenca: 0,
      documentosVenda: [],
    };

    // Buscar vendas em documentos
    for (const doc of documentos) {
      if (doc.dataDocumento !== mov.dtMov) continue;

      const itens = itensPorDocumento.get(doc.id!) || [];
      for (const item of itens) {
        if (item.codItem !== mov.codItem) continue;
        if (!item.cfop || !CFOPS_VENDA_COMBUSTIVEL.includes(item.cfop)) continue;

        const quantidade = item.quantidade || 0;
        const valor = item.valorItem || 0;

        // Determinar se é NFe ou NFCe pelo modelo na chave
        const modelo = doc.chaveNfe?.substring(20, 22);
        const isNfce = modelo === "65";

        if (isNfce) {
          comparativo.vendasNfce += quantidade;
        } else {
          comparativo.vendasNfe += quantidade;
        }

        comparativo.documentosVenda.push({
          chave: doc.chaveNfe,
          numero: doc.numeroDoc,
          tipo: isNfce ? "NFCE" : "NFE",
          valor,
          quantidade,
        });
      }
    }

    comparativo.totalDocumentos = comparativo.vendasNfce + comparativo.vendasNfe;
    comparativo.diferenca = comparativo.vendasSped - comparativo.totalDocumentos;
    comparativo.percentualDiferenca =
      comparativo.vendasSped > 0
        ? (Math.abs(comparativo.diferenca) / comparativo.vendasSped) * 100
        : 0;

    comparativos.push(comparativo);
  }

  return comparativos;
}

/**
 * Gera resumo de inconsistências agrupadas por tipo e severidade
 */
export async function gerarResumoInconsistencias(spedId: number): Promise<{
  total: number;
  porTipo: Record<string, number>;
  porSeveridade: Record<SeveridadeInconsistencia, number>;
  criticas: InconsistenciaCombustivel[];
}> {
  const inconsistencias = await db.combustivel_inconsistencias
    .where({ spedId })
    .toArray();

  const porTipo: Record<string, number> = {};
  const porSeveridade: Record<SeveridadeInconsistencia, number> = {
    INFO: 0,
    AVISO: 0,
    CRITICO: 0,
  };
  const criticas: InconsistenciaCombustivel[] = [];

  for (const i of inconsistencias) {
    porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
    porSeveridade[i.severidade]++;

    if (i.severidade === "CRITICO") {
      criticas.push({
        ...i,
        documentosRelacionados: i.documentosRelacionados
          ? JSON.parse(i.documentosRelacionados)
          : undefined,
      } as InconsistenciaCombustivel);
    }
  }

  return {
    total: inconsistencias.length,
    porTipo,
    porSeveridade,
    criticas,
  };
}

/**
 * Obtém descrição legível do tipo de inconsistência
 */
export function getDescricaoTipoInconsistencia(
  tipo: TipoInconsistenciaCombustivel
): string {
  const descricoes: Record<TipoInconsistenciaCombustivel, string> = {
    ESTOQUE_MAIOR_SEM_ENTRADA:
      "Estoque inicial maior que o esperado sem nota de entrada",
    PERDA_ACIMA_LIMITE: "Perda de combustível acima do limite legal",
    SOBRA_ACIMA_LIMITE: "Sobra de combustível acima do limite aceitável",
    DIVERGENCIA_TANQUES: "Divergência entre soma dos tanques e total do produto",
    DIVERGENCIA_BICOS: "Divergência entre soma dos bicos e vendas do tanque",
    DIVERGENCIA_DOCUMENTOS: "Divergência entre vendas declaradas e documentos fiscais",
    ENTRADA_SEM_DOCUMENTO: "Entrada de combustível sem nota fiscal",
    ESTOQUE_NEGATIVO: "Estoque de combustível ficou negativo",
    VARIACAO_ANOMALA: "Variação de estoque fora do padrão histórico",
  };

  return descricoes[tipo] || tipo;
}
