"use server";

import { japanDate } from "@/lib/notices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendGardenNotice } from "@/lib/relay/monitor.server";
import { UUID } from "@/lib/leaf-kanden/submissions";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import { LEGACY_CANCEL_REASON, orderStatus } from "@/lib/leaf-kanden/status";
import { supplyPoint } from "@/lib/leaf-kanden/supply-point";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import type { EntryTab, EntryQuery, EntryDetail, EntryDraft, EntryTarget, SaveMode, SupplyKey } from "./entry";
import { ENTRY_TABS, applicationFields, booleanFields, dateFields, orderTextFields, serviceFields, textFields } from "./entry";
import { readEntryCalendar, readEntryHistory, readEntryList, readEntryListValues, readEntryPhotos, readEntryRecord, requireEntry, signEntryPhotos } from "./queries.server";
import { matchSalesEmployee, normalizeSalesName } from "./sales";

const readError = "案件を読み込めませんでした。もう一度お試しください。";
const photoError = "写メを読み込めませんでした。もう一度お試しください。";
const saveError = "保存できませんでした。もう一度お試しください。";
const searchFields = new Set<string>([...textFields, ...booleanFields, "paid_on", "status", "reason", "sw_month", "completed_on"]);
const advanceDate = {
  "諸元待ち": "specs_on", "エントリー待ち": "entered_on",
  "申込書待ち": "application_received_on", "郵送待ち": "mailed_on",
} as const;

function validRequests(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(request =>
    request && typeof request === "object" && !Array.isArray(request) &&
    Object.keys(request).length > 0 && Object.entries(request).every(([key, term]) =>
      searchFields.has(key) && typeof term === "string" && term.trim() && term.length <= 300));
}
type RecordData = Awaited<ReturnType<typeof readEntryRecord>>;

function recordVersion({ order, intake }: RecordData) {
  if (!order) return intake?.updated_at ?? null;
  const saved = order.garden_updated_at ?? order.imported_at;
  const flow = order.flow_updated_at;
  if (!saved || !flow) return saved ?? flow;
  // PostgREST returns timestamps in the same time zone. Keep the database's microsecond precision.
  return saved.split("+")[0] > flow.split("+")[0] ? saved : flow;
}

const applicationDefaults = { prev_provider: "関西電力", invoice: "紙請求書", paper: "希望しない" } as const;

function buildDraft({ order, intake }: RecordData): EntryDraft {
  const draft = {
    ...Object.fromEntries(orderTextFields.map(field => [field, order?.[field] ?? null])),
    ...Object.fromEntries(applicationFields.map(field => {
      const saved = order?.application_fields?.[field];
      return [field, saved === undefined ? applicationDefaults[field as keyof typeof applicationDefaults] ?? null : saved];
    })),
    ...Object.fromEntries(booleanFields.map(field => [field, order?.[field] ?? null])),
    sw_month: order?.sw_month ?? null,
  } as EntryDraft;
  if (!order && intake) {
    const { kanri_no, customer_name, acquisition, urgent_sw, sw_month, has_denki, has_douryoku, has_gas, note } = intake;
    Object.assign(draft, { kanri_no, customer_name, acquisition, urgent_sw, sw_month, has_denki, has_douryoku, has_gas,
      note, sales_name: intake.employee_name });
  }
  const customer = intake?.customer_fields;
  if (customer && !order?.garden_updated_at) {
    draft.customer_kana ??= customer.kana || null;
    draft.address ??= customer.address || null;
    draft.phone ??= customer.phone || null;
    draft.contract_type ??= customer.contract || null;
    draft.prev_customer_no ??= customer.number || null;
    draft.prev_supply_22 ??= customer.supply || null;
    if (draft.has_denki) {
      draft.denki_customer_no ??= customer.number || null;
      draft.denki_supply_point ??= customer.supply || null;
    }
  }
  return draft;
}

export async function loadEntryList(tab: EntryTab, query: EntryQuery, counts = false, refreshCalendar = false, selection?: string): Promise<
  { list: Awaited<ReturnType<typeof readEntryList>>; calendar?: Awaited<ReturnType<typeof readEntryCalendar>>;
    detailId?: string; selectedDetail?: Awaited<ReturnType<typeof loadEntryDetail>>; error?: never }
  | { error: string; list?: never }
