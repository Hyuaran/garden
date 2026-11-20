"use server";

import { compare, hash } from "bcryptjs";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { employeeRecord } from "@/lib/leaf-kanden/submissions.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireEntry } from "./entry/queries.server";

const settings = "leaf_kanden_settings";
const attempts = "leaf_kanden_download_attempts";
const locked = "パスワードを5回間違えました。10分後にもう一度お試しください。";
const passwordLength = (password: string) => typeof password === "string" && Buffer.byteLength(password, "utf8") <= 72;

export async function verifyKandenPhotoPassword(password: string, entry = false) {
  try {
    const employee = await employeeRecord(await (entry === true ? requireEntry() : requireSystemView("leaf-kanden")));
    const db = getSupabaseAdmin();
    const { data, error } = await db.from(settings).select("image_download_password_hash").eq("singleton", true).single();
    if (error) throw error;
    const digest = data.image_download_password_hash;
    if (!digest) return { error: "パスワードが設定されていません。全権管理者に設定を頼んでください。" };

    const attempt = await db.rpc("leaf_kanden_reserve_download_attempt", { p_employee: employee.id });
    if (attempt.error) throw attempt.error;
    if (!attempt.data) return { error: locked };
    if (passwordLength(password) && await compare(password, digest)) {
      await db.from(attempts).delete().eq("employee_id", employee.id).eq("last_attempt", attempt.data);
      return { ok: true };
    }
    const { data: recent } = await db.from(attempts).select("failures").eq("employee_id", employee.id).maybeSingle();
    return { error: recent?.failures >= 5 ? locked : "パスワードが違います。" };
  } catch {
    return { error: "パスワードを確認できませんでした。もう一度お試しください。" };
  }
}

export async function setKandenPhotoPassword(password: string) {
  try {
    const context = await requireSystemView("leaf-kanden");
    if (context.viewer.role !== "super_admin") return { error: "全権管理者のみ設定できます。" };
    if (!passwordLength(password) || !password.trim()) return { error: "パスワードは半角72文字（全角24文字）以内で入力してください。" };
    const employee = await employeeRecord(context);
    const { error } = await getSupabaseAdmin().from(settings).update({
      image_download_password_hash: await hash(password, 12), updated_at: new Date().toISOString(), updated_by: employee.id,
    }).eq("singleton", true).select("singleton").single();
    if (error) throw error;
    return { ok: true };
  } catch {
    return { error: "パスワードを設定できませんでした。もう一度お試しください。" };
  }
}
