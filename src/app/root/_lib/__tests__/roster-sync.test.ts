import { describe, expect, it } from "vitest";
import { buildRosterSnapshot, existingNumberKey, mapRosterRecordToProfilePayloads, mapRosterRecordToRoot, normalizeEmployeeNumber, normalizeEmploymentType, roleFromRoster } from "../roster-sync.server";
import type { KintoneRecord } from "@/lib/kintone/records";

function record(values: Record<string, unknown>): KintoneRecord {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
}

type MemoryTable = {
  rootEmployees: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  history: Record<string, unknown>[];
  myNumbers: Record<string, unknown>[];
  logs: Record<string, unknown>[];
};

function memorySupabase(tables: MemoryTable) {
  const tableApi = (table: string) => {
    if (table === "root_employees") {
      return {
        select: () => Promise.resolve({ data: tables.rootEmployees, error: null }),
        insert: (row: Record<string, unknown>) => { tables.rootEmployees.push(row); return Promise.resolve({ error: null }); },
        update: (patch: Record<string, unknown>) => ({
          eq: (_key: string, employeeId: string) => {
            const row = tables.rootEmployees.find((item) => item.employee_id === employeeId);
            if (row) Object.assign(row, patch);
            return Promise.resolve({ error: null });
          },
        }),
      };
    }
    if (table === "root_employee_roster_snapshot") {
      return {
        select: () => ({
          eq: (_key: string, employeeId: string) => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: tables.snapshots.filter((row) => row.employee_id === employeeId).at(-1) ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => { tables.snapshots.push(row); return Promise.resolve({ error: null }); },
      };
    }
    if (table === "root_employee_profile_history") {
      return {
        select: () => ({
          eq: (key: string, value: string) => {
            const first = tables.history.filter((row) => row[key] === value);
            return {
              eq: (key2: string, value2: string) => {
                const second = first.filter((row) => row[key2] === value2);
                const tail = (rows: Record<string, unknown>[]) => ({
                  order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: rows.at(-1) ?? null, error: null }) }) }),
                });
                return { ...tail(second), eq: (key3: string, value3: string) => tail(second.filter((row) => row[key3] === value3)) };
              },
            };
          },
        }),
        insert: (row: Record<string, unknown>) => { tables.history.push(row); return Promise.resolve({ error: null }); },
      };
    }
    if (table === "root_employee_my_numbers") {
      return {
        select: () => ({
          eq: (_key: string, employeeId: string) => ({
            maybeSingle: () => Promise.resolve({ data: tables.myNumbers.find((row) => row.employee_id === employeeId) ?? null, error: null }),
          }),
        }),
        upsert: (row: Record<string, unknown>) => {
          const current = tables.myNumbers.find((item) => item.employee_id === row.employee_id);
          if (current) Object.assign(current, row); else tables.myNumbers.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "root_employee_roster_field_labels") {
      return { upsert: () => Promise.resolve({ error: null }) };
    }
    if (table === "root_roster_sync_log") {
      return { insert: (row: Record<string, unknown>) => { tables.logs.push(row); return Promise.resolve({ error: null }); } };
    }
    return {};
  };
  return {
    from: tableApi,
    auth: { admin: { createUser: async () => ({ data: { user: { id: `user-${tables.rootEmployees.length + 1}` } }, error: null }), updateUserById: async () => ({ data: null, error: null }) } },
  } as never;
}

describe("Root の社員番号と名簿から作る番号のそろえ方", () => {
  it("打刻 ID の無い人の R 番号は 4 桁に詰めない（詰めると毎朝 84 人が新規扱いになり同期が止まる）", () => {
    for (const recordId of ["1", "10", "99", "112"]) {
      const fromRoster = normalizeEmployeeNumber(record({ 打刻ID: "", $id: recordId }));
      expect(fromRoster).toBe(`R${recordId}`);
      expect(existingNumberKey(`R${recordId}`)).toBe(fromRoster);
    }
  });

  it("数字だけの社員番号は 4 桁にそろえ、5 桁以上はそのまま", () => {
    expect(existingNumberKey("8")).toBe("0008");
    expect(existingNumberKey("1530")).toBe("1530");
    expect(existingNumberKey("999990")).toBe("999990");
    expect(existingNumberKey(normalizeEmployeeNumber(record({ 打刻ID: "8" })))).toBe("0008");
  });
});

