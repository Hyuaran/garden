import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { loadEntryDetail, loadEntryList } from "./actions";
import { entryQuery, type EntryDetail, type EntryDraft, type EntryList } from "./entry";
import EntryScreen from "./EntryScreen";
import { saveEntryPhotoCategory } from "./photo-actions";

vi.mock("./actions", () => ({ checkEntryDuplicates: vi.fn(), loadEntryDetail: vi.fn(), loadEntryList: vi.fn(), saveEntry: vi.fn() }));
vi.mock("./specs-actions", () => ({ commitEntrySpecs: vi.fn(), prepareEntrySpecs: vi.fn() }));
vi.mock("./photo-actions", () => ({ saveEntryPhotoCategory: vi.fn() }));

function detail(name: string): EntryDetail {
  return {
    draft: { customer_name: name, specs_on: "2026-11-20" } as EntryDraft,
    listValues: { customer_name: name }, photos: [], duplicates: {}, history: [], payments: [],
    status: "エントリー待ち", version: null, reason: null, paidOn: null, refundedOn: null,
  };
}

const initial: EntryList = {
  rows: [["entry", "1", "入力案件", null, "エントリー待ち", null]],
  total: 1, page: 1, counts: { "エントリー待ち": 1, "郵送待ち": 51 }, updatedAt: null, options: null,
};

beforeEach(() => vi.resetAllMocks());

it("エントリー待ちの詳細から始まり、一覧で選んだ案件を同じタブで開く", async () => {
  const next = Promise.withResolvers<Awaited<ReturnType<typeof loadEntryList>>>();
  vi.mocked(loadEntryList).mockReturnValue(next.promise);
  vi.mocked(loadEntryDetail).mockResolvedValue({ detail: detail("郵送案件") });
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={detail("入力案件")} />);
  const tabs = within(screen.getByLabelText("案件の状況")).getAllByRole("tab");
  expect(tabs.map(tab => tab.textContent)).toEqual([
    "一覧", "諸元待ち0", "エントリー待ち1", "申込書待ち0", "郵送待ち51", "入金待ち0", "完了0", "キャンセル0", "差し戻し0",
  ]);
  expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  fireEvent.click(tabs[0]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByDisplayValue("入力案件").closest("[data-loading]")).toHaveAttribute("data-loading", "true");
  expect(loadEntryList).toHaveBeenCalledExactlyOnceWith("一覧", entryQuery, false, false, undefined);
  next.resolve({ list: { ...initial, rows: [["mail", "2", "郵送案件", "2026-11-01", "郵送待ち", null]], total: 51 } });
  fireEvent.click(await screen.findByText("郵送案件"));
  expect(await screen.findByDisplayValue("郵送案件")).toBeInTheDocument();
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(loadEntryDetail).toHaveBeenCalledExactlyOnceWith({ id: "mail", intake: false });
  fireEvent.click(screen.getByRole("button", { name: "一覧へ戻る" }));
  expect(screen.getByText("郵送案件")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenCalledTimes(1);
});

