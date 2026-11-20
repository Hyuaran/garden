import { withSystemView } from "@/lib/auth/system-view-page.server";
import { InitialUrlView } from "@/lib/ui/InitialUrlView";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { caseTab, fiscalYear, type CaseList } from "./cases";
import KandenCases from "./KandenCases";

export const metadata = { title: "関電 案件一覧 | Garden" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Page({ searchParams }: Props) {
  const query = await searchParams;
  const tab = caseTab(query.tab);
  const currentYear = fiscalYear(new Date());
  const year = typeof query.year === "string" && /^[1-9]\d{3}$/.test(query.year) ? Number(query.year) : currentYear;
  const search = typeof query.q === "string" ? query.q : "";
  let list: CaseList | null = null;
  try {
    const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_case_list", { p_year: year, p_tab: tab });
    if (error) console.error("leaf_kanden_case_list", error.code);
    else list = data as CaseList;
  } catch {
    console.error("leaf_kanden_case_list: read failed");
  }

  return (
    <InitialUrlView key={`${year}/${tab}`} search={new URLSearchParams({ q: search }).toString()}>
      <KandenCases list={list} year={year} currentYear={currentYear} tab={tab} search={search} />
    </InitialUrlView>
  );
}

export default withSystemView("leaf-kanden", Page, undefined, "/leaf/kanden");
