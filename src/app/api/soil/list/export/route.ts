import { NextResponse } from "next/server";

import {
  SOIL_LIST_COLUMNS,
  SOIL_LIST_TABLES,
  getColumnName,
  type SoilListColumnKey,
} from "@/app/system/list/_lib/list-fields";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { buildMerBuffer, type MerRow } from "../_lib/mer";
import { applySort, buildBasePhoneQuery, buildSelect, type SoilListDb } from "../_lib/query";
import {
  SoilListRequestError,
  normalizeConditionRequestPayload,
  normalizeExportColumns,
  normalizeExportLimit,
  normalizeSortKey,
} from "../_lib/validation";

export const runtime = "nodejs";

type ExportRecord = {
  id: string;
  condition: unknown;
  columns: string[];
  row_limit: number;
  sort_key: string | null;
  file_name: string;
  phone_numbers: string[];
};

function timestampFileName(): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `リストマスタ_${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}.mer`;
}

function responseMer(buffer: Buffer, fileName: string, replacedChars: number, rowCount: number) {
  const encodedName = encodeURIComponent(fileName);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="list-master.mer"; filename*=UTF-8''${encodedName}`,
      "X-Soil-List-Row-Count": String(rowCount),
      "X-Soil-List-Replaced-Chars": String(replacedChars),
    },
  });
}

function normalizeRecordColumns(columns: string[]): SoilListColumnKey[] {
  const allowed = new Set(Object.keys(SOIL_LIST_COLUMNS));
  return columns.filter((column): column is SoilListColumnKey => allowed.has(column));
}

async function redownload(exportId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SOIL_LIST_TABLES.export)
    .select("id,condition,columns,row_limit,sort_key,file_name,phone_numbers")
    .eq("id", exportId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const record = data as ExportRecord | null;
  if (!record) return NextResponse.json({ ok: false, error: "記録が見つかりません" }, { status: 404 });

  const columns = normalizeRecordColumns(record.columns);
  const { data: rows, error: rowsError } = await admin
    .from(SOIL_LIST_TABLES.phone)
    .select(buildSelect(columns))
    .in(getColumnName("phoneNumber"), record.phone_numbers)
    .limit(record.row_limit);

  if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });
  const mer = buildMerBuffer(columns, ((rows ?? []) as unknown) as MerRow[]);
  return responseMer(mer.buffer, record.file_name, mer.replacedChars, (rows ?? []).length);
}

export async function POST(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.exportId === "string" && body.exportId) {
      return redownload(body.exportId);
    }

    const condition = normalizeConditionRequestPayload(body);
    const columns = normalizeExportColumns(body.columns);
    const rowLimit = normalizeExportLimit(body.limit);
    const sortKey = normalizeSortKey(body.sortKey);
    const admin = getSupabaseAdmin();

    const db = admin as unknown as SoilListDb;
    const built = await buildBasePhoneQuery(db, condition, buildSelect(columns));
    const query = applySort(built.query, sortKey).limit(rowLimit);
    const result = await query;
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    const rows = ((result.data ?? []) as unknown) as MerRow[];
    const mer = buildMerBuffer(columns, rows);
    const phoneNumbers = rows
      .map((row) => row.phoneNumber ?? row[getColumnName("phoneNumber")])
      .map((value) => String(value ?? ""))
      .filter(Boolean);
    const fileName = timestampFileName();

    const { error: insertError } = await admin.from(SOIL_LIST_TABLES.export).insert({
      condition,
      columns,
      row_limit: rowLimit,
      sort_key: sortKey,
      row_count: rows.length,
      replaced_chars: mer.replacedChars,
      phone_numbers: phoneNumbers,
      file_name: fileName,
      created_by: auth.user.name,
    });

    if (insertError) {
      return NextResponse.json({ ok: false, error: "書き出しの記録を保存できませんでした" }, { status: 500 });
    }

    return responseMer(mer.buffer, fileName, mer.replacedChars, rows.length);
  } catch (error) {
    if (error instanceof SoilListRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "書き出しできませんでした" }, { status: 500 });
  }
}
