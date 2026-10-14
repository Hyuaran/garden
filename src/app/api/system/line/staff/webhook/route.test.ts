import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  replyLineStaff: vi.fn(),
  getLineStaffProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
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

describe("/api/system/line/staff/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    process.env.LINE_STAFF_CHANNEL_SECRET = "secret";
    mocks.replyLineStaff.mockResolvedValue(undefined);
    mocks.getLineStaffProfile.mockResolvedValue({ displayName: "LINE表示名" });
  });

  it("rejects invalid signatures", async () => {
    const { POST } = await import("./route");

    const response = await POST(signedRequest({ events: [] }, "bad"));

    expect(response.status).toBe(401);
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
    expect(mocks.replyLineStaff).toHaveBeenCalledWith("reply-token", "中山 聖也さんとして登録しました。ありがとうございます。");
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
});
