import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(resolve(process.cwd(), "scripts/system-onboarding-migration.sql"), "utf8");
const rootSchema = readFileSync(resolve(process.cwd(), "scripts/root-schema.sql"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/system/onboarding/onboarding.module.css"), "utf8");
describe("入社手続きの未適用SQLとスタイル", () => {
  it("既存のtext主キーemployee_idに結び、一人一行・空欄可・二つの状態を定義する", () => {
    expect(rootSchema).toMatch(/CREATE TABLE IF NOT EXISTS root_employees\s*\(\s*employee_id\s+text PRIMARY KEY/);
    expect(sql).toContain("employee_id text not null unique references public.root_employees(employee_id)");
    expect(sql).not.toMatch(/root_employees\(id\)|\be\.id\s*=/);
    expect(sql).toContain("('draft', 'submitted')");
    expect(sql).toContain("birth_date date"); expect(sql).toContain("dependents jsonb");
    expect(sql).not.toMatch(/name text not null|pension_number text not null|my_number|myna/);
  });
  it("認証本人・在籍・未削除に限定し、提出済みを変更させない", () => {
    expect(sql).toContain("enable row level security");
    expect(sql.match(/e\.employee_id = system_onboarding.employee_id/g)).toHaveLength(4);
    expect(sql).toContain("e.user_id = auth.uid() and e.is_active and e.deleted_at is null");
    expect(sql).toContain("OLD.status = 'submitted'");
    expect(sql).toContain("revoke all on public.system_onboarding from anon, authenticated");
    expect(sql).not.toMatch(/grant .*delete/i);
  });
  it("個人情報の任意追加キーをJSONにも認めず、日時をDB側でも決める", () => {
    expect(sql).toContain("entry.key not in ('name','name_kana','relation','birth_date','annual_income','occupation')");
    expect(sql).toContain("NEW.updated_at := now()"); expect(sql).toContain("NEW.submitted_at := case");
  });
  it("固定背景・ダーク色・小幅対応・黄色の注意を定義する", () => {
    expect(css).toContain('.pageShell::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--bg)}');
    expect(css).toContain("--bg:#f4f5f7"); expect(css).toContain("--bg:#0c1726");
    expect(css).toContain("--warning-bg:#fff3cd"); expect(css).toContain("--warning-bg:#302918");
    expect(css).toContain("@media(max-width:640px)"); expect(css).toContain("grid-template-columns:minmax(0,1fr)");
  });
});
