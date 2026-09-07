import iconv from "iconv-lite";

import { getColumnName, type SoilListColumnKey } from "@/app/system/list/_lib/list-fields";

type MerValue = string | number | boolean | null | undefined;
export type MerRow = Partial<Record<SoilListColumnKey, MerValue>> & Record<string, MerValue>;

function formatDateLike(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : value;
}

function replaceUnsupportedCp932(value: string): { value: string; count: number } {
  let replaced = "";
  let count = 0;

  for (const char of value) {
    const roundTrip = iconv.decode(iconv.encode(char, "cp932"), "cp932");
    if (roundTrip === char) {
      replaced += char;
    } else {
      replaced += "〓";
      count += 1;
    }
  }

  return { value: replaced, count };
}

function quoteMerField(value: MerValue): { value: string; replaced: number } {
  if (value === null || value === undefined) return { value: "\"\"", replaced: 0 };
  const raw = formatDateLike(String(value));
  const safe = replaceUnsupportedCp932(raw);
  return { value: `"${safe.value.replaceAll("\"", "\"\"")}"`, replaced: safe.count };
}

export function buildMerBuffer(
  columns: SoilListColumnKey[],
  rows: MerRow[],
): { buffer: Buffer; text: string; replacedChars: number } {
  let replacedChars = 0;
  const lines = [
    columns
      .map((column) => {
        const quoted = quoteMerField(getColumnName(column));
        replacedChars += quoted.replaced;
        return quoted.value;
      })
      .join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const quoted = quoteMerField(row[column] ?? row[getColumnName(column)]);
          replacedChars += quoted.replaced;
          return quoted.value;
        })
        .join(","),
    ),
  ];
  const text = `${lines.join("\r\n")}\r\n`;
  return { buffer: iconv.encode(text, "cp932"), text, replacedChars };
}
