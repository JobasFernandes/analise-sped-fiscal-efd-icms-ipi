import { format, parseISO } from "date-fns";

export const formatSpedDate = (date: string | Date | null | undefined): string => {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "ddMMyyyy");
  } catch {
    return "";
  }
};

export const formatSpedNumber = (
  value: number | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined) return "";
  return value.toFixed(decimals).replace(".", ",");
};

export const formatSpedString = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.trim().replace(/\|/g, "");
};
