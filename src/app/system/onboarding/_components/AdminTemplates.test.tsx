import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdminTemplates from "./AdminTemplates";
import { emptyAdminInput } from "../_lib/onboarding-admin";
import type { AdminTemplate } from "../_lib/onboarding-admin-templates";

const templates: AdminTemplate[] = [
  { id: "nhk", name: "NHK社員", sort_order: 3, updated_at: "now", values: { office: "大阪本社", weekly_hours: "40", base_salary: "260000", allowances: [], commute_cap_monthly: "15000" } },
  { id: "telema", name: "テレマ社員", sort_order: 2, updated_at: "now", values: {} },
];
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => Response.json(init?.method === "PATCH" ? JSON.parse(init.body) : templates)));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("ひな形の適用は入力だけを変え、保存しない。空のひな形は何も変えない", async () => {
  const apply = vi.fn();
  render(<AdminTemplates current={emptyAdminInput()} canWrite isSuperAdmin={false} disabled={false} onApply={apply} />);
  fireEvent.click(await screen.findByRole("button", { name: "テレマ社員" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "NHK社員" }));
  expect(apply).toHaveBeenCalledWith(templates[0].values);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: /ひな形を変更/ })).toBeNull();
});
it("入力済みの値を変える前に確認し、やめると変更しない", async () => {
  const apply = vi.fn();
  render(<AdminTemplates current={{ ...emptyAdminInput(), office: "東京" }} canWrite isSuperAdmin={false} disabled={false} onApply={apply} />);
  fireEvent.click(await screen.findByRole("button", { name: "NHK社員" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "NHK社員" }));
  fireEvent.click(screen.getByRole("button", { name: "ひな形を入れる" }));
  expect(apply).toHaveBeenCalledOnce();
});
it("全権管理者は小窓でひな形の値を変更して保存できる", async () => {
  render(<AdminTemplates current={emptyAdminInput()} canWrite isSuperAdmin disabled={false} onApply={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "テレマ社員のひな形を変更" }));
  fireEvent.change(screen.getByLabelText("所属店舗"), { target: { value: "大阪本社" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetch).toHaveBeenLastCalledWith("/api/system/onboarding/admin-templates", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"office":"大阪本社"') }));
});
it("事務入力の権限がなければひな形を読み込まず操作も表示しない", () => {
  render(<AdminTemplates current={emptyAdminInput()} canWrite={false} isSuperAdmin={false} disabled={false} onApply={vi.fn()} />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).toBeNull();
});
