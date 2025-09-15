import { describe, it, expect } from 'vitest';
import { parseSpedFile } from '../src/utils/spedParser';

/**
 * Gera uma linha C100 válida mínima:
 * Campos relevantes (índices usados pelo parser):
 *  0 REG (C100)
 *  1 IND_OPER (0 entrada / 1 saída)
 *  5 COD_SIT (situacao)
 *  7 NUM_DOC
 *  8 CHV_NFE
 *  9 DT_DOC (ddMMyyyy)
 * 10 DT_E_S (ddMMyyyy)
 * 11 VL_DOC
 * 15 VL_MERC
 */
function gerarLinhaC100({ numero, tipo = '1', data = '01062025', valor = '100,00' }: { numero: number; tipo?: '0' | '1'; data?: string; valor?: string }) {
  // Preenche campos intermediários com placeholders
  // Estrutura simplificada mantendo índices utilizados
  const campos = [
    'C100', // 0
    tipo,   // 1 IND_OPER
    '0',    // 2 ind_emit
    '0',    // 3 cod_mod
    '55',   // 4 cod_sit (na verdade 5, mas ajustamos abaixo) -> vamos colocar depois
    '00',   // 5 COD_SIT (situacao ok)
    '0',    // 6 ser
    String(numero), // 7 NUM_DOC
    'NFECHAVE' + numero.toString().padStart(8, '0'), // 8 CHV_NFE
    data,   // 9 DT_DOC
    data,   // 10 DT_E_S
    valor,  // 11 VL_DOC
    '0',    // 12 VL_DESC
    '0',    // 13 VL_ABAT_NT
    '0',    // 14 VL_MERC (ajustaremos pos 15)
    valor,  // 15 VL_MERC
  ];
  return '|' + campos.join('|') + '|';
}

/**
 * Gera uma linha C190 para CFOP e valor.
 * Índices usados:
 * 0 REG (C190)
 * 1 CST_ICMS
 * 2 CFOP
 * 3 ALIQ_ICMS
 * 4 VL_OPR
 * 5 VL_BC_ICMS
 * 6 VL_ICMS
 */
function gerarLinhaC190({ cfop = '5102', valor = '100,00' }: { cfop?: string; valor?: string }) {
  const campos = [
    'C190', // 0
    '000',  // 1 CST
    cfop,   // 2 CFOP
    '18,00',// 3 ALIQ
    valor,  // 4 VL_OPR
    '100,00', // 5 VL_BC
    '18,00', // 6 VL_ICMS
  ];
  return '|' + campos.join('|') + '|';
}

function gerarHeader0000() {
  // |0000|<COD_VER>|<COD_FIN>|<DT_INI>|<DT_FIN>|...
  // Usamos indices: 3 DT_INI, 4 DT_FIN
    return '|0000|015|0|01062025|30062025|Empresa Teste|12345678000100|SP|||\n';
}

describe('Progresso do parser', () => {
  it('emite múltiplos callbacks para arquivo grande', () => {
    const QUANTIDADE = 1200; // > 1000 para forçar vários steps (STEP = 200)
    let linhas = gerarHeader0000();
    for (let i = 1; i <= QUANTIDADE; i++) {
      linhas += gerarLinhaC100({ numero: i }) + '\n';
      linhas += gerarLinhaC190({ valor: '100,00' }) + '\n';
    }

    const chamadas: Array<{ current: number; total: number }> = [];
    const dados = parseSpedFile(linhas, (current, total) => {
      chamadas.push({ current, total });
    });

    // Verifica que houve callbacks suficientes (aprox QUANTIDADE*2 / STEP)
    // Cada nota gera 2 linhas (C100 + C190) -> total de linhas relevantes ~ 2400 + header
    // Como filtramos linhas vazias, total ~ 2401
    expect(chamadas.length).toBeGreaterThan(5); // deve ter vários passos

    const ultima = chamadas[chamadas.length - 1];
    expect(ultima.current).toBe(ultima.total); // callback final
    expect(ultima.total).toBeGreaterThan(2000);

    // Sanidade: totalGeral > 0
    expect(dados.totalGeral).toBeGreaterThan(0);
  });

  it('emite ao menos um callback para arquivo pequeno', () => {
    let linhas = gerarHeader0000();
    linhas += gerarLinhaC100({ numero: 1 }) + '\n';
    linhas += gerarLinhaC190({ valor: '50,00' }) + '\n';

    const chamadas: Array<{ current: number; total: number }> = [];
    parseSpedFile(linhas, (current, total) => chamadas.push({ current, total }));

    // Mesmo com poucas linhas, deve chamar no final
    expect(chamadas.length).toBe(1);
    expect(chamadas[0].current).toBe(chamadas[0].total);
    expect(chamadas[0].total).toBeGreaterThan(0);
  });
});
