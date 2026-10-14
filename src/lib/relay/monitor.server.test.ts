import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  heartbeat: null as { last_seen_at: string; notified_down_at: string | null } | null,
  updates: [] as unknown[],
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/chatwork", () => ({
  ChatworkClient: vi.fn().mockImplementation(function ChatworkClientMock() {
    return { sendMessage: mocks.sendMessage };
  }),
}));

vi.mock("@/lib/relay/queue.server", () => ({
  getRelayHeartbeat: () => mocks.heartbeat,
  isRelayAlive: (heartbeat: { last_seen_at: string } | null, now: Date) =>
    heartbeat !== null && now.getTime() - new Date(heartbeat.last_seen_at).getTime() <= 2 * 60_000,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: (value: unknown) => {
        mocks.updates.push(value);
        return { eq: () => ({ error: null }) };
      },
    }),
  }),
}));

import { checkRelayHeartbeat } from "./monitor.server";

describe("relay monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.heartbeat = null;
    mocks.updates = [];
    process.env.INNOVERA_RELAY_MODE = "queue";
    process.env.CHATWORK_API_TOKEN = "cw";
    process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID = "room";
  });

  it("does nothing outside queue mode", async () => {
    process.env.INNOVERA_RELAY_MODE = "direct";
    await expect(checkRelayHeartbeat(new Date("2026-10-14T00:00:00Z"))).resolves.toMatchObject({ checked: false });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("sends one down notification and records notified_down_at", async () => {
    mocks.heartbeat = { last_seen_at: "2026-10-14T00:00:00Z", notified_down_at: null };
    await expect(checkRelayHeartbeat(new Date("2026-10-14T00:06:00Z"))).resolves.toMatchObject({ status: "down_notified" });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.updates[0]).toMatchObject({ notified_down_at: "2026-10-14T00:06:00.000Z" });
  });

  it("does not repeat a down notification and sends recovery once", async () => {
    mocks.heartbeat = { last_seen_at: "2026-10-14T00:00:00Z", notified_down_at: "2026-10-14T00:06:00Z" };
    await checkRelayHeartbeat(new Date("2026-10-14T00:07:00Z"));
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    mocks.heartbeat = { last_seen_at: "2026-10-14T00:08:30Z", notified_down_at: "2026-10-14T00:06:00Z" };
    await expect(checkRelayHeartbeat(new Date("2026-10-14T00:09:00Z"))).resolves.toMatchObject({ status: "recovered" });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.updates[0]).toMatchObject({ notified_down_at: null });
  });
});
