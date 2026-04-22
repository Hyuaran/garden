/**
 * PoC: pdfjs-dist で試算表PDFから売上/外注/利益を抽出
 *
 * Python 版 (pdfplumber) と同じロジックを Node.js 側で実装可能か検証する。
 * 目的: Phase A2 Web UI の /api/forest/parse-pdf で使える品質か判定。
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const PDF_DIR =
  "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/001_仕訳帳/D_税理士連携データ";

const COMPANY_MAP = {
  "ヒュアラン": "hyuaran",
  "センターライズ": "centerrise",
  "リンクサポート": "linksupport",
  "ＡＲＡＴＡ": "arata",
  "ARATA": "arata",
  "たいよう": "taiyou",
  "壱": "ichi",
};

/**
 * PDF からテキストアイテム配列を取得
 * 各アイテムは { str, x, y, height, width } を持つ
 */
async function extractTextItems(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdf = await getDocument({ data, standardFontDataUrl: null }).promise;
  const items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    for (const it of textContent.items) {
      if (!("str" in it)) continue;
      const [a, b, c, d, e, f] = it.transform;
      items.push({
        page: p,
        str: it.str,
        x: e,
        y: viewport.height - f, // pdfjs は左下原点、top-left に変換
        height: it.height,
        width: it.width,
      });
    }
  }
  return items;
}

/**
 * テキストアイテムを行ごとにグループ化（y 座標の近さで）
 */
function groupByRow(items, yTolerance = 3) {
  const rows = [];
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
  // x 順にソート
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

function extractNumbers(text) {
  const matches = text.match(/-?[\d,]+(?:\.\d+)?/g) || [];
  const results = [];
  for (const m of matches) {
    const s = m.replace(/,/g, "");
    if (s.includes(".")) continue; // 構成比・対売上比をスキップ
    const v = parseInt(s, 10);
    if (!isNaN(v)) results.push(v);
  }
  return results;
}

async function analyzePdf(pdfPath) {
  const filename = path.basename(pdfPath);
  console.log(`\n=== ${filename} ===`);

  const items = await extractTextItems(pdfPath);
  const fullText = items.map((i) => i.str).join("");
  const fullTextNoSpace = fullText.replace(/\s/g, "");

  // 会社名判定
  let companyId = null;
  for (const [name, cid] of Object.entries(COMPANY_MAP)) {
    if (fullTextNoSpace.includes(name)) {
      companyId = cid;
      break;
    }
  }
  console.log(`  会社: ${companyId ?? "??"}`);

  // 期間 (至 令和X年Y月)
  const periodMatch = fullText.match(/至\s*令和\s*(\d+)\s*年\s*(\d+)\s*月/);
  if (periodMatch) {
    const year = parseInt(periodMatch[1]) + 2018;
    const month = parseInt(periodMatch[2]);
    console.log(`  期間: ~${year}/${month}`);
  }

  // 前期比較判定
  const isComparative =
    fullTextNoSpace.includes("前期比較") || filename.includes("前期比較");
  console.log(`  前期比較: ${isComparative}`);

  // 行グループ化
  const rows = groupByRow(items);
  console.log(`  行数: ${rows.length}`);

  // 各キーワードを探す
  let uriage = null;
  let gaichuhi = null;
  let rieki = null;

  for (const row of rows) {
    const rowText = row.map((r) => r.str).join("");
    const rowClean = rowText.replace(/\s/g, "");
    const nums = extractNumbers(rowText);

    if (rowClean.includes("売上高合計") && nums.length > 0) {
      // 前期比較: 整数のみフィルタすると [前期, 当期, 前年同期, ...] の順
      //   → 当期は index 1
      // 通常残高試算表: [繰越, 借方, 貸方, 期間残高, 期末残高]
      //   → 期間残高 ≈ filtered[filtered.length - 2]
      const filtered = nums.filter((n) => n > 0);
      if (isComparative) {
        uriage = filtered[1] ?? filtered[0];
      } else {
        uriage = filtered[filtered.length - 2] ?? filtered[0];
      }
    }

    if (
      rowClean.includes("外注費") &&
      !rowClean.includes("営業外") &&
      nums.length > 0
    ) {
      const filtered = nums.filter((n) => n > 0);
      if (filtered.length > 0) {
        if (isComparative) {
          gaichuhi = filtered[1] ?? filtered[0];
        } else {
          gaichuhi = filtered[filtered.length - 2] ?? filtered[0];
        }
      }
    }

    if (rowClean.includes("当期純損益金額") && nums.length > 0) {
      // rieki はマイナスOK
      if (isComparative) {
        rieki = nums[1] ?? nums[0];
      } else {
        rieki = nums[nums.length - 2] ?? nums[0];
      }
    }
  }

  console.log(`  売上: ${uriage?.toLocaleString() ?? "なし"}`);
  console.log(`  外注: ${gaichuhi?.toLocaleString() ?? "なし"}`);
  console.log(`  利益: ${rieki?.toLocaleString() ?? "なし"}`);

  return { companyId, uriage, gaichuhi, rieki };
}

async function main() {
  const files = await fs.readdir(PDF_DIR);
  const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

  const expected = {
    hyuaran: { uriage: 190797587, gaichuhi: 124932774, rieki: 6444667 },
    linksupport: { uriage: 88354820, gaichuhi: 9865325, rieki: 27174964 },
    ichi: { uriage: null, gaichuhi: null, rieki: -112635 },
    taiyou: { uriage: 6844086, gaichuhi: 4850326, rieki: 1603024 },
  };

  const results = [];
  for (const f of pdfs) {
    const r = await analyzePdf(path.join(PDF_DIR, f));
    results.push(r);
  }

  console.log("\n=== Python 版との比較 ===");
  for (const r of results) {
    if (!r.companyId) continue;
    const exp = expected[r.companyId];
    if (!exp) continue;
    const okU = r.uriage === exp.uriage;
    const okG = r.gaichuhi === exp.gaichuhi;
    const okR = r.rieki === exp.rieki;
    console.log(
      `  ${r.companyId}: uriage=${okU ? "✓" : "✗"} gaichuhi=${okG ? "✓" : "✗"} rieki=${okR ? "✓" : "✗"}`
    );
    if (!okU) console.log(`    uriage: got=${r.uriage} expected=${exp.uriage}`);
    if (!okG)
      console.log(`    gaichuhi: got=${r.gaichuhi} expected=${exp.gaichuhi}`);
    if (!okR) console.log(`    rieki: got=${r.rieki} expected=${exp.rieki}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
