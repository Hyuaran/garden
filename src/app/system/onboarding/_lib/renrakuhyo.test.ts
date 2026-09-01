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
  formatWarekiHireDate,
  renrakuhyoBaseName,
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
    });
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
