import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/system/kanri/_lib/kanri-core", async () => {
  const actual = await vi.importActual<typeof import("@/app/system/kanri/_lib/kanri-core")>("@/app/system/kanri/_lib/kanri-core");
  return { ...actual, tokyoToday: () => "2026-09-06" };
});

function aporanGrid(targetDate = "2026-09-06") {
  const team = (key: string, label: string, actualPoints: number) => ({
    key,
    label,
    actualPoints,
    targetPoints: key === "all" ? 240 : 80,
    currentRequiredPoints: key === "all" ? 46.1 : 15.3,
    workHours: 100,
    landingHours: 200,
    efficiency: 0.05,
    landingPoints: 50,
    achievementRate: 0.5,
  });
  return {
    yearMonth: "2026-09",
    targetDate,
    teams: {
      all: team("all", "テレマ全体", 25),
      miyanaga: team("miyanaga", "宮永チーム", 7.1),
      koizumi: team("koizumi", "小泉チーム", 11),
      ishihara: team("ishihara", "石原チーム", 6.9),
      newcomer: team("newcomer", "新人チーム", 0),
    },
    teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
    ranking: [],
    cellValues: {},
  };
}

function adminMock(dataByTable: Record<string, unknown[]>) {
  const calls: Record<string, number> = {};
  return {
    from: vi.fn((table: string) => {
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => {
              calls[table] = calls[table] ?? 0;
              const next = dataByTable[table]?.[calls[table]++] ?? { data: null, error: null };
              return Promise.resolve(next);
            },
          };
          return chain;
        },
      };
    }),
  };
}

describe("kanri display route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireStaff.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below staff", async () => {
    mocks.requireStaff.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("returns empty when no calculation result exists", async () => {
    mocks.requireStaff.mockResolvedValue({ userId: "user-1" });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock({
      system_kanri_run: [
        { data: { id: "run-1", target_date: "2026-09-06", created_at: "2026-09-07T08:00:00Z" }, error: null },
      ],
      system_kanri_result: [
        { data: null, error: null },
      ],
    }));
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, empty: true, message: "まだ計算していません" });
  });

  it("returns the monitor rows from the latest aporan result", async () => {
    mocks.requireStaff.mockResolvedValue({ userId: "user-1" });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock({
      system_kanri_run: [
        { data: { id: "run-1", target_date: "2026-09-06", created_at: "2026-09-07T08:00:00Z" }, error: null },
      ],
      system_kanri_result: [
        { data: { run_id: "run-1", sheet: "aporan", grid: aporanGrid(), calculated_at: "2026-09-07T09:05:00Z" }, error: null },
        { data: { grid: { days: [{ date: "2026-09-06", day: 5 }] } }, error: null },
      ],
    }));
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe("9月6日(日)時点の成績　5/1稼働");
    expect(body.rows).toHaveLength(8);
    expect(body.rows[1].values).toEqual(["25.0P", "7.1P", "11.0P", "6.9P"]);
  });
});
