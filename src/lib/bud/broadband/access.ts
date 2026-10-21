import { createServerClient } from "@/app/_lib/supabase/server";
export async function broadbandAccess() {
  const db = await createServerClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return { ok: false as const, status: 401 };
  const access = await db.rpc("bud_has_access");
  const admin = await db.rpc("bud_is_admin_or_super_admin");
  if (access.error || !access.data || admin.error || !admin.data) return { ok: false as const, status: 403 };
  return { ok: true as const, db, userId: data.user.id };
}
