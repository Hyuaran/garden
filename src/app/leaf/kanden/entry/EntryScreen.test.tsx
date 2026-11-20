import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { loadEntryDetail, loadEntryList } from "./actions";
import { entryQuery, type EntryList } from "./entry";
import EntryScreen from "./EntryScreen";

vi.mock("./actions", () => ({ checkEntryDuplicates: vi.fn(), loadEntryDetail: vi.fn(), loadEntryList: vi.fn(), saveEntry: vi.fn() }));

const initial: EntryList = {
  rows: [["intake", "1", "受付案件", null, "受付待ち", null]],
  total: 1, page: 1, counts: { "受付待ち": 1, "郵送待ち": 51 }, updatedAt: null, options: null,
};

beforeEach(() => vi.resetAllMocks());

it("初期タブの行と集計を表示し、次のタブが届くまで前の一覧を保持する", async () => {
  const next = Promise.withResolvers<Awaited<ReturnType<typeof loadEntryList>>>();
  vi.mocked(loadEntryList).mockReturnValue(next.promise);
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} />);
  const tabs = within(screen.getByLabelText("案件の状況")).getAllByRole("tab");
  expect(tabs.map(tab => tab.textContent)).toEqual([
    "受付待ち1", "諸元待ち0", "エントリー待ち0", "申込書待ち0", "郵送待ち51", "入金待ち0", "完了0", "キャンセル0", "保留0", "差し戻し0",
  ]);
  fireEvent.click(tabs[4]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("受付案件")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenCalledExactlyOnceWith("郵送待ち", entryQuery, true);
  expect(loadEntryDetail).not.toHaveBeenCalled();
  next.resolve({ list: { ...initial, rows: [["mail", "2", "郵送案件", "2026-11-01", "郵送待ち", null]], total: 51 } });
  expect(await screen.findByText("郵送案件")).toBeInTheDocument();
  expect(tabs[4]).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByText("受付案件")).not.toBeInTheDocument();
});

it("Ctrl+↑↓でページ境界をまたぎ、選択した1件だけを読み込む", async () => {
  const firstPage: EntryList = { ...initial, total: 51, counts: { "受付待ち": 51 }, rows:
    Array.from({ length: 50 }, (_, i) => ["row-" + i, String(i), "案件" + i, null, "受付待ち", null]) };
  vi.mocked(loadEntryList).mockResolvedValueOnce({ list: { ...firstPage, page: 2, counts: null,
    rows: [["row-50", "50", "案件50", null, "受付待ち", null]] } })
    .mockResolvedValueOnce({ list: { ...firstPage, counts: null } });
  vi.mocked(loadEntryDetail).mockResolvedValue({ error: "詳細取得結果" });
  render(<EntryScreen today="2026-11-20" calendar={[]} list={firstPage} />);
  fireEvent.click(screen.getByText("案件49"));
  expect(await screen.findByText("詳細取得結果")).toBeInTheDocument();
  fireEvent.keyDown(window, { ctrlKey: true, key: "ArrowDown" });
  expect(await screen.findByText("案件50")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenNthCalledWith(1, "受付待ち", { ...entryQuery, page: 2 }, false);
  expect(loadEntryDetail).toHaveBeenNthCalledWith(2, { id: "row-50", intake: true });
  expect(screen.getByText("案件50").closest("tr")).toHaveAttribute("data-selected", "true");
  fireEvent.keyDown(window, { ctrlKey: true, key: "ArrowUp" });
  expect(await screen.findByText("案件49")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenNthCalledWith(2, "受付待ち", entryQuery, false);
  expect(loadEntryDetail).toHaveBeenCalledTimes(3);
  expect(loadEntryDetail).toHaveBeenLastCalledWith({ id: "row-49", intake: true });
});

it("初期一覧50件とカレンダーのコンポーネント出力を200KB未満に収める", () => {
  const list: EntryList = { ...initial, total: 19_000, counts: { "受付待ち": 19_000 },
    rows: Array.from({ length: 50 }, (_, i) => [
      "00000000-0000-0000-0000-" + String(i).padStart(12, "0"), String(1504000 + i),
      "お客様".repeat(40), null, "受付待ち", null,
    ]) };
  const calendar = Array.from({ length: 1000 }, () => ({ schedule: "01", date: "2026-11-20" }));
  const props = { list, calendar, today: "2026-11-20" };
  const markup = renderToStaticMarkup(<EntryScreen {...props} />);
  expect(Buffer.byteLength(markup) + Buffer.byteLength(JSON.stringify(props))).toBeLessThan(200_000);
});
