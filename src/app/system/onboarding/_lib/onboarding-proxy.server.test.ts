import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { decryptMyNumber } from '@/lib/my-number/crypto.server';
afterEach(()=>vi.unstubAllEnvs());
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), canView: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/auth/view-permission.server", () => ({ viewPermissionContext: mocks.viewer, canView: mocks.canView }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
import { onboardingProxyContext, readProxyOnboarding, saveProxyOnboarding } from "./onboarding-proxy.server";
import { readAdminOnboardingDetail, readAdminOnboardingDetailForFuyou, readMyNumberForAdmin, type AdminContext } from "./onboarding-admin.server";
import { emptyDependent, emptyInput } from "./onboarding";
import { proxyPayload } from "./onboarding-proxy";

function query(data: unknown) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then(resolve: (value: unknown) => void) { return Promise.resolve({ data: [data], error: null }).then(resolve); } };
}
const employee = { employee_id: "EMP-1", name: "後道 愛美", name_kana: "ウシロミチ マナミ", birthday: null };
let row: ReturnType<typeof query>;
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));
  row = query(null);
  rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.viewer.mockResolvedValue({ name: "東海林 美琴", viewer: { employeeId: "EMP-M", role: "manager" } });
  mocks.canView.mockResolvedValue(true);
  mocks.admin.mockReturnValue({ from: (table: string) => table === "root_employees" ? query(employee) : table === 'my_number_viewers' ? query(null) : row, rpc });
});
it("責任者は閲覧設定で許可されれば代行でき、トスも含め不許可なら管理者接続前に拒否", async () => {
  const context = await onboardingProxyContext("EMP-1");
  expect(context.sensitive).toBe(false);
  expect(mocks.canView).toHaveBeenCalledWith("system-onboarding", "all", { employeeId: "EMP-M", role: "manager" });
  mocks.viewer.mockResolvedValue({ name: "トス", viewer: { employeeId: "EMP-T", role: "toss" } });
  mocks.canView.mockResolvedValue(false);
  mocks.admin.mockClear();
  await expect(onboardingProxyContext("EMP-1")).rejects.toMatchObject({ status: 403 });
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("責任者には口座・本人と扶養家族の番号をマスクも含め返さない", async () => {
  row = query({ ...emptyInput(), bank_name: "秘密銀行", account_number: "7654321", my_number: "123456789012",
    dependents: [{ ...emptyDependent(), name: "家族", my_number: "111122223333" }] });
  const context = await onboardingProxyContext("EMP-1");
  const record = await readProxyOnboarding(context);
  expect(JSON.stringify(record)).not.toMatch(/秘密銀行|7654321|9012|3333|••••/);
  expect(row.select.mock.calls[0][0]).not.toMatch(/bank_name|account_number|my_number/);
  expect(record.values.dependents[0].name).toBe("家族");
});
it.each([
  { bank_name: "" }, { account_number: "" }, { my_number: "" },
  { dependents: [{ name: "家族", my_number: "" }] },
])("責任者が機微項目を空文字でも送ると403: %j", async privateValues => {
  const context = await onboardingProxyContext("EMP-1");
  await expect(saveProxyOnboarding(context, { ...proxyPayload(emptyInput(), false), ...privateValues }, false, 0)).rejects.toMatchObject({ status: 403 });
  expect(rpc).not.toHaveBeenCalled();
});
it("責任者の保存は機微列を送らず、対象・操作者・画面・提出を監査付きRPCへ渡す", async () => {
  const context = await onboardingProxyContext("EMP-1");
  await saveProxyOnboarding(context, proxyPayload(emptyInput(), false), true, 10);
  expect(rpc).toHaveBeenCalledWith("save_onboarding_proxy", expect.objectContaining({
    p_employee_id: "EMP-1", p_actor: "EMP-M", p_actor_name: "東海林 美琴", p_step: 10, p_submit: true, p_sensitive: false,
  }));
  expect(rpc.mock.calls[0][1].p_values).not.toHaveProperty("my_number");
  const sql = readFileSync("supabase/migrations/20261026000003_system_onboarding_proxy.sql", "utf8");
  expect(sql).toContain("for update");
  expect(sql).toContain("insert into public.system_onboarding_proxy_log");
  expect(sql).toContain("代行で提出（入力：");
  expect(sql).toContain("from public, anon, authenticated");
  expect(sql).toContain("drop policy if exists system_onboarding_manager_select");
});
it("super_adminは口座とマイナンバーを代行保存できる", async () => {
  mocks.viewer.mockResolvedValue({ name: "全権", viewer: { employeeId: "EMP-S", role: "super_admin" } });
  const context = await onboardingProxyContext("EMP-1");
  await saveProxyOnboarding(context, { ...emptyInput(), bank_name: "銀行", my_number: "123456789012" }, false, 7);
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_sensitive: true, p_values: { bank_name: "銀行", my_number: "••••••••9012" } });
  expect(decryptMyNumber(rpc.mock.calls[0][1].p_values.my_number_secret)).toBe('123456789012');
  expect(JSON.stringify(rpc.mock.calls)).not.toContain('123456789012');
});
it("提出済みの読み出しと、保存時の競合は409", async () => {
  row = query({ status: "submitted" });
  const context = await onboardingProxyContext("EMP-1");
  await expect(readProxyOnboarding(context)).rejects.toMatchObject({ status: 409 });
  rpc.mockResolvedValue({ error: { code: "P0001" } });
  await expect(saveProxyOnboarding(context, proxyPayload(emptyInput(), false), false, 0)).rejects.toMatchObject({ status: 409 });
});
it.each([6, 7])("責任者は機微項目を省いても機微画面%sから保存できない", async step => {
  const context = await onboardingProxyContext("EMP-1");
  await expect(saveProxyOnboarding(context, proxyPayload(emptyInput(), false), false, step)).rejects.toMatchObject({ status: 403 });
  expect(rpc).not.toHaveBeenCalled();
});
it("全権の読み出し中に提出された場合も代行を開始しない", async () => {
  mocks.viewer.mockResolvedValue({ name: "全権", viewer: { employeeId: "EMP-S", role: "super_admin" } });
  row.maybeSingle.mockResolvedValueOnce({ data: { status: "draft" }, error: null })
    .mockResolvedValueOnce({ data: { ...emptyInput(), status: "submitted" }, error: null });
  await expect(readProxyOnboarding(await onboardingProxyContext("EMP-1"))).rejects.toMatchObject({ status: 409 });
});
it("既存の事務詳細・全桁表示・機微情報付き書類経由でも責任者に漏らさない", async () => {
  row = query({ ...emptyInput(), employee_id: "EMP-1", bank_name: "秘密銀行", my_number: "123456789012" });
  const proxy = await onboardingProxyContext("EMP-1");
  const context = { supabase: proxy.supabase, managerEmployeeId: "EMP-M", sensitive: false } as AdminContext;
  const record = await readAdminOnboardingDetail(context, "EMP-1");
  expect(JSON.stringify(record)).not.toMatch(/秘密銀行|9012|••••/);
  await expect(readMyNumberForAdmin(context, "EMP-1", { kind: "self" })).rejects.toMatchObject({ status: 404 });
  await expect(readAdminOnboardingDetailForFuyou(context, "EMP-1")).rejects.toMatchObject({ status: 403 });
});
