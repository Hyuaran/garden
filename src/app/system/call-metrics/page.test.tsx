import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CallMetricsClient from "./CallMetricsClient";
import styles from "./call-metrics.module.css";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }) }));

const response = { ok: true, from: "2026-08-01", to: "2026-08-12", listName: null, employeeName: null, lastImportedAt: "2026-08-12T03:34:00Z", metrics: [{ listName: "リストA", callCount: 10, effectiveCount: 7, effectiveRate: .7, tossCount: 3, orderCount: 2, acquiredCount: 1, callOrderRate: .2, callAcquiredRate: .1 }], employeeMetrics: [{ employeeName: "社員A", callCount: 10, effectiveCount: 7, effectiveRate: .7, tossCount: 3, orderCount: 2, acquiredCount: 1, callOrderRate: .2, callAcquiredRate: .1 }] };

const longResponse = {
  ...response,
  metrics: Array.from({ length: 16 }, (_, index) => ({
    ...response.metrics[0],
    listName: `リスト${index + 1}`,
  })),
  employeeMetrics: Array.from({ length: 16 }, (_, index) => ({
    ...response.employeeMetrics[0],
    employeeName: `社員${index + 1}`,
  })),
};

describe("CallMetricsClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
    mocks.replace.mockReset(); mocks.refresh.mockReset(); mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });
  it("renders the portal and switches across all three tabs", async () => {
    render(<CallMetricsClient />);
    expect(await screen.findByText("社員A")).toBeInTheDocument();
    expect(screen.getByText("Garden call portal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "テレマ コール集計ポータル" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByTestId("call-metrics-page-shell")).toHaveClass(styles.pageShell);
    expect(screen.getByText(/^対象期間:/)).toHaveClass(styles.period);
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveClass(styles.summaryBand);
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("平均コール数: 10.0");
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("有効率: 70.0%");
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("受注率: 10.0%（受注数 1件）／前確OK率: 20.0%（前確OK数 2件）");
    expect(screen.getByRole("columnheader", { name: "トス数" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "シフト" })).toBeInTheDocument();
    expect(screen.getByText("未取得")).toBeInTheDocument();
    const employeeCells = within(screen.getByText("社員A").closest("tr")!).getAllByRole("cell");
    expect(within(screen.getByText("社員A").closest("table")!).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["社員名", "シフト", "コール数", "有効数", "有効率", "トス数", "トス率", "受注数", "受注率", "前確OK数", "前確OK率"]);
    expect(employeeCells.map((cell) => cell.textContent)).toEqual(["社員A", "未取得", "10", "7", "70.0%", "3", "30.0%", "1", "10.0%", "2", "20.0%"]);
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("最終更新: 2026/08/12(水) 12:34");
    expect(screen.queryByText(/現在は直近取込分のみ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "リストごと" }));
    expect(screen.getByText("リストA")).toBeInTheDocument();
    expect(screen.getAllByText("未取得")).toHaveLength(3);
    expect(screen.queryByRole("columnheader", { name: "シフト" })).not.toBeInTheDocument();
    expect(within(screen.getByText("リストA").closest("table")!).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["リスト名", "コール数", "有効数", "有効率", "トス数", "トス率", "受注数", "受注率", "前確OK数", "前確OK率", "リスト数", "回転数", "リスト受注率"]);
    fireEvent.click(screen.getByRole("tab", { name: "定義方法" }));
    expect(screen.getByText("架電回数")).toBeInTheDocument();
    expect(screen.getByText("会話できたコール。留守・無効・空白（無効扱い）を除きます。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "結果フラグの扱い（分類ルール）" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(3);
    expect(screen.getAllByRole("table")[0].parentElement).toHaveClass(styles.definitionTable, styles.definitionFit);
    expect(screen.queryByText(/result_flag 診断/)).not.toBeInTheDocument();
    expect(screen.queryByText("件数")).not.toBeInTheDocument();
    expect(screen.queryByText("想定内")).not.toBeInTheDocument();
    expect(screen.queryByText("空")).not.toBeInTheDocument();
  });
  it("uses the complete column span for empty employee and list tables", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ...response, metrics: [], employeeMetrics: [] }) } as Response);
    render(<CallMetricsClient />);
    const employeeEmpty = await screen.findByText("対象データがありません");
    expect(employeeEmpty).toHaveAttribute("colspan", "11");
    fireEvent.click(screen.getByRole("tab", { name: "リストごと" }));
    expect(screen.getByText("対象データがありません")).toHaveAttribute("colspan", "13");
  });
  it("shows a 0.0% toss rate when call count is zero", async () => {
    const zero = { ...response.employeeMetrics[0], callCount: 0, tossCount: 0, employeeName: "社員ゼロ" };
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ...response, metrics: [], employeeMetrics: [zero] }) } as Response);
    render(<CallMetricsClient />);
    const cells = within((await screen.findByText("社員ゼロ")).closest("tr")!).getAllByRole("cell");
    expect(cells[6]).toHaveTextContent("0.0%");
  });
  it("keeps long content inside the page background shell on every tab", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => longResponse } as Response);
    render(<CallMetricsClient />);
    const shell = screen.getByTestId("call-metrics-page-shell");
    expect(shell).toContainElement(await screen.findByText("社員16"));
    fireEvent.click(screen.getByRole("tab", { name: "リストごと" }));
    expect(shell).toContainElement(screen.getByText("リスト16"));
    fireEvent.click(screen.getByRole("tab", { name: "定義方法" }));
    expect(shell).toContainElement(screen.getByRole("heading", { name: "結果フラグの扱い（分類ルール）" }));
  });
  it("signs out and returns to the shared login", async () => {
    render(<CallMetricsClient />); await screen.findByText("社員A");
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.replace).toHaveBeenCalledWith("/login?returnTo=%2Fsystem%2Fcall-metrics");
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("requests selected dates with list and employee cross-filters", async () => {
    render(<CallMetricsClient />); await screen.findByText("社員A");
    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("リスト名"), { target: { value: "リストA" } });
    fireEvent.change(screen.getByLabelText("従業員名"), { target: { value: "社員A" } });
    fireEvent.click(screen.getByRole("button", { name: "再集計" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("listName=%E3%83%AA%E3%82%B9%E3%83%88A"), { cache: "no-store" }));
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("employeeName=%E7%A4%BE%E5%93%A1A"), { cache: "no-store" });
  });
});
