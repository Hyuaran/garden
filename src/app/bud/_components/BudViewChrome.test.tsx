import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: true }));
vi.mock("@/app/system/_components/ViewPermissionButton/SystemViewContext", () => ({
  useSystemView: () => ({ state, allowedTab: () => true }),
  SystemViewButton: ({ tabKey }: { tabKey: string }) => state.admin ? <button>閲覧設定:{tabKey || "画面"}</button> : null,
}));
import { BudViewChrome } from "./BudViewChrome";
beforeEach(() => { state.admin = true; });
it("タブ列の右端でこのタブの歯車を表示する", async () => {
  render(<BudViewChrome><nav className="tab-nav"><button className="tab-item active" data-tab="approve">最終承認</button></nav></BudViewChrome>);
  const gear = await screen.findByRole("button", { name: "閲覧設定:approve" });
  expect(gear.closest(".tab-nav")).toBeNull();
  expect(gear.parentElement?.parentElement).toContainElement(document.querySelector(".tab-nav"));
  expect(gear.parentElement?.lastChild).toBe(gear);
});
it("タブなしはh1行に表示し、全権管理者以外には表示しない", async () => {
  const view = render(<BudViewChrome><div><h1>入金管理</h1></div></BudViewChrome>);
  expect((await screen.findByRole("button", { name: "閲覧設定:画面" })).closest("[data-system-tabs]")).not.toContainElement(screen.getByRole("heading"));
  state.admin = false;
  view.rerender(<BudViewChrome><div><h1>入金管理</h1></div></BudViewChrome>);
  await waitFor(() => expect(screen.queryByRole("button", { name: "閲覧設定:画面" })).toBeNull());
});
it("子レイアウトがある場合も歯車を二重表示しない", async () => {
  render(<BudViewChrome><BudViewChrome tabKey="summary"><h1>明細集計</h1></BudViewChrome></BudViewChrome>);
  expect(await screen.findAllByRole("button", { name: /^閲覧設定:/ })).toHaveLength(1);
});
