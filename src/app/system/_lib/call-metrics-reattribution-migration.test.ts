import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260814000002_system_call_metrics_preconfirm_reattribution.sql"),
  "utf8",
);
const verificationSql = readFileSync(
  resolve(process.cwd(), "scripts/call-metrics-preconfirm-reattribution-verify.sql"),
  "utf8",
);

describe("Codex-185 call metrics migration", () => {
  it("attributes preconfirm by sales id without using phone number", () => {
    expect(sql).toContain("candidate.external_sales_id = preconfirm.external_sales_id");
    expect(sql).not.toMatch(/candidate\.phone_number\s*=\s*preconfirm\.phone_number/);
  });

  it("uses deterministic acquisition selection and preserves orphans", () => {
    expect(sql).toContain("candidate.call_date <= preconfirm.call_date");
    expect(sql).toContain("candidate.id desc");
    expect(sql).toContain("nullif(btrim(preconfirm.employee_name), '')");
    expect(sql).toContain("nullif(btrim(preconfirm.list_name), '')");
  });

  it("keeps preconfirm-only employee and list keys with finite zero rates", () => {
    expect(sql).toContain("full outer join preconfirm_by_list");
    expect(sql).toContain("full outer join preconfirm_by_employee");
    expect(sql).toMatch(/coalesce\(round\(preconfirm\.order_count::numeric \/ nullif\(rollup\.call_count, 0\), 6\), 0::numeric\)/);
  });

  it("defines the two required partial concurrent indexes", () => {
    expect(sql.match(/create index concurrently if not exists/g)).toHaveLength(2);
    expect(sql).toContain("where result_flag = '前確OK'");
    expect(sql).toContain("where result_flag = '獲得'");
  });

  it("ships an executable total-preservation check for raw, employee, and list counts", () => {
    expect(verificationSql).toContain("raw_total.count = employee_total.count");
    expect(verificationSql).toContain("raw_total.count = list_total.count");
    expect(verificationSql).toContain("as totals_match");
    expect(verificationSql).toContain("where call_count = 0 and order_count > 0");
  });
});