it("Ctrl+↑↓でページ境界をまたぎ、ページと詳細を同じ応答で取得する", async () => {
  const firstPage: EntryList = { ...initial, total: 51, rows:
    Array.from({ length: 50 }, (_, i) => ["row-" + i, String(i), "案件" + i, null, "エントリー待ち", null]) };
  vi.mocked(loadEntryList).mockResolvedValueOnce({ list: { ...firstPage, page: 2, counts: null,
    rows: [["row-50", "50", "案件50", null, "エントリー待ち", null]] },
    detailId: "row-50", selectedDetail: { detail: detail("案件50") } })
    .mockResolvedValueOnce({ list: firstPage, detailId: "row-49", selectedDetail: { detail: detail("案件49") } });
  vi.mocked(loadEntryDetail).mockResolvedValue({ detail: detail("関連案件") });
  render(<EntryScreen today="2026-11-20" calendar={[]} list={firstPage} initialDetail={{
    ...detail("案件0"), related: [{ id: "row-49", number: "49", name: "案件49" }],
  }} />);
  fireEvent.click(screen.getByRole("button", { name: "49 案件49" }));
  await screen.findByDisplayValue("関連案件");
  fireEvent.keyDown(window, { ctrlKey: true, key: "ArrowDown" });
  expect(await screen.findByDisplayValue("案件50")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenNthCalledWith(1, "エントリー待ち", { ...entryQuery, page: 2 }, false, false, "first");
  fireEvent.keyDown(window, { ctrlKey: true, key: "ArrowUp" });
  expect(await screen.findByDisplayValue("案件49")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenNthCalledWith(2, "エントリー待ち", entryQuery, false, false, "last");
  expect(loadEntryDetail).toHaveBeenCalledTimes(1);
});

it("入力した検索条件をサーバーに一度だけ送る", async () => {
  vi.mocked(loadEntryList).mockResolvedValue({ list: { ...initial, rows: [], total: 0 } });
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={detail("入力案件")} />);
  fireEvent.keyDown(window, { ctrlKey: true, key: "f" });
  const search = screen.getByRole("form", { name: "案件の条件検索" });
  fireEvent.change(within(search).getByLabelText("ご契約名義"), { target: { value: "山田*" } });
  fireEvent.click(within(search).getByRole("button", { name: "検索条件を追加" }));
  fireEvent.change(within(search).getByLabelText("管理番号"), { target: { value: "==123" } });
  fireEvent.click(within(search).getByRole("button", { name: "全案件を検索" }));
  expect(await screen.findByText("該当する案件はありません。")).toBeInTheDocument();
  expect(loadEntryList).toHaveBeenCalledExactlyOnceWith("一覧", {
    ...entryQuery, requests: [{ customer_name: "山田*" }, { kanri_no: "==123" }],
  }, false, false, undefined);
});

it("転記で照合差分が消え、日付入力で業務ステータスが進む", () => {
  const loaded = detail("編集前");
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={{
    ...loaded, listValues: { customer_name: "受注時の名義" },
  }} />);
  expect(screen.getByLabelText("ご契約名義").closest("[data-comparison]")).toHaveAttribute("data-comparison", "different");
  fireEvent.click(screen.getByRole("button", { name: "ご契約名義をリストから転記" }));
  expect(screen.getByDisplayValue("受注時の名義").closest("[data-comparison]")).toHaveAttribute("data-comparison", "match");
  fireEvent.change(screen.getByLabelText("エントリー日"), { target: { value: "2026-11-20" } });
  expect(within(screen.getByLabelText("業務ステータス")).getByText("申込書待ち").parentElement)
    .toHaveAttribute("aria-current", "step");
});

it("リストに無い案件では転記を無効にし、未分類の写メを最初に開く", () => {
  const initialDetail = {
    ...detail("テスト案件"), listValues: null,
    photos: [{ id: "photo", setId: "set", category: "未分類", url: "https://example.test/photo.jpg", filename: "photo.jpg", jpeg: true }],
  };
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={initialDetail} />);
  expect(screen.getByText("リストに無い案件")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "リスト全項目転記" })).toBeDisabled();
  expect(screen.getByLabelText("ご契約名義").closest("[data-comparison]")).toHaveAttribute("data-comparison", "new");
  const tabs = within(screen.getByLabelText("書類の種類"));
  expect(tabs.getByRole("tab", { name: "未分類" })).toHaveAttribute("aria-selected", "true");
  const preview = within(screen.getByLabelText("申込書プレビュー"));
  expect(preview.getByRole("img")).toHaveAttribute("src", "https://example.test/photo.jpg");
  fireEvent.click(tabs.getByRole("tab", { name: "電灯" }));
  expect(preview.queryByRole("img")).not.toBeInTheDocument();
});

it.each([["電灯", "電灯", "application"], ["未分類", "未分類", "application"]])(
  "諸元と%sの写メがある場合に%sタブを開く",
  (category, tab, firstPhoto) => {
    const initialDetail = {
      ...detail("テスト案件"),
      photos: [
        { id: "specs", setId: "set", category: "諸元", url: "https://example.test/specs.jpg", filename: "specs.jpg", jpeg: true },
        { id: "application", setId: "set", category, url: "https://example.test/application.jpg", filename: "application.jpg", jpeg: true },
      ],
    };
    render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={initialDetail} />);
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByLabelText("申込書プレビュー")).getByRole("img"))
      .toHaveAttribute("src", `https://example.test/${firstPhoto}.jpg`);
  },
);

