import ExcelJS from "exceljs";

import { HIKARI_COL_WIDTHS, HIKARI_HEADERS, KUREKA_COL_WIDTHS, KUREKA_HEADERS, RAW_IMPORT_COLUMNS } from "./constants";
import type { RawImportRow } from "./build-import";

const FONT_NAME = "游ゴシック";

function styleHeader(row: ExcelJS.Row) {
  row.font = { name: FONT_NAME, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10233F" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
}

export async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function createTemplateWorkbook(kind: "hikari" | "kureka"): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Garden";
  const headers: string[] = kind === "hikari" ? [...HIKARI_HEADERS] : [...KUREKA_HEADERS];
  const widths = kind === "hikari" ? HIKARI_COL_WIDTHS : KUREKA_COL_WIDTHS;
  const sheet = workbook.addWorksheet("リスト");
  sheet.addRow(headers);
  sheet.addRow(kind === "hikari"
    ? ["", "佐倉", "湊", "大阪府", "大阪市中央区", "青葉町1-2-3", "0612345678", "540-0001"]
    : ["【クレカ】サンプル_20260918_2", "0612345678", "09012345678", "docomo", "佐倉", "湊", "1980/01/02", "", "", "", "佐倉", "湊", "1980/01/02", "540-0001", "大阪府", "大阪市中央区", "青葉町1-2-3", "青葉ビル", "101"]);
  styleHeader(sheet.getRow(1));
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  for (const header of ["電話番号", "携帯番号", "郵便番号", "設置先_郵便番号"]) {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getColumn(index + 1).numFmt = "@";
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const guide = workbook.addWorksheet("書き方");
  guide.addRows([
    ["項目", "書き方"],
    ["電話番号", "ハイフンあり／なしのどちらでも使えます。先頭の 0 が消えないよう文字として入力してください。"],
    ["郵便番号", "7 桁または 3 桁-4 桁で入力してください。6 桁になったものは都道府県と合うときだけ 0 を補います。"],
    ["氏名", "姓と名を分けてください。分けられないときは姓にまとめて、確認画面で直せます。"],
    ["リスト名", "光回線は空でかまいません。ファイル名から作ります。クレカは列の値をそのまま使います。"],
    ["ファイル", "複数まとめて上げられます。1 ファイル 1 種類、合計 50,000 行までです。"],
    [".xls", ".xls は一度 .xlsx で保存してから上げてください。"],
  ]);
  styleHeader(guide.getRow(1));
  guide.columns = [{ width: 18 }, { width: 90 }];
  return workbook;
}

export function createImportWorkbook(rows: RawImportRow[], excluded: RawImportRow[] = []): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const main = workbook.addWorksheet("統合リスト");
  main.addRow([...RAW_IMPORT_COLUMNS]);
  for (const row of rows) main.addRow(RAW_IMPORT_COLUMNS.map((column) => row[column] ?? ""));
  styleHeader(main.getRow(1));
  main.views = [{ state: "frozen", ySplit: 1 }];
  RAW_IMPORT_COLUMNS.forEach((column, index) => {
    main.getColumn(index + 1).width = column === "リスト名" ? 28 : 16;
    if (column.includes("電話番号") || column.includes("携帯番号") || column.includes("郵便番号") || column.includes("生年月日")) main.getColumn(index + 1).numFmt = "@";
  });
  const excludedSheet = workbook.addWorksheet("除外");
  excludedSheet.addRow(["理由", ...RAW_IMPORT_COLUMNS]);
  for (const row of excluded) excludedSheet.addRow([row.excludedReason ?? "", ...RAW_IMPORT_COLUMNS.map((column) => row[column] ?? "")]);
  styleHeader(excludedSheet.getRow(1));
  const review = workbook.addWorksheet("要確認");
  review.addRow(["行", "リスト名", "氏名", "電話番号", "指摘"]);
  for (const row of rows.filter((item) => item.reviewReasons.length > 0)) {
    review.addRow([row.rowNumber, row["リスト名"] ?? "", `${row["既契約者名_姓"] ?? row["申込者名_姓"] ?? ""}${row["既契約者名_名"] ?? row["申込者名_名"] ?? ""}`, row.normalizedPhone, row.reviewReasons.join("／")]);
  }
  styleHeader(review.getRow(1));
  return workbook;
}
