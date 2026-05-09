/**
 * Garden-Soil Phase B-01 Phase 2: 自前 CSV パーサ（RFC 4180 最小サブセット）
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §13 判 6
 *
 * 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
 *
 * 役割:
 *   FileMaker CSV（UTF-8 BOM 付き、LF or CRLF、カンマ区切り、ダブルクォート囲み）を
 *   外部依存なし（npm 追加なし）でパースする。
 *
 *   csv-parse 等の外部ライブラリ追加を回避（CLAUDE.md「事前相談」要を回避）。
 *
 * 対応範囲（RFC 4180 最小サブセット）:
 *   - カンマ区切り
 *   - ダブルクォート囲み（カンマ・改行を含むセル対応）
 *   - エスケープ "" → 単一 "
 *   - UTF-8 BOM 自動除去
 *   - LF / CRLF 改行
 *   - ヘッダー行 + データ行（行オブジェクト配列を返す）
 *   - 空行スキップ
 *
 * 非対応（明示的に対象外）:
 *   - タブ区切り / セミコロン区切り（カンマ固定）
 *   - 異種改行混在（LF or CRLF どちらかに統一前提）
 *   - 複雑なエスケープシーケンス（\\n 等の C エスケープは生値扱い）
 *
 * 設計方針:
 *   - 純粋関数（IO なし）
 *   - TDD で開発（src/lib/db/__tests__/soil-csv-parser.test.ts）
 *   - 大規模ファイル（200 万件 CSV）はストリーミング parser（後段 script で別途実装）
 */

// ============================================================
// BOM 除去
// ============================================================

/**
 * UTF-8 BOM (﻿) を文字列先頭から除去する。
 *
 * - 中間にある BOM は除去しない（正規データの可能性）
 * - BOM がなければそのまま
 */
export function stripBom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

// ============================================================
// 1 行パース（複数行 cell 不可、引用符内改行は parseCsvText 側で処理）
// ============================================================

/**
 * 単一の CSV 行を cell 配列に分解する。
 *
 * 仕様:
 *   - カンマで区切る
 *   - ダブルクォート囲みのセル内ではカンマを保持
 *   - エスケープ "" → 単一 "
 *   - 行末の \r（CRLF の名残）は trim
 *   - 空行は 1 cell 空文字を返す
 *
 * 注: クォート内に改行があるケースは本関数では扱わない（parseCsvText 側で複数行 cell を結合）。
 */
