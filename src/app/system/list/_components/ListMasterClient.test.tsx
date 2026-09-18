import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_OPTION_VALUE } from "../_lib/list-fields";

import { ListMasterClient, buildOptionGroups, conditionToFilters, describeFilters, filtersToCondition, type FilterState } from "./ListMasterClient";
import MultiSelectFilter from "./MultiSelectFilter";

vi.mock("react-chartjs-2", () => ({
  Doughnut: () => <div data-testid="analysis-doughnut" />,
}));

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

function installFetch(options: { uploads?: unknown[]; analysis?: unknown; conditions?: unknown[]; internalBlocks?: unknown[]; internalBlockRelease?: { status?: number; body: unknown } } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/soil/list/conditions" && !init?.method) return json({ ok: true, conditions: options.conditions ?? [] });
    if (url === "/api/soil/list/conditions" && init?.method === "POST") return json({ ok: true, condition: { id: "saved-new" } });
    if (url.startsWith("/api/soil/list/conditions/") && init?.method === "DELETE") return json({ ok: true });
    if (url === "/api/soil/list/exports") return json({ ok: true, exports: [] });
    if (url === "/api/soil/list/count" && init?.method === "POST") return json({ ok: true, count: 12563, approximate: false, elapsedMs: 800 });
    if (url === "/api/soil/list/search" && init?.method === "POST") return json({
      ok: true,
      rows: [
        { phoneNumberKey: "0721111181", phoneNumber: "072****81", name: "嶋*", addressCity: "大阪府大阪市", listName: "大阪AU", lastCalledOn: "2026-09-09", callCount: 2, purchaseStatus: "完パケ", lineType: "au", contractMonth: "2024/10", contractElapsed: "1年11か月", category: "個人", internalBlocked: true },
      ],
      page: JSON.parse(String(init.body)).page ?? 1,
      pageSize: 100,
      sort: JSON.parse(String(init.body)).sort ?? null,
    });
    if (url === "/api/soil/list/export" && init?.method === "POST") {
      return Promise.resolve(new Response(new Blob(["export"]), {
        status: 200,
        headers: { "Content-Disposition": "attachment; filename=\"list-master.csv\"; filename*=UTF-8''%E3%83%AA%E3%82%B9%E3%83%88.csv", "X-Soil-List-Excluded-Internal-Block": "2" },
      }));
    }
    if (url.startsWith("/api/soil/list/internal-block/") && init?.method === "PATCH") {
      const release = options.internalBlockRelease;
      return json(release?.body ?? { ok: true }, release?.status ?? 200);
    }
    if (url.startsWith("/api/soil/list/internal-block?")) {
      return json({ ok: true, rows: options.internalBlocks ?? [], count: 0, page: 1, pageSize: 100 });
    }
    if (url.startsWith("/api/soil/list/history?")) {
      return json({
        ok: true,
        current: { phoneNumber: "0285720215", name: "佐藤 民一", address: "栃木県芳賀郡益子町", listName: "【光回線】アナログ_20260914", lineType: "アナログ", auCallAvailability: "○", appointmentBlocked: "", internalBlocked: false, purchaseStatus: "完パケ", callCount: 3, lastCallResult: "留守" },
        rows: [
          { occurred_on: "2026-09-14", type: "投入", title: "【光回線】アナログ_20260914", detail: "アップロード" },
          { occurred_on: "2026-08-03", type: "コール", title: "留守", detail: "田中" },
          { occurred_on: "2026-06-01", type: "自社アポ禁", title: "登録", detail: "理由：重クレーム" },
        ],
        omitted: false,
      });
    }
    if (url === "/api/soil/list/uploads") return json({ ok: true, uploads: options.uploads ?? [] });
    if (url === "/api/soil/list/orders/status") {
      return json({ ok: true, state: { lastRunAt: "2026-09-11T21:30:00Z", records: 12666, orderRows: 19434, phoneUpdates: 9506, deletedRows: 0, elapsedMs: 1200, error: null } });
    }
    if (url === "/api/soil/list/purchase-vendors") {
      return json({ ok: true, vendors: [{ value: "データ総研", count: 1200 }, { value: "ABC", count: 20 }] });
    }
    if (url === "/api/soil/list/uploads/upload-failed/apply" && init?.method === "POST") {
      return json({ ok: true, result: { assignments: 2500, assignments_new: 2500, assignments_updated: 0, parent_updated: 2500, parent_inserted: 0, parent_kept: 0, skipped: 0, remaining: 0, purchase_inserted: 0, line_type_set: 3, category_set: 4 } });
    }
    if (url === "/api/soil/list/analysis/detail?block=vendor&segment=__all__&result=%E7%95%99%E5%AE%88") {
      return json({
        ok: true,
        rows: [
          { listName: "データ総研", listLoadedOn: "2026-09-12", rowCount: 546083, calledCount: 546083, callTotal: 546083, orderCount: 3, acquiredCount: 1, lastCalledOn: "2026-09-12" },
        ],
      });
    }
    if (url.startsWith("/api/soil/list/analysis?")) {
      return json({
        ok: true,
        block: {
          segments: [
            {
              segment: "合計",
              rowCount: 23,
              calledCount: 17,
              callTotal: 36,
              invalidCount: 3,
              validCount: 20,
              orderCount: 3,
              orderCaseCount: 4,
              acquiredCount: 1,
              lastCalledOn: "2026-09-12",
              segmentLastCalledOn: null,
              rotation: 36 / 23,
              orderRateValid: 3 / 20,
              orderRateTotal: 3 / 23,
              results: [{ result: "留守", rowCount: 23 }],
            },
            {
              segment: "データ総研",
              rowCount: 13,
              calledCount: 10,
              callTotal: 20,
              invalidCount: 1,
              validCount: 12,
              orderCount: 1,
              orderCaseCount: 1,
              acquiredCount: 0,
              lastCalledOn: "2026-09-12",
              segmentLastCalledOn: null,
              rotation: 20 / 13,
              orderRateValid: 1 / 12,
              orderRateTotal: 1 / 13,
              results: [{ result: "留守", rowCount: 13 }],
            },
            {
              segment: "ラディッシュ",
              rowCount: 10,
              calledCount: 7,
              callTotal: 16,
              invalidCount: 2,
              validCount: 8,
              orderCount: 2,
              orderCaseCount: 3,
              acquiredCount: 1,
              lastCalledOn: "2026-09-11",
              segmentLastCalledOn: null,
              rotation: 1.6,
              orderRateValid: 2 / 8,
              orderRateTotal: 2 / 10,
              results: [{ result: "留守", rowCount: 10 }],
            },
          ],
        },
      });
    }
    if (url === "/api/soil/list/analysis") {
      return json(options.analysis ?? {
        ok: true,
        analysis: {
          refreshedAt: "2026-09-13T06:45:00+09:00",
          elapsedMs: 1200,
          lastError: null,
          blocks: {
            vendor: {
              segments: [
                {
                  segment: "合計",
                  rowCount: 28,
                  calledCount: 21,
                  callTotal: 42,
                  invalidCount: 3,
                  validCount: 25,
                  orderCount: 3,
                  orderCaseCount: 4,
                  repurchaseCount: 8,
                  repurchaseSources: "",
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 1.5,
                  orderRateValid: 3 / 25,
                  orderRateTotal: 3 / 28,
                  results: [
                    { result: "留守", rowCount: 546083 },
                    { result: "担不", rowCount: 0 },
                    { result: "無効", rowCount: 0 },
                    { result: "NG", rowCount: 0 },
                    { result: "前確OK", rowCount: 0 },
                    { result: "見込", rowCount: 0 },
                    { result: "獲得", rowCount: 0 },
                    { result: "未コール", rowCount: 118626 },
                    { result: "その他", rowCount: 10 },
                    { result: "（結果なし）", rowCount: 783 },
                  ],
                },
                {
                  segment: "データ総研",
                  rowCount: 13,
                  calledCount: 10,
                  callTotal: 20,
                  invalidCount: 1,
                  validCount: 12,
                  orderCount: 1,
                  orderCaseCount: 1,
                  repurchaseCount: 5,
                  repurchaseSources: "Luna 3／ABC 2",
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: "2026-09-12",
                  rotation: 20 / 13,
                  orderRateValid: 1 / 12,
                  orderRateTotal: 1 / 13,
                  results: [{ result: "留守", rowCount: 13 }],
                },
                {
                  segment: "ラディッシュ",
                  rowCount: 10,
                  calledCount: 7,
                  callTotal: 16,
                  invalidCount: 2,
                  validCount: 8,
                  orderCount: 2,
                  orderCaseCount: 3,
                  repurchaseCount: 3,
                  repurchaseSources: "データ総研 3",
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-11",
                  segmentLastCalledOn: "2026-09-11",
                  rotation: 1.6,
                  orderRateValid: 2 / 8,
                  orderRateTotal: 2 / 10,
                  results: [{ result: "留守", rowCount: 10 }],
                },
                {
                  segment: "日本データ総研株式会社",
                  rowCount: 5,
                  calledCount: 4,
                  callTotal: 6,
                  invalidCount: 0,
                  validCount: 5,
                  orderCount: 0,
                  orderCaseCount: 0,
                  repurchaseCount: 0,
                  repurchaseSources: "",
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-10",
                  segmentLastCalledOn: "2026-09-10",
                  rotation: 1.2,
                  orderRateValid: 0,
                  orderRateTotal: 0,
                  results: [{ result: "留守", rowCount: 5 }],
                },
              ],
            },
            lineType: {
              segments: [
                {
                  segment: "合計",
                  rowCount: 28,
                  calledCount: 21,
                  callTotal: 42,
                  invalidCount: 3,
                  validCount: 25,
                  orderCount: 3,
                  orderCaseCount: 4,
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 1.5,
                  orderRateValid: 3 / 25,
                  orderRateTotal: 3 / 28,
                  results: [{ result: "留守", rowCount: 28 }],
                },
                {
                  segment: "フレッツ",
                  rowCount: 18,
                  calledCount: 14,
                  callTotal: 30,
                  invalidCount: 1,
                  validCount: 17,
                  orderCount: 2,
                  orderCaseCount: 2,
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 30 / 18,
                  orderRateValid: 2 / 17,
                  orderRateTotal: 2 / 18,
                  results: [{ result: "留守", rowCount: 18 }],
                },
              ],
            },
            contractYear: {
              segments: [
                {
                  segment: "合計",
                  rowCount: 28,
                  calledCount: 21,
                  callTotal: 42,
                  invalidCount: 3,
                  validCount: 25,
                  orderCount: 3,
                  orderCaseCount: 4,
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 1.5,
                  orderRateValid: 3 / 25,
                  orderRateTotal: 3 / 28,
                  results: [{ result: "留守", rowCount: 28 }],
                },
                {
                  segment: "2024",
                  rowCount: 9,
                  calledCount: 8,
                  callTotal: 15,
                  invalidCount: 0,
                  validCount: 9,
                  orderCount: 1,
                  orderCaseCount: 1,
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 15 / 9,
                  orderRateValid: 1 / 9,
                  orderRateTotal: 1 / 9,
                  results: [{ result: "留守", rowCount: 9 }],
                },
                {
                  segment: "（契約時期なし）",
                  rowCount: 4,
                  calledCount: 2,
                  callTotal: 3,
                  invalidCount: 0,
                  validCount: 4,
                  orderCount: 0,
                  orderCaseCount: 0,
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-10",
                  segmentLastCalledOn: null,
                  rotation: 0.75,
                  orderRateValid: 0,
                  orderRateTotal: 0,
                  results: [{ result: "留守", rowCount: 4 }],
                },
              ],
            },
            activeList: { segments: [] },
            contract: {
              snapshotAt: "2026-09-13T15:27:00+09:00",
              segments: [
                {
                  segment: "合計",
                  rowCount: 7,
                  calledCount: 6,
                  callTotal: 12,
                  invalidCount: 0,
                  validCount: 7,
                  orderCount: 1,
                  orderCaseCount: 1,
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 12 / 7,
                  orderRateValid: 1 / 7,
                  orderRateTotal: 1 / 7,
                  results: [{ result: "留守", rowCount: 7 }],
                },
                {
                  segment: "ドコモ光",
                  rowCount: 7,
                  calledCount: 6,
                  callTotal: 12,
                  invalidCount: 0,
                  validCount: 7,
                  orderCount: 1,
                  orderCaseCount: 1,
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 12 / 7,
                  orderRateValid: 1 / 7,
                  orderRateTotal: 1 / 7,
                  results: [{ result: "留守", rowCount: 7 }],
                },
              ],
            },
          },
          repurchasePairs: [
            { sourceVendor: "Luna", targetVendor: "データ総研", phoneCount: 3, orderCount: 1 },
            { sourceVendor: "データ総研", targetVendor: "ラディッシュ", phoneCount: 2, orderCount: 0 },
          ],
        },
      });
    }
    if (url === "/api/soil/list/options") {
      return json({
        ok: true,
        options: {
          prefecture: [
            { value: "大阪府", label: "大阪府", count: 11165, empty: false },
            { value: "奈良県", label: "奈良県", count: 709, empty: false },
            { value: "北海道", label: "北海道", count: 124880, empty: false },
            { value: "沖縄県", label: "沖縄県", count: 3427, empty: false },
            { value: "大阪", label: "大阪", count: 12, empty: false },
            { value: "", label: "（空欄）", count: 724490, empty: true },
          ],
          auCallAvailability: [
            { value: "○", label: "○", count: 1945619, empty: false },
            { value: "×", label: "×", count: 120, empty: false },
          ],
          purchaseStatus: [],
          latestVendor: [
            { value: "Luna", label: "Luna", count: 2400, empty: false },
            { value: "データ総研", label: "データ総研", count: 1200, empty: false },
            { value: "", label: "（空欄）", count: 20, empty: true },
          ],
          appointmentBlocked: [
            { value: "", label: "（空欄）", count: 1945619, empty: true },
            { value: "戸建", label: "戸建", count: 500, empty: false },
          ],
          lineType: [
            { value: "フレッツ", label: "フレッツ", count: 1200, empty: false },
            { value: "", label: "（空欄）", count: 20, empty: true },
          ],
          category: [
            { value: "個人", label: "個人", count: 1000, empty: false },
            { value: "法人", label: "法人", count: 30, empty: false },
          ],
        },
      });
    }
    if (url === "/api/soil/list/call-sync" && init?.method === "POST") {
      return json({
        ok: true,
        result: { phones: 38335, callRows: 41200, syncedThrough: "2026-09-07" },
        state: { syncedThrough: "2026-09-07", lastRunAt: "2026-09-07T10:35:00Z", phones: 38335, callRows: 41200 },
      });
    }
    if (url === "/api/soil/list/call-sync") {
      return json({
        ok: true,
        canSync: true,
        state: { syncedThrough: "2026-09-07", lastRunAt: "2026-09-07T10:35:00Z", phones: 38335, callRows: 41200 },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ListMasterClient call sync status", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the sync state in the header", async () => {
    installFetch();
    render(<ListMasterClient />);
    expect(await screen.findByText("コール履歴最終更新：2026/09/07(月) 19:35")).toBeInTheDocument();
    expect(screen.getByText("受注履歴最終更新：2026/09/12(土) 06:30")).toBeInTheDocument();
  });

  it("hides the sync button below manager", () => {
    installFetch();
    render(<ListMasterClient canSyncCalls={false} />);
    expect(screen.queryByRole("button", { name: "コール履歴を反映する" })).not.toBeInTheDocument();
  });

  it("updates the message after syncing calls", async () => {
    const fetchMock = installFetch();
    render(<ListMasterClient />);
    const button = await screen.findByRole("button", { name: "コール履歴を反映する" });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("反映しました（対象 38,335 番号・9/7 まで）")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/call-sync", { method: "POST" });
  });
});

describe("ListMasterClient tabs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("switches tabs and follows the tab query without adding history", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=guide");
    render(<ListMasterClient />);
    expect(await screen.findByRole("tab", { name: "管理方法", selected: true })).toBeInTheDocument();
    expect(screen.getByText("リストマスタのデータの持ち方")).toBeInTheDocument();
    const guidePanel = screen.getByRole("heading", { name: "リストマスタのデータの持ち方" }).closest("section");
    expect(guidePanel).not.toBeNull();
    const guide = within(guidePanel as HTMLElement);
    expect(guide.getByRole("columnheader", { name: "名前" })).toBeInTheDocument();
    expect(guide.getByRole("columnheader", { name: "決まり" })).toBeInTheDocument();
    expect(guide.getAllByRole("table").length).toBeGreaterThanOrEqual(2);
    expect(guide.getAllByRole("row").slice(1, 6).map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "電話番号台帳",
      "購入履歴",
      "投入履歴",
      "コール履歴",
      "受注履歴",
    ]);
    expect(guide.getByRole("cell", { name: "受注日・商材・チーム・営業ID" })).toBeInTheDocument();
    expect(guidePanel?.textContent).not.toContain("準備中");
    expect(guidePanel?.textContent).not.toContain("親");
    expect(guidePanel?.textContent).not.toContain("子");
    expect(within(guidePanel as HTMLElement).queryByLabelText("電話番号")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "自社アポ禁" }));
    expect(window.location.search).toBe("?tab=internal-block");
    expect(screen.getByRole("heading", { name: "自社アポ禁" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "テンプレートをダウンロード" })).toHaveAttribute("href", "/api/soil/list/internal-block/template");

    fireEvent.click(screen.getByRole("tab", { name: "アップロード" }));
    expect(window.location.search).toBe("?tab=upload");
    expect(screen.getByText("新しく買ったリストをアップロード")).toBeInTheDocument();
  });

  it("shows the history search tab and renders timeline rows", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=history");
    render(<ListMasterClient />);

    expect(await screen.findByRole("tab", { name: "履歴検索", selected: true })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("電話番号"), { target: { value: "028-572-0215" } });
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText(/佐藤 民一/)).toBeInTheDocument();
    expect(screen.getAllByText("投入").length).toBeGreaterThan(0);
    expect(screen.getAllByText("自社アポ禁").length).toBeGreaterThan(0);
  });
});

