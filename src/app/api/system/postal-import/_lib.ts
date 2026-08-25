import JSZip from "jszip";

export const JAPAN_POST_UTF8_URL = "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip";

export type PostalImportRow = { postal_code: string; prefecture: string; city: string; town: string; prefecture_kana: string; city_kana: string; town_kana: string; is_special: boolean };

export function parseCsvLine(line: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value); return values;
}

export function parseJapanPostCsv(csv: string): PostalImportRow[] {
  return csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine).filter((columns) => columns.length >= 9 && /^\d{7}$/.test(columns[2])).map((columns) => ({
    postal_code: columns[2], prefecture_kana: columns[3], city_kana: columns[4], town_kana: columns[5], prefecture: columns[6], city: columns[7], town: columns[8],
    is_special: /以下に掲載がない場合|一円|その他/.test(columns[8]),
  }));
}

export async function extractJapanPostCsv(zipBytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(zipBytes);
  const entry = Object.values(zip.files).find((file) => !file.dir && /\.csv$/i.test(file.name));
  if (!entry) throw new Error("postal_csv_not_found");
  return entry.async("string");
}

export function postalSourceDate(lastModified: string | null, now = new Date()) {
  const parsed = lastModified ? new Date(lastModified) : now;
  const date = Number.isNaN(parsed.getTime()) ? now : parsed;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
