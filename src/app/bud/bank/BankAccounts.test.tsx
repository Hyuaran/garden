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
    expect(screen.queryByText(/未仕訳/)).not.toBeInTheDocument();
    expect(screen.getByRole("link",{name:"銀行1（ヒュアラン）の明細"})).toHaveAttribute("href","/bud/bank/accounts/1");
    expect(screen.getByText("連携を確認中")).toBeInTheDocument();
    expect(screen.getByRole("link", {name:"Bud"})).toHaveAttribute("href", "/bud/dashboard");
    expect(screen.getByRole("heading", {level:1,name:"口座残高・カード利用"})).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
    expect(screen.getByRole("link",{name:/オリコカード/})).toHaveAttribute("href","/bud/bank/accounts/3?period=current");
    expect(screen.getByText(/1 件・最後 2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText("45 円")).toBeInTheDocument();
    expect(screen.queryByText("999,999 円")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"期間"}));
  fireEvent.click(screen.getByRole("button",{name:"すべて解除"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"先月"}));
  fireEvent.click(screen.getByRole("button",{name:"OK"}));
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
    fireEvent.keyDown(screen.getByRole("button",{name:"ヒュアランをつかんで移動"}),{key:"ArrowDown"});
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
    fireEvent.change(within(form).getByLabelText("MF の知らせメールでの名前"),{target:{value:"銀行_MS"}});
    fireEvent.click(within(form).getByRole("button",{name:"保存"}));
    await waitFor(() => expect(fetcher.mock.calls.some(([,init]) => init?.method === "PATCH")).toBe(true));
    expect(JSON.parse(fetcher.mock.calls.find(([,init]) => init?.method === "PATCH")![1].body)).toMatchObject({action:"settings",viewers:[],book:"補助科目",mail_alias:"銀行_MS"});
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

it("offers available card fiscal years and carries the selected period into details", async () => {
  fetcher.mockImplementation(async () => new Response(JSON.stringify({...data(),accounts:data().accounts.map(a=>({...a,fiscal_start_date:"2026-04-01"})),yearsByAccount:{"3":[2026,2025,2023]}})));
  render(<BankAccounts />);
  await screen.findByText("MF最終更新：2026/10/20(火) 09:30");
  fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
  fireEvent.click(screen.getByRole("button",{name:"期間"}));
  expect(screen.getAllByRole("checkbox").map(o=>o.parentElement?.textContent)).toEqual(["今月","先月","2026年度","2025年度","2023年度"]);
  fireEvent.click(screen.getByRole("button",{name:"すべて解除"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"2025年度"}));
  fireEvent.click(screen.getByRole("button",{name:"OK"}));
  await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url.includes("period=fy%3A2025"))).toBe(true));
  expect(screen.getByRole("link",{name:/オリコカード/})).toHaveAttribute("href","/bud/bank/accounts/3?period=fy%3A2025");
});


it("shows settings alone and searches kana while keeping selected viewers first", async () => {
 const snapshot = {...data(), employees:[{employee_id:"e2",name:"井上"},{employee_id:"e1",name:"閲覧者"},{employee_id:"e3",name:"佐藤",name_kana:"サトウ"}]};
 fetcher.mockImplementation(async()=>new Response(JSON.stringify(snapshot)));
 render(<BankAccounts />); await screen.findByText("銀行1");
 fireEvent.click(screen.getByRole("button",{name:"設定"}));
 expect(screen.queryByRole("table")).not.toBeInTheDocument();
 const gear = screen.getByRole("button",{name:"銀行1（ヒュアラン）の設定"});
 expect(gear.textContent).toBe(""); expect(gear.querySelector("svg")).toBeTruthy(); fireEvent.click(gear);
 const group=screen.getByRole("group",{name:"閲覧権限"});
 expect(within(group).getAllByRole("checkbox")[0]).toHaveAccessibleName("閲覧者");
 fireEvent.change(screen.getByRole("textbox",{name:"名前で探す"}),{target:{value:"さとう"}});
 expect(within(group).getAllByRole("checkbox")).toHaveLength(2);
 expect(within(group).queryByLabelText("井上")).not.toBeInTheDocument();
 expect(within(group).getByLabelText("閲覧者")).toBeChecked();
 expect(within(group).getByLabelText("佐藤")).not.toBeChecked();
 fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
 expect(screen.queryByRole("button",{name:"期間"})).not.toBeInTheDocument();
 expect(screen.queryByRole("link",{name:/オリコカード/})).not.toBeInTheDocument();
 expect(screen.getByRole("button",{name:"オリコカードの設定"})).toBeInTheDocument();
});

