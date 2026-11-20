"use server";

import { PDFDocument } from "pdf-lib";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendGardenNotice } from "@/lib/relay/monitor.server";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import { formEmployee, recentSubmissions } from "@/lib/leaf-kanden/submissions.server";
import {
  acquisitionLabel, dateInJapan, MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES,
  submissionError, urgentLabel, UUID, validSlot, type FormInput, type PhotoSlot, type Submission,
} from "@/lib/leaf-kanden/submissions";

const uploadError = "写メを送れませんでした。もう一度お試しください。";
const maxPdfBytes = 30 * 1024 * 1024;
const pdfSizeError = "写メの合計容量が大きすぎます。枚数を減らしてください。";
class PdfSizeError extends Error {}

const saveError = "送信できませんでした。写メを確認し、もう一度お試しください。";
const pathFor = (folder: string, slot: PhotoSlot) => `${folder}/${slot.kind}_${slot.index}.jpg`;
const storage = () => getSupabaseAdmin().storage.from(PHOTO_BUCKET);
const uploadFolder = (month: string, id: string) => `form/${month}/${id}`;

export async function preparePhotoUploads(id: string, slots: PhotoSlot[], append: boolean) {
  try {
    const employee = await formEmployee();
    if (typeof id !== "string" || !UUID.test(id) || !validSlots(slots, append)) return { error: uploadError };
    const db = getSupabaseAdmin();
    const month = dateInJapan(new Date()).slice(0, 7).replace("-", "/");
    const { error: insertError } = await db.from("leaf_kanden_form_uploads").upsert(
      { id, employee_id: employee.id, upload_month: month }, { onConflict: "id", ignoreDuplicates: true },
    );
    if (insertError) throw insertError;
    const [draft, existing] = await Promise.all([
      db.from("leaf_kanden_form_uploads").select("upload_month,locked_until").eq("id", id).eq("employee_id", employee.id).single(),
      db.from("leaf_kanden_submissions").select("specs_status,leaf_kanden_photo_sets(photo_count)").eq("id", id).maybeSingle(),
    ]);
    if (draft.error || existing.error || (draft.data.locked_until && Date.parse(draft.data.locked_until) > Date.now())) {
      return { error: uploadError };
    }
    if (append !== Boolean(existing.data) || (append && (
      existing.data?.specs_status !== "諸元待ち" ||
      Number((existing.data.leaf_kanden_photo_sets as unknown as { photo_count: number }).photo_count) + slots.length > MAX_PHOTOS
    ))) return { error: uploadError };

    const folder = uploadFolder(draft.data.upload_month, id);
    const uploads = await Promise.all(slots.map(async slot => {
      const path = pathFor(folder, slot);
      const { data, error } = await storage().createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error("Upload signing failed");
      return { url: data.signedUrl };
    }));
    return { uploads };
  } catch {
    return { error: uploadError };
  }
}

export async function reserveKandenSpecsSlots(id: string) {
  try {
    const employee = await formEmployee();
    if (typeof id !== "string" || !UUID.test(id)) return { error: uploadError };
    const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_reserve_specs_slots", {
      p_id: id, p_employee: employee.id,
    });
    if (error || !data) return { error: "諸元の追加を始められませんでした。画面を読み直してください。" };
    return { first: data as number };
  } catch {
    return { error: uploadError };
  }
}

function validSlots(slots: PhotoSlot[], append: boolean) {
  return Array.isArray(slots) && slots.length > 0 && slots.length <= MAX_PHOTOS &&
    slots.every(slot => validSlot(slot) && (append ? slot.kind === "specs" && slot.index > 10_000 : slot.index <= 10_000)) &&
    new Set(slots.map(slot => `${slot.kind}/${slot.index}`)).size === slots.length;
}

async function buildPdf(paths: string[]) {
  const bucket = storage();
  const signed = await bucket.createSignedUrls(paths, 120);
  if (signed.error || signed.data.length !== paths.length) throw new Error("Image signing failed");
  const deadline = AbortSignal.timeout(30_000);
  const pdf = await PDFDocument.create();
  const sizes: { width: number; height: number; bytes: number }[] = [];
  let totalBytes = 0;

  for (let offset = 0; offset < paths.length; offset += 4) {
    const images = await Promise.all(signed.data.slice(offset, offset + 4).map(async item => {
      if (item.error || !item.signedUrl) throw new Error("Image missing");
      const response = await fetch(item.signedUrl, { cache: "no-store", signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]) });
      if (!response.ok || Number(response.headers.get("content-length")) > MAX_PHOTO_BYTES) throw new Error("Invalid image size");
      const body = await response.blob();
      if (!body.size || body.size > MAX_PHOTO_BYTES) throw new Error("Invalid image size");
      return { image: await pdf.embedJpg(await body.arrayBuffer()), bytes: body.size };
    }));
    for (const { image, bytes } of images) {
      totalBytes += bytes;
      if (totalBytes > maxPdfBytes) throw new PdfSizeError();
      const { width, height } = image;
      if (Math.max(width, height) > 1500 || Math.min(width, height) < 1) throw new Error("Invalid dimensions");
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      sizes.push({ width, height, bytes });
    }
  }
  return { bytes: await pdf.save(), sizes };
}

