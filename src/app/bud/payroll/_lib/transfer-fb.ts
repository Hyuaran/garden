/**
 * Garden-Bud / Phase D #07 全銀協 FB データ生成（純関数）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md §5
 *
 * 全銀協フォーマット:
 *   - 各レコード 120 桁固定長
 *   - 文字コード: Shift_JIS（半角カナのみ使用）
 *   - 改行: CR LF
 *   - レコード種別: 1=ヘッダ, 2=データ, 8=トレーラ, 9=エンド
 *
 * 純関数のみ。エンコーディング変換（Shift_JIS）は呼び出し側で iconv-lite 経由実施。
 */

import type { FbHeaderInput, FbDataRecordInput } from "./transfer-types";

// ============================================================
// 半角カナ変換マップ
// ============================================================

const FULLWIDTH_TO_HALFWIDTH_KANA: Record<string, string> = {
  // 清音
  ア: "ｱ", イ: "ｲ", ウ: "ｳ", エ: "ｴ", オ: "ｵ",
  カ: "ｶ", キ: "ｷ", ク: "ｸ", ケ: "ｹ", コ: "ｺ",
  サ: "ｻ", シ: "ｼ", ス: "ｽ", セ: "ｾ", ソ: "ｿ",
  タ: "ﾀ", チ: "ﾁ", ツ: "ﾂ", テ: "ﾃ", ト: "ﾄ",
  ナ: "ﾅ", ニ: "ﾆ", ヌ: "ﾇ", ネ: "ﾈ", ノ: "ﾉ",
  ハ: "ﾊ", ヒ: "ﾋ", フ: "ﾌ", ヘ: "ﾍ", ホ: "ﾎ",
  マ: "ﾏ", ミ: "ﾐ", ム: "ﾑ", メ: "ﾒ", モ: "ﾓ",
  ヤ: "ﾔ", ユ: "ﾕ", ヨ: "ﾖ",
  ラ: "ﾗ", リ: "ﾘ", ル: "ﾙ", レ: "ﾚ", ロ: "ﾛ",
  ワ: "ﾜ", ヲ: "ｦ", ン: "ﾝ",
  // 濁音（独立化）
  ガ: "ｶﾞ", ギ: "ｷﾞ", グ: "ｸﾞ", ゲ: "ｹﾞ", ゴ: "ｺﾞ",
  ザ: "ｻﾞ", ジ: "ｼﾞ", ズ: "ｽﾞ", ゼ: "ｾﾞ", ゾ: "ｿﾞ",
  ダ: "ﾀﾞ", ヂ: "ﾁﾞ", ヅ: "ﾂﾞ", デ: "ﾃﾞ", ド: "ﾄﾞ",
  バ: "ﾊﾞ", ビ: "ﾋﾞ", ブ: "ﾌﾞ", ベ: "ﾍﾞ", ボ: "ﾎﾞ",
  ヴ: "ｳﾞ",
  // 半濁音
  パ: "ﾊﾟ", ピ: "ﾋﾟ", プ: "ﾌﾟ", ペ: "ﾍﾟ", ポ: "ﾎﾟ",
  // 拗音（小書き）
  ァ: "ｧ", ィ: "ｨ", ゥ: "ｩ", ェ: "ｪ", ォ: "ｫ",
  ャ: "ｬ", ュ: "ｭ", ョ: "ｮ", ッ: "ｯ",
  // 記号
  "ー": "ｰ", "・": "･", "、": "､", "。": "｡",
  "「": "｢", "」": "｣",
  // 全角スペース
  "　": " ",
};

/**
 * 全角カナを半角カナに変換。
 * カタカナ・濁音・半濁音・小書き・記号に対応。
 * 変換不能な文字（漢字・ひらがな等）はそのまま残す（呼び出し側で検証推奨）。
 */
export function toHankakuKana(input: string): string {
  if (!input) return "";
  return [...input].map((c) => FULLWIDTH_TO_HALFWIDTH_KANA[c] ?? c).join("");
}

/**
 * 文字列が完全に半角カナ + 数字 + 記号（全銀協許可文字）で構成されているか検証。
 * 全角文字混入の検出に使う。
 */
export function isAllHankaku(input: string): boolean {
  // 半角カナ範囲: 0xFF61-0xFF9F (｡-ﾟ)
  // 数字: 0-9, 英大文字: A-Z, 半角スペース, ハイフン, ピリオド
  return /^[｡-ﾟ0-9A-Z \-.()]*$/.test(input);
}

// ============================================================
// 桁数調整ヘルパー
// ============================================================

/**
 * 右側を半角スペースで埋めて指定桁数にする（半角カナ向け）。
 * オーバー時は切り詰め。
 */
export function padRight(input: string, width: number, padChar = " "): string {
  if (input.length >= width) return input.slice(0, width);
  return input + padChar.repeat(width - input.length);
}

/**
 * 左側を 0 で埋めて指定桁数にする（数値向け）。
 * オーバー時はエラーではなく切り詰め（呼び出し側で予防検証）。
 */
export function padLeft(input: string, width: number, padChar = "0"): string {
  if (input.length >= width) return input.slice(-width);
  return padChar.repeat(width - input.length) + input;
}

// ============================================================
// レコード組み立て
// ============================================================

