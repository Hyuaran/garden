export const ORDER_STATUSES = [
  "諸元待ち", "エントリー待ち", "申込書待ち", "郵送待ち", "入金待ち", "完了", "キャンセル", "保留", "差し戻し",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const LEGACY_CANCEL_REASON = "郵送前キャンセル（入金なし）";
export const PDF_REVIEW_REASON = "要確認（明細が PDF の月）";

export type StatusInput = Partial<Record<
  "ordered_on" | "jisseki_month" | "specs_on" | "entered_on" | "application_received_on" |
  "mailed_on" | "paid_on" | "refunded_on" | "cancelled_on" | "timetree_label" | "cancel_reason",
  string | null
>> & { status?: OrderStatus | null };

export function orderStatus(order: StatusInput, hasSpecsPhoto = false): OrderStatus {
  if (order.status === "保留" || order.status === "差し戻し") return order.status;
  if (order.cancelled_on || order.refunded_on ||
      (order.cancel_reason === LEGACY_CANCEL_REASON && !order.mailed_on && !order.paid_on)) return "キャンセル";
  if (order.paid_on) return "完了";
  if (order.mailed_on) return "入金待ち";
  if (order.application_received_on) return "郵送待ち";
  if (order.entered_on) return "申込書待ち";
  const label = order.timetree_label?.trim();
  if (order.specs_on || hasSpecsPhoto || (label && label !== "諸元待ち")) return "エントリー待ち";
  return "諸元待ち";
}

export function performanceMonth(order: StatusInput): string | null {
  return order.jisseki_month?.trim() || order.ordered_on?.slice(0, 7) || null;
}
