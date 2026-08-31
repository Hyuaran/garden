import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { AlignmentType, BorderStyle, Document, Header, HeadingLevel, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";
import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ContractCompany } from "./contract-types";
import { extractContractLayout, type SourceBlock } from "./contract-layout.server";

export const DRAFT_WATERMARK = { degrees: 45, opacity: 0.15, color: 0.65 } as const;
// PDF抽出で数値・通貨・単位の間に入る空白/改行も含める。通貨記号だけの金額も対象。
const MONEY = /(?:[¥￥]\s*[\d０-９][\d０-９,，.．]*(?:\s*(?:億|万|千|百))*(?:\s*円)?|[\d０-９][\d０-９,，.．]*(?:\s*(?:億|万|千|百))*\s*(?:円|％|%|割))(?:\s*[/／]\s*件)?/g;
const DATE = /(?:令和|平成|昭和)\s*[元\d０-９]+年\s*[\d０-９]+月(?:\s*(?:[\d０-９]+日|末日))?|[\d０-９]{4}\s*年\s*[\d０-９]{1,2}\s*月(?:\s*(?:[\d０-９]{1,2}\s*日|末日))?|(?:19|20)\d{2}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{1,2})?/g;
const ADDRESS = /(?:〒\s*)?[0-9０-９]{3}[-ー−]?[0-9０-９]{4}|(?:東京都|北海道|大阪府|京都府|[一-龥]{2,3}県)[^\n]{0,40}(?:市|区|町|村)[^\n]*/g;
const REPRESENTATIVE = /(?:代表取締役|代表社員|代表者|取締役)[ \t　:：]*[^\n、。]{2,60}/g;
const BLANK_COMPANY = "＿＿＿＿＿＿＿＿＿＿";
const clean = (value: string) => value.replace(/[\u0000-\u001f]/g, "").trim();
const startsParagraph = (line: string) =>
  /^(?:第[一二三四五六七八九十\d０-９]+条|[一二三四五六七八九十\d０-９]+[.．、]|[（(][一二三四五六七八九十\d０-９]+[）)]|[①-⑳※]|拝啓|敬具)/.test(line);

