import { describe, expect, it } from "vitest";
import { emptyInput } from "./onboarding";
import { fuyouManualAdditionNotice, fuyouPdfFilename, hasSpouse, safeFuyouErrorMessage, splitFuyouDependents, splitPostalCode, toWarekiDate } from "./fuyou-pdf";

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

  it("配偶者をA欄、16歳以上をB欄、16歳未満とあふれを手書き扱いに振り分ける", () => {
    const values = emptyInput();
    values.dependents = [
      { name: "配偶者", name_kana: "", my_number: "", relation: "配偶者", birth_date: "1990-01-01", annual_income: "", occupation: "" },
      { name: "境目でB欄", name_kana: "", my_number: "", relation: "子", birth_date: "2011-01-01", annual_income: "", occupation: "" },
      { name: "16歳未満", name_kana: "", my_number: "", relation: "子", birth_date: "2011-01-02", annual_income: "", occupation: "" },
      { name: "B2", name_kana: "", my_number: "", relation: "父", birth_date: "1970-01-01", annual_income: "", occupation: "" },
      { name: "B3", name_kana: "", my_number: "", relation: "母", birth_date: "1971-01-01", annual_income: "", occupation: "" },
      { name: "B4", name_kana: "", my_number: "", relation: "祖父", birth_date: "1940-01-01", annual_income: "", occupation: "" },
      { name: "あふれ", name_kana: "", my_number: "", relation: "祖母", birth_date: "1941-01-01", annual_income: "", occupation: "" },
    ];

    const result = splitFuyouDependents(values);
    expect(result.spouse?.name).toBe("配偶者");
    expect(result.adultDependents.map(dependent => dependent.name)).toEqual(["境目でB欄", "B2", "B3", "B4"]);
    expect(result.under16Dependents.map(dependent => dependent.name)).toEqual(["16歳未満"]);
    expect(result.manualAdditionCount).toBe(2);
    expect(fuyouManualAdditionNotice(values)).toBe("2人分は用紙に入りきらないため手書きで足してください");
  });

  it("ファイル名の氏名からスペースを抜き、失敗理由は利用者向け文言だけにする", () => {
    expect(fuyouPdfFilename("上田 基人")).toBe("【扶養控除申告書】上田基人_令和8年分_給与所得者の扶養控除等(異動)申告書.pdf");
    expect(safeFuyouErrorMessage(500)).toBe("保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。");
    expect(safeFuyouErrorMessage(500)).not.toMatch(/Drive API|token|scope/i);
  });
});
