import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import CallMetricsClient from "./CallMetricsClient";

export const metadata = { title: "テレマ コール集計 | Garden" };

const VIEW_ROLES = new Set(["manager", "admin", "super_admin"]);

export default async function CallMetricsPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fcall-metrics");
  const { data: employee } = await supabase
    .from("root_employees").select("garden_role").eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee || !VIEW_ROLES.has(String(employee.garden_role))) {
    return <main style={{ padding: 32 }}><h1>閲覧権限がありません</h1><p>この画面は責任者以上が利用できます。</p></main>;
  }
  return <CallMetricsClient />;
}
