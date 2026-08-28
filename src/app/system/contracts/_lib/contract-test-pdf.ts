import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts } from "pdf-lib";
export async function japanesePdf(lines: string[], pages = 1) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(
    (fontkit as unknown as { default?: typeof fontkit }).default ?? fontkit,
  );
  const font = await pdf.embedFont(
    new Uint8Array(
      readFileSync(
        path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"),
      ),
    ),
    { subset: false },
  );
  for (let p = 0; p < pages; p++) {
    const page = pdf.addPage([595, 842]);
    (lines[p] ?? lines[0] ?? "")
      .split("\n")
      .forEach((line, i) =>
        page.drawText(line, { x: 45, y: 780 - i * 24, size: 12, font }),
      );
  }
  return Buffer.from(await pdf.save());
}
export async function latinPdf(lines: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const line of lines) {
    const page = pdf.addPage([595, 842]);
    page.drawText(line, { x: 45, y: 780, size: 12, font });
  }
  return Buffer.from(await pdf.save());
}
