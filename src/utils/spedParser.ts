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
  Participante,
  Produto,
  ApuracaoICMS,
  Inventario,
  RegistroSped,
  MovimentacaoCombustivel1300,
  MovimentacaoTanque1310,
  VolumeVendasBico1320,
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
    companyName?: string;
    cnpj?: string;
    numeroNotasEntrada?: number;
    numeroNotasSaida?: number;
    participantes?: Participante[];
    produtos?: Produto[];
    apuracaoICMS?: ApuracaoICMS[];
    inventario?: Inventario[];
    // Dados de combustíveis (Bloco 1 - Registros 1300, 1310, 1320)
    combustivelMovDiaria?: MovimentacaoCombustivel1300[];
    combustivelTanques?: MovimentacaoTanque1310[];
    combustivelBicos?: VolumeVendasBico1320[];
  };
  constructor() {
    this.resetData();
  }
  private currentNota: Nota | null = null;
  private currentApuracao: ApuracaoICMS | null = null;
  private currentInventario: Inventario | null = null;

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
        else if (registro.tipo === "0150") this.process0150(registro);
        else if (registro.tipo === "0200") this.process0200(registro);
        else if (registro.tipo === "E100") this.processE100(registro);
        else if (registro.tipo === "E110") this.processE110(registro);
        else if (registro.tipo === "H005") this.processH005(registro);
        else if (registro.tipo === "H010") this.processH010(registro);
        // Bloco 1 - Movimentação de Combustíveis
        else if (registro.tipo === "1300") this.process1300(registro);
        else if (registro.tipo === "1310") this.process1310(registro);
        else if (registro.tipo === "1320") this.process1320(registro);
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

  // Estado para parsing de combustíveis (Bloco 1)
  private currentCombustivel1300: MovimentacaoCombustivel1300 | null = null;
  private currentTanque1310: MovimentacaoTanque1310 | null = null;

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
      numeroNotasEntrada: 0,
      numeroNotasSaida: 0,
      periodo: { inicio: null, fim: null },
      participantes: [],
      produtos: [],
      apuracaoICMS: [],
      inventario: [],
      // Dados de combustíveis (Bloco 1)
      combustivelMovDiaria: [],
      combustivelTanques: [],
      combustivelBicos: [],
    };
    // Resetar estado de combustíveis
    this.currentCombustivel1300 = null;
    this.currentTanque1310 = null;
  }
  process0000(registro: RegistroSped) {
    const campos = registro.campos;
    try {
      const dtIniStr = campos[3];
      const dtFimStr = campos[4];
      const dtIni = this.parseDate(dtIniStr);
      const dtFim = this.parseDate(dtFimStr);
      if (dtIni) this.data.periodo.inicio = dtIni;
      if (dtFim) this.data.periodo.fim = dtFim;
      const maybeCnpj = campos.find((c: string) => /\d{14}/.test(c));
      if (maybeCnpj && /\d{14}/.test(maybeCnpj)) {
        this.data.cnpj = maybeCnpj.padStart(14, "0");
        const idx = campos.indexOf(maybeCnpj);
        if (idx > 0) {
          const nome = campos[idx - 1];
          if (nome && /[A-Za-zÀ-ÿ]/.test(nome)) this.data.companyName = nome.trim();
        }
      } else {
        if (campos[5]) this.data.companyName = campos[5];
        if (campos[6] && /\d{14}/.test(campos[6])) this.data.cnpj = campos[6];
      }
    } catch {
      // ignora
    }
  }

  parseRegistro(line: string): RegistroSped {
    const partes = line.split("|");
    if (!partes || partes.length < 2) return { tipo: null, campos: [], linha: line };
    const campos = partes.filter((_, index) => index > 0 && index < partes.length - 1);
    if (campos.length === 0) return { tipo: null, campos: [], linha: line };
    const tipo = campos[0];
    return { tipo, campos, linha: line };
  }

  processC100(registro: RegistroSped, pushToData = true): Nota | null {
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
      if (pushToData) {
        if (indicadorOperacao === "0") this.data.entradas.push(nota);
        else if (indicadorOperacao === "1") this.data.saidas.push(nota);
      }
      if (indicadorOperacao === "0")
        this.data.numeroNotasEntrada = (this.data.numeroNotasEntrada || 0) + 1;
      else if (indicadorOperacao === "1")
        this.data.numeroNotasSaida = (this.data.numeroNotasSaida || 0) + 1;

      if (dataDoc && (!this.data.periodo.inicio || !this.data.periodo.fim)) {
        if (!this.data.periodo.inicio || dataDoc < this.data.periodo.inicio)
          this.data.periodo.inicio = dataDoc;
        if (!this.data.periodo.fim || dataDoc > this.data.periodo.fim)
          this.data.periodo.fim = dataDoc;
      }
    }
    return nota;
  }

  processC190(registro: RegistroSped, nota: Nota) {
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
        valorIpi: this.parseValor(campos[10]),
      };
      nota.itens.push(item);
      if (!this.data.itensPorCfop.has(cfop)) this.data.itensPorCfop.set(cfop, []);
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

  processC170(registro: RegistroSped, nota: Nota) {
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
    const rawIcms15 = safe(15);
    const rawIpi23 = safe(23);
    const rawPis29 = safe(29);
    const rawCofins35 = safe(35);

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
    const valorBcIcms = this.parseValor(rawBc12);
    const aliqIcms = this.parseValor(rawAliq13);
    const valorIcms = this.parseValor(rawIcms14 ?? rawIcms15);
    const valorIpi = this.parseValor(rawIpi23);
    const valorPis = this.parseValor(rawPis29);
    const valorCofins = this.parseValor(rawCofins35);

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
      valorIpi: isNaN(valorIpi) ? undefined : valorIpi,
      valorPis: isNaN(valorPis) ? undefined : valorPis,
      valorCofins: isNaN(valorCofins) ? undefined : valorCofins,
    };
    if (!nota.itensC170) nota.itensC170 = [];
    nota.itensC170.push(item);
  }

  process0150(registro: RegistroSped) {
    const c = registro.campos;
    this.data.participantes?.push({
      codPart: c[2],
      nome: c[3],
      codMun: c[8],
      cnpj: c[5],
      cpf: c[6],
      ie: c[7],
    });
  }

  process0200(registro: RegistroSped) {
    const c = registro.campos;
    this.data.produtos?.push({
      codItem: c[2],
      descrItem: c[3],
      unidInv: c[6],
      tipoItem: c[7],
    });
  }

  processE100(registro: RegistroSped) {
    const c = registro.campos;
    this.currentApuracao = {
      dtIni: this.parseDate(c[2]),
      dtFim: this.parseDate(c[3]),
      vlTotDebitos: 0,
      vlTotCreditos: 0,
      vlSaldoDevedor: 0,
      vlSaldoCredor: 0,
    };
    this.data.apuracaoICMS?.push(this.currentApuracao);
  }

  processE110(registro: RegistroSped) {
    if (!this.currentApuracao) return;
    const c = registro.campos;
    this.currentApuracao.vlTotDebitos = this.parseValor(c[2]);
    this.currentApuracao.vlTotCreditos = this.parseValor(c[6]);
    this.currentApuracao.vlSaldoDevedor = this.parseValor(c[11]);
    this.currentApuracao.vlSaldoCredor = this.parseValor(c[14]);
  }

  processH005(registro: RegistroSped) {
    const c = registro.campos;
    this.currentInventario = {
      dtInv: this.parseDate(c[2]),
      vlInv: this.parseValor(c[3]),
      itens: [],
    };
    this.data.inventario?.push(this.currentInventario);
  }

  processH010(registro: RegistroSped) {
    if (!this.currentInventario) return;
    const c = registro.campos;
    this.currentInventario.itens.push({
      codItem: c[2],
      qtd: this.parseValor(c[4]),
      vlUnit: this.parseValor(c[5]),
      vlItem: this.parseValor(c[6]),
      indProp: c[7],
    });
  }

  /**
   * Registro 1300 - Movimentação Diária de Combustíveis
   * Layout: |1300|COD_ITEM|DT_MOV|QTD_INI|QTD_ENTR|QTD_DISPONIVEL|QTD_VENDAS|QTD_FIM_FISICO|QTD_PERDA|QTD_SOBRA|QTD_FIM_CONTABIL|
   */
  process1300(registro: RegistroSped) {
    const c = registro.campos;
    if (c.length < 11) return;

    const dtMovStr = c[2];
    const dtMov = this.parseDateToIso(dtMovStr);

    this.currentCombustivel1300 = {
      codItem: c[1] || "",
      dtMov: dtMov || "",
      qtdIni: this.parseValor(c[3]),
      qtdEntr: this.parseValor(c[4]),
      qtdDisponivel: this.parseValor(c[5]),
      qtdVendas: this.parseValor(c[6]),
      qtdFimFisico: this.parseValor(c[7]),
      qtdPerda: this.parseValor(c[8]),
      qtdSobra: this.parseValor(c[9]),
      qtdFimContabil: this.parseValor(c[10]),
    };

    if (!this.data.combustivelMovDiaria) this.data.combustivelMovDiaria = [];
    this.data.combustivelMovDiaria.push(this.currentCombustivel1300);
  }

  /**
   * Registro 1310 - Movimentação Diária por Tanque
   * Layout: |1310|NUM_TANQUE|QTD_INI|QTD_ENTR|QTD_DISPONIVEL|QTD_VENDAS|QTD_FIM_FISICO|QTD_PERDA|QTD_SOBRA|QTD_FIM_CONTABIL|
   */
  process1310(registro: RegistroSped) {
    const c = registro.campos;
    if (c.length < 10) return;

    // Herda codItem e dtMov do registro 1300 pai
    const codItem = this.currentCombustivel1300?.codItem || "";
    const dtMov = this.currentCombustivel1300?.dtMov || "";

    this.currentTanque1310 = {
      codItem,
      dtMov,
      numTanque: c[1] || "",
      qtdIni: this.parseValor(c[2]),
      qtdEntr: this.parseValor(c[3]),
      qtdDisponivel: this.parseValor(c[4]),
      qtdVendas: this.parseValor(c[5]),
      qtdFimFisico: this.parseValor(c[6]),
      qtdPerda: this.parseValor(c[7]),
      qtdSobra: this.parseValor(c[8]),
      qtdFimContabil: this.parseValor(c[9]),
    };

    if (!this.data.combustivelTanques) this.data.combustivelTanques = [];
    this.data.combustivelTanques.push(this.currentTanque1310);
  }

  /**
   * Registro 1320 - Volume de Vendas por Bico/Bomba
   * Layout conforme Guia Prático EFD ICMS/IPI:
   * |1320|NUM_BICO|NR_INTERV|MOT_INTERV|NOM_INTERV|CNPJ_INTERV|CPF_INTERV|VAL_FECHA|VAL_ABERT|VOL_AFERI|VOL_VENDAS|
   *
   * Onde:
   * - VAL_FECHA (c[7]): Valor do encerrante no FECHAMENTO (final do período)
   * - VAL_ABERT (c[8]): Valor do encerrante na ABERTURA (início do período)
   * - VOL_VENDAS = VAL_FECHA - VAL_ABERT (volume vendido no período)
   */
  process1320(registro: RegistroSped) {
    const c = registro.campos;
    if (c.length < 11) return;

    // Herda codItem e dtMov do 1300, numTanque do 1310
    const codItem = this.currentCombustivel1300?.codItem || "";
    const dtMov = this.currentCombustivel1300?.dtMov || "";
    const numTanque = this.currentTanque1310?.numTanque || "";

    const bico: VolumeVendasBico1320 = {
      codItem,
      dtMov,
      numTanque,
      numBico: c[1] || "",
      numInterv: c[2] || "",
      motInterv: c[3] || "",
      nomInterv: c[4] || "",
      // Campos de encerrante conforme Guia Prático:
      // c[7] = VAL_FECHA (encerrante final/fechamento)
      // c[8] = VAL_ABERT (encerrante inicial/abertura)
      encerranteIni: this.parseValor(c[8]), // VAL_ABERT - abertura
      encerranteFim: this.parseValor(c[7]), // VAL_FECHA - fechamento
      qtdAfericao: this.parseValor(c[9]), // VOL_AFERI
      qtdVendas: this.parseValor(c[10]), // VOL_VENDAS
    };

    if (!this.data.combustivelBicos) this.data.combustivelBicos = [];
    this.data.combustivelBicos.push(bico);
  }

  /**
   * Converte data SPED (DDMMAAAA) para ISO (YYYY-MM-DD)
   */
  parseDateToIso(dateStr?: string): string | null {
    if (!dateStr || dateStr.length !== 8) return null;
    try {
      const date = parse(dateStr, "ddMMyyyy", new Date());
      return format(date, "yyyy-MM-dd");
    } catch {
      return null;
    }
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
    if (!this.data.saidasPorDia.has(dataKey)) this.data.saidasPorDia.set(dataKey, 0);
    this.data.saidasPorDia.set(
      dataKey,
      (this.data.saidasPorDia.get(dataKey) || 0) + valor
    );
  }
  acumularEntradaPorCfop(cfop: string, valor: number) {
    if (!this.data.entradasPorCfop.has(cfop)) this.data.entradasPorCfop.set(cfop, 0);
    this.data.entradasPorCfop.set(
      cfop,
      (this.data.entradasPorCfop.get(cfop) || 0) + valor
    );
  }
  acumularSaidaPorCfop(cfop: string, valor: number) {
    if (!this.data.saidasPorCfop.has(cfop)) this.data.saidasPorCfop.set(cfop, 0);
    this.data.saidasPorCfop.set(cfop, (this.data.saidasPorCfop.get(cfop) || 0) + valor);
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
      .sort((a: DiaValor, b: DiaValor) => a.data.localeCompare(b.data));
    this.data.entradasPorCfopArray = Array.from(
      this.data.entradasPorCfop.entries() as Iterable<[string, number]>
    )
      .map(([cfop, valor]) => ({
        cfop,
        valor,
        descricao: getDescricaoCfop(cfop),
      }))
      .sort((a: CfopValor, b: CfopValor) => b.valor - a.valor);
    this.data.entradasPorDiaCfopArray = Array.from(
      this.data.entradasPorDiaCfop.values() as Iterable<{
        data: string;
        cfop: string;
        valor: number;
      }>
    ).sort(
      (a: DiaCfopValor, b: DiaCfopValor) =>
        a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop)
    );
    this.data.saidasPorDiaArray = Array.from(
      this.data.saidasPorDia.entries() as Iterable<[string, number]>
    )
      .map(([data, valor]) => ({ data, valor }))
      .sort((a: DiaValor, b: DiaValor) => a.data.localeCompare(b.data));
    this.data.saidasPorCfopArray = Array.from(
      this.data.saidasPorCfop.entries() as Iterable<[string, number]>
    )
      .map(([cfop, valor]) => ({
        cfop,
        valor,
        descricao: getDescricaoCfop(cfop),
      }))
      .sort((a: CfopValor, b: CfopValor) => b.valor - a.valor);
    this.data.saidasPorDiaCfopArray = Array.from(
      this.data.saidasPorDiaCfop.values() as Iterable<{
        data: string;
        cfop: string;
        valor: number;
      }>
    ).sort(
      (a: DiaCfopValor, b: DiaCfopValor) =>
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

  public processLine(line: string) {
    try {
      const registro = this.parseRegistro(line);
      if (!registro || !registro.tipo) return;
      if (registro.tipo === "0000") this.process0000(registro);
      else if (registro.tipo === "0150") this.process0150(registro);
      else if (registro.tipo === "0200") this.process0200(registro);
      else if (registro.tipo === "E100") this.processE100(registro);
      else if (registro.tipo === "E110") this.processE110(registro);
      else if (registro.tipo === "H005") this.processH005(registro);
      else if (registro.tipo === "H010") this.processH010(registro);
      else if (registro.tipo === "C100") {
        if (this.currentNota) {
          if (this.currentNota.indicadorOperacao === "0")
            this.data.entradas.push(this.currentNota);
          else if (this.currentNota.indicadorOperacao === "1")
            this.data.saidas.push(this.currentNota);
        }
        this.currentNota = this.processC100(registro, false) as Nota | null;
      } else if (registro.tipo === "C190" && this.currentNota)
        this.processC190(registro, this.currentNota);
      else if (registro.tipo === "C170" && this.currentNota)
        this.processC170(registro, this.currentNota);
      // Bloco 1 - Movimentação de Combustíveis
      else if (registro.tipo === "1300") this.process1300(registro);
      else if (registro.tipo === "1310") this.process1310(registro);
      else if (registro.tipo === "1320") this.process1320(registro);
    } catch (err) {
      console.warn("Linha SPED ignorada por erro de parsing:", err);
    }
  }

  public finish() {
    if (this.currentNota) {
      if (this.currentNota.indicadorOperacao === "0")
        this.data.entradas.push(this.currentNota);
      else if (this.currentNota.indicadorOperacao === "1")
        this.data.saidas.push(this.currentNota);
      this.currentNota = null;
    }
    this.processarDadosFinais();
  }

  public getAndClearBatchData() {
    const batch = {
      entradas: [...this.data.entradas],
      saidas: [...this.data.saidas],
      // Dados de combustíveis
      combustivelMovDiaria: [...(this.data.combustivelMovDiaria || [])],
      combustivelTanques: [...(this.data.combustivelTanques || [])],
      combustivelBicos: [...(this.data.combustivelBicos || [])],
      // Produtos (registro 0200)
      produtos: [...(this.data.produtos || [])],
    };
    this.data.entradas = [];
    this.data.saidas = [];
    this.data.combustivelMovDiaria = [];
    this.data.combustivelTanques = [];
    this.data.combustivelBicos = [];
    this.data.produtos = [];
    return batch;
  }

  /**
   * Retorna dados de combustíveis acumulados
   */
  public getCombustivelData() {
    return {
      movDiaria: this.data.combustivelMovDiaria || [],
      tanques: this.data.combustivelTanques || [],
      bicos: this.data.combustivelBicos || [],
    };
  }
}

export function parseSpedFile(
  content: string,
  onProgress?: (current: number, total: number) => void
): ProcessedData {
  return new SpedParser().parse(content, onProgress);
}
