import { describe, expect, it } from "vitest";
import { emptyInput } from "./onboarding";
import { emptyAdminInput, initialAdminRecord } from "./onboarding-admin";
import {
  buildRenrakuhyoValues,
  formatEmploymentInsuranceNumber,
  formatMyNumber,
  formatPensionNumber,
  formatPhone,
  formatPlainJapaneseDate,
  formatPostalCode,
  RENRAKUHYO_EXCEL_CELLS,
  RENRAKUHYO_PDF_FIELDS,
  formatWarekiHireDate,
  renrakuhyoBaseName,
  renrakuhyoManualAdditionNotice,
  renrakuhyoPdfText,
  safeRenrakuhyoErrorMessage,
} from "./renrakuhyo";

function record() {
  const record = initialAdminRecord("EMP-001");
  record.employee = { employee_id: "EMP-001", name: "台帳 花", hire_date: "2026-09-01", birthday: null, company_id: "COMP-1" };
  record.values = {
    ...emptyInput(),
    name: "吉田 ひな",
    name_kana: "ヨシダ　ヒナ",
    gender: "女性",
    birth_date: "2003-09-28",
    address_kana: "ナラケン",
    postal_code: "6360001",
    phone: "09054677653",
    address: "奈良県",
    pension_number: "5554128559",
    my_number: "123456789012",
    employment_insurance_status: "yes",
    employment_insurance_number: "51202161440",
    previous_employer: "前職株式会社",
    previous_employer_from: "2024-04-01",
    previous_employer_to: "2026-08-31",
    commute_routes: [{ kind: "電車", from_station: "A", to_station: "B", line: "C", pass_monthly: "", fare_oneway: "230" }],
  };
  record.admin = {
    ...emptyAdminInput(),
    office: "本店",
    weekly_hours: "40",
    health_insurance: "加入",
    pension_insurance: "加入",
    employment_insurance: "加入",
    tax_class: "甲",
    salary_kind: "月給",
    base_salary: "200000",
    allowances: [{ name: "役職", amount: "30000" }, { name: "調整", amount: "5000" }],
  };
  return record;
}

