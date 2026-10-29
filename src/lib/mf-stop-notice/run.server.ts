import "server-only";
import { ChatworkClient } from "@/lib/chatwork";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runMfStopNotice, type Employee } from "./run";

export async function runMfStopNoticeCron(dryRun: boolean) {
  const db = getSupabaseAdmin();
  return runMfStopNotice({
    async load(cutoff) {
      const { data, error } = await db.from("root_employees")
        .select("employee_id,employee_number,name,email,termination_date,mf_stop_notified_at")
        .is("mf_stop_notified_at", null).gte("termination_date", cutoff)
        .order("employee_id");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
    async send(message) {
      const token = process.env.CHATWORK_API_TOKEN;
      if (!token) throw new Error("Chatwork notification is not configured");
      await new ChatworkClient(token).sendMessage(process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || "450125458", message);
    },
    async mark(employees, at) {
      const { error } = await db.from("root_employees")
        .update({ mf_stop_notified_at: at })
        .in("employee_id", employees.map(e => e.employee_id))
        .is("mf_stop_notified_at", null);
      if (error) throw error;
    },
  }, { dryRun });
}
