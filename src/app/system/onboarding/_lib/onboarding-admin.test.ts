import { describe, expect, it } from "vitest";
import { emptyInput } from "./onboarding";
import { adminInputFromRow, buildAdminList, missingOnboardingItems, parseAdminEmailInput, parseAdminInput } from "./onboarding-admin";

describe("入社手続きの事務画面", () => {
  it("事務入力は許可した列だけを読み取り、手当は6組までにする", () => {
    const input = parseAdminInput({
      office: " 本社 ",
      weekly_hours: "40",
      health_insurance: "加入",
      pension_insurance: "加入",
      employment_insurance: "未加入",
      tax_class: "甲",
      salary_kind: "月給",
      base_salary: "200000",
      allowances: [{ name: "扶養", amount: "10000" }],
      commute_fixed_monthly: "15345",
      commute_cap_monthly: "20000",
      ignored: "drop",
    });
    expect(input).toMatchObject({ office: "本社", health_insurance: "加入", tax_class: "甲", salary_kind: "月給" });
    expect(input.allowances).toEqual([{ name: "扶養", amount: "10000" }]);
    expect(() => parseAdminInput({ allowances: new Array(7).fill({ name: "", amount: "" }) })).toThrow();
    expect(() => parseAdminInput({ allowances: [{ name: "", amount: "", extra: "" }] })).toThrow();
  });

  it("事務のメール保存はメールアドレスだけを読み取り、空欄も許容する", () => {
    expect(parseAdminEmailInput({ email: " hy@example.jp ", name: "変えない", address: "変えない" })).toEqual({ email: "hy@example.jp" });
    expect(parseAdminEmailInput({ email: "" })).toEqual({ email: "" });
    expect(() => parseAdminEmailInput({ email: "a".repeat(2001) })).toThrow();
  });

  it("本人申告の定期代合計を交通費確定額の初期値にする", () => {
    const values = emptyInput();
    values.commute_routes = [
      { kind: "電車", from_station: "新大宮", to_station: "本町", line: "近鉄", pass_monthly: "12345", fare_oneway: "" },
      { kind: "バス", from_station: "本町", to_station: "店舗", line: "市バス", pass_monthly: "3000", fare_oneway: "" },
    ];
    expect(adminInputFromRow({}, values).commute_fixed_monthly).toBe("15345");
    expect(adminInputFromRow({ admin_updated_at: "2026-08-31T00:00:00Z" }, values).commute_fixed_monthly).toBe("");
  });

  it("未入力の項目名と件数を同じ基準で作る", () => {
    const values = emptyInput();
    values.name = "吉田 陽菜";
    values.employment_insurance_status = "no";
    values.emergency_relation = "母";
    values.nda_agreed = true;
    const missing = missingOnboardingItems(values);
    expect(missing).toContain("性別");
    expect(missing).toContain("基礎年金番号");
    expect(missing).toContain("緊急連絡先の電話番号");
    expect(missing).not.toContain("雇用保険被保険者番号");
    expect(missing).not.toContain("続柄（その他）");
  });

  it("一覧は提出日の新しい順にし、事務入力済みを判定する", () => {
    const values = emptyInput();
    values.name = "吉田 陽菜";
    const rows = buildAdminList([
      { employee: { employee_id: "EMP-2", name: "小谷 庵", hire_date: "2026-07-01", birthday: null, company_id: null }, values: emptyInput(), status: "draft", submittedAt: null, admin: parseAdminInput({}), adminUpdatedAt: null },
      { employee: { employee_id: "EMP-1", name: null, hire_date: "2026-09-01", birthday: null, company_id: null }, values, status: "submitted", submittedAt: "2026-08-31T00:00:00Z", admin: parseAdminInput({ health_insurance: "加入", pension_insurance: "加入", employment_insurance: "加入", tax_class: "甲", salary_kind: "月給", base_salary: "200000" }), adminUpdatedAt: null },
    ]);
    expect(rows.map(row => row.name)).toEqual(["吉田 陽菜", "小谷 庵"]);
    expect(rows[0].adminComplete).toBe(true);
    expect(rows[1].adminComplete).toBe(false);
  });
});
