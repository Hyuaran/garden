import { requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  const { supabase, user } = await requireGardenUser();
  const { data, error } = await supabase.from("rill_mail_subscriptions").select("last_notified_at").eq("user_id", user.id).not("last_notified_at", "is", null).order("last_notified_at", { ascending: false }).limit(1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lastNotifiedAt: data?.[0]?.last_notified_at ?? null });
}
