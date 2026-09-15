import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260917000001_soil_list_internal_block.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("internal block migration", () => {
  it("adds the internal block history table with RLS and indexes", () => {
    expect(sql).toContain("create table if not exists public.soil_list_internal_block");
    expect(sql).toContain('"電話番号" text not null');
    expect(sql).toContain('"理由" text not null');
    expect(sql).toContain('"解除日" date');
    expect(sql).toContain("alter table public.soil_list_internal_block enable row level security");
    expect(sql).toContain("soil_list_internal_block_phone_idx");
    expect(sql).toContain("soil_list_internal_block_active_phone_idx");
    expect(sql).toContain("grant all on table public.soil_list_internal_block to service_role");
  });

  it("adds the phone ledger flag and export excluded count without changing AU availability", () => {
    expect(sql).toContain('add column if not exists "自社アポ禁" boolean not null default false');
    expect(sql).toContain("soil_list_phone_internal_block_idx");
    expect(sql).toContain("add column if not exists excluded_internal_block integer not null default 0");
    expect(sql).not.toContain('"AU光架電可否" =');
  });

  it("syncs new phone rows from active internal block history", () => {
    expect(sql).toContain("soil_list_internal_block_active");
    expect(sql).toContain("soil_list_phone_set_internal_block");
    expect(sql).toContain("before insert or update of \"電話番号\" on public.soil_list_phone");
  });
});
