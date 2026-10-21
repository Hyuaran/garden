import { expect, it } from "vitest";
import { cardSummaries, journalLabel, transactionRange } from "./transactions";
import type { CardTransaction, MfAccount } from "./types";
it("uses trial-balance fiscal start and month ranges", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  expect(transactionRange("year","2026-04-01",now)).toEqual({start:"2026-04-01",end:"2026-10-21"});
  expect(transactionRange("last","2026-04-01",now)).toEqual({start:"2026-09-01",end:"2026-09-30"});
  expect(transactionRange("current","2026-04-01",now).start).toBe("2026-10-01");
  expect(() => transactionRange("year",null,now)).toThrow();
});
it("includes zero-use cards in shared order and aggregates refunds, counts and latest date", () => {
  const accounts = [{kind:"card",mf_account_id:"a"},{kind:"card",mf_account_id:"b"}] as MfAccount[];
  const rows = [{mf_account_id:"a",date:"2026-10-01",side:"EXPENSE",value:100},{mf_account_id:"a",date:"2026-10-20",side:"INCOME",value:20}] as CardTransaction[];
  expect(cardSummaries(accounts,rows).map(({amount,count,latest}) => ({amount,count,latest}))).toEqual([{amount:80,count:2,latest:"2026-10-20"},{amount:0,count:0,latest:undefined}]);
  expect(journalLabel("none")).toBe("未"); expect(journalLabel("done")).toBe("済");
});
