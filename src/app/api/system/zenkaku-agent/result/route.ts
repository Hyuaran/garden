import { NextResponse } from "next/server";
import { evaluateGardenCheck } from "@/app/system/mypage/_lib/zenkaku-check";
import type { DuplicateSalesCase, SalesMasterRecord } from "@/app/system/mypage/_lib/zenkaku-check";
import { normalizePostalCode, type PostalAddressCandidate, type PostalCheckContext } from "@/app/system/mypage/_lib/zenkaku-check";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPostalContext(record: SalesMasterRecord): Promise<PostalCheckContext> {
  const admin = getSupabaseAdmin();
  const { data: dataset } = await admin.from("system_postal_datasets").select("id,source_date,imported_at").eq("active", true).maybeSingle();
  if (!dataset) return { byPostalCode: {}, enabled: false };
  const codes = Array.from(new Set([normalizePostalCode(record.installationPostalCode), normalizePostalCode(record.shippingPostalCode)].filter(Boolean)));
  const { data: entries } = codes.length ? await admin.from("system_postal_addresses").select("postal_code,prefecture,city,town,city_kana,town_kana,is_special").eq("dataset_id", dataset.id).in("postal_code", codes) : { data: [] };
  const byPostalCode: Record<string, PostalAddressCandidate[]> = {};
  for (const entry of entries ?? []) (byPostalCode[entry.postal_code] ??= []).push({ prefecture: entry.prefecture, city: entry.city, town: entry.town, cityKana: entry.city_kana, townKana: entry.town_kana, special: entry.is_special });
  return { byPostalCode, enabled: true, sourceDate: dataset.source_date, importedAt: dataset.imported_at };
}

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "ZENKAKU_AGENT_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  let body: { id?: unknown; outcome?: unknown; record?: SalesMasterRecord; duplicates?: DuplicateSalesCase[]; errorCode?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 }); }
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  let values: Record<string, unknown>;
  if (body.outcome === "not_found") values = { status: "failed", result: null, error_code: "not_found", updated_at: new Date().toISOString() };
  else if (body.outcome === "failed") {
    const allowed = new Set(["fm_unreachable", "timeout", "invalid_payload", "internal_error"]);
    const code = typeof body.errorCode === "string" && allowed.has(body.errorCode) ? body.errorCode : "fm_unreachable";
    values = { status: "failed", result: null, error_code: code, updated_at: new Date().toISOString() };
  } else if (body.outcome === "success" && body.record && typeof body.record === "object") {
    const result = evaluateGardenCheck(body.record, Array.isArray(body.duplicates) ? body.duplicates : [], new Date(), await loadPostalContext(body.record));
    values = { status: "done", result, error_code: null, updated_at: new Date().toISOString() };
  } else return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().from("system_zenkaku_check_request").update(values)
    .eq("id", body.id).eq("status", "reading").select("id").maybeSingle();
  if (error) { console.error("[zenkaku-agent] result update failed", { request_id: body.id }); return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 }); }
  if (!data) return NextResponse.json({ ok: false, error: "request_not_reading" }, { status: 409 });
  console.info("[zenkaku-agent] request completed", { request_id: body.id, status: values.status });
  return NextResponse.json({ ok: true });
}
