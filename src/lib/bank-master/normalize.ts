import { normalizeBankSearchTerm, normalizeBranchSearchTerm, toFullWidthAscii } from "@/app/system/onboarding/_lib/bank-search";

function compact(value: unknown) {
  return toFullWidthAscii(String(value ?? ""))
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .trim();
}

export function normalizeBankNameForCompare(value: unknown) {
  return compact(normalizeBankSearchTerm(compact(value)));
}

export function normalizeBranchNameForCompare(value: unknown) {
  return compact(normalizeBranchSearchTerm(compact(value)));
}

export function normalizeCode(value: unknown, length: number) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > length ? digits.slice(0, length) : digits.padStart(length, "0");
}
