import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DisplayClient, { type DisplayData } from "./DisplayClient";

function displayData(title = "9月6日(日)時点の成績　5/26稼働"): DisplayData {
  return {
    ok: true,
    empty: false,
    targetDate: "2026-09-06",
    title,
    calculatedAt: "2026-09-07T09:05:00Z",
    columns: [
      { key: "all", label: "テレマ全体" },
      { key: "miyanaga", label: "宮永チーム" },
      { key: "koizumi", label: "小泉チーム" },
      { key: "ishihara", label: "石原チーム" },
    ],
    rows: [
      { key: "efficiency", label: "効率", emphasis: false, values: ["0.05", "0.05", "0.08", "0.04"] },
      { key: "actualPoints", label: "実績P", emphasis: true, values: ["25.0P", "7.1P", "11.0P", "6.9P"] },
      { key: "targetPoints", label: "目標P", emphasis: false, values: ["240.0P", "80.0P", "80.0P", "80.0P"] },
      { key: "currentRequiredPoints", label: "現時点必要P", emphasis: false, values: ["46.1P", "15.3P", "15.3P", "15.3P"] },
      { key: "workHours", label: "稼働h", emphasis: false, values: ["473.0h", "139.0h", "146.0h", "188.0h"] },
      { key: "landingHours", label: "着地予想h", emphasis: false, values: ["2691.5h", "851.0h", "893.5h", "947.0h"] },
      { key: "landingPoints", label: "着地予想P", emphasis: true, values: ["130.1P", "37.1P", "57.5P", "36.0P"] },
      { key: "achievementRate", label: "達成率", emphasis: true, values: ["54.2%", "46.4%", "71.9%", "45.1%"] },
    ],
  };
}

describe("DisplayClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the 8 row by 4 column monitor table with red rows", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<DisplayClient initialData={displayData()} />);

    expect(screen.getByRole("heading", { name: "9月6日(日)時点の成績　5/26稼働" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "テレマ全体" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "宮永チーム" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "小泉チーム" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "石原チーム" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(9);
    expect(screen.getByText("25.0P").closest("tr")?.className).toContain("emphasisRow");
    expect(screen.getByText("54.2%").closest("tr")?.className).toContain("emphasisRow");
  });

  it("refreshes values without reloading the page", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(displayData("9月7日(月)時点の成績　6/26稼働")), { status: 200 }))));

    render(<DisplayClient initialData={displayData()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(screen.getByRole("heading", { name: "9月7日(月)時点の成績　6/26稼働" })).toBeInTheDocument();
  });

  it("shows a login message on 403", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 403 }))));

    render(<DisplayClient initialData={displayData()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(screen.getByText("ログインし直してください")).toBeInTheDocument();
  });
});
