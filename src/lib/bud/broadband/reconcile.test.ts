import { describe, expect, it, vi } from "vitest";
import { buildPatch, exact, gross, notification, planIssues, reconcile, type Bank, type Mirror, type Settings } from "./reconcile";
import { applyMatches } from "./run";
const settings: Settings = {record_master:"kintone",recon_from:"2025-04-01",notify_from:"2026-10-01",date_window_before:10,date_window_after:7,excluded_partners:["代理店支払い合計"]};
const row = (id="1", fields: Record<string,unknown> = {}): Mirror => ({kintone_record_id:id,revision:"3",raw:Object.fromEntries(Object.entries({$id:id,$revision:"3",入出金予定日:"2026-10-01",実績期間:"2026-09-01",取引先会社名:"会社",事業内容:"関電",売上_税抜_:"100",消費税率:"10",入金確認:"",...fields}).map(([k,value])=>[k,{value}]))});
const bank = (fields: Partial<Bank> = {}): Bank => ({mf_transaction_id:"b1",mf_account_id:"a1",date:"2026-10-01",side:"INCOME",value:110,content:"カイシャ",corp_code:"HR",bank_name:"楽天銀行",...fields});
const run = (rows=[row()], banks=[bank()], rules: {partner:string;keywords:string[]}[] = [], today="2026-10-21") => reconcile(rows,banks,rules,settings,today);
describe("broadband reconciliation",()=>{
 it.each([10,8,0])("tax %s",tax=>{ expect(gross(row("1",{消費税率:tax}).raw)).toBeCloseTo(100*(1+tax/100)); });
 it("rounds display and treats a one yen difference as a match",()=>{const r=run([row("1",{売上_税抜_:"101"})],[bank({value:111})])[0]; expect(r.expected).toBe(111); expect(r.kind).toBe("matched");expect(exact(112,110)).toBe(false);expect(exact(111,110.1)).toBe(true);});
 it("filters direction, dates, corporation and payee",()=>{
  for (const b of [bank({side:"EXPENSE"}),bank({date:"2026-09-20"}),bank({date:"2026-12-01"}),bank({corp_code:"ART"})]) expect(run([row("1",{ドロップダウン_0:"ヒュアラン"})],[b],[],"2026-12-01")[0].kind).toBe("not_arrived");
  expect(run(undefined,[bank()], [{partner:"会社",keywords:["違う"]}])[0].kind).toBe("matched");
  expect(run(undefined,[bank()], [{partner:"会社",keywords:["違う","カイシャ"]}])[0].kind).toBe("matched");
  expect(run(undefined,[bank({date:"2026-09-21"})])[0].kind).toBe("matched");
  expect(run(undefined,[bank({date:"2026-11-30"})])[0].kind).toBe("matched");
 });
 it("uses one transaction once including previously assigned ones",()=>{
  expect(run([row("1"),row("2")]).map(r=>r.kind)).toEqual(["matched","pending"]);
  expect(run([{...row("1",{入金確認:"入金OK"}),mf_transaction_id:"b1"},row("2")]).map(r=>r.kind)).toEqual(["excluded","pending"]);
 });
 it("chooses nearest and refuses ties",()=>{
  expect(run(undefined,[bank(),bank({mf_transaction_id:"b2",date:"2026-10-02"})])[0].bank?.mf_transaction_id).toBe("b1");
  expect(run(undefined,[bank(),bank({mf_transaction_id:"b2"})])[0].kind).toBe("ambiguous");
 });
 it("classifies mismatch only with a payee rule, pending and excluded",()=>{
  expect(run(undefined,[bank({value:1000})],[{partner:"会社",keywords:["カイシャ"]}])[0].kind).toBe("amount_mismatch");
  expect(run(undefined,[],[],"2026-10-08")[0].kind).toBe("pending");
  expect(run([row("1",{取引先会社名:"代理店支払い合計"})])[0].kind).toBe("excluded");
  expect(run([row("1",{入出金予定日:"2026-09-30"})],[])[0].notify).toBe(false);
 });
 it("writes only blank confirmation, allowed options and appends history",()=>{
  const r=run([row("1",{テーブル:[{id:"old",value:{詳細:{value:"以前"}}}]})],[bank({corp_code:"CR",bank_name:"他行"})])[0];
  const patch=buildPatch(r,"詳細")!;
  expect(patch.ドロップダウン_0).toEqual({value:""});expect(patch._MF_銀行).toEqual({value:""});
  expect((patch.テーブル as {value:unknown[]}).value).toHaveLength(2);
  expect(buildPatch({...r,row:row("1",{入金確認:"入金OK"})},"詳細")).toBeNull();
  const expense=run([row("1",{売上_税抜_:0,支払額_税抜_:100})],[bank({side:"EXPENSE",value:-110})])[0];
  expect(buildPatch(expense,"詳細")!.入金確認).toEqual({value:"支払OK"});
 });
 it("opens once, groups and resolves once",()=>{
  const results=run([row("1"),row("2")],[],[],"2026-12-01"), now="2026-12-01T00:00:00Z";
  let issues=planIssues([],results,results.map(r=>r.row),new Set(),now);
  expect(issues).toHaveLength(2);expect(notification(issues).match(/\[info\]/g)).toHaveLength(1);
  expect(notification(issues)).toContain("110 円");expect(notification(issues)).toContain("10/1");
  issues=issues.map(i=>({...i,notified_at:now}));
  expect(notification(planIssues(issues,results,results.map(r=>r.row),new Set(),now))).toBe("");
  issues=planIssues(issues,[],[],new Set(),now);expect(notification(issues)).toContain("直りました");
  expect(notification(issues.map(i=>({...i,resolved_notified_at:now})))).toBe("");
 });
 it("dry run never writes; conflicts skip only the changed row",async()=>{
  const results=run([row("1"),row("2")],[bank(),bank({mf_transaction_id:"b2",value:220})]);
  results[1]={...results[0],row:row("2")};
  const write=vi.fn(async(records:{id:string;revision:string}[])=>{if(records.some(r=>r.id==="1"))throw new Error("revision_conflict");return records;});const save=vi.fn();
  await applyMatches(results,"詳細",true,write,save);expect(write).not.toHaveBeenCalled();
  const applied=await applyMatches(results,"詳細",false,write,save);expect([...applied]).toEqual(["2"]);expect(save).toHaveBeenCalledTimes(1);
 });
});

