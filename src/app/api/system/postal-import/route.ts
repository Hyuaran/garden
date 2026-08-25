import { NextResponse } from "next/server";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { extractJapanPostCsv, JAPAN_POST_UTF8_URL, parseJapanPostCsv, postalSourceDate } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function importPostalData(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  const response = await fetch(JAPAN_POST_UTF8_URL, { cache: "no-store" });
  if (!response.ok) return NextResponse.json({ ok: false, error: "download_failed" }, { status: 502 });
  const rows = parseJapanPostCsv(await extractJapanPostCsv(await response.arrayBuffer()));
  if (rows.length < 100_000) return NextResponse.json({ ok: false, error: "unexpected_row_count", count: rows.length }, { status: 422 });
  const admin = getSupabaseAdmin();
  const { data: dataset, error: datasetError } = await admin.from("system_postal_datasets").insert({ source_date: postalSourceDate(response.headers.get("last-modified")), source_url: JAPAN_POST_UTF8_URL, active: false }).select("id").single();
  if (datasetError || !dataset) return NextResponse.json({ ok: false, error: "dataset_create_failed" }, { status: 500 });
  try {
    for (let index = 0; index < rows.length; index += 1000) {
      const { error } = await admin.from("system_postal_addresses").insert(rows.slice(index, index + 1000).map((row) => ({ dataset_id: dataset.id, ...row })));
      if (error) throw error;
    }
    const { error } = await admin.rpc("activate_system_postal_dataset", { p_dataset_id: dataset.id, p_row_count: rows.length });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: rows.length, sourceDate: postalSourceDate(response.headers.get("last-modified")) });
  } catch (error) {
    await admin.from("system_postal_datasets").delete().eq("id", dataset.id);
    console.error("[postal-import] failed", error);
    return NextResponse.json({ ok: false, error: "import_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) { return importPostalData(request); }
export async function POST(request: Request) { return importPostalData(request); }
