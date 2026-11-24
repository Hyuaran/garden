"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { UUID } from "@/lib/leaf-kanden/submissions";
import { PHOTO_CATEGORIES, type EntryTarget, type PhotoCategory } from "./entry";
import { entryPhotoScope, readEntryRecord, requireEntry } from "./queries.server";

const error = "写メの種類を保存できませんでした。もう一度お試しください。";

export async function saveEntryPhotoCategory(target: EntryTarget, id: string, setId: string, category: PhotoCategory) {
  try {
    await requireEntry();
    if (typeof id !== "string" || !UUID.test(id) || typeof setId !== "string" || !UUID.test(setId) ||
        !PHOTO_CATEGORIES.includes(category)) return { error };
    const { order, intake } = await readEntryRecord(target);
    const scope = await entryPhotoScope(order ? order.kanri_no : intake?.kanri_no ?? null, intake?.set_id, order?.id);
    if (!scope) return { error };
    const result = await getSupabaseAdmin().from("leaf_kanden_photos").update({ category })
      .eq("id", id).eq("set_id", setId).not("image_path", "ilike", "%.pdf").or(scope).select("id").maybeSingle();
    return result.error || !result.data ? { error } : {};
  } catch {
    return { error };
  }
}