describe("ListMasterClient analysis contract block", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("shows the contract analysis table and shineigyo snapshot time", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    render(<ListMasterClient />);

    expect(await screen.findByRole("heading", { name: /③ 新営業 FileMaker の既契約/ })).toBeInTheDocument();
    expect(screen.getByText("新営業の写し：2026/09/13(日) 15:27 時点")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "既契約情報" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "ドコモ光" })).toBeInTheDocument();
    expect(screen.getAllByTestId("analysis-doughnut").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a refresh hint when contract rows are not in the current aggregate yet", async () => {
    installFetch({
      analysis: {
        ok: true,
        analysis: {
          refreshedAt: "2026-09-13T06:45:00+09:00",
          elapsedMs: 1200,
          lastError: null,
          blocks: {
            vendor: { segments: [] },
            activeList: { segments: [] },
            contract: { snapshotAt: null, segments: [] },
          },
        },
      },
    });
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    render(<ListMasterClient />);

    expect(await screen.findByText("集計を作り直すと表示されます（↻）")).toBeInTheDocument();
    expect(screen.getByText("新営業の写しはまだありません")).toBeInTheDocument();
  });
});

describe("ListMasterClient analysis vendor controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("sorts analysis rows from headers while keeping the total row first", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    render(<ListMasterClient />);

    const vendorSection = (await screen.findByRole("heading", { name: /① どこから購入したか/ })).closest("section");
    expect(vendorSection).not.toBeNull();
    const vendor = within(vendorSection as HTMLElement);
    fireEvent.click(vendor.getByRole("button", { name: "購入先" }));

    const analysisTable = vendor.getAllByRole("table").find((table) => within(table).queryByRole("columnheader", { name: /購入先/ }));
    expect(analysisTable).toBeTruthy();
    const bodyRows = within(analysisTable as HTMLElement).getAllByRole("row").slice(1, 5);
    expect(bodyRows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "合計",
      "データ総研",
      "ラディッシュ",
      "日本データ総研株式会社",
    ]);

    fireEvent.click(within(analysisTable as HTMLElement).getByRole("button", { name: /購入先/ }));
    const descRows = within(analysisTable as HTMLElement).getAllByRole("row").slice(1, 5);
    expect(descRows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "合計",
      "日本データ総研株式会社",
      "ラディッシュ",
      "データ総研",
    ]);
  });

  it("filters vendors and rebuilds the total from selected rows", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    render(<ListMasterClient />);

    const vendorSection = (await screen.findByRole("heading", { name: /① どこから購入したか/ })).closest("section");
    expect(vendorSection).not.toBeNull();
    const vendor = within(vendorSection as HTMLElement);

    fireEvent.click(vendor.getByRole("button", { name: /購入先で絞る 指定なし/ }));
    fireEvent.change(vendor.getByLabelText("名前で絞る"), { target: { value: "データ" } });
    expect(vendor.queryByRole("checkbox", { name: "ラディッシュ（10）" })).not.toBeInTheDocument();
    fireEvent.click(vendor.getByRole("checkbox", { name: "データ総研（13）" }));
    fireEvent.change(vendor.getByLabelText("名前で絞る"), { target: { value: "" } });
    fireEvent.click(vendor.getByRole("checkbox", { name: "ラディッシュ（10）" }));
    fireEvent.click(vendor.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      const analysisTable = vendor.getAllByRole("table").find((table) => within(table).queryByText("合計（絞り込み）：23 件"));
      expect(analysisTable).toBeTruthy();
      const bodyRows = within(analysisTable as HTMLElement).getAllByRole("row").slice(1);
      expect(bodyRows).toHaveLength(3);
      expect(within(bodyRows[0]).getAllByRole("cell").map((cell) => cell.textContent).slice(0, 4)).toEqual([
        "合計（絞り込み）：23 件",
        "23",
        "17",
        "36",
      ]);
    });
    const analysisTable = vendor.getAllByRole("table").find((table) => within(table).queryByText("合計（絞り込み）：23 件"));
    const bodyRows = within(analysisTable as HTMLElement).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getAllByRole("cell").map((cell) => cell.textContent).slice(0, 4)).toEqual([
      "合計（絞り込み）：23 件",
      "23",
      "17",
      "36",
    ]);
    expect(within(bodyRows[1]).getAllByRole("cell")[0]).toHaveTextContent("データ総研");
    expect(within(bodyRows[2]).getAllByRole("cell")[0]).toHaveTextContent("ラディッシュ");
  });

  it("sends purchase vendor, line type, and contract year filters together", async () => {
    const fetchMock = installFetch();
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    render(<ListMasterClient />);

    const vendorSection = (await screen.findByRole("heading", { name: /① どこから購入したか/ })).closest("section");
    expect(vendorSection).not.toBeNull();
    const vendor = within(vendorSection as HTMLElement);

    fireEvent.click(vendor.getByRole("button", { name: /購入先で絞る 指定なし/ }));
    fireEvent.click(vendor.getByRole("checkbox", { name: "データ総研（13）" }));
    fireEvent.click(vendor.getByRole("button", { name: "閉じる" }));

    fireEvent.click(vendor.getByRole("button", { name: /元回線で絞る 指定なし/ }));
    fireEvent.click(vendor.getByRole("checkbox", { name: "フレッツ（1,200）" }));
    fireEvent.click(vendor.getByRole("button", { name: "閉じる" }));

    fireEvent.click(vendor.getByRole("button", { name: /契約時期で絞る 指定なし/ }));
    fireEvent.click(vendor.getByRole("checkbox", { name: "2024（9）" }));
    fireEvent.click(vendor.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([calledUrl]) => (
        decodeURIComponent(String(calledUrl)) === "/api/soil/list/analysis?axis=vendor&vendor=データ総研&lineType=フレッツ&contractYear=2024"
      ))).toBe(true);
    });
  });

  it("shows clickable legend rows with counts and removes the old result buttons", async () => {
    const fetchMock = installFetch();
    window.history.replaceState(null, "", "/system/list?tab=analysis");
    const { container } = render(<ListMasterClient />);

    const vendorSection = (await screen.findByRole("heading", { name: /① どこから購入したか/ })).closest("section");
    expect(vendorSection).not.toBeNull();
    const vendor = within(vendorSection as HTMLElement);
    const legendButton = await vendor.findByRole("button", { name: /留守\s+546,083\s+件/ });

    expect(legendButton).toBeInTheDocument();
    expect(vendor.getByRole("button", { name: /前確OK\s+0\s+件/ })).toBeInTheDocument();
    const orderSummary = vendor.getByText("うち受注顧客 3 人・受注案件 4 件");
    expect(orderSummary).toBeInTheDocument();
    expect(orderSummary.closest("button")).toBeNull();
    expect(vendor.getByRole("columnheader", { name: "買い直し数" })).toBeInTheDocument();
    expect(vendor.getByRole("columnheader", { name: "買い直し元" })).toBeInTheDocument();
    expect(vendor.getByText("Luna 3／ABC 2")).toBeInTheDocument();
    expect(screen.getByText("Luna → データ総研")).toBeInTheDocument();
    expect(vendor.getByText("Kintone の受注履歴から数えた数。コール結果とは別の数え方です。")).toBeInTheDocument();
    expect(container.querySelector("[class*='resultButton']")).not.toBeInTheDocument();

    fireEvent.click(legendButton);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([calledUrl]) => (
        decodeURIComponent(String(calledUrl)) === "/api/soil/list/analysis/detail?block=vendor&segment=__all__&result=留守"
      ))).toBe(true);
    });
  });
});

