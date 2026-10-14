import "server-only";

import { ChatworkClient } from "@/lib/chatwork";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getRelayHeartbeat, isRelayAlive } from "./queue.server";
import type { RelayHeartbeatRow } from "./types";

const DEFAULT_CHATWORK_ROOM_ID = "450125458";
const DOWN_AFTER_MS = 5 * 60_000;

function jstMinute(now: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function downBody(now: Date, lastSeenAt: string | null) {
  const lastSeen = lastSeenAt ? jstMinute(new Date(lastSeenAt)) : "不明";
  return `[info][title]ホストPCの中継（Garden -> INNOVERA）[/title]${jstMinute(now)} 自動
中継が止まっています。最後に応答があったのは ${lastSeen} です。ホストPCの電源、ネットワーク、タスク「GardenRelayAgent」を確認してください。

確認：https://garden-os.net/system/innovera[/info]`;
}

function recoveryBody(now: Date, downSince: string | null) {
  const since = downSince ? jstMinute(new Date(downSince)) : "不明";
  return `[info][title]ホストPCの中継（Garden -> INNOVERA）[/title]${jstMinute(now)} 自動
復旧しました。${since} から止まっていた中継が応答しています。

確認：https://garden-os.net/system/innovera[/info]`;
}

async function sendGardenNotice(body: string) {
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) return;
  await new ChatworkClient(token).sendMessage(
    process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || DEFAULT_CHATWORK_ROOM_ID,
    body,
  );
}

async function updateHeartbeat(patch: Partial<RelayHeartbeatRow>) {
  const { error } = await getSupabaseAdmin()
    .from("system_relay_heartbeat")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", "host-pc");
  if (error) throw new Error(error.message);
}

export async function checkRelayHeartbeat(now = new Date()) {
  if (process.env.INNOVERA_RELAY_MODE !== "queue") return { ok: true, checked: false as const };

  const heartbeat = await getRelayHeartbeat();
  const alive = isRelayAlive(heartbeat, now);
  const lastSeen = heartbeat ? new Date(heartbeat.last_seen_at).getTime() : 0;
  const down = !alive && (!lastSeen || now.getTime() - lastSeen > DOWN_AFTER_MS);

  if (down && !heartbeat?.notified_down_at) {
    const notifiedAt = now.toISOString();
    try {
      await sendGardenNotice(downBody(now, heartbeat?.last_seen_at ?? null));
    } catch {
      // 通知失敗で同期処理を止めない。
    }
    if (heartbeat) {
      await updateHeartbeat({ notified_down_at: notifiedAt });
    } else {
      // まだ一度も応答が無い（行が無い）ときも「通知済み」を残し、5 分ごとに同じ知らせを繰り返さない
      const { error } = await getSupabaseAdmin()
        .from("system_relay_heartbeat")
        .upsert({ id: "host-pc", last_seen_at: new Date(0).toISOString(), notified_down_at: notifiedAt, updated_at: notifiedAt });
      if (error) throw new Error(error.message);
    }
    return { ok: true, checked: true as const, status: "down_notified" as const };
  }

  if (alive && heartbeat?.notified_down_at) {
    const downSince = heartbeat.notified_down_at;
    try {
      await sendGardenNotice(recoveryBody(now, downSince));
    } catch {
      // 通知失敗で同期処理を止めない。
    }
    await updateHeartbeat({ notified_down_at: null });
    return { ok: true, checked: true as const, status: "recovered" as const };
  }

  return { ok: true, checked: true as const, status: alive ? "alive" as const : "down" as const };
}
