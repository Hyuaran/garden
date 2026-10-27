import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { runMinimumWageCron, syncMinimumWagesFromMhlw } from "@/lib/minimum-wages-sync.server";
export const runtime="nodejs";
export async function GET(request:Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ok:false},{status:401});
  try { const r=await runMinimumWageCron(); return Response.json(r,{status:r.ok?200:500}); }
  catch { return Response.json({ok:false,error:"自動登録の処理に失敗しました"},{status:500}); }
}
export async function POST() {
  try { const ctx=await viewPermissionContext(); if(ctx.viewer.role!=="super_admin")return Response.json({error:"編集権限がありません"},{status:403}); }
  catch { return Response.json({error:"編集権限がありません"},{status:403}); }
  const result=await syncMinimumWagesFromMhlw(); return Response.json(result,{status:result.ok?200:502});
}
