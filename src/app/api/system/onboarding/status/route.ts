import { NextResponse } from "next/server";
import { needsOnboardingForLogin } from "@/app/system/onboarding/_lib/onboarding.server";

export async function GET() {
  return NextResponse.json(
    { needsOnboarding: await needsOnboardingForLogin() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