describe("ListMasterClient upload history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("shows the resume button only for stopped uploads and reloads after applying", async () => {
    const fetchMock = installFetch({
      uploads: [
        {
          id: "upload-failed",
          file_name: "stopped.csv",
          format: "B",
          row_count: 2500,
          status: "failed",
          result: { assignments: 1000, assignments_new: 1000, assignments_updated: 0, parent_updated: 1000, parent_inserted: 0, parent_kept: 0, skipped: 0, remaining: 1500, purchase_inserted: 0 },
          購入先: "データ総研",
          created_by: "東海林 美琴",
          created_at: "2026-09-09T13:34:00Z",
        },
        {
          id: "upload-done",
          file_name: "done.csv",
          format: "B",
          row_count: 1000,
          status: "done",
          result: { assignments: 1000, assignments_new: 1000, assignments_updated: 0, parent_updated: 990, parent_inserted: 10, parent_kept: 0, skipped: 0, remaining: 0, purchase_inserted: 10 },
          購入先: "データ総研",
          created_by: "東海林 美琴",
          created_at: "2026-09-09T13:33:00Z",
        },
      ],
    });
    window.history.replaceState(null, "", "/system/list?tab=upload");
    render(<ListMasterClient />);

    expect(await screen.findByText("途中で止まりました（電話番号台帳へ反映 1,000 / 2,500）")).toBeInTheDocument();
    expect(screen.getByText("新規 10／更新 990／購入履歴 10／元回線 0／区分 0")).toBeInTheDocument();
    expect(screen.getAllByText("購入先：データ総研")).toHaveLength(2);
    const resume = screen.getByRole("button", { name: "反映をやり直す" });
    expect(resume).toBeInTheDocument();
    expect(screen.getAllByText("反映をやり直す")).toHaveLength(1);

    fireEvent.click(resume);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/uploads/upload-failed/apply", { method: "POST" });
    });
    await waitFor(() => {
      expect(screen.getByText("反映しました")).toBeInTheDocument();
    });
  });
});

