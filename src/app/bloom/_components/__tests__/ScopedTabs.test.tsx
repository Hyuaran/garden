import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ScopedTabs, { TabHeadingAction, useUrlTab } from "@/app/_components/ScopedTabs";
import { SystemViewProvider, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
const items = [{ key: "first", label: "最初" }, { key: "second", label: "次" }];
function Harness() {
  const [selected, select] = useUrlTab<string>("first");
  const { allowedTab } = useSystemView();
  const active = items.find(t => t.key === selected && allowedTab(t.key))?.key ?? items.find(t => allowedTab(t.key))?.key;
  return <><h1>見出し<TabHeadingAction items={items} active={active} /></h1><ScopedTabs items={items} active={active} onChange={select} label="切り替え" /><p>{active === "second" ? "次の内容" : active === "first" ? "最初の内容" : "閲覧不可"}</p></>;
}
function show(allowed = [true, true]) {
  return render(<SystemViewProvider value={{ pageKey: "test", admin: false, canAdd: false, tabs: items.map((item, i) => ({ ...item, allowed: allowed[i], canAdd: false })) }}><Harness /></SystemViewProvider>);
}
describe("ScopedTabs", () => {
  beforeEach(() => window.history.replaceState(null, "", "/bloom/progress"));
  it("switches content, preserves the other query and hash, and restores the URL on remount", () => {
    window.history.replaceState(null, "", "/bloom/progress?period=month#detail");
    const view = show();
    fireEvent.click(screen.getByRole("tab", { name: "次" }));
    expect(screen.getByText("次の内容")).toBeInTheDocument();
    expect(window.location.search).toBe("?period=month&tab=second");
    expect(window.location.hash).toBe("#detail");
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    view.unmount(); show();
    expect(screen.getByRole("tab", { name: "次" })).toHaveAttribute("aria-selected", "true");
  });
  it("responds to history navigation", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: "次" }));
    window.history.replaceState(null, "", "?tab=first");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(screen.getByText("最初の内容")).toBeInTheDocument();
  });
  it("hides forbidden tabs and removes the row when one remains", () => {
    window.history.replaceState(null, "", "?tab=second"); show([true, false]);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("最初の内容")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "次" })).not.toBeInTheDocument();
  });
  it("does not show content or tabs when none are allowed", () => {
    show([false, false]);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("閲覧不可")).toBeInTheDocument();
  });
});
