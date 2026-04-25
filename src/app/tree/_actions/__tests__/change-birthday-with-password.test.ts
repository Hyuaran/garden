import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(),
  };
});
vi.mock("@/lib/supabase/admin", () => {
  return {
    getSupabaseAdmin: vi.fn(),
  };
});

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { changeBirthdayWithPassword } from "../change-birthday-with-password";

const mockedCreateClient = vi.mocked(createClient);
const mockedGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

type AnonClientMock = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
  };
};
type AdminClientMock = {
  from: ReturnType<typeof vi.fn>;
  auth: { admin: { updateUserById: ReturnType<typeof vi.fn> } };
};

function buildAnonClient(): AnonClientMock {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  };
}
function buildAdminClient(): AdminClientMock {
  return {
    from: vi.fn(),
    auth: { admin: { updateUserById: vi.fn() } },
  };
}

type FromMock = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};
function buildFrom(): FromMock {
  const m: FromMock = {
    select: vi.fn().mockReturnThis() as never,
    update: vi.fn().mockReturnThis() as never,
    insert: vi.fn().mockReturnThis() as never,
    eq: vi.fn().mockReturnThis() as never,
    gte: vi.fn().mockReturnThis() as never,
    maybeSingle: vi.fn(),
  };
  return m;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
});

describe("changeBirthdayWithPassword - UNAUTHENTICATED", () => {
  it("無効な access_token なら UNAUTHENTICATED を返す", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(buildAdminClient() as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1990-05-07",
      currentPassword: "0507",
      accessToken: "bad-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });
});

describe("changeBirthdayWithPassword - INVALID_FORMAT", () => {
  function setupAuthenticated() {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(buildAdminClient() as never);
    return anon;
  }

  it("YYYY-MM-DD 形式以外なら INVALID_FORMAT", async () => {
    setupAuthenticated();
    const result = await changeBirthdayWithPassword({
      newBirthday: "1990/05/07",
      currentPassword: "0507",
      accessToken: "ok-token",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("未来日付なら INVALID_FORMAT", async () => {
    setupAuthenticated();
    // 2 日後（JST/UTC どちらの境界条件でも未来になる確実な値）
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = await changeBirthdayWithPassword({
      newBirthday: future,
      currentPassword: "0507",
      accessToken: "ok-token",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("INVALID_FORMAT");
  });
});

describe("changeBirthdayWithPassword - SAME_AS_CURRENT", () => {
  it("新誕生日が現誕生日と同じなら SAME_AS_CURRENT", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") return employeesFrom;
      return buildFrom();
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1990-05-07",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("SAME_AS_CURRENT");
  });
});