describe("roster sync mapping", () => {
  it("normalizes employment type values including officer", () => {
    expect(normalizeEmploymentType("役員")).toBe("役員");
    expect(normalizeEmploymentType("パート")).toBe("アルバイト");
    expect(normalizeEmploymentType("外注")).toBe("outsource");
    expect(normalizeEmploymentType("")).toBe("正社員");
  });

  it("maps roster fields to root employee columns without overriding protected existing values", () => {
    const mapped = mapRosterRecordToRoot(record({
      社員番号: "1530",
      従業員名_姓名: "神田 七星",
      従業員名_姓名カナ: "カンダ ナナセ",
      生年月日: "2001-05-02",
      入社日: "2026-05-01",
      退職日: "",
      従業員ステータス: "在籍中",
      雇用形態: "アルバイト",
      基準時給: "1500",
      打刻ID: "1530",
      交通費_片道: "500",
    }), {
      employee_id: "EMP-1530",
      employee_number: "1530",
      name: "old",
      name_kana: "old",
      company_id: "COMP-001",
      employment_type: "アルバイト",
      salary_system_id: "SAL-SYS-001",
      hire_date: "2026-01-01",
      termination_date: null,
      email: "",
      kot_employee_id: null,
      commute_daily_allowance: 1200,
      garden_role: "manager",
      garden_role_manual: true,
      user_id: "user-1",
      is_active: true,
      birthday: null,
    }, "2026-09-09");

    expect(mapped).toMatchObject({
      employee_id: "EMP-1530",
      employee_number: "1530",
      name: "神田 七星",
      birthday: "2001-05-02",
      hire_date: "2026-05-01",
      commute_daily_allowance: 1200,
      garden_role: "manager",
      is_active: true,
    });
  });

  it("uses retirement date in active calculation", () => {
    const mapped = mapRosterRecordToRoot(record({
      社員番号: "0077",
      打刻ID: "1078",
      従業員名_姓名: "松本 美菜里",
      退職日: "2026-09-09",
      従業員ステータス: "在籍中",
    }), null, "2026-09-09");
    expect(mapped.is_active).toBe(false);
  });

  it("keeps officer employment type from the roster without changing active calculation", () => {
    const mapped = mapRosterRecordToRoot(record({
      社員番号: "0000",
      打刻ID: "0000",
      従業員名_姓名: "後道 翔太",
      従業員ステータス: "在籍中",
      雇用形態: "役員",
      入社日: "2026-04-01",
    }), null, "2026-09-16");

    expect(mapped).toMatchObject({
      employee_id: "EMP-0000",
      employment_type: "役員",
      is_active: true,
    });
  });

  it("assigns part-time roles from base wage with the 1500 yen training exception", () => {
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1450" }))).toBe("closer");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1500" }))).toBe("toss");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1300" }))).toBe("toss");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1600", チーム名: "バックヤード" }))).toBe("staff");
  });

  it("treats officer as a staff role when no existing role is present", () => {
    expect(roleFromRoster(record({ 雇用形態: "役員", 基準時給: "1600" }))).toBe("staff");
  });
});

describe("roster employee number key", () => {
  it("uses the KOT punch id (same numbering as Root) and never the roster 社員番号", () => {
    expect(normalizeEmployeeNumber(record({ 社員番号: "0091", 打刻ID: "1165" }))).toBe("1165");
    expect(normalizeEmployeeNumber(record({ 社員番号: "0091", 打刻ID: "8" }))).toBe("0008");
  });
  it("registers rows without a punch id as history keyed by the roster record id", () => {
    expect(normalizeEmployeeNumber(record({ 社員番号: "0012", 打刻ID: "", $id: "374" }))).toBe("R374");
    expect(normalizeEmployeeNumber(record({ 社員番号: "0012" }))).toBe("");
  });
});

