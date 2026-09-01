import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
import { applyAdminOnboarding, onboardingAdminContext, readMyNumberForAdmin, saveAdminOnboarding, saveAdminOnboardingEmail } from "@/app/system/onboarding/_lib/onboarding-admin.server";
import { createAndSaveFuyouPdf } from "@/app/system/onboarding/_lib/onboarding-fuyou.server";
import { safeFuyouErrorMessage } from "@/app/system/onboarding/_lib/fuyou-pdf";

function sameOrigin(request: Request) {
  return (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site";
}

export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  if (sameOrigin(request)) return NextResponse.json({ error: "この画面から保存し直してください。" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "入力内容を読み取れませんでした。" }, { status: 400, headers });
  let action = "";
  try {
    const { employeeId } = await params;
    const context = await onboardingAdminContext();
    const text = await request.text();
    if (text.length > 50_000) throw new OnboardingError("入力内容が多すぎます。内容を確認してください。", 400);
    let body;
    try { body = JSON.parse(text); } catch { throw new OnboardingError("入力内容を読み取れませんでした。", 400); }
    if (!body || !["save", "apply", "fuyou", "myNumber", "email"].includes(body.action)) throw new OnboardingError("保存方法を確認してください。", 400);
    action = body.action;
    if (action === "fuyou") {
      const saved = await createAndSaveFuyouPdf(context, employeeId);
      return NextResponse.json({ ok: true, filename: saved.filename, folderLabel: saved.folderLabel }, { headers });
    }
    if (action === "myNumber") {
      const result = await readMyNumberForAdmin(context, employeeId, body.target);
      return NextResponse.json({ ok: true, myNumber: result.myNumber }, { headers });
    }
    if (action === "email") {
      const result = await saveAdminOnboardingEmail(context, employeeId, body);
      revalidatePath("/system/onboarding/admin");
      revalidatePath(`/system/onboarding/admin/${employeeId}`);
      return NextResponse.json({ ok: true, email: result.email }, { headers });
    }
    if (action === "apply") await applyAdminOnboarding(context, employeeId, body.values);
    else await saveAdminOnboarding(context, employeeId, body.values);
    revalidatePath("/system/onboarding/admin");
    revalidatePath(`/system/onboarding/admin/${employeeId}`);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    const message = action === "fuyou" ? safeFuyouErrorMessage(status) : error instanceof OnboardingError ? error.message : "保存できませんでした。もう一度お試しください。";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
