import { format, parse } from "date-fns";
import { getDescricaoCfop } from "./cfopService";
import type {
  Nota,
  ItemDetalhado,
  DiaValor,
  CfopValor,
  DiaCfopValor,
  ProcessedData,
  NotaItemC170,
} from "./types";

export class SpedParser {
  data!: {
    entradas: Nota[];
    saidas: Nota[];
    entradasPorDia: Map<string, number>;
    saidasPorDia: Map<string, number>;
    entradasPorCfop: Map<string, number>;
    saidasPorCfop: Map<string, number>;
    entradasPorDiaCfop: Map<string, DiaCfopValor>;
    saidasPorDiaCfop: Map<string, DiaCfopValor>;
    itensPorCfop: Map<string, ItemDetalhado[]>;
    totalEntradas: number;
    totalSaidas: number;
    totalGeral: number;
    periodo: { inicio: Date | null; fim: Date | null };
    vendas?: Nota[];
    vendasPorDia?: Map<string, number>;
    vendasPorCfop?: Map<string, number>;
    entradasPorDiaArray?: DiaValor[];
    saidasPorDiaArray?: DiaValor[];
    entradasPorCfopArray?: CfopValor[];
    saidasPorCfopArray?: CfopValor[];
    entradasPorDiaCfopArray?: DiaCfopValor[];
    saidasPorDiaCfopArray?: DiaCfopValor[];
    itensPorCfopIndex?: Record<string, ItemDetalhado[]>;
  };
  constructor() {
    this.resetData();
  }

  /**
   * @param fileContent
   * @param onProgress
   */
  parse(
    fileContent: string,
    onProgress?: (current: number, total: number) => void
  ): ProcessedData {
    const lines = fileContent.split("\n").filter((line) => line.trim());
    this.resetData();
    let currentNota: Nota | null = null;
    const total = lines.length;
    let processed = 0;
    const STEP = 200;
    for (const line of lines) {
      try {
        const registro = this.parseRegistro(line);
        if (!registro || !registro.tipo) continue;
        if (registro.tipo === "0000") this.process0000(registro);
        else if (registro.tipo === "C100")
          currentNota = this.processC100(registro) as Nota | null;
        else if (registro.tipo === "C190" && currentNota)
          this.processC190(registro, currentNota);
        else if (registro.tipo === "C170" && currentNota)
          this.processC170(registro, currentNota);
      } catch (err) {
        console.warn("Linha SPED ignorada por erro de parsing:", err);
      } finally {
        processed++;
        if (onProgress && (processed % STEP === 0 || processed === total)) {
          try {
            onProgress(processed, total);
          } catch {
            // ignora
          }
        }
      }
    }
    this.processarDadosFinais();
    return this.data as unknown as ProcessedData;
  }

  resetData() {
    this.data = {
      entradas: [],
      saidas: [],
      entradasPorDia: new Map(),
      saidasPorDia: new Map(),
      entradasPorCfop: new Map(),
      saidasPorCfop: new Map(),
      entradasPorDiaCfop: new Map(),
      saidasPorDiaCfop: new Map(),
      itensPorCfop: new Map(),
      totalEntradas: 0,
      totalSaidas: 0,
      totalGeral: 0,
      periodo: { inicio: null, fim: null },
    };
  }
  process0000(registro: any) {
    const campos = registro.campos;
    try {
      const dtIniStr = campos[3];
      const dtFimStr = campos[4];
      const dtIni = this.parseDate(dtIniStr);
      const dtFim = this.parseDate(dtFimStr);
      if (dtIni) this.data.periodo.inicio = dtIni;
      if (dtFim) this.data.periodo.fim = dtFim;
    } catch {
      // ignora
    }
  }

  parseRegistro(line: string) {
    const partes = line.split("|");
    if (!partes || partes.length < 2) return { tipo: null };
    const campos = partes.filter(
      (_, index) => index > 0 && index < partes.length - 1
    );
    if (campos.length === 0) return { tipo: null };
    const tipo = campos[0];
    return { tipo, campos, linha: line };
  }

  processC100(registro: any): Nota | null {
    const campos = registro.campos;
    if (campos.length < 12) return null;
    const dataDoc = this.parseDate(campos[9]);
    const dataES = this.parseDate(campos[10]);
    const valorDoc = this.parseValor(campos[11]);
    const valorMerc = this.parseValor(campos[15]);
    const indicadorOperacao = campos[1] as "0" | "1";
    const situacao = campos[5];
    const nota: Nota = {
      numeroDoc: campos[7],
      chaveNfe: campos[8],
      dataDocumento: dataDoc,
      dataEntradaSaida: dataES,
      valorDocumento: valorDoc,
      valorMercadoria: valorMerc,
      indicadorOperacao,
      situacao,
      itens: [],
      itensC170: [],
    };
    if (valorDoc > 0 && situacao === "00") {
      if (indicadorOperacao === "0") this.data.entradas.push(nota);
      else if (indicadorOperacao === "1") this.data.saidas.push(nota);
      if (dataDoc && (!this.data.periodo.inicio || !this.data.periodo.fim)) {
        if (!this.data.periodo.inicio || dataDoc < this.data.periodo.inicio)
          this.data.periodo.inicio = dataDoc;
        if (!this.data.periodo.fim || dataDoc > this.data.periodo.fim)
          this.data.periodo.fim = dataDoc;
      }
    }
    return nota;
  }

