/**
 * PDF（試算表）から会社/売上/外注/利益/期間を抽出する。
 *
 * PoC (scripts/poc-pdfjs-extract.mjs) の実装をベースに、
 * Next.js サーバーランタイム (Node.js) で動作する形に移植。
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { COMPANY_MAP } from "./constants";
import type { ParsePdfResult } from "@/app/forest/_lib/types";

type TextItem = {
  page: number;
  str: string;
  x: number;
  y: number;
};

/** PDF のテキストアイテムを位置情報付きで取得 */
async function extractTextItems(buffer: Buffer): Promise<TextItem[]> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocument({ data, standardFontDataUrl: undefined as unknown as string }).promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    for (const it of textContent.items) {
      if (!("str" in it)) continue;
      const [, , , , e, f] = it.transform;
      items.push({
        page: p,
        str: it.str,
        x: e,
        y: viewport.height - f,
      });
    }
  }
  return items;
}

/** y 座標の近さで行にグループ化 */
function groupByRow(items: TextItem[], yTolerance = 3): TextItem[][] {
  const rows: TextItem[][] = [];
  for (const it of items) {
    let placed = false;
    for (const row of rows) {
      const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
      if (Math.abs(avgY - it.y) <= yTolerance && row[0].page === it.page) {
        row.push(it);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([it]);
  }
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

/** 行テキストから整数を抽出（小数・構成比はスキップ） */
function extractNumbers(text: string): number[] {
  const matches = text.match(/-?[\d,]+(?:\.\d+)?/g) || [];
  const results: number[] = [];
  for (const m of matches) {
    const s = m.replace(/,/g, "");
    if (s.includes(".")) continue;
    const v = parseInt(s, 10);
    if (!isNaN(v)) results.push(v);
  }
  return results;
}

/**
 * PDF Buffer から進行期データを抽出する。
 */
export async function extractFromPdf(
  buffer: Buffer,
  filename: string = ""
): Promise<ParsePdfResult> {
  const items = await extractTextItems(buffer);
  const fullText = items.map((i) => i.str).join("");
  const fullTextNoSpace = fullText.replace(/\s/g, "");

  let company_id: string | null = null;
  for (const [name, cid] of Object.entries(COMPANY_MAP)) {
    if (fullTextNoSpace.includes(name)) {
      company_id = cid;
      break;
    }
  }

  let period: string | null = null;
  const periodMatch = fullText.match(/至\s*令和\s*(\d+)\s*年\s*(\d+)\s*月/);
  if (periodMatch) {
    const year = parseInt(periodMatch[1], 10) + 2018;
    const month = parseInt(periodMatch[2], 10);
    period = `${year}/${month}`;
  }

  const isComparative =
    fullTextNoSpace.includes("前期比較") || filename.includes("前期比較");

  const rows = groupByRow(items);

  let uriage: number | null = null;
  let gaichuhi: number | null = null;
  let rieki: number | null = null;

  for (const row of rows) {
    const rowText = row.map((r) => r.str).join("");
    const rowClean = rowText.replace(/\s/g, "");
    const nums = extractNumbers(rowText);
    if (nums.length === 0) continue;

    if (rowClean.includes("売上高合計")) {
      const filtered = nums.filter((n) => n > 0);
      if (filtered.length > 0) {
        uriage = isComparative
          ? filtered[1] ?? filtered[0]
          : filtered[filtered.length - 2] ?? filtered[0];
      }
    }

    if (rowClean.includes("外注費") && !rowClean.includes("営業外")) {
      const filtered = nums.filter((n) => n > 0);
      if (filtered.length > 0) {
        gaichuhi = isComparative
          ? filtered[1] ?? filtered[0]
          : filtered[filtered.length - 2] ?? filtered[0];
      }
    }

    if (rowClean.includes("当期純損益金額")) {
      rieki = isComparative
        ? nums[1] ?? nums[0]
        : nums[nums.length - 2] ?? nums[0];
    }
  }

  return { company_id, uriage, gaichuhi, rieki, period };
}

/** PDF が財務諸表かを先頭ページで判定 */
export async function isFinancialStatement(buffer: Buffer): Promise<boolean> {
  const items = await extractTextItems(buffer);
  if (items.length === 0) return false;
  const firstPageText = items
    .filter((i) => i.page === 1)
    .map((i) => i.str)
    .join("");
  const t = firstPageText.replace(/\s/g, "");
  return (
    t.includes("残高試算表") ||
    t.includes("損益計算書") ||
    t.includes("貸借対照表")
  );
}
