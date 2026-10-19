import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { runDocSaveCheck } from "@/lib/doc-save-check/run";
import { allowAdminDryRun } from "@/lib/pl-payments/admin-dry-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 契約書・条件表の保存チェック（cron 登録は初回検証後）。
 * ?dry=1 は送らず結果だけ返す（管理者以上がログインしていれば合言葉なしで見られる）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok && !(dry && (await allowAdminDryRun()))) {
    return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  }

  const result = await runDocSaveCheck({ apply: !dry, trigger: "cron", force: url.searchParams.get("force") === "1" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

