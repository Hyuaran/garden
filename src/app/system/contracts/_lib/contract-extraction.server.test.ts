import { describe, expect, it } from "vitest";
import { extractContract } from "./contract-extraction.server";
const companies = [
  {
    company_id: "COMP-001",
    company_name: "株式会社ヒュアラン",
    representative: "後道翔太",
    address: "大阪府",
  },
  {
    company_id: "COMP-003",
    company_name: "株式会社リンクサポート",
    representative: "代表者",
    address: "東京都",
  },
  {
    company_id: "COMP-008",
    company_name: "株式会社ARATA",
    representative: "代表者",
    address: "東京都",
  },
];
describe("contract extraction", () => {
  it.each([
    [
      "株式会社ARATA（以下「甲」という。）とASH株式会社（以下「乙」という。）",
      "株式会社ARATA",
      "ASH株式会社",
      "COMP-008",
      true,
    ],
    [
      "Fado株式会社（以下「甲」という）と株式会社ヒュアラン（以下「乙」という）",
      "Fado株式会社",
      "株式会社ヒュアラン",
      "COMP-001",
      false,
    ],
    [
      "A社(以下、｢甲｣という。)と株式会社ヒュアラン(以下、｢乙｣という。)",
      "A社",
      "株式会社ヒュアラン",
      "COMP-001",
      false,
    ],
    [
      "B社（以下甲という）と株式会社ヒュアラン（以下乙という）",
      "B社",
      "株式会社ヒュアラン",
      "COMP-001",
      false,
    ],
  ])("extracts party variants", async (text, a, b, id, warning) => {
    const r = extractContract([`業務委託基本契約書\n${text}\n2026年8月28日`], companies);
    expect(r).toMatchObject({
      partyA: a,
      partyB: b,
      companyId: id,
      ownPartyWarning: warning,
      scanned: false,
    });
  });
  it("infers a known second party without an 乙 marker", async () => {
    const r = extractContract(["取次契約書\n株式会社Crescere（以下「甲」という）と株式会社リンクサポート\n令和8年8月28日"], companies);
    expect(r).toMatchObject({
      partyA: "株式会社Crescere",
      partyB: "株式会社リンクサポート",
      companyId: "COMP-003",
    });
  });
  it("uses the last date and returns a blank scanned fallback", async () => {
    const r = extractContract(["覚書\nFado株式会社（以下「甲」という）と株式会社ヒュアラン（以下「乙」という）\n2026/01/01", "2026年8月28日"], companies);
    expect(r.concludedOn).toBe("2026-08-28");
    const scanned = extractContract([""], companies);
    expect(scanned).toMatchObject({
      counterparty: "",
      companyId: "",
      contractType: "",
      concludedOn: "",
      scanned: true,
    });
  });
});
