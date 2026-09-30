import { describe, expect, it } from "vitest";
import {
  CORPORATE_SITES_DATA,
  compareGoogleMapWithGarden,
  countByStatus,
  extractAddressBlockForComparison,
  groupSitesByCompany,
  statusLabel,
} from "./sites-registry";

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
    expect(groups[0].sites.map((site) => site.kind)).toEqual(["会社HP", "採用ページ", "商品ページ"]);
    expect(groups[4].sites.map((site) => site.kind)).toEqual(["会社HP", "事業LP", "商品LP"]);
    // 壱は会社HPと商品LP（Ichi光）の2枚に分割（2026-09-30）
    expect(groups[5].sites.map((site) => [site.kind, site.url, site.company_id])).toEqual([
      ["会社HP", "https://ichi-one.com/company", "COMP-006"],
      ["商品LP", "https://ichi-one.com/", "COMP-006"],
    ]);
  });

  it("maps every status to the expected label and badge tone", () => {
    expect(statusLabel("live")).toEqual({ label: "稼働", tone: "active" });
    expect(statusLabel("pending_migration")).toEqual({ label: "移管待ち", tone: "pending" });
    expect(statusLabel("restored_pending_migration")).toEqual({ label: "移管待ち（原サーバーで稼働中）", tone: "pending" });
    expect(statusLabel("pending_migration_and_new")).toEqual({ label: "新規作成待ち（商品ページは移管）", tone: "upcoming" });
    expect(statusLabel("planned_new")).toEqual({ label: "新規作成待ち", tone: "upcoming" });
  });

  it("counts sites by status bucket", () => {
    expect(countByStatus(CORPORATE_SITES_DATA)).toEqual({ live: 12, pending: 3, planned: 0 });
  });

  it("normalizes addresses to the block number for Google Maps comparison", () => {
    expect(extractAddressBlockForComparison("〒541-0054 大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室")).toBe("大阪府大阪市中央区南本町2-6-12");
    expect(extractAddressBlockForComparison("〒541-0054 大阪府大阪市中央区南本町２丁目６−１２ サンマリオンタワー 2階")).toBe("大阪府大阪市中央区南本町2-6-12");
    expect(extractAddressBlockForComparison("〒537-0001 大阪府大阪市東成区深江北2-6-1　エーデル深江橋405")).toBe("大阪府大阪市東成区深江北2-6-1");
    expect(extractAddressBlockForComparison("〒537-0001 大阪府大阪市東成区深江北２丁目６−１ エーデル深江橋 ４０５")).toBe("大阪府大阪市東成区深江北2-6-1");
  });

  it("compares Google Maps and Garden registry values by normalized company name and block address", () => {
    expect(compareGoogleMapWithGarden(
      { map_name: "株式会社ヒュアラン", map_address: "〒541-0054 大阪府大阪市中央区南本町２丁目６−１２ サンマリオンタワー 2階" },
      { company_name: "株式会社 ヒュアラン", address: "〒541-0054 大阪府大阪市中央区南本町2-6-12　サンマリオンタワー地上2階西号室" },
    )).toEqual({ companyNameMatches: true, addressMatches: true });

    expect(compareGoogleMapWithGarden(
      { map_name: "株式会社たいよう", map_address: "〒537-0001 大阪府大阪市東成区深江北２丁目６−１ エーデル深江橋 ４０５" },
      { company_name: "株式会社たいよう", address: "〒537-0001 大阪府大阪市東成区深江北2-6-1　エーデル深江橋405" },
    )).toEqual({ companyNameMatches: true, addressMatches: true });

    expect(compareGoogleMapWithGarden(
      { map_name: "株式会社たいよう", map_address: "大阪府大阪市浪速区湊町1-4-38" },
      { company_name: "株式会社たいよう", address: "〒537-0001 大阪府大阪市東成区深江北2-6-1　エーデル深江橋405" },
    )).toEqual({ companyNameMatches: true, addressMatches: false });
  });

  it("keeps the room number out of the block when it follows 号 or a space", () => {
    expect(extractAddressBlockForComparison("〒558-0013 大阪府大阪市住吉区我孫子東３丁目２番２５号７０１")).toBe("大阪府大阪市住吉区我孫子東3-2-25");
    expect(extractAddressBlockForComparison("〒558-0013 大阪府大阪市住吉区我孫子東３丁目２−２５ 701")).toBe("大阪府大阪市住吉区我孫子東3-2-25");
    expect(extractAddressBlockForComparison("〒556-0016 大阪府大阪市浪速区元町1丁目9番18号605")).toBe("大阪府大阪市浪速区元町1-9-18");
  });
});
