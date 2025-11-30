import { SpedC170Data } from "../xmlToSpedParser";
import { formatSpedNumber, formatSpedString } from "./formatters";

export const generateC170 = (data: SpedC170Data): string => {
  const fields = [
    "C170", // 01 REG
    data.numItem, // 02 NUM_ITEM
    formatSpedString(data.codItem), // 03 COD_ITEM
    formatSpedString(data.descrCompl), // 04 DESCR_COMPL
    formatSpedNumber(data.qtd, 5), // 05 QTD (5 decimals usually)
    formatSpedString(data.unid), // 06 UNID
    formatSpedNumber(data.vlItem), // 07 VL_ITEM
    formatSpedNumber(data.vlDesc), // 08 VL_DESC
    data.indMov, // 09 IND_MOV
    data.cstIcms, // 10 CST_ICMS
    data.cfop, // 11 CFOP
    data.codNat, // 12 COD_NAT
    formatSpedNumber(data.vlBcIcms), // 13 VL_BC_ICMS
    formatSpedNumber(data.aliqIcms), // 14 ALIQ_ICMS
    formatSpedNumber(data.vlIcms), // 15 VL_ICMS
    formatSpedNumber(data.vlBcIcmsSt), // 16 VL_BC_ICMS_ST
    formatSpedNumber(data.aliqIcmsSt), // 17 ALIQ_ICMS_ST
    formatSpedNumber(data.vlIcmsSt), // 18 VL_ICMS_ST
    data.indApur, // 19 IND_APUR
    data.cstIpi, // 20 CST_IPI
    data.codEnq, // 21 COD_ENQ
    formatSpedNumber(data.vlBcIpi), // 22 VL_BC_IPI
    formatSpedNumber(data.aliqIpi), // 23 ALIQ_IPI
    formatSpedNumber(data.vlIpi), // 24 VL_IPI
    data.cstPis, // 25 CST_PIS
    formatSpedNumber(data.vlBcPis), // 26 VL_BC_PIS
    formatSpedNumber(data.aliqPis), // 27 ALIQ_PIS_PERCENTUAL
    formatSpedNumber(data.quantBcPis, 3), // 28 QUANT_BC_PIS
    formatSpedNumber(data.aliqPisReais, 4), // 29 ALIQ_PIS_REAIS
    formatSpedNumber(data.vlPis), // 30 VL_PIS
    data.cstCofins, // 31 CST_COFINS
    formatSpedNumber(data.vlBcCofins), // 32 VL_BC_COFINS
    formatSpedNumber(data.aliqCofins), // 33 ALIQ_COFINS_PERCENTUAL
    formatSpedNumber(data.quantBcCofins, 3), // 34 QUANT_BC_COFINS
    formatSpedNumber(data.aliqCofinsReais, 4), // 35 ALIQ_COFINS_REAIS
    formatSpedNumber(data.vlCofins), // 36 VL_COFINS
    data.codCta, // 37 COD_CTA
    formatSpedNumber(data.vlAbatNt), // 38 VL_ABAT_NT
  ];

  return `|${fields.join("|")}|`;
};
