import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
import { onboardingProxyContext, readProxyOnboarding, saveProxyOnboarding } from "@/app/system/onboarding/_lib/onboarding-proxy.server";

const headers = { "Cache-Control": "private, no-store" };
type RouteParams = { params: Promise<{ employeeId: string }> };
function failure(error: unknown) {
  const status = (error as { status?: number })?.status;
  return NextResponse.json({ error: status && error instanceof Error ? error.message : "入社手続きを処理できませんでした。" }, { status: status ?? 500, headers });
}
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const context = await onboardingProxyContext((await params).employeeId);
    return NextResponse.json(await readProxyOnboarding(context), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: RouteParams) {
  if ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "この画面から保存し直してください。" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400, headers });
  try {
    const { employeeId } = await params;
    const context = await onboardingProxyContext(employeeId);
    const text = await request.text();
    if (text.length > 100_000) throw new OnboardingError("入力内容が多すぎます。", 400);
    let body;
    try { body = JSON.parse(text); } catch { throw new OnboardingError("入力内容を確認してください。", 400); }
    if (!body || !["save", "submit"].includes(body.action)) throw new OnboardingError("保存方法を確認してください。", 400);
    const result = await saveProxyOnboarding(context, body.values, body.action === "submit", body.step);
    revalidatePath("/system");
    revalidatePath("/system/onboarding");
    revalidatePath(`/system/onboarding/admin/${employeeId}`);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) { return failure(error); }
}
