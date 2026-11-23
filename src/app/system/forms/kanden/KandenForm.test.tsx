import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preparePhotoUploads, reserveKandenSpecsSlots, sendKandenForm } from "./actions";
import KandenForm from "./KandenForm";
import { findSalesCase, lookupKandenPd } from "./sales-actions";
import { EMPTY_CUSTOMER, EMPTY_FORM, type Submission } from "@/lib/leaf-kanden/submissions";

vi.mock("./actions", () => ({
  preparePhotoUploads: vi.fn(), reserveKandenSpecsSlots: vi.fn(), sendKandenForm: vi.fn(),
}));
vi.mock("./sales-actions", () => ({
  lookupKandenPd: vi.fn(), findSalesCase: vi.fn(), loadSalesCases: vi.fn(), loadSalesPhotos: vi.fn(),
  loadSalesProfile: vi.fn(), submitKandenInfoUpdate: vi.fn(), unlockKandenForm: vi.fn(),
}));
vi.mock("./photo-client", () => ({
  compressKandenPhoto: async () => new Blob(["mock image"], { type: "image/jpeg" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  vi.mocked(preparePhotoUploads).mockResolvedValue({ uploads: [{ url: "https://storage.example.test/signed" }] });
  vi.mocked(sendKandenForm).mockResolvedValue({ recent: [] });
  vi.mocked(lookupKandenPd).mockResolvedValue({
    customer: { ...EMPTY_CUSTOMER, name: "テスト顧客", listName: "テスト用リスト" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function attach(input: Element) {
  fireEvent.change(input, { target: { files: [new File(["mock"], "photo.jpg", { type: "image/jpeg" })] } });
}

it("PD照合後に写メを検査し、諸元待ちの承認後に送信内容を確認する", async () => {
  render(<KandenForm name="山田 太郎" number="001" mobile initialRecent={[]} />);
  fireEvent.click(screen.getByRole("radio", { name: "奪還" }));
  const pd = screen.getByRole("textbox", { name: "PD番号" });
  fireEvent.change(pd, { target: { value: "PD0000010" } });
  fireEvent.change(pd, { target: { value: "ＰＤ０００００２０（２）" } });
  expect(lookupKandenPd).not.toHaveBeenCalled();
  expect(await screen.findByRole("textbox", { name: "お客様名" })).toHaveValue("テスト顧客");
  expect(lookupKandenPd).toHaveBeenCalledExactlyOnceWith("PD0000020(2)");
  const review = screen.getByRole("button", { name: "送信する" });
  fireEvent.click(review);
  expect(screen.getByText("電灯・動力・ガスのいずれかの写メを添付してください。")).toBeInTheDocument();

  const capture = screen.getByRole("button", { name: "電灯を撮る" });
  fireEvent.click(capture);
  const guide = screen.getByRole("dialog", { name: "電灯の撮影" });
  fireEvent.click(within(guide).getByRole("button", { name: "ファイル選択" }));
  const picker = capture.parentElement?.parentElement;
  attach(picker!.querySelector("input[type=file]")!);
  await waitFor(() => expect(review).toBeEnabled());
  expect(fetch).toHaveBeenCalledWith("https://storage.example.test/signed", expect.objectContaining({ method: "PUT" }));

  fireEvent.click(review);
  const warning = screen.getByRole("dialog", { name: "諸元が添付されていません" });
  fireEvent.click(within(warning).getByRole("button", { name: "諸元待ちで送信" }));
  const confirmation = screen.getByRole("dialog", { name: "送信内容の確認" });
  expect(within(confirmation).getByText("1 枚")).toBeInTheDocument();
  expect(sendKandenForm).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole("button", { name: "送信する" }));
  expect(await screen.findByText("送信しました。事務に知らせました。")).toBeInTheDocument();
  expect(sendKandenForm).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kanri_no_raw: "ＰＤ０００００２０（２）", has_denki: true }),
    [{ kind: "denki", index: 1 }], true);
});

it("リスト外の選択と14桁の入力から供給地点の候補を作る", async () => {
  vi.mocked(lookupKandenPd).mockResolvedValueOnce({ customer: null });
  render(<KandenForm name="テスト社員" number="001" mobile initialRecent={[]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "PD番号" }), { target: { value: "PD0000030" } });
  await screen.findByText("リストに見つかりません。リスト外の案件ですか？");
  fireEvent.click(screen.getByRole("radio", { name: "いいえ" }));
  expect(screen.queryByRole("textbox", { name: "リスト外のお客様番号" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "はい" }));
  fireEvent.change(screen.getByRole("textbox", { name: "リスト外のお客様番号" }), {
    target: { value: "００００-００００-００００-０１" },
  });
  expect(screen.getByRole("textbox", { name: "関電お客様番号" })).toHaveValue("0000-0000-0000-01");
  expect(screen.getByRole("textbox", { name: "供給地点番号" })).toHaveValue("060-0000-0000-0000-01-00001");
  expect(lookupKandenPd).toHaveBeenCalledTimes(1);
});

const existingCase: Submission = {
  ...EMPTY_FORM, id: "71a98347-7348-4a56-8fac-1f38fd2af413", set_id: "set", kanri_no: "123",
  customer_name: "佐藤 花子", employee_name: "山田 太郎", has_denki: true,
  specs_status: "諸元待ち", photo_count: 1, submitted_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z",
};

it("最近の送信から同じ送信に諸元を追加する", async () => {
  const row = existingCase;
  vi.mocked(reserveKandenSpecsSlots).mockResolvedValue({ first: 10001 });
  vi.mocked(sendKandenForm).mockResolvedValue({ recent: [{ ...row, specs_status: "あり", photo_count: 2 }] });
  render(<KandenForm name="山田 太郎" number="001" mobile initialRecent={[row]} />);
  fireEvent.click(screen.getByRole("button", { name: "案件一覧" }));
  fireEvent.click(screen.getByText(/PD番号なし|2026-11-20/));
  fireEvent.click(screen.getByRole("button", { name: "諸元を追加" }));
  const modal = await screen.findByRole("dialog", { name: "諸元を追加" });
  attach(modal.querySelector("input[type=file][multiple]")!);
  const send = within(modal).getByRole("button", { name: "諸元を送信する" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  expect(await screen.findByText("諸元を追加しました。")).toBeInTheDocument();
  expect(screen.getByText(/写メ 2 枚.*諸元あり/)).toBeInTheDocument();
  expect(sendKandenForm).toHaveBeenCalledWith(row.id, null, [{ kind: "specs", index: 10001 }], false);
});

it("後付けモードで案件を確認して諸元を送り、新規送信の入力に戻る", async () => {
  vi.mocked(findSalesCase).mockResolvedValue({ row: existingCase });
  vi.mocked(reserveKandenSpecsSlots).mockResolvedValue({ first: 10001 });
  render(<KandenForm name="山田 太郎" number="001" mobile initialRecent={[]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "メモ" }), { target: { value: "送信前のメモ" } });
  fireEvent.click(screen.getByRole("button", { name: "諸元のみ後付け送信" }));
  fireEvent.change(screen.getByRole("textbox", { name: "案件番号" }), { target: { value: existingCase.id } });
  fireEvent.click(screen.getByRole("button", { name: "案件を確認" }));
  fireEvent.click(await screen.findByRole("button", { name: "諸元を追加する" }));
  const picker = await screen.findByRole("button", { name: "諸元（後付け）を選ぶ" });
  attach(picker.parentElement!.parentElement!.querySelector("input[type=file][multiple]")!);
  const send = screen.getByRole("button", { name: "この案件に諸元を追加送信" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  expect(await screen.findByText("諸元を追加しました。")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "メモ" })).toHaveValue("送信前のメモ");
  expect(sendKandenForm).toHaveBeenCalledWith(existingCase.id, null, [{ kind: "specs", index: 10001 }], false);
});
