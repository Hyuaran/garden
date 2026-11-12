import ExcelJS from "exceljs";

import type { AporanSheetGrid } from "../calc/aporan-sheet";
import { HOUHAN_PRODUCTS, type HouhanSheetGrid } from "../calc/houhan-sheet";
import type { IncentiveSheetGrid } from "../calc/incentive-sheet";
import type { JissekiSheetGrid } from "../calc/jisseki-sheet";
import { kanriTeamBlocks, type KanriPointMaster, type KanriSheetGrid } from "../calc/kanri-sheet";
import type { PayrollSheetGrid } from "../calc/payroll-sheet";
import labels from "./template-labels.json";

type CellValue = number | string | null;
type SheetGrid = { cellValues: Record<string, CellValue> };

export type KanriExcelRun = {
  id: string;
  target_date: string;
};

export type KanriExcelResults = {
  kanri: KanriSheetGrid;
  jisseki: JissekiSheetGrid;
  aporan: AporanSheetGrid;
  houhan: HouhanSheetGrid;
  incentive: IncentiveSheetGrid;
  payroll: PayrollSheetGrid;
};

export type TemplateSheet = {
  static_cells: Record<string, CellValue>;
  merged: string[];
  col_widths: Record<string, number>;
  max_row: number;
  max_col: number;
};

const TEMPLATE = labels as Record<string, TemplateSheet>;
const SHEETS = [
  ["【入力】管理表", "kanri"],
  ["【入力】実績管理", "jisseki"],
  ["【入力】アポラン", "aporan"],
  ["【入力】訪問販売", "houhan"],
  ["インセ計算", "incentive"],
  ["【月1】給与計算用", "payroll"],
] as const;
const POINT_SHEET_NAME = "付与ポイント";
const POINT_FIRST_COLUMN = 2;

export function kanriExcelFilename(targetDate: string) {
  return `【管理表】実件数報告_${targetDate.replaceAll("-", "")}.xlsx`;
}

export function buildKanriWorkbook({ run, results, points }: {
  run: KanriExcelRun;
  results: KanriExcelResults;
  points: KanriPointMaster[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Garden";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = kanriExcelFilename(run.target_date);

  for (const [sheetName, key] of SHEETS) {
    const worksheet = addTemplateWorksheet(workbook, sheetName, key === "kanri" ? results.kanri : undefined);
    if (key === "jisseki" && results.jisseki.yearMonth >= "2026-11") {
      for (const range of TEMPLATE[sheetName].merged) worksheet.unMergeCells(range);
      for (let column=13;column<=Math.max(worksheet.columnCount,12+results.jisseki.productColumns.length);column++) {
        worksheet.getCell(2,column).value=null;
        worksheet.getCell(3,column).value=null;
      }
      results.jisseki.productColumns.forEach((column,index)=> {
        worksheet.getCell(2,13+index).value=column.product;
        worksheet.getCell(3,13+index).value=column.label;
        worksheet.getColumn(13+index).width=12;
      });
    }
    writeCells(worksheet, extraCellsFor(sheetName, results[key]));
    writeCells(worksheet, results[key].cellValues);
    applyCommonFormats(worksheet);
  }

  const pointSheet = addTemplateWorksheet(workbook, POINT_SHEET_NAME);
  writePointMaster(pointSheet, points);
  applyCommonFormats(pointSheet);

  return workbook;
}

export async function writeKanriWorkbookBuffer(input: Parameters<typeof buildKanriWorkbook>[0]) {
  const workbook = buildKanriWorkbook(input);
  return workbook.xlsx.writeBuffer();
}

function addTemplateWorksheet(workbook: ExcelJS.Workbook, sheetName: string, grid?: KanriSheetGrid) {
  let template = TEMPLATE[sheetName];
  if (grid && grid.yearMonth >= "2026-11") template = expandedKanriTemplate(template,grid);
  const worksheet = workbook.addWorksheet(sheetName);
  if (!template) return worksheet;

  for (const [column, width] of Object.entries(template.col_widths ?? {})) {
    worksheet.getColumn(column).width = width;
  }
  for (let index = 1; index <= template.max_col; index += 1) {
    const column = worksheet.getColumn(index);
    if (!column.width) column.width = 9;
  }
  for (let index = 1; index <= template.max_row; index += 1) {
    worksheet.getRow(index).height = 18;
  }
  writeCells(worksheet, template.static_cells ?? {});
  for (const range of template.merged ?? []) worksheet.mergeCells(range);
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  return worksheet;
}

function expandedKanriTemplate(template: TemplateSheet, grid: KanriSheetGrid): TemplateSheet {
  const delta=grid.products.length-20;
  const shift=(address:string)=>address.replace(/^[A-Z]+/,column=>{
    const n=[...column].reduce((sum,c)=>sum*26+c.charCodeAt(0)-64,0);
    if(n<9) return column;
    const block=Math.min(2,Math.floor((n-9)/23));
    return numberToColumn(n+block*delta);
  });
  const static_cells=Object.fromEntries(Object.entries(template.static_cells).map(([address,value])=>[shift(address),value]));
  const col_widths=Object.fromEntries(Object.entries(template.col_widths).map(([column,width])=>[shift(column),width]));
  grid.teams.forEach((team,index)=> {
    const block=kanriTeamBlocks(grid.yearMonth,grid.products.length,grid.teams.length)[index];
    static_cells[block.hours+"2"]=team;
    grid.products.forEach((product,i)=> {const column=shiftColumn(block.firstProduct,i);static_cells[column+"3"]=product;col_widths[column]=template.col_widths.L??12;});
  });
  return {...template,static_cells,col_widths,max_col:template.max_col+2*delta,merged:template.merged.map(range=>range.split(":").map(shift).join(":"))};
}

function writeCells(worksheet: ExcelJS.Worksheet, cells: Record<string, CellValue>) {
  for (const [address, rawValue] of Object.entries(cells)) {
    const cell = worksheet.getCell(address);
    const value = toExcelValue(rawValue);
    cell.value = value;
    if (value instanceof Date) {
      cell.numFmt = "yyyy/mm/dd";
      // 日付が「########」にならないよう、列幅が狭いときだけ広げる（テンプレートに幅の指定が無い列がある）
      const column = worksheet.getColumn(cell.fullAddress.col);
      if (!column.width || column.width < 11) column.width = 11;
    } else if (typeof value === "number") cell.numFmt = numberFormatFor(address);
    cell.alignment = { vertical: "middle", horizontal: typeof value === "number" ? "right" : "left", wrapText: true };
  }
}

function toExcelValue(value: CellValue) {
  if (value === null || value === "") return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00)?$/);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  return value;
}

