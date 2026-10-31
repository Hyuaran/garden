import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HelpButton from "./HelpButton";
const route = vi.hoisted(() => ({ pathname: "/system/innovera-calls", search: "" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.search), useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => { route.pathname = "/system/innovera-calls"; route.search = ""; });

it("opens the matching operation document and links to its manual page", () => {
  render(<HelpButton />);
  fireEvent.click(screen.getByRole("button", { name: "この画面の使い方" }));
  const dialog = screen.getByRole("dialog", { name: "INNOVERA履歴・録音の使い方" });
  expect(dialog).toHaveAttribute("data-size", "lg");
  const iframe = within(dialog).getByTitle("INNOVERA履歴・録音 使い方") as HTMLIFrameElement;
  expect(iframe).toHaveAttribute("src", "/api/system/manuals/system/innovera-calls/1_operation.html?embed=1");
  expect(iframe).toHaveAttribute("scrolling", "no");
  expect(within(dialog).getByRole("link", { name: "別のタブで開く" })).toHaveAttribute("href", "/system/manuals/system/innovera-calls?tab=operation");
  // 別のタブで開くは題の行（× の左）・下の［閉じる］は無い
  expect(dialog.querySelector(".garden-modal-heading")?.contains(within(dialog).getByRole("link", { name: "別のタブで開く" }))).toBe(true);
  expect(within(dialog).getAllByRole("button", { name: "閉じる" })).toHaveLength(1);
  expect(within(dialog).getByRole("link")).toHaveAttribute("target", "_blank");
  act(() => window.dispatchEvent(new MessageEvent("message", { source: iframe.contentWindow, origin: window.location.origin, data: { __docHeight: 1200 } })));
  expect(iframe).toHaveStyle({ height: "1200px" });
  act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://untrusted.invalid", data: { __docHeight: 4000 } })));
  expect(iframe).toHaveStyle({ height: "1200px" });
  fireEvent.click(within(dialog).getAllByRole("button", { name: "閉じる" }).at(-1)!);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("disables unavailable help and provides the shared tooltip", () => {
  route.pathname = "/bloom/workboard";
  render(<HelpButton />);
  const button = screen.getByRole("button", { name: "この画面の使い方" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("title", "この画面の使い方");
  expect(screen.getByRole("tooltip")).toHaveTextContent("この画面の使い方は準備中です");
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("changes manuals with the URL tab", () => {
  route.pathname = "/my"; route.search = "tab=report";
  const view = render(<HelpButton />);
  fireEvent.click(screen.getByRole("button", { name: "この画面の使い方" }));
  expect(screen.getByTitle("AP日報 使い方")).toHaveAttribute("src", "/api/system/manuals/system/ap-daily/1_operation.html?embed=1");
  fireEvent.click(screen.getAllByRole("button", { name: "閉じる" }).at(-1)!);
  route.search = "tab=shift"; view.rerender(<HelpButton />);
  fireEvent.click(screen.getByRole("button", { name: "この画面の使い方" }));
  expect(screen.getByTitle("シフト 使い方")).toHaveAttribute("src", "/api/system/manuals/system/shift/1_operation.html?embed=1");
});
