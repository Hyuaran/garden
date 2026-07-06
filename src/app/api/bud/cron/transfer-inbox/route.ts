import { NextResponse } from "next/server";

import { importTransferInboxFromDrive } from "@/app/api/bud/transfer-inbox/_lib/import-from-drive";
import { importTransferInboxFromMail } from "@/app/api/bud/transfer-inbox/_lib/import-from-mail";
import { verifyCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.status },
    );
  }

  const folderId = process.env.BUD_TRANSFER_INBOX_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json(
      { ok: false, error: "BUD_TRANSFER_INBOX_DRIVE_FOLDER_ID is not configured" },
      { status: 500 },
    );
  }

  const drive = await importTransferInboxFromDrive(folderId);
  let mail;
  try {
    mail = await importTransferInboxFromMail();
  } catch (error) {
    mail = {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return NextResponse.json({ ok: true, drive, mail });
}
