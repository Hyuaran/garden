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
    />);

    const calculateButton = [...screen.getAllByRole("button")].find((button) => button.textContent?.includes("計算"));
    expect(calculateButton).toBeTruthy();
    fireEvent.click(calculateButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText("実数")).toBeInTheDocument();
      expect(screen.getByText("ポイント")).toBeInTheDocument();
      expect(screen.getByText("額")).toBeInTheDocument();
      expect(screen.getAllByText("4,000").length).toBeGreaterThan(0);
    });
  });
});