  processC190(registro: any, nota: Nota) {
    const campos = registro.campos;
    if (campos.length < 5) return;
    const cfop = campos[2];
    const valorOperacao = this.parseValor(campos[4]);
    if (valorOperacao > 0 && nota.situacao === "00") {
      const item = {
        cfop,
        valorOperacao,
        cstIcms: campos[1],
        aliqIcms: this.parseValor(campos[3]),
        valorBcIcms: this.parseValor(campos[5]),
        valorIcms: this.parseValor(campos[6]),
      };
      nota.itens.push(item);
      if (!this.data.itensPorCfop.has(cfop))
        this.data.itensPorCfop.set(cfop, []);
      this.data.itensPorCfop.get(cfop)!.push({
        cfop,
        valorOperacao: item.valorOperacao,
        cstIcms: item.cstIcms,
        aliqIcms: item.aliqIcms,
        valorBcIcms: item.valorBcIcms,
        valorIcms: item.valorIcms,
        numeroDoc: nota.numeroDoc,
        chaveNfe: nota.chaveNfe,
        dataDocumento: nota.dataDocumento,
        dataEntradaSaida: nota.dataEntradaSaida,
        valorTotal: nota.valorDocumento,
        situacao: nota.situacao,
      });
      const dataKey = this.formatDateKey(nota.dataDocumento);
      if (dataKey) {
        if (nota.indicadorOperacao === "0") {
          this.acumularEntradaPorDia(dataKey, valorOperacao);
          this.acumularEntradaPorCfop(cfop, valorOperacao);
          this.acumularEntradaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalEntradas += valorOperacao;
        } else if (nota.indicadorOperacao === "1") {
          this.acumularSaidaPorDia(dataKey, valorOperacao);
          this.acumularSaidaPorCfop(cfop, valorOperacao);
          this.acumularSaidaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalSaidas += valorOperacao;
        }
      }
      this.data.totalGeral += valorOperacao;
    }
  }

  processC170(registro: any, nota: Nota) {
    const c = registro.campos || [];
    const safe = (i: number) => (i >= 0 && i < c.length ? c[i] : undefined);
    const numItem = parseInt(safe(1) || "") || undefined;
    const codItem = safe(2);
    const descrCompl = safe(3);
    const quantidade = this.parseValor(safe(4));
    const unidade = safe(5);
    const valorItem = this.parseValor(safe(6));
    const valorDesconto = this.parseValor(safe(7));
    const rawCst9 = safe(9);
    const rawCfop10 = safe(10);
    const rawCst11 = safe(11);
    const rawBc12 = safe(12);
    const rawAliq13 = safe(13);
    const rawIcms14 = safe(14);
    const rawBc14 = safe(14);
    const rawIcms15 = safe(15);

    const looksLikeCfop = (s?: string) => !!(s && /^\d{4}$/.test(s));
    const looksLikeCst = (s?: string) => !!(s && /^\d{2,3}$/.test(s));

    const cfop = looksLikeCfop(rawCfop10)
      ? rawCfop10
      : looksLikeCfop(rawCst11)
      ? rawCst11
      : rawCfop10 || rawCst11 || "";
    const cstIcms = looksLikeCst(rawCst11)
      ? rawCst11
      : looksLikeCst(rawCst9)
      ? rawCst9
      : rawCst11 || rawCst9 || "";
    const valorBcIcms = this.parseValor(rawBc12 ?? rawBc14);
    const aliqIcms = this.parseValor(rawAliq13);
    const valorIcms = this.parseValor(rawIcms15 ?? rawIcms14);

    const item: NotaItemC170 = {
      numItem,
      codItem,
      descrCompl,
      quantidade: isNaN(quantidade) ? undefined : quantidade,
      unidade,
      valorItem: isNaN(valorItem) ? undefined : valorItem,
      valorDesconto: isNaN(valorDesconto) ? undefined : valorDesconto,
      cfop,
      cstIcms,
      aliqIcms: isNaN(aliqIcms) ? undefined : aliqIcms,
      valorBcIcms: isNaN(valorBcIcms) ? undefined : valorBcIcms,
      valorIcms: isNaN(valorIcms) ? undefined : valorIcms,
    };
    if (!nota.itensC170) nota.itensC170 = [];
    nota.itensC170.push(item);
  }