it.each(["bank","card"])("saves %s group viewers and shows inherited viewers as locked checked boxes", async kind => {
 const snapshot={...data(),groupViewers:[{kind:"bank",employee_ids:["e1"]},{kind:"card",employee_ids:["e1"]}],employees:[{employee_id:"e1",name:"閲覧者"},{employee_id:"e2",name:"追加する人"}]};
 fetcher.mockImplementation(async (_url:string,init?:RequestInit) => new Response(JSON.stringify(init?.method ? {ok:true} : snapshot)));
 render(<BankAccounts />); await screen.findByText("銀行1");
 if(kind==="card") fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
 fireEvent.click(screen.getByRole("button",{name:"設定"}));
 const title=kind==="bank"?"銀行すべての閲覧権限":"カードすべての閲覧権限";
 expect(screen.getByRole("heading",{name:title})).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:title+"の設定"}));
 const group=screen.getByRole("form",{name:title});
 expect(within(group).getByText("ここに入れた人は、今ある口座と、これから増える口座をすべて見られます")).toBeInTheDocument();
 fireEvent.change(within(group).getByLabelText("名前で探す"),{target:{value:"追加"}});
 fireEvent.click(within(group).getByRole("checkbox",{name:"追加する人"}));
 fireEvent.click(within(group).getByRole("button",{name:"保存"}));
 await waitFor(()=>expect(fetcher.mock.calls.some(([,init])=>init?.method==="PATCH")).toBe(true));
 expect(JSON.parse(fetcher.mock.calls.find(([,init])=>init?.method==="PATCH")![1].body)).toEqual({action:"group-viewers",kind,viewers:["e1","e2"]});
 await waitFor(()=>expect(screen.queryByRole("form",{name:title})).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole("button",{name:kind==="bank"?"銀行1（ヒュアラン）の設定":"オリコカードの設定"}));
 const form=screen.getByRole("form",{name:kind==="bank"?"銀行1（ヒュアラン）の設定":"オリコカードの設定"});
 const inherited=within(form).getByRole("checkbox",{name:/閲覧者すべての口座で閲覧可/});
 expect(inherited).toBeChecked(); expect(inherited).toBeDisabled();
 expect(inherited.closest("label")?.className).toContain("inheritedViewer");
});
it("shows the automatic anchor note next to its editable amount",async()=>{
 const snapshot=data();Object.assign(snapshot.accounts[0],{balance_mode:"arrival",anchor_balance:123,anchor_at:"2026-10-21T03:00:00Z",balance_note:"起点を自動で設定（帳簿＋未仕訳・2026/10/21）"});
 fetcher.mockImplementation(async () => new Response(JSON.stringify(snapshot)));
 render(<BankAccounts />); await screen.findByText("銀行1");
 fireEvent.click(screen.getByRole("button",{name:"設定"}));fireEvent.click(screen.getByRole("button",{name:"銀行1（ヒュアラン）の設定"}));
 const form=screen.getByRole("form",{name:"銀行1（ヒュアラン）の設定"});
 expect(within(form).getByText(snapshot.accounts[0].balance_note)).toBeInTheDocument();
 expect(within(form).getByLabelText("起点の残高（円）")).toHaveValue(123);
});

it("filters the screen by group and individual permissions for a viewer",async()=>{
 const snapshot={...data(false),employeeId:"group",groupViewers:[{kind:"bank",employee_ids:["group"]}]};
 snapshot.accounts[0].visible_employee_ids=[]; snapshot.accounts[1].hidden=true;
 fetcher.mockImplementation(async()=>new Response(JSON.stringify(snapshot)));
 render(<BankAccounts />); await screen.findByText("銀行1");
 expect(screen.queryByRole("link",{name:"銀行2（センターライズ）の明細"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));
 expect(screen.queryByRole("link",{name:/オリコカード/})).not.toBeInTheDocument();
});

it("opens the MF update screen with an explanatory tooltip",async()=>{render(<BankAccounts/>);const link=await screen.findByRole("link",{name:"MF で再取得"});expect(link).toHaveAttribute("href","https://accounting.moneyforward.com/accounts");expect(link).toHaveAttribute("target","_blank");expect(link).toHaveAttribute("rel","noopener noreferrer");expect(link).not.toHaveAttribute("title");expect(link.parentElement?.querySelector('[role="tooltip"]')).toHaveTextContent("MF の画面を開きます。");});

it("saves card order through the existing reorder API",async()=>{fetcher.mockImplementation(async (_url:string,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{ok:true}:{...data(),accounts:[...data().accounts,account("4",{kind:"card",name:"追加カード"})]})));render(<BankAccounts/>);await screen.findByText("銀行1");fireEvent.click(screen.getByRole("tab",{name:"カード利用"}));fireEvent.click(screen.getByRole("button",{name:"並び替え"}));fireEvent.keyDown(screen.getByRole("button",{name:"オリコカードをつかんで移動"}),{key:"ArrowDown"});await waitFor(()=>expect(fetcher.mock.calls.some(([,init])=>init?.method==="PATCH")).toBe(true));expect(JSON.parse(fetcher.mock.calls.find(([,init])=>init?.method==="PATCH")![1].body)).toEqual({action:"reorder",ids:["1","2","4","3"]});expect(document.querySelector("[draggable=true]")).toBeNull();});
