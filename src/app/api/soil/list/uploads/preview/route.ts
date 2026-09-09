import { NextResponse } from "next/server";

import { requireSoilListUser } from "../../_lib/auth";
import { parseUploadFile, SoilListUploadError } from "../../_lib/upload-parser";

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
    const parsed = await parseUploadFile(file);
    const preview = {
      format: parsed.format,
      formatLabel: parsed.formatLabel,
      rowCount: parsed.rowCount,
      listNames: parsed.listNames,
      warnings: parsed.warnings,
    };
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof SoilListUploadError) {
      return NextResponse.json({ ok: false, error: `取り込めませんでした（${error.message}）` }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "取り込めませんでした（ファイルを読み取れませんでした）" }, { status: 500 });
  }
}
