import { describe, expect, it } from "vitest";
import { accountAxes, corporationName } from "./corporations";
import { buildMatrix, deltaLabel } from "./matrix";
import { visibleAccounts } from "./balances";
import type { MfAccount, BalanceSnapshot } from "./types";
const account = (id: string, overrides: Partial<MfAccount> = {}): MfAccount => ({mf_account_id:id,name:"みずほ銀行｜HR",kind:"bank",sort_order:0,hidden:false,visible_employee_ids:["e1"],book_sub_account_name:"",balance_mode:"auto",balance_note:"",balance:100,unjournalized_count:2,sub_account_label:"",fetched_at:"now",...overrides});
const baseline = (id: string, balance: number): BalanceSnapshot => ({mf_account_id:id,balance,snapshot_date:"2026-10-20",taken_at:"now"});
describe("法人×銀行", () => {
 it("parses bank and corporation and groups missing or unknown codes as other", () => {
  expect(accountAxes("みずほ銀行｜HR")).toEqual({bank_name:"みずほ銀行",corp_code:"HR"});
  expect(accountAxes("銀行").corp_code).toBe("other");
  expect(accountAxes("銀行｜unknown").corp_code).toBe("other");
  expect(accountAxes("銀行｜HR｜CR").corp_code).toBe("other");
  expect(corporationName("CR")).toBe("センターライズ");
 });
 it("combines accounts, excludes manual and hidden balances, and calculates complete baselines only", () => {
  const accounts=[account("1"),account("2",{balance:50}),account("3",{balance_mode:"manual_check",balance:999}),account("4",{hidden:true,balance:999})];
  const m=buildMatrix(accounts,[],[baseline("1",80),baseline("2",60)]);
  expect(m.cell("HR","みずほ銀行")).toMatchObject({balance:150,delta:10,count:3,manual:1,pending:6});
  expect(m.cell()).toMatchObject({balance:150,delta:10});
  expect(m.cell("CR")).toMatchObject({balance:null,delta:null,count:0});
  expect(buildMatrix(accounts).cell().delta).toBeNull();
  expect(buildMatrix(accounts,[],[baseline("1",80)]).cell().delta).toBeNull();
  expect(deltaLabel(10)).toBe("↑ +10"); expect(deltaLabel(-10)).toBe("↓ ▲10"); expect(deltaLabel(0)).toBe("±0");
 });
 it("applies shared axis order and sums only authorized accounts", () => {
  const accounts=[account("1"),account("2",{name:"楽天銀行｜CR",visible_employee_ids:["e2"]})];
  const m=buildMatrix(accounts,[{axis:"corp",key:"HR",sort_order:0},{axis:"corp",key:"CR",sort_order:1}]);
  expect(m.corps).toEqual(["HR","CR"]);
  const restricted=buildMatrix(visibleAccounts(accounts,"e1",false),[{axis:"corp",key:"CR",sort_order:0},{axis:"bank",key:"楽天銀行",sort_order:0}]);
  expect(restricted.cell().balance).toBe(100);
  expect(restricted.corps).toContain("CR");
  expect(restricted.cell("CR","楽天銀行")).toMatchObject({balance:null,count:0,delta:null});
  expect(buildMatrix(visibleAccounts(accounts,"e1",true)).cell().balance).toBe(200);
 });
});
