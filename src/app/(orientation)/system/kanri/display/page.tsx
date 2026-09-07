import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { tokyoToday } from "@/app/system/kanri/_lib/kanri-core";
import { buildKanriDisplayPayload } from "@/app/system/kanri/_lib/kanri-display";
import type { AporanSheetGrid } from "@/app/system/kanri/_lib/calc/aporan-sheet";
import type { KanriSheetGrid } from "@/app/system/kanri/_lib/calc/kanri-sheet";
import DisplayClient, { type DisplayData } from "./DisplayClient";

export const metadata = { title: "管理表モニター表示 | Garden" };
export const dynamic = "force-dynamic";

function isAporanGrid(value: unknown): value is AporanSheetGrid {
  return Boolean(value && typeof value === "object" && "targetDate" in value && "teams" in value);
}

function isKanriGrid(value: unknown): value is KanriSheetGrid {
  return Boolean(value && typeof value === "object" && "days" in value);
}

async function loadInitialDisplay(): Promise<DisplayData> {
  const admin = getSupabaseAdmin();
  const latestRun = async (targetDate?: string) => {
    let query = admin
      .from("system_kanri_run")
      .select("id,target_date,created_at");
    if (targetDate) query = query.eq("target_date", targetDate);
    return query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  };
  const todayRun = await latestRun(tokyoToday());
  if (todayRun.error) return { ok: false, message: "表示する成績を読み込めませんでした" };
  const fallbackRun = todayRun.data ? null : await latestRun();
  if (fallbackRun?.error) return { ok: false, message: "表示する成績を読み込めませんでした" };
  const run = todayRun.data ?? fallbackRun?.data ?? null;
  if (!run) return { ok: true, empty: true, message: "まだ計算していません" };
  const aporanResult = await admin
    .from("system_kanri_result")
    .select("run_id,sheet,grid,calculated_at")
    .eq("run_id", run.id)
    .eq("sheet", "aporan")
    .maybeSingle();
  if (aporanResult.error) return { ok: false, message: "表示する成績を読み込めませんでした" };
  if (!aporanResult.data || !isAporanGrid(aporanResult.data.grid)) return { ok: true, empty: true, message: "まだ計算していません" };
  const kanriResult = await admin
    .from("system_kanri_result")
    .select("grid")
    .eq("run_id", aporanResult.data.run_id)
    .eq("sheet", "kanri")
    .maybeSingle();
  if (kanriResult.error) return { ok: false, message: "表示する成績を読み込めませんでした" };
  return buildKanriDisplayPayload({
    aporanGrid: aporanResult.data.grid,
    kanriGrid: isKanriGrid(kanriResult.data?.grid) ? kanriResult.data.grid : null,
    calculatedAt: aporanResult.data.calculated_at,
  });
}

export default async function KanriDisplayPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fkanri%2Fdisplay");

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  const role = String(employee?.garden_role ?? "") as GardenRole;
  if (!employee || !isRoleAtLeast(role, "staff")) {
    return <DisplayClient initialData={{ ok: false, message: "この画面は社員以上が使えます" }} />;
  }

  return <DisplayClient initialData={await loadInitialDisplay()} />;
}
