import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isClarityEligible, tokyoToday } from "@/lib/analytics/clarity-eligibility";

export const dynamic = "force-dynamic";

// ログインしている本人が Clarity で記録してよいか（18 歳以上か）だけを返す。生年月日そのものは返さない。
export async function GET() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return NextResponse.json({ eligible: false }, { headers: { "Cache-Control": "no-store" } });
  const { data } = await getSupabaseAdmin().from("root_employees").select("birthday").eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  return NextResponse.json({ eligible: isClarityEligible(data?.birthday ?? null, tokyoToday()) }, { headers: { "Cache-Control": "no-store" } });
}