/**
 * ヘッダレコード（規格 1、120 桁）。
 *
 * フォーマット（spec §5.3）:
 *   位置 1   : '1'（規格区分）
 *   位置 2-3 : '21'（種別 = 総合振込）
 *   位置 4   : '0'（コード区分、0 = JIS）
 *   位置 5-14: 依頼人コード（10 文字）
 *   位置 15-54: 依頼人名（半角カナ、40 桁）
 *   位置 55-58: 振込指定日（MMDD）
 *   位置 59-62: 仕向銀行番号（4 桁）
 *   位置 63-77: 仕向銀行名（半角カナ、15 桁）
 *   位置 78-80: 仕向支店番号（3 桁）
 *   位置 81-95: 仕向支店名（半角カナ、15 桁）
 *   位置 96-96: 預金種目（1 普通 / 2 当座）
 *   位置 97-103: 口座番号（7 桁、ゼロ埋め）
 *   位置 104-120: ダミー（17 桁、半角スペース）
 */
export function buildHeaderRecord(input: FbHeaderInput): string {
  if (input.paymentDate.length !== 4) {
    throw new Error(`paymentDate must be MMDD (4 chars), got: "${input.paymentDate}"`);
  }
  return (
    "1" +
    "21" +
    "0" +
    padRight(input.requesterCode, 10, "0") +
    padRight(input.requesterName, 40) +
    input.paymentDate +
    padLeft(input.sourceBankCode, 4) +
    padRight(input.sourceBankName, 15) +
    padLeft(input.sourceBranchCode, 3) +
    padRight(input.sourceBranchName, 15) +
    input.sourceAccountType +
    padLeft(input.sourceAccountNumber, 7) +
    " ".repeat(17)
  );
}

/**
 * データレコード（規格 2、120 桁）。
 *
 * フォーマット（spec §5.4）:
 *   位置 1    : '2'
 *   位置 2-5  : 被仕向銀行番号（4 桁）
 *   位置 6-20 : 被仕向銀行名（15 桁）
 *   位置 21-23: 被仕向支店番号（3 桁）
 *   位置 24-38: 被仕向支店名（15 桁）
 *   位置 39-42: 手形交換所番号（4 桁、空白）
 *   位置 43   : 預金種目（1 普通 / 2 当座）
 *   位置 44-50: 口座番号（7 桁ゼロ埋め）
 *   位置 51-80: 受取人名（半角カナ、30 桁）
 *   位置 81-90: 振込金額（10 桁ゼロ埋め）
 *   位置 91   : 新規コード（空白）
 *   位置 92-101: 顧客コード 1（10 桁、空白）
 *   位置 102-111: 顧客コード 2（10 桁、空白）
 *   位置 112  : 振込指定区分（7 = 給与振込）
 *   位置 113  : 識別表示（空白）
 *   位置 114-120: ダミー（7 桁、空白）
 */
export function buildDataRecord(input: FbDataRecordInput): string {
  if (input.amount < 0) {
    throw new Error(`amount must be >= 0, got: ${input.amount}`);
  }
  return (
    "2" +
    padLeft(input.recipientBankCode, 4) +
    padRight(input.recipientBankName, 15) +
    padLeft(input.recipientBranchCode, 3) +
    padRight(input.recipientBranchName, 15) +
    " ".repeat(4) + // 手形交換所番号
    input.recipientAccountType +
    padLeft(input.recipientAccountNumber, 7) +
    padRight(input.recipientName, 30) +
    padLeft(String(input.amount), 10) +
    " " + // 新規コード
    " ".repeat(10) + // 顧客コード 1
    " ".repeat(10) + // 顧客コード 2
    "7" + // 振込指定区分（給与振込）
    " " + // 識別表示
    " ".repeat(7) // ダミー
  );
}

/**
 * トレーラレコード（規格 8、120 桁）。
 *
 * フォーマット:
 *   位置 1    : '8'
 *   位置 2-7  : 合計件数（6 桁ゼロ埋め）
 *   位置 8-19 : 合計金額（12 桁ゼロ埋め）
 *   位置 20-120: ダミー（101 桁、空白）
 */
export function buildTrailerRecord(itemCount: number, totalAmount: number): string {
  return (
    "8" +
    padLeft(String(itemCount), 6) +
    padLeft(String(totalAmount), 12) +
    " ".repeat(101)
  );
}

/**
 * エンドレコード（規格 9、120 桁）。
 *
 * フォーマット:
 *   位置 1    : '9'
 *   位置 2-120: ダミー（119 桁、空白）
 */
export function buildEndRecord(): string {
  return "9" + " ".repeat(119);
}

// ============================================================
// FB データ全体生成（複数明細）
// ============================================================

/**
 * FB データ（ヘッダ + 明細群 + トレーラ + エンド）を組み立て、
 * CR LF 連結した文字列で返す。
 * 呼び出し側で iconv-lite で Shift_JIS エンコード後 Storage に upload。
 */
export function buildFbData(
  header: FbHeaderInput,
  items: FbDataRecordInput[],
): { content: string; recordCount: number; totalAmount: number } {
  const headerLine = buildHeaderRecord(header);
  const dataLines = items.map((item) => buildDataRecord(item));
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const trailerLine = buildTrailerRecord(items.length, totalAmount);
  const endLine = buildEndRecord();

  // CR LF で連結（spec §5.2）
  const content = [headerLine, ...dataLines, trailerLine, endLine].join("\r\n") + "\r\n";

  return {
    content,
    recordCount: items.length,
    totalAmount,
  };
}
