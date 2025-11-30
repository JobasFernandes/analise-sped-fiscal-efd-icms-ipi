import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

// Polyfill IndexedDB for Dexie in Node/Vitest
(globalThis as any).indexedDB = indexedDB;
(globalThis as any).IDBKeyRange = IDBKeyRange;
Dexie.dependencies.indexedDB = indexedDB as any;
Dexie.dependencies.IDBKeyRange = IDBKeyRange as any;

const SAMPLE_CNPJ = "12345678000190";
const SAMPLE_COMPANY = "Empresa Teste";
const PERIODO_INICIO = "2024-01-01";
const PERIODO_FIM = "2024-01-31";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe12345678901234567890123456789012345678901234">
      <ide>
        <dhEmi>2024-01-15T10:00:00-03:00</dhEmi>
        <dhRecbto>2024-01-15T11:00:00-03:00</dhRecbto>
        <tpNF>1</tpNF>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
      </ide>
      <emit>
        <CNPJ>${SAMPLE_CNPJ}</CNPJ>
      </emit>
      <dest>
        <CNPJ>00999999000100</CNPJ>
      </dest>
      <det nItem="1">
        <prod>
          <CFOP>5102</CFOP>
          <vProd>150.00</vProd>
          <qCom>1</qCom>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <pICMS>18</pICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vProd>150.00</vProd>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>12345678901234567890123456789012345678901234</chNFe>
      <cStat>100</cStat>
      <dhRecbto>2024-01-15T11:02:00-03:00</dhRecbto>
    </infProt>
  </protNFe>
</nfeProc>`;

function makeSampleSpedData() {
  return {
    entradas: [],
    saidas: [
      {
        numeroDoc: "S1",
        chaveNfe: "CHAVE-S1",
        dataDocumento: new Date("2024-01-15"),
        dataEntradaSaida: new Date("2024-01-15"),
        valorDocumento: 200,
        valorMercadoria: 200,
        indicadorOperacao: "1",
        situacao: "00",
        itens: [
          {
            cfop: "5102",
            valorOperacao: 200,
            cstIcms: "00",
            aliqIcms: 18,
            valorBcIcms: 200,
            valorIcms: 36,
          },
        ],
      },
    ],
    totalEntradas: 0,
    totalSaidas: 200,
    totalGeral: 200,
    periodo: { inicio: new Date(PERIODO_INICIO), fim: new Date(PERIODO_FIM) },
    saidasPorCfopArray: [{ cfop: "5102", valor: 200 }],
    cnpj: SAMPLE_CNPJ,
    companyName: SAMPLE_COMPANY,
  } as any;
}

let db: any;
let addSped: any;
let importarXmlNotas: any;
let gerarComparativoSpedXml: any;
let saveSpedAggregations: any;
let getSpedProcessed: any;
let limparXmlDados: any;

async function resetDb() {
  await db.transaction(
    "rw",
    [
      db.sped_files,
      db.documents,
      db.items,
      db.items_c170,
      db.day_aggs,
      db.cfop_aggs,
      db.day_cfop_aggs,
      db.xml_notas,
      db.xml_day_cfop_aggs,
    ],
    async () => {
      await Promise.all([
        db.items.clear(),
        db.documents.clear(),
        db.sped_files.clear(),
        db.items_c170.clear(),
        db.day_aggs.clear(),
        db.cfop_aggs.clear(),
        db.day_cfop_aggs.clear(),
        db.xml_notas.clear(),
        db.xml_day_cfop_aggs.clear(),
      ]);
    }
  );
}

describe("Fluxo completo SPED x XML", () => {
  beforeAll(async () => {
    const dbMod = await import("../src/db");
    db = dbMod.db;
    const spedDao = await import("../src/db/daos/spedDao");
    addSped = spedDao.addSped;
    saveSpedAggregations = spedDao.saveSpedAggregations;
    const spedProcessedDao = await import("../src/db/daos/spedProcessedDao");
    getSpedProcessed = spedProcessedDao.getSpedProcessed;
    const xmlDao = await import("../src/db/daos/xmlDao");
    importarXmlNotas = xmlDao.importarXmlNotas;
    limparXmlDados = xmlDao.limparXmlDados;
    const comparisonService = await import("../src/utils/comparisonService");
    gerarComparativoSpedXml = comparisonService.gerarComparativoSpedXml;
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("atualiza o comparativo após importar XML", async () => {
    const data = makeSampleSpedData();
    const spedId = await addSped(data, {
      filename: "teste.txt",
      size: 1,
    });
    await saveSpedAggregations(spedId, data);

    const carregado = await getSpedProcessed(spedId);
    expect(carregado.cnpj).toBe(SAMPLE_CNPJ);
    expect(carregado.companyName).toBe(SAMPLE_COMPANY);
    expect(carregado.periodo?.inicio).toBe(PERIODO_INICIO);
    expect(carregado.periodo?.fim).toBe(PERIODO_FIM);

    const antes = await gerarComparativoSpedXml(spedId, {
      inicio: PERIODO_INICIO,
      fim: PERIODO_FIM,
    });
    expect(antes.totalXml).toBe(0);

    await importarXmlNotas([{ name: "nota.xml", content: SAMPLE_XML }], {
      dataInicio: PERIODO_INICIO,
      dataFim: PERIODO_FIM,
      somenteVendasDiretas: true,
      cfopsVendaPermitidos: ["5102"],
    });

    const semCnpj = await gerarComparativoSpedXml(spedId, {
      inicio: PERIODO_INICIO,
      fim: PERIODO_FIM,
    });
    expect(semCnpj.totalXml).toBe(0);

    await limparXmlDados();

    await importarXmlNotas([{ name: "nota.xml", content: SAMPLE_XML }], {
      cnpjBase: SAMPLE_CNPJ,
      dataInicio: PERIODO_INICIO,
      dataFim: PERIODO_FIM,
      somenteVendasDiretas: true,
      cfopsVendaPermitidos: ["5102"],
    });

    const depois = await gerarComparativoSpedXml(spedId, {
      inicio: PERIODO_INICIO,
      fim: PERIODO_FIM,
    });

    expect(depois.totalXml).toBeGreaterThan(0);
    const linha = depois.linhas.find(
      (l: { cfop: string; data: string }) =>
        l.cfop === "5102" && l.data === "2024-01-15"
    );
    expect(linha).toBeTruthy();
    expect(linha?.xmlVProd || 0).toBeCloseTo(150);
  });
});