import { grossCandidates, side as rowSide } from "./reconcile";
it("uses the cost field and the stock parts for rows without sales or payment", () => {
  const f = (o: Record<string,string>) => Object.fromEntries(Object.entries(o).map(([k,v]) => [k,{value:v}])) as never;
  const cost = f({ 原価_税抜_:"3567037", 消費税率:"10", 利益額_税抜_:"-3567037" });
  expect(rowSide(cost)).toBe("EXPENSE"); expect(Math.abs(grossCandidates(cost)[0] - 3923740.7)).toBeLessThan(0.01);
  const stock = f({ 自社ストック額_税込_:"868055", 委託費_税込_:"35620", 利益額_税抜_:"756758", 消費税率:"10" });
  expect(rowSide(stock)).toBe("INCOME"); expect(grossCandidates(stock)).toContain(832435);
});

import { exact as isExact, feeOf, endOfNextMonth, payeeKeyword } from "./reconcile";
it("matches an income with the transfer fee deducted", () => {
  const r = run([row("1",{売上_税抜_:"86000"})],[bank({value:94160})])[0]; expect(r.kind).toBe("matched"); expect(r.fee).toBe(440);
  expect(run([row("1",{売上_税抜_:"86000"})],[bank({value:94401})])[0].kind).not.toBe("matched");
  expect(String((buildPatch(r,"詳細")!.テーブル as {value:{value:{詳細:{value:string}}}[]}).value.at(-1)!.value.詳細.value)).toContain("振込手数料 440 円");
  expect(run([row("1",{売上_税抜_:0,支払額_税抜_:100})],[bank({side:"EXPENSE",value:100})])[0].kind).toBe("pending");
});
it("treats a 1 yen difference and a transfer fee as a match and waits until the end of the next month", () => {
  expect(isExact(4694027, 4694026)).toBe(true); expect(isExact(4694028, 4694026)).toBe(false);
  expect(feeOf(94160,[94600])).toBe(440); expect(feeOf(90000,[94600])).toBe(0); expect(feeOf(94401,[94600])).toBe(0);
  expect(endOfNextMonth("2025-05-31")).toBe("2025-06-30"); expect(endOfNextMonth("2025-12-31")).toBe("2026-01-31");
  expect(payeeKeyword("大阪信用金庫 森小路支店 普通預金 0227187 カ)トツプウエイ(依頼人名:カ)ヒユアラン 管理番号:1)")).toBe("カ)トツプウエイ");
  expect(payeeKeyword("振込入金 カ)サブスクマ-ケツト")).toBe("カ)サブスクマ-ケツト"); expect(payeeKeyword("関西みらい銀行 深井支店 普通預金 0034959 ヒラノ ジユンヤ(依頼人名:カ)ヒユアラン)")).toBe("ヒラノ ジユンヤ"); expect(payeeKeyword("シノダユウキ,110438,")).toBe("シノダユウキ");
});

it("does not give another partner's transfer and learns only repeated names", async () => {
  const { learnRules } = await import("./run");
  expect(run(undefined,[bank({content:"カ)ホカノカイシャ"})],[{partner:"他社",keywords:["ホカノカイシャ"]}])[0].kind).not.toBe("matched");
  const once = run(undefined,[bank()]);
  expect(learnRules(once,[])).toEqual([]);
  const twice = run([row("1"),row("2",{入出金予定日:"2026-10-02"})],[bank(),bank({mf_transaction_id:"b2",date:"2026-10-02"})]);
  expect(learnRules(twice,[])).toEqual([{partner:"会社",keywords:["カイシャ"]}]);
});
