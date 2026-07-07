export const PAYMENT_CATEGORY_TABS = ["transfer", "payeasy", "cash", "registered"] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORY_TABS)[number];

export const REGISTERED_METHODS = ["credit_card", "direct_debit", "auto_transfer"] as const;
export type RegisteredMethod = (typeof REGISTERED_METHODS)[number];

const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  transfer: "振込",
  payeasy: "ペイジー",
  cash: "現金",
  registered: "決済登録済",
};

const REGISTERED_METHOD_LABELS: Record<RegisteredMethod, string> = {
  credit_card: "クレカ",
  direct_debit: "口座振替",
  auto_transfer: "自動振込",
};

export type PaymentCategoryRow = {
  payment_category?: string | null;
};

export function formatPaymentCategory(value: string | null | undefined) {
  const category = normalizePaymentCategory(value);
  return PAYMENT_CATEGORY_LABELS[category];
}

export function normalizePaymentCategory(value: string | null | undefined): PaymentCategory {
  return PAYMENT_CATEGORY_TABS.includes(value as PaymentCategory) ? (value as PaymentCategory) : "transfer";
}

export function formatRegisteredMethod(value: string | null | undefined) {
  return REGISTERED_METHODS.includes(value as RegisteredMethod) ? REGISTERED_METHOD_LABELS[value as RegisteredMethod] : "—";
}

export function filterByPaymentCategory<T extends PaymentCategoryRow>(rows: T[], category: PaymentCategory) {
  return rows.filter((row) => normalizePaymentCategory(row.payment_category) === category);
}

export function normalizePayeasyNumber(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[\s　-]/g, "");
}

export function isValidPayeasyBillerNo(value: string | null | undefined) {
  return /^\d{5}$/.test(normalizePayeasyNumber(value));
}

export function hasAnyPayeasyNumber(input: {
  payeasy_biller_no?: string | null;
  payeasy_customer_no?: string | null;
  payeasy_confirm_no?: string | null;
}) {
  return Boolean(
    normalizePayeasyNumber(input.payeasy_biller_no) ||
      normalizePayeasyNumber(input.payeasy_customer_no) ||
      normalizePayeasyNumber(input.payeasy_confirm_no),
  );
}
