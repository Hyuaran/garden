import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatworkClient } from "@/lib/chatwork/client";
import { collect } from "./graph";
import { runWatch, type Dependencies, type State } from "./run";

export async function runMailNdrWatch(dryRun: boolean) {
  const db = getSupabaseAdmin();
  const owner = randomUUID();
  const check = <T extends { error: unknown }>(result: T): T => { if (result.error) throw new Error("NDR watch storage failed"); return result; };
  const deps: Dependencies = {
    async lock() { return check(await db.rpc("system_mail_ndr_watch_lock", { p_owner: owner })).data === true; },
    async unlock() { check(await db.rpc("system_mail_ndr_watch_unlock", { p_owner: owner })); },
    async readState() { return check(await db.from("system_mail_ndr_watch_state").select("started_at,last_run_at,outage,outage_notified").eq("id", 1).maybeSingle()).data as State | null; },
    async initialize(now) {
      check(await db.from("system_mail_ndr_watch_state").update({ started_at: now }).eq("id", 1).is("started_at", null));
      const state = await deps.readState();
      if (!state?.started_at) throw new Error("NDR watch initialization failed");
      return state;
    },
    async saveState(state) { check(await db.from("system_mail_ndr_watch_state").update(state).eq("id", 1)); },
    async known(id) { return !!check(await db.from("system_mail_ndr_alerts").select("message_id").eq("message_id", id).maybeSingle()).data; },
    async saveAlert(alert, notifiedAt) { check(await db.from("system_mail_ndr_alerts").insert({ ...alert, notified_at: notifiedAt })); },
    collect,
    async send(body) {
      // 知らせ先は複数の部屋をカンマ区切りで（Garden通知＋別の部屋・東海林さん 2026-10-22）
      const rooms = (process.env.MAIL_NDR_WATCH_CHATWORK_ROOM_ID ?? "").split(",").map(r => r.trim()).filter(Boolean);
      if (!rooms.length || rooms.some(r => !/^\d+$/.test(r))) throw new Error("MAIL_NDR_WATCH_CHATWORK_ROOM_ID is required");
      const client = new ChatworkClient(process.env.CHATWORK_API_TOKEN ?? "");
      for (const room of rooms) await client.sendMessage(room, body);
    },
  };
  // migration が用意した未開始行は、初回の実行時刻を確定してから読む。
  const read = deps.readState;
  deps.readState = async () => { const state = await read(); return state?.started_at ? state : null; };
  return runWatch(deps, dryRun);
}
