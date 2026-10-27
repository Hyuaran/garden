export type MinimumWage = { id: string; prefecture: string; hourly_amount: number; effective_from: string; source_url: string | null; updated_at: string };
export function minimumWageAt(rows: MinimumWage[], prefecture: string, date: string) {
  return rows.filter(r => r.prefecture === prefecture && r.effective_from <= date).sort((a,b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
}
export function missingCurrentWage(rows: MinimumWage[], now = new Date()) {
  const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return date.slice(5) >= "10-01" && !rows.some(r => r.prefecture === "大阪府" && r.effective_from.startsWith(date.slice(0,4)));
}
export function hourlyEquivalent(amount: number, weeklyHours: number) { return amount / (weeklyHours * 52 / 12); }
export function wageError(p: { contractStart: string; hourlyWage: number; salaryKind?: "hourly" | "monthly"; weeklyHours?: number }, rows: MinimumWage[]) {
  const wage = minimumWageAt(rows, "大阪府", p.contractStart);
  if (!wage) return "最低賃金マスタに登録がありません";
  if (p.salaryKind === "monthly" && !(Number(p.weeklyHours) > 0 && Number.isFinite(Number(p.weeklyHours)))) return "週の所定時間を入れてください";
  const amount = p.salaryKind === "monthly" ? hourlyEquivalent(p.hourlyWage, p.weeklyHours!) : p.hourlyWage;
  return !Number.isFinite(amount) || amount < wage.hourly_amount ? `大阪府の最低賃金（${wage.effective_from} から ${wage.hourly_amount.toLocaleString("ja-JP")} 円）を下回っています` : null;
}
