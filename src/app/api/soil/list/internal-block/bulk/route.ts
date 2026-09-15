import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../_lib/auth";
import { activeInternalBlockPhones, INTERNAL_BLOCK_TABLE, setPhoneInternalBlockMany } from "../../_lib/internal-block-db";
import {
  InternalBlockFileError,
  parseInternalBlockFile,
  summarizeInternalBlockRows,
  uniqueValidInternalBlockRows,
} from "../../_lib/internal-block-parser";

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
    const preview = summarizeInternalBlockRows(rows, alreadyBlocked);
    const validRows = uniqueValidInternalBlockRows(rows, alreadyBlocked);
    const admin = getSupabaseAdmin();

    for (let index = 0; index < validRows.length; index += 1000) {
      const chunk = validRows.slice(index, index + 1000);
      const { error } = await admin.from(INTERNAL_BLOCK_TABLE).insert(
        chunk.map((row) => ({
          電話番号: row.phoneNumber,
          理由: row.reason,
          登録者: auth.user.name ?? "",
          出所: `ファイル:${file.name}`,
        })),
      );
      if (error) throw new Error("自社アポ禁を登録できませんでした");
      await setPhoneInternalBlockMany(chunk.map((row) => row.phoneNumber), true);
    }

    return NextResponse.json({ ok: true, result: { ...preview, inserted: validRows.length } });
  } catch (error) {
    if (error instanceof InternalBlockFileError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "自社アポ禁を登録できませんでした" }, { status: 500 });
  }
}
