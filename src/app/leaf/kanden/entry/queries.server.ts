import "server-only";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { japanDate } from "@/lib/notices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { signCasePhotos } from "@/lib/leaf-kanden/submissions.server";
import { UUID } from "@/lib/leaf-kanden/submissions";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import type { CalendarDay } from "@/lib/leaf-kanden/supply-point";
import { paymentColumns } from "../PaymentDetails";
import type { TableQuery } from "@/app/system/_components/DataTable/DataTable";
import { ENTRY_SCOPE, ENTRY_START, entryQuery, type EntryTab, type EntryHistory, type EntryDraft, type EntryList, type EntryRecord, type EntryTarget } from "./entry";

export async function requireEntry() {
  const context = await requireSystemView(ENTRY_SCOPE);
  // 12/1 の展開までは全権管理者だけ（試し使い）
  if (japanDate() < ENTRY_START && context.viewer.role !== "super_admin") throw new Error("受付開始前です。");
  return context;
}

export async function readEntryList(tab: EntryTab, query: TableQuery, counts: boolean) {
  const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_entry_page", {
    p_tab: tab, p_query: query, p_counts: counts,
  });
  if (error) throw error;
  return data as EntryList;
}

export async function readEntryCalendar() {
  const { data, error } = await getSupabaseAdmin().from("kanden_calendar").select("*").limit(1000);
  return error ? null : readCalendarDays(data);
}

export async function readEntryPage(query = entryQuery) {
  const [list, calendar] = await Promise.allSettled([
    readEntryList("受付待ち", query, true), readEntryCalendar(),
  ]);
  return {
    list: list.status === "fulfilled" ? list.value : null,
    calendar: calendar.status === "fulfilled" ? calendar.value : null,
  };
}

function readCalendarDays(rows: Record<string, unknown>[]): CalendarDay[] | null {
  const days = rows.flatMap(row => {
    const code = row.schedule_code ?? row.schedule_no ?? row.schedule_number ?? row.schedule
      ?? row.nittei_code ?? row.nittei ?? row["日程"];
    const date = row.supply_start_date ?? row.supply_start_on ?? row.start_date ?? row.start_on ?? row.calendar_date
      ?? row.target_date ?? row.effective_date ?? row.supply_date ?? row.date ?? row["供給開始日"];
    const schedule = String(code ?? "");
    return /^\d{1,2}$/.test(schedule) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? [{ schedule: schedule.padStart(2, "0"), date }] : [];
  });
  return days.length === rows.length ? days : null;
}

const intakeFields = "id,set_id,employee_id,employee_name,kanri_no,customer_name,acquisition,urgent_sw,sw_month,has_denki,has_douryoku,has_gas,note,updated_at";
type Intake = Pick<EntryDraft, "kanri_no" | "customer_name" | "acquisition" | "urgent_sw" | "sw_month" |
  "has_denki" | "has_douryoku" | "has_gas" | "note"> & {
  id: string; set_id: string; employee_id: string; employee_name: string; updated_at: string;
};

export async function readEntryRecord(target: EntryTarget) {
  if (typeof target?.id !== "string" || !UUID.test(target.id) || typeof target.intake !== "boolean") {
    throw new Error("Invalid entry target");
  }
  const db = getSupabaseAdmin();
  if (target.intake) {
    const { data, error } = await db.from("leaf_kanden_submissions").select(intakeFields).eq("id", target.id).single();
    if (error) throw error;
    const intake = data as Intake;
    return { order: null, intake };
  }
  const { data, error } = await db.from("leaf_kanden_orders").select(`*,leaf_kanden_payments(${paymentColumns})`).eq("id", target.id).single();
  if (error) throw error;
  const order = data as unknown as EntryRecord;
  let query = db.from("leaf_kanden_submissions").select(intakeFields);
  if (order.submission_id) query = query.eq("id", order.submission_id);
  else if (order.kanri_no) query = query.eq("kanri_no", order.kanri_no);
  else return { order, intake: null };
  const result = await query.order("submitted_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (result.error) throw result.error;
  return { order, intake: result.data as Intake | null };
}

export async function readEntryPhotos(kanriNo: string | null, setId: string | undefined, specsOnly = false) {
  kanriNo = kanriNo && normalizeKanriNo(kanriNo);
  if (!kanriNo && !setId) return [];
  const photos: { image_path: string; category: string }[] = [];
  const db = getSupabaseAdmin();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("leaf_kanden_photos").select("image_path,category");
    if (kanriNo && setId) query = query.or(`kanri_no.eq.${kanriNo},set_id.eq.${setId}`);
    else if (kanriNo) query = query.eq("kanri_no", kanriNo);
    else if (setId) query = query.eq("set_id", setId);
    if (specsOnly) query = query.eq("category", "諸元");
    const { data, error } = await query.order("event_date", { nullsFirst: false }).order("image_path")
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    photos.push(...data.filter(photo => !/\.pdf$/i.test(photo.image_path)));
    if (data.length < pageSize || (specsOnly && photos.length)) return photos;
  }
}

export async function signEntryPhotos(photos: Awaited<ReturnType<typeof readEntryPhotos>>, name: string) {
  const signed = [];
  for (let offset = 0; offset < photos.length; offset += 500) {
    const page = photos.slice(offset, offset + 500);
    const batch = await signCasePhotos(page.map(photo => photo.image_path), name, offset);
    signed.push(...batch.map((photo, index) => ({ ...photo, category: page[index].category })));
  }
  return signed;
}

export async function readEntryHistory(id: string) {
  const db = getSupabaseAdmin();
  const rows: EntryHistory[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("leaf_kanden_order_history")
      .select("id,changed_at,changed_by,field,old_value,new_value")
      .eq("order_id", id).order("changed_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data as EntryHistory[]);
    if (data.length < 500) return rows;
  }
}
