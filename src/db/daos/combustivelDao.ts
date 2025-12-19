import {
  db,
  type CombustivelMovDiariaRow,
  type CombustivelTanqueRow,
  type CombustivelBicoRow,
  type CombustivelInconsistenciaRow,
} from "../index";
import type {
  MovimentacaoCombustivel1300,
  MovimentacaoTanque1310,
  VolumeVendasBico1320,
  InconsistenciaCombustivel,
  ResumoMovimentacaoCombustivel,
} from "../../utils/types";

/**
 * Salva movimentações diárias de combustíveis (Registro 1300)
 */
export async function saveMovimentacoesDiarias(
  spedId: number,
  movimentacoes: MovimentacaoCombustivel1300[]
): Promise<void> {
  if (!movimentacoes || movimentacoes.length === 0) return;

  const rows: CombustivelMovDiariaRow[] = movimentacoes.map((m) => ({
    spedId,
    codItem: m.codItem,
    dtMov: m.dtMov,
    qtdIni: m.qtdIni,
    qtdEntr: m.qtdEntr,
    qtdDisponivel: m.qtdDisponivel,
    qtdVendas: m.qtdVendas,
    qtdFimFisico: m.qtdFimFisico,
    qtdPerda: m.qtdPerda,
    qtdSobra: m.qtdSobra,
    qtdFimContabil: m.qtdFimContabil,
  }));

  await db.combustivel_mov_diaria.bulkAdd(rows);
}

/**
 * Salva movimentações por tanque (Registro 1310)
 */
export async function saveMovimentacoesTanques(
  spedId: number,
  tanques: MovimentacaoTanque1310[]
): Promise<void> {
  if (!tanques || tanques.length === 0) return;

  const rows: CombustivelTanqueRow[] = tanques.map((t) => ({
    spedId,
    codItem: t.codItem,
    dtMov: t.dtMov,
    numTanque: t.numTanque,
    qtdIni: t.qtdIni,
    qtdEntr: t.qtdEntr,
    qtdDisponivel: t.qtdDisponivel,
    qtdVendas: t.qtdVendas,
    qtdFimFisico: t.qtdFimFisico,
    qtdPerda: t.qtdPerda,
    qtdSobra: t.qtdSobra,
    qtdFimContabil: t.qtdFimContabil,
  }));

  await db.combustivel_tanque.bulkAdd(rows);
}

/**
 * Salva volumes de vendas por bico (Registro 1320)
 */
export async function saveVolumesBicos(
  spedId: number,
  bicos: VolumeVendasBico1320[]
): Promise<void> {
  if (!bicos || bicos.length === 0) return;

  const rows: CombustivelBicoRow[] = bicos.map((b) => ({
    spedId,
    codItem: b.codItem,
    dtMov: b.dtMov,
    numTanque: b.numTanque,
    numBico: b.numBico,
    numInterv: b.numInterv,
    motInterv: b.motInterv,
    nomInterv: b.nomInterv,
    encerranteIni: b.encerranteIni,
    encerranteFim: b.encerranteFim,
    qtdAfericao: b.qtdAfericao,
    qtdVendas: b.qtdVendas,
  }));

  await db.combustivel_bico.bulkAdd(rows);
}

/**
 * Salva inconsistências detectadas
 */
export async function saveInconsistencias(
  inconsistencias: InconsistenciaCombustivel[]
): Promise<void> {
  if (!inconsistencias || inconsistencias.length === 0) return;

  const rows: CombustivelInconsistenciaRow[] = inconsistencias.map((i) => ({
    spedId: i.spedId,
    tipo: i.tipo,
    severidade: i.severidade,
    codItem: i.codItem,
    descricaoProduto: i.descricaoProduto,
    dtMov: i.dtMov,
    numTanque: i.numTanque,
    numBico: i.numBico,
    valorEsperado: i.valorEsperado,
    valorEncontrado: i.valorEncontrado,
    diferenca: i.diferenca,
    percentualDiferenca: i.percentualDiferenca,
    descricao: i.descricao,
    documentosRelacionados: i.documentosRelacionados
      ? JSON.stringify(i.documentosRelacionados)
      : undefined,
    detectedAt: i.detectedAt,
  }));

  await db.combustivel_inconsistencias.bulkAdd(rows);
}

/**
 * Salva todos os dados de combustíveis de um batch
 */
