import { NextResponse } from "next/server";
import { mfAccess } from "@/lib/bud/mf/access";
import { visibleLinkAlerts } from "@/lib/bud/mf/link-alerts";
export const dynamic = "force-dynamic";
export async function GET() {
 const auth = await mfAccess();
 if (!auth.ok) return NextResponse.json({ error: "この画面を見る権限がありません" }, { status: auth.status });
 const result = await auth.db.from("bud_mf_link_alerts").select("*").eq("active", true).gt("received_at", new Date(Date.now()-8*86400000).toISOString());
 if (result.error) return NextResponse.json({ error: "知らせを読み込めませんでした" }, { status: 500 });
 return NextResponse.json({ alerts: visibleLinkAlerts(result.data) }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
 const auth = await mfAccess();
 if (!auth.ok) return NextResponse.json({ error: "消す権限がありません" }, { status: auth.status });
 let body;
 try { body = await request.json(); } catch { return NextResponse.json({ error: "内容を確認してください" }, { status: 400 }); }
 if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "内容を確認してください" }, { status: 400 });
 const result = await auth.db.rpc("bud_mf_dismiss_link_alert", { p_id: body.id });
 if (result.error) return NextResponse.json({ error: "この知らせを消せませんでした" }, { status: 403 });
 return NextResponse.json({ ok: true });
}
