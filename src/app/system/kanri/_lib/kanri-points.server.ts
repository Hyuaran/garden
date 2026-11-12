import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadPoints } from "@/app/soil/product-points/server";
import { soilPointMasters } from "./soil-points";
import { monthRange } from "./kanri-core";
export async function loadKanriPoints(month: string) {
    const admin = getSupabaseAdmin();
    if (month < "2026-11")
        return admin.from("system_kanri_point_master").select("product,kintone_names,category,coefficient,unit_price,sort_order,active").eq("active", true).order("sort_order", { ascending: true });
    try {
        const { start, end } = monthRange(month + "-01");
        return { data: soilPointMasters((await loadPoints(admin)).filter(r => r.start_date <= end && (!r.end_date || r.end_date >= start))), error: null };
    }
    catch (error) {
        return { data: null, error };
    }
}