> {
  try {
    await requireEntry();
    if (selection !== undefined && selection !== "first" && selection !== "last" &&
        (typeof selection !== "string" || !UUID.test(selection))) return { error: readError };
    if (!ENTRY_TABS.includes(tab) || !Number.isSafeInteger(query?.page) || query.page < 1 || query.page > 1_000_000 ||
        (query.requests !== undefined && !validRequests(query.requests)) ||
        (query.refinements !== undefined && (!query.requests || !Array.isArray(query.refinements) ||
          query.refinements.length > 10 || query.refinements.some(filter => !filter ||
            !["constrain", "extend"].includes(filter.mode) || !validRequests(filter.requests))))) return { error: readError };
    const [list, calendar] = await Promise.all([
      readEntryList(tab, query, counts === true),
      refreshCalendar === true ? readEntryCalendar().catch(() => null) : undefined,
    ]);
    const detailId = selection === "first" ? list.rows[0]?.[0]
      : selection === "last" ? list.rows.at(-1)?.[0] : selection;
    const selectedDetail = detailId ? await readDetail({ id: detailId, intake: false }) : undefined;
    return { list, calendar, detailId, selectedDetail };
  } catch {
    return { error: readError };
  }
}

export async function loadEntryDetail(target: EntryTarget): Promise<{ detail: EntryDetail } | { error: string }> {
  try {
    await requireEntry();
    return await readDetail(target);
  } catch {
    return { error: readError };
  }
}

async function readDetail(target: EntryTarget): ReturnType<typeof loadEntryDetail> {
  try {
    const record = await readEntryRecord(target);
    const draft = buildDraft(record);
    const { order, intake } = record;
    const middles = serviceFields.flatMap(([service]) => {
      const value = draft[(service + "_supply_point") as SupplyKey];
      return (value && supplyPoint(value).middle) || [];
    });
    const [history, duplicates, listValues] = await Promise.all([
      order ? readEntryHistory(order.id) : [],
      middles.length ? findEntryDuplicates(target.id, middles) : {},
      readEntryListValues(draft.kanri_no),
    ]);
    const { related, sales } = await readEntryContext(order, intake, duplicates);
    const detail: EntryDetail = {
      listValues,
      flow: { timetree_label: order?.timetree_label, cancel_reason: order?.cancel_reason },
      related,
      sales,
      rawNumber: order?.kanri_no_raw ?? intake?.kanri_no_raw,
      history,
      duplicates,
      draft,
      status: orderStatus({ ...order, ...draft }),
      version: recordVersion(record),
      reason: order?.status === "保留" ? order.hold_reason : order?.status === "差し戻し" ? order.return_reason : order?.cancel_reason ?? null,
      photos: [],
      payments: order?.leaf_kanden_payments ?? [],
      paidOn: order?.paid_on ?? null,
      refundedOn: order?.refunded_on ?? null,
    };
    try {
      const photos = await readEntryPhotos(draft.kanri_no, intake?.set_id, false, order?.id);
      detail.hasSpecs = photos.some(photo => photo.category === "諸元");
      detail.status = orderStatus({ ...order, ...draft }, detail.hasSpecs);
      detail.photos = await signEntryPhotos(photos, draft.kanri_no ?? target.id);
    } catch {
      detail.photoError = photoError;
    }
    return { detail };
  } catch {
    return { error: readError };
  }
}

async function readEntryContext(order: RecordData["order"], intake: RecordData["intake"], duplicates: EntryDetail["duplicates"]) {
  const numbers = [...new Set(Object.values(duplicates).flat())].slice(0, 50);
  const salesName = order?.sales_name ?? intake?.employee_name ?? null;
  const [employee, related] = await Promise.all([
    readSalesEmployee(salesName ? undefined : intake?.employee_id, salesName),
    order && numbers.length ? getSupabaseAdmin().from("leaf_kanden_orders").select("id,kanri_no,customer_name")
      .in("kanri_no", numbers).neq("id", order.id).order("id").limit(50) : null,
  ]);
  const applyCodes = await readSalesApplyCodes(employee?.employee_id, salesName, employee?.name);
  return {
    sales: { name: employee?.name, number: employee?.employee_number ?? null, department: employee?.current_team ?? null, applyCodes },
    related: related?.data?.map(row => ({ id: row.id, number: row.kanri_no, name: row.customer_name })),
  };
}

