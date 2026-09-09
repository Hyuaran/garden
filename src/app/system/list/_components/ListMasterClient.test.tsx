import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_OPTION_VALUE } from "../_lib/list-fields";

import { ListMasterClient, buildOptionGroups, conditionToFilters, filtersToCondition, type FilterState } from "./ListMasterClient";

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status }));
}

function installFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/soil/list/conditions") return json({ ok: true, conditions: [] });
    if (url === "/api/soil/list/exports") return json({ ok: true, exports: [] });
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
    expect(await screen.findByText(/コール履歴の反映：9\/7 まで/)).toBeInTheDocument();
    expect(screen.getByText(/最終反映 9\/7 19:35/)).toBeInTheDocument();
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
