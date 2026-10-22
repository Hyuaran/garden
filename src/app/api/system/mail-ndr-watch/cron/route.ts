import { verifyBearerRequest } from "@/lib/cron-auth";
import { runMailNdrWatch } from "@/lib/mail-ndr-watch/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return Response.json({ ok: false, error: auth.reason }, { status: auth.status });
  try {
    const result = await runMailNdrWatch(new URL(request.url).searchParams.get("dryRun") === "1");
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch {
    return Response.json({ ok: false, error: "メール送信失敗の監視に失敗しました" }, { status: 500 });
  }
}