function numberFormatFor(address: string) {
  const row = Number(address.match(/\d+$/)?.[0] ?? 0);
  const column = address.match(/^[A-Z]+/)?.[0] ?? "";
  if (["F", "J", "AG", "BD"].includes(column)) return "0.00";
  if (row >= 7 && row <= 18) return "0.0%";
  if (["O", "P", "R", "S", "T", "U", "V", "W", "Z", "AA"].includes(column)) return "#,##0";
  return "0.00";
}

function extraCellsFor(sheetName: string, grid: SheetGrid) {
  if (sheetName === "【入力】管理表") return kanriOpenRateCells(grid as KanriSheetGrid);
  if (sheetName === "【入力】訪問販売") return houhanWeightCells(grid as HouhanSheetGrid);
  return {};
}

function kanriOpenRateCells(grid: KanriSheetGrid) {
  const cells: Record<string, CellValue> = {};
  (grid.teams ?? []).forEach((team, teamIndex) => {
    const block = kanriTeamBlocks(grid.yearMonth,grid.products.length,grid.teams.length)[teamIndex];
    if (!block) return;
    (grid.products ?? []).forEach((product, productIndex) => {
      cells[`${shiftColumn(block.firstProduct, productIndex)}2`] = grid.openRate?.[team]?.[product] ?? null;
    });
  });
  return cells;
}

function houhanWeightCells(grid: HouhanSheetGrid) {
  const cells: Record<string, CellValue> = {};
  for (const first of ["H", "AE", "BB"]) {
    HOUHAN_PRODUCTS.forEach((product, index) => {
      cells[`${shiftColumn(first, index)}3`] = grid.weights?.[product.key] ?? null;
    });
  }
  return cells;
}

function writePointMaster(worksheet: ExcelJS.Worksheet, points: KanriPointMaster[]) {
  const activePoints = [...points]
    .filter((point) => point.active !== false)
    .sort((a, b) => (a.sort_order ?? 1000) - (b.sort_order ?? 1000));
  if (activePoints.some(point=>point.soilRows)) {
    ["商材","獲得方法","開始日","終了日","ポイント","単価"].forEach((label,index)=>worksheet.getCell(8,index+2).value=label);
  }
  let detailRow = 9;
  activePoints.forEach((point, index) => {
    if(point.soilRows) {
      const rows=point.soilRows;
      const baseline=rows.find(row=>row.channel==="hakuchi")??rows[0];
      point={...point,coefficient:baseline.total_points,unit_price:baseline.unit_price};
      const differing=rows.filter(row=>row.total_points!==baseline.total_points || row.unit_price!==baseline.unit_price);
      differing.forEach((row)=> {
        const line=detailRow++;
        worksheet.getCell(`B${line}`).value=point.product;
        worksheet.getCell(`C${line}`).value={hakuchi:"白地",lp:"LP",alliance:"アライアンス"}[row.channel];
        worksheet.getCell(`D${line}`).value=row.start_date;
        worksheet.getCell(`E${line}`).value=row.end_date;
        worksheet.getCell(`F${line}`).value=row.total_points;
        worksheet.getCell(`G${line}`).value=row.unit_price;
      });
    }
    const column = numberToColumn(POINT_FIRST_COLUMN + index);
    if (point.soilRows) worksheet.getColumn(column).width=16;
    worksheet.getCell(`${column}3`).value = point.product;
    worksheet.getCell(`${column}4`).value = nullableNumber(point.coefficient);
    worksheet.getCell(`${column}5`).value = nullableNumber(point.unit_price);
    worksheet.getCell(`${column}5`).numFmt = "#,##0";
  });
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function shiftColumn(column: string, offset: number) {
  return numberToColumn(columnToNumber(column) + offset);
}

function columnToNumber(column: string) {
  return [...column].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function numberToColumn(value: number) {
  let number = value;
  let result = "";
  while (number > 0) {
    const mod = (number - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    number = Math.floor((number - mod) / 26);
  }
  return result;
}

function applyCommonFormats(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === null) return;
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E2EC" } },
        left: { style: "thin", color: { argb: "FFD9E2EC" } },
        bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
        right: { style: "thin", color: { argb: "FFD9E2EC" } },
      };
    });
  });
}