describe("入社連絡表の値変換", () => {
  it("25か所の値を本人入力、事務入力、台帳、法人から作る", () => {
    expect(buildRenrakuhyoValues(record(), { company_name: "株式会社Garden" })).toEqual({
      company_name: "会社名        株式会社Garden",
      kana: "ヨシダ　ヒナ",
      gender: "　　女",
      name: "吉田 ひな",
      birth: "2003年9月28日",
      addr_kana: "ナラケン",
      zip: "636-0001",
      tel: "090-5467-7653",
      address: "奈良県",
      hire: "令和 8年　9　月　1　日",
      office: "本店",
      insurance: "厚生年金　・　健康保険　・　　雇用保険　　　すべて加入",
      pension: "基礎年金番号※10桁：　5554-128559",
      mynumber: " マイナンバー※12桁：  1234-5678-9012",
      koyou_card: "(保険者証 )   有り",
      koyou_no: "5120-216144-0",
      prev_company: "前職株式会社",
      prev_period: "2024　年　4　月　～　2026　年　8　月",
      total_pay: "235,000",
      pay_kind: "月給",
      base_pay: "200,000",
      commute_pass: "",
      commute_round: "460",
      tax: "税区分　：　甲（扶養控除等異動申告書の提出あり）",
      weekly: "40",
      dependent1_kana: "",
      dependent1_name: "",
      dependent1_mynumber: "",
      dependent1_relation: "",
      dependent1_birth: "",
      dependent1_income: "",
      dependent1_occupation: "",
      dependent2_kana: "",
      dependent2_name: "",
      dependent2_mynumber: "",
      dependent2_relation: "",
      dependent2_birth: "",
      dependent2_income: "",
      dependent2_occupation: "",
      dependent3_kana: "",
      dependent3_name: "",
      dependent3_mynumber: "",
      dependent3_relation: "",
      dependent3_birth: "",
      dependent3_income: "",
      dependent3_occupation: "",
      dependent4_kana: "",
      dependent4_name: "",
      dependent4_mynumber: "",
      dependent4_relation: "",
      dependent4_birth: "",
      dependent4_income: "",
      dependent4_occupation: "",
    });
  });

  it("Excel用の扶養家族を上から最大4人分作り、マイナンバーをかっこの中に入れる", () => {
    const base = record();
    base.values.dependents = [
      { name: "家族1", name_kana: "カゾク1", my_number: "111122223333", relation: "配偶者", birth_date: "1990-02-03", annual_income: "0", occupation: "会社員" },
      { name: "家族2", name_kana: "カゾク2", my_number: "444455556666", relation: "子", birth_date: "2011-01-01", annual_income: "1200000", occupation: "高校1年" },
      { name: "家族3", name_kana: "カゾク3", my_number: "777788889999", relation: "子", birth_date: "2011-01-02", annual_income: "20,000", occupation: "中学3年" },
      { name: "家族4", name_kana: "カゾク4", my_number: "000011112222", relation: "母", birth_date: "1960-12-31", annual_income: "", occupation: "" },
      { name: "家族5", name_kana: "カゾク5", my_number: "333344445555", relation: "父", birth_date: "1959-01-01", annual_income: "999", occupation: "無職" },
    ];

    const values = buildRenrakuhyoValues(base, { company_name: "G" });
    expect(values.dependent1_kana).toBe("カゾク1");
    expect(values.dependent1_name).toBe("家族1");
    expect(values.dependent1_mynumber).toBe("マイナンバー（ 1111-2222-3333 ）");
    expect(values.dependent1_relation).toBe("配偶者");
    expect(values.dependent1_birth).toBe("1990年2月3日");
    expect(values.dependent1_income).toBe("0");
    expect(values.dependent1_occupation).toBe("会社員");
    expect(values.dependent2_income).toBe("1,200,000");
    expect(values.dependent3_income).toBe("20,000");
    expect(values.dependent4_mynumber).toBe("マイナンバー（ 0000-1111-2222 ）");
    expect(values).not.toHaveProperty("dependent5_name");
    expect(RENRAKUHYO_EXCEL_CELLS.dependent1_kana).toBe("D17");
    expect(RENRAKUHYO_EXCEL_CELLS.dependent4_occupation).toBe("I26");
  });

  it("PDF用の扶養家族をExcelと同じ4人分の値から描ける形にする", () => {
    const base = record();
    base.values.dependents = [
      { name: "家族1", name_kana: "カゾク1", my_number: "111122223333", relation: "配偶者", birth_date: "1990-02-03", annual_income: "0", occupation: "会社員" },
      { name: "家族2", name_kana: "カゾク2", my_number: "444455556666", relation: "子", birth_date: "2011-01-01", annual_income: "1200000", occupation: "高校1年" },
      { name: "家族3", name_kana: "カゾク3", my_number: "777788889999", relation: "子", birth_date: "2011-01-02", annual_income: "20,000", occupation: "中学3年" },
      { name: "家族4", name_kana: "カゾク4", my_number: "000011112222", relation: "母", birth_date: "1960-12-31", annual_income: "", occupation: "" },
    ];

    const values = buildRenrakuhyoValues(base, { company_name: "G" });
    const pdfKeys = RENRAKUHYO_PDF_FIELDS.map(field => field.key);
    expect(pdfKeys).toEqual(expect.arrayContaining([
      "dependent1_kana",
      "dependent1_name",
      "dependent1_mynumber",
      "dependent1_relation",
      "dependent1_birth",
      "dependent1_income",
      "dependent1_occupation",
      "dependent4_kana",
      "dependent4_name",
      "dependent4_mynumber",
      "dependent4_relation",
      "dependent4_birth",
      "dependent4_income",
      "dependent4_occupation",
    ]));
    expect(RENRAKUHYO_PDF_FIELDS.find(field => field.key === "dependent1_kana")).toMatchObject({ x: 131.2, y: 273.3, align: "left", size: 8 });
    expect(RENRAKUHYO_PDF_FIELDS.find(field => field.key === "dependent1_name")).toMatchObject({ x: 184.8, y: 288.5, align: "center" });
    expect(RENRAKUHYO_PDF_FIELDS.find(field => field.key === "dependent1_mynumber")).toMatchObject({ x: 209.5, y: 304.1, align: "center", size: 7.5 });
    expect(RENRAKUHYO_PDF_FIELDS.find(field => field.key === "dependent4_occupation")).toMatchObject({ x: 425.0, y: 413.6, align: "left" });
    expect(renrakuhyoPdfText("dependent1_name", values.dependent1_name)).toBe(values.dependent1_name);
    expect(renrakuhyoPdfText("dependent1_mynumber", values.dependent1_mynumber)).toBe("1111-2222-3333");
    expect(renrakuhyoPdfText("dependent4_mynumber", values.dependent4_mynumber)).toBe("0000-1111-2222");
    expect(renrakuhyoPdfText("dependent1_mynumber", "")).toBe("");
    expect(renrakuhyoPdfText("dependent1_mynumber", "マイナンバー（ 123 ）")).toBe("");
  });

  it("扶養家族が0人ならExcel値もPDF描画値も空欄のままにする", () => {
    const values = buildRenrakuhyoValues(record(), { company_name: "G" });
    const dependentFields = RENRAKUHYO_PDF_FIELDS.filter(field => String(field.key).startsWith("dependent"));

    expect(dependentFields.length).toBe(28);
    for (const field of dependentFields) {
      expect(values[field.key]).toBe("");
      expect(renrakuhyoPdfText(field.key, values[field.key])).toBe("");
    }
    expect(renrakuhyoManualAdditionNotice({ dependents: [] })).toBe("");
  });

  it("扶養家族が5人以上でもPDFとExcelは上から4人だけ一致し、手書き案内数を出す", () => {
    const base = record();
    base.values.dependents = Array.from({ length: 5 }, (_, index) => ({
      name: `家族${index + 1}`,
      name_kana: `カゾク${index + 1}`,
      my_number: `${index + 1}`.repeat(12),
      relation: "子",
      birth_date: `2011-01-0${index + 1}`,
      annual_income: String((index + 1) * 1000),
      occupation: `学年${index + 1}`,
    }));

    const values = buildRenrakuhyoValues(base, { company_name: "G" });
    for (const row of [1, 2, 3, 4]) {
      expect(values[`dependent${row}_name` as keyof typeof values]).toBe(`家族${row}`);
      expect(RENRAKUHYO_PDF_FIELDS.some(field => field.key === `dependent${row}_name`)).toBe(true);
    }
    expect(values).not.toHaveProperty("dependent5_name");
    expect(RENRAKUHYO_PDF_FIELDS.some(field => String(field.key) === "dependent5_name")).toBe(false);
    expect(renrakuhyoManualAdditionNotice(base.values)).toBe("1人分は用紙に入りきらないため手書きで足してください");
  });

  it.each([
    ["2019-05-01", "令和 1年　5　月　1　日"],
    ["2019-04-30", "平成 31年　4　月　30　日"],
    ["1989-01-08", "平成 1年　1　月　8　日"],
    ["1989-01-07", "昭和 64年　1　月　7　日"],
    ["1926-12-25", "昭和 1年　12　月　25　日"],
    ["1926-12-24", "大正 15年　12　月　24　日"],
    ["1912-07-30", "大正 1年　7　月　30　日"],
    ["1912-07-29", "明治 45年　7　月　29　日"],
  ])("入社日の和暦境界 %s", (source, expected) => {
    expect(formatWarekiHireDate(source)).toBe(expected);
  });

  it("日付と番号を決められた区切りにする", () => {
    expect(formatPlainJapaneseDate("2003-09-28")).toBe("2003年9月28日");
    expect(formatPostalCode("6360001")).toBe("636-0001");
    expect(formatPhone("09054677653")).toBe("090-5467-7653");
    expect(formatPensionNumber("5554128559")).toBe("5554-128559");
    expect(formatMyNumber("123456789012")).toBe("1234-5678-9012");
    expect(formatEmploymentInsuranceNumber("51202161440")).toBe("5120-216144-0");
    expect(formatPhone("0742-00-0000")).toBe("0742-00-0000");
  });

  it("社会保険の組み合わせを正しく出す", () => {
    const base = record();
    expect(buildRenrakuhyoValues(base, { company_name: "G" }).insurance).toContain("すべて加入");
    base.admin.employment_insurance = "未加入";
    expect(buildRenrakuhyoValues(base, { company_name: "G" }).insurance).toContain("健康保険・厚生年金に加入");
    base.admin.health_insurance = "未加入";
    base.admin.pension_insurance = "未加入";
    expect(buildRenrakuhyoValues(base, { company_name: "G" }).insurance).toContain("加入なし");
  });

  it("空欄は空欄のままにし、ファイル名はフリガナ優先でスペースを抜く", () => {
    const empty = initialAdminRecord("EMP-009");
    empty.values = emptyInput();
    empty.admin = emptyAdminInput();
    const values = buildRenrakuhyoValues(empty, { company_name: "" });
    expect(Object.values(values).join("\n")).not.toContain("未入力");
    expect(values.birth).toBe("");
    expect(values.mynumber).toBe("");
    expect(renrakuhyoBaseName(record())).toBe("01【提出用ヨシダヒナ】TLCC様入社連絡表");
    expect(renrakuhyoBaseName(empty)).toBe("01【提出用EMP-009】TLCC様入社連絡表");
  });

  it("交通費は 確定額 →（上限と本人申告の小さいほう）→ 空欄 の順で決める", () => {
    const pass = (fixed: string, cap: string) => {
      const r = record();
      r.values.commute_routes = [{ kind: "電車", from_station: "王寺", to_station: "新大宮", line: "近鉄", pass_monthly: "20,000", fare_oneway: "530" }];
      r.admin.commute_fixed_monthly = fixed;
      r.admin.commute_cap_monthly = cap;
      return buildRenrakuhyoValues(r, { company_name: "G" }).commute_pass;
    };
    expect(pass("18,000", "15,000")).toBe("18,000");   // 確定額があればそれ
    expect(pass("", "15,000")).toBe("15,000");          // 上限のほうが小さい
    expect(pass("", "30,000")).toBe("20,000");          // 本人申告のほうが小さい
    expect(pass("", "")).toBe("");                      // どちらも無ければ空欄
  });

  it("失敗理由は利用者向け日本語だけにする", () => {
    expect(safeRenrakuhyoErrorMessage(500)).toBe("保存先のフォルダに書き込めませんでした。");
    expect(safeRenrakuhyoErrorMessage(500)).not.toMatch(/Drive API|token|scope/i);
  });
});
