import { describe, expect, it } from "vitest";

import { buildFmImportRow, buildFmImportStreamSql, formatPostalCode, splitLedgerName, type FmImportSourceRow } from "./fm-import";
import { IMPORT_COLUMNS } from "./upload-parser";

const [
  LIST_NAME,
  PHONE,
  MOBILE,
  MOBILE_CARRIER,
  APPLICANT_LAST,
  APPLICANT_FIRST,
  APPLICANT_BIRTHDAY,
  ,
  ,
  ,
  CONTRACT_LAST,
  CONTRACT_FIRST,
  CONTRACT_BIRTHDAY,
  POSTAL,
  PREFECTURE,
  CITY,
  TOWN,
  BUILDING,
  ROOM,
] = IMPORT_COLUMNS;

describe("FileMaker import rows", () => {
  it("splits ledger names only when dedicated name columns are empty", () => {
    expect(splitLedgerName({ fullName: "山田 太郎" })).toEqual({ lastName: "山田", firstName: "太郎" });
    expect(splitLedgerName({ fullName: "山田太郎" })).toEqual({ lastName: "山田太郎", firstName: null });
    expect(splitLedgerName({ fullName: "山田 太郎", lastName: "佐藤", firstName: "花子" })).toEqual({ lastName: "佐藤", firstName: "花子" });
  });

  it("formats postal codes as 3-4 digits", () => {
    expect(formatPostalCode("5300001")).toBe("530-0001");
    expect(formatPostalCode("530-0001")).toBe("530-0001");
    expect(formatPostalCode("123456")).toBe("123456");
  });

  it("maps ledger values to the 19 FileMaker columns", () => {
    const row = buildFmImportRow({
      phoneNumber: "06-1234-5678",
      mobileNumber: "090-1111-2222",
      fullName: "山田 太郎",
      lastName: null,
      firstName: null,
      birthday: "1980-01-02",
      postalCode: "5300001",
      prefecture: "大阪府",
      city: "大阪市北区",
      town: "梅田",
      block: "1-2-3",
      orderPhoneNumber: null,
      orderMobileNumber: null,
      mobileCarrier: null,
      applicantLastName: null,
      applicantFirstName: null,
      applicantBirthday: null,
      contactLastName: null,
      contactFirstName: null,
      contactBirthday: null,
      contractLastName: null,
      contractFirstName: null,
      contractBirthday: null,
      installationPostalCode: null,
      installationPrefecture: null,
      installationCity: null,
      installationTown: null,
      installationBuilding: null,
      installationRoom: null,
    }, "【光回線】フレッツ_20260917");

    expect(row).toMatchObject({
      [LIST_NAME]: "【光回線】フレッツ_20260917",
      [PHONE]: "0612345678",
      [MOBILE]: "09011112222",
      [CONTRACT_LAST]: "山田",
      [CONTRACT_FIRST]: "太郎",
      [CONTRACT_BIRTHDAY]: "1980/01/02",
      [POSTAL]: "530-0001",
      [PREFECTURE]: "大阪府",
      [CITY]: "大阪市北区",
      [TOWN]: "梅田",
      [BUILDING]: "1-2-3",
      [ROOM]: null,
    });
  });

  it("prefers latest order values and falls back to ledger by column", () => {
    const row = buildFmImportRow({
      phoneNumber: "0612345678",
      mobileNumber: "09011112222",
      fullName: "台帳 姓名",
      lastName: "台帳姓",
      firstName: "台帳名",
      birthday: "1980-01-02",
      postalCode: "5300001",
      prefecture: "大阪府",
      city: "大阪市北区",
      town: "梅田",
      block: "台帳番地",
      orderPhoneNumber: "06-9999-8888",
      orderMobileNumber: null,
      mobileCarrier: "docomo",
      applicantLastName: "申込姓",
      applicantFirstName: "申込名",
      applicantBirthday: "1990-02-03",
      contactLastName: null,
      contactFirstName: null,
      contactBirthday: null,
      contractLastName: "受注姓",
      contractFirstName: "受注名",
      contractBirthday: null,
      installationPostalCode: "1000001",
      installationPrefecture: "東京都",
      installationCity: "千代田区",
      installationTown: "千代田",
      installationBuilding: null,
      installationRoom: "101",
    } satisfies FmImportSourceRow, "list");

    expect(row[PHONE]).toBe("0699998888");
    expect(row[MOBILE]).toBe("09011112222");
    expect(row[MOBILE_CARRIER]).toBe("docomo");
    expect(row[APPLICANT_LAST]).toBe("申込姓");
    expect(row[APPLICANT_FIRST]).toBe("申込名");
    expect(row[APPLICANT_BIRTHDAY]).toBe("1990/02/03");
    expect(row[CONTRACT_LAST]).toBe("受注姓");
    expect(row[CONTRACT_FIRST]).toBe("受注名");
    expect(row[CONTRACT_BIRTHDAY]).toBe("1980/01/02");
    expect(row[POSTAL]).toBe("100-0001");
    expect(row[PREFECTURE]).toBe("東京都");
    expect(row[BUILDING]).toBe("台帳番地");
    expect(row[ROOM]).toBe("101");
  });

  it("builds SQL that reads the latest order and the 18 FileMaker fields", () => {
    const sql = buildFmImportStreamSql({ filters: [] }, "listLoadedOnAsc", null);
    expect(sql.text).toContain("left join lateral");
    expect(sql.text).toContain('"申込者名_姓"');
    expect(sql.text).toContain('"携帯番号_ハイフンなし"');
    expect(sql.text).toContain('order by o."受注日" desc nulls last');
  });
});

