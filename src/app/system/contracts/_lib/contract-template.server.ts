import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { AlignmentType, BorderStyle, Document, Header, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ContractCompany } from "./contract-types";

export const DRAFT_WATERMARK = { degrees: 45, opacity: 0.15, color: 0.65 } as const;
const MONEY = /(?:[¥￥]\s*)?[\d０-９,，.．]+(?:億|万|千|百)?(?:円|万円|億円|％|%)(?:\s*\/\s*件)?/g;
const DATE = /(?:令和|平成|昭和)\s*[元\d０-９]+年\s*[\d０-９]+月(?:\s*[\d０-９]+日)?|(?:19|20)\d{2}\s*[年/.\-]\s*\d{1,2}(?:\s*[月/.\-]\s*\d{1,2}\s*日?)?/g;
const ADDRESS = /(?:〒\s*)?[0-9０-９]{3}[-ー−]?[0-9０-９]{4}|.{0,12}(?:都|道|府|県).{0,40}(?:市|区|町|村).*/g;
const REPRESENTATIVE = /(?:代表取締役|代表者|取締役)\s*[^\s、。]{2,20}/g;
const BLANK_COMPANY = "＿＿＿＿＿＿＿＿＿＿";
const clean = (value: string) => value.replace(/[\u0000-\u001f]/g, "").trim();

function mergePhysicalLines(lines: string[]) {
  const paragraphs: string[] = [];
  let current = "";
  const startsParagraph = (line: string) =>
    /^(?:第[一二三四五六七八九十\d０-９]+条|[一二三四五六七八九十\d０-９]+[.．、]|[（(][一二三四五六七八九十\d０-９]+[）)])/.test(line);
  for (const source of lines) {
    const line = clean(source);
    if (!line || /^\d{1,3}$/.test(line)) continue;
    if (line === "記") {
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

export function sanitizeContractText(text: string, options: { excludedTerms: string[]; title?: string }) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const title = clean(options.title ?? "") || "契約条件通知書";
  const titleAt = normalized.indexOf(title);
  const body = titleAt >= 0 ? normalized.slice(titleAt + title.length) : normalized;
  const terms = options.excludedTerms.map(clean).filter(Boolean).sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const forbidden = terms.length ? new RegExp(terms.join("|"), "g") : /$^/g;
  const merged = mergePhysicalLines(body.split(/\n+/));
  const includeKi = merged.includes("記");
  const paragraphs = merged.map((line) => clean(line.replace(forbidden, BLANK_COMPANY).replace(ADDRESS, "")
    .replace(REPRESENTATIVE, "").replace(MONEY, "＿＿＿＿").replace(DATE, "＿＿年＿＿月＿＿日")))
    .filter((line) => line && !/^(?:御中|以上|記)$/.test(line));
  return { title, paragraphs, includeKi };
}

async function extractSourceText(source: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(source) }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const content = await (await pdf.getPage(index)).getTextContent();
    const lines: string[] = [];
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if ("hasEOL" in item && item.hasEOL) {
        if (!/^\s*\d{1,3}\s*$/.test(line)) lines.push(line);
        line = "";
      }
    }
    if (line && !/^\s*\d{1,3}\s*$/.test(line)) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

const isHeading = (text: string) => /^(?:第?[一二三四五六七八九十\d０-９]+[.．、条項]|[（(][一二三四五六七八九十\d０-９]+[）)])/.test(text);
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

type TemplateContent = { title: string; paragraphs: string[]; includeKi: boolean };
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
        ...(content.includeKi ? [new Paragraph({ text: "記", alignment: AlignmentType.CENTER, spacing: { after: 180 } })] : []),
        ...content.paragraphs.map(bodyParagraph),
        new Paragraph({ text: "以上", alignment: AlignmentType.RIGHT, spacing: { before: 280 } }),
      ],
    }],
  });
  return addWordWatermark(Buffer.from(await Packer.toBuffer(document)));
}

function wrap(text: string, max = 42) {
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += max) lines.push(text.slice(index, index + max));
  return lines.length ? lines : [""];
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
  drawLines(["＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿　御中"], 11, 16);
  y += 10;
  for (const line of [issuer.company_name, `代表取締役　${issuer.representative ?? ""}`, issuer.address ?? ""])
    drawLines([line], 10, 15, width - right - font.widthOfTextAtSize(line, 10));
  y -= 26;
  page.drawText(content.title, { x: Math.max(left, (width - font.widthOfTextAtSize(content.title, 20)) / 2), y, size: 20, font });
  y -= 10; page.drawLine({ start: { x: left, y }, end: { x: width - right, y }, thickness: 0.7, color: rgb(0.1, 0.1, 0.1) }); y -= 34;
  if (content.includeKi) drawLines(["記"], 11, 22, (width - font.widthOfTextAtSize("記", 11)) / 2);
  for (const paragraph of content.paragraphs) { const heading = isHeading(paragraph); y -= heading ? 7 : 2;
    drawLines(wrap(paragraph, heading ? 38 : 42), heading ? 14 : 11, heading ? 22 : 18, heading ? left : left + 12); }
  y -= 14; drawLines(["以上"], 11, 16, width - right - font.widthOfTextAtSize("以上", 11)); watermark();
  return Buffer.from(await pdf.save());
}

export async function generatePartnerTemplate(source: Buffer, options: { issuer: ContractCompany; title: string; excludedTerms: string[] }) {
  const content = sanitizeContractText(await extractSourceText(source), options);
  return { docx: await buildDocx(content, options.issuer), pdf: await buildPdf(content, options.issuer), content };
}
