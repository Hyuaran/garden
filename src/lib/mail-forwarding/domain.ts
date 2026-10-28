export type Filing = { id: string; forwarding_id: string; filed_on: string; method: "e転居" | "窓口"; receipt: string; filed_by: string; notes: string; created_at?: string };
export type Forwarding = { id: string; holder: string; from_address: string; to_address: string; notes: string; stopped: boolean; filings: Filing[] };
export type Stage = "60" | "30" | "14" | "7" | "expired";
export type Notice = { forwarding_id: string; filed_on: string; stage: Stage; sent_at?: string | null };
export const todayJst = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
// Clamp the anniversary to the last day of its month, then subtract one day.
export function expiry(filedOn: string): string {
  if (!validDate(filedOn)) throw new Error("invalid date");
  const [year, month, day] = filedOn.split("-").map(Number);
  const last = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return new Date(Date.UTC(year + 1, month - 1, Math.min(day, last) - 1)).toISOString().slice(0, 10);
}
export const latestFiling = (row: Forwarding) => [...row.filings].sort((a,b) => b.filed_on.localeCompare(a.filed_on) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
export const remaining = (filedOn: string, today: string) => Math.round((Date.parse(expiry(filedOn)) - Date.parse(today)) / 86400000);
export const tone = (days: number) => days < 0 ? "ng" : days <= 60 ? "wait" : "ok";
export function sortForwardings(rows: Forwarding[]): Forwarding[] {
  return [...rows].sort((a,b) => Number(a.stopped) - Number(b.stopped) || (latestFiling(a) ? expiry(latestFiling(a).filed_on) : "9999").localeCompare(latestFiling(b) ? expiry(latestFiling(b).filed_on) : "9999") || a.holder.localeCompare(b.holder));
}
export function dueNotice(row: Forwarding, notices: Notice[], today: string): Notice | null {
  const filing = latestFiling(row);
  if (row.stopped || !filing) return null;
  const days = remaining(filing.filed_on, today);
  // 最後に到達した段階を選ぶ。送信失敗の翌日も同じ段階を再試行する。
  const threshold = [7,14,30,60].find(limit => days <= limit);
  const stage: Stage | undefined = days < 0 ? "expired" : threshold === undefined ? undefined : String(threshold) as Stage;
  if (!stage || notices.some(n => n.forwarding_id === row.id && n.filed_on === filing.filed_on && n.stage === stage && n.sent_at)) return null;
  return { forwarding_id: row.id, filed_on: filing.filed_on, stage };
}
const clean = (s: string) => s.replace(/\[/g, "［").replace(/\]/g, "］");
export function noticeMessage(row: Forwarding, notice: Notice, today: string) {
  const days = remaining(notice.filed_on, today);
  return `[info][title]${notice.stage === "expired" ? "郵便の転送が切れています" : "郵便の転送の期限が近づいています"}[/title]\n名義：${clean(row.holder)}\n転送元：${clean(row.from_address)}\n転送先：${clean(row.to_address)}\n期限：${expiry(notice.filed_on)}（${days < 0 ? "期限切れ" : `あと ${days} 日`}）\ne転居で届け直して、Garden の「郵便の転送」で［届け直した］を押してください。\nhttps://garden-os.net/root/mail-forwarding[/info]`;
}
