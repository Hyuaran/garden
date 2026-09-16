import { NextResponse, type NextRequest } from "next/server";

import { requireSoilListUser } from "../../_lib/auth";
import { createTemplateWorkbook, workbookBuffer } from "../../_lib/raw-excel/excel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "hikari" && kind !== "kureka") {
    return NextResponse.json({ ok: false, error: "テンプレートを選んでください" }, { status: 400 });
  }
  const workbook = createTemplateWorkbook(kind);
  const fileName = kind === "hikari" ? "リストテンプレート_光回線_8列.xlsx" : "リストテンプレート_クレカ_19列.xlsx";
  return new Response(await workbookBuffer(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

