import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CallMetricsClient from "./CallMetricsClient";

const response = { ok: true, from: "2026-08-01", to: "2026-08-12", diagnosticListName: null, metrics: [{ listName: "リストA", callCount: 10, effectiveCount: 7, effectiveRate: .7, orderCount: 2, acquiredCount: 1, callOrderRate: .2 }], employeeMetrics: [{ employeeName: "社員A", callCount: 10, effectiveCount: 7, effectiveRate: .7, orderCount: 2, acquiredCount: 1, callOrderRate: .2 }], resultFlags: [{ resultFlag: "未知", count: 1, isEffective: false, isExpected: false }] };

describe("CallMetricsClient", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => response })));
  it("renders the portal and switches across all three tabs", async () => {
    render(<CallMetricsClient />);
    expect(await screen.findByText("社員A")).toBeInTheDocument();
    expect(screen.getByText("Garden call portal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "テレマ コール集計ポータル" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    fireEvent.click(screen.getByRole("tab", { name: "リストごと" }));
    expect(screen.getByText("リストA")).toBeInTheDocument();
    expect(screen.getAllByText("未取得")).toHaveLength(3);
    fireEvent.click(screen.getByRole("tab", { name: "定義方法" }));
    expect(screen.getByText("架電回数")).toBeInTheDocument();
    expect(screen.getByText("未知")).toBeInTheDocument();
    expect(screen.getByText("想定外")).toBeInTheDocument();
    expect(screen.getByText("無効")).toBeInTheDocument();
  });
  it("requests selected dates and diagnostic list", async () => {
    render(<CallMetricsClient />); await screen.findByText("社員A");
    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("診断対象リスト"), { target: { value: "リストA" } });
    fireEvent.click(screen.getByRole("button", { name: "再集計" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("listName=%E3%83%AA%E3%82%B9%E3%83%88A"), { cache: "no-store" }));
  });
});
