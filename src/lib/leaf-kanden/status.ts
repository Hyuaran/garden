export const ORDER_STATUSES = [
  "受注", "諸元待ち", "エントリー待ち", "送付待ち", "請求待ち", "入金待ち", "支払待ち", "完了",
  "保留", "差し戻し", "キャンセル",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export type StatusInput = Partial<Record<
  "ordered_on" | "specs_on" | "entered_on" | "app_sent_on" | "invoice_sent_on" |
  "payment_received_on" | "payment_sent_on" | "completed_on" | "cancelled_on", string | null
>> & { status?: OrderStatus | null; is_direct?: boolean | null };

export function orderStatus(order: StatusInput, hasSpecsPhoto = false): OrderStatus {
  if (order.cancelled_on) return "キャンセル";
  if (order.status === "保留" || order.status === "差し戻し") return order.status;
  if (order.completed_on || order.payment_sent_on || (order.is_direct && order.payment_received_on)) return "完了";
  if (order.payment_received_on) return "支払待ち";
  if (order.invoice_sent_on) return "入金待ち";
  if (order.app_sent_on) return "請求待ち";
  if (order.entered_on) return "送付待ち";
  if (order.specs_on || hasSpecsPhoto) return "エントリー待ち";
  return order.ordered_on ? "諸元待ち" : "受注";
}
