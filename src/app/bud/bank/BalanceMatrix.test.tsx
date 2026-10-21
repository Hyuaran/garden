import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import BalanceMatrix from "./BalanceMatrix";
import type { MfAccount } from "@/lib/bud/mf/types";
const account = (id: string, name: string, balance: number): MfAccount => ({mf_account_id:id,name,kind:"bank",sort_order:0,hidden:false,visible_employee_ids:[],book_sub_account_name:"",balance_mode:"auto",balance_note:"",balance,unjournalized_count:2,sub_account_label:"",fetched_at:"now"});
describe("balance matrix controls", () => {
 it("shows arrival income and expense beside the group delta instead of the snapshot delta", () => {
  render(<BalanceMatrix accounts={[account("1","みずほ銀行｜HR",100)]} arrivalTotal={{income:358600,expense:1265775,delta:-907175}} reordering={false} onError={vi.fn()} />);
  const total = screen.getByText("グループ合計").parentElement!;
  expect(total).toHaveTextContent("↓ ▲907,175（入金 358,600・出金 1,265,775）");
  expect(total).not.toHaveTextContent("0 時から");
 });
 it("moves bank columns with arrows and drag, saves shared keys, and renders daily changes", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch",fetcher);
  const accounts=[account("1","みずほ銀行｜HR",100),account("2","楽天銀行｜HR",50)];
  render(<BalanceMatrix accounts={accounts} axes={[{axis:"bank",key:"みずほ銀行",sort_order:0},{axis:"bank",key:"楽天銀行",sort_order:1}]} snapshots={[{mf_account_id:"1",snapshot_date:"2026-10-20",balance:80,taken_at:"now"},{mf_account_id:"2",snapshot_date:"2026-10-20",balance:60,taken_at:"now"}]} reordering onError={vi.fn()} />);
  expect(screen.getAllByText("↑ +10").length).toBeGreaterThan(0);
  expect(screen.getAllByText("↓ ▲10").length).toBeGreaterThan(0);
  fireEvent.keyDown(screen.getByRole("button",{name:"みずほ銀行をつかんで移動"}),{key:"ArrowRight"});
  expect(screen.getAllByRole("columnheader")[1]).toHaveTextContent("楽天銀行");
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({action:"axis-order",axis:"bank",keys:["楽天銀行","みずほ銀行"]});
  fireEvent.keyDown(screen.getByRole("button",{name:"みずほ銀行をつかんで移動"}),{key:"ArrowLeft"});
  expect(screen.getAllByRole("columnheader")[1]).toHaveTextContent("みずほ銀行");
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  expect(within(screen.getByRole("region")).getByRole("table")).toBeInTheDocument();
 });
 it("contains wide tables in their scroll region and keeps corporation headers sticky", () => {
  const css=readFileSync("src/app/bud/bank/bank.module.css","utf8");
  expect(css).toMatch(/\.tableWrap[^}]*max-width:100%[^}]*overflow:auto/);
  expect(css).toMatch(/\.matrix th:first-child[^}]*position:sticky; left:0/);
  expect(css).toContain("min-width:max-content");
 });
});
