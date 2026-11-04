// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  hakenPdfText,
  generateHakenPdf,
  type IssueInput,
  type IssueType,
} from "./haken-pdf.server";
import { validateHakenPdf, saveHakenPdf } from "./haken-drive.server";
import reference from "./reference-text.json";
import defaults from "./reference-defaults.json";
import type { HakenOffice, HakenParty } from "./types";
const input: IssueInput = {
  party: {
    name: "株式会社エモーション",
    office_name: "大阪支店",
    issue_defaults: defaults,
  } as unknown as HakenParty,
  office: {
    name: "大阪本社",
    address:
      "〒541-0054\n大阪府大阪市中央区南本町2-6-12\nサンマリオンタワー地上2階西号室",
    training_note:
      "あり\n　業務の手順等に関する研修（OJT）\n　業界知識、専門用語等の説明（OJT）\n　社内システムの操作方法（OJT）",
    cafeteria_note: "なし",
    rest_room_note:
      "あり\n　サンマリオンタワー1階の共用フリースペースをご利用いただけます",
    changing_room_note: "なし",
  } as HakenOffice,
  companyName: "株式会社ヒュアラン",
  issuedOn: "2026-09-07",
  start: "2026-09-11",
  end: "2026-12-31",
  conflict: "2029-09-11",
};
const normalize = (text: string) => text.replace(/\s/g, "");
describe("書類の文面", () => {
  for (const type of ["conflict_notice", "treatment", "reply"] as IssueType[]) {
    it(`${type} は生成したPDFの文字と順番も手本と同じ`, async () => {
      expect(normalize(hakenPdfText(type, input))).toBe(
        normalize(reference[type]),
      );
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const bytes = await generateHakenPdf(type, input);
      const pdf = await getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: false,
      }).promise;
      try {
        const pages: string[] = [];
        for (let index = 1; index <= pdf.numPages; index++) {
          const content = await (await pdf.getPage(index)).getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(""),
          );
        }
        expect(normalize(pages.join(""))).toBe(normalize(reference[type]));
      } finally {
        await pdf.destroy();
      }
    });
  }
  it("ご確認事項が空なら見出しも出さない", () => {
    expect(
      hakenPdfText("reply", {
        ...input,
        party: {
          ...input.party,
          issue_defaults: { ...defaults, questions: "" },
        },
      }),
    ).not.toContain("5．貴社へのご確認事項");
  });
  it("日本語フォントを埋め込んだPDFを作る", async () => {
    const buffer = await generateHakenPdf("reply", input);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(10000);
  });
});
describe("書類の保存", () => {
  it("PDF以外と20MB超を断る", () => {
    expect(() =>
      validateHakenPdf(Buffer.from("hello"), "a.pdf", "application/pdf"),
    ).toThrow("PDF");
    expect(() =>
      validateHakenPdf(Buffer.from("%PDF-hello"), "a.txt", "text/plain"),
    ).toThrow("PDF");
    const oversized = Buffer.alloc(20 * 1024 * 1024 + 1);
    oversized.write("%PDF-");
    expect(() =>
      validateHakenPdf(oversized, "a.pdf", "application/pdf"),
    ).toThrow("20MB");
  });
  it("保存先が無い場合は外部にアクセスせず失敗する", async () => {
    const previous = process.env.GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID;
    delete process.env.GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID;
    try {
      await expect(
        saveHakenPdf(Buffer.from("%PDF-test"), "a.pdf", "A社"),
      ).rejects.toThrow("保存できませんでした");
    } finally {
      if (previous === undefined)
        delete process.env.GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID;
      else process.env.GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID = previous;
    }
  });
});
