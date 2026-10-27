import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { minimumWageAt as findMinimumWage, wageError, type MinimumWage } from "./minimum-wages";
import type { EmploymentContractPayload } from "@/app/root/contracts/_lib/employment-contract";
export async function listMinimumWages() {
  const { data, error } = await getSupabaseAdmin().from("root_minimum_wages").select("*").order("effective_from", { ascending: false });
  if (error) throw new Error("最低賃金を読み込めませんでした");
  return (data ?? []) as MinimumWage[];
}
export async function validateMinimumWage(p: EmploymentContractPayload) { return wageError(p, await listMinimumWages()); }
export async function minimumWageAt(prefecture: string, date: string) {
  return findMinimumWage(await listMinimumWages(), prefecture, date)?.hourly_amount ?? null;
}