  parseDate(dateStr?: string) {
    if (!dateStr || dateStr.length !== 8) return null;
    try {
      return parse(dateStr, "ddMMyyyy", new Date());
    } catch {
      return null;
    }
  }
  parseValor(valorStr?: string) {
    if (!valorStr) return 0;
    const cleanValue = valorStr.replace(/\s/g, "").replace(",", ".");
    const valor = parseFloat(cleanValue);
    return isNaN(valor) ? 0 : valor;
  }
  formatDateKey(date?: Date | null) {
    if (!date) return null;
    return format(date, "yyyy-MM-dd");
  }
  acumularEntradaPorDia(dataKey: string, valor: number) {
    if (!this.data.entradasPorDia.has(dataKey))
      this.data.entradasPorDia.set(dataKey, 0);
    this.data.entradasPorDia.set(
      dataKey,
      (this.data.entradasPorDia.get(dataKey) || 0) + valor
    );
  }
  acumularSaidaPorDia(dataKey: string, valor: number) {
    if (!this.data.saidasPorDia.has(dataKey))
      this.data.saidasPorDia.set(dataKey, 0);
    this.data.saidasPorDia.set(
      dataKey,
      (this.data.saidasPorDia.get(dataKey) || 0) + valor
    );
  }
  acumularEntradaPorCfop(cfop: string, valor: number) {
    if (!this.data.entradasPorCfop.has(cfop))
      this.data.entradasPorCfop.set(cfop, 0);
    this.data.entradasPorCfop.set(
      cfop,
      (this.data.entradasPorCfop.get(cfop) || 0) + valor
    );
  }
  acumularSaidaPorCfop(cfop: string, valor: number) {
    if (!this.data.saidasPorCfop.has(cfop))
      this.data.saidasPorCfop.set(cfop, 0);
    this.data.saidasPorCfop.set(
      cfop,
      (this.data.saidasPorCfop.get(cfop) || 0) + valor
    );
  }
  acumularEntradaPorDiaCfop(dataKey: string, cfop: string, valor: number) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.entradasPorDiaCfop.has(key))
      this.data.entradasPorDiaCfop.set(key, { data: dataKey, cfop, valor: 0 });
    const item = this.data.entradasPorDiaCfop.get(key)!;
    item.valor += valor;
  }
  acumularSaidaPorDiaCfop(dataKey: string, cfop: string, valor: number) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.saidasPorDiaCfop.has(key))
      this.data.saidasPorDiaCfop.set(key, { data: dataKey, cfop, valor: 0 });
    const item = this.data.saidasPorDiaCfop.get(key)!;
    item.valor += valor;
  }
  processarDadosFinais() {
    this.data.entradasPorDiaArray = Array.from(
      this.data.entradasPorDia.entries() as Iterable<[string, number]>
    )
      .map(([data, valor]) => ({ data, valor }))
      .sort((a: any, b: any) => a.data.localeCompare(b.data));
    this.data.entradasPorCfopArray = Array.from(
      this.data.entradasPorCfop.entries() as Iterable<[string, number]>
    )
      .map(([cfop, valor]) => ({
        cfop,
        valor,
        descricao: getDescricaoCfop(cfop),
      }))
      .sort((a: any, b: any) => b.valor - a.valor);
    this.data.entradasPorDiaCfopArray = Array.from(
      this.data.entradasPorDiaCfop.values() as Iterable<{
        data: string;
        cfop: string;
        valor: number;
      }>
    ).sort(
      (a: any, b: any) =>
        a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop)
    );
    this.data.saidasPorDiaArray = Array.from(
      this.data.saidasPorDia.entries() as Iterable<[string, number]>
    )
      .map(([data, valor]) => ({ data, valor }))
      .sort((a: any, b: any) => a.data.localeCompare(b.data));
    this.data.saidasPorCfopArray = Array.from(
      this.data.saidasPorCfop.entries() as Iterable<[string, number]>
    )
      .map(([cfop, valor]) => ({
        cfop,
        valor,
        descricao: getDescricaoCfop(cfop),
      }))
      .sort((a: any, b: any) => b.valor - a.valor);
    this.data.saidasPorDiaCfopArray = Array.from(
      this.data.saidasPorDiaCfop.values() as Iterable<{
        data: string;
        cfop: string;
        valor: number;
      }>
    ).sort(
      (a: any, b: any) =>
        a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop)
    );
    this.data.vendas = this.data.saidas;
    this.data.vendasPorDia = this.data.saidasPorDia;
    this.data.vendasPorCfop = this.data.saidasPorCfop;

    const itensIndexObj: Record<string, ItemDetalhado[]> = {};
    for (const [cfop, itens] of this.data.itensPorCfop.entries() as Iterable<
      [string, ItemDetalhado[]]
    >) {
      itensIndexObj[cfop] = itens;
    }
    this.data.itensPorCfopIndex = itensIndexObj;
  }
}

export function parseSpedFile(
  content: string,
  onProgress?: (current: number, total: number) => void
): ProcessedData {
  return new SpedParser().parse(content, onProgress);
}
