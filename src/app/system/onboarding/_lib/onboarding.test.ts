import { describe, expect, it } from "vitest";
import { emptyInput, formatWarnings, initialInput, parseInput, STEPS } from "./onboarding";

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
  it("社員ID・状態・日時・個人番号などの未定義キーを保存対象から落とす", () => {
    const result = parseInput({ employee_id: "other", status: "submitted", nda_agreed_at: "fake", my_number: "123456789012", dependents: [{ name: "家族", my_number: "secret" }] });
    expect(JSON.stringify(result)).not.toMatch(/other|submitted|fake|123456789012|secret|my_number/);
    expect(result.dependents[0].name).toBe("家族");
    expect(result.nda_agreed).toBe(false);
  });
  it("任意オブジェクトや巨大な入力は拒否する", () => {
    expect(() => parseInput({ name: {} })).toThrow();
    expect(() => parseInput({ name: "a".repeat(2001) })).toThrow();
    expect(() => parseInput({ dependents: [null] })).toThrow();
    expect(() => parseInput({ dependents: new Array(31).fill({}) })).toThrow();
  });
  it("画面の順番は指定の8テーマ", () => {
    expect(STEPS).toEqual(["あなたのこと", "住所と連絡先", "ご家族", "年金と雇用保険", "直近の勤務先", "緊急連絡先", "秘密保持の確認", "確認"]);
  });
});
