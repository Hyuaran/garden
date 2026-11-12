import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { visibleSoilMenus } from "./_constants/menus";
import { SoilShell } from "./_components/SoilShell";
import SoilHome from "./view";
import LegacyPage from "../system/product-points/page";
import { PERMISSION_ENTRIES } from "@/lib/auth/permission-registry";
import { SYSTEM_MENU_ITEMS } from "@/app/system/_components/ShachoShell/shacho-shell-config";

vi.mock("next/navigation", () => ({
  usePathname: () => "/soil",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  redirect: (href: string) => { throw new Error(href); },
}));
vi.mock("@/app/_components/layout/GardenShell/ModuleShell", () => ({
  ModuleShell: ({ children, menu, userName, affiliation, roleLabel }: {
    children: React.ReactNode; menu: React.ReactNode;
    userName: string; affiliation: string; roleLabel: string;
  }) => <div>{menu}{userName}{affiliation}{roleLabel}{children}</div>,
}));
vi.mock("@/app/system/_components/ViewPermissionButton/SystemViewContext", () => ({
  SystemViewButton: () => null,
  SystemViewHeading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
beforeEach(cleanup);

it("許可されたページだけをメニューとホームに表示する", () => {
  for (const allowed of [false, true]) {
    cleanup();
    const viewAccess = { "soil-overview": true, "soil-product-points": allowed };
    expect(visibleSoilMenus(viewAccess)).toHaveLength(allowed ? 1 : 0);
    render(<SoilShell viewAccess={viewAccess} user={{ name: "利用者", company: "所属会社", role: "manager" }}>
      <SoilHome viewAccess={viewAccess} />
    </SoilShell>);
    expect(screen.getAllByRole("link", { name: "ホーム" })).toHaveLength(1);
    expect(screen.queryAllByRole("link", { name: /付与ポイント表/ })).toHaveLength(allowed ? 2 : 0);
    expect(screen.getByText("Garden の各機能が共通で使うデータの台帳。")).toBeTruthy();
  }
});

it("旧URLはSoilへ転送し、Systemメニューには残さない", () => {
  expect(() => LegacyPage()).toThrow("/soil/product-points");
  expect(SYSTEM_MENU_ITEMS.some(item => item.href === "/system/product-points")).toBe(false);
});

it("権限一覧にSoilの2画面があり、保存用scopeも用意する", () => {
  expect(PERMISSION_ENTRIES.filter(entry => entry.group === "Soil").map(entry => entry.pageKey))
    .toEqual(["soil-overview", "soil-product-points"]);
  const sql = readFileSync("supabase/migrations/20261112000521_soil_module_scopes.sql", "utf8");
  expect(sql).toContain("'soil-product-points'");
  expect(sql).toContain("where page_key='system-product-points'");
});
