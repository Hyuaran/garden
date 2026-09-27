import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const speedIndexes = readFileSync(join(process.cwd(), "supabase", "migrations", "20260928000001_soil_list_speed_indexes.sql"), "utf8");
const tableCounts = readFileSync(join(process.cwd(), "supabase", "migrations", "20260928000002_soil_list_table_count_and_upload_call_summary.sql"), "utf8");

describe("soil list speed/count migrations", () => {
  it("records the production speed indexes", () => {
    expect(speedIndexes).toContain("create index concurrently if not exists soil_list_phone_default_cover_idx");
    expect(speedIndexes).toContain("where \"AU光架電可否\" = '○'");
    expect(speedIndexes).toContain("and \"自社アポ禁\" = false");
    expect(speedIndexes).toContain("create index concurrently if not exists soil_list_phone_last_call_desc_idx");
    expect(speedIndexes).toContain("\"最終コール日_集約\" desc nulls last, \"電話番号\"");
  });

  it("adds table counts and the upload call-summary patch record", () => {
    expect(tableCounts).toContain("create table if not exists public.soil_list_table_count");
    expect(tableCounts).toContain("alter table public.soil_list_table_count enable row level security");
    expect(tableCounts).toContain("grant all on public.soil_list_table_count to service_role");
    expect(tableCounts).toContain("create or replace function public.soil_list_apply_upload");
    expect(tableCounts).toContain("get diagnostics v_parent_inserted = row_count");
    expect(tableCounts).toContain("set \"コール回数合計\" = s.total");
    expect(tableCounts).toContain("join soil_list_upload_new_phone n on n.\"電話番号\" = c.\"電話番号\"");
    expect(tableCounts).toContain("grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role");
  });
});