describe("roster duplicate punch ids", () => {
  it("keeps the active (rehired) row when the same punch id appears twice", async () => {
    const { syncRootRoster } = await import("../roster-sync.server");
    const records = [
      record({ $id: "10", 打刻ID: "1354", 従業員名_姓名: "林 佳音", 従業員ステータス: "退職済み", 退職日: "2023-07-31", 入社日: "2021-01-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02" }),
      record({ $id: "500", 打刻ID: "1354", 従業員名_姓名: "林 佳音", 従業員ステータス: "在籍中", 退職日: "", 入社日: "2026-04-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02" }),
    ];
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "test-token";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    const inserted: Record<string, unknown>[] = [];
    const supabase = {
      from: (table: string) => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: (row: Record<string, unknown>) => { if (table === "root_employees") inserted.push(row); return Promise.resolve({ error: null }); },
      }),
      auth: { admin: { createUser: async () => ({ data: { user: { id: "user-new" } }, error: null }), updateUserById: async () => ({ data: null, error: null }) } },
    } as never;
    const fetchStub = () => Promise.resolve(new Response(JSON.stringify({ records }), { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchStub as typeof fetch;
    try {
      const summary = await syncRootRoster({ dryRun: false, supabase, now: new Date("2026-09-09T03:00:00Z") });
      expect(summary.created).toBe(1);
      expect(inserted[0]).toMatchObject({ employee_number: "1354", is_active: true, hire_date: "2026-04-01" });
      expect(summary.errors.some((e) => e.includes("重複"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("roster profile history payloads", () => {
  it("masks my number in snapshots and never puts the number into history payloads", () => {
    const source = record({
      $id: "100",
      マイナンバー: "123456789012",
      郵便番号: "123-4567",
      連絡先: "090-1111-2222",
      メールアドレス: "test@example.com",
      銀行名_1: "庭銀行",
      口座番号_1: "1234567",
      交通費_片道: "500",
      入社日: "2026-04-01",
    });

    expect(buildRosterSnapshot(source).マイナンバー).toBe("***");
    const payloads = mapRosterRecordToProfilePayloads(source, "2026-09-14T00:00:00.000Z");
    expect(payloads.find((item) => item.category === "address")?.payload.postal_code).toBe("1234567");
    expect(payloads.find((item) => item.category === "contact")?.payload.phone).toBe("09011112222");
    expect(payloads.find((item) => item.category === "my_number_status")?.payload).toEqual({
      submitted: true,
      source: "roster",
      imported_at: "2026-09-14T00:00:00.000Z",
    });
    expect(JSON.stringify(payloads)).not.toContain("123456789012");
  });

  it("covers the profile keys defined by the design mapping", () => {
    const payloads = mapRosterRecordToProfilePayloads(record({
      郵便番号: "1234567",
      文字列__1行_: "東京都",
      文字列__1行__0: "中央区",
      文字列__1行__2: "銀座",
      文字列__1行__3: "庭ビル",
      文字列__1行__4: "101",
      住所: "東京都中央区銀座",
      連絡先: "090-1111-2222",
      連絡先_ハイフンなし: "09011112222",
      文字列__1行__15: "080-1111-2222",
      文字列__1行__16: "080-3333-4444",
      文字列__1行__17: "080-5555-6666",
      メールアドレス: "test@example.com",
      銀行名_1: "庭銀行",
      金融機関コード_1: "0001",
      文字列__1行__18: "本店",
      支店コード_1: "001",
      口座番号_1: "1234567",
      文字列__1行__9: "ニワ タロウ",
      種別: "普通",
      交通費_片道: "100",
      交通費_往復: "200",
      交通費上限: "5000",
      ドロップダウン_3: "銀座",
      文字列__1行__6: "銀座線",
      ドロップダウン_1: "支給",
      雇用形態: "アルバイト",
      入社日: "2026-04-01",
      ドロップダウン: "Root",
      ドロップダウン_0: "営業",
      ドロップダウン_15: "本部",
      チーム名: "A",
      配属・異動_1: "時給",
      基準時給: "1400",
      数値_0: "1200",
      数値: "10",
      ドロップダウン_8: "対象",
      ドロップダウン_5: "加入",
      ドロップダウン_4: "加入",
      雇用保険番号: "E1",
      文字列__1行__8: "P1",
      ドロップダウン_6: "希望",
      ドロップダウン_16: "通常",
    }), "2026-09-14T00:00:00.000Z");

    expect(Object.keys(payloads.find((item) => item.category === "address")?.payload ?? {})).toEqual(["postal_code", "prefecture", "city", "town", "building", "room", "full"]);
    expect(Object.keys(payloads.find((item) => item.category === "contact")?.payload ?? {})).toEqual(["phone", "phone_1", "phone_2", "phone_3", "email"]);
    expect(Object.keys(payloads.find((item) => item.category === "bank_account")?.payload ?? {})).toEqual(["bank_name", "bank_code", "branch_name", "branch_code", "account_type", "account_number", "holder_kana", "slot"]);
    expect(Object.keys(payloads.find((item) => item.category === "commute")?.payload ?? {})).toEqual(["one_way", "round_trip", "monthly_cap", "nearest_station", "route", "paid"]);
    expect(Object.keys(payloads.find((item) => item.category === "employment")?.payload ?? {})).toEqual([
      "employment_type",
      "hire_date",
      "business",
      "department",
      "affiliation",
      "team",
      "salary_system",
      "base_hourly",
      "training_hourly",
      "training_cap",
      "year_end_adjustment",
      "social_insurance",
      "employment_insurance",
      "employment_insurance_no",
      "pension_no",
      "advance_pay",
      "call_type",
    ]);
  });
});

describe("roster profile history sync", () => {
  it("does not add snapshot or history rows when the same roster record is synced twice", async () => {
    const { syncRootRoster } = await import("../roster-sync.server");
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "test-token";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    delete process.env.KINTONE_BANK_ACCOUNTS_APP_ID;
    delete process.env.KINTONE_BANK_ACCOUNTS_TOKEN;
    const roster = [record({
      $id: "10",
      レコード番号: "10",
      打刻ID: "1354",
      従業員名_姓名: "林 佳音",
      従業員名_姓名カナ: "ハヤシ カノン",
      従業員ステータス: "在籍中",
      入社日: "2026-04-01",
      雇用形態: "アルバイト",
      生年月日: "2000-01-02",
      郵便番号: "123-4567",
      連絡先: "090-1111-2222",
      メールアドレス: "test@example.com",
      銀行名_1: "庭銀行",
      口座番号_1: "1234567",
      交通費_片道: "500",
      マイナンバー: "123456789012",
    })];
    const tables: MemoryTable = { rootEmployees: [], snapshots: [], history: [], myNumbers: [], logs: [] };
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string | URL | Request) => {
      const textUrl = String(url);
      if (textUrl.includes("app/form/fields.json")) return Promise.resolve(new Response(JSON.stringify({ properties: { 連絡先: { code: "連絡先", label: "連絡先", type: "SINGLE_LINE_TEXT" } } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ records: roster }), { status: 200 }));
    }) as typeof fetch;
    try {
      const first = await syncRootRoster({ dryRun: false, supabase: memorySupabase(tables), now: new Date("2026-09-14T00:00:00Z") });
      const second = await syncRootRoster({ dryRun: false, supabase: memorySupabase(tables), now: new Date("2026-09-14T00:00:00Z") });
      expect(first.snapshotRows).toBe(1);
      expect(first.historyRows).toBeGreaterThan(0);
      expect(first.myNumberRows).toBe(1);
      expect(second.snapshotRows).toBe(0);
      expect(second.historyRows).toBe(0);
      expect(second.myNumberRows).toBe(0);
      expect(tables.snapshots).toHaveLength(1);
      expect(JSON.stringify(tables.history)).not.toContain("123456789012");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("dry-run counts rows without writing them and excludes retirees older than 90 days", async () => {
    const { syncRootRoster } = await import("../roster-sync.server");
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "test-token";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    delete process.env.KINTONE_BANK_ACCOUNTS_APP_ID;
    delete process.env.KINTONE_BANK_ACCOUNTS_TOKEN;
    const roster = [
      record({ $id: "10", 打刻ID: "1354", 従業員名_姓名: "在籍 太郎", 従業員ステータス: "在籍中", 入社日: "2026-04-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02", 連絡先: "090-1111-2222" }),
      record({ $id: "11", 打刻ID: "1355", 従業員名_姓名: "退職 花子", 従業員ステータス: "退職済み", 退職日: "2026-05-01", 入社日: "2025-04-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02", 連絡先: "090-3333-4444" }),
    ];
    const tables: MemoryTable = { rootEmployees: [], snapshots: [], history: [], myNumbers: [], logs: [] };
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string | URL | Request) => {
      if (String(url).includes("app/form/fields.json")) return Promise.resolve(new Response(JSON.stringify({ properties: {} }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ records: roster }), { status: 200 }));
    }) as typeof fetch;
    try {
      const result = await syncRootRoster({ dryRun: true, supabase: memorySupabase(tables), now: new Date("2026-09-14T00:00:00Z") });
      expect(result.snapshotRows).toBe(1);
      expect(result.historyRows).toBeGreaterThan(0);
      expect(tables.rootEmployees).toHaveLength(0);
      expect(tables.snapshots).toHaveLength(0);
      expect(tables.history).toHaveLength(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("imports the latest bank-list row per employee matched by name (KOTID only as fallback) and skips unmatched rows", async () => {
    const { syncRootRoster } = await import("../roster-sync.server");
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "test-token";
    process.env.KINTONE_BANK_ACCOUNTS_TOKEN = "bank-token";
    process.env.KINTONE_BANK_ACCOUNTS_APP_ID = "92";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    const roster = [record({ $id: "10", 打刻ID: "1354", 従業員名_姓名: "在籍 太郎", 従業員ステータス: "在籍中", 入社日: "2026-04-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02" })];
    const bankRows = [
      record({ $id: "1", レコード番号: "1", 文字列__1行__0: "在籍　太郎", ルックアップ_0: "", 更新日時: "2026-09-01T00:00:00Z", 支払日: "2026-09-20", 銀行名: "古い銀行", 支店名: "古い支店", 口座番号: "1111111", 種別: "普通", 口座名義カナ: "テスト" }),
      record({ $id: "2", レコード番号: "2", 文字列__1行__0: "在籍 太郎", ルックアップ_0: "", 更新日時: "2026-09-10T00:00:00Z", 支払日: "2026-09-25", 銀行名: "新しい銀行", 支店名: "新しい支店", 口座番号: "2222222", 種別: "当座", 口座名義カナ: "テスト" }),
      record({ $id: "3", レコード番号: "3", 文字列__1行__0: "別人 花子", ルックアップ_0: "", 更新日時: "2026-09-10T00:00:00Z" }),
    ];
    const tables: MemoryTable = { rootEmployees: [], snapshots: [], history: [], myNumbers: [], logs: [] };
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string | URL | Request) => {
      const textUrl = String(url);
      if (textUrl.includes("app/form/fields.json")) return Promise.resolve(new Response(JSON.stringify({ properties: {} }), { status: 200 }));
      if (textUrl.includes("app=92")) return Promise.resolve(new Response(JSON.stringify({ records: bankRows }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ records: roster }), { status: 200 }));
    }) as typeof fetch;
    try {
      const result = await syncRootRoster({ dryRun: false, supabase: memorySupabase(tables), now: new Date("2026-09-14T00:00:00Z") });
      const bankHistory = tables.history.filter((row) => row.source === "bank_list");
      expect(result.bankListRows).toBe(1);
      expect(result.bankListSkipped).toBe(1);
      expect(bankHistory).toHaveLength(1);
      expect(bankHistory[0].payload).toMatchObject({ bank_name: "新しい銀行", account_type: "current", account_number: "2222222" });

      // 2 回目の同期：名簿も口座一覧も変わっていなければ、名簿の口座行を足し直さない（最新行が bank_list でも roster 行は同じ出どころの最新行と比べる）
      const before = tables.history.length;
      const second = await syncRootRoster({ dryRun: false, supabase: memorySupabase(tables), now: new Date("2026-09-15T00:00:00Z") });
      expect(second.historyRows).toBe(0);
      expect(tables.history.length).toBe(before);

      // 事務入力（admin）が最新でも、名簿の値が変わっていなければ roster 行は足さない＝事務の決定が上書きされない
      tables.history.push({ employee_id: tables.rootEmployees[0].employee_id, category: "bank_account", payload: { bank_name: "事務が決めた銀行", account_number: "9999999", slot: 1 }, source: "admin", source_ref: "chat", effective_from: "2026-09-15", recorded_by: "claude", recorded_at: "2026-09-15T01:00:00Z" });
      const third = await syncRootRoster({ dryRun: false, supabase: memorySupabase(tables), now: new Date("2026-09-16T00:00:00Z") });
      expect(third.historyRows).toBe(0);
      expect(tables.history.at(-1)?.source).toBe("admin");
    } finally {
      globalThis.fetch = original;
    }
  });
});
