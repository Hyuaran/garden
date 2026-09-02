import { NextResponse } from "next/server";
import { OnboardingError, onboardingEmployee } from "@/app/system/onboarding/_lib/onboarding.server";
import { bankSearchTerms } from "@/app/system/onboarding/_lib/bank-search";

type BankRow = { bank_code: string; bank_name: string };
const responseBanks = (data: BankRow[] | null) => ({ banks: (data ?? []).map(row => ({ bankCode: row.bank_code, bankName: row.bank_name })) });

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { supabase } = await onboardingEmployee();
    const params = new URL(request.url).searchParams;
    const code = params.get("code")?.trim() ?? "";
    if (code) {
      const { data, error } = await supabase.from("system_bank_master").select("bank_code,bank_name").eq("bank_code", code).order("bank_code", { ascending: true }).limit(1);
      if (error) throw error;
      return NextResponse.json(responseBanks(data), { headers });
    }
    const name = params.get("name")?.trim() ?? "";
    if (!name) return NextResponse.json({ banks: [] }, { headers });
    for (const term of bankSearchTerms(name)) {
      const { data, error } = await supabase.from("system_bank_master").select("bank_code,bank_name").or(`bank_name.ilike.*${term}*,bank_kana.ilike.*${term}*`).order("bank_code", { ascending: true }).limit(20);
      if (error) throw error;
      if ((data ?? []).length > 0) return NextResponse.json(responseBanks(data), { headers });
    }
    return NextResponse.json({ banks: [] }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "ログインし直してください。" : "検索できませんでした。" }, { status, headers });
  }
}
