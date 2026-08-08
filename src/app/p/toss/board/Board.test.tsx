import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Board from "./Board";
import type { TossBoardRow, TossStatus } from "../_lib/board";

const makeRow = (id: string, status: TossStatus): TossBoardRow => ({ id, introducedAt: `2026-08-0${id}`, partnerName: `担当${id}`, products: [id === "1" ? "電気" : "ガス"], rank: id === "1" ? "A" : "B", currentContractName: `契約${id}`, applicantName: `申込${id}`, area: "大阪市", status, latestActivity: "2026-08-01", latestCall: "", orderedProducts: [], cancellationReason: "", partnerCode: "1" });

describe("Board multi filters", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("selects multiple values with OR inside one column", async () => {
    const rows = [makeRow("1", "連携受付"), makeRow("2", "受注"), makeRow("3", "キャンセル")];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rows, mine: false, limited: false }) }));
    render(<Board />);
    await waitFor(() => expect(document.querySelector("tbody")?.textContent).toContain("担当1"));
    fireEvent.click(screen.getByLabelText("状況フィルター"));
    fireEvent.click(screen.getByLabelText("連携受付"));
    fireEvent.click(screen.getByLabelText("受注"));
    expect(document.querySelector("tbody")?.textContent).toContain("担当1");
    expect(document.querySelector("tbody")?.textContent).toContain("担当2");
    expect(document.querySelector("tbody")?.textContent).not.toContain("担当3");
    expect(screen.getByLabelText("状況フィルター")).toHaveTextContent("絞込 (2)");
  });
});
