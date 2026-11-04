// Claude が手動で実行する。既定は読取り、--apply で未登録行だけ保存。
// node --env-file=.env.local scripts/shift/seed-default-pattern.mjs [--apply]
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { assertReadTime } from "../attendance/import-kot-november.mjs";

function check(result) {
  if (result.error) throw new Error("取得・保存に失敗しました。処理を停止します。");
  return result.data;
}
async function loadTs(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
async function relay(db, path) {
  assertReadTime();
  const job = check(await db.from("system_relay_jobs").insert({
    kind: "kot",
    request: { method: "GET", path },
    requested_by: "seed-default-pattern",
    expires_at: new Date(Date.now() + 60000).toISOString(),
  }).select("id").single());
  const until = Date.now() + 55000;
  while (Date.now() < until) {
    assertReadTime();
    const row = check(await db.from("system_relay_jobs").select("status,result,error").eq("id", job.id).single());
    if (row.status === "done") return row.result;
    if (["failed", "expired"].includes(row.status)) throw new Error(row.error || "中継が失敗しました。");
    // 画面の定期取得ではなく、手動処理の完了待ち。自動実行は1日0回、最大55回/仕事。
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("中継の完了を確認できませんでした。");
}

export function mostFrequentPattern(employeeKey, days, dates, isHoliday, odd = []) {
  return [0, 1, 2, 3, 4, 5, 6, 8].map(weekday => {
    const counts = new Map();
    if (weekday !== 8) {
      for (const date of dates) {
        if (isHoliday(date) || new Date(date + "T00:00:00Z").getUTCDay() !== weekday) continue;
        const schedule = days.filter(day => String(day.date).slice(0, 10) === date)
          .flatMap(day => day.dailySchedules ?? []).find(row => row.employeeKey === employeeKey);
        const start = schedule?.clockInSchedule?.slice(11, 16);
        const end = schedule?.clockOutSchedule?.slice(11, 16);
        const valid = start && end && start >= "06:00" && start < end &&
          /^(\d{2}):(00|30)$/.test(start) && /^(\d{2}):(00|30)$/.test(end);
        // 30分単位でない予定は数えずに報告する（1 件で全員が止まらないように）。
        if (start && !valid) {
          odd.push(`${date} ${start}-${end ?? "終了なし"}`);
          continue;
        }
        const key = valid ? `${start}|${end}` : "rest";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    // 同数の場合も結果が変わらないよう、時刻の順で決める。
    const winner = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const [start_time, end_time] = winner && winner !== "rest" ? winner.split("|") : [null, null];
    return { weekday, start_time, end_time };
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== "--apply")) {
    throw new Error("指定できる引数は --apply だけです。");
  }
  assertReadTime();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const heartbeat = check(await db.from("system_relay_heartbeat").select("agent_version,last_seen_at").eq("id", "host-pc").single());
  const version = heartbeat.agent_version?.split(".").map(Number);
  if (!version || !(version[0] > 1 || (version[0] === 1 && (version[1] > 3 || (version[1] === 3 && version[2] >= 1)))) ||
      Date.now() - Date.parse(heartbeat.last_seen_at) > 120000)
    throw new Error("中継の係1.3.1以上と生存確認が必要です。");
  const { shiftMode } = await loadTs("../../src/lib/shift/eligibility.ts");
  const { isJapaneseHoliday } = await loadTs("../../src/app/system/kanri/_lib/jp-holidays.ts");
  const people = check(await db.from("root_employees_with_team")
    .select("employee_id,name,employment_type,business,current_team,is_active,termination_date,deleted_at"));
  const settings = check(await db.from("system_shift_submitter").select("employee_id,mode"));
  const codes = check(await db.from("root_employees").select("employee_id,kot_employee_id"));
  const existing = check(await db.from("system_shift_default").select("employee_id,weekday"));
  const remote = await relay(db, "/employees?includeResigner=true");
  if (!Array.isArray(remote)) throw new Error("従業員一覧の形を確認できません。");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  // 直近の完了した2か月。途中の月を使って欠けた予定を休みと数えない。
  const first = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  const end = new Date(first.getTime() - 86400000).toISOString().slice(0, 10);
  first.setUTCMonth(first.getUTCMonth() - 2);
  const start = first.toISOString().slice(0, 10);
  const dates = [];
  for (let day = new Date(first); day.toISOString().slice(0, 10) <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    dates.push(day.toISOString().slice(0, 10));
  }
  const mapped = people.filter(person => shiftMode(person, settings) === "default").map(person => ({
    ...person,
    remote: remote.find(row => String(row.code) === codes.find(code => code.employee_id === person.employee_id)?.kot_employee_id),
  }));
  const days = [];
  for (const division of new Set(mapped.filter(p => p.remote).map(p => p.remote.divisionCode))) {
    const response = await relay(db, "/daily-schedules?" + new URLSearchParams({ division, ondivision: "true", start, end }))
      .catch(error => {
        if (error.message === "kot: JSON を解釈できません") return [];
        throw error;
      });
    if (!Array.isArray(response)) throw new Error("勤務予定の形を確認できません。");
    days.push(...response);
  }
  const rows = [];
  const skipped = [];
  for (const person of mapped) {
    if (!person.remote?.key) {
      skipped.push({ employee_id: person.employee_id, reason: "従業員コードを照合できません" });
      continue;
    }
    const odd = [];
    const pattern = mostFrequentPattern(person.remote.key, days, dates, isJapaneseHoliday, odd);
    // 全部休みは「予定を入れていない人」なので入れない（提出の画面が全部休みになるのを防ぐ）。
    if (pattern.every(row => !row.start_time)) {
      skipped.push({ employee_id: person.employee_id, reason: "勤務予定が無いので手で入力する", odd });
      continue;
    }
    rows.push(...pattern
      .filter(row => !existing.some(old => old.employee_id === person.employee_id && old.weekday === row.weekday))
      .map(row => ({ ...row, employee_id: person.employee_id })));
    if (odd.length) skipped.push({ employee_id: person.employee_id, reason: "30分単位でない予定を数えなかった", odd });
  }
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", start, end, rows, skipped }, null, 2));
  if (args.includes("--apply") && rows.length) {
    assertReadTime();
    check(await db.from("system_shift_default").upsert(rows, { onConflict: "employee_id,weekday", ignoreDuplicates: true }));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
