import { NextResponse } from "next/server";
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
import { lookupOnboardingPostal } from "@/app/system/onboarding/_lib/postal.server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const addresses = await lookupOnboardingPostal(new URL(request.url).searchParams.get("code") ?? "");
    return NextResponse.json({ ok: true, addresses }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof OnboardingError ? error.message : "住所を取得できませんでした。住所を直接入れてください。" }, { status: error instanceof OnboardingError ? error.status : 500, headers });
  }
}
