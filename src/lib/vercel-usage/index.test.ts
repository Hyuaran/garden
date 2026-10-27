import { gzipSync } from "node:zlib";
import { expect, it, vi } from "vitest";
import { billingPeriod, fetchBillingCharges, judgeUsage, usageNotice, type UsageRow } from "./index";
const now = new Date("2026-10-28T09:05:00Z");
const row = (day:string,cost:number,service="Observability Events"):UsageRow=>({day,service,cost_usd:cost,usage:1,unit:"events"});
it("uses UTC twentieth boundaries, including year rollover",()=>{
  expect(billingPeriod(new Date("2026-01-19Z")).start.toISOString()).toBe("2025-12-20T00:00:00.000Z");
  expect(billingPeriod(new Date("2026-10-20T09:05Z")).start.toISOString()).toBe("2026-10-20T00:00:00.000Z");
});
it("projects recent three calendar days including missing zero days",()=>{
  const r=judgeUsage([row("2026-10-27",3)],[],now);
  expect(r.spent).toBe(3);expect(r.projected).toBe(26);
  expect(r.changes.some(c=>c.key==="projected_over")).toBe(true);
  expect(r.changes.some(c=>c.key==="spent_over")).toBe(false);
});
it("excludes seats, warns once per incident, recovers once, and can warn again",()=>{
  const rows=[row("2026-10-27",21),row("2026-10-27",100,"Pro"),row("2026-10-27",100,"Additional Team Seats")];
  const first=judgeUsage(rows,[],now);expect(first.spent).toBe(21);
  expect(first.changes.filter(c=>c.key==="spent_over")).toHaveLength(1);
  expect(judgeUsage(rows,first.changes,now).changes).toHaveLength(0);
  const recovered=judgeUsage([],first.changes,now);expect(recovered.changes.filter(c=>!c.active)).toHaveLength(2);
  expect(judgeUsage([],recovered.changes,now).changes).toHaveLength(0);
  expect(judgeUsage(rows,recovered.changes,now).changes.some(c=>c.key==="spent_over")).toBe(true);
  expect(usageNotice(recovered,recovered.changes[0],now)).toContain("落ち着きました");
});
it.each([[0.1,0.2,true],[0.11,0.2,false],[0.01,0.19,false],[0,0.2,true]])("spike median %s, yesterday %s",(baseline,cost,expected)=>{
  const rows=Array.from({length:7},(_,i)=>row(`2026-10-${20+i}`,baseline));rows.push(row("2026-10-27",cost));
  const r=judgeUsage(rows,[],now);expect(r.spikes.length>0).toBe(expected);
  if(expected){expect(usageNotice(r,r.changes.find(c=>c.key.startsWith("spike:"))!,now)).toContain("観測イベント");expect(judgeUsage(rows,r.changes,now).changes).toHaveLength(0);}
});
it("Monday summary is sent once even without warnings",()=>{
  const monday=new Date("2026-10-26T09:05Z");const r=judgeUsage([],[],monday);
  expect(r.changes).toHaveLength(1);expect(r.changes[0].key).toBe("weekly:2026-10-26");
  expect(usageNotice(r,r.changes[0],monday)).toContain("今週のまとめ");
  expect(judgeUsage([],r.changes,monday).changes).toHaveLength(0);
  expect(judgeUsage([],r.changes,new Date("2026-10-25T15:05Z")).changes).toHaveLength(0);
});
it("does not warn at exact included limit and supports overrides",()=>{
  const r=judgeUsage([row("2026-10-20",20)],[],now);expect(r.changes).toHaveLength(0);
  expect(judgeUsage([row("2026-10-20",20)],[],now,10).changes.some(c=>c.key==="spent_over")).toBe(true);
});
it("uses the previous three days across a new billing period",()=>{
  const r=judgeUsage([row("2026-10-17",1),row("2026-10-18",1),row("2026-10-19",1)],[],new Date("2026-10-20T09:05Z"));
  expect(r.spent).toBe(0);expect(r.projected).toBe(31);
  expect(r.changes.some(c=>c.key==="projected_over")).toBe(true);
});
it.each([false,true])("reads JSON Lines, gzip=%s, aggregates service rows",async(gzip)=>{
  const item={ChargePeriodStart:"2026-10-27T00:00:00Z",ServiceName:"Observability Events",ConsumedQuantity:"2",ConsumedUnit:"events",BilledCost:"0.25",BillingCurrency:"USD"};
  const text=[item,item,{...item,ServiceName:"Pro"}].map(i=>JSON.stringify(i)).join("\n")+"\n";
  const body=gzip?gzipSync(text):Buffer.from(text);
  const request=vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>body});
  const r=await fetchBillingCharges(new Date("2026-10-20Z"),new Date("2026-10-28Z"),"test-billing-token",request);
  expect(r.rows).toEqual([{day:"2026-10-27",service:"Observability Events",usage:4,unit:"events",cost_usd:0.5}]);
  expect(String(request.mock.calls[0][0])).toContain("slug=hyuaran-5e506769");
});
it("skips without token without any network access",async()=>{
  const request=vi.fn();expect(await fetchBillingCharges(now,now,"",request)).toEqual({skipped:"no_token",rows:[]});expect(request).not.toHaveBeenCalled();
});
it("rejects failed or malformed responses",async()=>{
  await expect(fetchBillingCharges(now,now,"test",vi.fn().mockResolvedValue({ok:false,status:403}))).rejects.toThrow("403");
  await expect(fetchBillingCharges(now,now,"test",vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>Buffer.from('{"ServiceName":"Bad"}')}))).rejects.toThrow("Invalid billing charge");
});

it("counts EffectiveCost (before the included credit) instead of BilledCost", async () => {
  const line = JSON.stringify({ ChargePeriodStart: "2026-10-23T07:00:00.000Z", ServiceName: "Fluid Provisioned Memory", ConsumedQuantity: 75, ConsumedUnit: "gigabyte-hour", BilledCost: 0, EffectiveCost: 1.25, BillingCurrency: "USD" });
  const request = (async () => new Response(line + "\n")) as unknown as typeof fetch;
  const result = await fetchBillingCharges(new Date("2026-10-20Z"), new Date("2026-10-28Z"), "test-billing-token", request);
  expect(result.rows).toEqual([{ day: "2026-10-23", service: "Fluid Provisioned Memory", usage: 75, unit: "gigabyte-hour", cost_usd: 1.25 }]);
});
