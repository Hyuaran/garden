import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock('@/lib/line/richmenu.server',()=>({syncRichMenus:vi.fn(async()=>{})}));

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  replyLineStaff: vi.fn(),
  getLineStaffProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock('@/lib/line/tags.server', () => ({ linkedGreeting: vi.fn(async () => 'あいさつ文') }));
vi.mock("@/lib/line/staff-client", () => ({
  replyLineStaff: mocks.replyLineStaff,
  getLineStaffProfile: mocks.getLineStaffProfile,
}));

function signedRequest(body: unknown, signature = sign(JSON.stringify(body))) {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/system/line/staff/webhook", {
    method: "POST",
    headers: { "x-line-signature": signature },
    body: raw,
  });
}

it('友だち追加では短いお礼だけを同じ返信で返す', async () => {
  process.env.LINE_STAFF_CHANNEL_SECRET='secret';
  mocks.replyLineStaff.mockResolvedValue(undefined);
  const {POST}=await import('./route');
  await POST(signedRequest({events:[{type:'follow',replyToken:'follow-token'}]}));
  expect(mocks.replyLineStaff).toHaveBeenCalledWith('follow-token','友だち追加ありがとうございます。official｜通知です。');
});

function sign(raw: string) {
  return createHmac("sha256", "secret").update(raw).digest("base64");
}

function supabaseForSuccessfulLink() {
  const updates: unknown[] = [];
  const deletes: string[] = [];
  let rootFromCount = 0;
  return {
    updates,
    deletes,
    client: {
      from: vi.fn((table: string) => {
        if (table === "root_employees") {
          rootFromCount += 1;
          if (rootFromCount === 1) {
            const builder = {
              select: vi.fn(() => builder),
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              maybeSingle: vi.fn(() => Promise.resolve({
                data: { employee_id: "EMP-1568", employee_number: "1568", name: "中山 聖也", line_user_id: null },
                error: null,
              })),
            };
            return builder;
          }
          if (rootFromCount === 2) {
            const builder = {
              select: vi.fn(() => builder),
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            };
            return builder;
          }
          const builder = {
            update: vi.fn((row: unknown) => {
              updates.push(row);
              return builder;
            }),
            eq: vi.fn(() => builder),
            is: vi.fn(() => Promise.resolve({ data: null, error: null })),
          };
          return builder;
        }
        const builder = {
          delete: vi.fn(() => builder),
          eq: vi.fn((_: string, value: string) => {
            deletes.push(value);
            return Promise.resolve({ data: null, error: null });
          }),
        };
        return builder;
      }),
    },
  };
}

function supabaseForPending(lastSeenAt: string | null) {
  const upserts: unknown[] = [];
  return {
    upserts,
    client: {
      from: vi.fn((table: string) => {
        if (table === "root_employees") {
          const builder = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            neq: vi.fn(() => builder),
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          };
          return builder;
        }
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: lastSeenAt ? { last_seen_at: lastSeenAt, first_seen_at: "2026-10-12T01:00:00.000Z" } : null,
            error: null,
          })),
          upsert: vi.fn((row: unknown) => {
            upserts.push(row);
            return Promise.resolve({ data: null, error: null });
          }),
        };
        return builder;
      }),
    },
  };
}

describe("/api/system/line/staff/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    process.env.LINE_STAFF_CHANNEL_SECRET = "secret";
    mocks.replyLineStaff.mockResolvedValue(undefined);
    mocks.getLineStaffProfile.mockResolvedValue({ displayName: "LINE表示名" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects invalid signatures", async () => {
    const { POST } = await import("./route");

    const response = await POST(signedRequest({ events: [] }, "bad"));

    expect(response.status).toBe(401);
  });

  it.each([true, false])("使い切り番号の照合結果を返信する: %s", async linked => {
    const rpc = vi.fn().mockResolvedValue({ data: { linked, name: "太郎" }, error: null });
    mocks.getSupabaseAdmin.mockReturnValue({ rpc });
    const { POST } = await import("./route");
    await POST(signedRequest({ events: [{ type: "message", replyToken: "reply", source: { userId: "U-new" }, message: { type: "text", text: "連携　１５７１－４Ｋ７Ｐ" } }] }));
    expect(rpc).toHaveBeenCalledWith("system_consume_line_link_code", { p_employee_number: "1571", p_code: "4K7P", p_line_user_id: "U-new", p_display_name: "LINE表示名" });
    expect(mocks.replyLineStaff).toHaveBeenCalledWith("reply", linked ? ["太郎さんとして登録しました。ありがとうございます。", 'あいさつ文'] : "番号が違うか、期限が切れています。入社手続きの画面に出ている文をそのまま送ってください。");
  });

  it("links full-width employee numbers and replies with the roster name", async () => {
    const db = supabaseForSuccessfulLink();
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(signedRequest({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U1568" },
        message: { type: "text", text: "連携　１５６８" },
      }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.getLineStaffProfile).toHaveBeenCalledWith("U1568");
    expect(db.updates).toEqual([expect.objectContaining({ line_user_id: "U1568", line_display_name: "LINE表示名", line_link_source: "self" })]);
    expect(db.deletes).toEqual(["U1568"]);
    expect(mocks.replyLineStaff).toHaveBeenCalledWith("reply-token", ["中山 聖也さんとして登録しました。ありがとうございます。", 'あいさつ文']);
  });

  it("continues returning 200 when an event fails", async () => {
    mocks.getSupabaseAdmin.mockImplementation(() => {
      throw new Error("db down");
    });
    const { POST } = await import("./route");

    const response = await POST(signedRequest({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U1568" },
        message: { type: "text", text: "連携 1568" },
      }],
    }));

    expect(response.status).toBe(200);
  });
  it("does not repeat the link guide when last_seen_at is today in JST", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T00:30:00.000Z"));
    const db = supabaseForPending("2026-10-13T23:30:00.000Z");
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(signedRequest({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U1568" },
        message: { type: "text", text: "hello" },
      }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.replyLineStaff).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(1);
  });

  it("returns the link guide when last_seen_at is two days old in UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T00:30:00.000Z"));
    const db = supabaseForPending("2026-10-12T23:30:00.000Z");
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(signedRequest({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U1568" },
        message: { type: "text", text: "hello" },
      }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.replyLineStaff).toHaveBeenCalledWith("reply-token", expect.any(String));
    expect(db.upserts).toHaveLength(1);
  });
});
