import { expect, it } from "vitest";
import { buildPivot, cellTone, fiscalYear, periodMonths, periodOptions, readSort, saveSort, type TableRecord } from "./table";
const row = (partner:string, amount:number, status:TableRecord["recon_status"]="matched") => ({kintone_record_id:partner,business:"事業",partner,profit_net:amount,scheduled_date:"2026-04-30",recon_status:status,confirmation:""} as TableRecord);
it("builds newest-first fiscal months up to the latest planned month, subtotals and grand total",()=>{
 const months=periodMonths(["2026"],"2026-10-21",[{...row("A",1),scheduled_date:"2026-11-30"}]);
 expect(months).toHaveLength(8);expect(months[0]).toBe("2026-11");expect(months.at(-1)).toBe("2026-04");
 const pivot=buildPivot([row("A",100),row("B",-30)],months,"cash");
 expect(pivot.map(r=>r.partner)).toEqual(["小計","A","B",""]);expect(pivot.at(-1)?.records.reduce((n,r)=>n+r.profit_net!,0)).toBe(70);
});
it("supports April boundary, rolling months and union of periods",()=>{
 expect(fiscalYear("2026-03-31")).toBe(2025);expect(fiscalYear("2026-04-01")).toBe(2026);
 expect(periodMonths(["2026","2025"],"2026-10-21")).toHaveLength(19);
 expect(periodMonths(["rolling"],"2026-10-21").at(-1)).toBe("2025-11");
 expect(periodOptions([],"2026-10-21").map(o=>o.label)).toEqual(["直近12か月","2026年度","2025年度"]);
});
it("prioritizes red, only pending gray, ignores exclusions and honors human confirmation",()=>{
 for(const status of ["amount_mismatch","not_arrived","ambiguous"] as const) expect(cellTone([row("a",1,status),row("b",1,"pending")])).toBe("red");
 expect(cellTone([row("a",1,"pending"),row("b",1,"excluded")])).toBe("gray");
 expect(cellTone([row("a",1,"excluded")])).toBe("normal");expect(cellTone([row("a",1),row("b",1,"pending")])).toBe("normal");
 expect(cellTone([{...row("a",1,"not_arrived"),confirmation:"入金OK"}])).toBe("normal");
 expect(cellTone([{...row("a",1,"matched"),confirmation:"入金OK",mf_date:"2026-10-30"}],"2026-10-28")).toBe("gray");expect(cellTone([{...row("a",1,"matched"),confirmation:"入金OK",mf_date:"2026-10-30"}],"2026-10-30")).toBe("normal");
});
it("sorts incoming then payments by magnitude, amount and partner",()=>{
 const rows=[row("C",-10),row("B",-100),row("A",20)];const months=["2026-04"];
 expect(buildPivot(rows,months,"cash").slice(1,-1).map(r=>r.partner)).toEqual(["A","B","C"]);
 expect(buildPivot(rows,months,"amount").slice(1,-1).map(r=>r.partner)).toEqual(["A","C","B"]);
 expect(buildPivot(rows,months,"name").slice(1,-1).map(r=>r.partner)).toEqual(["A","B","C"]);
});
it("falls back when storage is unavailable and saves per user",()=>{
 expect(readSort({getItem:()=>{throw Error();}},"one")).toBe("cash");
 expect(()=>saveSort({setItem:()=>{throw Error();}},"one","name")).not.toThrow();
 const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 saveSort(storage,"one","name");expect(readSort(storage,"one")).toBe("name");expect(readSort(storage,"two")).toBe("cash");
});

import { applyOrder, movePivot, orderFromPivot, readOrder, saveOrder } from "./table";
it("applies remembered business and partner order, appends new entries and ignores removed ones",()=>{
 const p=buildPivot([row("A",10),row("B",20),row("C",30),{...row("Z",1),business:"別事業"}],["2026-04"],"cash");
 const sorted=applyOrder(p,{businesses:["別事業","消滅","事業"],partners:{事業:["B","消滅","A"]}});
 expect(sorted.map(r=>r.partner)).toEqual(["小計","Z","小計","B","A","C",""]);
 const before=orderFromPivot(sorted);expect(movePivot(sorted,JSON.stringify(["事業","A"]),JSON.stringify(["別事業","Z"]))).toEqual(before);
 const moved=movePivot(sorted,JSON.stringify(["事業"]),JSON.stringify(["別事業"]));expect(moved.businesses).toEqual(["事業","別事業"]);
 expect(readOrder({getItem:()=>{throw Error();}},"u")).toBeNull();expect(readOrder({getItem:()=>'{bad'},"u")).toBeNull();expect(()=>saveOrder({setItem:()=>{throw Error();}},"u",moved)).not.toThrow();
});
