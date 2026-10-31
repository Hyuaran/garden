import { describe, expect, it } from "vitest";
import { resolveCanView, type ViewPermission, type Viewer } from "./view-permission";
const viewer: Viewer = {employeeId:"EMP-1",role:"staff"};
const page = "system-onboarding";
const setting = (tab_key: string, roles: string[] = [], employee_ids: string[] = []): ViewPermission => ({page_key:page,tab_key,roles,employee_ids,viewers_can_add:false,updated_by:"admin",updated_at:"2026-10-26T00:00:00Z"});

it.each(["toss", "closer", "cs", "outsource"] as const)("keeps operation readable for %s despite legacy restrictions", role => {
  const rows = [{ ...setting(""), page_key: "system-manuals" }, { ...setting("operation"), page_key: "system-manuals" }];
  expect(resolveCanView(rows, "system-manuals", "operation", { ...viewer, role }, false)).toBe(true);
  expect(resolveCanView(rows, "system-manuals", "", { ...viewer, role }, false)).toBe(true);
  expect(resolveCanView(rows, "system-manuals", "summary", { ...viewer, role })).toBe(false);
});
describe("画面とタブの閲覧設定", () => {
  it("設定が無ければ登録済みの既定に従う", () => {
    expect(resolveCanView([],page,"self",viewer)).toBe(true);
    expect(resolveCanView([],page,"all",viewer)).toBe(false);
    expect(resolveCanView([],page,"all",{...viewer,role:"manager"})).toBe(true);
    expect(resolveCanView([],page,"candidates",{...viewer,role:"manager"})).toBe(false);
  });
  it("役職で閲覧を広げ、狭められる", () => {
    expect(resolveCanView([setting("all",["staff"])],page,"all",viewer)).toBe(true);
    expect(resolveCanView([setting("self")],page,"self",viewer)).toBe(false);
  });
  it("個人は役職と足し合わせる", () => {
    expect(resolveCanView([setting("all",[],["EMP-1"])],page,"all",viewer)).toBe(true);
    expect(resolveCanView([setting("all",[],["EMP-2"])],page,"all",viewer)).toBe(false);
  });
  it("タブ→画面→既定の順で空の設定も尊重する", () => {
    expect(resolveCanView([setting("",["staff"])],page,"all",viewer)).toBe(true);
    expect(resolveCanView([setting("",["staff"]),setting("all")],page,"all",viewer)).toBe(false);
    expect(resolveCanView([setting("all")],page,"self",viewer)).toBe(true);
  });
  it("全権管理者は常に閲覧でき、未知の対象はほかの人には拒否する", () => {
    expect(resolveCanView([setting("all")],page,"all",{...viewer,role:"super_admin"})).toBe(true);
    expect(resolveCanView([],"unknown","",viewer)).toBe(false);
  });
});
