import { NextResponse } from "next/server";
import { OnboardingError, onboardingEmployee } from "@/app/system/onboarding/_lib/onboarding.server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { supabase } = await onboardingEmployee();
    const params = new URL(request.url).searchParams;
    const bankCode = params.get("bankCode")?.trim() ?? "";
    const name = params.get("name")?.trim() ?? "";
    if (!bankCode || !name) return NextResponse.json({ branches: [] }, { headers });
    const { data, error } = await supabase.from("system_bank_branches").select("branch_code,branch_name").eq("bank_code", bankCode).ilike("branch_name", `%${name}%`).order("branch_code", { ascending: true }).limit(10);
    if (error) throw error;
    return NextResponse.json({ branches: (data ?? []).map(row => ({ branchCode: row.branch_code, branchName: row.branch_name })) }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "ログインし直してください。" : "検索できませんでした。" }, { status, headers });
  }
}
