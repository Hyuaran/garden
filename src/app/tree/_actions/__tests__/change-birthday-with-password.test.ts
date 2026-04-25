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
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
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
