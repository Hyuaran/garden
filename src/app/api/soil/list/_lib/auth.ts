import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SoilListUser = {
  id: string;
  name: string | null;
  role: GardenRole;
};

export function canUseSoilList(role: GardenRole | null | undefined): role is GardenRole {
  return !!role && isRoleAtLeast(role, "manager");
}

export async function requireSoilListUser(): Promise<
  | { ok: true; user: SoilListUser }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 401 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: employee, error } = await admin
    .from("root_employees")
    .select("name,garden_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "権限を確認できませんでした" }, { status: 500 }),
    };
  }

  const row = employee as { name?: string | null; garden_role?: GardenRole | null } | null;
  const role = row?.garden_role;
  if (!canUseSoilList(role)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: { id: userId, name: row?.name ?? null, role },
  };
}
