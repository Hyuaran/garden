/**
 * 仕訳帳機能 共通 CSV パースユーティリティ
 *
 * 用途:
 *   - PayPay / 京都 CSV はダブルクォートで囲まれた RFC 4180 互換形式
 *   - 京都銀行は数字に 3 桁カンマ区切りが入る ("7,025,283" 等)
 *
 * 簡易 RFC 4180 実装:
 *   - フィールドは "..." で囲まれていれば内部に , や " を含められる
 *   - "" は " のエスケープ
 *   - フィールドが quote されていない場合は最初の , まで
 *   - 改行は \r\n / \n / \r いずれにも対応
 */

/**
 * RFC 4180 互換 CSV を 1 行ずつパース。
 * 引数は既にデコード済みの文字列 (Shift-JIS デコードは呼び出し側で行う)。
 *
 * @returns 各行が string[] の 2 次元配列
 */
export function parseCsvRfc4180(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // エスケープ判定
        if (i + 1 < n && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // クォート終了
        inQuotes = false;
        i++;
        continue;
      }
      // クォート内の任意文字 (改行も含む)
      currentField += ch;
      i++;
      continue;
    }

    // クォート外
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      // \r\n の \n を skip
      if (i < n && text[i] === "\n") i++;
      continue;
    }
    if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }

    currentField += ch;
    i++;
  }

  // 最終フィールド + 行
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * カンマ付き数字文字列をパース ("7,025,283" → 7025283)。
 * 空文字や非数値は null。マイナス符号 / 小数点も対応。
 */
export function parseGroupedNumber(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * 京都銀行の日付形式 (YYYY年MM月DD日) を YYYY-MM-DD に変換。
 *
 * @returns YYYY-MM-DD 文字列、または null (パース失敗時)
 */
export function parseKanjiDate(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const m = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const moNum = Number(mo);
  const dNum = Number(d);
  if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) return null;
  return `${y}-${String(moNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
}
