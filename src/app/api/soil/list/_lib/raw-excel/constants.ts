import { IMPORT_COLUMNS } from "../upload-parser";

export const HIKARI_HEADERS = [
  "リスト名",
  "氏名_姓",
  "氏名_名",
  "住所_都道府県",
  "住所_市町村",
  "住所_町域",
  "電話番号",
  "郵便番号",
] as const;

export const KUREKA_HEADERS = [
  "リスト名",
  "電話番号",
  "携帯番号",
  "携帯キャリア",
  "申込者名_姓",
  "申込者名_名",
  "申込者名_生年月日",
  "連絡担当者名_姓",
  "連絡担当者名_名",
  "連絡担当者名_生年月日",
  "既契約者名_姓",
  "既契約者名_名",
  "既契約者名_生年月日",
  "設置先_郵便番号",
  "設置先_住所_都道府県",
  "設置先_住所_市町村",
  "設置先_住所_町域",
  "設置先_住所_建物名",
  "設置先_住所_部屋番号",
] as const;

export const RAW_IMPORT_COLUMNS = IMPORT_COLUMNS;

export const HIKARI_COL_WIDTHS = [31, 20, 20, 28, 34, 50, 29, 22] as const;
export const KUREKA_COL_WIDTHS = [22, 16, 16, 12, 12, 12, 16, 12, 12, 16, 12, 12, 16, 14, 16, 18, 34, 24, 12] as const;

export type RawKind = "hikari" | "kureka";
export type ImportColumn = (typeof RAW_IMPORT_COLUMNS)[number];