describe("ListMasterClient upload purchase vendor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("requires a purchase vendor before upload import", async () => {
    installFetch();
    window.history.replaceState(null, "", "/system/list?tab=upload");
    render(<ListMasterClient />);

    expect(await screen.findByLabelText("購入先")).toBeRequired();
    expect(screen.getByRole("option", { name: "データ総研（1,200）" })).toBeInTheDocument();
  });
});

describe("ListMasterClient filter condition conversion", () => {
  it("keeps old single-select condition shapes while adding multi-select shapes", () => {
    const base: FilterState = {
      prefecture: ["大阪府"],
      auCallAvailability: ["○", "×"],
      purchaseStatus: ["完パケ", "電話番号のみ"],
      purchaseVendor: ["Luna", EMPTY_OPTION_VALUE],
      appointmentBlocked: [EMPTY_OPTION_VALUE, "戸建"],
      lineType: ["フレッツ", EMPTY_OPTION_VALUE],
      category: ["個人", "法人"],
      listName: "",
      listLoadedOnFrom: "",
      listLoadedOnTo: "",
      recheckedOnFrom: "",
      recheckedOnTo: "",
      lastCalledOnFrom: "",
      lastCalledOnTo: "",
      callCountFrom: "",
      callCountTo: "",
      elapsedYearsFrom: "9",
      elapsedYearsTo: "10",
      purchaseHistory: "",
      internalBlock: "なし",
    };

    expect(filtersToCondition(base)).toEqual({
      filters: [
        { field: "prefecture", op: "eq", value: "大阪府" },
        { field: "auCallAvailability", op: "in", value: ["○", "×"] },
        { field: "purchaseStatus", op: "in", value: ["完パケ", "電話番号のみ"] },
        { field: "latestVendor", op: "inOrEmpty", value: ["Luna"] },
        { field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建"] },
        { field: "lineType", op: "inOrEmpty", value: ["フレッツ"] },
        { field: "category", op: "in", value: ["個人", "法人"] },
        { field: "contractMonth", op: "lte", value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        { field: "contractMonth", op: "gte", value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        { field: "internalBlocked", op: "eq", value: false },
      ],
    });
  });

  it("reads old and new saved conditions into the multi-select state", () => {
    expect(
      conditionToFilters({
        filters: [
          { field: "prefecture", op: "eq", value: "大阪府" },
          { field: "appointmentBlocked", op: "empty" },
          { field: "auCallAvailability", op: "in", value: ["○", "×"] },
          { field: "purchaseStatus", op: "inOrEmpty", value: ["完パケ"] },
          { field: "latestVendor", op: "eq", value: "Luna" },
          { field: "lineType", op: "empty" },
          { field: "category", op: "eq", value: "法人" },
          { field: "internalBlocked", op: "eq", value: true },
        ],
      }),
    ).toMatchObject({
      prefecture: ["大阪府"],
      appointmentBlocked: [EMPTY_OPTION_VALUE],
      auCallAvailability: ["○", "×"],
      purchaseStatus: ["完パケ", EMPTY_OPTION_VALUE],
      purchaseVendor: ["Luna"],
      lineType: [EMPTY_OPTION_VALUE],
      category: ["法人"],
      internalBlock: "あり",
    });
  });

  it("keeps purchase history conditions compatible for saved filters and summaries", () => {
    const filters = conditionToFilters({
      filters: [{ field: "purchaseHistoryExists", op: "eq", value: true }],
    });

    expect(filters.purchaseHistory).toBe("あり");
    expect(filtersToCondition(filters).filters).toContainEqual({ field: "purchaseHistoryExists", op: "eq", value: true });
    expect(describeFilters(filters)).toContain("購入履歴：あり");
  });

  it("summarizes filters in the same order as the form", () => {
    const summary = describeFilters({
      prefecture: ["大阪府"],
      purchaseVendor: ["データ総研"],
      category: ["個人"],
      purchaseStatus: ["完パケ"],
      lineType: ["フレッツ"],
      elapsedYearsFrom: "3",
      elapsedYearsTo: "5",
      listLoadedOnFrom: "2026-09-01",
      listLoadedOnTo: "2026-09-18",
      listName: "光回線",
      recheckedOnFrom: "2026-09-02",
      recheckedOnTo: "2026-09-17",
      lastCalledOnFrom: "2026-09-03",
      lastCalledOnTo: "2026-09-16",
      callCountFrom: "1",
      callCountTo: "4",
      purchaseHistory: "あり",
      internalBlock: "なし",
      appointmentBlocked: [EMPTY_OPTION_VALUE],
      auCallAvailability: ["○"],
    });

    expect(summary.split("／").map((item) => item.split("：")[0])).toEqual([
      "都道府県",
      "購入先",
      "区分",
      "購入状態",
      "元回線",
      "経過（年）",
      "投入日",
      "リスト名",
      "再判定日",
      "最終コール日",
      "コール回数",
      "購入履歴",
      "自社アポ禁",
      "アポ禁",
      "AU光架電可否",
    ]);
  });

  it("groups prefectures north to south, then other labels, then empty", () => {
    const groups = buildOptionGroups("prefecture", [
      { value: "大阪府", label: "大阪府", count: 11165, empty: false },
      { value: "北海道", label: "北海道", count: 124880, empty: false },
      { value: "沖縄県", label: "沖縄県", count: 3427, empty: false },
      { value: "大阪", label: "大阪", count: 12, empty: false },
      { value: "", label: "（空欄）", count: 724490, empty: true },
    ]);

    expect(groups.map((group) => group.label ?? "空欄")).toEqual(["北海道・東北", "近畿", "九州・沖縄", "その他の表記（表記ゆれ・件数の多い順）", "空欄"]);
    expect(groups.flatMap((group) => group.options.map((option) => option.label))).toEqual(["北海道", "大阪府", "沖縄県", "大阪", "（空欄）"]);
  });
});

describe("ListMasterClient list search UX", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the processing overlay, collapses filters after search, and reopens them", async () => {
    installFetch();
    render(<ListMasterClient />);

    const search = await screen.findByRole("button", { name: "検索" });
    fireEvent.click(search);
    expect(screen.getByText("条件に合う番号を検索しています…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("該当 12,563 件（0.8 秒）")).toBeInTheDocument());
    expect(screen.getByText(/AU光架電可否：○/)).toBeInTheDocument();
    expect(screen.getByText(/自社アポ禁：なし/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "一覧（12,563 件・個人情報は一部伏せる）" })).toBeInTheDocument();
    expect(screen.getAllByText("自社アポ禁").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 126 ページ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "条件を変える" }));
    expect(screen.getByRole("button", { name: "検索" })).toBeInTheDocument();
  });

  it("shows the filter fields in the requested order with range captions and dividers", async () => {
    installFetch();
    render(<ListMasterClient />);

    const grid = await screen.findByTestId("list-filter-grid");
    const labels = ["都道府県", "購入先", "区分", "購入状態", "元回線", "経過（年）", "リスト投入日", "リスト名", "再判定日", "最終コール日", "コール回数", "自社アポ禁", "アポ禁", "AU光架電可否"];
    const fieldLabels = Array.from(grid.children)
      .map((child) => labels.find((label) => (child.textContent ?? "").startsWith(label)))
      .filter(Boolean);
    expect(fieldLabels).toEqual(labels);
    expect(within(grid).queryByLabelText("購入履歴")).not.toBeInTheDocument();
    // 範囲入力の「から／まで」等は欄の中の薄い文字（placeholder）だけ。欄の外に小見出しは出さない
    expect(within(grid).getAllByPlaceholderText("から")).toHaveLength(3);
    expect(within(grid).getAllByPlaceholderText("まで")).toHaveLength(3);
    expect(within(grid).getByPlaceholderText("回以上")).toBeInTheDocument();
    expect(within(grid).getByPlaceholderText("回以下")).toBeInTheDocument();
    expect(within(grid).getByPlaceholderText("年以上")).toBeInTheDocument();
    expect(within(grid).getByPlaceholderText("年以下")).toBeInTheDocument();
    expect(within(grid).queryByText("から")).not.toBeInTheDocument();
    expect(within(grid).queryByText("回以上")).not.toBeInTheDocument();
    expect(within(grid).queryByText("年以上")).not.toBeInTheDocument();
    expect(within(grid).getAllByPlaceholderText("から")[0]).toHaveAttribute("data-empty", "true");
    expect(grid.querySelectorAll('[class*="filterDivider"]')).toHaveLength(2);
  });

  it("changes sort and page through the table controls", async () => {
    const fetchMock = installFetch();
    render(<ListMasterClient />);

    fireEvent.click(await screen.findByRole("button", { name: "検索" }));
    await screen.findByText("1 / 126 ページ");
    fireEvent.click(screen.getByRole("button", { name: /氏名/ }));
    await waitFor(() => {
      const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(body.sort).toEqual({ key: "name", direction: "asc" });
      expect(body.page).toBe(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "＞" }));
    await waitFor(() => {
      const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(body.page).toBe(2);
      expect(body.sort).toEqual({ key: "name", direction: "asc" });
    });
  });

  it("opens the save modal, disables empty save, loads and deletes saved conditions", async () => {
    const fetchMock = installFetch({
      conditions: [
        {
          id: "condition-1",
          name: "大阪・奈良 AU光○",
          condition: { filters: [{ field: "prefecture", op: "in", value: ["大阪府", "奈良県"] }] },
          created_by: "東海林",
          updated_at: "2026-09-09T00:00:00+09:00",
        },
      ],
    });
    render(<ListMasterClient />);

    fireEvent.click(await screen.findByRole("button", { name: "条件を保存" }));
    expect(screen.getByRole("dialog", { name: "条件を保存" })).toBeInTheDocument();
    expect(screen.getByText(/いまの条件：/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("条件名"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "読み込む" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/search", expect.objectContaining({ method: "POST" }));
    });

    fireEvent.click(screen.getAllByRole("button", { name: "条件を保存" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(screen.getByRole("dialog", { name: "条件を削除する" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/conditions/condition-1", { method: "DELETE" }));
  });

  it("loads an old saved purchase history condition without showing the removed select", async () => {
    const fetchMock = installFetch({
      conditions: [
        {
          id: "condition-history",
          name: "購入履歴あり",
          condition: { filters: [{ field: "purchaseHistoryExists", op: "eq", value: true }] },
          created_by: "東海林",
          updated_at: "2026-09-09T00:00:00+09:00",
        },
      ],
    });
    render(<ListMasterClient />);

    const grid = await screen.findByTestId("list-filter-grid");
    expect(within(grid).queryByLabelText("購入履歴")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "条件を保存" }));
    fireEvent.click(screen.getByRole("button", { name: "読み込む" }));

    await waitFor(() => {
      const searchCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/soil/list/search" && init?.method === "POST");
      expect(JSON.parse(String(searchCall?.[1]?.body)).condition.filters).toEqual([
        { field: "purchaseHistoryExists", op: "eq", value: true },
      ]);
    });
    expect(await screen.findByText(/購入履歴：あり/)).toBeInTheDocument();
  });
});

describe("ListMasterClient export UX", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function stubDownloadApis() {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:soil-list") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  }

  it("selects a format, downloads all counted rows, and shows the export overlay", async () => {
    stubDownloadApis();
    const fetchMock = installFetch();
    render(<ListMasterClient />);

    fireEvent.click(await screen.findByRole("button", { name: "検索" }));
    await screen.findByText("該当 12,563 件（0.8 秒）");
    // 形式はプルダウン（東海林さん 2026-09-13：ラジオだと詰まって見える）
    const formatSelect = screen.getByRole("combobox", { name: "形式" });
    expect(formatSelect).toHaveValue("csv");
    fireEvent.change(formatSelect, { target: { value: "xlsx" } });
    fireEvent.click(screen.getByRole("button", { name: "12,563 件を書き出す" }));

    expect(screen.getByText("12,563件をExcelで書き出しています…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("12,563 件を Excel で書き出しました（自社アポ禁 2 件を除きました）")).toBeInTheDocument());
    const exportCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/soil/list/export" && init?.method === "POST");
    expect(exportCall).toBeTruthy();
    expect(JSON.parse(String(exportCall?.[1]?.body))).toMatchObject({ format: "xlsx", sortKey: "listLoadedOnAsc" });
    expect(JSON.parse(String(exportCall?.[1]?.body))).not.toHaveProperty("limit");
  });

  it("confirms exports over 100,000 rows before downloading", async () => {
    stubDownloadApis();
    const fetchMock = installFetch();
    render(<ListMasterClient />);

    fireEvent.click(await screen.findByRole("button", { name: "検索" }));
    await screen.findByText("該当 12,563 件（0.8 秒）");
    // 画面の件数だけを大きくするため、次の count 応答を差し替える。
    vi.mocked(fetch).mockImplementationOnce(() => json({ ok: true, count: 120000, approximate: false, elapsedMs: 800 }) as unknown as ReturnType<typeof fetch>);
    fireEvent.click(screen.getByRole("button", { name: "条件を変える" }));
    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    await screen.findByText("該当 120,000 件（0.8 秒）");
    fireEvent.click(screen.getByRole("button", { name: "120,000 件を書き出す" }));

    expect(screen.getByRole("dialog", { name: "書き出しを始める" })).toBeInTheDocument();
    expect(screen.getByText("約 120,000 件を書き出します。目安は 6 分です。")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/soil/list/export" && init?.method === "POST")).toBe(false);
  });
});

describe("ListMasterClient internal block release modal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  const internalBlockRow = {
    id: "block-1",
    電話番号: "0285720215",
    登録日: "2026-09-15",
    理由: "重クレーム",
    登録者: "東海林",
    出所: "画面",
    解除日: null,
    解除者: null,
    解除理由: null,
    created_at: "2026-09-15T00:00:00+09:00",
  };

  async function openReleaseModal(fetchOptions: Parameters<typeof installFetch>[0] = {}) {
    const fetchMock = installFetch({ internalBlocks: [internalBlockRow], ...fetchOptions });
    window.history.replaceState(null, "", "/system/list?tab=internal-block");
    render(<ListMasterClient />);
    expect(await screen.findByRole("tab", { name: "自社アポ禁", selected: true })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "解除" }));
    return fetchMock;
  }

  it("opens and closes the release modal", async () => {
    await openReleaseModal();

    const dialog = screen.getByRole("dialog", { name: "自社アポ禁を解除する" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("0285720215")).toBeInTheDocument();
    expect(within(dialog).getByText("重クレーム")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("dialog", { name: "自社アポ禁を解除する" })).not.toBeInTheDocument();
  });

  it("keeps submit disabled when the release reason is empty", async () => {
    await openReleaseModal();

    expect(screen.getByRole("button", { name: "解除する" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("解除理由（必須）"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "解除する" })).toBeDisabled();
  });

  it("sends the trimmed release reason to PATCH", async () => {
    const fetchMock = await openReleaseModal();

    fireEvent.change(screen.getByLabelText("解除理由（必須）"), { target: { value: "  本人から再架電の了承あり  " } });
    fireEvent.click(screen.getByRole("button", { name: "解除する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/soil/list/internal-block/block-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ reason: "本人から再架電の了承あり" }),
      }),
    ));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "自社アポ禁を解除する" })).not.toBeInTheDocument());
    expect(screen.getByText("解除しました")).toBeInTheDocument();
  });

  it("shows the API error in the release modal", async () => {
    await openReleaseModal({ internalBlockRelease: { status: 400, body: { error: "解除理由を入力してください" } } });

    fireEvent.change(screen.getByLabelText("解除理由（必須）"), { target: { value: "登録間違い" } });
    fireEvent.click(screen.getByRole("button", { name: "解除する" }));

    expect(await screen.findByText("解除理由を入力してください")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "自社アポ禁を解除する" })).toBeInTheDocument();
  });
});

