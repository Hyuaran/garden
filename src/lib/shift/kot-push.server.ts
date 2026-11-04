import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchKotEmployeeByCode } from "@/app/root/_lib/kot-api";
import {
  enqueueRelayJob,
  getRelayHeartbeat,
  isRelayAlive,
  waitRelayJob,
} from "@/lib/relay/queue.server";
import type { RelayRequest } from "@/lib/relay/types";
import { hasLunchBreak, monthDays } from "./rules";

export type KotShiftRow = {
  employee_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  day_kind?: "work" | "rest" | "paid";
  updated_at: string;
  kot_status: "unsent" | "sent" | "failed" | "skipped";
  kot_sent_at: string | null;
  kot_error: string | null;
};

const KOT_EMPTY_RESPONSE = "kot: JSON を解釈できません";

export function kotToday(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export function assertKotTime(now = new Date()) {
  const time = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour12: false })
    .slice(0, 5);
  const resume =
    time >= "08:30" && time < "10:00"
      ? "10:00"
      : time >= "17:30" && time < "18:30"
        ? "18:30"
        : null;
  if (resume)
    throw new Error(
      `この時間は KING OF TIME が予定を受け付けていません。${resume} 以降にもう一度押してください。`,
    );
}

export function currentAgent(version: string | null | undefined) {
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return false;
  // 1.3.1 から休憩と全日休暇を送れる。
  const [major, minor, patch] = version.split(".").map(Number);
  return (
    major > 1 ||
    (major === 1 && (minor > 3 || (minor === 3 && patch >= 1)))
  );
}

async function ready() {
  assertKotTime();
  const heartbeat = await getRelayHeartbeat();
  if (!currentAgent(heartbeat?.agent_version)) {
    throw new Error(
      "会社のパソコンの中継の係が古いため送れません。係の入れ替えが必要です。",
    );
  }
  if (!isRelayAlive(heartbeat))
    throw new Error("会社のパソコンの中継が止まっています。");
}

async function relay(request: RelayRequest, actor: string) {
  assertKotTime();
  const job = await enqueueRelayJob("kot", request, actor);
  return waitRelayJob(job.id);
}

function check(result: { error: unknown }) {
  if (result.error) throw new Error("送信結果を保存・取得できませんでした。");
}

export async function kotRows(month: string) {
  const days = monthDays(month);
  const rows: KotShiftRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await getSupabaseAdmin()
      .from("system_shift_confirmed")
      .select(
        "employee_id,work_date,start_time,end_time,day_kind,updated_at,kot_status,kot_sent_at,kot_error",
      )
      .gte("work_date", days[0])
      .lte("work_date", days.at(-1)!)
      .order("employee_id")
      .order("work_date")
      .range(offset, offset + 999);
    check(result);
    rows.push(...(result.data || []));
    if ((result.data || []).length < 1000) return rows;
  }
}

// KOT の予定の一覧は「日ごと」に、その日の予定（人ごと）が入る形で返る。
type Existing = {
  date: string;
  dailySchedules?: {
    date?: string;
    employeeKey: string;
    clockInSchedule?: string | null;
    clockOutSchedule?: string | null;
  }[];
};
// 登録の成功側の日付は "Mon Apr 01 00:00:00 JST 2024" の形で返るため、日付の照合には使わない。
type PutResult = {
  successRequest?: {
    employeeKey: string;
    dailySchedules?: { date?: string }[];
  }[];
  errorRequest?: {
    employeeKey: string;
    errors: { date: string; code: string; message: string }[];
  }[];
};

