import { NextResponse } from "next/server";

import { requireSoilListUser } from "../../_lib/auth";
import { activeInternalBlockPhones } from "../../_lib/internal-block-db";
import { InternalBlockFileError, parseInternalBlockFile, summarizeInternalBlockRows } from "../../_lib/internal-block-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value);
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) {
      return NextResponse.json({ ok: false, error: "取り込めませんでした（ファイルを選んでください）" }, { status: 400 });
    }
    const rows = await parseInternalBlockFile(file);
    const phones = [...new Set(rows.map((row) => row.phoneNumber).filter((phone) => phone.length >= 9))];
    const alreadyBlocked = await activeInternalBlockPhones(phones);
    return NextResponse.json({ ok: true, preview: summarizeInternalBlockRows(rows, alreadyBlocked) });
  } catch (error) {
    if (error instanceof InternalBlockFileError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "取り込めませんでした（ファイルを読み取れませんでした）" }, { status: 500 });
  }
}
