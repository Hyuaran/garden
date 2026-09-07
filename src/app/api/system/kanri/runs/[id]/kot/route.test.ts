import iconv from "iconv-lite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

const HEADERS = [
  "従業員コード",
  "雇用区分",
  "名前",
  "日時（曜日なし）",
  "勤務日種別",
  "パターン名",
  "出勤予定時刻(時刻のみ)",
  "退勤予定時刻(時刻のみ)",
  "出勤打刻(丸め)(時刻のみ)",
  "退勤打刻(丸め)(時刻のみ)",
  "出勤時刻(時刻のみ)",
  "退勤時刻(時刻のみ)",
  "休憩時間",
  "労働予定時間",
  "労働合計時間",
  "所定時間",
  "遅刻時間",
  "早退時間",
  "労働時間予実差異",
];

function fileFromCsv(rows: string[][]) {
  const csv = [HEADERS, ...rows].map((row) => row.join(",")).join("\r\n");
  return new File([new Uint8Array(Array.from(iconv.encode(csv, "cp932")))], "kot.csv", { type: "text/csv" });
}

function formWith(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function requestWithForm(form: FormData) {
  return { formData: () => Promise.resolve(form) } as Request;
}

function mockAdmin() {
  const calls = {
    deleted: false,
    inserted: [] as unknown[],
    upserted: null as unknown,
    updated: null as unknown,
  };
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "system_kanri_run") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-09-01", summary: { total: 1 } }, error: null }),
            }),
            gte: () => ({
              lte: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [{ id: "run-1", target_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z" }], error: null }),
                }),
              }),
            }),
          }),
          update: (row: unknown) => {
            calls.updated = row;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "system_kanri_person") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [{
                  name: "山田　花子",
                  kot_name: "山田 花子",
                  team: "Aチーム",
                  department: "Aチーム",
                  employment_kind: "アルバイト",
                  base_wage: 1400,
                  is_field_sales: false,
                  active: true,
                  sort_order: 10,
                }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "system_kanri_result") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: { grid: { hoursByTeamByDate: { Aチーム: { "2026-09-01": 1 } }, openRateByTeamByProduct: {} } }, error: null }),
                  }),
                }),
              }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          upsert: (row: unknown) => {
            calls.upserted = row;
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        delete: () => ({
          eq: () => ({
            eq: () => {
              calls.deleted = true;
              return Promise.resolve({ error: null });
            },
          }),
        }),
        insert: (rows: unknown[]) => {
          calls.inserted = rows;
          return Promise.resolve({ error: null });
        },
      };
    }),
  };
  return { admin, calls };
}

describe("system kanri KOT daily route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/kot", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects files with a different layout", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const { admin } = mockAdmin();
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { POST } = await import("./route");

    const response = await POST(requestWithForm(formWith(new File(["bad"], "bad.csv"))), { params: Promise.resolve({ id: "run-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Garden管理表ポータル（日）");
  });

  it("replaces KOT rows and saves the calculated inputs", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const { admin, calls } = mockAdmin();
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { POST } = await import("./route");
    const file = fileFromCsv([["001", "アルバイト", "山田 花子", "2026/09/01", "平日", "14-21", "14:00", "21:00", "14:00", "21:00", "14:00", "21:00", "0.00", "7.00", "7.00", "7.00", "0.00", "0.00", "0.00"]]);

    const response = await POST(requestWithForm(formWith(file)), { params: Promise.resolve({ id: "run-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(calls.deleted).toBe(true);
    expect(calls.inserted).toHaveLength(1);
    expect(JSON.stringify(calls.upserted)).toContain("kotDaily");
    expect(body.inputs.hoursByTeamByDate.Aチーム["2026-09-01"]).toBe(7);
  });
});