function mergePhysicalLines(lines: string[]) {
  const paragraphs: string[] = [];
  let current = "";
  for (const source of lines) {
    const line = clean(source);
    if (!line || /^\d{1,3}$/.test(line)) continue;
    if (isHeading(line)) {
      if (current) paragraphs.push(current);
      paragraphs.push(line);
      current = "";
      continue;
    }
    if (/^(?:記|敬具|以上)$/.test(line) || /御中$/.test(line)) {
      if (current) paragraphs.push(current);
      paragraphs.push(line);
      current = "";
      continue;
    }
    if (current && startsParagraph(line)) {
      paragraphs.push(current);
      current = line;
    } else {
      current += line;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

type MaskOptions = { excludedTerms: string[]; title?: string };
// 社名の全角英字は照合するが、日本語の括弧・段落番号・商材表記は変えない。
const normalized = (text: string) => text.replace(/[Ａ-Ｚａ-ｚ]/g, (char) => char.normalize("NFKC")).replace(/\r/g, "");
function masker(options: MaskOptions) {
  const terms = options.excludedTerms.map((term) => normalized(term).replace(/\s/g, "")).filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => [...term].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"));
  const forbidden = terms.length ? new RegExp(terms.join("|"), "g") : /$^/g;
  return (source: string) => normalized(source).replace(forbidden, BLANK_COMPANY)
    .replace(/(?:株式会社|有限会社|合同会社)[^\s、。「」（）()]{1,40}|[一-龥ァ-ヶーA-Za-z0-9・]{2,40}(?:株式会社|有限会社|合同会社)/g, BLANK_COMPANY)
    .replace(/[^\n、。:：]{0,25}(?:事業本部|事業部|営業部|営業グループ|営業課|管理部|管理課|担当部署|営業所)/g, "＿＿＿＿")
    .replace(/(?:担当(?:者)?|連絡先)\s*[:：]\s*[^\n、。]+/g, "＿＿＿＿")
    .replace(/(?:TEL|FAX|電話)\s*[:：]?\s*[+＋\d０-９()（）\s\-ー−‐–]{6,}/gi, "＿＿＿＿")
    .replace(/第\s*[\d０-９]+(?:\s*[-‐‑–ー−/]\s*[\d０-９]+)+\s*号|(?:管理番号|文書番号|通知番号)\s*[:：]?\s*[A-Za-z\d０-９\-_/]+/g, "＿＿＿＿")
    .replace(/\b[a-f\d]{32,64}\b/gi, "＿＿＿＿")
    .replace(/(?:住\s*所|所在地)\s*[:：]\s*[^\n]+/g, "住所：＿＿＿＿")
    .replace(ADDRESS, "").replace(REPRESENTATIVE, "＿＿＿＿")
    .replace(MONEY, "＿＿＿＿").replace(DATE, "＿＿年＿＿月＿＿日");
}

function sanitizeBlocks(source: SourceBlock[], options: MaskOptions) {
  const mask = masker(options);
  const rawTitle = normalized(options.title ?? "契約条件通知書");
  const title = clean(mask(rawTitle));
  // 表題中のPDF由来の空白を無視し、原本の宛先・発行者ブロックは自社書式に置き換える。
  const titleIndex = source.findIndex((block) => block.type === "text" &&
    normalized(block.text).replace(/\s/g, "") === rawTitle.replace(/\s/g, ""));
  const body = titleIndex >= 0 ? source.slice(titleIndex + 1) : source;
  const blocks: SourceBlock[] = [];
  let pending: string[] = [];
  const flush = () => {
    // 改行をまたぐ金額を伏せてから段落化する。識別情報も行境界がある段階で処理する。
    for (const text of mergePhysicalLines(mask(pending.join("\n")).split(/\n+/))) {
      if (text && !/^(?:御中|以上)$/.test(text) && !/御中$/.test(text)) blocks.push({ type: "text", text });
    }
    pending = [];
  };
  for (const block of body) {
    if (block.type === "text") pending.push(block.text);
    else {
      flush();
      blocks.push({ ...block, caption: block.caption ? clean(mask(block.caption)) : undefined,
        rows: block.rows.map((row) => row.map((cell) => clean(mask(cell)))) });
    }
  }
  flush();
  // 原文の抽出順が崩れていても、記は挨拶（敬具まで）の後に一度だけ配置する。
  const ki = blocks.findIndex((b) => b.type === "text" && b.text === "記");
  const greetingEnd = blocks.findIndex((b) => b.type === "text" && b.text === "敬具");
  if (ki >= 0 && greetingEnd > ki) {
    const [block] = blocks.splice(ki, 1);
    blocks.splice(greetingEnd, 0, block);
  }
  return { title, blocks, paragraphs: blocks.flatMap((b) => b.type === "text" && b.text !== "記" ? [b.text] : []), includeKi: ki >= 0 };
}
export function sanitizeContractText(text: string, options: MaskOptions) {
  return sanitizeBlocks(text.replace(/\r/g, "").split("\n").map((text) => ({ type: "text", text })), options);
}

const isHeading = (text: string) => text.length <= 45 && !/[。]/.test(text) &&
  /^(?:第?[一二三四五六七八九十\d０-９]+[.．、条項]|[（(][一二三四五六七八九十\d０-９]+[）)])/.test(text);
function bodyParagraph(text: string) {
  const heading = isHeading(text);
  return new Paragraph({ text, heading: heading ? HeadingLevel.HEADING_2 : undefined,
    indent: heading ? undefined : { firstLine: 220 }, spacing: { line: 360, after: 120 }, keepNext: heading });
}

async function addWordWatermark(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const headerPath = Object.keys(zip.files).find((name) => /^word\/header\d+\.xml$/.test(name));
  if (!headerPath) return buffer;
  const xml = await zip.file(headerPath)!.async("string");
  const watermark = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:pict><v:shape id="GardenDraftWatermark" type="#_x0000_t136" style="position:absolute;width:460pt;height:110pt;rotation:315;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" fillcolor="#d9d9d9" stroked="f"><v:textpath style="font-family:&quot;Yu Gothic&quot;;font-size:1pt" string="DRAFT"/></v:shape></w:pict></w:r></w:p>`;
  const updated = xml.replace("<w:hdr ", '<w:hdr xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ')
    .replace(/<w:p>[\s\S]*?<w:t[^>]*>DRAFT<\/w:t>[\s\S]*?<\/w:p>/, watermark);
  zip.file(headerPath, updated);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

type TemplateContent = ReturnType<typeof sanitizeBlocks>;
type TemplateTable = Extract<SourceBlock, { type: "table" }>;
function tableWidths(table: TemplateTable, total: number) {
  // 元の細すぎる列を広げつつ、説明列には相対的に広い幅を残す（自社の均一書式）。
  const weights = table.widths.map((w) => Math.max(w, 65));
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor(w / sum * total));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  return widths;
}
function wordTable(table: TemplateTable) {
  const widths = tableWidths(table, 9638);
  return new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: widths,
    layout: TableLayoutType.FIXED, indent: { size: 100, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    rows: table.rows.map((row, r) => new TableRow({ tableHeader: r === 0, cantSplit: true,
      children: row.map((text, c) => new TableCell({ width: { size: widths[c], type: WidthType.DXA },
        shading: r === 0 ? { fill: "F1F4F4" } : undefined,
        children: [new Paragraph({ spacing: { line: 260, after: 0 }, children: [new TextRun({ text, size: 18, bold: r === 0 })] })] })) })) });
}
function wordBlock(block: SourceBlock): (Paragraph | Table)[] {
  if (block.type === "table") return [
    ...(block.caption ? [new Paragraph({ text: block.caption, spacing: { before: 120, after: 100 }, keepNext: true })] : []),
    wordTable(block), new Paragraph({ spacing: { after: 100 } }),
  ];
  if (block.text === "記" || block.text === "敬具") return [new Paragraph({ text: block.text,
    alignment: block.text === "記" ? AlignmentType.CENTER : AlignmentType.RIGHT, spacing: { after: 180 } })];
  return [bodyParagraph(block.text)];
}
async function buildDocx(content: TemplateContent, issuer: ContractCompany) {
  const document = new Document({
    styles: { default: { document: { run: { font: "Yu Gothic", size: 22, color: "111111" }, paragraph: { spacing: { line: 360 } } },
      heading2: { run: { font: "Yu Gothic", size: 28, bold: true, color: "111111" }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 907, left: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "DRAFT", color: "D9D9D9", size: 96 })] })] }) },
      children: [
        new Paragraph({ children: [new TextRun("＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿　御中")], spacing: { after: 100 } }),
        ...[issuer.company_name, `代表取締役　${issuer.representative ?? ""}`, issuer.address ?? ""].map((line) =>
          new Paragraph({ text: line, alignment: AlignmentType.RIGHT, spacing: { line: 280, after: 0 } })),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 300 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "111111" } },
          children: [new TextRun({ text: content.title, bold: true, size: 40 })] }),
        ...content.blocks.flatMap(wordBlock),
        new Paragraph({ text: "以上", alignment: AlignmentType.RIGHT, spacing: { before: 280 } }),
      ],
    }],
  });
  return addWordWatermark(Buffer.from(await Packer.toBuffer(document)));
}

async function buildPdf(content: TemplateContent, issuer: ContractCompany) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit((fontkit as unknown as { default?: typeof fontkit }).default ?? fontkit);
  const font = await pdf.embedFont(new Uint8Array(await readFile(path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"))),
    // subset:trueは実レンダリングで日本語の欠字が発生したため使用しない。
    { subset: false });
  const watermarkFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28, height = 841.89, left = 56, right = 56, bottom = 48;
  let page = pdf.addPage([width, height]), y = height - 52;
  const watermark = () => page.drawText("DRAFT", { x: width * 0.18, y: height * 0.35,
    size: Math.min(width, height) * 0.18, font: watermarkFont,
    color: rgb(DRAFT_WATERMARK.color, DRAFT_WATERMARK.color, DRAFT_WATERMARK.color),
    rotate: degrees(DRAFT_WATERMARK.degrees), opacity: DRAFT_WATERMARK.opacity });
  const nextPage = () => { watermark(); page = pdf.addPage([width, height]); y = height - 52; };
  const drawLines = (lines: string[], size: number, lineHeight: number, x = left) => {
    for (const line of lines) { if (y < bottom + lineHeight) nextPage();
      page.drawText(line, { x, y, size, font, color: rgb(0.07, 0.07, 0.07) }); y -= lineHeight; }
  };
  const wrap = (text: string, available: number, size: number) => {
    const lines: string[] = [];
    for (const source of text.split("\n")) {
      let line = "";
      for (const char of source) {
        // 句読点・閉じ括弧を行頭に孤立させない（右余白内の1文字ぶんのぶら下げ）。
        if (line && font.widthOfTextAtSize(line + char, size) > available && !/^[、。，．）」』】〕]/.test(char)) { lines.push(line); line = ""; }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  };
  const drawTable = (table: TemplateTable) => {
    const widths = tableWidths(table, width - left - right), size = 9, leading = 13, padding = 6;
    const rows = table.rows.map((row) => row.map((text, c) => wrap(text, widths[c] - padding * 2, size)));
    const captionLines = table.caption ? wrap(table.caption, width - left - right, 10) : [];
    const fullHeight = rows.reduce((height, row) => height + Math.max(...row.map((cell) => cell.length)) * leading + padding * 2, 0)
      + captionLines.length * 16 + 4;
    // 短い表は表題ごと次ページへ。長い表だけ見出しを反復してページ分割する。
    if (fullHeight < 350 && y - fullHeight < bottom) nextPage();
    if (captionLines.length) { drawLines(captionLines, 10, 16); y -= 4; }
    const drawRow = (row: string[][], header: boolean) => {
      const rowHeight = Math.max(...row.map((cell) => cell.length)) * leading + padding * 2;
      let x = left;
      row.forEach((cell, c) => {
        page.drawRectangle({ x, y: y - rowHeight, width: widths[c], height: rowHeight,
          borderColor: rgb(0.3, 0.35, 0.35), borderWidth: 0.5, ...(header ? { color: rgb(0.94, 0.96, 0.96) } : {}) });
        cell.forEach((line, l) => page.drawText(line, { x: x + padding, y: y - padding - size - l * leading, size, font }));
        x += widths[c];
      });
      y -= rowHeight;
    };
    const headerHeight = Math.max(...rows[0].map((cell) => cell.length)) * leading + padding * 2;
    rows.forEach((row, r) => {
      let offset = 0;
      const length = Math.max(...row.map((cell) => cell.length));
      while (offset < length) {
        const needed = (length - offset) * leading + padding * 2;
        if (y - Math.min(needed, 200) < bottom || (r === 0 && y - needed - 40 < bottom)) {
          nextPage();
          if (r > 0 && headerHeight < 300) drawRow(rows[0], true);
        }
        // 巨大セルでもはみ出さずページ分割する。通常の行は途中で分断しない。
        const count = Math.max(1, Math.floor((y - bottom - padding * 2) / leading));
        drawRow(row.map((cell) => cell.slice(offset, offset + count)), r === 0);
        offset += count;
      }
    });
    y -= 14;
  };
  drawLines(["＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿　御中"], 11, 16);
  y += 10;
  for (const line of [issuer.company_name, `代表取締役　${issuer.representative ?? ""}`, issuer.address ?? ""])
    drawLines([line], 10, 15, width - right - font.widthOfTextAtSize(line, 10));
  y -= 26;
  for (const line of wrap(content.title, width - left - right, 20)) {
    page.drawText(line, { x: (width - font.widthOfTextAtSize(line, 20)) / 2, y, size: 20, font }); y -= 26;
  }
  y += 26;
  y -= 10; page.drawLine({ start: { x: left, y }, end: { x: width - right, y }, thickness: 0.7, color: rgb(0.1, 0.1, 0.1) }); y -= 34;
  for (const block of content.blocks) {
    if (block.type === "table") { drawTable(block); continue; }
    const paragraph = block.text;
    if (paragraph === "記" || paragraph === "敬具") {
      drawLines([paragraph], 11, 22, paragraph === "記" ? (width - font.widthOfTextAtSize(paragraph, 11)) / 2
        : width - right - font.widthOfTextAtSize(paragraph, 11));
      continue;
    }
    const heading = isHeading(paragraph); y -= heading ? 7 : 2;
    const x = heading ? left : left + 12, size = heading ? 14 : 11;
    const lines = wrap(paragraph, width - right - x, size);
    if (heading && y - lines.length * 22 - 36 < bottom) nextPage();
    drawLines(lines, size, heading ? 22 : 18, x);
  }
  y -= 14; drawLines(["以上"], 11, 16, width - right - font.widthOfTextAtSize("以上", 11)); watermark();
  return Buffer.from(await pdf.save());
}

export async function generatePartnerTemplate(sourcePages: string[], options: {
  issuer: ContractCompany; title: string; excludedTerms: string[]; sourcePdf?: Uint8Array;
}) {
  let source: SourceBlock[] = sourcePages.flatMap((page) => page.split("\n").map((text) => ({ type: "text" as const, text })));
  if (options.sourcePdf) {
    try {
      const pages = await extractContractLayout(options.sourcePdf);
      // 読めないページ（画像PDF等）は登録時テキストに戻す。白紙に置き換えない。
      source = pages.flatMap((blocks, n) => blocks.length ? blocks
        : (sourcePages[n] ?? "").split("\n").map((text) => ({ type: "text" as const, text })));
    } catch { /* 取得/解析失敗は登録時テキストで生成を続ける。 */ }
  }
  const content = sanitizeBlocks(source, options);
  return { docx: await buildDocx(content, options.issuer), pdf: await buildPdf(content, options.issuer), content };
}