export async function pushKotPerson(
  month: string,
  employeeId: string,
  actor: string,
) {
  await ready();
  const db = getSupabaseAdmin();
  const confirmation = await db
    .from("system_shift_month")
    .select("confirmed_at")
    .eq("year_month", month)
    .maybeSingle();
  check(confirmation);
  if (!confirmation.data?.confirmed_at)
    throw new Error("先にシフトを確定してください。");
  const rows = (await kotRows(month)).filter(
    (row) =>
      row.employee_id === employeeId &&
      row.work_date > kotToday() &&
      ["unsent", "failed"].includes(row.kot_status),
  );
  let sent = 0;
  let failed = 0;
  async function record(row: KotShiftRow, error: string | null) {
    const result = await db
      .from("system_shift_confirmed")
      .update({
        kot_status: error ? "failed" : "sent",
        kot_error: error,
        ...(!error
          ? {
              kot_sent_at: new Date().toISOString(),
              kot_sent_start: row.start_time,
              kot_sent_end: row.start_time ? row.end_time?.slice(0, 5) : null,
            }
          : {}),
      })
      .eq("employee_id", employeeId)
      .eq("work_date", row.work_date)
      .eq("updated_at", row.updated_at);
    check(result);
    if (error) failed++;
    else sent++;
  }
  if (!rows.length) return { sent, failed };
  let employee: Awaited<ReturnType<typeof fetchKotEmployeeByCode>>;
  let existing: Existing[];
  try {
    const person = await db
      .from("root_employees")
      .select("kot_employee_id")
      .eq("employee_id", employeeId)
      .single();
    check(person);
    if (!person.data?.kot_employee_id)
      throw new Error("KING OF TIME の従業員コードが登録されていません");
    employee = await fetchKotEmployeeByCode(person.data.kot_employee_id);
    if (!employee.key || !employee.divisionCode)
      throw new Error(
        "KING OF TIME の所属または従業員を確認できませんでした。",
      );
    const days = monthDays(month);
    const tomorrow = new Date(kotToday() + "T00:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const start = [days[0], tomorrow.toISOString().slice(0, 10)].sort().at(-1)!;
    existing = (await relay(
      {
        method: "GET",
        path:
          "/daily-schedules?" +
          new URLSearchParams({
            division: employee.divisionCode,
            ondivision: "true",
            start,
            end: days.at(-1)!,
          }),
      },
      actor,
    ).catch((error: unknown) => {
      // KOT は範囲に予定が1件も無いと空の応答を返し、中継の係は JSON でないと報告する。
      if (error instanceof Error && error.message === KOT_EMPTY_RESPONSE)
        return [];
      throw error;
    })) as Existing[];
    if (!Array.isArray(existing))
      throw new Error("KING OF TIME の予定を確認できませんでした。");
  } catch (error) {
    for (const row of rows) await record(row, publicError(error));
    return { sent, failed };
  }
  const working = rows.filter((row) => row.start_time && (!row.day_kind || row.day_kind === "work"));
  if (working.length) {
    let response: PutResult;
    try {
      response = (await relay(
        {
          method: "PUT",
          path: "/daily-schedules",
          body: {
            employeeScheduleRequests: [
              {
                employeeKey: employee.key,
                dailySchedules: working.map((row) =>
                  scheduleBody(row, employee.divisionCode!),
                ),
              },
            ],
          },
        },
        actor,
      )) as PutResult;
    } catch (error) {
      response = {
        errorRequest: [
          {
            employeeKey: employee.key,
            errors: working.map((row) => ({
              date: row.work_date,
              code: "",
              message: publicError(error),
            })),
          },
        ],
      };
    }
    for (const row of working) {
      const errors =
        response?.errorRequest
          ?.filter((item) => item.employeeKey === employee.key)
          .flatMap((item) => item.errors || []) || [];
      const error = errors.find(
        (item) => kotErrorDate(item.date) === row.work_date || !item.date,
      );
      const success = response?.successRequest?.some(
        (item) => item.employeeKey === employee.key,
      );
      await record(
        row,
        error
          ? publicError(new Error(error.message))
          : success
            ? null
            : "KING OF TIME の送信結果を確認できませんでした。",
      );
    }
  }
  for (const row of rows.filter((row) => !working.includes(row))) {
    try {
      const schedule = existing
        .find((day) => String(day.date).slice(0, 10) === row.work_date)
        ?.dailySchedules?.find((item) => item.employeeKey === employee.key);
      // 消すのは勤務の予定だけ。公休・欠勤は KOT の画面でしか入れ直せないので残す。
      if (schedule?.clockInSchedule)
        await relay(
          {
            method: "DELETE",
            path: `/daily-schedules/${employee.key}/${row.work_date}`,
          },
          actor,
        );
      await record(row, null);
    } catch (error) {
      await record(row, publicError(error));
    }
  }
  return { sent, failed };
}

// KOT のエラーの日付は "Thu Dec 24 00:00:00 JST 2026" の形で返る。
function kotErrorDate(value: string | undefined) {
  const match = /^\w{3} (\w{3}) (\d{2}) .* (\d{4})$/.exec(value ?? "");
  if (!match) return value;
  const month = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(match[1]) / 3 + 1;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2]}`;
}

function scheduleBody(row: KotShiftRow, divisionCode: string) {
  const start = row.start_time!.slice(0, 5);
  return {
    workingDate: row.work_date,
    workPlaceDivisionCode: divisionCode,
    clockInSchedule: `${row.work_date}T${start}+09:00`,
    clockOutSchedule: `${row.work_date}T${row.end_time!.slice(0, 5)}+09:00`,
    ...(hasLunchBreak(start, row.end_time!.slice(0, 5))
      ? {
          startEndBreakSchedule: [
            {
              start: `${row.work_date}T13:00+09:00`,
              end: `${row.work_date}T14:00+09:00`,
            },
          ],
        }
      : {}),
  };
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/打刻/.test(message)) return "打刻があるため変更できません";
  if (
    /[ぁ-んァ-ヶ一-龠]/.test(message) &&
    !/token|secret|https?:/i.test(message)
  )
    return message.slice(0, 160);
  return "KING OF TIME に送信できませんでした。もう一度お試しください。";
}
