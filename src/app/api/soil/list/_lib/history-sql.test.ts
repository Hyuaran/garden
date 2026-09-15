import { describe, expect, it } from "vitest";

import { buildHistorySql, CURRENT_HISTORY_SQL } from "./history-sql";

describe("history SQL", () => {
  it("unions the required history sources and searches mobile numbers too", () => {
    const sql = buildHistorySql();
    expect(sql).toContain("public.soil_list_purchase");
    expect(sql).toContain("public.soil_list_assignment");
    expect(sql).toContain("public.system_call_history");
    expect(sql).toContain("public.soil_list_call");
    expect(sql).toContain("public.soil_list_order");
    expect(sql).toContain("public.system_fm_shineigyo");
    expect(sql).toContain("public.soil_list_internal_block");
    expect(sql).toContain('regexp_replace(coalesce(s."携帯番号"');
    expect(sql).toContain("order by occurred_on desc nulls last, sort_rank asc");
    expect(sql).toContain("limit 501");
  });

  it("loads current ledger values by phone or mobile number", () => {
    expect(CURRENT_HISTORY_SQL).toContain('"電話番号" = $1 or "携帯番号" = $1');
    expect(CURRENT_HISTORY_SQL).toContain('"自社アポ禁"');
  });
});
