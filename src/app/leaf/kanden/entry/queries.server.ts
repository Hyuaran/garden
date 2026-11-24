import "server-only";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { japanDate } from "@/lib/notices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { signCasePhotos } from "@/lib/leaf-kanden/submissions.server";
import { UUID, type CustomerFields } from "@/lib/leaf-kanden/submissions";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import { normalizeEntrySearch } from "./search-query";
import type { CalendarDay } from "@/lib/leaf-kanden/supply-point";
import { paymentColumns } from "../PaymentDetails";
import { DEFAULT_ENTRY_TAB, ENTRY_SCOPE, ENTRY_START, entryQuery, type EntryQuery, type EntryTab, type EntryHistory, type EntryDraft, type EntryList, type EntryRecord, type EntryTarget } from "./entry";

export async function requireEntry() {
  const context = await requireSystemView(ENTRY_SCOPE);
  // 12/1 の展開までは全権管理者だけ（試し使い）
  if (japanDate() < ENTRY_START && context.viewer.role !== "super_admin") throw new Error("受付開始前です。");
  return context;
}

export async function readEntryList(tab: EntryTab, query: EntryQuery, counts: boolean) {
  const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_entry_page", {
    p_tab: tab, p_query: normalizeEntrySearch(query), p_counts: counts,
  });
  if (error) throw error;
  return data as EntryList;
}

export async function readEntryListValues(number: string | null): Promise<Partial<EntryDraft> | null> {
  const kanriNo = number && normalizeKanriNo(number);
  if (!kanriNo) return null;
  const { data, error } = await getSupabaseAdmin().from("soil_kanden_list")
    .select("customer_name,customer_kana,customer_no,postal_code,address1,address2,phone1,phone2,mobile,billing_address1,billing_address2,supply_point,capacity,power_capacity,contract_type")
    .eq("kanri_no", kanriNo)
    .order("fm_updated_on", { ascending: false, nullsFirst: false })
    .order("fm_rowid", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    customer_name: data.customer_name,
    customer_kana: data.customer_kana,
    postal_code: data.postal_code,
    address: [data.address1, data.address2].join("") || null,
    phone: data.phone1 ?? data.phone2 ?? data.mobile,
    pay_address: [data.billing_address1, data.billing_address2].join("") || null,
    prev_kana: data.customer_kana,
    prev_name: data.customer_name,
    prev_customer_no: data.customer_no,
    prev_supply_22: data.supply_point,
    denki_customer_no: data.customer_no,
    denki_supply_point: data.supply_point,
    capacity: data.capacity,
    capacity_douryoku: data.power_capacity,
    contract_type: data.contract_type,
  };
}

export async function readEntryCalendar() {
  const { data, error } = await getSupabaseAdmin().from("kanden_calendar").select("*").limit(1000);
  return error ? null : readCalendarDays(data);
}

export async function readEntryPage(query = entryQuery) {
  const [list, calendar] = await Promise.allSettled([
    readEntryList(DEFAULT_ENTRY_TAB, query, true), readEntryCalendar(),
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

const intakeFields = "id,set_id,employee_id,employee_name,employee_number,kanri_no,kanri_no_raw,customer_name,acquisition,urgent_sw,sw_month,has_denki,has_douryoku,has_gas,note,updated_at,customer_fields";
type Intake = Pick<EntryDraft, "kanri_no" | "customer_name" | "acquisition" | "urgent_sw" | "sw_month" |
  "has_denki" | "has_douryoku" | "has_gas" | "note"> & {
  id: string; set_id: string; employee_id: string; employee_name: string; employee_number: string | null; kanri_no_raw: string | null;
  updated_at: string; customer_fields?: CustomerFields | null;
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

export async function entryPhotoScope(kanriNo: string | null, setId: string | undefined, orderId?: string) {
  kanriNo = kanriNo && normalizeKanriNo(kanriNo);
  const db = getSupabaseAdmin();
  const attached = orderId ? await db.from("leaf_kanden_photo_sets").select("id")
    .eq("set_key", `entry/${orderId}`).maybeSingle() : null;
  if (attached?.error) throw attached.error;
  return [
    kanriNo && `kanri_no.eq.${kanriNo}`,
    setId && `set_id.eq.${setId}`,
    attached?.data && `set_id.eq.${attached.data.id}`,
  ].filter(Boolean).join(",");
}

export async function readEntryPhotos(kanriNo: string | null, setId: string | undefined, specsOnly = false, orderId?: string) {
  const scope = await entryPhotoScope(kanriNo, setId, orderId);
  if (!scope) return [];
  const photos: { image_path: string; category: string; id: string; set_id: string }[] = [];
  const db = getSupabaseAdmin();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("leaf_kanden_photos").select("id,set_id,image_path,category").or(scope);
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
    signed.push(...batch.map((photo, index) => ({
      ...photo, category: page[index].category, id: page[index].id, setId: page[index].set_id,
    })));
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
