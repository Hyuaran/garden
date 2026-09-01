import { describe, expect, it } from "vitest";
import { commuteTotals, dependentMyNumberWarning, displayDependentValue, emptyInput, formatWarnings, initialInput, maskMyNumber, parseInput, parseNullableAmount, STEPS } from "./onboarding";

describe("入社手続きの入力", () => {
  it("実DBのbirthdayから初期値をつくる", () => {
    expect(initialInput({ name: "検証 太郎", name_kana: "ケンショウ タロウ", birthday: "2000-01-02" })).toMatchObject({ name: "検証 太郎", name_kana: "ケンショウ タロウ", birth_date: "2000-01-02" });
  });
  it("空欄はすべて許容し、注意も出さない", () => {
    expect(parseInput({})).toEqual(emptyInput());
    expect(formatWarnings(emptyInput())).toEqual({});
  });
  it("桁数と電話の形式は注意だけで、保存値を消さない", () => {
    const values = parseInput({ postal_code: "123", pension_number: "●", employment_insurance_status: "yes", employment_insurance_number: "0", phone: "abc", emergency_phone: "０９０" });
    expect(Object.keys(formatWarnings(values))).toHaveLength(5);
    expect(values.postal_code).toBe("123");
    expect(Object.values(formatWarnings(values)).join()).toContain("このまま進めます");
  });
  it("正しい形式と、なしの場合の保険番号には注意しない", () => {
    expect(formatWarnings(parseInput({ postal_code: "5410054", pension_number: "1234567890", employment_insurance_status: "yes", employment_insurance_number: "12345678901", phone: "090-1234-5678" }))).toEqual({});
    expect(formatWarnings(parseInput({ employment_insurance_status: "no", employment_insurance_number: "short" }))).toEqual({});
  });
  it("メールアドレスは空欄で進められ、明らかな形式違いだけ注意する", () => {
    expect(formatWarnings(parseInput({ email: "" })).email).toBeUndefined();
    expect(formatWarnings(parseInput({ email: "hy@example.jp" })).email).toBeUndefined();
    expect(formatWarnings(parseInput({ email: "hy.example.jp" })).email).toBe("メールアドレスの形になっていません");
    expect(formatWarnings(parseInput({ email: "hy@@example.jp" })).email).toBe("メールアドレスの形になっていません");
    expect(formatWarnings(parseInput({ email: "hy @example.jp" })).email).toBe("メールアドレスの形になっていません");
  });
  it("金額はカンマ・全角数字・空白・単位を除いて計算し、数字がなければ空扱いにする", () => {
    const routes = [
      { kind: "電車", from_station: "", to_station: "", line: "", pass_monthly: "20,000", fare_oneway: "２００００" },
      { kind: "バス", from_station: "", to_station: "", line: "", pass_monthly: "20 000", fare_oneway: "20,000円" },
      { kind: "徒歩", from_station: "", to_station: "", line: "", pass_monthly: "", fare_oneway: "abc" },
    ];
    expect(commuteTotals(routes)).toMatchObject({ passMonthly: 40000, fareOneway: 40000 });
    expect(parseNullableAmount("20,000")).toBe(20000);
    expect(parseNullableAmount("２００００")).toBe(20000);
    expect(parseNullableAmount("20 000")).toBe(20000);
    expect(parseNullableAmount("20,000円")).toBe(20000);
    expect(parseNullableAmount("")).toBeNull();
    expect(parseNullableAmount("abc")).toBeNull();
  });
  it("社員ID・状態・日時や未定義キーを保存対象から落とし、扶養家族のマイナンバーは保存対象にする", () => {
    const result = parseInput({ employee_id: "other", status: "submitted", nda_agreed_at: "fake", my_number: "123456789012", dependents: [{ name: "家族", my_number: "123456789012", extra: "drop" }], commute_routes: [{ kind: "電車", from_station: "新大宮", extra: "drop" }] });
    expect(JSON.stringify(result.dependents)).not.toMatch(/extra|drop/);
    expect(JSON.stringify(result.commute_routes)).not.toMatch(/extra|drop/);
    expect(result).not.toHaveProperty("employee_id");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("nda_agreed_at");
    expect(result.my_number).toBe("123456789012");
    expect(result.dependents[0].name).toBe("家族");
    expect(result.dependents[0].my_number).toBe("123456789012");
    expect(result.commute_routes[0]).toMatchObject({ kind: "電車", from_station: "新大宮", to_station: "", line: "", pass_monthly: "", fare_oneway: "" });
    expect(result.nda_agreed).toBe(false);
  });
  it("任意オブジェクトや巨大な入力は拒否する", () => {
    expect(() => parseInput({ name: {} })).toThrow();
    expect(() => parseInput({ name: "a".repeat(2001) })).toThrow();
    expect(() => parseInput({ dependents: [null] })).toThrow();
    expect(() => parseInput({ dependents: new Array(31).fill({}) })).toThrow();
    expect(() => parseInput({ commute_routes: [null] })).toThrow();
    expect(() => parseInput({ commute_routes: new Array(11).fill({}) })).toThrow();
  });
  it("画面の順番は指定の11テーマ", () => {
    expect(STEPS).toEqual(["あなたのこと", "住所と連絡先", "ご家族", "年金と雇用保険", "直近の勤務先", "通勤と交通費", "給与の受取口座", "マイナンバー", "緊急連絡先", "秘密保持の確認", "確認"]);
    expect(parseInput({}).email).toBe("");
  });
  it("マイナンバーは表示用に下4桁だけへ変換し、形式注意は止めない", () => {
    expect(maskMyNumber("123456789012")).toBe("••••••••9012");
    expect(maskMyNumber("12")).toBe("");
    expect(formatWarnings(parseInput({ my_number: "12", bank_code: "1", branch_code: "12", account_number: "abcdefghi", account_holder_kana: "ABC" })).my_number).toContain("12桁");
    expect(displayDependentValue("my_number", "111122223333")).toBe("••••••••3333");
    expect(dependentMyNumberWarning("12")).toContain("12桁");
    expect(dependentMyNumberWarning("")).toBe("");
    expect(dependentMyNumberWarning("••••••••3333")).toBe("");
  });
});
