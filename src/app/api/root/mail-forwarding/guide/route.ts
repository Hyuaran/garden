import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const db = await createServerClient();
    const permission = await db.rpc("root_mail_forwarding_can_read");
    if (permission.error || permission.data !== true) return new Response(null, { status: 403, headers });
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return new Response(null, { status: 404, headers });
    const row = await db.from("root_mail_forwardings").select("guide_path").eq("id", id).maybeSingle();
    if (row.error) throw row.error;
    if (!row.data?.guide_path) return new Response(null, { status: 404, headers });
    const image = await getSupabaseAdmin().storage.from("root-mail-forwarding").download(row.data.guide_path);
    if (image.error || !image.data) return new Response(null, { status: 404, headers });
    return new Response(image.data, { headers: { ...headers, "Content-Type": "image/png" } });
  } catch {
    return new Response(null, { status: 500, headers });
  }
}