async function readSalesEmployee(employeeId?: string, salesName?: string | null) {
  if (!employeeId && !salesName) return null;
  const employees = () => getSupabaseAdmin().from("root_employees_with_team")
    .select("employee_id,name,filemaker_employee_name,employee_number,current_team,chatwork_account_id,termination_date")
    .eq("is_active", true).is("deleted_at", null);
  if (employeeId) {
    const result = await employees().eq("employee_id", employeeId).maybeSingle();
    return result.error || !isEmployeeActive(result.data) ? null : result.data;
  }
  const today = japanDate();
  const db = getSupabaseAdmin();
  const candidates = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("root_employees").select("employee_id,name,filemaker_employee_name")
      .eq("is_active", true).is("deleted_at", null)
      .or(`termination_date.is.null,termination_date.gt.${today}`)
      .order("employee_id").range(offset, offset + 499);
    if (error) return null;
    candidates.push(...data);
    if (data.length < 500) break;
  }
  const employee = matchSalesEmployee(salesName ?? "", candidates);
  if (!employee) return null;
  const result = await employees().eq("employee_id", employee.employee_id).maybeSingle();
  return result.error || !isEmployeeActive(result.data, today) ? null : result.data;
}

async function readSalesApplyCodes(employeeId?: string, ...names: (string | null | undefined)[]) {
  const codes = () => getSupabaseAdmin().from("leaf_kanden_sales_apply_codes")
    .select("id,apply_code,starts_on,ends_on,employee_id");
  const namesToMatch = [...new Set(names.map(normalizeSalesName).filter(Boolean))];
  const [byId, byName] = await Promise.all([
    employeeId ? codes().eq("employee_id", employeeId) : null,
    namesToMatch.length ? codes().in("sales_name_key", namesToMatch) : null,
  ]);
  const rules = [...(byId?.data ?? []), ...(byName?.data ?? [])];
  return rules.sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? "") ||
    Number(!!b.employee_id) - Number(!!a.employee_id) || a.id.localeCompare(b.id))
    .map(({ apply_code, starts_on, ends_on }) => ({ apply_code, starts_on, ends_on }));
}

async function findEntryDuplicates(id: string, middles: string[]) {
  const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_supply_duplicates", {
    p_id: id, p_middles: middles,
  });
  if (error) throw error;
  return data as EntryDetail["duplicates"];
}

export async function checkEntryDuplicates(id: string, middles: string[]) {
  await requireEntry();
  if (typeof id !== "string" || !UUID.test(id) || !Array.isArray(middles) || middles.length > 3 || middles.some(value => typeof value !== "string" || !/^\d{14}$/.test(value))) return {};
  return findEntryDuplicates(id, middles);
}

function validDate(date: string) {
  const timestamp = Date.parse(date);
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) && Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === date;
}

