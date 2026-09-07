import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type AuthenticatedSoilListUser = {
  id: string;
  role: GardenRole;
};

type SyncStateRow = {
  synced_through: string | null;
  last_run_at: string | null;
  last_phones: number | null;
  last_rows: number | null;
};

type RefreshResultRow = {
  phones: number | null;
  call_rows: number | null;
  synced_through: string | null;
};

type RpcDb = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          is(column: string, value: unknown): {
            maybeSingle<T>(): Promise<{ data: T | null; error: { message: string } | null }>;
          };
        };
        maybeSingle<T>(): Promise<{ data: T | null; error: { message: string } | null }>;
      };
    };
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{
    data: RefreshResultRow[] | RefreshResultRow | null;
    error: { message: string } | null;
  }>;
};

function statePayload(row: SyncStateRow | null) {
  return {
    syncedThrough: row?.synced_through ?? null,
    lastRunAt: row?.last_run_at ?? null,
    phones: row?.last_phones ?? 0,
    callRows: row?.last_rows ?? 0,
  };
}

async function requireRoleAtLeast(minRole: GardenRole): Promise<
  | { ok: true; user: AuthenticatedSoilListUser }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 401 }) };
  }

  const admin = getSupabaseAdmin();
  const { data: employee, error } = await admin
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "権限を確認できませんでした" }, { status: 500 }) };
  }

  const role = (employee as { garden_role?: GardenRole | null } | null)?.garden_role;
  if (!role || !isRoleAtLeast(role, minRole)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 }) };
  }

  return { ok: true, user: { id: userId, role } };
}

async function loadState(db: RpcDb) {
  const { data, error } = await db
    .from("soil_list_call_sync_state")
    .select("synced_through,last_run_at,last_phones,last_rows")
    .eq("id", 1)
    .maybeSingle<SyncStateRow>();
  if (error) throw new Error(error.message);
  return statePayload(data);
}

function refreshPayload(data: RefreshResultRow[] | RefreshResultRow | null) {
  const row = Array.isArray(data) ? data[0] : data;
  return {
    phones: row?.phones ?? 0,
    callRows: row?.call_rows ?? 0,
    syncedThrough: row?.synced_through ?? null,
  };
}

export async function GET() {
  const auth = await requireRoleAtLeast("staff");
  if (!auth.ok) return auth.response;

  try {
    const db = getSupabaseAdmin() as unknown as RpcDb;
    return NextResponse.json({ ok: true, state: await loadState(db), canSync: isRoleAtLeast(auth.user.role, "manager") });
  } catch {
    return NextResponse.json({ ok: false, error: "反映状態を取得できませんでした" }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireRoleAtLeast("manager");
  if (!auth.ok) return auth.response;

  try {
    const db = getSupabaseAdmin() as unknown as RpcDb;
    const { data, error } = await db.rpc("soil_list_refresh_call_summary");
    if (error) return NextResponse.json({ ok: false, error: "コール履歴を反映できませんでした" }, { status: 500 });
    const result = refreshPayload(data);
    return NextResponse.json({ ok: true, result, state: await loadState(db) });
  } catch {
    return NextResponse.json({ ok: false, error: "コール履歴を反映できませんでした" }, { status: 500 });
  }
}
