import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({ getDriveAccessToken: vi.fn() }));

import type { MailItem } from "./graph-mail";
import type { Lookups } from "./lookups";
import { runMailPaymentCheck, type RunRepository, type RunRow } from "./run";

function repo(previous: RunRow | null) {
  const inserted: unknown[] = [];
  const value: RunRepository = {
    lastApplied: async () => previous,
    lastAppliedOk: async () => (previous?.ok ? previous : null),
    insert: async (row) => {
      inserted.push(row);
    },
  };
  return { value, inserted };
}

const noLookups: Lookups = { reservations: async () => [], savedFiles: async () => [] };
const topway: MailItem = {
  id: "a",
  internetMessageId: "a",
  mailboxes: ["keiri@hyuaran.com"],
  receivedAt: "2026-10-10T01:00:00Z",
  sender: "info@topway.co.jp",
  senderName: "",
  subject: "御請求書",
};

// 2026-10-28（水）10:00 JST
const wednesday = new Date("2026-10-28T01:00:00Z");

describe("runMailPaymentCheck", () => {
  it("要対応があれば送って記録する", async () => {
    const sent: string[] = [];
    const r = repo({ ran_at: "2026-10-27T01:00:00Z", ok: true, applied: true });
    const result = await runMailPaymentCheck(
      { apply: true, trigger: "cron" },
      { now: wednesday, repo: r.value, notifier: { send: async (m) => void sent.push(m) }, lookups: noLookups, fetchMails: async () => ({ items: [topway], failedMailboxes: [] }) },
    );
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("要対応 1 件");
    expect(r.inserted).toHaveLength(1);
  });

  it("要対応が無い平日（月曜以外）は送らない", async () => {
    const sent: string[] = [];
    const r = repo(null);
    await runMailPaymentCheck(
      { apply: true, trigger: "cron" },
      { now: wednesday, repo: r.value, notifier: { send: async (m) => void sent.push(m) }, lookups: noLookups, fetchMails: async () => ({ items: [], failedMailboxes: [] }) },
    );
    expect(sent).toHaveLength(0);
  });

  it("休みの日は動かない", async () => {
    const result = await runMailPaymentCheck({ apply: true, trigger: "cron" }, { now: new Date("2026-10-31T01:00:00Z") });
    expect(result.skipped).toBe("休みの日");
  });

  it("失敗は障害ごとに 1 回だけ知らせる", async () => {
    const sent: string[] = [];
    const failing = async () => {
      throw new Error("boom");
    };
    const first = repo({ ran_at: "2026-10-27T01:00:00Z", ok: true, applied: true });
    await runMailPaymentCheck({ apply: true, trigger: "cron" }, { now: wednesday, repo: first.value, notifier: { send: async (m) => void sent.push(m) }, fetchMails: failing });
    const second = repo({ ran_at: "2026-10-28T01:00:00Z", ok: false, applied: true });
    await runMailPaymentCheck({ apply: true, trigger: "cron" }, { now: wednesday, repo: second.value, notifier: { send: async (m) => void sent.push(m) }, fetchMails: failing });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("失敗しています");
  });

  it("ドライランは送らず記録もしない", async () => {
    const sent: string[] = [];
    const r = repo(null);
    const result = await runMailPaymentCheck(
      { apply: false, trigger: "manual" },
      { now: wednesday, repo: r.value, notifier: { send: async (m) => void sent.push(m) }, lookups: noLookups, fetchMails: async () => ({ items: [topway], failedMailboxes: [] }) },
    );
    expect(sent).toHaveLength(0);
    expect(r.inserted).toHaveLength(0);
    expect(result.message).toContain("トップウェイ");
  });
});
