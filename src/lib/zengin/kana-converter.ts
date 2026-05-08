/**
 * Garden-Bud / 全銀協 CSV — 半角カタカナ変換
 *
 * 全銀協フォーマットの受取人名カナは「半角カタカナ30桁」で指定。
 * 入力が漢字・ひらがな・全角カナ混在でも、可能な限り半角カタカナに変換する。
 * 変換不能な文字（漢字等）は除去 + 警告を返す。
 *
 * 使用可能文字（全銀協仕様）:
 *   半角カタカナ: ｱ-ﾝ + ﾞﾟｰ
 *   半角英数: 0-9 A-Z（小文字は大文字化）
 *   記号: スペース . - ( ) / ,
 */

const FULL_TO_HALF_KATAKANA_MAP: Record<string, string> = {
  // 清音
  "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
  "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
  "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
  "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
  "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
  "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
  "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
  "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
  "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
  "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
  // 濁音（濁点を後ろにつける）
  "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
  "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
  "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
  "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
  "ヴ": "ｳﾞ",
  // 半濁音
  "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
  // 小書き
  "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
  "ッ": "ｯ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ",
  // 長音・中点
  "ー": "-", "・": ".",
};

/** 全角英数字を半角に変換するテーブル（オフセット計算） */
function toHalfWidthAlnum(char: string): string {
  const code = char.charCodeAt(0);
  // 全角数字 0-9（U+FF10 - U+FF19）
  if (code >= 0xff10 && code <= 0xff19) {
    return String.fromCharCode(code - 0xfee0);
  }
  // 全角英大文字 A-Z（U+FF21 - U+FF3A）
  if (code >= 0xff21 && code <= 0xff3a) {
    return String.fromCharCode(code - 0xfee0);
  }
  // 全角英小文字 a-z → 大文字化
  if (code >= 0xff41 && code <= 0xff5a) {
    return String.fromCharCode(code - 0xfee0 - 0x20);
  }
  // 全角スペース
  if (code === 0x3000) return " ";
  return char;
}

/** ひらがな → 全角カタカナ */
function hiraganaToKatakana(char: string): string {
  const code = char.charCodeAt(0);
  // ひらがな U+3041 - U+3096
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCharCode(code + 0x60);
  }
  return char;
}

/** 半角文字として既に使用可能か */
function isAllowedHalfWidth(char: string): boolean {
  return /^[\x20-\x7E\uFF61-\uFF9F]$/.test(char);
}

/**
 * 入力文字列を半角カタカナ（全銀協仕様）に変換する。
 *
 * @returns { kana, warnings }
 *   - kana: 変換後の文字列（変換不能文字は除去）
 *   - warnings: 除去された文字の警告メッセージ
 */
export function toHalfWidthKana(input: string): {
  kana: string;
  warnings: string[];
} {
  const trimmed = input.trim();
  const warnings: string[] = [];
  let result = "";

  for (const char of trimmed) {
    // まずひらがな → カタカナ
    const katakana = hiraganaToKatakana(char);

    // 全角カタカナ → 半角カタカナ
    if (FULL_TO_HALF_KATAKANA_MAP[katakana]) {
      result += FULL_TO_HALF_KATAKANA_MAP[katakana];
      continue;
    }

    // 全角英数 → 半角英数（大文字）
    const alnum = toHalfWidthAlnum(katakana);
    if (alnum !== katakana || isAllowedHalfWidth(alnum)) {
      // 英数字や許可記号の場合、大文字化して通す
      result += alnum.toUpperCase() === alnum ? alnum : alnum.toUpperCase();
      continue;
    }

    // 半角英小文字 → 大文字
    if (/[a-z]/.test(katakana)) {
      result += katakana.toUpperCase();
      continue;
    }

    // 変換不能
    warnings.push(`変換不能文字を除去: "${char}"`);
  }

  return { kana: result, warnings };
}
