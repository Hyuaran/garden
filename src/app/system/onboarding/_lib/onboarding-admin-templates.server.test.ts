import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./onboarding-admin.server", () => ({ onboardingAdminContext: mocks.context }));
vi.mock("./onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { readAdminTemplates, saveAdminTemplate } from "./onboarding-admin-templates.server";
beforeEach(() => { mocks.from.mockReset(); mocks.context.mockReset().mockResolvedValue({ sensitive: false, canWrite: false, supabase: { from: mocks.from } }); });
it("ひな形の変更は事務権限だけでは許可しない", async () => {
  await expect(saveAdminTemplate({})).rejects.toMatchObject({ status: 403 });
  expect(mocks.context).toHaveBeenCalledWith();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("ひな形の読み込みも事務入力の権限を確認する", async () => {
  await expect(readAdminTemplates()).rejects.toMatchObject({ status: 403 });
  expect(mocks.context).toHaveBeenCalledWith(true);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("全権管理者は最終更新が一致するひな形だけを保存する", async () => {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  const input = { id: "11111111-1111-4111-8111-111111111111", name: "NHK社員", sort_order: 3, updated_at: "2026-11-12T00:00:00Z", values: { office: "大阪本社" } };
  query.maybeSingle.mockResolvedValue({ data: input, error: null });
  mocks.context.mockResolvedValue({ sensitive: true, supabase: { from: mocks.from } });
  mocks.from.mockReturnValue(query);
  await expect(saveAdminTemplate(input)).resolves.toEqual(input);
  expect(query.eq).toHaveBeenCalledWith("updated_at", input.updated_at);
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ values: { office: "大阪本社" }, name: "NHK社員", sort_order: 3 }));
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(saveAdminTemplate(input)).rejects.toMatchObject({ status: 409 });
});
