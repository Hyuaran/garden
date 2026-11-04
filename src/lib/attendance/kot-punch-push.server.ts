import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchKotEmployeeByCode } from "@/app/root/_lib/kot-api";
import { assertKotTime } from "@/lib/shift/kot-push.server";
import {
  enqueueRelayJob,
  waitRelayJob,
  getRelayHeartbeat,
  isRelayAlive,
} from "@/lib/relay/queue.server";
import type { RelayRequest } from "@/lib/relay/types";
import type { PunchType } from "@/app/system/_lib/attendance";
import { toJstDate } from "@/app/api/system/attendance/kot-export/_lib/kot-transform";
import {
  classifyPunchDay,
  currentPunchAgent,
  kotTimestamp,
  punchCodes,
  punchDeadline,
} from "./kot-punch";

type RawPunch = {
  id: number;
  employee_id: string;
  punch_type: PunchType;
  punched_at: string;
  kot_sync_status: string;
};
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("打刻の情報を保存・取得できませんでした。");
  return result.data;
}
export async function attendanceSettings() {
  const setting = checked(
    await getSupabaseAdmin()
      .from("system_attendance_settings")
      .select("kot_send_start_date")
      .eq("id", true)
      .single(),
  );
  if (!setting) throw new Error("開始日の設定を読み込めませんでした。");
  return setting;
}
async function punchReady(requirePunchVersion = true) {
  assertKotTime();
  const heartbeat = await getRelayHeartbeat();
  if (requirePunchVersion && !currentPunchAgent(heartbeat?.agent_version))
    throw new Error(
      "会社のパソコンの中継の係が古いため送れません。係の入れ替えが必要です。",
    );
  if (!isRelayAlive(heartbeat))
    throw new Error("会社のパソコンの中継が止まっています。");
}
export async function punchRelay(
  request: RelayRequest,
  actor: string,
  requirePunchVersion = true,
) {
  await punchReady(requirePunchVersion);
  const job = await enqueueRelayJob("kot", request, actor);
  return waitRelayJob(job.id);
}
export async function punchSendRows(date: string) {
  const db = getSupabaseAdmin();
  const setting = await attendanceSettings();
  if (!setting.kot_send_start_date || setting.kot_send_start_date > date)
    return { startDate: setting.kot_send_start_date, rows: [] };
  const raw: RawPunch[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = checked(
      await db
        .from("system_attendance_punches")
        .select("id,employee_id,punch_type,punched_at,kot_sync_status")
        .is("voided_at", null)
        .gte("punched_at", setting.kot_send_start_date + "T00:00:00+09:00")
        .lt(
          "punched_at",
          new Date(
            Date.parse(date + "T00:00:00+09:00") + 86400000,
          ).toISOString(),
        )
        .order("id")
        .range(offset, offset + 999),
    ) as RawPunch[];
    raw.push(...rows);
    if (rows.length < 1000) break;
  }
  const people =
    checked(
      await db
        .from("root_employees")
        .select("employee_id,name,kot_employee_id,attendance_rule"),
    ) || [];
  const sent =
    checked(
      await db
        .from("system_attendance_kot_send")
        .select("employee_id,work_date,status,error,rows")
        .gte("work_date", setting.kot_send_start_date)
        .lte("work_date", date),
    ) || [];
  const pending =
    checked(
      await db
        .from("system_attendance_corrections")
        .select("employee_id,work_date")
        .eq("status", "pending")
        .gte("work_date", setting.kot_send_start_date)
        .lte("work_date", date),
    ) || [];
  const batch = checked(
    await db
      .from("system_attendance_kot_batch")
      .select("batch_id")
      .eq("status", "sending")
      .limit(1),
  );
  const groups = new Map<string, RawPunch[]>();
  for (const row of raw) {
    const key = row.employee_id + ":" + toJstDate(row.punched_at);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const rows = [...groups.values()].flatMap((punches) => {
    if (punches.every((punch) => punch.kot_sync_status === "synced")) return [];
    const first = punches[0];
    const workDate = toJstDate(first.punched_at);
    const person = people.find((row) => row.employee_id === first.employee_id);
    const previous = sent.find(
      (row) =>
        row.employee_id === first.employee_id && row.work_date === workDate,
    );
    if (previous && ["sent", "manual"].includes(previous.status)) return [];
    const classification = classifyPunchDay({
      date: workDate,
      punches,
      isOffice: person?.attendance_rule === "office",
      pending: pending.some(
        (row) =>
          row.employee_id === first.employee_id && row.work_date === workDate,
      ),
    });
    return [
      {
        employee_id: first.employee_id,
        name: person?.name || first.employee_id,
        work_date: workDate,
        ...classification,
        punches,
        code: person?.kot_employee_id,
        previousStatus: previous?.status,
        previousRows: previous?.rows,
        error: previous?.error,
        ...(batch?.length
          ? {
              status: "needs_check",
              reason: "同期状況の画面の処理が途中です。",
            }
          : {}),
        ...(!person?.kot_employee_id
          ? {
              status: "needs_check",
              reason: "KING OF TIME の従業員コードが登録されていません。",
            }
          : {}),
      },
    ];
  });
  return { startDate: setting.kot_send_start_date, rows };
}
export async function pushPunchDay(
  date: string,
  employeeId: string,
  actor: string,
  manual = false,
) {
  const db = getSupabaseAdmin();
  const row = (await punchSendRows(date)).rows.find(
    (row) => row.employee_id === employeeId && row.work_date === date,
  );
  if (
    !row ||
    (manual
      ? row.status !== "expired"
      : row.status !== "ready" && row.previousStatus !== "unknown")
  ) {
    throw new Error(row?.reason || "送信対象ではありません。");
  }
  if (
    row.status === "pending" ||
    row.reason === "同期状況の画面の処理が途中です。"
  )
    throw new Error(row.reason);
  if (manual) {
    checked(
      await db.rpc("mark_attendance_manual", {
        p_employee: employeeId,
        p_date: date,
        p_actor: actor,
      }),
    );
    return { status: "manual" };
  }
  await punchReady();
  const employee = await fetchKotEmployeeByCode(row.code!);
  if (!employee.key || !/^[A-Za-z0-9]+$/.test(employee.key))
    throw new Error("KING OF TIME の従業員を確認できませんでした。");
  const attempt = crypto.randomUUID();
  checked(
    await db.rpc("claim_attendance_send", {
      p_employee: employeeId,
      p_date: date,
      p_ids: row.punches.map((punch) => punch.id),
      p_attempt: attempt,
    }),
  );
  async function finish(status: string, error: string | null, rows: unknown) {
    checked(
      await db.rpc("finish_attendance_send", {
        p_employee: employeeId,
        p_date: date,
        p_attempt: attempt,
        p_status: status,
        p_error: error,
        p_rows: rows,
        p_actor: actor,
      }),
    );
    return { status, error };
  }
  const body = {
    employeeTimeRecordRequests: [
      {
        employeeKey: employee.key,
        timeRecords: row.transformed.punches.map((punch, index) => ({
          date,
          time: kotTimestamp(punch.punched_at),
          code: punchCodes[punch.punch_type],
          recordId: `garden-${attempt}-${index}`,
        })),
      },
    ],
  };
  try {
    const existing = await punchRelay(
      {
        method: "GET",
        path:
          "/daily-workings/timerecord?" +
          new URLSearchParams({
            employeeKeys: employee.key,
            start: date,
            end: date,
          }),
      },
      actor,
    ).catch((error: unknown) => {
      // KING OF TIME は範囲に打刻が 1 件も無いと空の応答を返し、中継の係は JSON でないと報告する。
      if (error instanceof Error && error.message === "kot: JSON を解釈できません")
        return [];
      throw error;
    });
    // 1 日だけ指定すると配列でなく 1 日分の形で返ることがある。空の配列は打刻 0 件。
    if (!existing)
      throw new Error("KING OF TIME の打刻を確認できませんでした。");
    const days = Array.isArray(existing) ? existing : [existing];
    const records = days
      .flatMap((day) => day.dailyWorkings || [])
      .filter((person) => person.employeeKey === employee.key)
      .flatMap((person) => person.timeRecord || []);
    if (records.length) {
      return finish(
        row.previousStatus === "unknown" ? "sent" : "failed",
        row.previousStatus === "unknown"
          ? null
          : "KING OF TIME に打刻があります。KING OF TIME の画面で確認してください。",
        row.previousRows || body,
      );
    }
    if (Date.now() >= punchDeadline(date))
      return finish(
        "failed",
        "登録の期限を過ぎました。KING OF TIME の画面で入力してください。",
        body,
      );
    if (row.status !== "ready") return finish("failed", row.reason, body);
    for (const punch of row.transformed.punches) {
      if (punch.source_punch_id === undefined) continue;
      checked(
        await db
          .from("system_attendance_punches")
          .update({ kot_punched_at: punch.punched_at })
          .eq("id", punch.source_punch_id)
          .is("voided_at", null)
          .eq("kot_sync_status", "sending"),
      );
    }
    const response = (await punchRelay(
      { method: "POST", path: "/daily-workings/timerecord", body },
      actor,
    )) as {
      successRequest?: {
        employeeKey: string;
        timeRecords?: { recordId?: string }[];
      }[];
      errorRequest?: { errors?: { message?: string; code?: string }[] }[];
    };
    if (response?.errorRequest?.length) {
      return finish(
        "failed",
        response.errorRequest
          .flatMap((row) => row.errors || [])
          .map((error) =>
            error.message &&
            /[ぁ-んァ-ヶ一-龠]/.test(error.message) &&
            !/token|secret|https?:/i.test(error.message)
              ? error.message
              : `KING OF TIME が打刻を受け付けませんでした${error.code && /^\d+$/.test(error.code) ? `（番号 ${error.code}）` : ""}。`,
          )
          .join("、")
          .slice(0, 500),
        body,
      );
    }
    const success =
      response?.successRequest
        ?.filter((person) => person.employeeKey === employee.key)
        .flatMap((person) => person.timeRecords || []) || [];
    const complete = body.employeeTimeRecordRequests[0].timeRecords.every(
      (sent) => success.some((record) => record.recordId === sent.recordId),
    );
    return finish(
      complete ? "sent" : "unknown",
      complete ? null : "KING OF TIME の送信結果を確認できませんでした。",
      body,
    );
  } catch {
    return finish(
      "unknown",
      "送信結果を確認できませんでした。もう一度押すと KING OF TIME の打刻を確認します。",
      body,
    );
  }
}
