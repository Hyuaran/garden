// 実行はClaudeのみ。node --env-file=.env.local scripts/attendance/import-kot-november.mjs --from 2026-11-01 --to YYYY-MM-DD [--apply]
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const types = {
  1: "clock_in",
  2: "clock_out",
  3: "break_start",
  4: "break_end",
};
const namespace = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
export function punchId(code, time, type) {
  const digest = createHash("sha1")
    .update(namespace)
    .update(`${code}|${new Date(time).toISOString()}|${type}`)
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 15) | 80;
  digest[8] = (digest[8] & 63) | 128;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function importPunches(code, rows) {
  const skipped = [];
  const punches = [];
  for (const row of rows) {
    const type = types[String(row.code)];
    if (!type) {
      skipped.push({ ...row, reason: "対象外の打刻種別" });
      continue;
    }
    if (!Number.isFinite(Date.parse(row.time)))
      throw new Error("打刻の時刻を確認できません。");
    punches.push({
      punch_type: type,
      punched_at: row.time,
      client_punch_id: punchId(code, row.time, type),
    });
  }
  return {
    punches: [
      ...new Map(punches.map((row) => [row.client_punch_id, row])).values(),
    ],
    skipped,
  };
}
export function importShift(row) {
  const holiday = row?.holidaysObtained?.fulltimeHoliday;
  if (holiday || !row?.clockInSchedule) {
    return {
      shift: {
        start_time: null,
        kot_status: ["公休", "欠勤"].includes(holiday?.name)
          ? "skipped"
          : "sent",
      },
      fullHoliday: Boolean(holiday),
    };
  }
  const start = row.clockInSchedule.slice(11, 16);
  const end = row.clockOutSchedule?.slice(11, 16);
  if (end !== "21:00" || !/^(1[0-9]|20):(00|30)$/.test(start)) {
    return {
      reason: "開始は10:00〜20:30の30分単位、終了は21:00の予定だけ取得します。",
    };
  }
  return {
    shift: { start_time: start, kot_status: "sent" },
    fullHoliday: false,
  };
}
function check(result) {
  if (result.error)
    throw new Error("取得・保存に失敗しました。処理を停止します。");
  return result.data;
}
export function assertReadTime(now = new Date()) {
  const time = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour12: false })
    .slice(0, 5);
  if (
    (time >= "08:30" && time < "10:00") ||
    (time >= "17:30" && time < "18:30")
  ) {
    throw new Error(
      "KING OF TIME が止まっている時間です。10:00または18:30以降に実行してください。",
    );
  }
}
async function relay(db, path) {
  assertReadTime();
  const job = check(
    await db
      .from("system_relay_jobs")
      .insert({
        kind: "kot",
        request: { method: "GET", path },
        requested_by: "import-kot-november",
        expires_at: new Date(Date.now() + 60000).toISOString(),
      })
      .select("id")
      .single(),
  );
  const end = Date.now() + 55000;
  while (Date.now() < end) {
    const row = check(
      await db
        .from("system_relay_jobs")
        .select("status,result,error")
        .eq("id", job.id)
        .single(),
    );
    if (row.status === "done") return row.result;
    if (["failed", "expired"].includes(row.status))
      throw new Error(row.error || "中継が失敗しました。");
    // サーバーの仕事完了待ち。画面の定期取得ではない。自動実行は1日0回。
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("中継の完了を確認できませんでした。");
}
export async function main(args = process.argv.slice(2)) {
  const value = (flag) => args[args.indexOf(flag) + 1];
  const from = value("--from"),
    to = value("--to");
  const validDate = (value) =>
    /^2026-11-\d{2}$/.test(value || "") &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !args.includes("--from") ||
    !args.includes("--to") ||
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    args.some(
      (item, index) =>
        !["--from", "--to", "--apply", "--dry-run"].includes(item) &&
        !["--from", "--to"].includes(args[index - 1]),
    ) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  )
    throw new Error(
      "--from 2026-11-01 --to YYYY-MM-DD を指定してください。11月内だけ取得します。",
    );
  assertReadTime();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const heartbeat = check(
    await db
      .from("system_relay_heartbeat")
      .select("agent_version,last_seen_at")
      .eq("id", "host-pc")
      .single(),
  );
  const version = heartbeat.agent_version?.split(".").map(Number);
  if (
    !version ||
    version[0] < 1 ||
    (version[0] === 1 && version[1] < 4) ||
    Date.now() - Date.parse(heartbeat.last_seen_at) > 120000
  )
    throw new Error("中継の係1.4.0以上と生存確認が必要です。");
  const setting = check(
    await db
      .from("system_attendance_settings")
      .select("kot_send_start_date")
      .eq("id", true)
      .single(),
  );
  const people = check(
    await db
      .from("root_employees_with_team")
      .select(
        "employee_id,employee_number,name,employment_type,business,current_team,is_active,termination_date,deleted_at",
      ),
  );
  const codes = check(
    await db.from("root_employees").select("employee_id,kot_employee_id"),
  );
  const settings = check(
    await db.from("system_shift_submitter").select("employee_id,mode"),
  );
  // employees() が使う判定本体をそのまま読み込む。対象者の条件をここに複製しない。
  const source = await readFile(
    new URL("../../src/lib/shift/eligibility.ts", import.meta.url),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  const { isShiftEligible } = await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
  const eligible = people.filter((person) => isShiftEligible(person, settings));
  const remote = await relay(db, "/employees?includeResigner=true");
  if (!Array.isArray(remote))
    throw new Error("従業員一覧の形を確認できません。");
  const mapped = codes
    .map((person) => ({
      ...person,
      remote: remote.find((row) => String(row.code) === person.kot_employee_id),
    }))
    .filter((person) => person.remote);
  const scheduleDays = [];
  for (const division of new Set(
    mapped
      .filter((person) =>
        eligible.some((row) => row.employee_id === person.employee_id),
      )
      .map((person) => person.remote.divisionCode),
  )) {
    const response = await relay(
      db,
      "/daily-schedules?" +
        new URLSearchParams({
          division,
          ondivision: "true",
          start: from,
          end: to,
        }),
    ).catch((error) => {
      if (error.message === "kot: JSON を解釈できません") return [];
      throw error;
    });
    if (!Array.isArray(response)) throw new Error("予定の形を確認できません。");
    scheduleDays.push(...response);
  }
  const report = {
    mode: args.includes("--apply") ? "apply" : "dry-run",
    people: mapped.length,
    days: 0,
    punches: 0,
    shifts: 0,
    changed: 0,
    skipped: [],
    managerChanges: [],
    holidayCandidates: [],
    holidayDifferences: [],
  };
  report.skipped.push(
    ...codes
      .filter(
        (person) =>
          !mapped.some((row) => row.employee_id === person.employee_id) &&
          people.some(
            (row) =>
              row.employee_id === person.employee_id &&
              row.is_active === true &&
              !row.deleted_at,
          ),
      )
      .map((person) => ({
        employee_id: person.employee_id,
        reason: "KING OF TIME の従業員コードを照合できません",
      })),
  );
  // 打刻は全員分をまとめて 1 回で読む（人×日で読むと 1 か月で 1000 回を超えるため）。
  const keys = mapped.map((person) => person.remote.key);
  const recordDays = [];
  for (let index = 0; index < keys.length; index += 40) {
    const response = await relay(
      db,
      "/daily-workings/timerecord?" +
        new URLSearchParams({
          employeeKeys: keys.slice(index, index + 40).join(","),
          start: from,
          end: to,
        }),
    ).catch((error) => {
      // 範囲に打刻が 1 件も無いと KING OF TIME は空の応答を返す。
      if (error.message === "kot: JSON を解釈できません") return [];
      throw error;
    });
    // 1 日だけのときは配列でなく 1 日分の形で返ることがある。
    recordDays.push(...(Array.isArray(response) ? response : [response]));
  }
  const plans = [];
  const holidays =
    check(
      await db
        .from("system_kanri_month_setting")
        .select("holidays")
        .eq("year_month", "2026-11")
        .maybeSingle(),
    )?.holidays || [];
  for (
    let day = new Date(from + "T00:00:00Z");
    day.toISOString().slice(0, 10) <= to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    if (setting.kot_send_start_date && date >= setting.kot_send_start_date) {
      report.skipped.push({ date, reason: "Gardenの打刻の開始日以降" });
      continue;
    }
    report.days++;
    let fullHoliday = 0;
    for (const person of mapped) {
      const records = recordDays
        .filter((row) => String(row.date).slice(0, 10) === date)
        .flatMap((day) => day.dailyWorkings || [])
        .filter((row) => row.employeeKey === person.remote.key)
        .flatMap((row) => row.timeRecord || []);
      const imported = importPunches(person.kot_employee_id, records);
      report.skipped.push(
        ...imported.skipped.map((row) => ({
          ...row,
          employee_id: person.employee_id,
          date,
        })),
      );
      const oldPunches = check(
        await db
          .from("system_attendance_punches")
          .select("client_punch_id")
          .eq("employee_id", person.employee_id)
          .eq("source", "kot_import")
          .gte("punched_at", date + "T00:00:00+09:00")
          .lt(
            "punched_at",
            new Date(day.getTime() + 86400000).toISOString().slice(0, 10) +
              "T00:00:00+09:00",
          ),
      );
      let shift = null;
      if (eligible.some((row) => row.employee_id === person.employee_id)) {
        const schedule = scheduleDays
          .filter((row) => row.date?.slice(0, 10) === date)
          .flatMap((row) => row.dailySchedules || [])
          .find((row) => row.employeeKey === person.remote.key);
        const result = importShift(schedule);
        if (result.fullHoliday) fullHoliday++;
        if (result.reason)
          report.skipped.push({
            date,
            employee_id: person.employee_id,
            reason: result.reason,
          });
        else {
          shift = result.shift;
          report.shifts++;
          const previous = check(
            await db
              .from("system_shift_confirmed")
              .select("start_time,updated_by")
              .eq("employee_id", person.employee_id)
              .eq("work_date", date)
              .maybeSingle(),
          );
          if (previous?.updated_by)
            report.managerChanges.push({
              date,
              employee_id: person.employee_id,
              previous: previous.start_time,
              next: shift.start_time,
            });
          if (previous?.start_time?.slice(0, 5) !== shift.start_time)
            report.changed++;
        }
      }
      const before = new Set(oldPunches.map((row) => row.client_punch_id));
      const after = new Set(imported.punches.map((row) => row.client_punch_id));
      report.changed +=
        [...before].filter((id) => !after.has(id)).length +
        [...after].filter((id) => !before.has(id)).length;
      report.punches += imported.punches.length;
      plans.push({
        p_employee: person.employee_id,
        p_date: date,
        p_punches: imported.punches,
        p_shift: shift,
      });
    }
    if (eligible.length && fullHoliday === eligible.length) {
      report.holidayCandidates.push(date);
      if (!holidays.includes(date)) report.holidayDifferences.push(date);
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (args.includes("--apply")) {
    for (const plan of plans)
      check(await db.rpc("import_kot_attendance_day", plan));
    console.log("人と日ごとの置換が完了しました。");
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
