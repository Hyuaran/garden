import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";

export const runtime = "nodejs";

type PurchaseVendorRow = {
  value: string | null;
  row_count: number | null;
};

type PurchaseVendorDb = {
  rpc(name: string): Promise<{ data: PurchaseVendorRow[] | null; error: { message: string } | null }>;
};

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const db = getSupabaseAdmin() as unknown as PurchaseVendorDb;
  const { data, error } = await db.rpc("soil_list_purchase_vendor_options");
  if (error) return NextResponse.json({ ok: false, error: "購入先を取得できませんでした" }, { status: 500 });

  const vendors = (data ?? [])
    .map((row) => ({ value: row.value ?? "", count: row.row_count ?? 0 }))
    .filter((row) => row.value !== "");
  return NextResponse.json({ ok: true, vendors });
}
