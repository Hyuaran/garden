import { describe, expect, it } from "vitest";
import { getVisibleGyomuTools, GYOMU_TOOLS } from "./gyomu-tools-registry";

describe("gyomu tools registry", () => {
  it("loads tools grouped by purpose", () => {
    expect(GYOMU_TOOLS.filter((tool) => tool.group === "auto")).toHaveLength(14); // 2026-10-21 関電の経費・バイク代・レンタカー代の Kintone 転記を追加
    expect(GYOMU_TOOLS.filter((tool) => tool.group === "kintone")).toHaveLength(7); // 2026-10-15 振込依頼の二重払い防止チェックを追加
    expect(GYOMU_TOOLS[0]).toMatchObject({
      group: "auto",
      name: "INNOVERA履歴・録音",
      href: "/system/innovera-calls",
    });
  });

  it("filters tools by role", () => {
    expect(getVisibleGyomuTools("cs")).toEqual([]);
    expect(getVisibleGyomuTools("staff").map((tool) => tool.name)).not.toContain("リストマスタの毎朝の更新");
    expect(getVisibleGyomuTools("manager").map((tool) => tool.name)).toContain("リストマスタの毎朝の更新");
  });
});
