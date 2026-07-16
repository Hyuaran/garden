export type TransferUrgency = "urgent" | "normal" | "later";

export function classifyTransferUrgency(
  scheduledDate: string | null,
  now = new Date(),
): TransferUrgency {
  if (!scheduledDate) return "urgent";
  const [year, month, day] = scheduledDate.split("-").map(Number);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(year, month - 1, day);
  const days = Math.floor((targetUtc - todayUtc) / 86_400_000);
  if (days <= 7) return "urgent";
  if (days <= 30) return "normal";
  return "later";
}
