/**
 * Garden-Soil 共通ヘルパー関数
 *
 * 対応 spec:
 *   - docs/specs/2026-04-25-soil-04-import-strategy.md（#04 インポート戦略、正規化規則）
 *   - docs/specs/2026-04-25-soil-07-delete-pattern.md（#07 削除パターン）
 *
 * 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
 *
 * 設計方針:
 *   - すべて純粋関数（DB アクセスなし、外部依存なし）
 *   - import 時の正規化 / 論理削除ペイロード生成等、再利用性の高いロジックを集約
 *   - TDD で開発（src/lib/db/__tests__/soil-helpers.test.ts 参照）
 */

// ============================================================
// 電話番号正規化
// ============================================================

/**
 * 電話番号を E.164 風の `+81` プレフィックス形式に正規化する。
 *
 * 規則:
 *   1. 全角数字 → 半角数字
 *   2. 空白 / ハイフン / 全角ハイフン / 丸括弧 を除去
 *   3. 残った文字列が空 or 数字以外を含む → null
 *   4. 先頭 `81` は `+81` にする（既に正規化済の想定）
 *   5. 先頭 `0` は除去して `+81` を前置（日本国内番号の標準）
 *   6. 上記以外は `+81` を前置（万一の入力ゆれを許容）
 *
 * @param input 入力（null / undefined / 空文字も受付）
 * @returns 正規化済 +81 形式 / 不正入力時は null
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null || input === "") return null;

  // 1. 全角数字 → 半角
  const halfWidth = input.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 2. 区切り文字除去
  const stripped = halfWidth.replace(/[\s\-‐－ー\(\)（）]/g, "");

  // 3. 残りが空 or 数字以外を含む → null
  if (stripped === "" || !/^\+?\d+$/.test(stripped)) return null;

  // 4-6. プレフィックス整形
  const digitsOnly = stripped.replace(/^\+/, "");
  if (digitsOnly.startsWith("81")) {
    return "+" + digitsOnly;
  }
  if (digitsOnly.startsWith("0")) {
    return "+81" + digitsOnly.slice(1);
  }
  return "+81" + digitsOnly;
}

// ============================================================
// カナ正規化
// ============================================================

// 半角カナ → 全角カナの基本対応表
const HANKAKU_KANA_MAP: Record<string, string> = {
  "ｦ": "ヲ", "ｧ": "ァ", "ｨ": "ィ", "ｩ": "ゥ", "ｪ": "ェ", "ｫ": "ォ",
  "ｬ": "ャ", "ｭ": "ュ", "ｮ": "ョ", "ｯ": "ッ", "ｰ": "ー",
  "ｱ": "ア", "ｲ": "イ", "ｳ": "ウ", "ｴ": "エ", "ｵ": "オ",
  "ｶ": "カ", "ｷ": "キ", "ｸ": "ク", "ｹ": "ケ", "ｺ": "コ",
  "ｻ": "サ", "ｼ": "シ", "ｽ": "ス", "ｾ": "セ", "ｿ": "ソ",
  "ﾀ": "タ", "ﾁ": "チ", "ﾂ": "ツ", "ﾃ": "テ", "ﾄ": "ト",
  "ﾅ": "ナ", "ﾆ": "ニ", "ﾇ": "ヌ", "ﾈ": "ネ", "ﾉ": "ノ",
  "ﾊ": "ハ", "ﾋ": "ヒ", "ﾌ": "フ", "ﾍ": "ヘ", "ﾎ": "ホ",
  "ﾏ": "マ", "ﾐ": "ミ", "ﾑ": "ム", "ﾒ": "メ", "ﾓ": "モ",
  "ﾔ": "ヤ", "ﾕ": "ユ", "ﾖ": "ヨ",
  "ﾗ": "ラ", "ﾘ": "リ", "ﾙ": "ル", "ﾚ": "レ", "ﾛ": "ロ",
  "ﾜ": "ワ", "ﾝ": "ン",
  "ｶﾞ": "ガ", "ｷﾞ": "ギ", "ｸﾞ": "グ", "ｹﾞ": "ゲ", "ｺﾞ": "ゴ",
  "ｻﾞ": "ザ", "ｼﾞ": "ジ", "ｽﾞ": "ズ", "ｾﾞ": "ゼ", "ｿﾞ": "ゾ",
  "ﾀﾞ": "ダ", "ﾁﾞ": "ヂ", "ﾂﾞ": "ヅ", "ﾃﾞ": "デ", "ﾄﾞ": "ド",
  "ﾊﾞ": "バ", "ﾋﾞ": "ビ", "ﾌﾞ": "ブ", "ﾍﾞ": "ベ", "ﾎﾞ": "ボ",
  "ﾊﾟ": "パ", "ﾋﾟ": "ピ", "ﾌﾟ": "プ", "ﾍﾟ": "ペ", "ﾎﾟ": "ポ",
  "ｳﾞ": "ヴ",
};

/**
 * カナを正規化する。
 *
 * 規則:
 *   1. 半角カナ → 全角カナ（濁点・半濁点付き 2 文字も対応）
 *   2. ひらがな → カタカナ
 *   3. その他文字（英数字・記号等）はそのまま
 *
 * @param input 入力（null / undefined / 空文字も受付）
 * @returns 正規化済カナ / 入力が空なら空文字
 */
export function normalizeKana(input: string | null | undefined): string {
  if (input == null || input === "") return "";

  // 1. 半角カナ（2 文字組合せ優先）
  let result = "";
  let i = 0;
  while (i < input.length) {
    const two = input.slice(i, i + 2);
    if (HANKAKU_KANA_MAP[two]) {
      result += HANKAKU_KANA_MAP[two];
      i += 2;
      continue;
    }
    const one = input[i] ?? "";
    if (HANKAKU_KANA_MAP[one]) {
      result += HANKAKU_KANA_MAP[one];
      i += 1;
      continue;
    }
    result += one;
    i += 1;
  }

  // 2. ひらがな → カタカナ（U+3041 〜 U+3096）
  result = result.replace(/[ぁ-ゖ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60),
  );

  return result;
}

// ============================================================
// 論理削除ペイロード（横断統一規格、#07）
// ============================================================

export type SoftDeleteInput = {
  deletedBy: string;
  reason?: string;
};

export type SoftDeletePayload = {
  deleted_at: string;
  deleted_by: string;
  deleted_reason: string | null;
  updated_at: string;
  updated_by: string;
};

/**
 * 論理削除用の UPDATE ペイロードを生成する。
 *
 * 横断統一規格（#07 §3.1）:
 *   - deleted_at: 現在時刻（ISO 文字列）
 *   - deleted_by: 削除実行者
 *   - deleted_reason: 任意（'duplicate' | 'request' | 'cooling' 等）
 *   - updated_at / updated_by も同時更新（行の最終更新追跡）
 */
export function buildSoftDeletePayload(input: SoftDeleteInput): SoftDeletePayload {
  const now = new Date().toISOString();
  return {
    deleted_at: now,
    deleted_by: input.deletedBy,
    deleted_reason: input.reason ?? null,
    updated_at: now,
    updated_by: input.deletedBy,
  };
}

/**
 * 行が論理削除済みかを判定する。
 */
export function isSoilListSoftDeleted(row: { deleted_at: string | null }): boolean {
  return row.deleted_at != null;
}
