import { describe, it, expect } from "vitest";
import { SpedParser } from "../src/utils/spedParser";

describe("spedParser - Registros de Combustível", () => {
  describe("Registro 0200 - Produtos", () => {
    it("deve parsear registro 0200 corretamente", () => {
      const parser = new SpedParser();
      // Layout 0200: |0200|COD_ITEM|DESCR_ITEM|COD_BARRA|COD_ANT_ITEM|UNID_INV|TIPO_ITEM|...
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|0200|740|DIESEL S10|31259102||L|00|0,00|740|||",
        "|0200|4|GASOLINA COMUM C|27101259||L|00|0,00|4|||",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const data = parser.data;
      expect(data.produtos).toBeDefined();
      expect(data.produtos).toHaveLength(2);

      const diesel = data.produtos?.find((p) => p.codItem === "740");
      expect(diesel?.descrItem).toBe("DIESEL S10");
      expect(diesel?.unidInv).toBe("L");
      expect(diesel?.tipoItem).toBe("00");

      const gasolina = data.produtos?.find((p) => p.codItem === "4");
      expect(gasolina?.descrItem).toBe("GASOLINA COMUM C");
    });
  });

  describe("Registro 1300 - Movimentação Diária de Combustíveis", () => {
    it("deve parsear registro 1300 corretamente", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|15012025|5000,000|10000,000|15000,000|8000,000|6950,000|50,000|0,000|7000,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const data = parser.data;
      expect(data.combustivelMovDiaria).toBeDefined();
      expect(data.combustivelMovDiaria).toHaveLength(1);

      const mov = data.combustivelMovDiaria![0];
      expect(mov.codItem).toBe("740");
      expect(mov.dtMov).toBe("2025-01-15");
      expect(mov.qtdIni).toBe(5000);
      expect(mov.qtdEntr).toBe(10000);
      expect(mov.qtdDisponivel).toBe(15000);
      expect(mov.qtdVendas).toBe(8000);
      expect(mov.qtdFimFisico).toBe(6950);
      expect(mov.qtdPerda).toBe(50);
      expect(mov.qtdSobra).toBe(0);
      expect(mov.qtdFimContabil).toBe(7000);
    });

    it("deve converter data DDMMAAAA para YYYY-MM-DD", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|25122025|1000,000|0,000|1000,000|500,000|500,000|0,000|0,000|500,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const mov = parser.data.combustivelMovDiaria![0];
      expect(mov.dtMov).toBe("2025-12-25");
    });
  });

  describe("Registro 1310 - Movimentação por Tanque", () => {
    it("deve parsear registro 1310 e herdar dados do 1300", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|15012025|5000,000|10000,000|15000,000|8000,000|6950,000|50,000|0,000|7000,000|",
        "|1310|1|2500,000|5000,000|7500,000|4000,000|3475,000|25,000|0,000|3500,000|",
        "|1310|2|2500,000|5000,000|7500,000|4000,000|3475,000|25,000|0,000|3500,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const data = parser.data;
      expect(data.combustivelTanques).toBeDefined();
      expect(data.combustivelTanques).toHaveLength(2);

      const tanque1 = data.combustivelTanques![0];
      expect(tanque1.codItem).toBe("740"); // Herdado do 1300
      expect(tanque1.dtMov).toBe("2025-01-15"); // Herdado do 1300
      expect(tanque1.numTanque).toBe("1");
      expect(tanque1.qtdIni).toBe(2500);
      expect(tanque1.qtdVendas).toBe(4000);

      const tanque2 = data.combustivelTanques![1];
      expect(tanque2.numTanque).toBe("2");
    });
  });

  describe("Registro 1320 - Volume de Vendas por Bico", () => {
    it("deve parsear registro 1320 e herdar dados do 1300 e 1310", () => {
      const parser = new SpedParser();
      // Layout: |1320|NUM_BICO|NR_INTERV|MOT_INTERV|NOM_INTERV|CNPJ_INTERV|CPF_INTERV|VAL_FECHA|VAL_ABERT|VOL_AFERI|VOL_VENDAS|
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|15012025|5000,000|10000,000|15000,000|8000,000|6950,000|50,000|0,000|7000,000|",
        "|1310|1|2500,000|5000,000|7500,000|4000,000|3475,000|25,000|0,000|3500,000|",
        "|1320|01|||||12345678000199|108000,000|100000,000|0,000|8000,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const data = parser.data;
      expect(data.combustivelBicos).toBeDefined();
      expect(data.combustivelBicos).toHaveLength(1);

      const bico = data.combustivelBicos![0];
      expect(bico.codItem).toBe("740"); // Herdado do 1300
      expect(bico.dtMov).toBe("2025-01-15"); // Herdado do 1300
      expect(bico.numTanque).toBe("1"); // Herdado do 1310
      expect(bico.numBico).toBe("01");
      expect(bico.encerranteFim).toBe(108000); // VAL_FECHA
      expect(bico.encerranteIni).toBe(100000); // VAL_ABERT
      expect(bico.qtdVendas).toBe(8000);
    });

    it("deve calcular volume vendido pela diferença dos encerrantes", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|15012025|5000,000|0,000|5000,000|2000,000|3000,000|0,000|0,000|3000,000|",
        "|1310|1|5000,000|0,000|5000,000|2000,000|3000,000|0,000|0,000|3000,000|",
        "|1320|01||||||150000,000|148000,000|0,000|2000,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const bico = parser.data.combustivelBicos![0];
      // Diferença dos encerrantes deve bater com qtdVendas
      const volumeCalculado = bico.encerranteFim - bico.encerranteIni;
      expect(volumeCalculado).toBe(2000);
      expect(volumeCalculado).toBe(bico.qtdVendas);
    });
  });

  describe("getAndClearBatchData", () => {
    it("deve incluir produtos no batch", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|0200|740|DIESEL S10|31259102|L|0||00|0,00|740|||",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }

      const batch = parser.getAndClearBatchData();

      expect(batch.produtos).toBeDefined();
      expect(batch.produtos).toHaveLength(1);
      expect(batch.produtos[0].codItem).toBe("740");
      expect(batch.produtos[0].descrItem).toBe("DIESEL S10");
    });

    it("deve incluir dados de combustível no batch", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|1300|740|15012025|5000,000|0,000|5000,000|2000,000|3000,000|0,000|0,000|3000,000|",
        "|1310|1|5000,000|0,000|5000,000|2000,000|3000,000|0,000|0,000|3000,000|",
        "|1320|01||||||105000,000|103000,000|0,000|2000,000|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }

      const batch = parser.getAndClearBatchData();

      expect(batch.combustivelMovDiaria).toHaveLength(1);
      expect(batch.combustivelTanques).toHaveLength(1);
      expect(batch.combustivelBicos).toHaveLength(1);
    });

    it("deve limpar arrays após obter batch", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        "|0200|740|DIESEL S10|31259102|L|0||00|0,00|740|||",
        "|1300|740|15012025|5000,000|0,000|5000,000|2000,000|3000,000|0,000|0,000|3000,000|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }

      // Primeiro batch tem dados
      const batch1 = parser.getAndClearBatchData();
      expect(batch1.produtos).toHaveLength(1);
      expect(batch1.combustivelMovDiaria).toHaveLength(1);

      // Segundo batch está vazio
      const batch2 = parser.getAndClearBatchData();
      expect(batch2.produtos).toHaveLength(0);
      expect(batch2.combustivelMovDiaria).toHaveLength(0);
    });
  });

  describe("Hierarquia de registros", () => {
    it("deve manter hierarquia correta: 1300 -> 1310 -> 1320", () => {
      const parser = new SpedParser();
      const linhas = [
        "|0000|017|0|01012025|31012025||12345678000199|POSTO TESTE LTDA|CE|230440|3550308|",
        // Produto 1 - Diesel
        "|1300|740|15012025|10000,000|0,000|10000,000|6000,000|4000,000|0,000|0,000|4000,000|",
        "|1310|1|5000,000|0,000|5000,000|3000,000|2000,000|0,000|0,000|2000,000|",
        "|1320|01||||||103000,000|100000,000|0,000|3000,000|",
        "|1310|2|5000,000|0,000|5000,000|3000,000|2000,000|0,000|0,000|2000,000|",
        "|1320|02||||||206000,000|203000,000|0,000|3000,000|",
        // Produto 2 - Gasolina
        "|1300|4|15012025|8000,000|0,000|8000,000|4000,000|4000,000|0,000|0,000|4000,000|",
        "|1310|3|8000,000|0,000|8000,000|4000,000|4000,000|0,000|0,000|4000,000|",
        "|1320|03||||||54000,000|50000,000|0,000|4000,000|",
        "|9999|10|",
      ];

      for (const linha of linhas) {
        parser.processLine(linha);
      }
      parser.finish();

      const data = parser.data;

      // 2 movimentações diárias (1 por produto)
      expect(data.combustivelMovDiaria).toHaveLength(2);

      // 3 tanques (2 do diesel + 1 da gasolina)
      expect(data.combustivelTanques).toHaveLength(3);

      // 3 bicos (1 por tanque)
      expect(data.combustivelBicos).toHaveLength(3);

      // Verificar herança de dados
      const bicoTanque1 = data.combustivelBicos?.find((b) => b.numBico === "01");
      expect(bicoTanque1?.codItem).toBe("740");
      expect(bicoTanque1?.numTanque).toBe("1");

      const bicoTanque3 = data.combustivelBicos?.find((b) => b.numBico === "03");
      expect(bicoTanque3?.codItem).toBe("4");
      expect(bicoTanque3?.numTanque).toBe("3");
    });
  });
});
