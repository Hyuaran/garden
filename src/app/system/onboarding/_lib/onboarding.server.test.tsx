import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ refresh: vi.fn() }) }));
import { databaseError, needsOnboarding, onboardingEmployee, readOnboarding, saveOnboarding } from "./onboarding.server";
import { emptyInput, PREPARING_MESSAGE } from "./onboarding";
import OnboardingPage from "../page";

function fixture() {
  const employee = { employee_id: "EMP-9999", name: "検証 太郎", name_kana: "ケンショウ タロウ", birthday: "2000-01-02" };
  const employeeQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
  employeeQuery.maybeSingle.mockImplementation(async () => {
    const columns = String(employeeQuery.select.mock.lastCall?.[0] ?? "").split(",");
    const missing = columns.find(column => !Object.hasOwn(employee, column.trim()));
    return missing ? { data: null, error: { code: "42703", message: `column root_employees.${missing} does not exist` } } : { data: employee, error: null };
  });
  const saved = { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { status: "draft", nda_agreed_at: null, submitted_at: null }, error: null }) };
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), upsert: vi.fn().mockReturnValue(saved) };
  const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "U1" } }, error: null }) }, from: vi.fn((table: string) => table === "root_employees" ? employeeQuery : query) };
  mocks.createServerClient.mockResolvedValue(supabase);
  return { supabase, employee, employeeQuery, query, saved };
}

