import { verifyBearerRequest } from "@/lib/cron-auth";
import { runKandenSync } from "@/lib/kintone-broadband/kanden-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
  try {
    const result = await runKandenSync(new URL(request.url).searchParams.get("dryRun") === "1");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("kanden-sync failed", error);
    return Response.json({ error: "kanden_sync_failed" }, { status: 500 });
  }
}
