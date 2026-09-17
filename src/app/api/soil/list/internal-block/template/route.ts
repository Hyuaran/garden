import ExcelJS from "exceljs";

import { requireSoilListUser } from "../../_lib/auth";
import { workbookBuffer } from "../../_lib/raw-excel/excel";

export const runtime = "nodejs";

const FONT_NAME = "游ゴシック";

function styleHeader(row: ExcelJS.Row) {
  row.font = { name: FONT_NAME, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10233F" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
}

function createInternalBlockTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Garden";

  const sheet = workbook.addWorksheet("一括登録");
  sheet.addRow(["電話番号", "理由"]);
  sheet.addRow(["03-1234-5678", "社内判断で架電しない"]);
  styleHeader(sheet.getRow(1));
  sheet.getColumn(1).width = 20;
  sheet.getColumn(1).numFmt = "@";
  sheet.getColumn(2).width = 42;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const guide = workbook.addWorksheet("書き方");
  guide.addRows([
    ["項目", "書き方"],
    ["電話番号", "ハイフンあり／なしのどちらでも使えます。1 行に 1 番号だけ入れてください。"],
    ["理由", "必ず入力してください。"],
    ["登録済みの番号", "確認画面の件数に出ます。登録時に重ねて足されることはありません。"],
    ["ファイル", "CSV・Excel・.mer、50,000 行まで使えます。"],
  ]);
  styleHeader(guide.getRow(1));
  guide.columns = [{ width: 22 }, { width: 86 }];

  return workbook;
}

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const fileName = "自社アポ禁_一括登録テンプレート.xlsx";
  return new Response(await workbookBuffer(createInternalBlockTemplateWorkbook()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="internal-block-template.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
