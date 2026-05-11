/**
 * D-07 全銀協 FB データ生成 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md §5
 *
 * 網羅項目:
 *   1. toHankakuKana（清音 / 濁音 / 半濁音 / 拗音 / 記号 / 漢字 fallthrough）
 *   2. isAllHankaku（半角 / 全角混入検出）
 *   3. padRight / padLeft（境界 / オーバー切詰め）
 *   4. buildHeaderRecord（120 桁固定長）
 *   5. buildDataRecord（120 桁、振込指定区分 7 確認）
 *   6. buildTrailerRecord / buildEndRecord（120 桁）
 *   7. buildFbData（全体組み立て、CR LF 改行 + 末尾改行）
 */

import { describe, it, expect } from "vitest";
import {
  toHankakuKana,
  isAllHankaku,
  padRight,
  padLeft,
  buildHeaderRecord,
  buildDataRecord,
  buildTrailerRecord,
  buildEndRecord,
  buildFbData,
} from "../transfer-fb";
import type { FbHeaderInput, FbDataRecordInput } from "../transfer-types";

// ============================================================
// 1. toHankakuKana
// ============================================================

describe("toHankakuKana", () => {
  it("清音", () => {
    expect(toHankakuKana("ヤマダタロウ")).toBe("ﾔﾏﾀﾞﾀﾛｳ");
  });

  it("ひらがな・カナ混在は カナのみ変換、ひらがなはそのまま", () => {
    // 「ダ」は濁音化されている、「やまだ」はひらがなで残る
    expect(toHankakuKana("ダ")).toBe("ﾀﾞ");
  });

  it("濁音（ガギグゲゴ）", () => {
    expect(toHankakuKana("ガギグゲゴ")).toBe("ｶﾞｷﾞｸﾞｹﾞｺﾞ");
  });

  it("半濁音（パピプペポ）", () => {
    expect(toHankakuKana("パピプペポ")).toBe("ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ");
  });

  it("拗音・促音（ャュョッ）", () => {
    expect(toHankakuKana("シュッパツ")).toBe("ｼｭｯﾊﾟﾂ");
  });

  it("長音", () => {
    expect(toHankakuKana("コーヒー")).toBe("ｺｰﾋｰ");
  });

  it("空文字 → 空文字", () => {
    expect(toHankakuKana("")).toBe("");
  });

  it("漢字混入は漢字を残す（呼び出し側で検証推奨）", () => {
    expect(toHankakuKana("山田タロウ")).toBe("山田ﾀﾛｳ");
  });

  it("カブシキガイシャ ヒュアラン", () => {
    expect(toHankakuKana("カブシキガイシャ ヒュアラン")).toBe("ｶﾌﾞｼｷｶﾞｲｼｬ ﾋｭｱﾗﾝ");
  });
});

// ============================================================
// 2. isAllHankaku
// ============================================================

describe("isAllHankaku", () => {
  it.each([
    ["ﾔﾏﾀﾞ ﾀﾛｳ", true],
    ["ABC123", true],
    ["ﾀ-ﾅｶ", true],
    ["", true], // 空文字は OK
    ["ｶﾌﾞｼｷｶﾞｲｼｬ", true],
  ])("正常: %s → %s", (input, expected) => {
    expect(isAllHankaku(input)).toBe(expected);
  });

  it.each([
    ["山田", "漢字"],
    ["やまだ", "ひらがな"],
    ["ヤマダ", "全角カナ"],
    ["山田 ﾀﾛｳ", "漢字混入"],
  ])("異常: %s (%s)", (input) => {
    expect(isAllHankaku(input)).toBe(false);
  });
});

// ============================================================
// 3. padRight / padLeft
// ============================================================

describe("padRight", () => {
  it("短文字列 → 右パディング", () => {
    expect(padRight("ABC", 5)).toBe("ABC  ");
  });

  it("ちょうど → 不変", () => {
    expect(padRight("ABCDE", 5)).toBe("ABCDE");
  });

  it("オーバー → 切詰め", () => {
    expect(padRight("ABCDEFG", 5)).toBe("ABCDE");
  });

  it("0 桁 → 空文字", () => {
    expect(padRight("ABC", 0)).toBe("");
  });
});

describe("padLeft", () => {
  it("短文字列 → 左 0 パディング", () => {
    expect(padLeft("123", 7)).toBe("0000123");
  });

  it("ちょうど → 不変", () => {
    expect(padLeft("1234567", 7)).toBe("1234567");
  });

  it("オーバー → 末尾切詰め（左から切る）", () => {
    expect(padLeft("123456789", 7)).toBe("3456789");
  });
});

// ============================================================
// 4-6. レコード組み立て（120 桁固定長）
// ============================================================

function buildSampleHeader(): FbHeaderInput {
  return {
    requesterCode: "1234567890",
    requesterName: toHankakuKana("カブシキガイシャ ヒュアラン"),
    paymentDate: "0525", // 5 月 25 日
    sourceBankCode: "0001",
    sourceBankName: toHankakuKana("ミズホ"),
    sourceBranchCode: "100",
    sourceBranchName: toHankakuKana("ホンテン"),
    sourceAccountType: "1",
    sourceAccountNumber: "1234567",
  };
}

