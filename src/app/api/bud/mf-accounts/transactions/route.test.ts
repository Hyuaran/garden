import { beforeEach, expect, it, vi } from "vitest";
const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bud/mf/access", () => ({ mfAccess:access }));
import { GET } from "./route";
const request = (query = "") => new Request(`https://garden.test/api/bud/mf-accounts/transactions?id=b${query}`);
beforeEach(() => vi.resetAllMocks());
function fixture(kind = "bank", allowed = true) {
  const account = { mf_account_id:"b", kind, hidden:false, visible_employee_ids:allowed ? ["e"] : [], fiscal_start_date:"2026-04-01" };
  const rows = Array.from({length:205},(_,i) => ({ mf_transaction_id:String(i), date:"2026-10-20", side:i % 2 ? "INCOME" : "EXPENSE", value:10 }));
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select","eq","gte","lte","order"]) query[name] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({data:account});
  query.range = vi.fn().mockResolvedValue({data:rows});
  const from = vi.fn((table: string) => table === "bud_mf_group_viewers" ? {select: vi.fn().mockResolvedValue({data:[]})} : query);
  access.mockResolvedValue({ok:true,admin:false,employeeId:"e",db:{from}});
  return { query, from };
}
it("requires authentication and rejects inaccessible direct URLs before reading transactions", async () => {
  access.mockResolvedValue({ok:false,status:401});
  expect((await GET(request())).status).toBe(401);
  const f = fixture("bank",false);
  expect((await GET(request())).status).toBe(404);
  expect(f.from).toHaveBeenCalledTimes(2);
});
it("filters the fiscal year, sorts newest first and returns every row with the complete total", async () => {
  const f = fixture();
  const response = await GET(request("&period=year&page=2"));
  const data = await response.json();
  expect(data.transactions).toHaveLength(205);
  expect(data.transactions[0].mf_transaction_id).toBe("0");
  expect(data.total).toBe(205); expect(data.amount).toBe(10);
  expect(f.from).toHaveBeenCalledWith("bud_mf_bank_transactions");
  expect(f.query.gte).toHaveBeenCalledWith("date","2026-04-01");
  expect(f.query.order).toHaveBeenCalledWith("date",{ascending:false});
  expect(f.query.order).toHaveBeenCalledWith("mf_transaction_id");
});
it("uses card storage and validates page and period", async () => {
  const f = fixture("card");
  expect((await GET(request("&page=3"))).status).toBe(200);
  expect(f.from).toHaveBeenCalledWith("bud_mf_card_transactions");
  expect((await GET(request("&page=0"))).status).toBe(400);
  expect((await GET(request("&period=three"))).status).toBe(400);
});

it("reads successive batches and returns all rows rather than a server page", async () => {
  const f = fixture();
  const row = {mf_transaction_id:"x",date:"2026-10-20",side:"EXPENSE",value:10};
  f.query.range.mockReset().mockResolvedValueOnce({data:Array.from({length:1000}, (_,i) => ({...row,mf_transaction_id:String(i)}))}).mockResolvedValueOnce({data:[{...row,mf_transaction_id:"1000"}]}).mockResolvedValue({data:[]});
  const data = await (await GET(request("&period=year"))).json();
  expect(data.transactions).toHaveLength(1001);
  expect(data.total).toBe(1001);
  expect(f.query.range).toHaveBeenNthCalledWith(1,0,999);
  expect(f.query.range).toHaveBeenNthCalledWith(2,1000,1999);
});

it("accepts an explicit past fiscal year and returns account years", async () => {
  const f = fixture();
  const data = await (await GET(request("&period=fy:2025"))).json();
  expect(data.range).toEqual({start:"2025-04-01",end:"2026-03-31"});
  expect(f.query.gte).toHaveBeenCalledWith("date","2025-04-01");
  expect(f.query.lte).toHaveBeenCalledWith("date","2026-03-31");
  expect(data.fiscalYears).toEqual([2026]);
});

it("returns a union without duplicate rows or dates in gaps", async () => {
  const f = fixture();
  f.query.range.mockResolvedValue({data:[
    {mf_transaction_id:"a",date:"2025-10-01",side:"EXPENSE",value:20},
    {mf_transaction_id:"b",date:"2024-10-01",side:"EXPENSE",value:50},
    {mf_transaction_id:"c",date:"2023-10-01",side:"INCOME",value:10},
  ]});
  const data = await (await GET(request("&period=fy:2025,fy:2023,fy:2025"))).json();
  expect(data.transactions.map((t: {mf_transaction_id:string}) => t.mf_transaction_id)).toEqual(["a","c"]);
  expect(data.total).toBe(2); expect(data.amount).toBe(10); expect(data.expense).toBe(20); expect(data.income).toBe(10);
});

it("allows a direct URL through group membership alone", async()=>{
 const f=fixture("bank",false);
 f.from.mockImplementation((table:string)=>table==="bud_mf_group_viewers"?{select:vi.fn().mockResolvedValue({data:[{kind:"bank",employee_ids:["e"]}]})}:f.query);
 expect((await GET(request())).status).toBe(200);
});
