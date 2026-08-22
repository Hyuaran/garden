import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const sql=readFileSync(path.join(process.cwd(),"supabase/migrations/20260822000001_system_zenkaku_check_requests.sql"),"utf8");
describe("zenkaku request migration",()=>{
  it("allows only owner or manager reads and has no raw master columns",()=>{expect(sql).toContain("requested_by = auth.uid()");expect(sql).toContain("has_role_at_least('manager')");expect(sql).not.toMatch(/\n\s+(customer_name|address|phone_number)\s+/);});
  it("atomically claims with skip locked and expires reading after 60 seconds",()=>{expect(sql).toContain("for update skip locked");expect(sql).toContain("interval '60 seconds'");expect(sql).toContain("grant execute on function public.system_zenkaku_claim_next() to service_role");});
});
