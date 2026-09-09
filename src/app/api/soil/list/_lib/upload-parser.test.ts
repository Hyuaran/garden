import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_FILE_SIZE, extractListLoadedOn, normalizePhone, parseUploadFile, prepareAssignmentRows } from "./upload-parser";

function file(name: string, body: BlobPart[], type = "text/csv") {
  return new File(body, name, { type });
}

function blobPart(buffer: Buffer): BlobPart {
  return new Uint8Array(buffer) as BlobPart;
}

describe("prepareAssignmentRows", () => {
  it("drops rows without a phone number and keeps the last row for a duplicated phone×list key", async () => {
    const header = "リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号";
    const body = [
      "【クレカ】た_20260817,山田,一,,,,,",
      "【クレカ】た_20260817,山田,二,,,,,",
      "【クレカ】た_20260817,鈴木,一,大阪府,大阪市,北区,0612345678,5300001",
      "【クレカ】た_20260817,鈴木,二,大阪府,大阪市,北区,06-1234-5678,5300001",
      "【クレカ】た_20260817,佐藤,,,,,0698765432,",
    ].join("\n");
    const parsed = await parseUploadFile(file("list.csv", [`${header}\n${body}\n`]));
    const prepared = prepareAssignmentRows(parsed.rows);
    expect(prepared.emptyPhoneRows).toBe(2);
    expect(prepared.duplicateRows).toBe(1);
    expect(prepared.rows.map((row) => row.normalizedPhone)).toEqual(["0612345678", "0698765432"]);
    expect(prepared.rows[0]["既契約者名_名"]).toBe("二");
  });
});

describe("soil list upload parser", () => {
  it("detects 19-column files by header names even when columns are reordered", async () => {
    const headers = [
      "電話番号_ハイフンなし",
      "リスト名",
      "携帯番号_ハイフンなし",
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
      "余分な列",
    ];
    const parsed = await parseUploadFile(file("list.csv", [`${headers.join(",")}\n06-1234-5678,【光回線】フレッツ_20260829_2,,,,,,,,,,,,,,,,,\n`]));
    expect(parsed.format).toBe("A");
    expect(parsed.rowCount).toBe(1);
    expect(parsed.rows[0].normalizedPhone).toBe("0612345678");
    expect(parsed.rows[0].listLoadedOn).toBe("2026-08-29");
  });

  it("detects 8-column and 10-column files", async () => {
    const base = "リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号";
    await expect(parseUploadFile(file("eight.csv", [`${base}\nリスト_20260907,田中,一郎,大阪府,大阪市,北区,0612345678,5300001\n`]))).resolves.toMatchObject({ format: "B" });
    await expect(parseUploadFile(file("ten.csv", [`${base},A_提供判定,A_提供判定_結果\nリスト_20260907,田中,一郎,大阪府,大阪市,北区,0612345678,5300001,OK,提供可\n`]))).resolves.toMatchObject({ format: "C" });
  });

  it("reads UTF-8 BOM and cp932 csv text", async () => {
    const utf8 = await parseUploadFile(file("bom.csv", ["\uFEFFリスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号\nリスト_20260907,,,,,,０６-１２３４-５６７８,\n"]));
    expect(utf8.rows[0].normalizedPhone).toBe("0612345678");

    const cp932 = iconv.encode("リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号\nリスト_20260907,,,,,,0612345678,\n", "cp932");
    await expect(parseUploadFile(file("cp932.csv", [blobPart(cp932)]))).resolves.toMatchObject({ rowCount: 1 });
  });

  it("reads .mer quoted cp932 text", async () => {
    const body = iconv.encode('"リスト名","既契約者名_姓","既契約者名_名","設置先_住所_都道府県","設置先_住所_市町村","設置先_住所_町域","電話番号_ハイフンなし","設置先_郵便番号"\r\n"リスト_20260907","","","","","","0612345678",""\r\n', "cp932");
    const parsed = await parseUploadFile(file("list.mer", [blobPart(body)]));
    expect(parsed.format).toBe("B");
    expect(parsed.rowCount).toBe(1);
  });

  it("reports warnings and validates limits", async () => {
    const parsed = await parseUploadFile(file("warn.csv", ["リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号\n日付なし,,,,,,123,\n日付なし,,,,,,,\n"]));
    expect(parsed.warnings).toEqual({ emptyPhoneRows: 1, shortPhoneRows: 1, unreadableListDateNames: 1 });
    await expect(parseUploadFile(file("bad.txt", [""]))).rejects.toThrow("CSV・Excel・.mer");
    await expect(parseUploadFile(new File(["x"], "big.csv", { type: "text/csv", endings: "transparent" }))).rejects.toThrow("列名");
    const tooLarge = file("too-large.csv", [""]);
    Object.defineProperty(tooLarge, "size", { value: MAX_UPLOAD_FILE_SIZE + 1 });
    await expect(parseUploadFile(tooLarge)).rejects.toThrow("20MB");
    const header = "リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号";
    const tooManyRows = Array.from({ length: 50_001 }, (_, index) => `リスト_20260907,,,,,,06${String(index).padStart(8, "0")},`).join("\n");
    await expect(parseUploadFile(file("too-many.csv", [`${header}\n${tooManyRows}\n`]))).rejects.toThrow("50,000行");
  });

  it("normalizes phone numbers and extracts list loaded dates", () => {
    expect(normalizePhone("０３ー１２３４-５６７８")).toBe("0312345678");
    expect(extractListLoadedOn("【光回線】フレッツ_20260829_2")).toBe("2026-08-29");
    expect(extractListLoadedOn("日付なし")).toBeNull();
  });
});
