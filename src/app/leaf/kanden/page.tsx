import { withSystemView } from "@/lib/auth/system-view-page.server";
import { InitialUrlView } from "@/lib/ui/InitialUrlView";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { caseTab, fiscalYear, type CaseList } from "./cases";
import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { submissionsForYear } from "@/lib/leaf-kanden/submissions.server";
import { UUID } from "@/lib/leaf-kanden/submissions";
import { loadCaseDetail } from "./actions";
import KandenCases from "./KandenCases";

export const metadata = { title: "関電 案件一覧 | Garden" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Page({ searchParams }: Props) {
  const query = await searchParams;
  const tab = query.tab === "forms" ? "forms" : caseTab(query.tab);
  const currentYear = fiscalYear(new Date());
  const year = typeof query.year === "string" && /^[1-9]\d{3}$/.test(query.year) ? Number(query.year) : currentYear;
  const search = typeof query.q === "string" ? query.q : "";
  let list: CaseList | null = null;
  try {
    if (tab !== "forms") {
      const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_case_list", { p_year: year, p_tab: tab });
      if (error) console.error("leaf_kanden_case_list", error.code);
      else list = data as CaseList;
    }
  } catch {
    console.error("leaf_kanden_case_list: read failed");
  }

  const { viewer } = await viewPermissionContext();
  const intake = tab === "forms" ? await submissionsForYear(year).catch(() => null) : null;
  let firstYear = currentYear;
  if (tab === "forms" && intake) {
    const { data } = await getSupabaseAdmin().from("leaf_kanden_submissions").select("submitted_at")
      .order("submitted_at").limit(1).maybeSingle();
    if (data?.submitted_at) firstYear = fiscalYear(new Date(data.submitted_at));
  }
  const orderId = typeof query.order === "string" && UUID.test(query.order) && tab !== "forms" ? query.order : null;
  const order = orderId ? loadCaseDetail(orderId) : null;

  return (
    <InitialUrlView key={`${year}/${tab}/${orderId ?? ""}`} search={new URLSearchParams({ q: search }).toString()}>
      <KandenCases list={list} year={year} currentYear={currentYear} tab={tab} search={search}
        intake={intake} firstIntakeYear={firstYear} settingsAllowed={viewer.role === "super_admin"} linkedOrder={order} />
    </InitialUrlView>
  );
}

export default withSystemView("leaf-kanden", Page, undefined, "/leaf/kanden");
