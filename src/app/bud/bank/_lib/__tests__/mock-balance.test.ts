/**
 * 03_Bank mock data 検算テスト
 *
 * 対応 dispatch: main- No. 276 §E 5/11 11:48 残高表
 *
 * 検算項目:
 *   1. 総合計 = ¥103,703,627（dispatch 明記値と一致）
 *   2. 法人別小計（ヒュアラン 45,604,598 等）
 *   3. 銀行別小計（みずほ / 楽天 / PayPay / 京都）
 *   4. 法人 × 銀行クロス集計
 *   5. needsManualBalance フラグ（みずほ全件 + PayPay）
 */

import { describe, it, expect } from "vitest";
import {
  EXPECTED_GRAND_TOTAL_20260511,
  getMockAllCorpsSummary,
} from "../mock-balance-20260511";
import type { BankCode, CorpCode } from "../types";

describe("03_Bank mock data 検算", () => {
  const summary = getMockAllCorpsSummary();

  it("総合計 = ¥103,703,627（dispatch 明記値）", () => {
    expect(summary.grandTotal).toBe(EXPECTED_GRAND_TOTAL_20260511);
    expect(summary.grandTotal).toBe(103_703_627);
  });

  it("6 法人すべてのサマリ生成", () => {
    expect(summary.corpSummaries).toHaveLength(6);
    const codes = summary.corpSummaries.map((c) => c.corpCode);
    expect(codes).toEqual([
      "hyuaran",
      "centerrise",
      "linksupport",
      "arata",
      "taiyou",
      "ichi",
    ]);
  });

  describe("法人別小計（dispatch §E 表と一致）", () => {
    const expected: Record<CorpCode, number> = {
      hyuaran: 45_604_598,
      centerrise: 9_474_260,
      linksupport: 13_544_954,
      arata: 20_129_784,
      taiyou: 14_116_044,
      ichi: 833_987,
    };

    for (const [code, exp] of Object.entries(expected)) {
      it(`${code} 小計 = ${exp.toLocaleString()} 円`, () => {
        const c = summary.corpSummaries.find((s) => s.corpCode === code);
        expect(c?.total).toBe(exp);
      });
    }
  });

  describe("銀行別小計（dispatch §E 表を横に集計）", () => {
    function sumByBank(bank: BankCode): number {
      return summary.corpSummaries
        .flatMap((c) => c.banks)
        .filter((b) => b.bankCode === bank)
        .reduce((acc, b) => acc + b.balance, 0);
    }

    it("みずほ合計 = 17,628,380 + 9,037,780 + 1,226,652 + 18,334,348 = 46,227,160", () => {
      expect(sumByBank("mizuho")).toBe(46_227_160);
    });

    it("楽天合計 = 21,705,543 + 12,318,302 + 1,795,436 + 14,116,044 + 833,987 = 50,769,312", () => {
      expect(sumByBank("rakuten")).toBe(50_769_312);
    });

    it("PayPay 合計 = 158,063 + 436,480 = 594,543", () => {
      expect(sumByBank("paypay")).toBe(594_543);
    });

    it("京都合計 = 6,112,612（ヒュアランのみ）", () => {
      expect(sumByBank("kyoto")).toBe(6_112_612);
    });

    it("4 銀行合計 = 総合計 ¥103,703,627", () => {
      const all =
        sumByBank("mizuho") +
        sumByBank("rakuten") +
        sumByBank("paypay") +
        sumByBank("kyoto");
      expect(all).toBe(103_703_627);
    });
  });

  describe("needsManualBalance フラグ", () => {
    it("みずほ口座は全件 needsManualBalance=true（通帳ベース手入力）", () => {
      const mizuhoEntries = summary.corpSummaries
        .flatMap((c) => c.banks)
        .filter((b) => b.bankCode === "mizuho");
      expect(mizuhoEntries.length).toBeGreaterThan(0);
      mizuhoEntries.forEach((b) => {
        expect(b.needsManualBalance).toBe(true);
      });
    });

    it("PayPay 口座は全件 needsManualBalance=true（システム障害）", () => {
      const paypayEntries = summary.corpSummaries
        .flatMap((c) => c.banks)
        .filter((b) => b.bankCode === "paypay");
      expect(paypayEntries.length).toBe(2); // ヒュアラン + センターライズ
      paypayEntries.forEach((b) => {
        expect(b.needsManualBalance).toBe(true);
      });
    });

    it("楽天 / 京都 は needsManualBalance=false（CSV 自動取込予定）", () => {
      const autoEntries = summary.corpSummaries
        .flatMap((c) => c.banks)
        .filter((b) => b.bankCode === "rakuten" || b.bankCode === "kyoto");
      autoEntries.forEach((b) => {
        expect(b.needsManualBalance).toBe(false);
      });
    });
  });

  describe("残高日付", () => {
    it("全 entry の balanceDate = 2026-05-11（5/11 11:48 時点）", () => {
      summary.corpSummaries
        .flatMap((c) => c.banks)
        .forEach((b) => {
          expect(b.balanceDate).toBe("2026-05-11");
        });
    });

    it("oldestBalanceDate / latestBalanceDate = 2026-05-11（単一時点）", () => {
      expect(summary.oldestBalanceDate).toBe("2026-05-11");
      expect(summary.latestBalanceDate).toBe("2026-05-11");
    });
  });
});
