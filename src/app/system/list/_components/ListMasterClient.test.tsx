import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_OPTION_VALUE } from "../_lib/list-fields";

import { ListMasterClient, buildOptionGroups, conditionToFilters, filtersToCondition, type FilterState } from "./ListMasterClient";

vi.mock("react-chartjs-2", () => ({
  Doughnut: () => <div data-testid="analysis-doughnut" />,
}));

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

function installFetch(options: { uploads?: unknown[]; analysis?: unknown; conditions?: unknown[] } = {}) {
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
        { phoneNumber: "072****81", name: "嶋*", addressCity: "大阪府大阪市", listName: "大阪AU", lastCalledOn: "2026-09-09", callCount: 2, purchaseStatus: "完パケ" },
      ],
      page: JSON.parse(String(init.body)).page ?? 1,
      pageSize: 100,
      sort: JSON.parse(String(init.body)).sort ?? null,
    });
    if (url === "/api/soil/list/export" && init?.method === "POST") {
      return Promise.resolve(new Response(new Blob(["export"]), {
        status: 200,
        headers: { "Content-Disposition": "attachment; filename=\"list-master.csv\"; filename*=UTF-8''%E3%83%AA%E3%82%B9%E3%83%88.csv" },
      }));
    }
    if (url === "/api/soil/list/uploads") return json({ ok: true, uploads: options.uploads ?? [] });
    if (url === "/api/soil/list/orders/status") {
      return json({ ok: true, state: { lastRunAt: "2026-09-11T21:30:00Z", records: 12666, orderRows: 19434, phoneUpdates: 9506, deletedRows: 0, elapsedMs: 1200, error: null } });
    }
    if (url === "/api/soil/list/purchase-vendors") {
      return json({ ok: true, vendors: [{ value: "データ総研", count: 1200 }, { value: "ABC", count: 20 }] });
    }
    if (url === "/api/soil/list/uploads/upload-failed/apply" && init?.method === "POST") {
      return json({ ok: true, result: { assignments: 2500, assignments_new: 2500, assignments_updated: 0, parent_updated: 2500, parent_inserted: 0, parent_kept: 0, skipped: 0, remaining: 0, purchase_inserted: 0 } });
    }
    if (url === "/api/soil/list/analysis/detail?block=vendor&segment=__all__&result=%E7%95%99%E5%AE%88") {
      return json({
        ok: true,
        rows: [
          { listName: "データ総研", listLoadedOn: "2026-09-12", rowCount: 546083, calledCount: 546083, callTotal: 546083, orderCount: 3, acquiredCount: 1, lastCalledOn: "2026-09-12" },
        ],
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
                  acquiredCount: 1,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 1.5,
                  orderRateValid: 3 / 25,
                  orderRateTotal: 3 / 28,
                  results: [{ result: "留守", rowCount: 546083 }],
                },
                {
                  segment: "データ総研",
                  rowCount: 13,
                  calledCount: 10,
                  callTotal: 20,
                  invalidCount: 1,
                  validCount: 12,
                  orderCount: 1,
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
          appointmentBlocked: [
            { value: "", label: "（空欄）", count: 1945619, empty: true },
            { value: "戸建", label: "戸建", count: 500, empty: false },
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
    expect(guide.getAllByRole("table")).toHaveLength(2);
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

    fireEvent.click(screen.getByRole("tab", { name: "アップロード" }));
    expect(window.location.search).toBe("?tab=upload");
    expect(screen.getByText("リストの取込ファイルをアップロード")).toBeInTheDocument();
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

    const analysisTable = vendor.getAllByRole("table").find((table) => within(table).queryByRole("columnheader", { name: /購入先/ }));
    expect(analysisTable).toBeTruthy();
    const bodyRows = within(analysisTable as HTMLElement).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(3);
    expect(within(bodyRows[0]).getAllByRole("cell").map((cell) => cell.textContent).slice(0, 4)).toEqual([
      "合計（選んだ 2 つ）",
      "23",
      "17",
      "36",
    ]);
    expect(within(bodyRows[1]).getAllByRole("cell")[0]).toHaveTextContent("データ総研");
    expect(within(bodyRows[2]).getAllByRole("cell")[0]).toHaveTextContent("ラディッシュ");
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
    expect(screen.getByText("新規 10／更新 990／購入履歴 10")).toBeInTheDocument();
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
      appointmentBlocked: [EMPTY_OPTION_VALUE, "戸建"],
      listName: "",
      listLoadedOnFrom: "",
      listLoadedOnTo: "",
      recheckedOnFrom: "",
      recheckedOnTo: "",
      lastCalledOnFrom: "",
      lastCalledOnTo: "",
      callCountFrom: "",
      callCountTo: "",
      purchaseHistory: "",
    };

    expect(filtersToCondition(base)).toEqual({
      filters: [
        { field: "prefecture", op: "eq", value: "大阪府" },
        { field: "auCallAvailability", op: "in", value: ["○", "×"] },
        { field: "purchaseStatus", op: "in", value: ["完パケ", "電話番号のみ"] },
        { field: "appointmentBlocked", op: "inOrEmpty", value: ["戸建"] },
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
        ],
      }),
    ).toMatchObject({
      prefecture: ["大阪府"],
      appointmentBlocked: [EMPTY_OPTION_VALUE],
      auCallAvailability: ["○", "×"],
      purchaseStatus: ["完パケ", EMPTY_OPTION_VALUE],
    });
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
    expect(screen.getByRole("heading", { name: "一覧（12,563 件・個人情報は一部伏せる）" })).toBeInTheDocument();
    expect(screen.getByText("1 / 126 ページ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "条件を変える" }));
    expect(screen.getByRole("button", { name: "検索" })).toBeInTheDocument();
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
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
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
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("この条件を削除しますか"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/soil/list/conditions/condition-1", { method: "DELETE" }));
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
    await waitFor(() => expect(screen.getByText("12,563 件を Excel で書き出しました")).toBeInTheDocument());
    const exportCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/soil/list/export" && init?.method === "POST");
    expect(exportCall).toBeTruthy();
    expect(JSON.parse(String(exportCall?.[1]?.body))).toMatchObject({ format: "xlsx", sortKey: "listLoadedOnAsc" });
    expect(JSON.parse(String(exportCall?.[1]?.body))).not.toHaveProperty("limit");
  });

  it("confirms exports over 100,000 rows before downloading", async () => {
    stubDownloadApis();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    installFetch();
    render(<ListMasterClient />);

    fireEvent.click(await screen.findByRole("button", { name: "検索" }));
    await screen.findByText("該当 12,563 件（0.8 秒）");
    // 画面の件数だけを大きくするため、次の count 応答を差し替える。
    vi.mocked(fetch).mockImplementationOnce(() => json({ ok: true, count: 120000, approximate: false, elapsedMs: 800 }) as unknown as ReturnType<typeof fetch>);
    fireEvent.click(screen.getByRole("button", { name: "条件を変える" }));
    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    await screen.findByText("該当 120,000 件（0.8 秒）");
    fireEvent.click(screen.getByRole("button", { name: "120,000 件を書き出す" }));

    expect(confirm).toHaveBeenCalledWith("約 120,000 件を書き出します（目安 6 分）。よろしいですか");
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
