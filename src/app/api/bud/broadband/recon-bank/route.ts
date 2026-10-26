import { NextResponse } from "next/server";
import { broadbandAccess } from "@/lib/bud/broadband/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 明細のパネルを開いたときだけ、その行の「口座の照合の明細」を読む（表の最初の読み込みを軽くするため・2026-10-26）
export async function GET(request: Request) {
  const auth = await broadbandAccess();
  if (!auth.ok) return NextResponse.json({ error: "この画面を見る権限がありません" }, { status: auth.status });
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (!ids.length || ids.length > 500 || ids.some(id => id.length > 100)) return NextResponse.json({ error: "明細を選び直してください" }, { status: 400 });
  const { data, error } = await auth.db.from("bud_bb_records").select("kintone_record_id,recon_bank").in("kintone_record_id", ids);
  if (error) return NextResponse.json({ error: "明細を読み込めませんでした" }, { status: 500 });
  return NextResponse.json(Object.fromEntries((data ?? []).map(r => [r.kintone_record_id, r.recon_bank ?? []])), { headers: { "Cache-Control": "no-store" } });
}
