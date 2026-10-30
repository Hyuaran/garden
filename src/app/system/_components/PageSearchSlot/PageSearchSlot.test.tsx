import { useRef } from "react";
import { useMasterShortcuts } from "@/app/root/_lib/useMasterShortcuts";
﻿import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DataTable from "../DataTable/DataTable";
import { findTableSearch, PageSearchActions, PageSearchProvider } from "./PageSearchSlot";
let resize: () => void;
let desktop = true;
beforeEach(() => {
  desktop = true;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return desktop; }, addEventListener: (_: string, callback: () => void) => { resize = callback; }, removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Table() { return <DataTable rows={[{ id: "a", name: "田中" }, { id: "b", name: "佐藤" }]} columns={[{id:"name",label:"氏名",value: row => row.name,type:"text"}]} rowKey={row => row.id} searchText={row => row.name} searchPlaceholder="氏名・カナで探す" defaultSort={{id:"name",direction:"asc"}} />; }
function Fixture({ show = true, second = false, dialog = false }: { show?: boolean; second?: boolean; dialog?: boolean }) {
  return <PageSearchProvider><PageSearchActions><button>ログアウト</button></PageSearchActions><div data-testid="table">{show && (dialog ? <div role="dialog"><Table /></div> : <Table />)}</div>{second && <Table />}</PageSearchProvider>;
}
it("portals search, preserves filtering and resolves the input for employee shortcuts", () => {
  render(<Fixture />);
  const slot = document.querySelector<HTMLElement>("[data-page-search-slot]")!;
  const input = within(slot).getByRole("searchbox", {name:"この画面の中を検索"});
  expect(within(screen.getByTestId("table")).queryByRole("searchbox")).toBeNull();
  expect(input).toHaveAttribute("placeholder", "氏名・カナで探す");
  expect(within(slot).queryByText("検索")).toBeNull();
  fireEvent.change(input, {target:{value:"田中"}});
  expect(screen.queryByText("佐藤")).toBeNull();
  const resolved = findTableSearch(screen.getByTestId("table"));
  resolved?.focus(); resolved?.select();
  expect(input).toHaveFocus();
  fireEvent.click(within(slot).getByRole("button", {name:"絞り込みをすべて解除"}));
  expect(screen.getByText("佐藤")).toBeInTheDocument();
});
it("keeps a dialog's search local", () => {
  render(<Fixture dialog />);
  expect(document.querySelector("[data-page-search-slot]")).toBeEmptyDOMElement();
  expect(within(screen.getByRole("dialog")).getByRole("searchbox",{name:"検索"})).toBeInTheDocument();
});
it("keeps the second table local and releases ownership to it on unmount", () => {
  const view = render(<Fixture second />);
  expect(screen.getAllByRole("searchbox")).toHaveLength(2);
  expect(screen.getByRole("searchbox",{name:"検索"})).toBeInTheDocument();
  view.rerender(<Fixture show={false} second />);
  expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  expect(screen.getByRole("searchbox",{name:"この画面の中を検索"})).toBeInTheDocument();
  view.rerender(<Fixture show={false} />);
  expect(document.querySelector("[data-page-search-slot]")).toBeEmptyDOMElement();
});
it("keeps search local without a slot", () => {
  render(<Table />);
  expect(screen.getByRole("searchbox",{name:"検索"})).toBeInTheDocument();
});
it("moves search back at 800px and retains the query", () => {
  render(<Fixture />);
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"田中"}});
  act(() => { desktop = false; resize(); });
  expect(document.querySelector("[data-page-search-slot]")).toBeEmptyDOMElement();
  expect(within(screen.getByTestId("table")).getByRole("searchbox",{name:"検索"})).toHaveValue("田中");
  act(() => { desktop = true; resize(); });
  expect(screen.getByRole("searchbox",{name:"この画面の中を検索"})).toHaveValue("田中");
});

function ShortcutTable() {
  const ref = useRef<HTMLDivElement>(null);
  useMasterShortcuts({rows:[],modalOpen:false,rowNavigation:false,onSearch: () => { const input = findTableSearch(ref.current); input?.focus(); input?.select(); }});
  return <div ref={ref}><Table /></div>;
}
it("focuses the portaled search with Root's Ctrl+Shift+G handler", () => {
  render(<PageSearchProvider><PageSearchActions><button>ログアウト</button></PageSearchActions><ShortcutTable /></PageSearchProvider>);
  fireEvent.keyDown(window, { key:"G", ctrlKey:true, shiftKey:true });
  expect(screen.getByRole("searchbox",{name:"この画面の中を検索"})).toHaveFocus();
});


it.each(["System", "Root", "Bud", "My", "Rill"])("%s measures search clearance and removes it when search leaves", async shell => {
  let width = 280;
  let notifyResize = () => {};
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { notifyResize = callback; }
    observe() {} disconnect() {}
  });
  const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    const slot = this.hasAttribute("data-page-search-slot");
    return { top: slot ? 84 : 0, bottom: slot ? 120 : 600, width: slot ? width : 1000, height: slot ? 36 : 600, left: 0, right: width, x: 0, y: 0, toJSON() {} };
  });
  function ShellFixture({ show }: { show: boolean }) {
    const actions = <PageSearchActions><button>Logout</button></PageSearchActions>;
    const content = <><header data-page-search-heading>Title</header>{show && <Table />}</>;
    return <PageSearchProvider>{shell === "My" || shell === "Rill" ? <div><header>{actions}</header><main>{content}</main></div> : <main>{actions}{content}</main>}</PageSearchProvider>;
  }
  try {
    const view = render(<ShellFixture show />);
    const main = document.querySelector("main")!;
    await waitFor(() => expect(main.style.getPropertyValue("--page-search-width")).toBe("296px"));
    expect(main.style.getPropertyValue("--page-search-bottom")).toBe("120px");
    expect(main.querySelector<HTMLElement>("[data-page-search-heading]")!.style.getPropertyValue("--page-search-heading-top")).toBe("0px");
    act(() => { width = 340; notifyResize(); });
    expect(main.style.getPropertyValue("--page-search-width")).toBe("356px");
    act(() => { desktop = false; resize(); });
    await waitFor(() => expect(main.style.getPropertyValue("--page-search-width")).toBe(""));
    expect(main.style.getPropertyValue("--page-search-bottom")).toBe("");
    act(() => { desktop = true; resize(); });
    await waitFor(() => expect(main.style.getPropertyValue("--page-search-width")).toBe("356px"));
    view.rerender(<ShellFixture show={false} />);
    await waitFor(() => expect(main.style.getPropertyValue("--page-search-bottom")).toBe(""));
    expect(main.style.getPropertyValue("--page-search-width")).toBe("");
  } finally { rectSpy.mockRestore(); }
});
