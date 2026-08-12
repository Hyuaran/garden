import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CallMetricsClient from "./CallMetricsClient";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }) }));

const response = { ok: true, from: "2026-08-01", to: "2026-08-12", listName: null, employeeName: null, lastImportedAt: "2026-08-12T03:34:00Z", metrics: [{ listName: "リストA", callCount: 10, effectiveCount: 7, effectiveRate: .7, orderCount: 2, acquiredCount: 1, callOrderRate: .2 }], employeeMetrics: [{ employeeName: "社員A", callCount: 10, effectiveCount: 7, effectiveRate: .7, orderCount: 2, acquiredCount: 1, callOrderRate: .2 }] };

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
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("平均コール数: 10.0");
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("有効率: 70.0%");
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("受注率: 20.0%（受注2件／獲得1件）");
    expect(screen.getByLabelText("対象期間の集計サマリー")).toHaveTextContent("最終更新: 2026/08/12(水) 12:34");
    expect(screen.queryByText(/現在は直近取込分のみ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "リストごと" }));
    expect(screen.getByText("リストA")).toBeInTheDocument();
    expect(screen.getAllByText("未取得")).toHaveLength(3);
    fireEvent.click(screen.getByRole("tab", { name: "定義方法" }));
    expect(screen.getByText("架電回数")).toBeInTheDocument();
    expect(screen.getByText("会話できたコール。留守・無効・空白（無効扱い）を除きます。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "結果フラグの扱い（分類ルール）" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.queryByText(/result_flag 診断/)).not.toBeInTheDocument();
    expect(screen.queryByText("件数")).not.toBeInTheDocument();
    expect(screen.queryByText("想定内")).not.toBeInTheDocument();
    expect(screen.queryByText("空")).not.toBeInTheDocument();
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
