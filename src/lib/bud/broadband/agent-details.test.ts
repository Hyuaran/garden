import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importAgentFolder } from "./agent-details";
it("imports separate tax, inclusive tax, zero tax, review, revised files and duplicates",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"bb-agent-"));
 try {
  const write=async(name:string,tax:string|number,amount:number,detail=false,folder=dir)=>{
   const b=new ExcelJS.Workbook(),s=b.addWorksheet("表紙");s.addRow(["(1) 関西電力",amount]);s.addRow(["消費税",tax]);
   if(detail) {const d=b.addWorksheet("関電2026");d.addRow(["コミッション","消費税"]);d.addRow([1000,100]);d.addRow(["合計",1100]);}
   await b.xlsx.writeFile(join(folder,name));
  };
  await mkdir(join(dir,"copy"));
  await write("御支払明細20260430【別途様】_HR.xlsx",100,1000);
  await write("御支払明細20260430【別途様】_HR.xlsx",100,1000,false,join(dir,"copy"));
  await write("御支払明細20260430【別途様】_HR【修正版】.xlsx",200,2000);
  await write("御支払明細20260430【内税様】_HR.xlsx","内税",1100,true);
  await write("御支払明細20260430【ゼロ様】_HR.xlsx","内税 税率0%",1000);
  await write("御支払明細20260430【未定様】_HR.xlsx","不明",1000);
  await write("御支払明細20260430【税込様】_HR.xlsx","税込10%",1100);
  const rows=await importAgentFolder(dir);expect(rows).toHaveLength(5);
  expect(rows.find(r=>r.payee==="別途")?.net).toBe(2000);
  expect(rows.find(r=>r.payee==="内税")?.net).toBe(1000);
  expect(rows.find(r=>r.payee==="ゼロ")?.tax_rate).toBe(0);
  expect(rows.find(r=>r.payee==="税込")?.net).toBe(1000);
  expect(rows.find(r=>r.payee==="未定")?.review_reason).toBeTruthy();
 } finally {await rm(dir,{recursive:true,force:true});}
});