export async function sendKandenForm(
  id: string, input: FormInput | null, slots: PhotoSlot[], allowMissingSpecs: boolean,
): Promise<{ error: string } | { recent: Submission[] | null }> {
  const append = input === null;
  if (typeof id !== "string" || !UUID.test(id) || !validSlots(slots, append)) return { error: saveError };
  const hasSpecs = slots.some(slot => slot.kind === "specs");
  if (!append) {
    const error = submissionError(input, slots);
    if (error) return { error };
    if (!hasSpecs && allowMissingSpecs !== true) return { error: "諸元を添付するか、諸元待ちで送信してください。" };
  }

  const db = getSupabaseAdmin();
  const now = new Date();
  const lock = new Date(now.getTime() + 5 * 60_000).toISOString();
  let leased = false;

  try {
    const employee = await formEmployee();
    const draft = await db.from("leaf_kanden_form_uploads").update({ locked_until: lock })
      .eq("id", id).eq("employee_id", employee.id)
      .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select("upload_month").maybeSingle();
    if (draft.error || !draft.data) return { error: "送信の準備ができていません。写メを確認してもう一度お試しください。" };
    leased = true;
    const existing = await db.from("leaf_kanden_submissions")
      .select("set_id,kanri_no,specs_status,submitted_at").eq("id", id).eq("employee_id", employee.id).maybeSingle();
    if (existing.error) throw existing.error;
    const recent = () => recentSubmissions(employee.id).catch(() => null);
    if (existing.data && (!append || existing.data.specs_status === "あり")) return { recent: await recent() };
    if (append && !existing.data) return { error: "追加先の送信を確認できませんでした。" };

    const previous = existing.data ? await db.from("leaf_kanden_photos").select("image_path")
      .eq("set_id", existing.data.set_id).order("image_path") : null;
    if (previous?.error) throw previous.error;
    const previousPaths = previous?.data?.map(row => row.image_path) ?? [];
    if (previousPaths.length + slots.length > MAX_PHOTOS) return { error: "写メは1回の送信につき30枚までです。" };
    const folder = uploadFolder(draft.data.upload_month, id);
    const paths = slots.map(slot => pathFor(folder, slot));
    const pdf = await buildPdf([...previousPaths, ...paths]);
    const pdfPath = `pdf/${folder}.pdf`;
    if (pdf.bytes.byteLength > maxPdfBytes) throw new PdfSizeError();
    const bucket = storage();
    const previousPdf = append ? await bucket.download(pdfPath, undefined, { signal: AbortSignal.timeout(10_000) }) : null;
    if (previousPdf?.error) throw previousPdf.error;
    const { data: uploadUrl, error: signError } = await bucket.createSignedUploadUrl(pdfPath, { upsert: true });
    if (signError || !uploadUrl) throw signError ?? new Error("PDF signing failed");
    const uploaded = await fetch(uploadUrl.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
      body: Buffer.from(pdf.bytes),
      signal: AbortSignal.timeout(12_000),
    });
    if (!uploaded.ok) throw new Error("PDF upload failed");

    const kanriNo = input ? normalizeKanriNo(input.kanri_no_raw) : existing.data?.kanri_no;
    const { error } = await db.rpc("leaf_kanden_commit_form", {
      p_submission: {
        id, employee_id: employee.id, employee_name: employee.name, employee_number: employee.number, kanri_no: kanriNo,
        ...(input && {
          acquisition: input.acquisition, kanri_no_raw: input.kanri_no_raw.trim() || null,
          customer_name: input.customer_name.trim(), has_denki: input.has_denki, has_douryoku: input.has_douryoku,
          has_gas: input.has_gas, urgent_sw: input.urgent_sw, sw_month: input.urgent_sw ? input.sw_month : null,
          note: input.note.trim(), specs_status: hasSpecs ? "あり" : "諸元待ち",
        }),
      },
      p_photos: slots.map((slot, index) => ({
        path: paths[index], category: PHOTO_TYPES.find(type => type.key === slot.kind)!.label,
        ...pdf.sizes[previousPaths.length + index],
      })),
      p_pdf: pdfPath, p_date: dateInJapan(existing.data ? new Date(existing.data.submitted_at) : now),
      p_append: append, p_lock: lock,
    });
    if (error) {
      // A retry may follow a lost RPC response. Only restore the previous PDF after
      // confirming that the transaction left the submission waiting for specifications.
      if (previousPdf?.data) {
        const status = await db.from("leaf_kanden_submissions").select("specs_status").eq("id", id).single();
        if (status.data?.specs_status === "諸元待ち") {
          const restored = await fetch(uploadUrl.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
            body: previousPdf.data,
            signal: AbortSignal.timeout(8_000),
          }).catch(() => null);
          if (!restored?.ok) console.error("Kanden PDF restore failed");
        } else if (status.data?.specs_status === "あり") return { recent: await recent() };
      }
      throw error;
    }

    if (input) {
      const body = [
        "関電の申込が届きました", `区分　${input.acquisition}`, `管理番号　${kanriNo ?? "未入力"}`,
        `お客様名　${input.customer_name.trim()}`, `獲得内容　${acquisitionLabel(input)}`,
        `至急SW　${urgentLabel(input)}`, `写メ　${slots.length} 枚${hasSpecs ? "" : "（諸元待ち）"}`,
        `送った人　${employee.name}`,
      ].join("\n").replaceAll("[", "［");
      try {
        if (!await sendGardenNotice(body, AbortSignal.timeout(8_000))) console.error("Kanden form notice unavailable");
      } catch {
        console.error("Kanden form notice failed");
      }
    }
    return { recent: await recent() };
  } catch (error) {
    if (error instanceof PdfSizeError) return { error: pdfSizeError };
    console.error("Kanden form save failed");
    return { error: saveError };
  } finally {
    if (leased) {
      try {
        const { error } = await db.from("leaf_kanden_form_uploads").update({ locked_until: null })
          .eq("id", id).eq("locked_until", lock);
        if (error) console.error("Kanden form lease release failed", error.code);
      } catch {
        console.error("Kanden form lease release failed");
      }
    }
  }
}