export async function saveEntry(target: EntryTarget, version: string | null, draft: EntryDraft, mode: SaveMode, reason: string, notify = true) {
  try {
    const context = await requireEntry();
    if (!["save", "advance", "entry", "return", "resume", "complete"].includes(mode) ||
        typeof reason !== "string" || !draft || typeof draft !== "object") return { error: saveError };
    const record = await readEntryRecord(target);
    const { order, intake } = record;
    const original = buildDraft(record);
    const changedMessage = "別の人が更新しました。案件を開き直してください。";
    if (version !== recordVersion(record)) return { error: changedMessage };
    reason = reason.trim();
    if (mode === "return" && (!reason || reason.length > 2000)) {
      return { error: "理由を2,000文字以内で入力してください。" };
    }

    const next = { ...original };
    for (const field of textFields) {
      const value = draft[field];
      if (value !== null && (typeof value !== "string" || value.length > 10000)) return { error: saveError };
      if (value !== original[field]) next[field] = value?.trim() || null;
    }
    for (const field of booleanFields) {
      if (draft[field] !== null && typeof draft[field] !== "boolean") return { error: saveError };
      next[field] = draft[field];
    }
    next.sw_month = next.urgent_sw ? draft.sw_month : null;
    if (next.urgent_sw && (!Number.isInteger(next.sw_month) || next.sw_month! < 1 || next.sw_month! > 12)) {
      return { error: "至急SWの希望月を選んでください。" };
    }
    if (next.kanri_no && !normalizeKanriNo(next.kanri_no)) return { error: "管理番号を確認してください。" };
    for (const [field, label] of dateFields) {
      if (next[field] && !validDate(next[field])) return { error: `${label}を確認してください。` };
    }
    if (next.apply_date && !validDate(next.apply_date)) return { error: "申込日を確認してください。" };
    if (next.prev_supply_22 && next.prev_supply_22 !== original.prev_supply_22 && supplyPoint(next.prev_supply_22).error) {
      return { error: "現在の契約の供給地点特定番号を22桁で入力してください。" };
    }
    if (next.jisseki_month && !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(next.jisseki_month)) {
      return { error: "実績月を確認してください。" };
    }
    for (const [service, label] of serviceFields) {
      const key: SupplyKey = `${service}_supply_point`;
      const value = next[key];
      if (service !== "gas" && value && value !== original[key] && supplyPoint(value).error) {
        return { error: `${label}の供給地点特定番号を22桁で入力してください。` };
      }
    }
    if (mode === "entry") {
      if (next.cancelled_on) return { error: "取消日を確認してください。" };
      next.entered_on ||= japanDate();
    }

    const kanriNo = next.kanri_no ? normalizeKanriNo(next.kanri_no) : null;
    const photos = await readEntryPhotos(kanriNo, intake?.set_id, true, order?.id);
    const legacyCancel = !next.mailed_on && order?.status === "キャンセル" && order.cancel_reason === LEGACY_CANCEL_REASON;
    const manual = mode === "return" ? "差し戻し"
      : legacyCancel ? "キャンセル" : (mode === "save" || mode === "advance") && (order?.status === "保留" || order?.status === "差し戻し")
        ? order.status : null;
    const cancelReason = next.cancelled_on ? "取消日あり" : order?.refunded_on ? "戻入あり"
      : order?.cancel_reason === "取消日あり" || (next.mailed_on && order?.cancel_reason === LEGACY_CANCEL_REASON) ? null : order?.cancel_reason ?? null;
    if (mode === "advance") {
      const previous = orderStatus({ ...order, ...original }, photos.length > 0);
      const field = advanceDate[previous as keyof typeof advanceDate];
      if (field) next[field] ||= japanDate();
    }
    const status = orderStatus({ ...order, ...next, cancel_reason: cancelReason, status: manual }, photos.length > 0);

    if (mode === "complete" && status !== "完了") return { error: "入金明細で入金が確認されてから完了処理を行ってください。" };
    const appChanged = applicationFields.some(key => next[key] !== original[key]);
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("leaf_kanden_save_entry", {
      p_order: order?.id ?? null,
      p_submission: target.intake ? target.id : null,
      p_version: version,
      p_actor: context.viewer.employeeId ?? context.userId,
      p_patch: {
        ...Object.fromEntries([...orderTextFields, ...booleanFields, "sw_month" as const].map(key => [key, next[key]])),
        ...(appChanged ? { application_fields: Object.fromEntries(applicationFields.map(key => [key, next[key]])) } : {}),
        kanri_no: kanriNo,
        ...(mode === "complete" ? { completed_on: order?.completed_on ?? japanDate() } : {}),
        ...(!order || next.kanri_no !== original.kanri_no ? { kanri_no_raw: next.kanri_no } : {}),
        status: manual,
        cancel_reason: cancelReason,
        hold_reason: status === "保留" ? order?.hold_reason ?? null : null,
        return_reason: mode === "return" ? reason : status === "差し戻し" ? order?.return_reason ?? null : null,
      },
    });
    if (error?.code === "40001") return { error: changedMessage };
    if (error?.code === "23505") return { error: "同じ管理番号または受付の受注がすでにあります。一覧を読み直してください。" };
    if (error || !data) return { error: saveError };

    let noticeError: string | undefined;
    if (mode === "return" && notify === true) {
      const sent = await notifySender(intake?.employee_id, next.sales_name, kanriNo, reason).catch(() => false);
      if (!sent) noticeError = "差し戻しを保存しました。送信者へ通知できなかったため、送信者に直接お知らせください。";
    }
    return { id: data as string, noticeError, status };
  } catch {
    return { error: saveError };
  }
}

async function notifySender(employeeId: string | undefined, salesName: string | null, kanriNo: string | null, reason: string) {
  const employee = await readSalesEmployee(employeeId, salesName);
  const recipient = String(employee?.chatwork_account_id ?? "").trim();
  if (!/^\d+$/.test(recipient)) return false;
  // Chatwork の装飾や宛先指定として理由が解釈されないようにする。
  const text = reason.replaceAll("[", "［").replaceAll("]", "］");
  return sendGardenNotice(`差し戻し：管理番号 ${kanriNo ?? "未入力"}\n理由：${text}`, AbortSignal.timeout(15000), recipient);
}
