import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { OnboardingError, onboardingEmployee, saveOnboarding } from "@/app/system/onboarding/_lib/onboarding.server";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "この画面から保存し直してください。" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "入力内容を読み取れませんでした。" }, { status: 400, headers });
  try {
    const context = await onboardingEmployee();
    const text = await request.text();
    if (text.length > 100_000) throw new OnboardingError("入力内容が多すぎます。内容を確認してください。", 400);
    let body;
    try { body = JSON.parse(text); } catch { throw new OnboardingError("入力内容を読み取れませんでした。", 400); }
    if (!body || !["save", "submit"].includes(body.action)) throw new OnboardingError("保存方法を確認してください。", 400);
    const result = await saveOnboarding(context, body.values, body.action === "submit");
    if (result.status === "submitted") revalidatePath("/system");
    return NextResponse.json({ ok: true, status: result.status, submittedAt: result.submittedAt, ndaAgreedAt: result.ndaAgreedAt }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof OnboardingError ? error.message : "保存できませんでした。もう一度お試しください。" }, { status: error instanceof OnboardingError ? error.status : 500, headers });
  }
}
