import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import KanriPortalClient from "./KanriPortalClient";

describe("KanriPortalClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows actual, point, and amount total rows in the calculated grid", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/calculate")) {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          grid: {
            yearMonth: "2026-09",
            products: ["商品"],
            teams: ["A"],
            days: [],
            totals: {
              all: { hours: 10, efficiency: 0.2, total: 2, points: 3, amount: 4000, pointEfficiency: 0.3, amountPerHour: 400 },
              teams: {
                A: {
                  hours: 10,
                  efficiency: 0.2,
                  total: 2,
                  points: 3,
                  amount: 4000,
                  products: { 商品: 2 },
                  pointsByProduct: { 商品: 3 },
                  amountByProduct: { 商品: 4000 },
                },
              },
            },
            openRate: { A: { 商品: 0.5 } },
            cellValues: {},
          },
          jisseki: {
            yearMonth: "2026-09",
            products: ["商品"],
            productColumns: [{ product: "商品", kind: "single", label: "商品" }],
            rows: [{ personName: "山田　花子", kotName: "山田 花子", wageLabel: "社員", department: "A", team: "A", landingHours: 1, workHours: 2, totalPoints: 3, efficiency: 1.5, workDays: 1, commuteDailyAllowance: 500, missingCommute: false, counts: { "商品:single": 2 } }],
            missingCommuteNames: [],
            cellValues: {},
          },
        }), { status: 200 }));
      }
      if (url.includes("/result")) return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify({ ok: true, inputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} } }), { status: 200 }));
    }));

    render(<KanriPortalClient
      creatorName="manager"
      today="2026-09-01"
      initialRuns={[{
        id: "run-1",
        target_date: "2026-09-01",
        mode: "daily",
        creator_name: "manager",
        status: "fetched",
        summary: null,
        warnings: null,
        started_at: null,
        finished_at: null,
        created_at: "2026-09-01T00:00:00Z",
      }]}
      initialHolidays={[]}
      initialProducts={["商品"]}
      initialTeams={["A"]}
      initialPeople={[]}
    />);

    const calculateButton = screen.getByRole("button", { name: "計算する" });
    expect(calculateButton).toBeTruthy();
    fireEvent.click(calculateButton);

    await waitFor(() => {
      expect(screen.getByText("実数")).toBeInTheDocument();
      expect(screen.getByText("ポイント")).toBeInTheDocument();
      expect(screen.getByText("額")).toBeInTheDocument();
      expect(screen.getAllByText("4,000").length).toBeGreaterThan(0);
    });
  });

  it("shows jisseki and settings tabs", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, inputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} } }), { status: 200 }))));

    render(<KanriPortalClient
      creatorName="manager"
      today="2026-09-01"
      initialRuns={[]}
      initialHolidays={[]}
      initialProducts={["商品"]}
      initialTeams={["A"]}
      initialPeople={[{ name: "山田　花子", kot_name: "山田 花子", team: "A", department: "A", employment_kind: "社員", base_wage: null, is_field_sales: false, active: true, sort_order: 10 }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "実績管理" }));
    expect(screen.getByText("人ごとの今月の値")).toBeInTheDocument();
    expect(screen.getByText((text) => text.replace(/\s/g, "") === "山田花子")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "インセ計算" }));
    expect(screen.getByText("インセの目標P")).toBeInTheDocument();
    expect(screen.getByText("チーム別")).toBeInTheDocument();
    expect(screen.getByText("テレマ全体")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "給与試算" }));
    expect(screen.getByText("基準時給")).toBeInTheDocument();
    expect(screen.getByText("人ごと")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByText("人の設定")).toBeInTheDocument();
  });

  it("shows only payroll in read-only mode", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("sheet=payroll")) {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          result: {
            grid: {
              yearMonth: "2026-09",
              settings: { baseWage: 1177, trainingWage: 1500 },
              period: { start: "2026-09-01", end: "2026-09-30", scheduledPayDate: "2026-10-31" },
              rows: [{
                rank: 1,
                department: "A",
                personName: "山田　花子",
                currentStatus: "ゴールド",
                timeEfficiency: 0.2,
                currentWage: 1400,
                nextStatus: "",
                wageAdjustment: 0,
                nextWage: 1400,
                apHourlyWage: 223,
                acquiredPoints: 21,
                referralPoints: 0,
                totalPoints: 21,
                basePay: 117700,
                apIncentive: 22300,
                trainingHours: 0,
                trainingAllowance: 0,
                presidentAward: 50000,
                pointAward: 5000,
                hiringBonus: 0,
                talentReferralIncentive: 0,
                dealIncentive: 0,
                totalPayout: 195000,
                scheduledHours: 100,
                workDays: 10,
                commuteDailyAllowance: 300,
                commuteTotal: 3000,
                periodStart: "2026-09-01",
                periodEnd: "2026-09-30",
                scheduledPayDate: "2026-10-31",
              }],
              cellValues: {},
            },
          },
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 404 }));
    }));

    render(<KanriPortalClient
      creatorName="staff"
      today="2026-09-01"
      initialRuns={[{
        id: "run-1",
        target_date: "2026-09-01",
        mode: "daily",
        creator_name: "manager",
        status: "fetched",
        summary: null,
        warnings: null,
        started_at: null,
        finished_at: null,
        created_at: "2026-09-01T00:00:00Z",
      }]}
      initialHolidays={[]}
      initialProducts={[]}
      initialTeams={[]}
      initialPeople={[]}
      canWrite={false}
    />);

    expect(screen.getByRole("button", { name: "給与試算" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理表" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("195,000")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });
});
