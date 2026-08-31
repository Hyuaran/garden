import { NextResponse } from "next/server";
import { OnboardingError, onboardingEmployee } from "@/app/system/onboarding/_lib/onboarding.server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { supabase } = await onboardingEmployee();
    const station = new URL(request.url).searchParams.get("station")?.trim() ?? "";
    if (!station) return NextResponse.json({ fare: null }, { headers });
    const { data, error } = await supabase.from("system_commute_fares").select("station,line,pass_monthly,fare_oneway").ilike("station", station).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ fare: data ? { station: data.station, line: data.line, passMonthly: data.pass_monthly, fareOneway: data.fare_oneway } : null }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "ログインし直してください。" : "検索できませんでした。" }, { status, headers });
  }
}
