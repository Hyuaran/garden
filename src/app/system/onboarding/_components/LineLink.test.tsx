import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LineLink from "./LineLink";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = (body: unknown) => ({ ok: true, json: async () => body });
it("QRと送る文を表示し、登録後に確認を止める", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(response({ linked: false, message: "連携 1571-4K7P", svg: '<svg width="220"></svg>' })).mockResolvedValue(response({ linked: true, name: "太郎" }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => { render(<LineLink />); });
  expect(screen.getByRole("img", { name: /QR コード/ })).toBeInTheDocument();
  expect(screen.getByText("連携 1571-4K7P")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "コピーする" })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByText("登録できました")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("登録済みでは案内文だけ表示する", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ linked: true, name: "太郎" })));
  await act(async () => { render(<LineLink />); });
  expect(screen.getByText("公式 LINE は登録済みです（太郎さん）")).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
});
it("10分で確認を止め、閉じた後も確認しない", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(response({ linked: false, message: "連携 1571-4K7P" }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => { render(<LineLink />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(600000); });
  const count = fetcher.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(count);
  cleanup();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(count);
});
