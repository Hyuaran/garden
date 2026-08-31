import { NextResponse } from "next/server";
import { OnboardingError, onboardingEmployee } from "@/app/system/onboarding/_lib/onboarding.server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { supabase } = await onboardingEmployee();
    const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
    if (!name) return NextResponse.json({ banks: [] }, { headers });
    const { data, error } = await supabase.from("system_bank_master").select("bank_code,bank_name").ilike("bank_name", `%${name}%`).order("bank_code", { ascending: true }).limit(10);
    if (error) throw error;
    return NextResponse.json({ banks: (data ?? []).map(row => ({ bankCode: row.bank_code, bankName: row.bank_name })) }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "ログインし直してください。" : "検索できませんでした。" }, { status, headers });
  }
}
