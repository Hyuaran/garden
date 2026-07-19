import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { acceptedNotificationResponse, validateClientStates, validationTokenResponse, type ChangeNotification } from "@/app/rill/mail/_lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const validation = validationTokenResponse(new URL(request.url).searchParams.get("validationToken"));
  if (validation) return validation;
  let notifications: ChangeNotification[];
  try {
    const body = await request.json() as { value?: ChangeNotification[] };
    notifications = body.value ?? [];
  } catch { return Response.json({ error: "Invalid notification payload" }, { status: 400 }); }
  const ids = [...new Set(notifications.map((item) => item.subscriptionId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return Response.json({ error: "Missing subscription" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("rill_mail_subscriptions").select("subscription_id,client_state").in("subscription_id", ids);
  if (error) return Response.json({ error: "Subscription lookup failed" }, { status: 500 });
  const states = new Map((data ?? []).map((row) => [row.subscription_id as string, row.client_state as string]));
  if (!validateClientStates(notifications, states)) return Response.json({ error: "Invalid clientState" }, { status: 403 });
  const { error: updateError } = await admin.from("rill_mail_subscriptions").update({ last_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in("subscription_id", ids);
  if (updateError) return Response.json({ error: "Notification update failed" }, { status: 500 });
  return acceptedNotificationResponse();
}
