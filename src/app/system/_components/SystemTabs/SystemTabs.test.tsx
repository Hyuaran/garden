import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SystemTabs, { TabActionButton } from "./SystemTabs";
function Example() {
 const [tab, setTab] = useState("first");
 return <><SystemTabs aria-label="区分"><button role="tab" aria-selected={tab === "first"} onClick={() => setTab("first")}>入力する<span>3</span></button><button role="tab" aria-selected={tab === "second"} onClick={() => setTab("second")}>自動<span>12</span></button></SystemTabs><p>{tab}</p></>;
}
describe("SystemTabs", () => {
 it("keeps selection, count badges and the panel switch handler", () => {
  render(<Example />);
  expect(screen.getByRole("tablist", {name:"区分"})).toBeInTheDocument();
  expect(screen.getByRole("tab", {name:"入力する3"})).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("12")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", {name:"自動12"}));
  expect(screen.getByRole("tab", {name:"自動12"})).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", {name:"入力する3"})).toHaveAttribute("aria-selected", "false");
  expect(screen.getByText("second")).toBeInTheDocument();
 });
 it("preserves document links and their destinations", () => {
  render(<SystemTabs role="navigation" aria-label="資料"><a href="?tab=guide" aria-current="page">操作マニュアル</a></SystemTabs>);
  expect(screen.getByRole("link")).toHaveAttribute("href", "?tab=guide");
 });
 it("puts line-icon actions at the right end of the tab row, outside the tablist", () => {
  const onClick = vi.fn();
  render(<SystemTabs aria-label="表示" actions={<TabActionButton icon="sort" label="並び替え" pressed={false} onClick={onClick} />}><button role="tab" aria-selected="true">口座残高</button></SystemTabs>);
  const action = screen.getByRole("button", { name: "並び替え" });
  expect(screen.getByRole("tablist")).not.toContainElement(action);
  expect(action.querySelector("svg")).not.toBeNull();
  fireEvent.click(action);
  expect(onClick).toHaveBeenCalled();
 });
});
