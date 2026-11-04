import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import reference from "./reference-text.json";
import type { HakenOffice, HakenParty } from "./types";

export type IssueType = "conflict_notice" | "treatment" | "reply";
export type IssueInput = {
  party: HakenParty;
  office: HakenOffice;
  companyName: string;
  issuedOn: string;
  start: string;
  end: string;
  conflict: string;
};
export function japaneseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
export function hakenPdfText(type: IssueType, input: IssueInput): string {
  const { party, office } = input;
  let text = reference[type];
  const replace = (from: string, to: string) => {
    text = text.split(from).join(to);
  };
  replace("2026年9月7日", japaneseDate(input.issuedOn));
  replace(
    "株式会社エモーション 大阪支店",
    [party.name, party.office_name].filter(Boolean).join(" "),
  );
  replace("株式会社ヒュアラン", input.companyName);
  replace("大阪本社", office.name);
  replace(
    "〒541-0054\n大阪府大阪市中央区南本町2-6-12\nサンマリオンタワー地上2階西号室",
    office.address,
  );
  replace(
    "〒541-0054\n　　　　大阪府大阪市中央区南本町2-6-12\n　　　　サンマリオンタワー地上2階西号室",
    office.address,
  );
  replace("2029年9月11日", japaneseDate(input.conflict));
  replace("2026年9月11日", japaneseDate(input.start));
  replace("2026年12月31日", japaneseDate(input.end));
  if (type === "treatment") {
    const start = text.indexOf("教育訓練：");
    const end = text.indexOf("○付帯情報");
    text =
      text.slice(0, start) +
      [
        `教育訓練：${office.training_note}`,
        `給食施設：${office.cafeteria_note}`,
        `休憩室　：${office.rest_room_note}`,
        `更衣室　：${office.changing_room_note}`,
        "",
      ].join("\n") +
      text.slice(end);
  }
  if (type === "reply") {
    const defaults = party.issue_defaults;
    const replacements: [string, string][] = [
      ["ブロードバンド事業部　営業課", defaults.org_unit ?? ""],
      ["架電業務およびその他付随する業務", defaults.work_content ?? ""],
    ];
    // 長い値から置換し、組織名の置換が責任者名に重ならないようにする。
    const rows: [string, string, string][] = [
      ["就業日", "就業時間", "work_days"],
      ["就業時間", "指揮命令者", "work_hours"],
      ["指揮命令者", "派遣先責任者", "commander_name"],
      ["派遣先責任者", "苦情の申出を受ける者", "supervisor_name"],
      ["苦情の申出を受ける者", "2．安全", "complaint_owner_name"],
      ["締め日", "派遣料金の支払日", "closing_day"],
      ["派遣料金の支払日", "勤怠の時間単位", "payment_day"],
      ["タイムカードの送付", "残業割増", "timecard_delivery"],
      ["残業割増", "請求書の送付先", "overtime"],
      ["請求書の送付先", "請求書の提出期日", "invoice_destination"],
      ["請求書の提出期日", "5．貴社へのご確認事項", "invoice_due"],
    ];
    for (const [label, next, key] of rows) {
      const start = text.indexOf(label);
      const end = text.indexOf(next, start + label.length);
      const colon = text.indexOf("：", start);
      if (start >= 0 && end > start)
        text =
          text.slice(0, colon + 1) +
          (defaults[key] ?? "") +
          (key === "work_hours" && defaults.break_note
            ? "\n" + defaults.break_note
            : "") +
          "\n" +
          text.slice(end);
    }
    for (const [from, to] of replacements) replace(from, to);
    const questions = text.indexOf("5．貴社へのご確認事項");
    text =
      text.slice(0, questions) +
      (defaults.questions?.trim()
        ? `5．貴社へのご確認事項\n${defaults.questions.trim()}\n`
        : "") +
      "以上";
  }
  return text;
}

export async function generateHakenPdf(type: IssueType, input: IssueInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // 同梱フォントのみを使う。ホストPCのフォントにはアクセスしない。
  const fontPath =
    process.env.GARDEN_HAKEN_PDF_FONT_PATH ||
    path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf");
  const font = await pdf.embedFont(await readFile(fontPath), { subset: false });
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const size = type === "reply" ? 9 : 11;
  const leading = type === "reply" ? 13 : 18;
  for (const source of hakenPdfText(type, input).split("\n")) {
    let line = "";
    const draw = () => {
      if (y < 48) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(line, { x: 48, y, size, font });
      y -= leading;
      line = "";
    };
    for (const char of source) {
      if (line && font.widthOfTextAtSize(line + char, size) > 499) draw();
      line += char;
    }
    draw();
  }
  return Buffer.from(await pdf.save());
}
