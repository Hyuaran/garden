"use server";

import { japanDate } from "@/lib/notices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendGardenNotice } from "@/lib/relay/monitor.server";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import { orderStatus } from "@/lib/leaf-kanden/status";
import { supplyPoint } from "@/lib/leaf-kanden/supply-point";
import type { EntryDetail, EntryDraft, EntryTarget, SaveMode, SupplyKey } from "./entry";
import { booleanFields, dateFields, serviceFields, textFields } from "./entry";
import { readEntryPhotos, readEntryRecord, requireEntry, signEntryPhotos } from "./queries.server";

const readError = "案件を読み込めませんでした。もう一度お試しください。";
const photoError = "写メを読み込めませんでした。もう一度お試しください。";
const saveError = "保存できませんでした。もう一度お試しください。";
type RecordData = Awaited<ReturnType<typeof readEntryRecord>>;

function recordVersion({ order, intake }: RecordData) {
  return order ? order.garden_updated_at ?? order.imported_at : intake?.updated_at ?? null;
}

function buildDraft({ order, intake }: RecordData): EntryDraft {
  const draft = {
    ...Object.fromEntries(textFields.map(field => [field, order ? order[field] : null])),
    ...Object.fromEntries(booleanFields.map(field => [field, order ? order[field] : null])),
    sw_month: order?.sw_month ?? null,
  } as EntryDraft;
  if (!order && intake) {
    const { kanri_no, customer_name, acquisition, urgent_sw, sw_month, has_denki, has_douryoku, has_gas, note } = intake;
    Object.assign(draft, { kanri_no, customer_name, acquisition, urgent_sw, sw_month, has_denki, has_douryoku, has_gas,
      note, sales_name: intake.employee_name });
  }
  return draft;
}

export async function loadEntryDetail(target: EntryTarget): Promise<{ detail: EntryDetail } | { error: string }> {
  try {
    await requireEntry();
    const record = await readEntryRecord(target);
    const draft = buildDraft(record);
    const { order, intake } = record;
    const detail: EntryDetail = {
      draft,
      status: orderStatus({ ...draft, status: order?.status }),
      version: recordVersion(record),
      reason: order?.status === "保留" ? order.hold_reason : order?.return_reason ?? null,
      photos: [],
    };
    try {
      const photos = await readEntryPhotos(draft.kanri_no, intake?.set_id);
      detail.status = orderStatus({ ...draft, status: order?.status }, photos.some(photo => photo.category === "諸元"));
      detail.photos = await signEntryPhotos(photos, draft.kanri_no ?? target.id);
    } catch {
      detail.photoError = photoError;
    }
    return { detail };
  } catch {
    return { error: readError };
  }
}

function validDate(date: string) {
  const timestamp = Date.parse(date);
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) && Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === date;
}

export async function saveEntry(target: EntryTarget, version: string | null, draft: EntryDraft, mode: SaveMode, reason: string) {
  try {
    const context = await requireEntry();
    if (!["save", "entry", "hold", "return", "resume"].includes(mode) ||
        typeof reason !== "string" || !draft || typeof draft !== "object") return { error: saveError };
    const record = await readEntryRecord(target);
    const { order, intake } = record;
    const original = buildDraft(record);
    const changedMessage = "別の人が更新しました。案件を開き直してください。";
    if (version !== recordVersion(record)) return { error: changedMessage };
    reason = reason.trim();
    if ((mode === "hold" || mode === "return") && (!reason || reason.length > 2000)) {
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
    const photos = await readEntryPhotos(kanriNo, intake?.set_id, true);
    const manual = mode === "hold" ? "保留" : mode === "return" ? "差し戻し" : mode === "save" ? order?.status : null;
    const status = orderStatus({ ...next, status: manual }, photos.length > 0);
    if ((mode === "hold" || mode === "return") && status === "キャンセル") return { error: "取消日を確認してください。" };

    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("leaf_kanden_save_entry", {
      p_order: order?.id ?? null,
      p_submission: target.intake ? target.id : null,
      p_version: version,
      p_actor: context.viewer.employeeId ?? context.userId,
      p_patch: {
        ...next, kanri_no: kanriNo,
        ...(!order || next.kanri_no !== original.kanri_no ? { kanri_no_raw: next.kanri_no } : {}),
        status,
        hold_reason: mode === "hold" ? reason : status === "保留" ? order?.hold_reason ?? null : null,
        return_reason: mode === "return" ? reason : status === "差し戻し" ? order?.return_reason ?? null : null,
      },
    });
    if (error?.code === "40001") return { error: changedMessage };
    if (error?.code === "23505") return { error: "同じ管理番号または受付の受注がすでにあります。一覧を読み直してください。" };
    if (error || !data) return { error: saveError };

    let noticeError: string | undefined;
    if (mode === "return") {
      const sent = await notifySender(intake?.employee_id, kanriNo, reason).catch(() => false);
      if (!sent) noticeError = "差し戻しを保存しました。送信者へ通知できなかったため、送信者に直接お知らせください。";
    }
    return { id: data as string, noticeError, status };
  } catch {
    return { error: saveError };
  }
}

async function notifySender(employeeId: string | undefined, kanriNo: string | null, reason: string) {
  if (!employeeId) return false;
  const { data, error } = await getSupabaseAdmin().from("root_employees").select("chatwork_account_id")
    .eq("id", employeeId).maybeSingle();
  const recipient = String(data?.chatwork_account_id ?? "").trim();
  if (error || !/^\d+$/.test(recipient)) return false;
  // Chatwork の装飾や宛先指定として理由が解釈されないようにする。
  const text = reason.replaceAll("[", "［").replaceAll("]", "］");
  return sendGardenNotice(`差し戻し：管理番号 ${kanriNo ?? "未入力"}\n理由：${text}`, AbortSignal.timeout(15000), recipient);
}
