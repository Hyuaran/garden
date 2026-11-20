import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preparePhotoUploads, reserveKandenSpecsSlots, sendKandenForm } from "./actions";
import KandenForm from "./KandenForm";
import { EMPTY_FORM, type Submission } from "@/lib/leaf-kanden/submissions";

vi.mock("./actions", () => ({
  preparePhotoUploads: vi.fn(), reserveKandenSpecsSlots: vi.fn(), sendKandenForm: vi.fn(),
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
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function attach(input: Element) {
  fireEvent.change(input, { target: { files: [new File(["mock"], "photo.jpg", { type: "image/jpeg" })] } });
}

it("選択した獲得内容の写メを必須とし、諸元待ちの承認後に送信内容を確認する", async () => {
  const { container } = render(<KandenForm name="山田 太郎" number="001" mobile initialRecent={[]} />);
  fireEvent.click(screen.getByRole("radio", { name: "奪還" }));
  fireEvent.change(screen.getByRole("textbox", { name: "お客様名" }), { target: { value: "佐藤 花子" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "電灯" }));
  const review = screen.getByRole("button", { name: "送信する" });
  fireEvent.click(review);
  expect(screen.getByText("電灯の写メを添付してください。")).toBeInTheDocument();

  attach(container.querySelector("input[type=file][multiple]")!);
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
  expect(sendKandenForm).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ kanri_no_raw: "", has_denki: true }),
    [{ kind: "denki", index: 1 }], true);
});

it("最近の送信から同じ送信に諸元を追加する", async () => {
  const row: Submission = {
    ...EMPTY_FORM, id: "71a98347-7348-4a56-8fac-1f38fd2af413", set_id: "set", kanri_no: "123",
    customer_name: "佐藤 花子", employee_name: "山田 太郎", has_denki: true,
    specs_status: "諸元待ち", photo_count: 1, submitted_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z",
  };
  vi.mocked(reserveKandenSpecsSlots).mockResolvedValue({ first: 10001 });
  vi.mocked(sendKandenForm).mockResolvedValue({ recent: [{ ...row, specs_status: "あり", photo_count: 2 }] });
  render(<KandenForm name="山田 太郎" number="001" mobile initialRecent={[row]} />);
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
