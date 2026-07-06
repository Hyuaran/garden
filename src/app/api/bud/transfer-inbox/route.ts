import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { importTransferInboxFromDrive } from "@/app/api/bud/transfer-inbox/_lib/import-from-drive";
import { importTransferInboxFromMail } from "@/app/api/bud/transfer-inbox/_lib/import-from-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InboxActionBody =
  | { action: "discard"; id: string }
  | { action: "consume"; id: string; transferId: string };

type InboxPostBody = { action: "import-now" };

const SELECT_COLUMNS =
  "id,drive_file_id,file_name,mime_type,storage_path,public_url,status,transfer_id,imported_at,consumed_at,discarded_at,created_at,updated_at,source,mail_meta";
const FALLBACK_SELECT_COLUMNS =
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

  const primary = await query;
  let rows: unknown[] | null = primary.data;
  let error = primary.error;
  if (error) {
    let fallbackQuery = supabase
      .from("bud_transfer_inbox")
      .select(FALLBACK_SELECT_COLUMNS)
      .eq("status", "pending")
      .order("imported_at", { ascending: false });

    if (id) {
      fallbackQuery = fallbackQuery.eq("id", id).limit(1);
    }
    const fallback = await fallbackQuery;
    rows = fallback.data;
    error = fallback.error;
  }
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (id) {
    return NextResponse.json({ ok: true, item: rows?.[0] ?? null });
  }
  return NextResponse.json({ ok: true, items: rows ?? [] });
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
    .select(FALLBACK_SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<InboxPostBody>;
  if (body.action !== "import-now") {
    return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
  }

  const folderId = process.env.BUD_TRANSFER_INBOX_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { ok: false, error: "BUD_TRANSFER_INBOX_DRIVE_FOLDER_ID is not configured" },
      { status: 500 },
    );
  }

  try {
    const drive = await importTransferInboxFromDrive(folderId);
    const mail = await importTransferInboxFromMail();
    return NextResponse.json({ ok: true, drive, mail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
