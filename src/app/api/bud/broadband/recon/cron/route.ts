import { verifyBearerRequest } from "@/lib/cron-auth";
import { runRecon } from "@/lib/bud/broadband/run";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request,"CRON_SECRET");
  if (!auth.ok) return Response.json({error:auth.reason},{status:auth.status});
  try { return Response.json(await runRecon(new URL(request.url).searchParams.get("dryRun") === "1"),{headers:{"Cache-Control":"no-store"}}); }
  catch (error) { console.error("broadband recon failed",error); return Response.json({error:"broadband_recon_failed"},{status:500}); }
}
