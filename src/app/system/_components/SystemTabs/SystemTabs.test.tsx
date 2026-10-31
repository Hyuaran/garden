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
  render(<SystemTabs role="navigation" aria-label="資料"><a href="?tab=guide" aria-current="page">使い方</a><a href="?tab=admin">管理</a></SystemTabs>);
  expect(screen.getByRole("link", { name: "使い方" })).toHaveAttribute("href", "?tab=guide");
 });
 it("puts line-icon actions at the right end of the tab row, outside the tablist", () => {
  const onClick = vi.fn();
  render(<SystemTabs aria-label="表示" actions={<TabActionButton icon="sort" label="並び替え" pressed={false} onClick={onClick} />}><button role="tab" aria-selected="true">口座残高</button><button role="tab">履歴</button></SystemTabs>);
  const action = screen.getByRole("button", { name: "並び替え" });
  expect(screen.getByRole("tablist")).not.toContainElement(action);
  expect(action.querySelector("svg")).not.toBeNull();
  fireEvent.click(action);
  expect(onClick).toHaveBeenCalled();
 });
});

it.each([0, 1])("hides %i visible tab labels but retains the action row", count => {
 const { container } = render(<SystemTabs actions={<button>設定</button>}>{null}{false}{Array.from({length: count}, (_, key) => <button role="tab" key={key}>内容</button>)}</SystemTabs>);
 expect(screen.queryByRole("tablist")).toBeNull();
 expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
 expect(screen.getByRole("button", { name: "並べ替え" })).toBeDisabled();
});
it("counts visible children after removing null and false", () => {
 render(<SystemTabs>{false}<button role="tab">一覧</button>{null}<button role="tab">集計</button></SystemTabs>);
 expect(screen.getAllByRole("tab")).toHaveLength(2);
});
