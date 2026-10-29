import { expect, it, vi } from "vitest";
import { insertProfileHistoryIfChanged, type ProfileHistoryRow } from "@/app/root/_lib/profile-history.server";
it("同じ内容でも本人の確認をその都度保存する",async()=>{
 const insert=vi.fn(async()=>({error:null}));
 const query={eq(){return this;},order(){return this;},limit(){return this;},maybeSingle:async()=>({data:{payload:{full:"住所"}}})};
 const admin={from:()=>({select:()=>query,insert})};
 const row:ProfileHistoryRow={employee_id:"self",category:"address",payload:{full:"住所"},source:"employee_confirm",source_ref:null,effective_from:null,recorded_by:null,confirmed_by_employee_at:new Date().toISOString()};
 await insertProfileHistoryIfChanged(admin,row);
 await insertProfileHistoryIfChanged(admin,row);
 expect(insert).toHaveBeenCalledTimes(2);
});
