import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/sprout-rill-view.server",()=>({requireRecruitMailRead:mocks.access}));
const mocks = vi.hoisted(() => ({ access:vi.fn(), query:vi.fn(), fetch:vi.fn(), user:vi.fn(), role:vi.fn() }));
vi.mock("./access.server",()=>({requireSproutUser:mocks.access}));
vi.mock("@/lib/db/pg",()=>({queryPg:mocks.query,withPgClient:(fn:(c:unknown)=>unknown)=>fn({query:mocks.query})}));
import { sendToHire, loadSprout, loadApplicantDetail, refreshSprout } from "@/app/sprout/actions";
import { applicant, type KRecord } from "./model";
import { importRecruit, fetchRecords } from "./import.server";
const record = (v:Record<string,unknown>):KRecord=>Object.fromEntries(Object.entries(v).map(([k,value])=>[k,{value}]));
beforeEach(()=>{
  vi.resetAllMocks(); vi.stubGlobal("fetch",mocks.fetch);
  mocks.access.mockResolvedValue({id:"user"});
  mocks.query.mockResolvedValue({rows:[]});
  vi.stubEnv("KINTONE_SUBDOMAIN","example"); vi.stubEnv("KINTONE_RECRUIT_APPLICANTS_TOKEN","readonly"); vi.stubEnv("KINTONE_RECRUIT_HEARING_TOKEN","readonly");
});
describe("Sprout server boundaries",()=>{
  it("rejects all reads, imports, and handoffs before database or Kintone access",async()=>{
    mocks.access.mockRejectedValue(new Error("閲覧権限がありません"));
    await expect(loadSprout()).rejects.toThrow("閲覧権限");
    await expect(loadApplicantDetail("1")).rejects.toThrow("閲覧権限");
    expect((await refreshSprout()).ok).toBe(false);
    expect((await sendToHire("1")).ok).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("uses a unique source conflict target so repeated sends insert only once",async()=>{
    const a=applicant(record({$id:"1",従業員名_姓名:"山田 太郎",従業員名_姓名カナ:"ヤマダ タロウ",性別:"男性",日付:"2000-01-01",日付_2:"2026-11-01",ドロップダウン_1:"⑩入社"}));
    const inserted=new Set<string>();
    mocks.query.mockImplementation(async(sql:string,params:unknown[])=>{
      if(sql.startsWith("select *")) return {rows:[a]};
      expect(sql).toContain("on conflict(source_applicant_id) do nothing");
      inserted.add(String(params[0])); return {rows:[]};
    });
    expect((await sendToHire("1")).ok).toBe(true); expect((await sendToHire("1")).ok).toBe(true);
    expect(inserted.size).toBe(1);
  });
  it("paginates 500 records using an increasing ID, with read requests only",async()=>{
    mocks.fetch.mockResolvedValueOnce({ok:true,json:async()=>({records:Array.from({length:500},(_,i)=>record({$id:String(i+1)}))})}).mockResolvedValueOnce({ok:true,json:async()=>({records:[record({$id:"501"})]})});
    expect(await fetchRecords("APPLICANTS")).toHaveLength(501);
    expect(decodeURIComponent(mocks.fetch.mock.calls[1][0])).toContain("500");
    expect(mocks.fetch.mock.calls.every(([,options])=>!options.method)).toBe(true);
  });
  it("refuses a second import while the database lock is held",async()=>{
    mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes("pg_try_advisory")?[{acquired:false}]:[]}));
    await expect(importRecruit()).rejects.toThrow("取り込み中"); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("also refuses overlapping requests in the same server before waiting for a connection",async()=>{
    let release!:()=>void;
    const pending=new Promise<void>(resolve=>{release=resolve;});
    mocks.query.mockImplementation(async(sql:string)=>{
      if(sql==="begin") await pending;
      return {rows:sql.includes("pg_try_advisory")?[{acquired:false}]:[]};
    });
    const first=importRecruit();
    await vi.waitFor(()=>expect(mocks.query).toHaveBeenCalledWith("begin"));
    await expect(importRecruit()).rejects.toThrow("取り込み中");
    release(); await expect(first).rejects.toThrow("取り込み中");
  });
  it("rolls back on acquisition failure without deleting existing records",async()=>{
    mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes("pg_try_advisory")?[{acquired:true}]:sql.includes("returning id")?[{id:"1"}]:[]}));
    mocks.fetch.mockResolvedValue({ok:false});
    await expect(importRecruit()).rejects.toThrow();
    expect(mocks.query.mock.calls.some(([sql])=>sql==="rollback")).toBe(true);
    expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith("delete"))).toBe(false);
  });
  it("upserts both complete datasets and removes missing records in one transaction",async()=>{
    mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes("pg_try_advisory")?[{acquired:true}]:sql.includes("returning id")?[{id:"1"}]:[]}));
    mocks.fetch.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes("form/fields")?{properties:{}}:{records:[record({$id:url.includes("app=44")?"1":"2",従業員名_姓名:"山田 太郎",連絡先_ハイフンなし:"09012345678"})]}}));
    await importRecruit();
    const calls=mocks.query.mock.calls.map(([sql])=>sql);
    expect(calls.filter(sql=>sql.includes("jsonb_populate_recordset"))).toHaveLength(2);
    expect(calls.filter(sql=>sql.startsWith("delete"))).toHaveLength(2);
    expect(calls.at(-1)).toBe("commit");
  });
});

