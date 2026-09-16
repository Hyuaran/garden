import { extractListLoadedOn, type ParsedUploadRow } from "../upload-parser";
import { RAW_IMPORT_COLUMNS, type ImportColumn, type RawKind } from "./constants";

export type RawImportRow = Record<ImportColumn, string | null> & {
  rowNumber: number;
  sourceKind: RawKind;
  normalizedPhone: string;
  listLoadedOn: string | null;
  checkReason: string | null;
  reviewReasons: string[];
  excludedReason?: string;
};

export function emptyImportValues(): Record<ImportColumn, string | null> {
  return Object.fromEntries(RAW_IMPORT_COLUMNS.map((column) => [column, null])) as Record<ImportColumn, string | null>;
}

export function buildHikariImportRow(input: {
  rowNumber: number;
  listName: string;
  lastName: string;
  firstName: string;
  prefecture: string;
  city: string;
  town: string;
  phone: string;
  postal: string;
  reviewReasons?: string[];
}): RawImportRow {
  const values = emptyImportValues();
  values["リスト名"] = input.listName;
  values["電話番号_ハイフンなし"] = input.phone;
  values["既契約者名_姓"] = input.lastName;
  values["既契約者名_名"] = input.firstName;
  values["設置先_郵便番号"] = input.postal;
  values["設置先_住所_都道府県"] = input.prefecture;
  values["設置先_住所_市町村"] = input.city;
  values["設置先_住所_町域"] = input.town;
  const reviewReasons = input.reviewReasons ?? [];
  return {
    ...values,
    rowNumber: input.rowNumber,
    sourceKind: "hikari",
    normalizedPhone: input.phone,
    listLoadedOn: extractListLoadedOn(input.listName),
    checkReason: reviewReasons.length ? reviewReasons.join("／") : null,
    reviewReasons,
  };
}

export function buildKurekaImportRow(input: { rowNumber: number; values: Record<string, string>; reviewReasons?: string[] }): RawImportRow {
  const values = emptyImportValues();
  for (const column of RAW_IMPORT_COLUMNS) values[column] = input.values[column] ?? null;
  const phone = values["電話番号_ハイフンなし"] || values["携帯番号_ハイフンなし"] || "";
  const reviewReasons = input.reviewReasons ?? [];
  return {
    ...values,
    rowNumber: input.rowNumber,
    sourceKind: "kureka",
    normalizedPhone: phone,
    listLoadedOn: extractListLoadedOn(values["リスト名"] ?? ""),
    checkReason: reviewReasons.length ? reviewReasons.join("／") : null,
    reviewReasons,
  };
}

export function toParsedUploadRow(row: RawImportRow): ParsedUploadRow {
  return { ...row, format: "A" };
}

