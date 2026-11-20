import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { TableQuery } from "@/app/system/_components/DataTable/DataTable";
import type { CaseList, KandenTab } from "./cases";

export async function readCaseList(year: number, tab: KandenTab, query: TableQuery, counts: boolean) {
  const { data, error } = await getSupabaseAdmin().rpc("leaf_kanden_case_page", {
    p_year: year, p_tab: tab, p_query: query, p_counts: counts,
  });
  if (error) throw error;
  return data as CaseList;
}
