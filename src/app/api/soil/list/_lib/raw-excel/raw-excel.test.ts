import { describe, expect, it } from "vitest";

import { applyRawChecks } from "./check";
import { detectRawKind } from "./detect";
import { buildHikariImportRow } from "./build-import";
import { hikariListNameFromFile, kurekaListName } from "./list-name";
import { normalizeAddress, normalizeBirthday, normalizeName, normalizePhoneForImport, normalizePostal } from "./normalize";
import { applyRawOverrides, parseRawExcelFiles } from "./parser";

describe("raw excel detection", () => {
  it("detects hikari and kureka headers even when reordered", () => {
    expect(detectRawKind(["電話番号", "氏名_名", "氏名_姓", "住所_町域", "住所_都道府県", "住所_市町村", "郵便番号", "リスト名"])).toMatchObject({ ok: true, kind: "hikari" });
    expect(detectRawKind(["携帯番号", "申込者名_姓", "リスト名"])).toMatchObject({ ok: false, missing: expect.arrayContaining(["電話番号"]) });
    expect(detectRawKind([
      "携帯番号", "申込者名_姓", "リスト名", "電話番号", "携帯キャリア", "申込者名_名", "申込者名_生年月日",
      "連絡担当者名_姓", "連絡担当者名_名", "連絡担当者名_生年月日", "既契約者名_姓", "既契約者名_名", "既契約者名_生年月日",
      "設置先_郵便番号", "設置先_住所_都道府県", "設置先_住所_市町村", "設置先_住所_町域", "設置先_住所_建物名", "設置先_住所_部屋番号",
    ])).toMatchObject({ ok: true, kind: "kureka" });
  });
});

describe("raw excel list names", () => {
  it("keeps source dates and does not drop kureka suffixes", () => {
    expect(hikariListNameFromFile("【光回線】F×西転用J20260725.xlsx").value).toBe("【光回線】フレッツ_20260725");
    expect(hikariListNameFromFile("【光回線】アナログ×転用J20260726.xlsx").value).toBe("【光回線】アナログ_20260726");
    expect(hikariListNameFromFile("日付なし.xlsx").review).toContain("リスト名を作れませんでした");
    expect(kurekaListName("【クレカ】た_20260815_2", "fallback.xlsx").value).toBe("【クレカ】た_20260815_2");
  });
});

describe("raw excel normalization", () => {
  it("normalizes names, addresses, postal codes, phones and birthdays", async () => {
    expect(normalizeName("佐倉　湊", "")).toEqual({ last: "佐倉", first: "湊" });
    expect(normalizeName("佐藤太郎", "")).toEqual({ last: "佐藤", first: "太郎" });
    expect(normalizeName("長谷川一郎", "")).toEqual({ last: "長谷川", first: "一郎" });
    expect(normalizeName("小林", "")).toMatchObject({ last: "小林", first: "", review: "氏名の区切りなし" });
    expect(normalizeName("青葉湊", "")).toMatchObject({ last: "青葉湊", first: "", review: "氏名の区切りなし" });
    expect(normalizeAddress(" 大阪府　大阪市中央区１ー２－３ ﾋﾞﾙ ")).toBe("大阪府大阪市中央区1-2-3ビル");
    await expect(normalizePostal("1234567", "東京都")).resolves.toMatchObject({ value: "123-4567" });
    await expect(normalizePostal("123456", "東京都", async () => ({ prefecture: "東京都" }))).resolves.toMatchObject({ value: "012-3456", padded: true });
    await expect(normalizePostal("123456", "大阪府", async () => ({ prefecture: "東京都" }))).resolves.toMatchObject({ value: "123456", review: "郵便番号と都道府県が合いません" });
    expect(normalizePhoneForImport("06-1234-5678")).toMatchObject({ value: "0612345678", usable: true });
    expect(normalizePhoneForImport("06123456")).toMatchObject({ value: "06123456", review: "電話番号の桁が違います" });
    expect(normalizeBirthday("1980-1-2")).toBe("1980/01/02");
  });
});

