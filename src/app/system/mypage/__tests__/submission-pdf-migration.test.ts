import {readFileSync} from "node:fs";import {join} from "node:path";import {describe,expect,it} from "vitest";
const sql=readFileSync(join(process.cwd(),"supabase/migrations/20260827000001_mypage_submission_pdfs.sql"),"utf8");
describe("submission PDF migration",()=>{it("adds Drive metadata and constrained PDF states",()=>{for(const column of ["pdf_drive_file_id","pdf_drive_url","pdf_status","pdf_note"])expect(sql).toContain(column);for(const state of ["not_applicable","generated","skipped","failed"])expect(sql).toContain(`'${state}'`)})});
