import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  pushLineStaff: vi.fn(),
  getLineStaffQuota: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/lib/line/staff-client", () => ({
  pushLineStaff: mocks.pushLineStaff,
  getLineStaffQuota: mocks.getLineStaffQuota,
}));

function request(body: unknown) {
  return new Request("http://localhost/api/system/shukkin/line-send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function supabaseForLineSend(rootRows: unknown[]) {
  const inserts: unknown[] = [];
  let hadIn = false;
  const rootBuilder = {
    select: vi.fn(() => rootBuilder),
    in: vi.fn(() => {
      hadIn = true;
      return rootBuilder;
    }),
    eq: vi.fn(() => rootBuilder),
    is: vi.fn(() => {
      if (hadIn) {
        hadIn = false;
        return Promise.resolve({ data: rootRows, error: null });
      }
      return rootBuilder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { line_user_id: "U-self", line_link_source: "self" }, error: null })),
  };
  return {
    inserts,
    client: {
      from: vi.fn((table: string) => {
        if (table === "root_employees") return rootBuilder;
        return { insert: vi.fn((row: unknown) => {
          inserts.push(row);
          return Promise.resolve({ data: null, error: null });
        }) };
      }),
    },
  };
}

describe("/api/system/shukkin/line-send", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireStaff.mockResolvedValue({ employee_id: "EMP-0001", employee_number: "0001", name: "本人" });
    mocks.getLineStaffQuota.mockResolvedValue({ quota: 200, used: 10, remaining: 190 });
    mocks.pushLineStaff.mockResolvedValue(undefined);
  });

  it("returns quota and the preview state", async () => {
    const db = supabaseForLineSend([
      { employee_id: "EMP-1568", employee_number: "1568", name: "中山 聖也", line_user_id: "U1568", line_link_source: "self" },
      { employee_id: "EMP-0008", employee_number: "0008", name: "別の人", line_user_id: null, line_link_source: null },
    ]);
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/shukkin/line-send?needed=2&employeeNumber=1568&employeeNumber=8"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ quota: 200, used: 10, remaining: 190, needed: 2, ownLinked: true });
    expect(body.members).toEqual([
      { employeeNumber: "1568", name: "中山 聖也", linked: true, blocked: false },
      { employeeNumber: "0008", name: "別の人", linked: false, blocked: false },
    ]);
  });

  it("sends one multicast per block and records sent and unlinked rows", async () => {
    const db = supabaseForLineSend([
      { employee_id: "EMP-1568", employee_number: "1568", name: "中山 聖也", line_user_id: "U1568", line_link_source: "self" },
      { employee_id: "EMP-0008", employee_number: "0008", name: "別の人", line_user_id: null, line_link_source: null },
    ]);
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(request({
      date: "2026-10-15",
      blocks: [{ shift: "14-21", employeeNumbers: ["1568", "8"], message: "本文" }],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.pushLineStaff).toHaveBeenCalledTimes(1);
    expect(mocks.pushLineStaff).toHaveBeenCalledWith(["U1568"], "本文");
    expect(body.sent).toHaveLength(1);
    expect(body.unlinked).toHaveLength(1);
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts).toEqual(expect.arrayContaining([
      expect.objectContaining({ employee_number: "1568", status: "sent" }),
      expect.objectContaining({ employee_number: "0008", status: "unlinked" }),
    ]));
  });

  it("sends test messages only to the current staff LINE", async () => {
    const db = supabaseForLineSend([]);
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(request({
      date: "2026-10-15",
      testOnly: true,
      blocks: [{ shift: "14-21", employeeNumbers: ["1568"], message: "本文" }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.pushLineStaff).toHaveBeenCalledWith(["U-self"], "【14-21】\n本文");
    expect(db.inserts).toEqual([expect.objectContaining({ shift: "試し送り", employee_number: "0001", status: "sent" })]);
  });

  // 試し送りはまとまりが複数でも 1 通にまとめる（2026-10-14 東海林さん「テスト送信は 1 通でいい」）
  it("試し送りは全まとまりを 1 通にまとめて送る", async () => {
    const db = supabaseForLineSend([]);
    mocks.getSupabaseAdmin.mockReturnValue(db.client);
    const { POST } = await import("./route");

    const response = await POST(request({
      date: "2026-10-15",
      testOnly: true,
      blocks: [
        { shift: "14-21", employeeNumbers: ["1568"], message: "本文A" },
        { shift: "17-21", employeeNumbers: ["1569"], message: "本文B" },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.pushLineStaff).toHaveBeenCalledTimes(1);
    expect(mocks.pushLineStaff).toHaveBeenCalledWith(["U-self"], "【14-21】\n本文A\n\n――――――――\n\n【17-21】\n本文B");
    expect(db.inserts).toHaveLength(1);
  });

  // 送信パスワード（環境変数があるときだけ要求・課金までの歯止め）
  it("送信パスワードが違えば 403 で何も送らない", async () => {
    process.env.LINE_STAFF_SEND_PASSWORD = "1201";
    try {
      const db = supabaseForLineSend([]);
      mocks.getSupabaseAdmin.mockReturnValue(db.client);
      const { POST, GET } = await import("./route");
      const get = await GET(new Request("http://localhost/api/system/shukkin/line-send?needed=1"));
      expect((await get.json()).passwordRequired).toBe(true);

      const wrong = await POST(request({ date: "2026-10-15", testOnly: true, password: "0000", blocks: [{ shift: "14-21", employeeNumbers: ["1568"], message: "本文" }] }));
      expect(wrong.status).toBe(403);
      expect(mocks.pushLineStaff).not.toHaveBeenCalled();

      const right = await POST(request({ date: "2026-10-15", testOnly: true, password: "1201", blocks: [{ shift: "14-21", employeeNumbers: ["1568"], message: "本文" }] }));
      expect(right.status).toBe(200);
    } finally {
      delete process.env.LINE_STAFF_SEND_PASSWORD;
    }
  });
});
