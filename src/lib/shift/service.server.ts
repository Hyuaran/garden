import { readSubmitterSettings } from "./submitters.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { shiftMode, type ShiftEmployee } from "./eligibility";
import { readDefaultPatterns } from "./defaults.server";
import {
  closedMessage,
  deadline,
  monthDays,
  validateDays,
  holidayCandidates,
  stamp,
  DEFAULT_SHIFT_START_MONTH,
  defaultDays,
  patternReady,
  validateDefaultDays,
} from "./rules";
import { pushLineStaff } from "@/lib/line/staff-client";
export class ShiftError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const db = () => getSupabaseAdmin();
function check(result: { error: unknown }) {
  if (result.error) {
    if (
      typeof result.error === "object" &&
      "message" in result.error &&
      (String(result.error.message).includes(closedMessage) || String(result.error.message).includes("確定後のシフトは変更できません"))
    )
      throw new ShiftError(String((result.error as { message: unknown }).message), 403);
    throw new ShiftError("シフトを保存・取得できませんでした。", 500);
  }
}
export async function employees() {
  const settings = await readSubmitterSettings();
  const result = await db()
    .from("root_employees_with_team")
    .select(
      "employee_id,employee_number,name,employment_type,business,current_team,is_active,termination_date,deleted_at,line_user_id,line_link_source",
    );
  check(result);
  return ((result.data as ShiftEmployee[]) || []).flatMap(e => {
    const mode = shiftMode(e, settings);
    return mode ? [{ ...e, shift_mode: mode }] : [];
  });
}
async function readDays(table: string, start: string, end: string) {
  const rows: {
    employee_id: string;
    work_date: string;
    start_time: string | null;
    end_time: string | null;
    day_kind: "work" | "rest" | "paid";
    kot_manual_at?: string | null;
    updated_at: string;
  }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const columns: string =
      table === "system_shift_confirmed"
        ? "employee_id,work_date,start_time,end_time,day_kind,updated_at,kot_status,kot_sent_at,kot_error,kot_manual_at"
        : "employee_id,work_date,start_time,end_time,day_kind,updated_at";
    const result = await db()
      .from(table)
      .select(columns)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date")
      .order("employee_id")
      .range(offset, offset + 999);
    check(result);
    rows.push(...((result.data || []) as unknown as typeof rows));
    if ((result.data || []).length < 1000) break;
  }
  return rows;
}
export async function readMonth(month: string) {
  const days = monthDays(month),
    start = days[0],
    end = days.at(-1)!;
  const results = await Promise.all(
    ["system_shift_wish", "system_shift_confirmed"].map((table) =>
      readDays(table, start, end),
    ),
  );
  const [submission, setting, confirmation] = await Promise.all([
    db()
      .from("system_shift_submission")
      .select("employee_id,submitted_at,note")
      .eq("year_month", month),
    db()
      .from("system_kanri_month_setting")
      .select("holidays,updated_at")
      .eq("year_month", month)
      .maybeSingle(),
    db()
      .from("system_shift_month")
      .select("confirmed_at,confirmed_by_name")
      .eq("year_month", month)
      .maybeSingle(),
  ]);
  [submission, setting, confirmation].forEach(check);
  return {
    days,
    wish: results[0],
    confirmed: results[1],
    submissions: submission.data || [],
    holidays: (setting.data?.holidays || []) as string[],
    confirmation: confirmation.data,
    updated_at:
      [
        ...results.flatMap((r) => r.map((x) => x.updated_at)),
        setting.data?.updated_at,
        confirmation.data?.confirmed_at,
      ]
        .filter(Boolean)
        .sort()
        .at(-1) || null,
  };
}
export async function myShift(
  employee_id: string,
  month: string,
  body?: unknown,
  note: unknown = "",
) {
  const person = (await employees()).find(
    (e) => e.employee_id === employee_id,
  );
  if (!person) {
    if (body !== undefined)
      throw new ShiftError("シフトの提出はありません。", 403);
    return { eligible: false };
  }
  const isDefault = person.shift_mode === "default";
  const message = isDefault && month < DEFAULT_SHIFT_START_MONTH
    ? "2026年12月分から提出します。" : null;
  if (message) {
    if (body !== undefined) throw new ShiftError(message, 403);
    return { eligible: true, mode: "default", message, editable: false };
  }
  const pattern = isDefault ? await readDefaultPatterns(employee_id) : [];
  if (isDefault && !patternReady(pattern)) {
    const message = "既定の勤務を準備しています。";
    if (body !== undefined) throw new ShiftError(message, 403);
    return { eligible: true, mode: "default", message, editable: false };
  }
  if (body !== undefined) {
    const current = new Date()
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
      .slice(0, 7);
    const next = new Date(current + "-01T00:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (
      month !== next.toISOString().slice(0, 7) ||
      Date.now() > deadline(month).getTime()
    )
      throw new ShiftError(closedMessage, 403);
    if (typeof note !== "string" || [...note].length > 500)
      throw new ShiftError("備考は500字までで入力してください。");
    const rows = isDefault ? validateDefaultDays(month, body, pattern) : validateDays(month, body);
    const result = await db().rpc("save_shift_person", {
      p_employee: employee_id,
      p_month: month,
      p_rows: rows,
      p_actor: employee_id,
      p_submit: true,
      p_note: note.trim(),
    });
    check(result);
  }
  const data = await readMonth(month);
  return {
    ...data,
    holidays: !isDefault && data.confirmation ? data.holidays : [],
    eligible: true,
    mode: person.shift_mode,
    defaults: isDefault ? defaultDays(month, pattern) : undefined,
    wish: data.days.map(work_date =>
      data.wish.find(r => r.employee_id === employee_id && r.work_date === work_date) ||
      (isDefault ? defaultDays(month, pattern).find(r => r.work_date === work_date)! :
        { work_date, start_time: null })),
    confirmed: data.confirmed.filter((r) => r.employee_id === employee_id),
    submissions: data.submissions.filter((r) => r.employee_id === employee_id),
    editable: !data.confirmation && Date.now() <= deadline(month).getTime(),
  };
}
export function deadlineText(month: string) {
  const d = deadline(month);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日(${d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" })}) 23:59`;
}
export async function notifyShift(
  month: string,
  people: ShiftEmployee[],
  actor: string,
  remind: boolean,
) {
  const text = remind
    ? `${Number(month.slice(5))}月のシフト希望の提出をお願いします。締切は${deadlineText(month)} です。公式LINEのメニューの［シフト］から提出できます。`
    : `${Number(month.slice(5))}月のシフトが確定しました。公式LINEのメニューの［シフト］から確認できます。`;
  let sent = 0,
    failed = 0,
    unlinked = 0;
  for (const person of people) {
    if (!person.line_user_id || person.line_link_source === "unfollowed") {
      unlinked++;
      continue;
    }
    let status = "sent",
      error: string | null = null;
    try {
      await pushLineStaff([person.line_user_id], text);
      sent++;
    } catch {
      status = "failed";
      error = "送信できませんでした。";
      failed++;
    }
    check(
      await db()
        .from("system_line_staff_message")
        .insert({
          work_date: month + "-01",
          shift: remind ? "shift_remind" : "shift_confirm",
          employee_id: person.employee_id,
          employee_number: person.employee_number || "",
          line_user_id: person.line_user_id,
          message: text,
          status,
          error,
          sent_by_employee_id: actor,
        }),
    );
  }
  return { sent, failed, unlinked };
}
export async function teamShift(
  month: string,
  action: string,
  body: Record<string, unknown>,
  actor: { employee_id: string; name: string; userId: string },
) {
  const people = (await employees()).filter(p => p.shift_mode !== "default" || month >= DEFAULT_SHIFT_START_MONTH),
    data = await readMonth(month);
  if (action === "read" && people.some(p => p.shift_mode === "default")) {
    const patterns = await readDefaultPatterns();
    for (const person of people.filter(p => p.shift_mode === "default")) {
      const pattern = patterns.filter(r => r.employee_id === person.employee_id);
      if (!patternReady(pattern)) continue;
      for (const row of defaultDays(month, pattern)) {
        if (!data.wish.some(r => r.employee_id === person.employee_id && r.work_date === row.work_date))
          data.wish.push({ ...row, employee_id: person.employee_id, updated_at: "", end_time: row.end_time ?? null, day_kind: row.day_kind! });
      }
    }
  }
  if (action === "read")
    return {
      ...data,
      people: people.map(({ employee_id, name, current_team, shift_mode }) => ({
        employee_id,
        name,
        current_team,
        shift_mode,
      })),
      candidates: holidayCandidates(
        data.days,
        data.wish.filter((r) =>
          people.some((p) => p.employee_id === r.employee_id && p.shift_mode !== "default"),
        ),
      ),
    };
  if (action === "person") {
    if (!people.some((p) => p.employee_id === body.employee_id))
      throw new ShiftError("対象者を確認してください。");
    const person = people.find(p => p.employee_id === body.employee_id)!;
    const rows = person.shift_mode === "default"
      ? validateDefaultDays(month, body.rows, [], true) : validateDays(month, body.rows, true);
    check(
      await db().rpc("save_shift_person", {
        p_employee: body.employee_id,
        p_month: month,
        p_rows: rows,
        p_actor: actor.employee_id,
        p_submit: false,
      }),
    );
    return { ok: true };
  }
  if (action === "manual") {
    if (!people.some(p => p.employee_id === body.employee_id) ||
        typeof body.work_date !== "string" || !data.days.includes(body.work_date))
      throw new ShiftError("対象の日を確認してください。");
    check(await db().from("system_shift_confirmed").update({
      kot_manual_at: new Date().toISOString(),
      kot_manual_by: actor.employee_id,
    }).eq("employee_id", body.employee_id).eq("work_date", body.work_date)
      .eq("day_kind", "paid").is("kot_manual_at", null));
    return { ok: true };
  }
  if (action === "holiday") {
    if (
      typeof body.work_date !== "string" ||
      !data.days.includes(body.work_date)
    )
      throw new ShiftError("日付を確認してください。");
    check(
      await db().rpc("toggle_shift_holiday", {
        p_month: month,
        p_date: body.work_date,
        p_actor: actor.userId,
      }),
    );
    return { ok: true };
  }
  if (action === "confirm") {
    check(
      await db().rpc("confirm_shift_month", {
        p_month: month,
        p_people: people.map((p) => p.employee_id),
        p_actor: actor.employee_id,
        p_name: actor.name,
      }),
    );
    return notifyShift(month, people, actor.employee_id, false);
  }
  if (action === "remind")
    return notifyShift(
      month,
      people.filter(
        (p) => !data.submissions.some((s) => s.employee_id === p.employee_id),
      ),
      actor.employee_id,
      true,
    );
  throw new ShiftError("操作を確認してください。");
}
