import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import CallMetricsClient from "./CallMetricsClient";
import type { GardenRole } from "@/app/root/_constants/types";
import { STAFF_VIEW_ROLES } from "@/lib/auth/view-roles";

export const metadata = { title: "テレマ コール集計 | Garden" };

const VIEW_ROLES = STAFF_VIEW_ROLES;

async function CallMetricsPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fcall-metrics");
  const { data: employee } = await supabase
    .from("root_employees").select("garden_role,is_active,termination_date,deleted_at").eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee || !isEmployeeActive(employee)) {
    return <main style={{ padding: 32 }}><div className="garden-help-heading"><h1>閲覧権限がありません</h1><HelpButton /></div><SystemTabs /><p>この画面は正社員以上が利用できます。</p></main>;
  }
  return <CallMetricsClient />;
}

export default withSystemView("system-call-metrics", CallMetricsPage);
