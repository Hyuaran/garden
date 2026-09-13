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

function installFetch(options: { uploads?: unknown[] } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/soil/list/conditions") return json({ ok: true, conditions: [] });
    if (url === "/api/soil/list/exports") return json({ ok: true, exports: [] });
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
    if (url === "/api/soil/list/analysis") {
      return json({
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
                  rowCount: 13,
                  calledCount: 10,
                  callTotal: 20,
                  invalidCount: 0,
                  validCount: 13,
                  orderCount: 1,
                  acquiredCount: 0,
                  lastCalledOn: "2026-09-12",
                  segmentLastCalledOn: null,
                  rotation: 1.5,
                  orderRateValid: 1 / 13,
                  orderRateTotal: 1 / 13,
                  results: [{ result: "留守", rowCount: 13 }],
                },
              ],
            },
            activeList: { segments: [] },
            contract: { pending: true },
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