describe("raw excel overrides and multi-file parsing", () => {
  it("removes review after valid overrides and keeps invalid values under review", async () => {
    const row = buildHikariImportRow({
      rowNumber: 2,
      sourceFileName: "raw.xlsx",
      listName: "【光回線】フレッツ_20260725",
      lastName: "山田太郎",
      firstName: "",
      prefecture: "大阪府",
      city: "大阪市中央区",
      town: "青葉町1-2-3",
      phone: "06123456",
      postal: "540-0001",
      reviewReasons: ["氏名の区切りなし", "電話番号の桁が違います"],
    });
    await applyRawOverrides([row], [{ fileName: "raw.xlsx", rowNumber: 2, lastName: "山田", firstName: "太郎", phone: "0612345678" }]);
    expect(row.reviewReasons).toEqual([]);
    expect(row["既契約者名_姓"]).toBe("山田");
    expect(row.normalizedPhone).toBe("0612345678");

    await applyRawOverrides([row], [{ fileName: "raw.xlsx", rowNumber: 2, phone: "06123456" }]);
    expect(row.reviewReasons).toContain("電話番号の桁が違います");
  });

  it("parses hikari and kureka files together and lowers review count for common surnames", async () => {
    const hikari = new File([
      "リスト名,氏名_姓,氏名_名,住所_都道府県,住所_市町村,住所_町域,電話番号,郵便番号\n",
      ",佐藤太郎,,大阪府,大阪市中央区,青葉町1-2-3,0612345678,5400001\n",
      ",青葉湊,,大阪府,大阪市中央区,青葉町1-2-3,0612345679,5400001\n",
    ], "【光回線】F×西転用J20260725.csv", { type: "text/csv" });
    const kureka = new File([
      "リスト名,電話番号,携帯番号,携帯キャリア,申込者名_姓,申込者名_名,申込者名_生年月日,連絡担当者名_姓,連絡担当者名_名,連絡担当者名_生年月日,既契約者名_姓,既契約者名_名,既契約者名_生年月日,設置先_郵便番号,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,設置先_住所_建物名,設置先_住所_部屋番号\n",
      "【クレカ】た_20260815_2,0312345678,09012345678,docomo,田中,花子,1980-1-2,,,,,,,5400001,大阪府,大阪市中央区,青葉町1-2-3,,\n",
    ], "kureka.csv", { type: "text/csv" });
    const parsed = await parseRawExcelFiles([hikari, kureka]);
    expect(parsed.files.map((file) => file.kind)).toEqual(["hikari", "kureka"]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.find((row) => row.rowNumber === 2 && row.sourceKind === "hikari")?.["既契約者名_姓"]).toBe("佐藤");
    expect(parsed.rows.filter((row) => row.reviewReasons.includes("氏名の区切りなし"))).toHaveLength(1);
  });
});

describe("raw excel checks and mapping", () => {
  it("excludes assignment/order hits, removes exact duplicates, keeps phone-only duplicates for review and maps hikari into 19 columns", () => {
    const first = buildHikariImportRow({
      rowNumber: 2,
      listName: "【光回線】フレッツ_20260725",
      lastName: "佐倉",
      firstName: "湊",
      prefecture: "大阪府",
      city: "大阪市中央区",
      town: "青葉町1-2-3",
      phone: "0612345678",
      postal: "540-0001",
      reviewReasons: [],
    });
    const duplicate = { ...first, rowNumber: 3 };
    const phoneOnlyDuplicate = { ...first, rowNumber: 4, "既契約者名_名": "葵" };
    const assignment = { ...first, rowNumber: 5, normalizedPhone: "0312345678", "電話番号_ハイフンなし": "0312345678" };
    const order = { ...first, rowNumber: 6, normalizedPhone: "0521234567", "電話番号_ハイフンなし": "0521234567" };
    const checked = applyRawChecks([first, duplicate, phoneOnlyDuplicate, assignment, order], [
      { phone: "0312345678", source: "assignment" },
      { phone: "0521234567", source: "order" },
    ]);
    expect(checked.rows).toHaveLength(2);
    expect(checked.excluded.map((row) => row.excludedReason)).toEqual(["過去に配った番号", "案件あり"]);
    expect(checked.rows.every((row) => row.reviewReasons.includes("同じ番号が 2 行"))).toBe(true);
    expect(checked.rows[0]["携帯番号_ハイフンなし"]).toBeNull();
    expect(checked.rows[0]["既契約者名_姓"]).toBe("佐倉");
  });
});
