import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import { TransferInboxTray } from "./TransferInboxTray";

it("行から内容を開き、破棄は小窓から確認したときだけ実行する", async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === "PATCH"
    ? { ok: true, item: {} }
    : { ok: true, items: [{ id: "inbox-1", file_name: "請求書.pdf", mime_type: "application/pdf", public_url: "https://example.com/invoice.pdf", imported_at: "2026-10-31T00:00:00Z" }] }));
  vi.stubGlobal("fetch", fetch);
  render(<TransferInboxTray />);
  const row = (await screen.findByText("請求書.pdf")).closest("tr")!;
  expect(screen.queryByRole("columnheader", { name: "操作" })).not.toBeInTheDocument();
  expect(row.querySelector("button")).toBeNull();
  fireEvent.click(within(row).getByRole("link", { name: "プレビュー" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.keyDown(row, { key: " " });
  const dialog = screen.getByRole("dialog", { name: "未処理ファイル" });
  fireEvent.click(within(dialog).getByRole("button", { name: "破棄" }));
  expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  fireEvent.click(within(screen.getByRole("dialog", { name: "破棄の確認" })).getByRole("button", { name: "破棄" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/bud/transfer-inbox", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "discard", id: "inbox-1" }) })));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
