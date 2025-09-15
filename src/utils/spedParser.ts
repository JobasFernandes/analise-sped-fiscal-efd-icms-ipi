import { format, parse } from 'date-fns';
// Importa do .js para manter o mapa estático de CFOPs até migrarmos totalmente
import { getDescricaoCfop } from './cfopService';

export type Nota = {
  numeroDoc: string;
  chaveNfe: string;
  dataDocumento: Date | null;
  dataEntradaSaida: Date | null;
  valorDocumento: number;
  valorMercadoria: number;
  indicadorOperacao: '0' | '1';
  situacao: string;
  itens: Array<{
    cfop: string;
    valorOperacao: number;
    cstIcms: string;
    aliqIcms: number;
    valorBcIcms: number;
    valorIcms: number;
  }>;
};

export class SpedParser {
  data: any;
  constructor() { this.resetData(); }

  parse(fileContent: string) {
    const lines = fileContent.split('\n').filter(line => line.trim());
    this.resetData();
    let currentNota: Nota | null = null;
    for (const line of lines) {
      try {
        const registro = this.parseRegistro(line);
        if (!registro || !registro.tipo) continue;
        if (registro.tipo === 'C100') currentNota = this.processC100(registro) as Nota | null;
        else if (registro.tipo === 'C190' && currentNota) this.processC190(registro, currentNota);
      } catch (err) {
        console.warn('Linha SPED ignorada por erro de parsing:', err);
      }
    }
    this.processarDadosFinais();
    return this.data;
  }

  resetData() {
    this.data = {
      entradas: [], saidas: [],
      entradasPorDia: new Map(), saidasPorDia: new Map(),
      entradasPorCfop: new Map(), saidasPorCfop: new Map(),
      entradasPorDiaCfop: new Map(), saidasPorDiaCfop: new Map(),
      totalEntradas: 0, totalSaidas: 0, totalGeral: 0,
      periodo: { inicio: null, fim: null }
    };
  }

