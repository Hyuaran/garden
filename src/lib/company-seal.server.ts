import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export const MISSING_COMPANY_SEAL = "この法人の角印が登録されていません";
export async function loadCompanySeal(companyId: string | null) {
  if (!companyId) return undefined;
  const { data, error } = await getSupabaseAdmin().storage.from("company-seals").download(`${companyId}.png`);
  if (error || !data) return undefined;
  return `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}
