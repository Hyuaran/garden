import { NextResponse } from "next/server";
import { requireCallAccess, callAccessErrorResponse } from "@/lib/innovera/calls.server";
import { listInnoveraCircuits } from "@/lib/innovera/client";
import { orderedCircuits, validateCircuitOrder } from "@/lib/innovera/circuit-order.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const forbidden = () => NextResponse.json({ ok: false, error: "並び順を変更する権限がありません" }, { status: 403 });
function failed(error: unknown) {
  try { return callAccessErrorResponse(error); }
  catch { return NextResponse.json({ ok: false, error: "並び順を保存・取得できませんでした" }, { status: 500 }); }
}
export async function GET() {
  try {
    const ctx = await requireCallAccess();
    if (ctx.role !== "super_admin") return forbidden();
    return NextResponse.json({ ok: true, ...await orderedCircuits(await listInnoveraCircuits()) });
  } catch (error) { return failed(error); }
}
export async function PUT(request: Request) {
  try {
    const ctx = await requireCallAccess();
    if (ctx.role !== "super_admin") return forbidden();
    const body: unknown = await request.json().catch(() => null);
    if (!validateCircuitOrder(body)) return NextResponse.json({ ok: false, error: "表題と回線の並び順が正しくありません" }, { status: 400 });
    const circuits = await listInnoveraCircuits();
    const known = new Set(circuits.map(c => String(c.id)));
    if ([...body.groups.flatMap(g => g.circuitIds), ...body.other].some(id => !known.has(id))) {
      return NextResponse.json({ ok: false, error: "存在しない回線です" }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().rpc("system_innovera_save_circuit_order", { p_groups: body.groups, p_other: body.other });
    if (error) throw error;
    return NextResponse.json({ ok: true, ...await orderedCircuits(circuits) });
  } catch (error) { return failed(error); }
}
