import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatworkClient } from "@/lib/chatwork";
import { chatworkToLine } from "@/lib/chatwork/mentions.server";
import { todayJst, type Forwarding, type Notice } from "@/lib/mail-forwarding/domain";
import { deliverNotices } from "@/lib/mail-forwarding/notify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
  try {
    const db = getSupabaseAdmin();
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const [rows, notices] = await Promise.all([
      db.from("root_mail_forwardings").select("*,filings:root_mail_forwarding_filings(*)").eq("stopped", false),
      db.from("root_mail_forwarding_notices").select("*"),
    ]);
    if (rows.error || notices.error) throw rows.error || notices.error;
    const match = (n: Notice) => db.from("root_mail_forwarding_notices").update({ sent_at: new Date().toISOString() }).eq("forwarding_id", n.forwarding_id).eq("filed_on", n.filed_on).eq("stage", n.stage);
    const results = await deliverNotices(rows.data as Forwarding[], notices.data as Notice[], todayJst(), dryRun, {
      async claim(n) { const r = await db.rpc("root_mail_forwarding_claim", { p_id: n.forwarding_id, p_date: n.filed_on, p_stage: n.stage }); if (r.error) throw r.error; return r.data === true; },
      async sent(n) { const r = await match(n); if (r.error) throw r.error; },
      async release(n) { const r = await db.from("root_mail_forwarding_notices").delete().eq("forwarding_id", n.forwarding_id).eq("filed_on", n.filed_on).eq("stage", n.stage).is("sent_at", null); if (r.error) throw r.error; },
    }, async message => {
      const token = process.env.CHATWORK_API_TOKEN, room = process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
      if (!token || !room) throw new Error("通知設定がありません");
      const admins = await db.from("root_employees").select("employee_id").eq("garden_role", "super_admin").eq("is_active", true).is("deleted_at", null);
      if (admins.error) throw admins.error;
      const { line } = await chatworkToLine((admins.data ?? []).map(e => e.employee_id));
      await new ChatworkClient(token).sendMessage(room, message + (line ? `\n${line}` : ""));
    });
    return Response.json({ dryRun, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("mail forwarding cron failed", error);
    return Response.json({ error: "郵便の転送の確認に失敗しました。" }, { status: 500 });
  }
}
