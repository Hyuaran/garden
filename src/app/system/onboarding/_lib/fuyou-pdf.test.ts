import { describe, expect, it } from "vitest";
import { emptyDependent, emptyInput, type Dependent } from "./onboarding";
import { UNDER16_DEPENDENT_PDF_FIELDS, fuyouManualAdditionNotice, fuyouPdfFilename, hasSpouse, safeFuyouErrorMessage, splitFuyouDependents, splitPostalCode, toWarekiDate } from "./fuyou-pdf";

function dependent(value: Partial<Dependent>): Dependent {
  return { ...emptyDependent(), ...value };
}

describe("扶養控除申告書PDFの値変換", () => {
  it.each([
    ["2019-05-01", { era: "令", year: "1", month: "5", day: "1" }],
    ["2019-04-30", { era: "平", year: "31", month: "4", day: "30" }],
    ["1989-01-08", { era: "平", year: "1", month: "1", day: "8" }],
    ["1989-01-07", { era: "昭", year: "64", month: "1", day: "7" }],
    ["1926-12-25", { era: "昭", year: "1", month: "12", day: "25" }],
    ["1926-12-24", { era: "大", year: "15", month: "12", day: "24" }],
    ["1912-07-30", { era: "大", year: "1", month: "7", day: "30" }],
    ["1912-07-29", { era: "明", year: "45", month: "7", day: "29" }],
  ])("%s を和暦に直す", (source, expected) => {
    expect(toWarekiDate(source)).toEqual(expected);
  });

  it("郵便番号を前3桁と後4桁に分ける", () => {
    expect(splitPostalCode("541-0054")).toEqual({ first: "541", last: "0054" });
    expect(splitPostalCode("123")).toEqual({ first: "123", last: "" });
  });

  it("続柄が配偶者の家族がいる時だけ配偶者ありにする", () => {
    const values = emptyInput();
    expect(hasSpouse(values)).toBe(false);
    values.dependents = [{ name: "家族", name_kana: "", my_number: "", relation: "配偶者", birth_date: "", annual_income: "", occupation: "" }];
    expect(hasSpouse(values)).toBe(true);
  });

  it("配偶者をA欄、16歳以上をB欄、16歳未満を別欄に振り分ける", () => {
    const values = emptyInput();
    values.dependents = [
      dependent({ name: "配偶者", relation: "配偶者", birth_date: "1990-01-01" }),
      dependent({ name: "境目でB欄", relation: "子", birth_date: "2011-01-01" }),
      dependent({ name: "16歳未満1", relation: "子", birth_date: "2011-01-02" }),
      dependent({ name: "16歳未満2", relation: "子", birth_date: "2012-01-01" }),
      dependent({ name: "B2", relation: "父", birth_date: "1970-01-01" }),
      dependent({ name: "B3", relation: "母", birth_date: "1971-01-01" }),
      dependent({ name: "B4", relation: "祖父", birth_date: "1940-01-01" }),
      dependent({ name: "あふれ", relation: "祖母", birth_date: "1941-01-01" }),
    ];

    const result = splitFuyouDependents(values);
    expect(result.spouse?.name).toBe("配偶者");
    expect(result.adultDependents.map(dependent => dependent.name)).toEqual(["境目でB欄", "B2", "B3", "B4"]);
    expect(result.under16Dependents.map(dependent => dependent.name)).toEqual(["16歳未満1", "16歳未満2"]);
    expect(result.manualAdditionCount).toBe(1);
    expect(fuyouManualAdditionNotice(values)).toBe("1人分は用紙に入りきらないため手書きで足してください");
  });

  it("16歳未満が0人なら16歳未満欄は空欄扱いにする", () => {
    const values = emptyInput();
    values.dependents = [
      dependent({ name: "境目でB欄", relation: "子", birth_date: "2011-01-01" }),
      dependent({ name: "親", relation: "母", birth_date: "1971-01-01" }),
    ];

    const result = splitFuyouDependents(values);

    expect(result.adultDependents.map(dependent => dependent.name)).toEqual(["境目でB欄", "親"]);
    expect(result.under16Dependents).toEqual([]);
    expect(fuyouManualAdditionNotice(values)).toBe("");
  });

  it("16歳未満は上から2人までにし、3人以上はあふれ分だけ手書き案内にする", () => {
    const values = emptyInput();
    values.dependents = [
      dependent({ name: "下1", relation: "子", birth_date: "2011-01-02" }),
      dependent({ name: "下2", relation: "子", birth_date: "2012-01-01" }),
      dependent({ name: "下3", relation: "子", birth_date: "2013-01-01" }),
    ];

    const result = splitFuyouDependents(values);

    expect(result.under16Dependents.map(dependent => dependent.name)).toEqual(["下1", "下2"]);
    expect(result.manualAdditionCount).toBe(1);
    expect(fuyouManualAdditionNotice(values)).toBe("1人分は用紙に入りきらないため手書きで足してください");
  });

  it("配偶者は16歳未満でも16歳未満欄に入れない", () => {
    const values = emptyInput();
    values.dependents = [
      dependent({ name: "若い配偶者", relation: "配偶者", birth_date: "2011-01-02" }),
      dependent({ name: "子", relation: "子", birth_date: "2012-01-01" }),
    ];

    const result = splitFuyouDependents(values);

    expect(result.spouse?.name).toBe("若い配偶者");
    expect(result.under16Dependents.map(dependent => dependent.name)).toEqual(["子"]);
  });

  it("16歳未満欄の2人目の年はText119に入れる定義にする", () => {
    expect(UNDER16_DEPENDENT_PDF_FIELDS).toEqual([
      { kana: "Text90", name: "Text91", myNumber: "Text92", relation: "Text93", era: "Dropdown19", year: "Text94", month: "Text95", day: "Text96", address: "Text97", income: "Text98" },
      { kana: "Text100", name: "Text101", myNumber: "Text102", relation: "Text103", era: "Dropdown21", year: "Text119", month: "Text104", day: "Text105", address: "Text106", income: "Text107" },
    ]);
  });

  it("ファイル名の氏名からスペースを抜き、失敗理由は利用者向け文言だけにする", () => {
    expect(fuyouPdfFilename("上田 基人")).toBe("【扶養控除申告書】上田基人_令和8年分_給与所得者の扶養控除等(異動)申告書.pdf");
    expect(safeFuyouErrorMessage(500)).toBe("保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。");
    expect(safeFuyouErrorMessage(500)).not.toMatch(/Drive API|token|scope/i);
  });
});