describe("buildHeaderRecord", () => {
  it("120 桁固定", () => {
    const line = buildHeaderRecord(buildSampleHeader());
    expect(line.length).toBe(120);
  });

  it("先頭 '121' (規格 1 + 種別 21)", () => {
    const line = buildHeaderRecord(buildSampleHeader());
    expect(line.slice(0, 3)).toBe("121");
  });

  it("コード区分 '0' (4 桁目)", () => {
    const line = buildHeaderRecord(buildSampleHeader());
    expect(line.charAt(3)).toBe("0");
  });

  it("依頼人コード（10 桁）", () => {
    const line = buildHeaderRecord(buildSampleHeader());
    expect(line.slice(4, 14)).toBe("1234567890");
  });

  it("不正な paymentDate → エラー", () => {
    const h = buildSampleHeader();
    h.paymentDate = "525"; // 3 桁
    expect(() => buildHeaderRecord(h)).toThrow();
  });
});

function buildSampleDataRecord(amount = 282_475): FbDataRecordInput {
  return {
    recipientBankCode: "0005",
    recipientBankName: toHankakuKana("ミツビシ"),
    recipientBranchCode: "200",
    recipientBranchName: toHankakuKana("シブヤ"),
    recipientAccountType: "1",
    recipientAccountNumber: "1234567",
    recipientName: toHankakuKana("ヤマダ タロウ"),
    amount,
  };
}

describe("buildDataRecord", () => {
  it("120 桁固定", () => {
    const line = buildDataRecord(buildSampleDataRecord());
    expect(line.length).toBe(120);
  });

  it("先頭 '2'（規格区分）", () => {
    const line = buildDataRecord(buildSampleDataRecord());
    expect(line.charAt(0)).toBe("2");
  });

  it("振込指定区分 '7'（給与振込）— 位置 112", () => {
    const line = buildDataRecord(buildSampleDataRecord());
    expect(line.charAt(111)).toBe("7");
  });

  it("振込金額 10 桁ゼロ埋め", () => {
    const line = buildDataRecord(buildSampleDataRecord(282_475));
    expect(line.slice(80, 90)).toBe("0000282475");
  });

  it("amount 負数 → エラー", () => {
    const r = buildSampleDataRecord(-1);
    expect(() => buildDataRecord(r)).toThrow();
  });
});

describe("buildTrailerRecord", () => {
  it("120 桁固定", () => {
    const line = buildTrailerRecord(10, 5_000_000);
    expect(line.length).toBe(120);
  });

  it("先頭 '8'", () => {
    const line = buildTrailerRecord(10, 5_000_000);
    expect(line.charAt(0)).toBe("8");
  });

  it("件数 6 桁 + 金額 12 桁", () => {
    const line = buildTrailerRecord(10, 5_000_000);
    expect(line.slice(1, 7)).toBe("000010");
    expect(line.slice(7, 19)).toBe("000005000000");
  });
});

describe("buildEndRecord", () => {
  it("120 桁固定", () => {
    const line = buildEndRecord();
    expect(line.length).toBe(120);
  });

  it("先頭 '9' + 119 桁スペース", () => {
    const line = buildEndRecord();
    expect(line.charAt(0)).toBe("9");
    expect(line.slice(1)).toBe(" ".repeat(119));
  });
});

// ============================================================
// 7. buildFbData（全体）
// ============================================================

describe("buildFbData", () => {
  it("ヘッダ + 明細 3 件 + トレーラ + エンド + 末尾改行", () => {
    const header = buildSampleHeader();
    const items = [
      buildSampleDataRecord(282_475),
      buildSampleDataRecord(350_000),
      buildSampleDataRecord(450_000),
    ];
    const result = buildFbData(header, items);

    expect(result.recordCount).toBe(3);
    expect(result.totalAmount).toBe(1_082_475);

    // 改行 \r\n で分割（末尾改行で空文字 1 つ追加される）
    const lines = result.content.split("\r\n");
    expect(lines.length).toBe(7); // ヘッダ + 3 明細 + トレーラ + エンド + 末尾空

    expect(lines[0].charAt(0)).toBe("1"); // ヘッダ
    expect(lines[1].charAt(0)).toBe("2"); // 明細 1
    expect(lines[2].charAt(0)).toBe("2");
    expect(lines[3].charAt(0)).toBe("2");
    expect(lines[4].charAt(0)).toBe("8"); // トレーラ
    expect(lines[5].charAt(0)).toBe("9"); // エンド
    expect(lines[6]).toBe(""); // 末尾改行
  });

  it("明細 0 件でもヘッダ + トレーラ + エンドを出力", () => {
    const header = buildSampleHeader();
    const result = buildFbData(header, []);

    expect(result.recordCount).toBe(0);
    expect(result.totalAmount).toBe(0);
    const lines = result.content.split("\r\n");
    expect(lines.length).toBe(4); // ヘッダ + トレーラ + エンド + 末尾空
    expect(lines[0].charAt(0)).toBe("1");
    expect(lines[1].charAt(0)).toBe("8");
    expect(lines[2].charAt(0)).toBe("9");
    expect(lines[3]).toBe("");
  });

  it("各レコードが 120 桁", () => {
    const header = buildSampleHeader();
    const items = [buildSampleDataRecord(100_000)];
    const result = buildFbData(header, items);
    const lines = result.content.split("\r\n").filter((l) => l.length > 0);
    for (const line of lines) {
      expect(line.length).toBe(120);
    }
  });

  it("totalAmount は明細の合計", () => {
    const header = buildSampleHeader();
    const items = [
      buildSampleDataRecord(100_000),
      buildSampleDataRecord(200_000),
      buildSampleDataRecord(300_000),
    ];
    const result = buildFbData(header, items);
    expect(result.totalAmount).toBe(600_000);
  });
});
