import { verifyBearerRequest } from "@/lib/cron-auth";
import { sendReconNotice } from "@/lib/bud/broadband/run";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 毎朝 10:00（日本時間）。朝の照合で見つかった分の知らせをまとめて送る。
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request,"CRON_SECRET");
  if (!auth.ok) return Response.json({error:auth.reason},{status:auth.status});
  try { return Response.json(await sendReconNotice(),{headers:{"Cache-Control":"no-store"}}); }
  catch (error) { console.error("broadband recon notice failed",error); return Response.json({error:"broadband_recon_notice_failed"},{status:500}); }
}
