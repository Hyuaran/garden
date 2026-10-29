export type Employee = {
  employee_id: string;
  employee_number: string | null;
  name: string;
  email: string | null;
  termination_date: string | null;
  mf_stop_notified_at: string | null;
};

export function cutoffDate(now: Date): string {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 60);
  return date.toISOString().slice(0, 10);
}

const clean = (value: string) => value.replace(/\[/g, "［").replace(/\]/g, "］").replace(/[\r\n]/g, " ");

export function buildMessage(employees: Employee[]): string {
  return [
    "[info][title]マネーフォワード クラウドのアカウントの停止のお願い[/title]",
    "退職日が入った人がいます。最後の給与の支給が済んでから、アカウントを止めてください。",
    ...employees.map(e => `・${clean(e.name)}（社員番号 ${clean(e.employee_number || "登録なし")}・退職日 ${e.termination_date}・${e.email?.trim() ? `メール ${clean(e.email)}` : "メールの登録なし"}）`),
    "止めるときは Claude に「MF の〇〇さんを止めて」と頼めば、手順書どおり代わりに止めます。[/info]",
  ].join("\n");
}

export type Dependencies = {
  load(cutoff: string): Promise<Employee[]>;
  send(message: string): Promise<void>;
  mark(employees: Employee[], at: string): Promise<void>;
};

export async function runMfStopNotice(deps: Dependencies, { dryRun = false, now = new Date() } = {}) {
  const cutoff = cutoffDate(now);
  const employees = (await deps.load(cutoff)).filter(e =>
    e.termination_date && e.termination_date >= cutoff && !e.mf_stop_notified_at,
  );
  if (dryRun) return { ok: true, dryRun: true, targets: employees, notified: 0 };
  if (employees.length) {
    await deps.send(buildMessage(employees));
    await deps.mark(employees, now.toISOString());
  }
  return { ok: true, dryRun: false, notified: employees.length };
}
