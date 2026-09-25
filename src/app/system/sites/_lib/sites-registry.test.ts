import { describe, expect, it } from "vitest";
import { CORPORATE_SITES_DATA, countByStatus, groupSitesByCompany, statusLabel } from "./sites-registry";

describe("sites registry", () => {
  it("groups sites by company in appearance order and sorts company HP first", () => {
    const groups = groupSitesByCompany(CORPORATE_SITES_DATA);

    expect(groups).toHaveLength(8);
    expect(groups.map((group) => group.company)).toEqual([
      "株式会社ヒュアラン",
      "株式会社センターライズ",
      "株式会社ARATA",
      "株式会社リンクサポート",
      "株式会社たいよう",
      "株式会社壱",
      "株式会社ストーンベース",
      "株式会社almalio",
    ]);
    expect(groups[0].sites.map((site) => site.kind)).toEqual(["会社HP", "商品ページ"]);
    expect(groups[4].sites.map((site) => site.kind)).toEqual(["会社HP", "事業LP", "商品LP"]);
  });

  it("maps every status to the expected label and badge tone", () => {
    expect(statusLabel("live")).toEqual({ label: "稼働", tone: "active" });
    expect(statusLabel("pending_migration")).toEqual({ label: "移管待ち", tone: "pending" });
    expect(statusLabel("restored_pending_migration")).toEqual({ label: "移管待ち（原サーバーで稼働中）", tone: "pending" });
    expect(statusLabel("pending_migration_and_new")).toEqual({ label: "新規作成待ち（商品ページは移管）", tone: "upcoming" });
    expect(statusLabel("planned_new")).toEqual({ label: "新規作成待ち", tone: "upcoming" });
  });

  it("counts sites by status bucket", () => {
    expect(countByStatus(CORPORATE_SITES_DATA)).toEqual({ live: 10, pending: 3, planned: 0 });
  });
});
