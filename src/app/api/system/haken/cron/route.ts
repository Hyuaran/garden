import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatworkClient } from "@/lib/chatwork";
import { checked, hakenError, loadHakenData } from "@/lib/haken/server";
import { ledgerNotices } from "@/lib/haken/ledger";
import { deliverHakenNotices } from "@/lib/haken/notify";
import { todayJst } from "@/lib/haken/rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok)
    return Response.json({ error: auth.reason }, { status: auth.status });
  try {
    const db = getSupabaseAdmin();
    const notices = ledgerNotices(await loadHakenData(db));
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const results = await deliverHakenNotices(
      notices,
      todayJst(),
      dryRun,
      {
        async claim(notice_key) {
          const result = await db
            .from("system_haken_notice_log")
            .insert({ notice_key });
          if (result.error?.code === "23505") return false;
          checked(result);
          return true;
        },
        async sent(key) {
          checked(
            await db
              .from("system_haken_notice_log")
              .update({ sent_at: new Date().toISOString() })
              .eq("notice_key", key),
          );
        },
      },
      async (message) => {
        const token = process.env.CHATWORK_API_TOKEN;
        const room = process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
        if (!token || !room) throw new Error("通知設定がありません。");
        await new ChatworkClient(token).sendMessage(room, message);
      },
    );
    return Response.json(
      { dryRun, results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return hakenError(error);
  }
}
