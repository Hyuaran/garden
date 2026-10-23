import "server-only";
import { createServerClient } from "@/app/_lib/supabase/server";
import { canViewSprout } from "./model";
export async function sproutUser() {
  const db = await createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.from("root_employees").select("garden_role").eq("user_id", user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  return !error && canViewSprout(data?.garden_role) ? user : null;
}
export async function requireSproutUser() {
  const user = await sproutUser();
  if (!user) throw new Error("閲覧権限がありません");
  return user;
}
