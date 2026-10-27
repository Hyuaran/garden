import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({db:vi.fn(),notice:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.db}));
vi.mock("@/lib/relay/monitor.server",()=>({sendGardenNotice:mocks.notice}));
import { GET } from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});
it("rejects unauthenticated requests before any work",async()=>{
  vi.stubEnv("CRON_SECRET","cron-test");
  expect((await GET(new Request("https://test/cron"))).status).toBe(401);
  expect(mocks.db).not.toHaveBeenCalled();expect(mocks.notice).not.toHaveBeenCalled();
});
it("rejects missing cron secret",async()=>{
  vi.stubEnv("CRON_SECRET","");expect((await GET(new Request("https://test/cron"))).status).toBe(500);
});
it("authorized request skips without billing token",async()=>{
  vi.stubEnv("CRON_SECRET","cron-test");vi.stubEnv("VERCEL_BILLING_TOKEN","");
  const r=await GET(new Request("https://test/cron",{headers:{authorization:"Bearer cron-test"}}));
  expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true,skipped:"no_token"});expect(mocks.db).not.toHaveBeenCalled();expect(mocks.notice).not.toHaveBeenCalled();
});
it("persists charges and notifies only transitions across repeated runs",async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-28T09:05Z"));
  vi.stubEnv("CRON_SECRET","cron-test");vi.stubEnv("VERCEL_BILLING_TOKEN","billing-test");
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>Buffer.from(JSON.stringify({ChargePeriodStart:"2026-10-27T00:00Z",ServiceName:"Observability Events",BilledCost:"21",BillingCurrency:"USD",ConsumedQuantity:"1",ConsumedUnit:"events"}))}));
  const previous: unknown[]=[];
  const daily=vi.fn().mockResolvedValue({error:null});
  const save=vi.fn(async(change:unknown)=>{previous.push(change);return {error:null};});
  mocks.db.mockReturnValue({from:(table:string)=>table==="system_vercel_usage_daily"?{upsert:daily}:{select:async()=>({data:previous,error:null}),upsert:save}});
  mocks.notice.mockResolvedValue(true);
  const request=()=>new Request("https://test/cron",{headers:{authorization:"Bearer cron-test"}});
  expect((await GET(request())).status).toBe(200);expect(mocks.notice).toHaveBeenCalledTimes(2);expect(save).toHaveBeenCalledTimes(3);
  expect((await GET(request())).status).toBe(200);expect(mocks.notice).toHaveBeenCalledTimes(2);expect(daily).toHaveBeenCalledTimes(2);
});
it("does not mark a failed notice as delivered",async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-26T09:05Z"));
  vi.stubEnv("CRON_SECRET","cron-test");vi.stubEnv("VERCEL_BILLING_TOKEN","billing-test");
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>Buffer.from("")}));
  const save=vi.fn();mocks.db.mockReturnValue({from:()=>({select:async()=>({data:[],error:null}),upsert:save})});
  mocks.notice.mockResolvedValue(false);
  const r=await GET(new Request("https://test/cron",{headers:{authorization:"Bearer cron-test"}}));
  expect(r.status).toBe(500);expect(save).not.toHaveBeenCalled();
});
