import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { halfHourTimes, patternReady, type DefaultOption, type DefaultPattern } from "./rules";

export async function readDefaultPatterns(employeeId?: string) {
  const rows: (DefaultPattern & { employee_id: string })[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = getSupabaseAdmin().from("system_shift_default")
      .select("employee_id,weekday,start_time,end_time");
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query.order("employee_id").order("weekday").range(offset, offset + 999);
    if (error) throw new Error("既定の勤務を取得できませんでした。");
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

export function validatePattern(input: unknown): DefaultPattern[] {
  if (!Array.isArray(input) || input.length !== 8 || !patternReady(input))
    throw new Error("曜日ごとと祝日の勤務を入力してください。");
  return input.map(row => {
    if (!(row.start_time === null && row.end_time === null) &&
        (!halfHourTimes.includes(row.start_time) ||
         ![...halfHourTimes, "24:00"].includes(row.end_time) || row.start_time >= row.end_time))
      throw new Error("開始と終了を30分単位で入力してください。");
    return { weekday: row.weekday, start_time: row.start_time, end_time: row.end_time };
  });
}

export async function writeDefaultPattern(employeeId: string, input: unknown, actor: string) {
  const rows = validatePattern(input);
  const { error } = await getSupabaseAdmin().from("system_shift_default").upsert(
    rows.map(row => ({
      ...row,
      employee_id: employeeId,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })),
  );
  if (error) throw new Error("既定の勤務を保存できませんでした。");
}

export async function readDefaultOptions(employeeId?: string) {
  const rows: (DefaultOption & { employee_id: string })[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = getSupabaseAdmin().from("system_shift_default_option")
      .select("employee_id,label,start_time,end_time");
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query.order("employee_id").order("sort").order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("選べる勤務を取得できませんでした。");
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

export function validateOptions(input: unknown): DefaultOption[] {
  if (!Array.isArray(input) || input.length > 50)
    throw new Error("選べる勤務は50件までで入力してください。");
  return input.map(row => {
    if (!row || typeof row.label !== "string" || !row.label.trim() || row.label.trim().length > 100 ||
        !halfHourTimes.includes(row.start_time) ||
        ![...halfHourTimes, "24:00"].includes(row.end_time) || row.start_time >= row.end_time)
      throw new Error("選べる勤務の名前と、30分単位の開始・終了を入力してください。");
    return { label: row.label.trim(), start_time: row.start_time, end_time: row.end_time };
  });
}

export async function writeDefaultOptions(employeeId: string, input: unknown, actor: string) {
  const rows = validateOptions(input);
  const { error } = await getSupabaseAdmin().rpc("replace_shift_default_options", {
    p_employee: employeeId,
    p_options: rows,
    p_actor: actor,
  });
  if (error) throw new Error("選べる勤務を保存できませんでした。");
}
