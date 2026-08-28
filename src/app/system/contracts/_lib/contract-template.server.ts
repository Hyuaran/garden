import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ContractCompany } from "./contract-types";
export const DRAFT_WATERMARK = {
  degrees: 45,
  opacity: 0.15,
  color: 0.65,
} as const;
export const ISSUER_POSITION = { top: 40, right: 42, lineHeight: 15 } as const;
export const MONEY_PATTERN = /(?:¥|￥)\s*[\d,]+|[\d,]+\s*円/g;
export function findMoneyExpressions(text: string) {
  return text.match(MONEY_PATTERN) ?? [];
}
type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};
type Mask = { item: number; start: number; length: number };
type CharacterOrigin = { item: number; offset: number };
function withoutWhitespace(value: string) {
  return [...value].filter((character) => !/\s/.test(character)).join("");
}
export function findMaskTargets(
  items: TextItem[],
  phrases: string[],
  maskMoney: boolean,
) {
  const wanted = phrases.map((x) => x.trim()).filter(Boolean);
  if (maskMoney) wanted.push(...findMoneyExpressions(items.map((item) => item.str).join("")));
  const masks = new Map<string, Mask>();
  const add = (mask: Mask) =>
    masks.set(`${mask.item}:${mask.start}:${mask.length}`, mask);
  for (let i = 0; i < items.length; i++) {
    if (maskMoney)
      for (const match of items[i].str.matchAll(
        new RegExp(MONEY_PATTERN.source, "g"),
      ))
        add({ item: i, start: match.index ?? 0, length: match[0].length });
    for (const phrase of wanted) {
      let within = items[i].str.indexOf(phrase);
      if (within >= 0) {
        while (within >= 0) {
          add({ item: i, start: within, length: phrase.length });
          within = items[i].str.indexOf(phrase, within + phrase.length);
        }
        continue;
      }
      let joined = "";
      const origins: CharacterOrigin[] = [];
      for (
        let j = i;
        j < Math.min(items.length, i + 8) &&
        joined.length <= phrase.length + 20;
        j++
      ) {
        for (const [offset, character] of [...items[j].str].entries()) {
          if (/\s/.test(character)) continue;
          joined += character;
          origins.push({ item: j, offset });
        }
        const needle = withoutWhitespace(phrase);
        let matchAt = joined.indexOf(needle);
        while (needle && matchAt >= 0) {
          const matchedOrigins = origins.slice(matchAt, matchAt + needle.length);
          if (matchedOrigins.length === needle.length) {
            const ranges = new Map<number, { start: number; end: number }>();
            for (const origin of matchedOrigins) {
              const range = ranges.get(origin.item);
              if (range) range.end = origin.offset + 1;
              else
                ranges.set(origin.item, {
                  start: origin.offset,
                  end: origin.offset + 1,
                });
            }
            for (const [item, range] of ranges)
              add({ item, start: range.start, length: range.end - range.start });
          }
          matchAt = joined.indexOf(needle, matchAt + needle.length);
        }
      }
    }
  }
  return [...masks.values()];
}
export async function generatePartnerTemplate(
  source: Buffer,
  options: {
    hiddenTerms: string[];
    maskMoney: boolean;
    issuer: ContractCompany;
  },
) {
  const sourceDoc = await getDocument({ data: new Uint8Array(source) }).promise;
  const pdf = await PDFDocument.load(new Uint8Array(source));
  pdf.registerFontkit(
    (fontkit as unknown as { default?: typeof fontkit }).default ?? fontkit,
  );
  const font = await pdf.embedFont(
    new Uint8Array(
      await readFile(
        path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"),
      ),
    ),
    // pdf-lib/fontkit の subset:true は、実際の生成PDFをPopplerで描画した際に
    // 日本語の欠字・文字化けが発生したため、配布文書の表示保証を優先する。
    { subset: false },
  );
  const watermarkFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let maskedCount = 0,
    totalItems = 0;
  for (let n = 1; n <= sourceDoc.numPages; n++) {
    const page = pdf.getPage(n - 1),
      content = await (await sourceDoc.getPage(n)).getTextContent();
    const items = content.items.filter(
      (i): i is typeof i & TextItem =>
        "str" in i && "transform" in i && "width" in i && "height" in i,
    );
    totalItems += items.length;
    const masks = findMaskTargets(items, options.hiddenTerms, options.maskMoney);
    for (const mask of masks) {
      const item = items[mask.item],
        unit = item.str.length ? item.width / item.str.length : item.width,
        x = item.transform[4] + unit * mask.start,
        y = item.transform[5],
        h = Math.max(item.height, Math.abs(item.transform[3]), 8);
      page.drawRectangle({
        x: x - 1,
        y: y - 2,
        width: Math.max(unit * mask.length + 2, 4),
        height: h + 4,
        color: rgb(1, 1, 1),
      });
      maskedCount++;
    }
    const { width, height } = page.getSize();
    const size = Math.min(width, height) * 0.18;
    page.drawText("DRAFT", {
      x: width * 0.18,
      y: height * 0.35,
      size,
      font: watermarkFont,
      color: rgb(
        DRAFT_WATERMARK.color,
        DRAFT_WATERMARK.color,
        DRAFT_WATERMARK.color,
      ),
      rotate: degrees(DRAFT_WATERMARK.degrees),
      opacity: DRAFT_WATERMARK.opacity,
    });
    if (n === 1) {
      page.drawRectangle({
        x: width - ISSUER_POSITION.right - 238,
        y: height - ISSUER_POSITION.top - ISSUER_POSITION.lineHeight * 2 - 5,
        width: 238,
        height: ISSUER_POSITION.lineHeight * 3 + 8,
        color: rgb(1, 1, 1),
      });
      const lines = [
        options.issuer.company_name,
        `代表取締役　${options.issuer.representative ?? ""}`,
        options.issuer.address ?? "",
      ];
      lines.forEach((line, index) =>
        page.drawText(line, {
          x: width - ISSUER_POSITION.right - 230,
          y: height - ISSUER_POSITION.top - index * ISSUER_POSITION.lineHeight,
          size: 9,
          font,
          color: rgb(0.08, 0.08, 0.08),
        }),
      );
    }
  }
  return {
    buffer: Buffer.from(await pdf.save()),
    maskedCount,
    scanned: totalItems === 0,
  };
}
