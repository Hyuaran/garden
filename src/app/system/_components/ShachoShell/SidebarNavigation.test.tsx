import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SidebarNavigation, { UPCOMING_STORAGE_KEY } from "./SidebarNavigation";
import { SYSTEM_MENU_ITEMS } from "./shacho-shell-config";

const upcoming = SYSTEM_MENU_ITEMS.filter(item => item.upcoming);
let resize = () => {};
const observe = vi.fn();
const disconnect = vi.fn();

function renderNavigation(count = upcoming.length) {
  return render(<SidebarNavigation upcomingCount={count} upcoming={upcoming.map(item => <span key={item.label}>{item.label}</span>)}>
    <a href="/system">ホーム</a><a href="/p/toss">関電トスポータル</a>
  </SidebarNavigation>);
}

describe("Systemのサイドバーメニュー", () => {
  beforeEach(() => {
    localStorage.clear();
    observe.mockClear(); disconnect.mockClear();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("既定ではこれからの4項目を描画せず、件数と線画を表示する", () => {
    renderNavigation();
    const button = screen.getByRole("button", { name: /これから/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("4");
    expect(button.querySelector("svg path")).not.toBeNull();
    expect(button.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const item of upcoming) expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    expect(localStorage.getItem(UPCOMING_STORAGE_KEY)).toBeNull();
  });

  it("クリックで開閉し、4項目を元の順で表示して状態を保存する", () => {
    renderNavigation();
    const button = screen.getByRole("button", { name: /これから/ });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const region = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(region).not.toHaveAttribute("hidden");
    expect([...region.children].map(item => item.textContent)).toEqual(upcoming.map(item => item.label));
    expect(localStorage.getItem(UPCOMING_STORAGE_KEY)).toBe("true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    for (const item of upcoming) expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    expect(localStorage.getItem(UPCOMING_STORAGE_KEY)).toBe("false");
  });

  it.each([true, false])("再マウント後も開閉状態%sを復元する", open => {
    localStorage.setItem(UPCOMING_STORAGE_KEY, String(open));
    const first = renderNavigation(); first.unmount();
    renderNavigation();
    expect(screen.getByRole("button", { name: /これから/ })).toHaveAttribute("aria-expanded", String(open));
    expect(localStorage.getItem(UPCOMING_STORAGE_KEY)).toBe(String(open));
  });

  it("保存済みでもサーバーHTMLは閉じた状態とし、hydrationの初期表示を揃える", () => {
    localStorage.setItem(UPCOMING_STORAGE_KEY, "true");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToStaticMarkup(<SidebarNavigation upcomingCount={4} upcoming={<span>準備中の項目</span>}><a href="/system">ホーム</a></SidebarNavigation>);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("準備中の項目");
    expect(read).not.toHaveBeenCalled();
  });

  it("不正な保存値は閉じた状態として扱う", () => {
    localStorage.setItem(UPCOMING_STORAGE_KEY, "broken");
    renderNavigation();
    expect(screen.getByRole("button", { name: /これから/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("localStorage自体の取得がSecurityErrorでも閉じた状態で描画する", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(() => renderNavigation()).not.toThrow();
    const button = screen.getByRole("button", { name: /これから/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("getItemの例外でも初期描画を継続する", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("read failed"); });
    renderNavigation();
    expect(screen.getByRole("button", { name: /これから/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("書き込みが失敗してもその画面では開閉できる", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    renderNavigation();
    const button = screen.getByRole("button", { name: /これから/ });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("upcomingが0件なら空の開閉ボタンを作らない", () => {
    renderNavigation(0);
    expect(screen.queryByRole("button", { name: /これから/ })).not.toBeInTheDocument();
  });

  it("最上部・途中・最下部で必要なぼかしだけを表示する", () => {
    const { container } = renderNavigation();
    const nav = screen.getByRole("navigation", { name: "Systemメニュー" });
    Object.defineProperties(nav, { scrollHeight: { configurable: true, value: 900 }, clientHeight: { configurable: true, value: 300 } });
    fireEvent.scroll(nav);
    expect(container.querySelector('[data-scroll-fade="top"]')).toBeNull();
    expect(container.querySelector('[data-scroll-fade="bottom"]')).not.toBeNull();
    nav.scrollTop = 100; fireEvent.scroll(nav);
    expect(container.querySelectorAll("[data-scroll-fade]")).toHaveLength(2);
    nav.scrollTop = 600; fireEvent.scroll(nav);
    expect(container.querySelector('[data-scroll-fade="top"]')).not.toBeNull();
    expect(container.querySelector('[data-scroll-fade="bottom"]')).toBeNull();
    nav.scrollTop = 0; fireEvent.scroll(nav);
    expect(container.querySelector('[data-scroll-fade="top"]')).toBeNull();
  });

  it("内容や表示領域のサイズ変更で再判定し、全部収まればぼかしを消す", () => {
    const { container, unmount } = renderNavigation();
    const nav = screen.getByRole("navigation", { name: "Systemメニュー" });
    let height = 900;
    Object.defineProperties(nav, { scrollHeight: { configurable: true, get: () => height }, clientHeight: { configurable: true, value: 300 } });
    act(() => resize());
    expect(container.querySelectorAll("[data-scroll-fade]")).toHaveLength(1);
    height = 300;
    act(() => resize());
    expect(container.querySelectorAll("[data-scroll-fade]")).toHaveLength(0);
    expect(observe).toHaveBeenCalledWith(nav);
    expect(observe).toHaveBeenCalledWith(nav.firstElementChild);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("ResizeObserverがない環境でもresizeで追従する", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { container } = renderNavigation();
    const nav = screen.getByRole("navigation", { name: "Systemメニュー" });
    Object.defineProperties(nav, { scrollHeight: { configurable: true, value: 600 }, clientHeight: { configurable: true, value: 300 } });
    fireEvent.resize(window);
    expect(container.querySelector('[data-scroll-fade="bottom"]')).not.toBeNull();
  });
});
