import ExcelJS from "exceljs";
import iconv from "iconv-lite";

import { MAX_UPLOAD_FILE_SIZE, MAX_UPLOAD_ROWS, SoilListUploadError, uploadFileExtension } from "../upload-parser";
import { HIKARI_HEADERS, KUREKA_HEADERS, type RawKind } from "./constants";
import { detectRawKind } from "./detect";
import { hikariListNameFromFile, kurekaListName } from "./list-name";
import { buildHikariImportRow, buildKurekaImportRow, type RawImportRow } from "./build-import";
import {
  normalizeAddress,
  normalizeBirthday,
  normalizeName,
  normalizePhoneForImport,
  normalizePostal,
  splitPrefecture,
  text,
  type PostalLookup,
} from "./normalize";

export type RawParsedFile = { fileName: string; kind: RawKind; rows: RawImportRow[]; reviews: string[] };

function csvRows(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const next = body[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (char !== "\r") value += char;
  }
  row.push(value);
  if (row.some(Boolean) || rows.length === 0) rows.push(row);
  return rows;
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = Buffer.from(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return utf8.includes("\uFFFD") ? iconv.decode(bytes, "cp932") : utf8.replace(/^\uFEFF/, "");
}

async function readRows(file: File): Promise<string[][]> {
  const extension = uploadFileExtension(file.name);
  if (extension === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new SoilListUploadError("シートが見つかりません");
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((cell) => text(cell)));
    });
    return rows;
  }
  if (extension === ".xls") throw new SoilListUploadError(".xls は一度 .xlsx で保存してから上げてください");
  return csvRows(decodeText(await file.arrayBuffer())).map((row) => row.map((cell) => cell.trim()));
}

export function assertRawUploadFiles(files: File[]) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (files.length === 0) throw new SoilListUploadError("ファイルを選んでください");
  if (totalSize > MAX_UPLOAD_FILE_SIZE) throw new SoilListUploadError("ファイルは合計20MBまでです");
  for (const file of files) {
    const extension = uploadFileExtension(file.name);
    if (![".csv", ".xlsx", ".xls"].includes(extension)) throw new SoilListUploadError("CSV・Excel のファイルを選んでください");
  }
}

function valueByHeader(raw: string[], positions: Record<string, number>, header: string): string {
  const index = positions[header];
  return index === undefined ? "" : text(raw[index]);
}

async function parseHikariRows(fileName: string, rawRows: string[][], positions: Record<string, number>, lookup?: PostalLookup): Promise<RawImportRow[]> {
  const nameResult = hikariListNameFromFile(fileName);
  const rows: RawImportRow[] = [];
  for (let index = 1; index < rawRows.length; index += 1) {
    const raw = rawRows[index];
    if (!raw.some((cell) => text(cell))) continue;
    const reasons: string[] = [];
    const name = normalizeName(valueByHeader(raw, positions, "氏名_姓"), valueByHeader(raw, positions, "氏名_名"));
    if (name.review) reasons.push(name.review);
    const address = splitPrefecture(valueByHeader(raw, positions, "住所_都道府県"), valueByHeader(raw, positions, "住所_市町村"));
    const town = normalizeAddress(valueByHeader(raw, positions, "住所_町域"));
    const phone = normalizePhoneForImport(valueByHeader(raw, positions, "電話番号"));
    if (phone.review) reasons.push(phone.review);
    const postal = await normalizePostal(valueByHeader(raw, positions, "郵便番号"), address.prefecture, lookup);
    if (postal.review) reasons.push(postal.review);
    if (nameResult.review) reasons.push(nameResult.review);
    rows.push(buildHikariImportRow({
      rowNumber: index + 1,
      // 026 と同じく、光回線のリスト名はファイル名から作った値を優先する（元 Excel のリスト名列にはファイル名などが入っていることが多い）
      listName: nameResult.value || valueByHeader(raw, positions, "リスト名"),
      lastName: name.last,
      firstName: name.first,
      prefecture: address.prefecture,
      city: address.city,
      town,
      phone: phone.value,
      postal: postal.value,
      reviewReasons: reasons,
    }));
  }
  return rows;
}

async function parseKurekaRows(fileName: string, rawRows: string[][], positions: Record<string, number>, lookup?: PostalLookup): Promise<RawImportRow[]> {
  const rows: RawImportRow[] = [];
  for (let index = 1; index < rawRows.length; index += 1) {
    const raw = rawRows[index];
    if (!raw.some((cell) => text(cell))) continue;
    const values: Record<string, string> = {};
    for (const header of KUREKA_HEADERS) values[header] = valueByHeader(raw, positions, header);
    const listName = kurekaListName(values["リスト名"], fileName);
    values["リスト名"] = listName.value;
    const tel = normalizePhoneForImport(values["電話番号"], "電話番号");
    const mobile = normalizePhoneForImport(values["携帯番号"], "携帯番号");
    values["電話番号"] = tel.value;
    values["携帯番号"] = mobile.value;
    values["電話番号_ハイフンなし"] = tel.value;
    values["携帯番号_ハイフンなし"] = mobile.value;
    for (const key of ["申込者名_生年月日", "連絡担当者名_生年月日", "既契約者名_生年月日"]) values[key] = normalizeBirthday(values[key]);
    const address = splitPrefecture(values["設置先_住所_都道府県"], values["設置先_住所_市町村"]);
    values["設置先_住所_都道府県"] = address.prefecture;
    values["設置先_住所_市町村"] = address.city;
    values["設置先_住所_町域"] = normalizeAddress(values["設置先_住所_町域"]);
    values["設置先_住所_建物名"] = normalizeAddress(values["設置先_住所_建物名"]);
    values["設置先_住所_部屋番号"] = normalizeAddress(values["設置先_住所_部屋番号"]);
    const postal = await normalizePostal(values["設置先_郵便番号"], address.prefecture, lookup);
    values["設置先_郵便番号"] = postal.value;
    const reasons = [listName.review, tel.review && !mobile.value ? tel.review : null, mobile.review && !tel.value ? mobile.review : null, postal.review].filter(Boolean) as string[];
    rows.push(buildKurekaImportRow({ rowNumber: index + 1, values, reviewReasons: reasons }));
  }
  return rows;
}

export async function parseRawExcelFiles(files: File[], lookup?: PostalLookup): Promise<{ files: RawParsedFile[]; rows: RawImportRow[] }> {
  assertRawUploadFiles(files);
  const parsedFiles: RawParsedFile[] = [];
  let rowCount = 0;
  for (const file of files) {
    const rawRows = await readRows(file);
    const detection = detectRawKind(rawRows[0] ?? []);
    if (!detection.ok) {
      const missing = detection.missing.join("・") || [...HIKARI_HEADERS].join("・");
      const extra = detection.extra.length ? `／余分な見出し：${detection.extra.join("・")}` : "";
      throw new SoilListUploadError(`見出しが違います（足りない見出し：${missing}${extra}）`);
    }
    const rows = detection.kind === "hikari"
      ? await parseHikariRows(file.name, rawRows, detection.positions, lookup)
      : await parseKurekaRows(file.name, rawRows, detection.positions, lookup);
    rowCount += rows.length;
    if (rowCount > MAX_UPLOAD_ROWS) throw new SoilListUploadError("ファイルは50,000行までです");
    parsedFiles.push({ fileName: file.name, kind: detection.kind, rows, reviews: rows.flatMap((row) => row.reviewReasons) });
  }
  return { files: parsedFiles, rows: parsedFiles.flatMap((file) => file.rows) };
}

