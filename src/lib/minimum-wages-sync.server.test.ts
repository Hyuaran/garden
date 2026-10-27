import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { parseMinimumWageExcel, mhlwExcelUrl, syncMinimumWagesFromMhlw, runMinimumWageCron } from "./minimum-wages-sync.server";
async function fixture(){const b=await readFile("src/lib/fixtures/minimum-wages-osaka.xlsx");return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;}
it("reads Osaka's latest amount and serial date from the real workbook excerpt",async()=>{expect(await parseMinimumWageExcel(await fixture())).toEqual({hourly_amount:1231,effective_from:"2026-10-01"});});
it("discovers the changing Excel URL from the link text",()=>{expect(mhlwExcelUrl('<a href="/content/11200000/new.xlsx">平成14年度から令和8年度までの地域別最低賃金改定状況</a>')).toBe("https://www.mhlw.go.jp/content/11200000/new.xlsx");expect(()=>mhlwExcelUrl('<a href="https://evil.test/a.xlsx">改定状況</a>')).toThrow();});
it("does not replace an existing revision",async()=>{
 const select=vi.fn().mockResolvedValue({data:[],error:null});const upsert=vi.fn(()=>({select}));
 const bytes=await fixture();const fetcher=vi.fn().mockResolvedValueOnce(new Response('<a href="/test.xlsx">改定状況</a>')).mockResolvedValueOnce(new Response(bytes));
 const r=await syncMinimumWagesFromMhlw({db:{from:()=>({upsert})} as never,fetcher});
 expect(r).toMatchObject({ok:true,added:false});expect(upsert).toHaveBeenCalledWith(expect.objectContaining({hourly_amount:1231}),{onConflict:"prefecture,effective_from",ignoreDuplicates:true});
});
it("never writes when the workbook is unreadable",async()=>{const from=vi.fn();const fetcher=vi.fn().mockResolvedValueOnce(new Response('<a href="/test.xlsx">改定状況</a>')).mockResolvedValueOnce(new Response('invalid'));expect(await syncMinimumWagesFromMhlw({db:{from} as never,fetcher})).toMatchObject({ok:false});expect(from).not.toHaveBeenCalled();});
it("skips months outside August through October",async()=>{const sync=vi.fn(),notify=vi.fn();expect(await runMinimumWageCron(new Date("2026-11-01T00:00:00Z"),{db:{} as never,sync,notify})).toEqual({ok:true,skipped:true});expect(sync).not.toHaveBeenCalled();});
it("notifies once per failure and once on recovery",async()=>{
 let state:string|null=null;
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{last_error:state}}),upsert:async(p:{last_error:string|null})=>{state=p.last_error;return {};}};
 const sync=vi.fn().mockResolvedValue({ok:false,error:"失敗"}),notify=vi.fn();const deps={db:{from:()=>q} as never,sync,notify};
 await runMinimumWageCron(new Date("2026-10-01"),deps);await runMinimumWageCron(new Date("2026-10-02"),deps);expect(notify).toHaveBeenCalledTimes(1);
 sync.mockResolvedValue({ok:true,added:false});await runMinimumWageCron(new Date("2026-10-03"),deps);expect(notify).toHaveBeenCalledTimes(2);expect(notify).toHaveBeenLastCalledWith("最低賃金の自動登録が回復しました");
});
