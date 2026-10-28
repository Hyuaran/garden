import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const context = await viewPermissionContext();
    if (context.viewer.role !== "super_admin") return Response.json({ ok: false }, { status: 403 });
  } catch { return Response.json({ ok: false }, { status: 403 }); }
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!/^[0-9]{7}$/.test(code)) return Response.json({ ok: false, error: "郵便番号は 7 桁の数字です" }, { status: 400 });
  try {
    const admin = getSupabaseAdmin();
    const { data: dataset, error } = await admin.from("system_postal_datasets").select("id").eq("active", true).maybeSingle();
    if (error || !dataset) throw new Error("dataset unavailable");
    const result = await admin.from("system_postal_addresses").select("prefecture,city,town,is_special")
      .eq("dataset_id", dataset.id).eq("postal_code", code).order("prefecture").order("city").order("town");
    if (result.error) throw result.error;
    const addresses = [...new Set((result.data ?? []).map(row => `${row.prefecture}${row.city}${row.is_special ? "" : row.town}`))].map(address => ({ address }));
    return Response.json({ ok: true, addresses });
  } catch { return Response.json({ ok: false, error: "住所を直接入れてください" }, { status: 503 }); }
}