export async function saveCombustivelBatch(
  spedId: number,
  batch: {
    combustivelMovDiaria?: MovimentacaoCombustivel1300[];
    combustivelTanques?: MovimentacaoTanque1310[];
    combustivelBicos?: VolumeVendasBico1320[];
  }
): Promise<void> {
  await Promise.all([
    saveMovimentacoesDiarias(spedId, batch.combustivelMovDiaria || []),
    saveMovimentacoesTanques(spedId, batch.combustivelTanques || []),
    saveVolumesBicos(spedId, batch.combustivelBicos || []),
  ]);
}

/**
 * Busca movimentações diárias por SPED
 */
export async function getMovimentacoesDiariasBySpedId(
  spedId: number
): Promise<CombustivelMovDiariaRow[]> {
  return await db.combustivel_mov_diaria.where({ spedId }).toArray();
}

/**
 * Busca movimentações diárias por período
 */
export async function getMovimentacoesDiariasByPeriodo(
  spedId: number,
  dtInicio: string,
  dtFim: string
): Promise<CombustivelMovDiariaRow[]> {
  return await db.combustivel_mov_diaria
    .where("[spedId+dtMov]")
    .between([spedId, dtInicio], [spedId, dtFim], true, true)
    .toArray();
}

/**
 * Busca movimentações por produto (código do item)
 */
export async function getMovimentacoesByProduto(
  spedId: number,
  codItem: string
): Promise<CombustivelMovDiariaRow[]> {
  return await db.combustivel_mov_diaria.where({ spedId, codItem }).sortBy("dtMov");
}

/**
 * Busca tanques por SPED e data
 */
export async function getTanquesBySpedAndData(
  spedId: number,
  dtMov: string
): Promise<CombustivelTanqueRow[]> {
  return await db.combustivel_tanque.where({ spedId, dtMov }).toArray();
}

/**
 * Busca tanques por produto
 */
export async function getTanquesByProduto(
  spedId: number,
  codItem: string
): Promise<CombustivelTanqueRow[]> {
  return await db.combustivel_tanque.where({ spedId, codItem }).sortBy("dtMov");
}

/**
 * Busca bicos por tanque
 */
export async function getBicosByTanque(
  spedId: number,
  numTanque: string
): Promise<CombustivelBicoRow[]> {
  return await db.combustivel_bico.where({ spedId, numTanque }).toArray();
}

/**
 * Busca inconsistências por SPED
 */
export async function getInconsistenciasBySpedId(
  spedId: number
): Promise<CombustivelInconsistenciaRow[]> {
  return await db.combustivel_inconsistencias.where({ spedId }).toArray();
}

/**
 * Busca inconsistências por severidade
 */
export async function getInconsistenciasBySeveridade(
  spedId: number,
  severidade: "INFO" | "AVISO" | "CRITICO"
): Promise<CombustivelInconsistenciaRow[]> {
  return await db.combustivel_inconsistencias.where({ spedId, severidade }).toArray();
}

/**
 * Busca inconsistências por tipo
 */
export async function getInconsistenciasByTipo(
  spedId: number,
  tipo: string
): Promise<CombustivelInconsistenciaRow[]> {
  return await db.combustivel_inconsistencias.where({ spedId, tipo }).toArray();
}

/**
 * Lista todos os produtos de combustível de um SPED
 */
export async function getProdutosCombustivel(spedId: number): Promise<string[]> {
  const movs = await db.combustivel_mov_diaria.where({ spedId }).toArray();
  const produtos = new Set(movs.map((m) => m.codItem));
  return Array.from(produtos).sort();
}

/**
 * Lista todos os tanques de um SPED
 */
export async function getTanquesUnicos(
  spedId: number
): Promise<Array<{ numTanque: string; codItem: string }>> {
  const tanques = await db.combustivel_tanque.where({ spedId }).toArray();
  const tanquesMap = new Map<string, string>();

  for (const t of tanques) {
    if (!tanquesMap.has(t.numTanque)) {
      tanquesMap.set(t.numTanque, t.codItem);
    }
  }

  return Array.from(tanquesMap.entries()).map(([numTanque, codItem]) => ({
    numTanque,
    codItem,
  }));
}

/**
 * Calcula resumo de movimentação agregando múltiplos tanques do mesmo combustível
 */
