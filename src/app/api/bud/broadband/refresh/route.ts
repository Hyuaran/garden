import { broadbandAccess } from "@/lib/bud/broadband/access";
import { runRecon } from "@/lib/bud/broadband/run";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST() {
  const auth = await broadbandAccess();
  if (!auth.ok) return Response.json({error:"権限がありません"},{status:auth.status});
  try {
    const result = await runRecon(false);
    if ("skipped" in result) return Response.json({message:"確認中です"});
    if (result.error) return Response.json({error:result.error},{status:409});
    return Response.json({ok:true});
  } catch (error) { console.error("broadband refresh failed",error); return Response.json({error:"収支を更新できませんでした。時間をおいてもう一度お試しください。"},{status:500}); }
}
