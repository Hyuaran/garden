import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/app/rill/mail/_lib/token-crypto";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

const validToken = "0123456789abcdef0123456789abcdef";
const otherValidToken = "abcdefabcdefabcdefabcdefabcdefab";

function kintoneRecord(kot: string, token: string, status = "在籍中", num = kot, name = `氏名${kot}`) {
  return {
    "文字列__1行__1": { value: token },
    "打刻ID": { value: kot },
    "社員番号": { value: num },
    "従業員名_姓名": { value: name },
    "従業員ステータス": { value: status },
  };
}

describe("chatwork token sync", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getSupabaseAdmin.mockReset();
    process.env.RILL_TOKEN_ENC_KEY = "test-key";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "kintone-token";
  });

  it("validates only lowercase 32 character hex Chatwork tokens", async () => {
    const { isValidChatworkApiToken } = await import("./chatwork-token-sync.server");

    expect(isValidChatworkApiToken(validToken)).toBe(true);
    expect(isValidChatworkApiToken("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isValidChatworkApiToken("12345678901")).toBe(false);
    expect(isValidChatworkApiToken("ああ")).toBe(false);
  });

  it("imports only active roster rows matched by KoT ID and records skipped groups", async () => {
    const updates: unknown[] = [];
    const admin = {
      from: (table: string) => {
        expect(table).toBe("root_employees");
        return {
          select: () => ({
            is: () => Promise.resolve({
              data: [
                { employee_id: "emp-1", employee_number: "1001", name: "山田太郎", kot_employee_id: "1001", chatwork_api_token_enc: null },
                { employee_id: "emp-4", employee_number: "1004", name: "同一太郎", kot_employee_id: "1004", chatwork_api_token_enc: encryptToken(otherValidToken) },
              ],
              error: null,
            }),
          }),
          update: (payload: unknown) => {
            updates.push(payload);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    };
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("cybozu.com")) {
        return Response.json({ records: [
          kintoneRecord("1001", validToken, "在籍中", "1001", "山田太郎"),
          kintoneRecord("1002", "12345678901", "在籍中", "1002", "形式違い"),
          kintoneRecord("1003", validToken, "退職済み", "1003", "退職太郎"),
          kintoneRecord("9999", validToken, "在籍中", "9999", "Rootなし"),
          kintoneRecord("1004", otherValidToken, "在籍中", "1004", "同一太郎"),
        ] });
      }
      return Response.json({ name: "Chatwork 表示名" });
    }) as unknown as typeof fetch;
    const { syncChatworkTokens } = await import("./chatwork-token-sync.server");

    const result = await syncChatworkTokens({ fetchImpl });

    expect(result.imported).toBe(2);
    expect(result.created).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.invalidFormat).toEqual([{ employeeNumber: "1002", name: "形式違い", kotEmployeeId: "1002" }]);
    expect(result.missingRoot).toEqual([{ employeeNumber: "9999", name: "Rootなし", kotEmployeeId: "9999" }]);
    expect(result.retired).toBe(1);
    expect(updates).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(validToken);
  });

  it("does not import when Chatwork rejects the token", async () => {
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          is: () => Promise.resolve({
            data: [{ employee_id: "emp-1", employee_number: "1001", name: "山田太郎", kot_employee_id: "1001", chatwork_api_token_enc: null }],
            error: null,
          }),
        }),
        update: vi.fn(),
      }),
    });
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("cybozu.com")) return Response.json({ records: [kintoneRecord("1001", validToken)] });
      return new Response("no", { status: 401 });
    }) as unknown as typeof fetch;
    const { syncChatworkTokens } = await import("./chatwork-token-sync.server");

    const result = await syncChatworkTokens({ fetchImpl });

    expect(result.imported).toBe(0);
    expect(result.rejectedByChatwork).toHaveLength(1);
  });
});
