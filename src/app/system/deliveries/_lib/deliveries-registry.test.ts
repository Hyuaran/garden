import { describe, expect, it } from "vitest";
import { getVisibleSystemDeliveries, SYSTEM_DELIVERIES } from "./deliveries-registry";

describe("deliveries registry", () => {
  it("defines active deliveries in one registry", () => {
    expect(SYSTEM_DELIVERIES).toHaveLength(2);
    expect(SYSTEM_DELIVERIES[0]).toMatchObject({
      slug: "call-report",
      name: "コール数配信",
      minRole: "staff",
      href: "/system/call-metrics",
      status: "active",
      statusLabel: "稼働中",
    });
    expect(SYSTEM_DELIVERIES[1]).toMatchObject({
      slug: "nhk-visit-summary",
      name: "NHK訪問 集計配信",
      minRole: "staff",
      href: "/system/forms/nhk-visit",
      status: "active",
      statusLabel: "稼働中",
    });
  });

  it("filters deliveries by role", () => {
    expect(getVisibleSystemDeliveries("cs")).toEqual([]);
    expect(getVisibleSystemDeliveries("staff").map((delivery) => delivery.name)).toEqual(["コール数配信", "NHK訪問 集計配信"]);
    expect(getVisibleSystemDeliveries("manager").map((delivery) => delivery.name)).toEqual(["コール数配信", "NHK訪問 集計配信"]);
  });
});