it("preserves Baitoru originals during mirror refresh and keeps their local IDs",async()=>{
 const a=applicant(record({$id:'42',従業員名_姓名:'山田 花子'}));
 mocks.query.mockImplementation(async(sql:string)=>({rows:
  sql.includes('pg_try_advisory')?[{acquired:true}]:
  sql.includes('returning id')?[{id:'1'}]:
  sql.includes("where source='baitoru'")?[{kintone_record_id:'baitoru:238839646',mirror_record_id:'42',raw:{応募日時:'2026/10/24 10:12:00'}}]:[]}));
 mocks.fetch.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes('form/fields')?{properties:{}}:{records:url.includes('app=44')?[record({$id:a.kintone_record_id,従業員名_姓名:a.name})]:[]}}));
 await importRecruit();
 const upsert=mocks.query.mock.calls.find(([sql])=>sql.startsWith('insert into sprout_applicants'))!;
 expect(JSON.parse(upsert[1][0])[0]).toMatchObject({kintone_record_id:'baitoru:238839646',raw:{応募日時:'2026/10/24 10:12:00'}});
 expect(mocks.query.mock.calls.find(([sql])=>sql.startsWith('delete from sprout_applicants'))?.[0]).toContain("source='kintone'");
});

it("omits raw and wildcard columns from all four list queries", async () => {
  await loadSprout();
  expect(mocks.query).toHaveBeenCalledTimes(4);
  for (const [sql] of mocks.query.mock.calls) expect(sql).not.toMatch(/\braw\b|select\s+\*/i);
  expect(mocks.query.mock.calls[1][0]).toBe("select applicant_record_id from sprout_hearing_sheets");
});
it("loads only the selected applicant raw and linked hearing raw", async () => {
  mocks.query.mockResolvedValueOnce({rows:[{raw:{希望給与:"1200"}}]})
    .mockResolvedValueOnce({rows:[{kintone_record_id:"h1",raw:{性別:"女性"}}]});
  expect(await loadApplicantDetail("42")).toEqual({raw:{希望給与:"1200"},hearings:[{kintone_record_id:"h1",raw:{性別:"女性"}}]});
  expect(mocks.query).toHaveBeenNthCalledWith(1,"select raw from sprout_applicants where kintone_record_id=$1",["42"]);
  expect(mocks.query).toHaveBeenNthCalledWith(2,"select kintone_record_id, raw from sprout_hearing_sheets where applicant_record_id=$1",["42"]);
});
