import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {lineComplete} from "./hire-candidates";
it("requires both confirmation and display name, or an audited skip",()=>{
 expect(lineComplete({line_verified_at:"now"})).toBe(false);
 expect(lineComplete({line_display_renamed_at:"now"})).toBe(false);
 expect(lineComplete({line_verified_at:"now",line_display_renamed_at:"now"})).toBe(true);
 expect(lineComplete({checklist:{line_skipped:{checked_at:"now",checked_by:"admin"}}})).toBe(true);
 expect(lineComplete({checklist:{line_skipped:{checked_at:"",checked_by:"admin"}}})).toBe(false);
});
it("backfills existing verified rows without requiring a new action",()=>{
 const sql=readFileSync("supabase/migrations/20261029000472_hire_line_display_name.sql","utf8");
 expect(sql).toMatch(/add column line_display_renamed_at timestamptz/);
 expect(sql).toMatch(/add column line_display_renamed_by uuid/);
 expect(sql).toMatch(/set line_display_renamed_at = line_verified_at\s+where line_verified_at is not null/);
});
