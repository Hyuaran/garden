import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InboxActionBody =
  | { action: "discard"; id: string }
  | { action: "consume"; id: string; transferId: string };

const SELECT_COLUMNS =
  "id,drive_file_id,file_name,mime_type,storage_path,public_url,status,transfer_id,imported_at,consumed_at,discarded_at,created_at,updated_at";

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  let query = supabase
    .from("bud_transfer_inbox")
    .select(SELECT_COLUMNS)
    .eq("status", "pending")
    .order("imported_at", { ascending: false });

  if (id) {
    query = query.eq("id", id).limit(1);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (id) {
    return NextResponse.json({ ok: true, item: data?.[0] ?? null });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<InboxActionBody>;
  if (!body.id || (body.action !== "discard" && body.action !== "consume")) {
    return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates =
    body.action === "discard"
      ? { status: "discarded", discarded_at: now }
      : {
          status: "consumed",
          consumed_at: now,
          transfer_id: "transferId" in body ? body.transferId : null,
        };

  if (body.action === "consume" && !updates.transfer_id) {
    return NextResponse.json({ ok: false, error: "transferId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bud_transfer_inbox")
    .update(updates)
    .eq("id", body.id)
    .eq("status", "pending")
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}
