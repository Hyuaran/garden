import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BankAccounts, { formatLoadedAt } from "./BankAccounts";
import type { MfAccount } from "@/lib/bud/mf/types";

const account = (id: string, overrides: Partial<MfAccount> = {}): MfAccount => ({ mf_account_id:id,name:`銀行${id}｜${id === "1" ? "HR" : "CR"}`,kind:"bank",sub_account_label:"支店",sort_order:Number(id),hidden:false,visible_employee_ids:["e1"],book_sub_account_name:"普通",balance_mode:"auto",balance_note:"",balance:100,unjournalized_count:2,fetched_at:"2026-10-20T00:30:12Z", ...overrides });
const data = (admin = true) => ({ admin,axes:[{axis:"corp",key:"HR",sort_order:0},{axis:"corp",key:"CR",sort_order:1},{axis:"bank",key:"銀行1",sort_order:0},{axis:"bank",key:"銀行2",sort_order:1}],accounts:[account("1"),account("2",{balance_mode:"manual_check",balance_note:"連携を確認中"}),account("3",{kind:"card",name:"オリコカード",balance:999999})],employees:[{employee_id:"e1",name:"閲覧者"}],transactions:[{mf_transaction_id:"t",mf_account_id:"3",date:"2026-10-01",content:"備品",value:45,side:"EXPENSE",journalizing_status:"none",fetched_at:"now"}] });
const fetcher = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch",fetcher); fetcher.mockReset(); fetcher.mockImplementation(async (_url:string,init?:RequestInit) => new Response(JSON.stringify(init?.method ? {ok:true} : data()))); });
describe("bank accounts screen", () => {
  it("formats the loaded time in Japan", () => { expect(formatLoadedAt("2026-10-20T10:30:00Z")).toBe("2026/10/20(火) 19:30"); });
  it("shows only automatic bank balances in the total and card history without balances", async () => {
    render(<BankAccounts />);
    await screen.findByText("MF最終更新：2026/10/20(火) 09:30");
    expect(screen.getAllByText("100 円")).toHaveLength(5);
    expect(screen.getByText("MFで確認")).toBeInTheDocument();
    expect(screen.getByText("連携を確認中")).toBeInTheDocument();
    expect(screen.getByRole("link", {name:"Bud"})).toHaveAttribute("href", "/bud/dashboard");
    expect(screen.getByRole("heading", {level:1,name:"口座残高・カード利用"})).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
    expect(screen.getByText("備品")).toBeInTheDocument();
    expect(screen.getByText("45 円")).toBeInTheDocument();
    expect(screen.queryByText("999,999 円")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("期間"),{target:{value:"last"}});
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.includes("period=last"))).toBe(true));
  });
  it("shows the refresh icon as busy until the reload completes", async () => {
    let finish!: (response: Response) => void;
    fetcher.mockImplementation(async (_url:string, init?:RequestInit) => init?.method === "POST" ? new Promise<Response>(resolve => { finish = resolve; }) : new Response(JSON.stringify(data())));
    render(<BankAccounts />);
    await screen.findByText("銀行1");
    const refresh = screen.getByRole("button", {name:"読み直す"});
    fireEvent.click(refresh);
    expect(refresh).toHaveAttribute("aria-busy", "true");
    expect(refresh).toBeDisabled();
    expect(fetcher).toHaveBeenCalledWith("/api/bud/mf-accounts/refresh", expect.objectContaining({method:"POST"}));
    finish(new Response(JSON.stringify({ok:true})));
    await waitFor(() => expect(refresh).toHaveAttribute("aria-busy", "false"));
    expect(refresh).not.toBeDisabled();
  });
  it("changes order immediately, then saves all account IDs in the background", async () => {
    render(<BankAccounts />);
    await screen.findByText("銀行1");
    fireEvent.click(screen.getByRole("button",{name:"並び替え"}));
    fireEvent.click(screen.getByRole("button",{name:"ヒュアランを下へ"}));
    expect(screen.getAllByRole("rowheader")[0]).toHaveTextContent("センターライズ");
    await waitFor(() => expect(fetcher.mock.calls.some(([,init]) => init?.method === "PATCH")).toBe(true));
    const body = JSON.parse(fetcher.mock.calls.find(([,init]) => init?.method === "PATCH")![1].body);
    expect(body).toEqual({action:"axis-order",axis:"corp",keys:["CR","HR"]});
  });
  it("saves viewers and balance settings from the employee picker", async () => {
    render(<BankAccounts />); await screen.findByText("銀行1");
    fireEvent.click(screen.getByRole("button",{name:"設定"}));
    fireEvent.click(screen.getByRole("button",{name:"銀行1（ヒュアラン）の設定"}));
    const form = screen.getByRole("form",{name:"銀行1（ヒュアラン）の設定"});
    fireEvent.click(within(form).getByLabelText("閲覧者"));
    fireEvent.change(within(form).getByLabelText(/^帳簿の補助科目名/),{target:{value:"補助科目"}});
    fireEvent.click(within(form).getByRole("button",{name:"保存"}));
    await waitFor(() => expect(fetcher.mock.calls.some(([,init]) => init?.method === "PATCH")).toBe(true));
    expect(JSON.parse(fetcher.mock.calls.find(([,init]) => init?.method === "PATCH")![1].body)).toMatchObject({action:"settings",viewers:[],book:"補助科目"});
  });
  it("keeps the old timestamp and values on refresh failure and hides admin controls from viewers", async () => {
    fetcher.mockImplementation(async (_url:string,init?:RequestInit) => new Response(JSON.stringify(init?.method ? {error:"MF に接続できませんでした"} : data(false)),{status:init?.method ? 502 : 200}));
    render(<BankAccounts />); await screen.findByText("銀行1");
    expect(screen.queryByRole("button",{name:"設定"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"並び替え"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"読み直す"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("MF に接続できませんでした");
    expect(screen.getByText("MF最終更新：2026/10/20(火) 09:30")).toBeInTheDocument();
    expect(screen.getAllByText("100 円")).toHaveLength(5);
  });
});

it("shows and saves the bank anchor fields",async()=>{
 render(<BankAccounts />); await screen.findByText("銀行1");
 fireEvent.click(screen.getByRole("button",{name:"設定"}));
 fireEvent.click(screen.getByRole("button",{name:"銀行1（ヒュアラン）の設定"}));
 fireEvent.change(screen.getByLabelText("残高の出し方"),{target:{value:"anchor"}});
 fireEvent.change(screen.getByLabelText("起点の残高（円）"),{target:{value:"3842313"}});
 fireEvent.change(screen.getByLabelText("起点の日"),{target:{value:"2026-10-21"}});
 fireEvent.click(screen.getByRole("button",{name:"保存"}));
 await waitFor(()=>expect(fetcher.mock.calls.some(([,init])=>init?.method === "PATCH")).toBe(true));
 expect(JSON.parse(fetcher.mock.calls.find(([,init])=>init?.method === "PATCH")![1].body)).toMatchObject({mode:"anchor",anchor_balance:3842313,anchor_date:"2026-10-21"});
});
