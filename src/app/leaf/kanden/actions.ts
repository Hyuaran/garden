"use server";

import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { signCasePhotos, submissionDetail } from "@/lib/leaf-kanden/submissions.server";
import { performanceMonth } from "@/lib/leaf-kanden/status";
import { paymentColumns, type PaymentSummary } from "./PaymentDetails";
import { UUID } from "@/lib/leaf-kanden/submissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  CASE_DETAIL_ERROR, CASE_PHOTO_ERROR, DETAIL_CUSTOMER_FIELDS, DETAIL_ORDER_FIELDS,
  type CaseDetail, type CasePhoto,
} from "./cases";

export async function loadCaseDetail(id: string): Promise<
  { error: string } | { detail: CaseDetail; photos: CasePhoto[]; photoError?: string; payments?: PaymentSummary[]; paidOn?: string | null; refundedOn?: string | null }
> {
  try {
    const { viewer } = await viewPermissionContext();
    if (!await canView("leaf-kanden", "", viewer)) return { error: "閲覧権限がありません。" };
    if (typeof id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      return { error: CASE_DETAIL_ERROR };
    }

    const db = getSupabaseAdmin();
    const columns = [
      ...DETAIL_ORDER_FIELDS.map(([field]) => field), ...DETAIL_CUSTOMER_FIELDS.map(([field]) => field),
      "postal_code", "note", "kanri_no", "paid_on", "refunded_on", `leaf_kanden_payments(${paymentColumns})`,
    ].join(",");
    const { data, error } = await db.from("leaf_kanden_orders").select(columns).eq("id", id).maybeSingle();
    if (error || !data) return { error: CASE_DETAIL_ERROR };
    const { kanri_no: kanriNo, paid_on: paidOn, refunded_on: refundedOn, leaf_kanden_payments: payments, ...detail } =
      data as unknown as CaseDetail & { kanri_no: string | null; paid_on: string | null; refunded_on: string | null;
        leaf_kanden_payments: PaymentSummary[] };
    detail.jisseki_month = performanceMonth({
      jisseki_month: detail.jisseki_month as string | null, ordered_on: detail.ordered_on as string | null,
    });
    const result = { detail, payments, paidOn, refundedOn };
    if (!kanriNo) return { ...result, photos: [] };

    try {
      return { ...result, photos: await readPhotos(db, kanriNo) };
    } catch {
      return { ...result, photos: [], photoError: CASE_PHOTO_ERROR };
    }
  } catch {
    return { error: CASE_DETAIL_ERROR };
  }
}

async function readPhotos(db: ReturnType<typeof getSupabaseAdmin>, kanriNo: string) {
  const photos: CasePhoto[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("leaf_kanden_photos").select("image_path")
      .eq("kanri_no", kanriNo).order("event_date", { nullsFirst: false }).order("image_path").order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const paths = data.map(photo => photo.image_path).filter(path => !/\.pdf$/i.test(path));
    photos.push(...await signCasePhotos(paths, kanriNo, photos.length));
    if (data.length < pageSize) return photos;
  }
}


export async function loadSubmissionDetail(id: string) {
  try {
    const { viewer } = await viewPermissionContext();
    if (!await canView("leaf-kanden", "", viewer)) return { error: "閲覧権限がありません。" };
    if (typeof id !== "string" || !UUID.test(id)) return { error: CASE_DETAIL_ERROR };

    const row = await submissionDetail(id);
    const db = getSupabaseAdmin();
    const images = await db.from("leaf_kanden_photos").select("image_path")
      .eq("set_id", row.set_id).order("image_path");
    const order = row.kanri_no ? await db.from("leaf_kanden_orders").select("id")
      .eq("kanri_no", row.kanri_no).order("ordered_on", { ascending: false, nullsFirst: false })
      .order("id").limit(1).maybeSingle() : null;
    if (order?.error) throw order.error;

    try {
      if (images.error) throw images.error;
      const photos = await signCasePhotos(images.data.map(photo => photo.image_path), row.kanri_no ?? row.id);
      return { row, photos, orderId: order?.data?.id };
    } catch {
      return { row, photos: [], orderId: order?.data?.id, photoError: CASE_PHOTO_ERROR };
    }
  } catch {
    return { error: CASE_DETAIL_ERROR };
  }
}
