import { describe, expect, it } from "vitest";

import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@/app/root/_constants/types";
import { SYSTEM_MENU_ITEMS } from "@/app/system/_components/ShachoShell/shacho-shell-config";
import { PERMISSION_ENTRIES } from "./permission-registry";

function allows(label: string, role: GardenRole) {
  const entry = PERMISSION_ENTRIES.find((item) => item.label === label);
  if (!entry) throw new Error(`missing permission entry: ${label}`);
  return entry.allows(role);
}

describe("PERMISSION_ENTRIES", () => {
  it("代表的な役職ごとの利用可否を既存定義から判定する", () => {
    expect(allows("マニュアル", "toss")).toBe(false);
    expect(allows("マニュアル", "staff")).toBe(true);
    expect(allows("管理表ポータル", "outsource")).toBe(false);
    expect(allows("管理表ポータル", "manager")).toBe(true);
    expect(allows("マニュアル：仕組み", "admin")).toBe(false);
    expect(allows("マニュアル：仕組み", "super_admin")).toBe(true);
    expect(allows("名簿と同期", "manager")).toBe(false);
    expect(allows("名簿と同期", "admin")).toBe(true);
  });

  it("System メニューの全項目を表に含める", () => {
    const labels = new Set(PERMISSION_ENTRIES.map((entry) => entry.label));
    for (const item of SYSTEM_MENU_ITEMS) {
      expect(labels.has(item.label)).toBe(true);
    }
  });

  it("すべての行が全 Garden 役職に対して判定できる", () => {
    for (const entry of PERMISSION_ENTRIES) {
      expect(entry.source).toMatch(/^src\//);
      expect(GARDEN_ROLE_ORDER.map((role) => entry.allows(role))).toHaveLength(GARDEN_ROLE_ORDER.length);
    }
  });
});
