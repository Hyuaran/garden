import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
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
    office.address.replace(/\n/g, "\n　　　　"),
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 70;
const RIGHT = PAGE_WIDTH - LEFT;
const PADDING = 14;
const CONTENT_TOP = PAGE_HEIGHT - 70;
const CONTENT_BOTTOM = 56;

type BoxLine = { x: number; text: string };

/** 手本と同じ形（右寄せの日付と差出人・中央の題名・枠で囲んだ本文）で組む。 */
export async function generateHakenPdf(type: IssueType, input: IssueInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // パスを実行時に変えると、配備物に public 全体が入って容量の上限を超えるので固定する。
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf")),
    // subset: true にすると文字が抜ける（テキストは取れても絵が欠ける）。全部を埋め込む。
    { subset: false },
  );
  const size = type === "reply" ? 9.5 : 11;
  const leading = type === "reply" ? 15 : 19;
  const valueX = LEFT + PADDING + size * 11;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = CONTENT_TOP;

  const newPageIfNeeded = (height: number) => {
    if (y - height >= CONTENT_BOTTOM) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = CONTENT_TOP;
  };
  const wrap = (text: string, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const char of text) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
    return lines;
  };
  const place = (text: string, align: "left" | "right" | "center", gap: number, big = false) => {
    const fontSize = big ? 16 : size;
    const width = font.widthOfTextAtSize(text, fontSize);
    const x = align === "left" ? LEFT : align === "right" ? RIGHT - width : (PAGE_WIDTH - width) / 2;
    page.drawText(text, { x, y, size: fontSize, font });
    y -= gap;
  };
  const boxLines = (lines: string[]) => {
    const result: BoxLine[] = [];
    const inner = LEFT + PADDING;
    for (const source of lines) {
      const continued = source.match(/^(\u3000+)(.*)$/);
      const row = source.match(/^([^：\u3000]{1,14})\u3000*：(.*)$/);
      if (type === "reply" && continued && continued[1].length >= 8) {
        const x = valueX + size * (continued[1].length - 11);
        wrap(continued[2], RIGHT - PADDING - x).forEach((text) => result.push({ x, text }));
      } else if (type === "reply" && row) {
        const values = wrap(row[2], RIGHT - PADDING - valueX - size);
        result.push({ x: inner, text: row[1] });
        values.forEach((text, index) =>
          result.push({ x: index ? valueX + size : -1, text: index ? text : `：${text}` }),
        );
      } else {
        const indent = source.match(/^\u3000*/)![0].length * size;
        const body = source.trimStart();
        if (!body) result.push({ x: inner, text: "" });
        else
          wrap(body, RIGHT - PADDING - inner - indent).forEach((text) =>
            result.push({ x: inner + indent, text }),
          );
      }
    }
    return result;
  };
  const drawBox = (lines: string[]) => {
    const rows = boxLines(lines);
    const count = rows.filter((row) => row.x !== -1).length;
    const height = count * leading + PADDING * 2 - (leading - size);
    newPageIfNeeded(height);
    page.drawRectangle({
      x: LEFT,
      y: y - height + size,
      width: RIGHT - LEFT,
      height,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.7,
    });
    let lineY = y - PADDING;
    rows.forEach((row, index) => {
      if (row.x === -1) {
        page.drawText(row.text, { x: valueX - size, y: lineY, size, font });
        lineY -= leading;
        return;
      }
      if (row.text) page.drawText(row.text, { x: row.x, y: lineY, size, font });
      if (rows[index + 1]?.x !== -1) lineY -= leading;
    });
    y -= height + leading * 0.8;
  };

  const lines = hakenPdfText(type, input).split("\n");
  while (lines.at(-1) === "") lines.pop();
  place(lines[0], "right", leading * 1.6);
  place(lines[1], "left", leading * 1.6);
  place(lines[2], "right", leading * 2.2);
  place(lines[3], "center", leading * 2.2, true);
  let index = 4;
  while (index < lines.length && !/^(\d．|○)/.test(lines[index])) {
    for (const text of wrap(lines[index], RIGHT - LEFT)) place(text, "left", leading);
    index += 1;
  }
  y -= leading * 0.6;
  while (index < lines.length) {
    const heading = lines[index];
    if (heading === "以上") {
      newPageIfNeeded(leading);
      place(heading, "right", leading);
      index += 1;
      continue;
    }
    index += 1;
    const body: string[] = [];
    while (index < lines.length && !/^(\d．|○)/.test(lines[index]) && lines[index] !== "以上") {
      body.push(lines[index]);
      index += 1;
    }
    while (body.at(-1) === "") body.pop();
    const rows = boxLines(body).filter((row) => row.x !== -1).length;
    newPageIfNeeded(leading * 1.4 + rows * leading + PADDING * 2);
    page.drawText(heading, { x: LEFT, y, size: size + 1, font });
    y -= leading * 1.4;
    drawBox(body);
  }
  return Buffer.from(await pdf.save());
}