export async function getResumoMovimentacaoPorProduto(
  spedId: number,
  codItem: string,
  dtMov: string
): Promise<ResumoMovimentacaoCombustivel | null> {
  const tanques = await db.combustivel_tanque
    .where({ spedId, codItem, dtMov })
    .toArray();

  if (tanques.length === 0) return null;

  // Agregar totais de todos os tanques
  const resumo: ResumoMovimentacaoCombustivel = {
    codItem,
    dtMov,
    tanques: tanques.map((t) => ({
      codItem: t.codItem,
      dtMov: t.dtMov,
      numTanque: t.numTanque,
      qtdIni: t.qtdIni,
      qtdEntr: t.qtdEntr,
      qtdDisponivel: t.qtdDisponivel,
      qtdVendas: t.qtdVendas,
      qtdFimFisico: t.qtdFimFisico,
      qtdPerda: t.qtdPerda,
      qtdSobra: t.qtdSobra,
      qtdFimContabil: t.qtdFimContabil,
    })),
    totalQtdIni: 0,
    totalQtdEntr: 0,
    totalQtdDisponivel: 0,
    totalQtdVendas: 0,
    totalQtdFimFisico: 0,
    totalQtdPerda: 0,
    totalQtdSobra: 0,
    totalQtdFimContabil: 0,
    percentualPerda: 0,
    percentualSobra: 0,
    diferencaFisicoContabil: 0,
  };

  // Somar valores de todos os tanques
  for (const t of tanques) {
    resumo.totalQtdIni += t.qtdIni;
    resumo.totalQtdEntr += t.qtdEntr;
    resumo.totalQtdDisponivel += t.qtdDisponivel;
    resumo.totalQtdVendas += t.qtdVendas;
    resumo.totalQtdFimFisico += t.qtdFimFisico;
    resumo.totalQtdPerda += t.qtdPerda;
    resumo.totalQtdSobra += t.qtdSobra;
    resumo.totalQtdFimContabil += t.qtdFimContabil;
  }

  // Calcular métricas
  if (resumo.totalQtdDisponivel > 0) {
    resumo.percentualPerda = (resumo.totalQtdPerda / resumo.totalQtdDisponivel) * 100;
    resumo.percentualSobra = (resumo.totalQtdSobra / resumo.totalQtdDisponivel) * 100;
  }

  resumo.diferencaFisicoContabil =
    resumo.totalQtdFimFisico - resumo.totalQtdFimContabil;

  return resumo;
}

/**
 * Calcula totais de movimentação por produto em todo o período
 */
export async function getTotaisPorProduto(spedId: number): Promise<
  Array<{
    codItem: string;
    totalEntradas: number;
    totalVendas: number;
    totalPerdas: number;
    totalSobras: number;
    diasComMovimentacao: number;
  }>
> {
  const movs = await db.combustivel_mov_diaria.where({ spedId }).toArray();

  const porProduto = new Map<
    string,
    {
      totalEntradas: number;
      totalVendas: number;
      totalPerdas: number;
      totalSobras: number;
      dias: Set<string>;
    }
  >();

  for (const m of movs) {
    if (!porProduto.has(m.codItem)) {
      porProduto.set(m.codItem, {
        totalEntradas: 0,
        totalVendas: 0,
        totalPerdas: 0,
        totalSobras: 0,
        dias: new Set(),
      });
    }

    const p = porProduto.get(m.codItem)!;
    p.totalEntradas += m.qtdEntr;
    p.totalVendas += m.qtdVendas;
    p.totalPerdas += m.qtdPerda;
    p.totalSobras += m.qtdSobra;
    p.dias.add(m.dtMov);
  }

  return Array.from(porProduto.entries()).map(([codItem, dados]) => ({
    codItem,
    totalEntradas: dados.totalEntradas,
    totalVendas: dados.totalVendas,
    totalPerdas: dados.totalPerdas,
    totalSobras: dados.totalSobras,
    diasComMovimentacao: dados.dias.size,
  }));
}

/**
 * Remove todos os dados de combustíveis de um SPED
 */
export async function deleteCombustivelBySpedId(spedId: number): Promise<void> {
  await Promise.all([
    db.combustivel_mov_diaria.where({ spedId }).delete(),
    db.combustivel_tanque.where({ spedId }).delete(),
    db.combustivel_bico.where({ spedId }).delete(),
    db.combustivel_inconsistencias.where({ spedId }).delete(),
  ]);
}

/**
 * Limpa inconsistências antigas (para recálculo)
 */
export async function clearInconsistencias(spedId: number): Promise<void> {
  await db.combustivel_inconsistencias.where({ spedId }).delete();
}
