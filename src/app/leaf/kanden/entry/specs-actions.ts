"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, UUID } from "@/lib/leaf-kanden/submissions";
import { requireEntry } from "./queries.server";

const error = "諸元を添付できませんでした。写メを確認してもう一度お試しください。";

export async function prepareEntrySpecs(orderId: string, count: number) {
  try {
    await requireEntry();
    if (typeof orderId !== "string" || !UUID.test(orderId) || !Number.isInteger(count) || count < 1 || count > 10) return { error };
    const db = getSupabaseAdmin();
    const order = await db.from("leaf_kanden_orders").select("id").eq("id", orderId).single();
    if (order.error) return { error };
    const uploads = await Promise.all(Array.from({ length: count }, async () => {
      const path = `entry/${orderId}/${crypto.randomUUID()}.jpg`;
      const { data, error } = await db.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return { path, url: data.signedUrl };
    }));
    return { uploads };
  } catch {
    return { error };
  }
}

export async function commitEntrySpecs(orderId: string, paths: string[]) {
  try {
    const context = await requireEntry();
    if (typeof orderId !== "string" || !UUID.test(orderId) || !Array.isArray(paths) || !paths.length || paths.length > 10 ||
        paths.some(path => typeof path !== "string" || !path.startsWith(`entry/${orderId}/`) ||
          !path.endsWith(".jpg") || !UUID.test(path.slice(orderId.length + 7, -4)))) return { error };
    const result = await getSupabaseAdmin().rpc("leaf_kanden_attach_entry_specs", {
      p_order: orderId, p_paths: [...new Set(paths)], p_actor: context.viewer.employeeId ?? context.userId,
    });
    return result.error ? { error } : {};
  } catch {
    return { error };
  }
}
