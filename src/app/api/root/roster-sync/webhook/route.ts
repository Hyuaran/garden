import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { syncRootRoster } from "@/app/root/_lib/roster-sync.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.ROOT_ROSTER_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  const key = new URL(request.url).searchParams.get("key");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!key || !timingSafeEqual(digest(key), digest(secret))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (String(body?.app?.id ?? "") !== (process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56")) {
    return Response.json({ error: "Invalid app" }, { status: 400 });
  }
  if (!["ADD_RECORD", "UPDATE_RECORD", "UPDATE_STATUS"].includes(body?.type)) {
    console.info("[roster-webhook] Ignored event", body?.type);
    return Response.json({ ok: true });
  }
  const id = body?.record?.$id?.value;
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    return Response.json({ error: "Invalid record ID" }, { status: 400 });
  }
  after(async () => {
    try {
      const result = await syncRootRoster({ dryRun: false, recordIds: [id] });
      if (result.errors.length) console.error("[roster-webhook] Sync errors", id, result.errors);
    } catch (error) {
      console.error("[roster-webhook] Sync failed", id, error);
    }
  });
  return Response.json({ ok: true });
}
