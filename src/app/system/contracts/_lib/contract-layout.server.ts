import path from "node:path";

export type PositionedText = { text: string; x: number; y: number; width: number; height: number };
export type Rule = { x1: number; y1: number; x2: number; y2: number };
export type SourceBlock = { type: "text"; text: string } | {
  type: "table"; rows: string[][]; widths: number[]; caption?: string;
};
type Line = { y: number; items: PositionedText[] };
const near = (a: number, b: number, tolerance = 2) => Math.abs(a - b) <= tolerance;
const unique = (values: number[]) => values.sort((a, b) => a - b).filter((v, i, all) => !i || !near(v, all[i - 1]));

export function textLines(items: PositionedText[]): Line[] {
  const lines: Line[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const previous = lines.at(-1);
    if (previous && near(previous.y, item.y, Math.min(3, item.height * 0.3))) previous.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.map((line) => ({ ...line, items: line.items.sort((a, b) => a.x - b.x) }));
}
function lineText(items: PositionedText[]) {
  return items.map((item, i) => {
    const previous = items[i - 1];
    return (previous && item.x - previous.x - previous.width > item.height * 0.35 ? " " : "") + item.text;
  }).join("").trim();
}
const joinedText = (items: PositionedText[]) => textLines(items).map((line) => lineText(line.items)).join("\n");

// 罫線はセル境界の補助情報だけに使用する。元PDFの画像・書式は出力に持ち込まない。
function ruledTables(items: PositionedText[], rules: Rule[]) {
  const groups: Rule[][] = [];
  for (const rule of rules) {
    const touching = groups.filter((group) => group.some((r) =>
      rule.x1 <= r.x2 + 2 && rule.x2 >= r.x1 - 2 && rule.y1 <= r.y2 + 2 && rule.y2 >= r.y1 - 2));
    const merged = [rule, ...touching.flat()];
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups.flatMap((group) => {
    const vertical = group.filter((r) => near(r.x1, r.x2));
    const horizontal = group.filter((r) => near(r.y1, r.y2));
    const xs = unique(vertical.map((r) => r.x1));
    if (xs.length < 3 || xs.length > 13) return [];
    const left = xs[0], right = xs.at(-1)!;
    // 同じ高さの横線の断片をつなぎ、表全幅を横断する線だけを論理行の境界にする。
    const ys = unique(horizontal.map((r) => r.y1)).filter((y) => {
      let covered = left;
      for (const r of horizontal.filter((r) => near(r.y1, y)).sort((a, b) => a.x1 - b.x1)) {
        if (r.x1 > covered + 2) return false;
        covered = Math.max(covered, r.x2);
      }
      return covered >= right - 2;
    }).reverse();
    if (ys.length < 3) return [];
    const inside = items.filter((i) => i.x >= left - 2 && i.x + i.width <= right + 2 && i.y > ys.at(-1)! && i.y < ys[0]);
    if (textLines(inside).length < 3) return [];
    const captions: string[] = [];
    const assigned = new Set<PositionedText>();
    const rows = ys.slice(0, -1).map((top, index) => {
      const rowItems = inside.filter((i) => i.y < top && i.y > ys[index + 1]);
      const cells = xs.slice(0, -1).map(() => [] as PositionedText[]);
      for (const line of textLines(rowItems)) {
        // 当該Yに実在する縦線で、結合された見出しセルの範囲を決める。
        const edges = unique(vertical.filter((r) => r.y1 < line.y && r.y2 > line.y).map((r) => r.x1));
        for (let col = 0; col < edges.length - 1; col++) {
          const cellItems = line.items.filter((i) => i.x + i.width / 2 >= edges[col] && i.x + i.width / 2 < edges[col + 1]);
          const leaves = xs.slice(0, -1).map((x, c) => ({ x, c })).filter(({ x }) => x >= edges[col] - 2 && x < edges[col + 1] - 2);
          if (leaves.length) cellItems.forEach((item) => assigned.add(item));
          // 多列共通の見出しは自社書式の表題へ、2列共通の見出しは各列に引き継ぐ。
          if (index === 0 && leaves.length > 2 && cellItems.length) captions.push(lineText(cellItems));
          else for (const { c } of leaves) cells[c].push(...cellItems);
        }
      }
      return cells.map(joinedText);
    });
    // 不規則な結合セルなどで割当先が無い文字があれば、消さずに段落へ戻す。
    if (assigned.size !== inside.length || rows[0].filter(Boolean).length < 2 || rows.some((row) => !row.some(Boolean))) return [];
    const block: SourceBlock = { type: "table", rows, widths: xs.slice(1).map((x, i) => x - xs[i]), caption: captions.join("\n") || undefined };
    return [{ top: ys[0], inside: new Set(inside), block }];
  });
}

function chunks(line: Line) {
  const groups: PositionedText[][] = [];
  for (const item of line.items) {
    const previous = groups.at(-1)?.at(-1);
    if (previous && item.x - previous.x - previous.width < Math.max(14, item.height * 1.5)) groups.at(-1)!.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => ({ x: group[0].x, end: group.at(-1)!.x + group.at(-1)!.width, text: lineText(group) }));
}

/** 罫線なし: 3行以上で2列以上のX始点が反復し、セル間に空きがある場合だけ表にする。 */
function unruledBlocks(lines: Line[]): SourceBlock[] {
  const result: SourceBlock[] = [];
  for (let n = 0; n < lines.length;) {
    const first = chunks(lines[n]);
    let end = n + 1;
    if (first.length >= 2 && first.length <= 12) {
      while (end < lines.length && lines[end - 1].y - lines[end].y <= 28) {
        const next = chunks(lines[end]);
        if (next.length !== first.length || next.some((c, i) => !near(c.x, first[i].x, 6))) break;
        end++;
      }
    }
    if (end - n >= 3) {
      const rows = lines.slice(n, end).map(chunks);
      const right = Math.max(...rows.map((row) => row.at(-1)!.end));
      const widths = first.map((c, i) => (first[i + 1]?.x ?? right + 6) - c.x);
      // 長い段落の段組や番号付きリストは表と誤認しない。
      if (widths.every((w) => w >= 30) && rows.every((row) => row.every((c, i) => !row[i + 1] || c.end < row[i + 1].x - 10))) {
        result.push({ type: "table", rows: rows.map((row) => row.map((c) => c.text)), widths });
        n = end;
        continue;
      }
    }
    result.push({ type: "text", text: lineText(lines[n].items) });
    n++;
  }
  return result;
}

export function reconstructPage(items: PositionedText[], rules: Rule[] = []): SourceBlock[] {
  const tables = ruledTables(items, rules).sort((a, b) => b.top - a.top);
  const remaining = textLines(items.filter((item) => !tables.some((t) => t.inside.has(item))));
  const result: SourceBlock[] = [];
  for (const table of tables) {
    const above = remaining.filter((line) => line.y > table.top);
    remaining.splice(0, above.length);
    result.push(...unruledBlocks(above), table.block);
  }
  return [...result, ...unruledBlocks(remaining)];
}

export async function extractContractLayout(buffer: Uint8Array): Promise<SourceBlock[][]> {
  // 動的importにして、登録・一覧にはPDF解析処理をロードしない。
  const { getDocument, OPS, Util } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false,
    cMapUrl: path.join(process.cwd(), "node_modules/pdfjs-dist/cmaps").replace(/\\/g, "/") + "/", cMapPacked: true,
    standardFontDataUrl: path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts").replace(/\\/g, "/") + "/" });
  try {
    const pdf = await task.promise;
    const pages: SourceBlock[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      // 縦書きはXY行推定の対象外。ページ単位で保存済みテキストへ戻す。
      if (content.items.some((item) => "dir" in item && item.dir === "ttb")) { pages.push([]); page.cleanup(); continue; }
      const items = content.items.flatMap((item) => "str" in item && item.str.trim()
        ? [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }] : []);
      const rules: Rule[] = [];
      // pdfjs 5の描画境界箱。細い塗り矩形または単線だけ採用し、画像・曲線・塗り面は無視する。
      try {
        const operators = await page.getOperatorList();
        let matrix = [1, 0, 0, 1, 0, 0];
        const stack: number[][] = [];
        for (let i = 0; i < operators.fnArray.length; i++) {
          const fn = operators.fnArray[i], args = operators.argsArray[i];
          if (fn === OPS.save) stack.push([...matrix]);
          else if (fn === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
          else if (fn === OPS.transform) matrix = Util.transform(matrix, args);
          else if (fn === OPS.constructPath && [OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke].includes(args[0]) && args[2]?.length === 4) {
            const box = Array.from(args[2]) as number[];
            if (Math.min(box[2] - box[0], box[3] - box[1]) > 1.5) continue;
            const a = [box[0], box[1]], b = [box[2], box[3]];
            Util.applyTransform(a, matrix); Util.applyTransform(b, matrix);
            const [x1, x2] = [a[0], b[0]].sort((a, b) => a - b), [y1, y2] = [a[1], b[1]].sort((a, b) => a - b);
            if (x2 - x1 > 8 && y2 - y1 < 2) rules.push({ x1, x2, y1: (y1 + y2) / 2, y2: (y1 + y2) / 2 });
            if (y2 - y1 > 8 && x2 - x1 < 2) rules.push({ x1: (x1 + x2) / 2, x2: (x1 + x2) / 2, y1, y2 });
          }
        }
      } catch { /* 罫線が読めなくても文字座標で判定を続ける。 */ }
      pages.push(reconstructPage(items, rules));
      page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}
