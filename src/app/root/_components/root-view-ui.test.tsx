import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => "/root/employees", useRouter: () => ({ refresh: vi.fn() }) }));
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { PageHeader } from "./PageHeader";

describe("Root の閲覧権限の歯車", () => {
  it.each([true, false])("全権管理者=%s の見出し行", admin => {
    render(<SystemViewProvider value={{ pageKey: "root-employees", admin, tabs: [], canAdd: false }}><PageHeader title="従業員マスタ" /></SystemViewProvider>);
    const gear = screen.queryByRole("button", { name: "見られる人の設定" });
    expect(Boolean(gear)).toBe(admin);
    if (gear) {
      const row = gear.closest("[data-system-tabs]") as HTMLElement;
      expect(row).not.toContainElement(screen.getByRole("heading", { level: 1 }));
      expect(within(row).getByRole("button", { name: "見られる人の設定" })).toBe(gear);
    }
  });
});