export function parseCsvLine(line: string): string[] {
  // 末尾の \r 除去（CRLF の \n 後に \r が残るケースは通常ないが、入力が \r 終端の場合の保険）
  const stripped = line.endsWith("\r") ? line.slice(0, -1) : line;

  const cells: string[] = [];
  let current = "";
  let inQuote = false;
  let i = 0;

  while (i < stripped.length) {
    const ch = stripped[i];

    if (inQuote) {
      if (ch === '"') {
        // エスケープ "" チェック
        if (i + 1 < stripped.length && stripped[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // 単独の " → クォート終了
        inQuote = false;
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    // クォート外
    if (ch === '"') {
      inQuote = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      cells.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }

  cells.push(current);
  return cells;
}

// ============================================================
// テキスト全体をパース（複数行 cell 対応）
// ============================================================

/**
 * CSV テキスト全体を行オブジェクト配列に変換する。
 *
 * - 1 行目をヘッダーとして扱う（ヘッダーのみなら空配列を返す）
 * - 引用符内の改行を保持して複数行 cell を 1 行に結合
 * - BOM 自動除去
 * - 空行スキップ
 * - セル数不足 → 空文字埋め / 余剰 → 無視
 *
 * @param text CSV テキスト全体
 * @returns 行オブジェクト配列（{ヘッダー名: cell 値}）
 */
export function parseCsvText(text: string): Record<string, string>[] {
  const cleaned = stripBom(text);
  if (cleaned === "") return [];

  // 物理行を、引用符内の改行を考慮して論理行に結合
  const logicalLines = splitLogicalLines(cleaned);
  if (logicalLines.length === 0) return [];

  // ヘッダー
  const headers = parseCsvLine(logicalLines[0] ?? "");

  const rows: Record<string, string>[] = [];
  for (let li = 1; li < logicalLines.length; li += 1) {
    const line = logicalLines[li] ?? "";
    if (line === "") continue;     // 空論理行スキップ
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let hi = 0; hi < headers.length; hi += 1) {
      const header = headers[hi] ?? "";
      row[header] = cells[hi] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

// ============================================================
// ストリーミング パーサ（200 万件 CSV 用）
// ============================================================

/**
 * 物理行（fs.createReadStream + readline 由来の AsyncIterable<string>）を
 * 行オブジェクトの async generator に変換する。
 *
 * 動作:
 *   - 1 行目を BOM 除去 + ヘッダーとして取り込む
 *   - クォート内の改行を跨ぐ場合は次行とバッファ結合
 *   - 完成した論理行を parseCsvLine で cell 分解 → ヘッダーとマッピング → yield
 *
 * 使用例:
 *   const stream = createReadStream(file, { encoding: "utf8" });
 *   const rl = createInterface({ input: stream, crlfDelay: Infinity });
 *   for await (const row of parseCsvLines(rl)) { ... }
 */
export async function* parseCsvLines(
  lines: AsyncIterable<string>,
): AsyncGenerator<Record<string, string>> {
  let headers: string[] | null = null;
  let pending = "";

  for await (let line of lines) {
    // 1 行目（ヘッダー）の BOM 除去
    if (headers === null) {
      line = stripBom(line);
    }

    const combined = pending === "" ? line : pending + "\n" + line;

    // クォート未閉なら次行とバッファ結合
    if (!isQuoteBalanced(combined)) {
      pending = combined;
      continue;
    }
    pending = "";

    if (combined === "") continue; // 空行スキップ

    if (headers === null) {
      headers = parseCsvLine(combined);
      continue;
    }

    const cells = parseCsvLine(combined);
    const row: Record<string, string> = {};
    for (let hi = 0; hi < headers.length; hi += 1) {
      const header = headers[hi] ?? "";
      row[header] = cells[hi] ?? "";
    }
    yield row;
  }

  // 末尾 pending の取りこぼし救済（クォート未閉のまま EOF）
  if (pending !== "" && headers !== null) {
    const cells = parseCsvLine(pending);
    const row: Record<string, string> = {};
    for (let hi = 0; hi < headers.length; hi += 1) {
      const header = headers[hi] ?? "";
      row[header] = cells[hi] ?? "";
    }
    yield row;
  }
}

/**
 * 文字列のクォートが平衡しているか（偶数個のクォートがあるか）を判定する純粋関数。
 * - エスケープ "" は無視（inQuote 状態を変えない）
 * - 平衡 = ストリーミング中に行末でクォートが閉じている状態
 */
export function isQuoteBalanced(text: string): boolean {
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && i + 1 < text.length && text[i + 1] === '"') {
        i += 2;
        continue;
      }
      inQuote = !inQuote;
    }
    i += 1;
  }
  return !inQuote;
}

// ============================================================
// 内部 helper: 論理行への分割（引用符内改行を保持）
// ============================================================

/**
 * 物理改行 (\n / \r\n) で分割しつつ、引用符内の改行は同一論理行に結合する。
 *
 * 例:
 *   入力: 'a,b\n"line1\nline2",c\n3,4'
 *   出力: ['a,b', '"line1\nline2",c', '3,4']
 */
function splitLogicalLines(text: string): string[] {
  const result: string[] = [];
  let buffer = "";
  let inQuote = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      // エスケープ "" は inQuote 状態を変えない
      if (inQuote && i + 1 < text.length && text[i + 1] === '"') {
        buffer += '""';
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      buffer += ch;
      i += 1;
      continue;
    }

    if (!inQuote && (ch === "\n" || ch === "\r")) {
      // CRLF の場合は \r\n を 1 つの区切りとして扱う
      result.push(buffer);
      buffer = "";
      if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    buffer += ch;
    i += 1;
  }

  if (buffer.length > 0) result.push(buffer);
  return result;
}
