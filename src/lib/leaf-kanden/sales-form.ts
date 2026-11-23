import { normalizeKanriNo } from "./kanri-no";

export function pdKey(value: string) {
  const raw = value.normalize("NFKC").trim().toUpperCase();
  const match = /^(?:PD\s*)?([0-9]{7})(?:\s*\(([0-9]+)\))?$/.exec(raw);
  if (!match) return null;
  return { number: normalizeKanriNo(raw)!, branch: match[2] ?? "" };
}

export function digits(value: string, max: number) {
  return value.normalize("NFKC").replace(/\D/g, "").slice(0, max);
}

export const buildSupplyPoint = (number: string) => /^[0-9]{14}$/.test(number) ? `060${number}00001` : "";
export const formatCustomerNumber = (number: string) => number.replace(/^(\d{4})(\d{4})(\d{4})(\d{2})$/, "$1-$2-$3-$4");
export const formatSupplyPoint = (point: string) =>
  point.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})(\d{2})(\d{5})$/, "$1-$2-$3-$4-$5-$6");
