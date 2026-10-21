import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StickyTable from "./useStickyTable";
import styles from "./StickyTable.module.css";
import SystemDataTable from "../DataTable/DataTable";
import { DataTable as RootDataTable } from "@/app/root/_components/DataTable";

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.style.zoom = ""; });
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height } as DOMRect);

it.each([0.9, 1, 1.15])("tracks page scrolling, widths and horizontal scrolling at zoom %s", async zoom => {
  document.documentElement.style.zoom = String(zoom);
  let top = -50, bottom = 2000;
  const click = vi.fn();
  const { container } = render(<main><div><StickyTable><thead><tr><th style={{ position: "sticky", left: 0 }}><button onClick={click}>Name</button></th><th>Value</th></tr></thead><tbody><tr data-sticky-group><td colSpan={2}>Group</td></tr><tr><td>A</td><td>1</td></tr></tbody></StickyTable></div></main>);
  const table = container.querySelector("table")!, wrap = table.parentElement!;
  Object.defineProperties(wrap, { scrollWidth: { value: 1200 }, clientWidth: { value: 600 } });
  Object.defineProperty(table, "offsetWidth", { value: 1200 });
  vi.spyOn(wrap, "getBoundingClientRect").mockImplementation(() => rect(100 * zoom, top, 600 * zoom, bottom - top));
  vi.spyOn(table, "getBoundingClientRect").mockImplementation(() => rect(100 * zoom, top, 1200 * zoom, bottom - top));
  vi.spyOn(table.tHead!, "getBoundingClientRect").mockImplementation(() => rect(100 * zoom, top, 1200 * zoom, 40 * zoom));
  table.querySelectorAll("th").forEach(th => vi.spyOn(th, "getBoundingClientRect").mockReturnValue(rect(0, top, 600 * zoom, 40 * zoom)));
  vi.spyOn(table.querySelector('[data-sticky-group]')!, "getBoundingClientRect").mockReturnValue(rect(0, -5, 1200 * zoom, 30 * zoom));
  act(() => window.dispatchEvent(new Event("garden-font-size-change")));
  const head = document.querySelector(`.${styles.head}`) as HTMLElement, bar = document.querySelector(`.${styles.bar}`) as HTMLElement;
  await waitFor(() => expect(head.hidden).toBe(false));
  expect(parseFloat(head.style.left)).toBeCloseTo(100);
  expect(parseFloat(head.style.width)).toBeCloseTo(600);
  expect(parseFloat(head.querySelector("th")!.style.width)).toBeCloseTo(600);
  expect(head.querySelector("th")!.style.left).toBe("0px");
  expect(head.textContent).toContain("Group");
  expect(bar.hidden).toBe(false);
  fireEvent.click(head.querySelector("button")!); expect(click).toHaveBeenCalledOnce();
  wrap.scrollLeft = 100; fireEvent.scroll(wrap);
  await waitFor(() => expect(bar.scrollLeft).toBeCloseTo(100));
  bar.scrollLeft = 200; fireEvent.scroll(bar); expect(wrap.scrollLeft).toBeCloseTo(200);
  top = 100; fireEvent.scroll(window);
  await waitFor(() => expect(head.hidden).toBe(true));
  bottom = 500; fireEvent.scroll(window);
  await waitFor(() => expect(bar.hidden).toBe(true));
  expect(wrap.style.maxHeight).toBe("none");
});

it("leaves dialog tables alone and removes overlays on unmount", () => {
  const dialog = render(<div role="dialog"><div><StickyTable><thead><tr><th>Dialog</th></tr></thead></StickyTable></div></div>);
  expect(document.querySelector(`.${styles.head}`)).toBeNull(); dialog.unmount();
  const view = render(<div><StickyTable><thead><tr><th>Page</th></tr></thead></StickyTable></div>);
  expect(document.querySelector(`.${styles.head}`)).toBeTruthy(); view.unmount();
  expect(document.querySelector(`.${styles.head}`)).toBeNull();
});

it.each(["System", "Root"])("fixes the header through %s DataTable", async kind => {
  const row = { id: "a" };
  const { container } = render(kind === "System"
    ? <SystemDataTable rows={[row]} columns={[{ id: "id", label: "ID", value: r => r.id, type: "text" }]} rowKey={r => r.id} searchText={r => r.id} defaultSort={{ id: "id", direction: "asc" }} />
    : <RootDataTable rows={[row]} columns={[{ key: "id", header: "ID", render: r => r.id }]} />);
  const table = container.querySelector("table")!;
  vi.spyOn(table.parentElement!, "getBoundingClientRect").mockReturnValue(rect(0, -100, 500, 2000));
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue(rect(0, -100, 500, 2000));
  vi.spyOn(table.tHead!, "getBoundingClientRect").mockReturnValue(rect(0, -100, 500, 40));
  fireEvent.scroll(window);
  await waitFor(() => expect((document.querySelector(`.${styles.head}`) as HTMLElement).hidden).toBe(false));
  expect(document.querySelector(`.${styles.head}`)?.textContent).toContain("ID");
});

it.each([false,true])("switches the cloned group as the next group reaches the header (layout offsets: %s)",async layout=>{const {container}=render(<div><StickyTable><thead><tr><th>Header</th></tr></thead><tbody><tr data-sticky-group><td>First</td></tr><tr><td>A</td></tr><tr data-sticky-group><td>Second</td></tr><tr><td>B</td></tr></tbody></StickyTable></div>);const table=container.querySelector("table")!;let secondTop=300;vi.spyOn(table.parentElement!,"getBoundingClientRect").mockReturnValue(rect(0,-100,500,2000));vi.spyOn(table,"getBoundingClientRect").mockReturnValue(rect(0,-100,500,2000));vi.spyOn(table.tHead!,"getBoundingClientRect").mockReturnValue(rect(0,-100,500,40));Array.from(table.tBodies[0].rows).forEach((row,i)=>vi.spyOn(row,"getBoundingClientRect").mockImplementation(()=>rect(0,i<2?-60+i*30:secondTop+(i-2)*30,500,30)));if(layout){Object.defineProperty(table,"offsetWidth",{value:500});Array.from(table.tBodies[0].rows).forEach((row,i)=>Object.defineProperties(row,{offsetHeight:{value:30},offsetParent:{value:table},offsetTop:{get:()=>100+(i<2?-60+i*30:secondTop+(i-2)*30)}}));}fireEvent.scroll(window);const head=document.querySelector('.'+styles.head)!;await waitFor(()=>expect(head.textContent).toContain("First"));secondTop=20;fireEvent.scroll(window);await waitFor(()=>expect(head.textContent).toContain("Second"));expect(head.textContent).not.toContain("First");});
