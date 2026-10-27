import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SystemViewProvider, SystemViewButton, SystemViewHeading } from "./SystemViewContext";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const value = { pageKey: "system-sites", admin: false, canAdd: false, tabs: [{ key: "news", label: "お知らせ", allowed: true, canAdd: false }] };

it("一般の閲覧者には歯車も追加ボタンも出さない", () => {
  render(<SystemViewProvider value={value}><SystemViewHeading><h1>コーポレートサイト</h1></SystemViewHeading></SystemViewProvider>);
  expect(screen.queryByRole("button")).toBeNull();
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
    it("keeps the gear inline after the heading at " + width + "px in " + theme, () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      document.documentElement.dataset.theme = theme;
      render(<SystemViewProvider value={{ ...value, admin: true }}><SystemViewHeading><h1>マニュアル</h1></SystemViewHeading></SystemViewProvider>);
      const heading = screen.getByRole("heading", { name: /^マニュアル/ });
      const gear = screen.getByRole("button", { name: "見られる人の設定" });
      expect(heading).toContainElement(gear);
      expect(heading.firstChild?.textContent).toBe("マニュアル");
      expect(gear.closest("span")).toBe(heading.lastChild);
      delete document.documentElement.dataset.theme;
    });
  }
}
