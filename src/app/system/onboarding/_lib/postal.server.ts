import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OnboardingError, onboardingEmployee } from "./onboarding.server";

export async function lookupOnboardingPostal(code: string) {
  await onboardingEmployee();
  if (!/^[0-9]{7}$/.test(code)) throw new OnboardingError("郵便番号は7桁の数字です。住所は直接入力することもできます。", 400);
  // 既存データは住所行への一般SELECTを許可していないため、認証後に読み取りだけ行う。
  const admin = getSupabaseAdmin();
  const { data: dataset, error } = await admin.from("system_postal_datasets").select("id").eq("active", true).maybeSingle();
  if (error || !dataset) throw new OnboardingError("住所の自動入力を利用できません。住所を直接入れてください。", 503);
  const result = await admin.from("system_postal_addresses").select("prefecture,city,town,prefecture_kana,city_kana,town_kana,is_special")
    .eq("dataset_id", dataset.id).eq("postal_code", code).order("prefecture").order("city").order("town");
  if (result.error) throw new OnboardingError("住所の自動入力を利用できません。住所を直接入れてください。", 503);
  return (result.data ?? []).map(row => ({
    address: `${row.prefecture}${row.city}${row.is_special ? "" : row.town}`,
    addressKana: `${row.prefecture_kana}${row.city_kana}${row.is_special ? "" : row.town_kana}`,
  })).filter((row, index, rows) => rows.findIndex(other => other.address === row.address && other.addressKana === row.addressKana) === index);
}
