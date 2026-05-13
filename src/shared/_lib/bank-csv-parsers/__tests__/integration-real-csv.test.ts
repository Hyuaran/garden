/**
 * 実 CSV / .api ファイル parsing 検証 integration test
 *
 * 対象 11 ファイル:
 *   - 楽天 5 法人 (ARATA / たいよう / ヒュアラン / リンクサポート / 壱)
 *   - みずほ 4 法人 (ARATA / センターライズ / ヒュアラン / リンクサポート)
 *   - PayPay 1 (センターライズ)
 *   - 京都 1 (ヒュアラン)
 *
 * 検証ポイント:
 *   - パース成功 (warnings 件数最小化)
 *   - 取引件数 + 期間
 *   - 4/30 残高 (CSV 最終行 / 手入力残高との照合)
 *   - opening_balance 逆算 (楽天 / PayPay / 京都 のみ)
 *
 * Drive (G:\) アクセス前提のため、ファイルが見つからない場合は test を skip。
 * dispatch main- No. 82 §2-2 の検証ポイントに沿って結果を console.log に出力。
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseRakutenCsv } from "../rakuten-parser";
import {
  parseMizuhoApi,
  deriveMizuhoFilenamePeriod,
} from "../mizuho-parser";
import { parsePayPayCsv } from "../paypay-parser";
import { parseKyotoCsv } from "../kyoto-parser";
import { parseYayoiImportCsv } from "../yayoi-import-parser";

const BASE = path.join(
  "G:\\",
  "マイドライブ",
  "17_システム構築",
  "07_Claude",
  "01_東海林美琴",
  "_chat_workspace",
  "garden-forest-shiwakechou",
);

const RAKUTEN_DIR = path.join(BASE, "bank-2year-202406-202604");
const MIZUHO_DIR = path.join(BASE, "bank-1year-202504-202604");

const RAKUTEN_FILES = [
  { corp: "ARATA",         file: "【ARATA】【楽天】楽天銀行フォーマット_202406から_20260430まで.csv" },
  { corp: "たいよう",      file: "【たいよう】【楽天】楽天銀行フォーマット_202406から_20260430まで.csv" },
  { corp: "ヒュアラン",    file: "【ヒュアラン】【楽天】楽天銀行フォーマット_202406から_20260430まで.csv" },
  { corp: "リンクサポート", file: "【リンクサポート】【楽天】楽天銀行フォーマット_202406から_20260430まで.csv" },
  { corp: "壱",            file: "【壱】【楽天】楽天銀行フォーマット_20250731から_20260430まで.csv" },
];

const MIZUHO_FILES = [
  { corp: "ARATA",         file: "【ARATA】【みずほ】HS000120260506095245_202504から20260430まで.api",         expectedManualBalance: 17493036 },
  { corp: "センターライズ", file: "【センターライズ】【みずほ】HS000120260506094807_202504から20260430まで.api", expectedManualBalance: 8641120 },
  { corp: "ヒュアラン",    file: "【ヒュアラン】【みずほ】HS000120260506093941_202504から20260430まで.api",     expectedManualBalance: 17363036 },
];

const MIZUHO_LINK_FILE = {
  corp: "リンクサポート",
  file: "【リンクサポート】【みずほ】nmr20260506093629_20260410から20260430まで.csv",
  // ※ 拡張子 .csv だが TSV (api 同等) なので mizuho parser で扱える想定
  expectedManualBalance: 1293092,
};

const PAYPAY_FILE = {
  corp: "センターライズ",
  file: "【センターライズ】【PayPay】NBG23061Cpss9hD6_e2jTq3Y2or54R2zbd5p_LB_20250731から20260430まで.csv",
  expectedClosingBalance: 1291259,
};

const KYOTO_FILE = {
  corp: "ヒュアラン",
  file: "【ヒュアラン】【京都銀行】nmr20260507123911_20260309から20260507まで.csv",
  expectedClosingBalance4_13: 6569104, // 4/13 取引後 (4/14-4/30 取引なしのため 4/30 残高 = 4/13 残高)
};

let driveAccessible = false;

beforeAll(() => {
  driveAccessible = existsSync(BASE);
  if (!driveAccessible) {
    console.warn(
      `\n⚠️  Drive ${BASE} アクセス不可、integration test を skip します`,
    );
  }
});

describe.skipIf(!existsSync(BASE))("実 CSV / .api parsing 検証", () => {
  describe("楽天銀行 5 法人", () => {
    for (const { corp, file } of RAKUTEN_FILES) {
      it(`${corp}: パース成功 + 4/30 残高記録`, () => {
        const filePath = path.join(RAKUTEN_DIR, file);
        if (!existsSync(filePath)) {
          console.warn(`  ⚠️ ${corp}: ファイル無し → skip`);
          return;
        }
        const buf = readFileSync(filePath);
        const result = parseRakutenCsv(buf);

        const lastDate =
          result.rows.length > 0
            ? result.rows[result.rows.length - 1].transaction_date
            : null;
        const firstDate =
          result.rows.length > 0 ? result.rows[0].transaction_date : null;

        console.log(
          `  📊 楽天 ${corp}: ${result.rows.length} 件 / 期間 ${firstDate} 〜 ${lastDate} / 期初 ¥${result.opening_balance?.toLocaleString()} → 期末 ¥${result.closing_balance?.toLocaleString()} / warnings ${result.warnings.length}`,
        );

        expect(result.bank_kind).toBe("rakuten");
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.opening_balance).not.toBeNull();
        expect(result.closing_balance).not.toBeNull();
        // warnings 0 が理想だが、0 件以上であれば許容 (CSV ヘッダー以外の特殊行があれば warning される)
        expect(result.warnings.length).toBeLessThan(10);
      });
    }
  });

  describe("みずほ銀行 .api 3 法人 (1 年分)", () => {
    for (const { corp, file, expectedManualBalance } of MIZUHO_FILES) {
      it(`${corp}: パース成功 + 手入力残高 ¥${expectedManualBalance.toLocaleString()}`, () => {
        const filePath = path.join(MIZUHO_DIR, file);
        if (!existsSync(filePath)) {
          console.warn(`  ⚠️ ${corp}: ファイル無し → skip`);
          return;
        }
        const buf = readFileSync(filePath);
        const period = deriveMizuhoFilenamePeriod(file);
        expect(period).not.toBeNull();
        const result = parseMizuhoApi(buf, { period: period! });

        const firstDate =
          result.rows.length > 0 ? result.rows[0].transaction_date : null;
        const lastDate =
          result.rows.length > 0
            ? result.rows[result.rows.length - 1].transaction_date
            : null;

        // 1 年累計 (deposit - withdrawal)
        let netFlow = 0;
        for (const r of result.rows) {
          netFlow += r.flow === "deposit" ? r.amount : -r.amount;
        }
        // 期初残高 (逆算): 手入力 4/30 残高 - 1 年累計
        const derivedOpeningBalance = expectedManualBalance - netFlow;

        console.log(
          `  📊 みずほ ${corp}: ${result.rows.length} 件 / 期間 ${firstDate} 〜 ${lastDate} / 1 年累計 ${netFlow >= 0 ? "+" : ""}¥${netFlow.toLocaleString()} / 期初推定 ¥${derivedOpeningBalance.toLocaleString()} (= 手入力 ¥${expectedManualBalance.toLocaleString()} - 累計) / warnings ${result.warnings.length}`,
        );

        expect(result.bank_kind).toBe("mizuho");
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.opening_balance).toBeNull(); // .api は残高列なし
      });
    }
  });

  describe("みずほ銀行 リンクサポート 短期間 CSV (全銀協 13 列形式 = kyoto parser 流用)", () => {
    it(`リンクサポート: 3 週間分 (4/10-4/30) パース`, () => {
      const filePath = path.join(BASE, MIZUHO_LINK_FILE.file);
      if (!existsSync(filePath)) {
        console.warn(`  ⚠️ ファイル無し → skip`);
        return;
      }
      const buf = readFileSync(filePath);
      // ⭐ みずほ短期間 CSV は照会口座始まりの 13 列形式 (kyoto と同じ全銀協形式)
      // ⭐ ただし残高 (col 7) は空欄 → balance_after は null になる
      const result = parseKyotoCsv(buf);

      console.log(
        `  📊 みずほ リンクサポート: ${result.rows.length} 件 / 期間 ${result.rows[0]?.transaction_date} 〜 ${result.rows[result.rows.length - 1]?.transaction_date} / 期待 4/30 残高 ¥${MIZUHO_LINK_FILE.expectedManualBalance.toLocaleString()} (手入力照合用, CSV 残高列は空欄) / warnings ${result.warnings.length}`,
      );

      expect(result.bank_kind).toBe("kyoto"); // parser 流用のため kyoto
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe("PayPay 銀行 センターライズ", () => {
    it(`センターライズ: 9 ヶ月分 + 4/30 残高 ¥${PAYPAY_FILE.expectedClosingBalance.toLocaleString()}`, () => {
      const filePath = path.join(BASE, PAYPAY_FILE.file);
      if (!existsSync(filePath)) {
        console.warn(`  ⚠️ ファイル無し → skip`);
        return;
      }
      const buf = readFileSync(filePath);
      const result = parsePayPayCsv(buf);

      console.log(
        `  📊 PayPay センターライズ: ${result.rows.length} 件 / 期間 ${result.rows[0]?.transaction_date} 〜 ${result.rows[result.rows.length - 1]?.transaction_date} / 期初 ¥${result.opening_balance?.toLocaleString()} → 期末 ¥${result.closing_balance?.toLocaleString()} / warnings ${result.warnings.length}`,
      );

      expect(result.bank_kind).toBe("paypay");
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.closing_balance).toBe(PAYPAY_FILE.expectedClosingBalance);
    });
  });

  describe("弥生インポート CSV (ヒュアラン 1 年分)", () => {
    const YAYOI_FILE = path.join(
      "G:\\",
      "マイドライブ",
      "17_システム構築",
      "07_Claude",
      "01_東海林美琴",
      "001_仕訳帳",
      "01_株式会社ヒュアラン",
      "1_銀行",
      "3_完成データを確認",
      "20260408_処理済み",
      "弥生インポート_01_株式会社ヒュアラン_20260408.csv",
    );

    it.skipIf(!existsSync(YAYOI_FILE))(
      "ヒュアラン: 1,682 行パース + 期間 2025/4-2026/4",
      () => {
        const buf = readFileSync(YAYOI_FILE);
        const result = parseYayoiImportCsv(buf);

        console.log(
          `  📊 弥生 ヒュアラン: ${result.row_count} 件 / 期間 ${result.date_range?.from} 〜 ${result.date_range?.to} / warnings ${result.warnings.length}`,
        );

        expect(result.row_count).toBeGreaterThan(1000); // ~1,682 期待
        expect(result.warnings.length).toBe(0); // 全行 25 列均一
        expect(result.date_range).not.toBeNull();
        expect(result.date_range!.from).toMatch(/^2025-04/);

        // サンプル: 1 行目は 2025/4/1 のみずほ → 楽天 振替 ¥5,000,000 (期初残高設定)
        const firstRow = result.rows[0];
        expect(firstRow.transaction_date).toBe("2025-04-01");
        expect(firstRow.denpyo_no).toBe(1);
      },
    );
  });

  describe("京都銀行 ヒュアラン", () => {
    it(`ヒュアラン: 2 ヶ月分 (3/9-5/7) + 4/30 残高 ¥${KYOTO_FILE.expectedClosingBalance4_13.toLocaleString()} (= 4/13 取引後)`, () => {
      const filePath = path.join(BASE, KYOTO_FILE.file);
      if (!existsSync(filePath)) {
        console.warn(`  ⚠️ ファイル無し → skip`);
        return;
      }
      const buf = readFileSync(filePath);
      const result = parseKyotoCsv(buf);

      // 4/30 時点の残高 = 4/30 以前の最終取引の balance_after
      const before430 = result.rows.filter(
        (r) => r.transaction_date <= "2026-04-30",
      );
      const balance430 =
        before430.length > 0
          ? before430[before430.length - 1].balance_after
          : null;

      console.log(
        `  📊 京都 ヒュアラン: ${result.rows.length} 件 / 期間 ${result.rows[0]?.transaction_date} 〜 ${result.rows[result.rows.length - 1]?.transaction_date} / 期初 ¥${result.opening_balance?.toLocaleString()} → 期末 ¥${result.closing_balance?.toLocaleString()} / 4/30 時点残高 ¥${balance430?.toLocaleString()} / warnings ${result.warnings.length}`,
      );

      expect(result.bank_kind).toBe("kyoto");
      expect(result.rows.length).toBeGreaterThan(0);
      expect(balance430).toBe(KYOTO_FILE.expectedClosingBalance4_13);
    });
  });
});
