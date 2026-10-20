import { describe, expect, it, vi } from "vitest";
import { accountKind, bookBalances, calculateBalance, mergeAccounts, monthRange, visibleAccounts } from "./balances";
import { MfClient } from "./client";
import type { MfAccount, Transaction } from "./types";
export const account = (id = "1", overrides: Partial<MfAccount> = {}): MfAccount => ({ mf_account_id: id, name: `銀行${id}`, kind: "bank", sub_account_label: "支店", sort_order: Number(id), hidden: false, visible_employee_ids: ["e1"], book_sub_account_name: "普通1", balance_mode: "auto", balance_note: "", balance: 100, unjournalized_count: 1, fetched_at: "2026-10-20T00:30:12Z", ...overrides });
const tx = (overrides: Partial<Transaction> = {}): Transaction => ({ id: "t", connected_account_id: "1", date: "2026-10-01", content: "入金", value: 20, side: "INCOME", journalizing_status: "none", ...overrides });
describe("MF balances and access", () => {
  it("adds only unjournalized income minus expenses to the matched book balance", () => {
    const books = bookBalances([{ type: "group", rows: [{ type: "account", name: "普通預金", rows: [{ type: "sub_account", name: "普通1", values: [0,0,0,100,0] }] }] }]);
    expect(calculateBalance(account(),books,[tx(),tx({ side: "EXPENSE",value: 5 }),tx({ journalizing_status: "done" }),tx({ connected_account_id: "other" })])).toEqual({ balance:115, unjournalized_count:2 });
    expect(calculateBalance(account("1",{ book_sub_account_name:"" }),books,[tx()]).balance).toBe(20);
    expect(calculateBalance(account("1",{ balance_mode:"manual_check" }),new Map(),[tx()])).toEqual({balance:null,unjournalized_count:1});
    expect(() => calculateBalance(account(),new Map(),[])).toThrow();
  });
  it("identifies cards and appends new accounts while preserving settings", () => {
    expect(accountKind("オリコカード｜HR")).toBe("card");
    expect(accountKind("PayPay銀行｜STB")).toBe("bank");
    const result = mergeAccounts([{id:"3",name:"カード"},{id:"1",name:"銀行"}],[account("1",{sort_order:8,hidden:true})],["e2"],"today");
    expect(result[0]).toMatchObject({ sort_order:9,visible_employee_ids:["e2"],balance_mode:"manual_check" });
    expect(result[1]).toMatchObject({ sort_order:8,hidden:true,visible_employee_ids:["e1"] });
    expect(visibleAccounts([account(),account("2",{hidden:true}),account("3",{visible_employee_ids:["e2"]})],"e1",false).map(a=>a.mf_account_id)).toEqual(["1"]);
    expect(visibleAccounts([account(),account("2",{hidden:true})],"other",true)).toHaveLength(2);
  });
  it("uses Japanese dates across month and year boundaries", () => {
    expect(monthRange("current",new Date("2026-09-30T16:00:00Z"))).toEqual({start:"2026-10-01",end:"2026-10-01"});
    expect(monthRange("last",new Date("2026-01-10T00:00:00Z"))).toEqual({start:"2025-12-01",end:"2025-12-31"});
    expect(monthRange("three",new Date("2026-01-10T00:00:00Z")).start).toBe("2025-11-01");
  });
});
describe("MF read-only client", () => {
  it("exchanges the key once and paginates using GET with office code", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:"token"}))).mockResolvedValueOnce(new Response(JSON.stringify({transactions:[tx()],metadata:{total_pages:2}}))).mockResolvedValueOnce(new Response(JSON.stringify({transactions:[tx({id:"2"})],metadata:{total_pages:2}})));
    const client = new MfClient("key",fetcher);
    expect(await client.transactions("2026-01-01","2026-10-20")).toHaveLength(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({method:"POST",headers:{Authorization:"Bearer key"}});
    for (const [url,options] of fetcher.mock.calls.slice(1)) {
      expect(options).toMatchObject({method:"GET",headers:{Authorization:"Bearer token"}});
      expect(new URL(url).searchParams.get("office_code")).toBe("2918-5520");
    }
    expect(new URL(fetcher.mock.calls[2][0]).searchParams.get("page")).toBe("2");
  });
  it("sanitizes connection errors", async () => {
    const client = new MfClient("secret",vi.fn().mockRejectedValue(new Error("secret")));
    await expect(client.accounts()).rejects.toThrow("MF に接続できませんでした");
  });
});
