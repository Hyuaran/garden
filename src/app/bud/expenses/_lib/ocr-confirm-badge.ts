import { isReceiptTimeMissing } from "./receipt-time";

export type OcrConfirmBadgeTone = "danger" | "warning" | "hidden";

export type OcrConfirmRequiredInput = {
  receiptDate: string | null | undefined;
  storeName: string | null | undefined;
  amount: string | number | null | undefined;
  corpId: string | null | undefined;
  categoryId: string | null | undefined;
  qualifiedClass: string | null | undefined;
  receiptTime: string | null | undefined;
};

export type OcrConfirmRequiredField = "receiptDate" | "storeName" | "amount" | "corpId" | "categoryId" | "qualifiedClass";

export function missingOcrConfirmRequiredFields(input: OcrConfirmRequiredInput): OcrConfirmRequiredField[] {
  const missing: OcrConfirmRequiredField[] = [];
  if (!hasText(input.receiptDate)) missing.push("receiptDate");
  if (!hasText(input.storeName)) missing.push("storeName");
  if (!hasAmount(input.amount)) missing.push("amount");
  if (!hasText(input.corpId)) missing.push("corpId");
  if (!hasText(input.categoryId)) missing.push("categoryId");
  if (!hasText(input.qualifiedClass)) missing.push("qualifiedClass");
  return missing;
}

export function getOcrConfirmBadgeTone(input: OcrConfirmRequiredInput): OcrConfirmBadgeTone {
  const missingRequired = missingOcrConfirmRequiredFields(input);
  if (missingRequired.length > 0) return "danger";
  return isReceiptTimeMissing(input.receiptTime) ? "warning" : "hidden";
}

function hasText(value: string | null | undefined) {
  return (value ?? "").trim() !== "";
}

function hasAmount(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const normalized = toHalfWidth(value ?? "").replace(/[^\d]/g, "");
  if (!normalized) return false;
  return Number(normalized) > 0;
}

function toHalfWidth(value: string) {
  return value.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}