describe("入社手続きの本人専用保存", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });
  it("存在しないidのSELECTが42703になるDBでも、employee_idで本人を取得できる", async () => {
    const f = fixture();
    const invalid = await f.supabase.from("root_employees").select("id,name,name_kana,birthday").maybeSingle();
    expect(invalid).toEqual({ data: null, error: { code: "42703", message: "column root_employees.id does not exist" } });
    const context = await onboardingEmployee();
    expect(context.employee.employee_id).toBe("EMP-9999");
    expect(context.employee).not.toHaveProperty("id");
    expect(f.employeeQuery.select).toHaveBeenLastCalledWith("employee_id,name,name_kana,birthday");
    await readOnboarding(context);
    expect(f.query.eq).toHaveBeenCalledWith("employee_id", "EMP-9999");
  });
  it.each([undefined, 9999, ""])("不正な従業員キー%sでは保存先を照会しない", async employeeId => {
    const f = fixture(); f.employeeQuery.maybeSingle.mockResolvedValue({ data: { ...f.employee, employee_id: employeeId }, error: null });
    await expect(onboardingEmployee()).rejects.toMatchObject({ status: 401 });
    expect(f.query.eq).not.toHaveBeenCalled();
    expect(f.query.upsert).not.toHaveBeenCalled();
  });
  it("未認証では従業員照会も保存も行わない", async () => {
    const f = fixture(); f.supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(OnboardingPage()).rejects.toThrow("redirect:/login?returnTo=%2Fsystem%2Fonboarding");
    expect(f.supabase.from).not.toHaveBeenCalled();
  });
  it("本人の在籍・未削除を確認し、非在籍者を拒否する", async () => {
    const f = fixture(); f.employeeQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(onboardingEmployee()).rejects.toMatchObject({ status: 401 });
    expect(f.employeeQuery.eq).toHaveBeenCalledWith("user_id", "U1");
    expect(f.employeeQuery.eq).toHaveBeenCalledWith("is_active", true);
    expect(f.employeeQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(f.query.upsert).not.toHaveBeenCalled();
  });
  it("未保存時はbirthdayを初期値とし、GET相当処理で行を作らない", async () => {
    const f = fixture(); const result = await readOnboarding(await onboardingEmployee());
    expect(result.values).toMatchObject({ name: f.employee.name, name_kana: f.employee.name_kana, birth_date: "2000-01-02" });
    expect(f.query.eq).toHaveBeenCalledWith("employee_id", f.employee.employee_id);
    expect(f.query.upsert).not.toHaveBeenCalled();
    expect(f.query.select.mock.calls[0][0]).not.toBe("*");
  });
  it("保存した空欄を初期値で埋め戻さない", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: { name: "", name_kana: "", birth_date: null, status: "draft" }, error: null });
    const result = await readOnboarding(await onboardingEmployee());
    expect(result.values.name).toBe(""); expect(result.values.birth_date).toBe("");
  });
  it("保存済みマイナンバーは読み出し時に下4桁だけ返す", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: { my_number: "123456789012", dependents: [{ name: "家族", my_number: "111122223333" }], status: "draft" }, error: null });
    const result = await readOnboarding(await onboardingEmployee());
    expect(result.values.my_number).toBe("••••••••9012");
    expect(result.values.dependents[0].my_number).toBe("••••••••3333");
    expect(JSON.stringify(result)).not.toMatch(/123456789012|111122223333/);
  });
  it("扶養家族のマスク済みマイナンバーは保存時に既存値を維持し、入れ直した行だけ更新する", async () => {
    const f = fixture();
    f.query.maybeSingle.mockResolvedValue({
      data: {
        status: "draft",
        dependents: [
          { name: "一人目", name_kana: "", my_number: "111122223333", relation: "子", birth_date: "", annual_income: "", occupation: "" },
          { name: "二人目", name_kana: "", my_number: "444455556666", relation: "子", birth_date: "", annual_income: "", occupation: "" },
        ],
      },
      error: null,
    });
    const input = emptyInput();
    input.dependents = [
      { name: "一人目", name_kana: "", my_number: "••••••••3333", relation: "子", birth_date: "", annual_income: "", occupation: "" },
      { name: "二人目", name_kana: "", my_number: "777788889999", relation: "子", birth_date: "", annual_income: "", occupation: "" },
    ];
    await saveOnboarding(await onboardingEmployee(), input, false);
    expect(f.query.upsert.mock.calls[0][0].dependents).toEqual([
      { name: "一人目", name_kana: "", my_number: "111122223333", relation: "子", birth_date: "", annual_income: "", occupation: "" },
      { name: "二人目", name_kana: "", my_number: "777788889999", relation: "子", birth_date: "", annual_income: "", occupation: "" },
    ]);
  });
  it("認証と読み取り成功後に初期値入りフォームを描画する", async () => {
    fixture();
    render(await OnboardingPage());
    expect(screen.getByLabelText("氏名")).toHaveValue("検証 太郎");
    expect(screen.getByLabelText("生年月日")).toHaveValue("2000-01-02");
    expect(screen.getByRole("heading", { level: 1, name: "入社手続き" })).toBeInTheDocument();
  });
  it("型の注意があっても空欄でも保存でき、ユーザー指定IDを使わない", async () => {
    const f = fixture(); await saveOnboarding(await onboardingEmployee(), { ...emptyInput(), postal_code: "123", employee_id: "other", my_number: "123456789012" }, false);
    const [payload, options] = f.query.upsert.mock.calls[0];
    expect(payload).toMatchObject({ employee_id: f.employee.employee_id, postal_code: "123", my_number: "123456789012", birth_date: null, previous_employer_from: null, previous_employer_to: null, status: "draft", nda_agreed_at: null, submitted_at: null });
    expect(payload).not.toHaveProperty("nda_agreed");
    expect(options).toEqual({ onConflict: "employee_id" });
    expect(f.supabase.from.mock.calls.every(([name]) => ["root_employees", "system_onboarding"].includes(name))).toBe(true);
  });
  it("空欄・同意未チェックのまま提出し、サーバーで提出時刻をつける", async () => {
    const f = fixture(); await saveOnboarding(await onboardingEmployee(), emptyInput(), true);
    expect(f.query.upsert.mock.calls[0][0]).toMatchObject({ status: "submitted", nda_agreed_at: null });
    expect(f.query.upsert.mock.calls[0][0].submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("同意時刻はサーバーが付け、既存の同意時刻は維持する", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: { status: "draft", nda_agreed_at: "2026-08-31T00:00:00Z" }, error: null });
    await saveOnboarding(await onboardingEmployee(), { ...emptyInput(), nda_agreed: true, nda_agreed_at: "fake" }, false);
    expect(f.query.upsert.mock.calls[0][0].nda_agreed_at).toBe("2026-08-31T00:00:00Z");
  });
  it("提出済みは再提出や編集で上書きしない", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: { status: "submitted", name: "提出時の名前", submitted_at: "2026-08-31T00:00:00Z" }, error: null });
    const result = await saveOnboarding(await onboardingEmployee(), { ...emptyInput(), name: "別名" }, true);
    expect(result.status).toBe("submitted"); expect(result.values.name).toBe("提出時の名前"); expect(f.query.upsert).not.toHaveBeenCalled();
  });
  it("テーブルが無ければ初期値や内部エラーを応答に含めず日本語の案内を表示する", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST205", message: "schema cache detail" } });
    const { container } = render(await OnboardingPage());
    expect(screen.getByText(PREPARING_MESSAGE)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/schema|PGRST|migration|RPC|検証 太郎/);
    expect(container.querySelector("input")).toBeNull(); expect(f.query.upsert).not.toHaveBeenCalled();
  });
  it("書き込み時のテーブル未作成も指定の日本語にする", async () => {
    const f = fixture(); f.saved.single.mockResolvedValue({ data: null, error: { code: "PGRST205" } });
    await expect(saveOnboarding(await onboardingEmployee(), emptyInput(), false)).rejects.toThrow(PREPARING_MESSAGE);
    expect(databaseError({ code: "42P01" }).message).toBe(PREPARING_MESSAGE);
  });
  it("一般の保存失敗は生のDBメッセージを返さない", async () => {
    const f = fixture(); f.saved.single.mockResolvedValue({ data: null, error: { code: "42501", message: "secret details" } });
    await expect(saveOnboarding(await onboardingEmployee(), emptyInput(), false)).rejects.toThrow("保存できませんでした");
  });
  it.each([null, "draft", "submitted"])("ホーム案内は%sに応じて切り替わる", async status => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: status ? { status } : null, error: null });
    expect(await needsOnboarding((await onboardingEmployee()).supabase, f.employee.employee_id)).toBe(status !== "submitted");
  });
  it("未作成時にもホームの入口を維持する", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST205" } });
    expect(await needsOnboarding((await onboardingEmployee()).supabase, f.employee.employee_id)).toBe(true);
  });
});