describe("ListMasterClient multi-select filters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens, checks values, toggles a region, and shows the closed summary", async () => {
    installFetch();
    render(<ListMasterClient />);

    const button = await screen.findByRole("button", { name: /都道府県 指定なし/ });
    fireEvent.click(button);
    expect(screen.getByRole("checkbox", { name: "近畿をすべて選ぶ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "すべて選ぶ" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "大阪府（11,165）" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "奈良県（709）" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "大阪（12）" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.getByRole("button", { name: /都道府県 大阪府、奈良県 ほか1（3）/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /都道府県/ }));
    const groupCheckbox = screen.getByRole("checkbox", { name: "近畿をすべて選ぶ" });
    const group = groupCheckbox.closest("div");
    expect(group).not.toBeNull();
    expect(groupCheckbox).toBeChecked();
    fireEvent.click(groupCheckbox);
    expect(within(group as HTMLElement).getByRole("checkbox", { name: "大阪府（11,165）" })).not.toBeChecked();
    expect(within(group as HTMLElement).getByRole("checkbox", { name: "奈良県（709）" })).not.toBeChecked();
    expect(groupCheckbox).not.toBeChecked();
    fireEvent.click(groupCheckbox);
    expect(within(group as HTMLElement).getByRole("checkbox", { name: "大阪府（11,165）" })).toBeChecked();
    expect(within(group as HTMLElement).getByRole("checkbox", { name: "奈良県（709）" })).toBeChecked();

    // 右上のボタンは「すべて選ぶ」⇄「すべて外す」の兼任
    fireEvent.click(screen.getByRole("button", { name: "すべて選ぶ" }));
    expect(screen.getByRole("button", { name: "すべて外す" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "北海道（124,880）" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "すべて外す" }));
    expect(screen.getByRole("button", { name: "すべて選ぶ" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "大阪府（11,165）" })).not.toBeChecked();
  });
});

describe("MultiSelectFilter initial limit", () => {
  const manyOptions = Array.from({ length: 2452 }, (_, index) => {
    const number = index + 1;
    return {
      value: `vendor-${number}`,
      label: `購入先${String(number).padStart(4, "0")}`,
      count: 3000 - number,
      empty: false,
    };
  });

  it("renders only the first limited options at first and searches all options", () => {
    render(
      <MultiSelectFilter
        label="購入先で絞る"
        value={[]}
        groups={[{ options: manyOptions }]}
        onChange={() => undefined}
        searchable
        initialLimit={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /購入先で絞る 指定なし/ }));
    expect(screen.getByRole("checkbox", { name: "購入先0100（2,900）" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "購入先0101（2,899）" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: /購入先\d{4}/ })).toHaveLength(100);
    expect(screen.getByText("上位 100 件を表示中（全 2,452 件）。名前で絞ると全体から探せます")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("名前で絞る"), { target: { value: "2452" } });
    expect(screen.getByRole("checkbox", { name: "購入先2452（548）" })).toBeInTheDocument();
    expect(screen.queryByText("上位 100 件を表示中（全 2,452 件）。名前で絞ると全体から探せます")).not.toBeInTheDocument();
  });

  it("keeps selected values visible even when they are outside the initial limit", () => {
    render(
      <MultiSelectFilter
        label="購入先で絞る"
        value={["vendor-2452"]}
        groups={[{ options: manyOptions }]}
        onChange={() => undefined}
        searchable
        initialLimit={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /購入先で絞る 購入先2452/ }));
    expect(screen.getByRole("checkbox", { name: "選択中をすべて選ぶ" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "購入先2452（548）" })).toBeChecked();
    expect(screen.getAllByRole("checkbox", { name: /購入先\d{4}/ })).toHaveLength(101);
  });

  it("renders every option when initialLimit is not set", () => {
    render(
      <MultiSelectFilter
        label="購入先で絞る"
        value={[]}
        groups={[{ options: manyOptions.slice(0, 120) }]}
        onChange={() => undefined}
        searchable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /購入先で絞る 指定なし/ }));
    expect(screen.getByRole("checkbox", { name: "購入先0120（2,880）" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: /購入先\d{4}/ })).toHaveLength(120);
  });
});
