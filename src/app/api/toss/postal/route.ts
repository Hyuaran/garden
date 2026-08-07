import { NextResponse } from "next/server";

import { requireActiveTossPartner, tossError } from "@/app/toss/_lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireActiveTossPartner();
    const zip = (new URL(request.url).searchParams.get("zip") || "").replace(/\D/g, "");
    if (!/^\d{7}$/.test(zip)) return NextResponse.json({ ok: false, error: "郵便番号は7桁で入力してください" }, { status: 400 });
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`, { cache: "no-store" });
    if (!response.ok) throw new Error("住所検索サービスに接続できません");
    const body = await response.json() as { results?: { address1: string; address2: string; address3: string }[] | null; message?: string };
    const result = body.results?.[0];
    if (!result) return NextResponse.json({ ok: true, found: false, data: null });
    return NextResponse.json({ ok: true, found: true, data: { prefecture: result.address1, city: result.address2, town: result.address3 } });
  } catch (error) {
    const result = tossError(error);
    return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
  }
}
