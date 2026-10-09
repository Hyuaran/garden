import { NextResponse } from "next/server";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Garden（Vercel hnd1）から外へ出るときの送信元 IP を見る診断用（管理者以上）。
 * INNOVERA サポートの「接続元 IP を教えてほしい」への回答に使う（2026-10-09）。Vercel の送信元 IP は固定ではないので何回か呼んで集める。
 */
export async function GET() {
  try {
    const ctx = await requireCallAccess();
    if (!isRoleAtLeast(ctx.role, "admin")) {
      return NextResponse.json({ ok: false, error: "管理者権限が必要です" }, { status: 403 });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store", signal: controller.signal });
      const body = (await response.json()) as { ip?: string };
      return NextResponse.json({ ok: true, ip: body.ip ?? null, region: process.env.VERCEL_REGION ?? null, at: new Date().toISOString() });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json({ ok: false, error: "送信元 IP を確認できませんでした" }, { status: 500 });
    }
  }
}