  parseRegistro(line: string) {
    const partes = line.split('|');
    if (!partes || partes.length < 2) return { tipo: null };
    const campos = partes.filter((_, index) => index > 0 && index < partes.length - 1);
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
    const indicadorOperacao = campos[1] as '0' | '1';
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
      itens: []
    };
    if (valorDoc > 0 && situacao === '00') {
      if (indicadorOperacao === '0') this.data.entradas.push(nota);
      else if (indicadorOperacao === '1') this.data.saidas.push(nota);
      if (dataDoc) {
        if (!this.data.periodo.inicio || dataDoc < this.data.periodo.inicio) this.data.periodo.inicio = dataDoc;
        if (!this.data.periodo.fim || dataDoc > this.data.periodo.fim) this.data.periodo.fim = dataDoc;
      }
    }
    return nota;
  }

  processC190(registro: any, nota: Nota) {
    const campos = registro.campos;
    if (campos.length < 5) return;
    const cfop = campos[2];
    const valorOperacao = this.parseValor(campos[4]);
    if (valorOperacao > 0 && nota.situacao === '00') {
      const item = {
        cfop,
        valorOperacao,
        cstIcms: campos[1],
        aliqIcms: this.parseValor(campos[3]),
        valorBcIcms: this.parseValor(campos[5]),
        valorIcms: this.parseValor(campos[6])
      };
      nota.itens.push(item);
      const dataKey = this.formatDateKey(nota.dataDocumento);
      if (dataKey) {
        if (nota.indicadorOperacao === '0') {
          this.acumularEntradaPorDia(dataKey, valorOperacao);
          this.acumularEntradaPorCfop(cfop, valorOperacao);
          this.acumularEntradaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalEntradas += valorOperacao;
        } else if (nota.indicadorOperacao === '1') {
          this.acumularSaidaPorDia(dataKey, valorOperacao);
          this.acumularSaidaPorCfop(cfop, valorOperacao);
          this.acumularSaidaPorDiaCfop(dataKey, cfop, valorOperacao);
          this.data.totalSaidas += valorOperacao;
        }
      }
      this.data.totalGeral += valorOperacao;
    }
  }

  parseDate(dateStr?: string) {
    if (!dateStr || dateStr.length !== 8) return null;
    try { return parse(dateStr, 'ddMMyyyy', new Date()); }
    catch { return null; }
  }
  parseValor(valorStr?: string) {
    if (!valorStr) return 0;
    const cleanValue = valorStr.replace(/\s/g, '').replace(',', '.');
    const valor = parseFloat(cleanValue);
    return isNaN(valor) ? 0 : valor;
  }
  formatDateKey(date?: Date | null) {
    if (!date) return null;
    return format(date, 'yyyy-MM-dd');
  }
  acumularEntradaPorDia(dataKey: string, valor: number) {
    if (!this.data.entradasPorDia.has(dataKey)) this.data.entradasPorDia.set(dataKey, 0);
    this.data.entradasPorDia.set(dataKey, this.data.entradasPorDia.get(dataKey) + valor);
  }
  acumularSaidaPorDia(dataKey: string, valor: number) {
    if (!this.data.saidasPorDia.has(dataKey)) this.data.saidasPorDia.set(dataKey, 0);
    this.data.saidasPorDia.set(dataKey, this.data.saidasPorDia.get(dataKey) + valor);
  }
  acumularEntradaPorCfop(cfop: string, valor: number) {
    if (!this.data.entradasPorCfop.has(cfop)) this.data.entradasPorCfop.set(cfop, 0);
    this.data.entradasPorCfop.set(cfop, this.data.entradasPorCfop.get(cfop) + valor);
  }
  acumularSaidaPorCfop(cfop: string, valor: number) {
    if (!this.data.saidasPorCfop.has(cfop)) this.data.saidasPorCfop.set(cfop, 0);
    this.data.saidasPorCfop.set(cfop, this.data.saidasPorCfop.get(cfop) + valor);
  }
  acumularEntradaPorDiaCfop(dataKey: string, cfop: string, valor: number) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.entradasPorDiaCfop.has(key)) this.data.entradasPorDiaCfop.set(key, { data: dataKey, cfop, valor: 0 });
    const item = this.data.entradasPorDiaCfop.get(key);
    item.valor += valor;
  }
  acumularSaidaPorDiaCfop(dataKey: string, cfop: string, valor: number) {
    const key = `${dataKey}-${cfop}`;
    if (!this.data.saidasPorDiaCfop.has(key)) this.data.saidasPorDiaCfop.set(key, { data: dataKey, cfop, valor: 0 });
    const item = this.data.saidasPorDiaCfop.get(key);
    item.valor += valor;
  }
  processarDadosFinais() {
    this.data.entradasPorDiaArray = Array.from(this.data.entradasPorDia.entries() as Iterable<[string, number]>)
      .map(([data, valor]) => ({ data, valor }))
      .sort((a: any, b: any) => a.data.localeCompare(b.data));
    this.data.entradasPorCfopArray = Array.from(this.data.entradasPorCfop.entries() as Iterable<[string, number]>)
      .map(([cfop, valor]) => ({ cfop, valor, descricao: getDescricaoCfop(cfop) }))
      .sort((a: any, b: any) => b.valor - a.valor);
    this.data.entradasPorDiaCfopArray = Array.from(this.data.entradasPorDiaCfop.values() as Iterable<{ data: string; cfop: string; valor: number }>)
      .sort((a: any, b: any) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));
    this.data.saidasPorDiaArray = Array.from(this.data.saidasPorDia.entries() as Iterable<[string, number]>)
      .map(([data, valor]) => ({ data, valor }))
      .sort((a: any, b: any) => a.data.localeCompare(b.data));
    this.data.saidasPorCfopArray = Array.from(this.data.saidasPorCfop.entries() as Iterable<[string, number]>)
      .map(([cfop, valor]) => ({ cfop, valor, descricao: getDescricaoCfop(cfop) }))
      .sort((a: any, b: any) => b.valor - a.valor);
    this.data.saidasPorDiaCfopArray = Array.from(this.data.saidasPorDiaCfop.values() as Iterable<{ data: string; cfop: string; valor: number }>)
      .sort((a: any, b: any) => a.data.localeCompare(b.data) || a.cfop.localeCompare(b.cfop));
    this.data.vendas = this.data.saidas;
    this.data.vendasPorDia = this.data.saidasPorDia;
    this.data.vendasPorCfop = this.data.saidasPorCfop;
  }
}

export function parseSpedFile(content: string) {
  return new SpedParser().parse(content);
}
