// Microsoft Clarity は利用規約上 18 歳未満には使えない（2026-10-26 在籍 1 人を確認）。
// 生年月日から「記録してよい人（18 歳以上）」かを判定する。生年月日が無い人は安全側で記録しない。
export function isClarityEligible(birthday: string | null | undefined, today: string): boolean {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}/.test(birthday) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const [by, bm, bd] = birthday.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 18;
}

export function tokyoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}
