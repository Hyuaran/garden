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

describe("changeBirthdayWithPassword - WRONG_PASSWORD", () => {
  it("現パス検証が失敗したら WRONG_PASSWORD", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    let createClientCalls = 0;
    mockedCreateClient.mockImplementation(() => {
      createClientCalls += 1;
      return (createClientCalls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    admin.from.mockImplementation(() => employeesFrom);
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "wrong-pass",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("WRONG_PASSWORD");
  });
});

describe("changeBirthdayWithPassword - RATE_LIMITED", () => {
  function setupSuccessUntilRateCheck() {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });
    return { anon, verifyClient };
  }

  it("直近 10 分以内に password_change 履歴があれば RATE_LIMITED", async () => {
    setupSuccessUntilRateCheck();
    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const auditFrom = buildFrom();
    auditFrom.maybeSingle.mockResolvedValue({
      data: { audit_id: 999 },
      error: null,
    });
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") return employeesFrom;
      if (table === "root_audit_log") return auditFrom;
      return buildFrom();
    });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("RATE_LIMITED");
  });
});

describe("changeBirthdayWithPassword - TRANSACTION_FAILED + 補償", () => {
  it("Auth password 更新が失敗したら birthday が旧値に巻き戻る", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate1 = buildFrom();
    employeesUpdate1.eq.mockResolvedValue({ error: null });
    const employeesUpdateRollback = buildFrom();
    employeesUpdateRollback.eq.mockResolvedValue({ error: null });

    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });

    let employeesCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        if (employeesCalls === 1) return employeesSelect;
        if (employeesCalls === 2) return employeesUpdate1;
        return employeesUpdateRollback;
      }
      if (table === "root_audit_log") return auditSelect;
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({
      error: { message: "Auth update failed" },
    });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("TRANSACTION_FAILED");
    }
    // 補償 UPDATE が呼ばれたこと
    expect(employeesUpdateRollback.update).toHaveBeenCalledWith({
      birthday: "1990-05-07",
    });
  });
});

describe("changeBirthdayWithPassword - 監査ログ best-effort", () => {
  it("audit log insert が失敗しても success を返す", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate = buildFrom();
    employeesUpdate.eq.mockResolvedValue({ error: null });
    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });
    const auditInsert = buildFrom();
    auditInsert.insert.mockResolvedValue({
      error: { message: "audit log insert failed" },
    });

    let employeesCalls = 0;
    let auditCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        return employeesCalls === 1 ? employeesSelect : employeesUpdate;
      }
      if (table === "root_audit_log") {
        auditCalls += 1;
        return auditCalls === 1 ? auditSelect : auditInsert;
      }
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("changeBirthdayWithPassword - 成功パス", () => {
  it("birthday UPDATE → Auth password 更新 → audit log INSERT が順に成功すれば success: true", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();

    // root_employees: select で現 birthday、update で新 birthday
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate = buildFrom();
    employeesUpdate.eq.mockResolvedValue({ error: null });

    // root_audit_log: rate-limit 用 select は null、insert は成功
    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });
    const auditInsert = buildFrom();
    auditInsert.insert.mockResolvedValue({ error: null });

    let employeesCalls = 0;
    let auditCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        return employeesCalls === 1 ? employeesSelect : employeesUpdate;
      }
      if (table === "root_audit_log") {
        auditCalls += 1;
        return auditCalls === 1 ? auditSelect : auditInsert;
      }
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(true);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "user-123",
      { password: "1203" },
    );
    expect(auditInsert.insert).toHaveBeenCalled();
  });
});
