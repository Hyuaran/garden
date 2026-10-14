import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { runMailPaymentCheck } from "@/lib/mail-payment-check/run";
import { allowAdminDryRun } from "@/lib/pl-payments/admin-dry-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 支払漏れチェック（平日 10:00 JST＝vercel.json の 0 1 * * 1-5）。
 * ?dry=1 は送らず結果だけ返す（管理者以上がログインしていれば合言葉なしで見られる）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok && !(dry && (await allowAdminDryRun()))) {
    return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  }

  const result = await runMailPaymentCheck({ apply: !dry, trigger: "cron", force: url.searchParams.get("force") === "1" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
