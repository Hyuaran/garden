import { NextResponse } from "next/server";
import { readKotDailyCsv } from "@/app/system/kanri/_lib/kot-daily";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "CSV を選んでください" }, { status: 400 });
  }
  try {
    const rows = readKotDailyCsv(await file.arrayBuffer());
    const dates = [...new Set(rows.map((row) => row.date))].sort();
    const peopleCount = new Set(rows.map((row) => row.employeeCode)).size;
    return NextResponse.json({
      ok: true,
      rows,
      summary: {
        startDate: dates[0] ?? "",
        endDate: dates[dates.length - 1] ?? "",
        peopleCount,
      },
    });
  } catch (error) {
    console.error("[shukkin.parse]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: "CSV を読み込めませんでした。出力の型を確認してください。" }, { status: 400 });
  }
}
