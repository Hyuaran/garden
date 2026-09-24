import { describe, expect, it } from "vitest";
import { SYSTEM_MENU_ITEMS } from "@/app/system/_components/ShachoShell/shacho-shell-config";

describe("corporate sites menu item", () => {
  it("adds corporate sites to the system menu for staff", () => {
    const item = SYSTEM_MENU_ITEMS.find((menuItem) => menuItem.label === "コーポレートサイト");
    const contractsIndex = SYSTEM_MENU_ITEMS.findIndex((menuItem) => menuItem.label === "契約書管理");
    const sitesIndex = SYSTEM_MENU_ITEMS.findIndex((menuItem) => menuItem.label === "コーポレートサイト");

    expect(item).toMatchObject({
      href: "/system/sites",
      minRole: "staff",
      icon: "folder",
      description: "グループ各社の会社HPと商品ページを一覧し、サイトへ飛べます。",
    });
    expect(sitesIndex).toBe(contractsIndex + 1);
  });
});