it("矢印の帯に受注から完了までの表示を並べ、日付に応じた文言を出す", () => {
  const loaded = detail("案件");
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={{
    ...loaded, draft: { ...loaded.draft, ordered_on: "2026-11-19", entered_on: "2026-11-20" },
  }} />);
  const flow = screen.getByLabelText("業務ステータス");
  expect(Array.from(flow.querySelectorAll("strong"), item => item.textContent)).toEqual([
    "受注", "諸元回収OK", "エントリーOK", "申込書待ち", "郵送待ち", "入金待ち", "完了",
  ]);
  expect(within(flow).getByLabelText("受注日")).toHaveValue("2026-11-19");
  expect(within(flow).queryByText("受注日")).toBeNull();
});

it("営業の帯の枝番と申込コードを表示し、コードを欄に転記できる", () => {
  const loaded = detail("案件");
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={{
    ...loaded, listValues: null, rawNumber: "PD1617124(2)",
    draft: { ...loaded.draft, kanri_no: "1617124", sales_name: "萩尾", ordered_on: "2026-11-19" },
    sales: { name: "萩尾拓也", number: "1", department: "営業", applyCodes: [
      { apply_code: "0281-30101", starts_on: null, ends_on: null },
    ] },
  }} />);
  const banner = screen.getByText("PD番号 PD1617124(2)").parentElement!;
  expect(Array.from(banner.children, item => item.textContent)).toEqual([
    "PD番号　PD1617124(2)", "獲得営業担当　萩尾拓也", "社員番号　1", "部署　営業", "申込コード　0281-30101",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "申込コードをリストから転記" }));
  expect(screen.getByLabelText("申込コード")).toHaveValue("0281-30101");
});

it("サムネイルから分類を即時に反映し、拡大表示からの保存に失敗した場合は戻す", async () => {
  const loaded = detail("案件");
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof saveEntryPhotoCategory>>>();
  vi.mocked(saveEntryPhotoCategory).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ error: "保存失敗" });
  render(<EntryScreen today="2026-11-20" calendar={[]} list={initial} initialDetail={{
    ...loaded, draft: { ...loaded.draft, specs_on: null },
    photos: [{ id: "photo", setId: "set", category: "未分類", url: "https://example.test/photo.jpg", filename: "photo.jpg", jpeg: true }],
  }} />);
  fireEvent.click(screen.getByRole("button", { name: "一覧に戻る" }));
  fireEvent.click(within(screen.getByLabelText("写メ 1 の種類")).getByRole("radio", { name: "諸元" }));
  expect(screen.getByRole("tab", { name: "諸元" })).toHaveAttribute("aria-selected", "true");
  const flow = within(screen.getByLabelText("業務ステータス"));
  expect(flow.getByText("諸元待ち")).toBeInTheDocument();
  expect(saveEntryPhotoCategory).toHaveBeenCalledExactlyOnceWith({ id: "entry", intake: false }, "photo", "set", "諸元");
  pending.resolve({});
  await waitFor(() => expect(within(screen.getByLabelText("写メ 1 の種類")).getByRole("radio", { name: "電灯" })).toBeEnabled());
  fireEvent.click(within(screen.getByLabelText("写メ 1 の種類")).getByRole("radio", { name: "電灯" }));
  expect(await screen.findByText("写メの種類を保存できませんでした。もう一度お試しください。")).toBeInTheDocument();
  expect(within(screen.getByLabelText("写メ 1 の種類")).getByRole("radio", { name: "諸元" })).toHaveAttribute("aria-checked", "true");
  expect(saveEntryPhotoCategory).toHaveBeenCalledTimes(2);
});

it("初期のリスト・選択案件・カレンダーの出力を200KB未満に収める", () => {
  const list: EntryList = { ...initial, total: 19_000,
    rows: Array.from({ length: 50 }, (_, i) => [
      "00000000-0000-0000-0000-" + String(i).padStart(12, "0"), String(1504000 + i),
      "お客様".repeat(40), null, "エントリー待ち", null,
    ]) };
  const calendar = Array.from({ length: 1000 }, () => ({ schedule: "01", date: "2026-11-20" }));
  const props = { list, calendar, today: "2026-11-20", initialDetail: detail("入力案件") };
  const markup = renderToStaticMarkup(<EntryScreen {...props} />);
  expect(Buffer.byteLength(markup) + Buffer.byteLength(JSON.stringify(props))).toBeLessThan(200_000);
});
