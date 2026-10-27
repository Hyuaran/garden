import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { listMinimumWages } from "@/lib/minimum-wages.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export async function GET() {
  try { await viewPermissionContext(); return Response.json({rows:await listMinimumWages()}); }
  catch { return Response.json({error:"最低賃金を読み込めませんでした"},{status:403}); }
}
export async function POST(request:Request) {
  try {
    const ctx = await viewPermissionContext();
    if (ctx.viewer.role !== "super_admin") return Response.json({error:"編集権限がありません"},{status:403});
    const p = await request.json();
    if (!String(p.prefecture??"").trim() || !Number.isInteger(p.hourly_amount) || p.hourly_amount<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.effective_from) || !Number.isFinite(Date.parse(p.effective_from)) || (p.source_url && !/^https?:\/\//.test(p.source_url))) return Response.json({error:"入力内容を確認してください"},{status:400});
    const value={prefecture:p.prefecture.trim(),hourly_amount:p.hourly_amount,effective_from:p.effective_from,source_url:p.source_url||null};
    const db=getSupabaseAdmin();
    const result=p.id?await db.from("root_minimum_wages").update(value).eq("id",p.id).select("id").single():await db.from("root_minimum_wages").insert({...value,created_by:ctx.userId});
    if(result.error) return Response.json({error:"保存できませんでした。同じ日付の登録がないか確認してください"},{status:400});
    return Response.json({ok:true});
  } catch { return Response.json({error:"保存できませんでした"},{status:403}); }
}
