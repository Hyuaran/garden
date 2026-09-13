import { getColumnName, type SoilListColumnKey } from "@/app/system/list/_lib/list-fields";

type ExportValue = string | number | boolean | null | undefined;
export type ExportRow = Partial<Record<SoilListColumnKey, ExportValue>> & Record<string, ExportValue>;

function formatDateLike(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : value;
}

function quoteCsvField(value: ExportValue): string {
  if (value === null || value === undefined) return "\"\"";
  return `"${formatDateLike(String(value)).replaceAll("\"", "\"\"")}"`;
}

export function buildCsvLine(columns: SoilListColumnKey[], row?: ExportRow): string {
  return columns
    .map((column) => quoteCsvField(row ? (row[column] ?? row[getColumnName(column)]) : getColumnName(column)))
    .join(",");
}

