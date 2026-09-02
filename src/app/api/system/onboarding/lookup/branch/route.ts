import { NextResponse } from "next/server";
import { OnboardingError, onboardingEmployee } from "@/app/system/onboarding/_lib/onboarding.server";
import { branchSearchTerms } from "@/app/system/onboarding/_lib/bank-search";

type BranchRow = { branch_code: string; branch_name: string };
const responseBranches = (data: BranchRow[] | null) => ({ branches: (data ?? []).map(row => ({ branchCode: row.branch_code, branchName: row.branch_name })) });

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { supabase } = await onboardingEmployee();
    const params = new URL(request.url).searchParams;
    const bankCode = params.get("bankCode")?.trim() ?? "";
    const code = params.get("code")?.trim() ?? "";
    if (bankCode && code) {
      const { data, error } = await supabase.from("system_bank_branches").select("branch_code,branch_name").eq("bank_code", bankCode).eq("branch_code", code).order("branch_code", { ascending: true }).limit(1);
      if (error) throw error;
      return NextResponse.json(responseBranches(data), { headers });
    }
    const name = params.get("name")?.trim() ?? "";
    if (!bankCode || !name) return NextResponse.json({ branches: [] }, { headers });
    for (const term of branchSearchTerms(name)) {
      const { data, error } = await supabase.from("system_bank_branches").select("branch_code,branch_name").eq("bank_code", bankCode).or(`branch_name.ilike.*${term}*,branch_kana.ilike.*${term}*`).order("branch_code", { ascending: true }).limit(20);
      if (error) throw error;
      if ((data ?? []).length > 0) return NextResponse.json(responseBranches(data), { headers });
    }
    return NextResponse.json({ branches: [] }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "ログインし直してください。" : "検索できませんでした。" }, { status, headers });
  }
}
