import { SpedC100Data } from "../xmlToSpedParser";
import { formatSpedNumber, formatSpedString } from "./formatters";

export const generateC100 = (data: SpedC100Data): string => {
  const fields = [
    "C100", // 01 REG
    data.indOper, // 02 IND_OPER
    data.indEmit, // 03 IND_EMIT
    formatSpedString(data.codPart), // 04 COD_PART
    data.codMod, // 05 COD_MOD
    data.codSit, // 06 COD_SIT
    data.ser, // 07 SER
    data.numDoc, // 08 NUM_DOC
    data.chvNfe, // 09 CHV_NFE
    data.dtDoc, // 10 DT_DOC
    data.dtES, // 11 DT_E_S
    formatSpedNumber(data.vlDoc), // 12 VL_DOC
    data.indPgto, // 13 IND_PGTO
    formatSpedNumber(data.vlDesc), // 14 VL_DESC
    formatSpedNumber(data.vlAbatNt), // 15 VL_ABAT_NT
    formatSpedNumber(data.vlMerc), // 16 VL_MERC
    data.indFrt, // 17 IND_FRT
    formatSpedNumber(data.vlFrt), // 18 VL_FRT
    formatSpedNumber(data.vlSeg), // 19 VL_SEG
    formatSpedNumber(data.vlOutDa), // 20 VL_OUT_DA
    formatSpedNumber(data.vlBcIcms), // 21 VL_BC_ICMS
    formatSpedNumber(data.vlIcms), // 22 VL_ICMS
    formatSpedNumber(data.vlBcIcmsSt), // 23 VL_BC_ICMS_ST
    formatSpedNumber(data.vlIcmsSt), // 24 VL_ICMS_ST
    formatSpedNumber(data.vlIpi), // 25 VL_IPI
    formatSpedNumber(data.vlPis), // 26 VL_PIS
    formatSpedNumber(data.vlCofins), // 27 VL_COFINS
    formatSpedNumber(data.vlPisSt), // 28 VL_PIS_ST
    formatSpedNumber(data.vlCofinsSt), // 29 VL_COFINS_ST
  ];

  return `|${fields.join("|")}|`;
};
