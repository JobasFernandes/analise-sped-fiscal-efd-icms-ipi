import { db, DocumentRow, ItemC170Row, ItemRow } from "../db";
import { parseXmlToSped } from "./xmlToSpedParser";

const genId = () =>
  (globalThis as any).crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function addSpedLineFromXml(
  spedId: number,
  xmlContent: string,
  cnpjSped: string
) {
  const spedData = parseXmlToSped(xmlContent, cnpjSped);
  if (!spedData) {
    throw new Error("Falha ao converter XML para estrutura SPED.");
  }

  const { c100, c170 } = spedData;

  const docId = genId();
  const dataDocISO = formatDateToISO(c100.dtDoc);
  const dataESISO = formatDateToISO(c100.dtES);

  const newDoc: DocumentRow = {
    id: docId,
    spedId,
    numeroDoc: c100.numDoc,
    chaveNfe: c100.chvNfe,
    dataDocumento: dataDocISO,
    dataEntradaSaida: dataESISO,
    indicadorOperacao: c100.indOper,
    situacao: c100.codSit,
    valorDocumento: c100.vlDoc,
    valorMercadoria: c100.vlMerc,
    source: "added", // Marca como adicionado via XML
  };

  const newItems: ItemC170Row[] = c170.map((item) => ({
    id: genId(),
    spedId,
    documentId: docId,
    numItem: item.numItem,
    codItem: item.codItem,
    descrCompl: item.descrCompl,
    quantidade: item.qtd,
    unidade: item.unid,
    valorItem: item.vlItem,
    valorDesconto: item.vlDesc,
    cfop: item.cfop,
    cstIcms: item.cstIcms,
    aliqIcms: item.aliqIcms,
    valorBcIcms: item.vlBcIcms,
    valorIcms: item.vlIcms,
    valorIpi: item.vlIpi,
    valorPis: item.vlPis,
    valorCofins: item.vlCofins,
  }));

  const c190Map = new Map<string, ItemRow>();

  for (const item of newItems) {
    const key = `${item.cfop}|${item.cstIcms}|${item.aliqIcms}`;
    if (!c190Map.has(key)) {
      c190Map.set(key, {
        id: genId(),
        spedId,
        documentId: docId,
        cfop: item.cfop || "",
        valorOperacao: 0,
        cstIcms: item.cstIcms || "",
        aliqIcms: item.aliqIcms || 0,
        valorBcIcms: 0,
        valorIcms: 0,
        valorIpi: 0,
      });
    }
    const c190 = c190Map.get(key)!;
    c190.valorOperacao += item.valorItem || 0;
    c190.valorBcIcms += item.valorBcIcms || 0;
    c190.valorIcms += item.valorIcms || 0;
    c190.valorIpi = (c190.valorIpi || 0) + (item.valorIpi || 0);
  }

  const newC190Items = Array.from(c190Map.values());

  await db.transaction(
    "rw",
    [
      db.documents,
      db.items,
      db.items_c170,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      db.sped_files,
    ],
    async () => {
      const existing = await db.documents
        .where({ spedId, chaveNfe: newDoc.chaveNfe })
        .first();

      if (existing) {
        const oldItems = await db.items
          .where({ spedId, documentId: existing.id! })
          .toArray();

        const oldItemsByCfop = oldItems.reduce(
          (acc, item) => {
            const cfop = item.cfop || "0000";
            if (!acc[cfop]) acc[cfop] = 0;
            acc[cfop] += item.valorOperacao || 0;
            return acc;
          },
          {} as Record<string, number>
        );

        const dir = existing.indicadorOperacao;
        const date = existing.dataDocumento;

        if (date) {
          const dayAgg = await db.day_aggs.where({ spedId, date, dir }).first();
          if (dayAgg) {
            await db.day_aggs.update(dayAgg.id!, {
              valor: dayAgg.valor - existing.valorDocumento,
            });
          }
        }

        for (const [cfop, valor] of Object.entries(oldItemsByCfop)) {
          const cfopAgg = await db.cfop_aggs.where({ spedId, cfop, dir }).first();
          if (cfopAgg) {
            await db.cfop_aggs.update(cfopAgg.id!, {
              valor: cfopAgg.valor - valor,
            });
          }
          if (date) {
            const dayCfopAgg = await db.day_cfop_aggs
              .where({ spedId, date, cfop, dir })
              .first();
            if (dayCfopAgg) {
              await db.day_cfop_aggs.update(dayCfopAgg.id!, {
                valor: dayCfopAgg.valor - valor,
              });
            }
          }
        }

        const spedFile = await db.sped_files.get(spedId);
        if (spedFile) {
          const isEntrada = dir === "0";
          await db.sped_files.update(spedId, {
            totalEntradas: isEntrada
              ? spedFile.totalEntradas - existing.valorDocumento
              : spedFile.totalEntradas,
            totalSaidas: !isEntrada
              ? spedFile.totalSaidas - existing.valorDocumento
              : spedFile.totalSaidas,
            totalGeral: spedFile.totalGeral - existing.valorDocumento,
            numeroNotasEntrada: isEntrada
              ? spedFile.numeroNotasEntrada - 1
              : spedFile.numeroNotasEntrada,
            numeroNotasSaida: !isEntrada
              ? spedFile.numeroNotasSaida - 1
              : spedFile.numeroNotasSaida,
          });
        }

        await db.documents.delete(existing.id!);
        await db.items.where({ documentId: existing.id! }).delete();
        await db.items_c170.where({ documentId: existing.id! }).delete();
      }

      await db.documents.add(newDoc);
      await db.items.bulkAdd(newC190Items);
      await db.items_c170.bulkAdd(newItems);

      const itemsByCfop = newItems.reduce(
        (acc, item) => {
          const cfop = item.cfop || "0000";
          if (!acc[cfop]) acc[cfop] = 0;
          acc[cfop] += item.valorItem || 0;
          return acc;
        },
        {} as Record<string, number>
      );

      const dir = newDoc.indicadorOperacao;
      const date = newDoc.dataDocumento;

      if (date) {
        const dayAgg = await db.day_aggs.where({ spedId, date, dir }).first();
        if (dayAgg) {
          await db.day_aggs.update(dayAgg.id!, {
            valor: dayAgg.valor + newDoc.valorDocumento,
          });
        } else {
          await db.day_aggs.add({
            spedId,
            date,
            dir,
            valor: newDoc.valorDocumento,
          });
        }
      }

      for (const [cfop, valor] of Object.entries(itemsByCfop)) {
        const cfopAgg = await db.cfop_aggs.where({ spedId, cfop, dir }).first();
        if (cfopAgg) {
          await db.cfop_aggs.update(cfopAgg.id!, {
            valor: cfopAgg.valor + valor,
          });
        } else {
          await db.cfop_aggs.add({
            spedId,
            cfop,
            dir,
            valor,
          });
        }

        if (date) {
          const dayCfopAgg = await db.day_cfop_aggs
            .where({ spedId, date, cfop, dir })
            .first();
          if (dayCfopAgg) {
            await db.day_cfop_aggs.update(dayCfopAgg.id!, {
              valor: dayCfopAgg.valor + valor,
            });
          } else {
            await db.day_cfop_aggs.add({
              spedId,
              date,
              cfop,
              dir,
              valor,
            });
          }
        }
      }

      const spedFile = await db.sped_files.get(spedId);
      if (spedFile) {
        const isEntrada = dir === "0";
        await db.sped_files.update(spedId, {
          totalEntradas: isEntrada
            ? spedFile.totalEntradas + newDoc.valorDocumento
            : spedFile.totalEntradas,
          totalSaidas: !isEntrada
            ? spedFile.totalSaidas + newDoc.valorDocumento
            : spedFile.totalSaidas,
          totalGeral: spedFile.totalGeral + newDoc.valorDocumento,
          numeroNotasEntrada: isEntrada
            ? spedFile.numeroNotasEntrada + 1
            : spedFile.numeroNotasEntrada,
          numeroNotasSaida: !isEntrada
            ? spedFile.numeroNotasSaida + 1
            : spedFile.numeroNotasSaida,
        });
      }
    }
  );
}

function formatDateToISO(ddmmyyyy: string): string | null {
  if (!ddmmyyyy || ddmmyyyy.length !== 8) return null;
  const day = ddmmyyyy.slice(0, 2);
  const month = ddmmyyyy.slice(2, 4);
  const year = ddmmyyyy.slice(4, 8);
  return `${year}-${month}-${day}`;
}
