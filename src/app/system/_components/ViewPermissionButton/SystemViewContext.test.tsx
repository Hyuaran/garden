import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SystemTabs from "../SystemTabs/SystemTabs";
import { SystemViewProvider, SystemViewButton, SystemViewHeading } from "./SystemViewContext";
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ refresh: vi.fn() }) }));
const value = { pageKey: "system-sites", admin: false, canAdd: false, tabs: [{ key: "news", label: "お知らせ", allowed: true, canAdd: false }] };

it("一般の閲覧者には歯車も追加ボタンも出さない", () => {
  render(<SystemViewProvider value={value}><SystemViewHeading><h1>コーポレートサイト</h1></SystemViewHeading></SystemViewProvider>);
  expect(screen.queryByRole("button", { name: "見られる人の設定" })).toBeNull();
  expect(screen.getByRole("button", { name: "この画面の使い方" })).toBeInTheDocument();
});
it("全権管理者には選択タブの歯車を出す", () => {
  render(<SystemViewProvider value={{ ...value, admin: true }}><SystemViewButton tabKey="news" /></SystemViewProvider>);
  expect(screen.getByRole("button", { name: "見られる人の設定" })).toBeInTheDocument();
});
it("追加がオンの閲覧者にも歯車は出さず、人の追加だけ出す", () => {
  render(<SystemViewProvider value={{ ...value, tabs: [{ ...value.tabs[0], canAdd: true }] }}><SystemViewButton tabKey="news" /></SystemViewProvider>);
  expect(screen.queryByRole("button", { name: "見られる人の設定" })).toBeNull();
  expect(screen.getByRole("button", { name: "＋ 人を追加" })).toBeInTheDocument();
});

for (const width of [1384, 1024, 768, 375]) {
  for (const theme of ["light", "dark"]) {
    it("keeps help beside the heading and settings on the action row at " + width + "px in " + theme, () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      document.documentElement.dataset.theme = theme;
      render(<SystemViewProvider value={{ ...value, admin: true }}><SystemViewHeading><h1>マニュアル</h1></SystemViewHeading><SystemTabs /></SystemViewProvider>);
      const heading = screen.getByRole("heading", { name: /^マニュアル/ });
      const gear = screen.getByRole("button", { name: "見られる人の設定" });
      expect(heading).not.toContainElement(gear);
      expect(gear.closest("[data-system-tabs]")).toBeTruthy();
      expect(heading.parentElement).toContainElement(screen.getByRole("button", { name: "この画面の使い方" }));
      expect(heading.firstChild?.textContent).toBe("マニュアル");

      delete document.documentElement.dataset.theme;
    });
  }
}
