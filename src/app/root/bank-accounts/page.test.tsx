import { fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({canWrite:true,from:vi.fn(),insert:vi.fn(),update:vi.fn(),eq:vi.fn(),single:vi.fn(),read:vi.fn(),audit:vi.fn()}));
vi.mock("../_lib/supabase",()=>({supabase:{from:m.from}}));
vi.mock("../_lib/read-data",()=>({readRootData:m.read}));
vi.mock("../_state/RootStateContext",()=>({useRootState:()=>({canWrite:m.canWrite,rootUser:null})}));
vi.mock("../_lib/audit",()=>({writeAudit:m.audit}));
vi.mock("../_lib/useMasterShortcuts",()=>({useMasterShortcuts:()=>({activeIndex:-1})}));
import Page from "./page";
const account={id:"uuid-1",corp_code:"hyuaran",bank_code:"kyoto",bank_name:"京都銀行",branch_name:"本店",branch_code:"001",account_type:"普通",account_number:"0012345",sub_account_label:"京都補助",has_csv_export:true,needs_manual_balance:false,notes:"メモ",is_active:true,created_at:"2026-01-01",updated_at:"2026-01-01",manual_balance_20260430:12345};
const fields={branch_name:"本店",branch_code:"001",account_type:"普通",sub_account_label:"京都補助",has_csv_export:true,needs_manual_balance:false,notes:"メモ"};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))); });
beforeEach(()=>{m.canWrite=true;vi.clearAllMocks();m.read.mockImplementation(async (dataset:string)=>dataset==="corporations"?[{id:"hyuaran",name_short:"法人短名"}]:Array.from({length:12},(_,i)=>({...account,id:"uuid-"+(i+1),account_number:String(i).padStart(7,"0")})));m.eq.mockResolvedValue({error:null});m.single.mockResolvedValue({data:{id:"new-uuid"},error:null});m.insert.mockReturnValue({select:()=>({single:m.single})});m.update.mockReturnValue({eq:m.eq});m.from.mockReturnValue({insert:m.insert,update:m.update});});
async function editRows() { const labels=await screen.findAllByText("京都銀行"); return labels.map(label=>label.closest("tr") ?? label.closest("button")!); }
function currentEditRows() { return screen.getAllByText("京都銀行").map(label=>label.closest("tr") ?? label.closest("button")!); }
describe("銀行口座マスタ",()=>{
 it.each([375,760])("%ipxでは12口座をカードで表示し、すべて編集できる",async(width)=>{
   vi.stubGlobal("matchMedia",vi.fn((query:string)=>({matches:width<=760 && query==="(max-width: 760px)",addEventListener:vi.fn(),removeEventListener:vi.fn()})));
   render(<Page/>);
   expect(await editRows()).toHaveLength(12);
   expect(screen.queryByRole("table")).not.toBeInTheDocument();
   expect(screen.getAllByRole("article")).toHaveLength(12);
   for(let i=0;i<12;i++) {
     fireEvent.click(screen.getByRole("button",{name:`法人短名 京都銀行 ${String(i).padStart(7,"0")}を編集`}));
     expect(screen.getByLabelText(/^口座番号/)).toHaveValue(String(i).padStart(7,"0"));
     fireEvent.click(screen.getByRole("button",{name:"キャンセル"}));
   }
   fireEvent.click(currentEditRows()[11]);
   expect(screen.getByLabelText(/^口座番号/)).toHaveValue("0000011");
 });
 it("追加時はCSVがオンで、文字のクリックでも切り替えられる",async()=>{
   render(<Page/>);
   await editRows();
   fireEvent.click(screen.getByRole("button",{name:"+ 新規追加"}));
   const csv=screen.getByRole("checkbox",{name:"CSV で明細を取り込める"});
   expect(csv).toBeChecked();
   fireEvent.click(screen.getByText("CSV で明細を取り込める"));
   expect(csv).not.toBeChecked();
   expect(screen.getByRole("checkbox",{name:"残高を手で入れる"})).not.toBeChecked();
 });
 it("取得した法人の設立順、銀行、口座番号の順に表示する",async()=>{
   m.read.mockImplementation(async(dataset:string)=>dataset==="corporations"
     ? [{id:"ichi",name_short:"先の法人"},{id:"hyuaran",name_short:"後の法人"}]
     : [
       {...account,id:"a",corp_code:"hyuaran",account_number:"9999999"},
       {...account,id:"b",corp_code:"ichi",bank_code:"rakuten",account_number:"3333333"},
       {...account,id:"c",corp_code:"ichi",account_number:"2222222"},
       {...account,id:"d",corp_code:"ichi",account_number:"1111111"},
     ]);
   render(<Page/>);
   await editRows();
   const rows=Array.from(screen.getByRole("table").querySelectorAll("tbody tr"));
   expect(rows.map(row=>row.querySelectorAll("td")[2].textContent?.replace("普通 ",""))).toEqual(["1111111","2222222","3333333","9999999"]);
 });
 it("実際の形式の12口座を法人短名とともに表示する",async()=>{render(<Page/>);expect(await editRows()).toHaveLength(12);expect(screen.getAllByText("法人短名").length).toBeGreaterThan(11);expect(screen.getByText("0000000")).toHaveAttribute("data-clarity-mask","true");});
 it("追加はidなしでinsertし、DBのidで監査する",async()=>{render(<Page/>);await editRows();fireEvent.click(screen.getByRole("button",{name:"+ 新規追加"}));fireEvent.change(screen.getByLabelText(/^口座番号/),{target:{value:"0012345"}});fireEvent.click(screen.getByRole("button",{name:"保存"}));await waitFor(()=>expect(m.insert).toHaveBeenCalled());const payload=m.insert.mock.calls[0][0];expect(payload).not.toHaveProperty("id");expect(payload).not.toHaveProperty("manual_balance_20260430");expect(payload).toMatchObject({corp_code:"hyuaran",bank_code:"mizuho",bank_name:"みずほ銀行",account_number:"0012345"});await waitFor(()=>expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({targetId:"new-uuid"})));});
 it("編集は変更可能列のみをidで更新する",async()=>{render(<Page/>);fireEvent.click((await editRows())[0]);expect(screen.getByLabelText(/^法人/,{selector:"select:disabled"})).toBeDisabled();expect(screen.getByLabelText(/^銀行/,{selector:"select"})).toBeDisabled();expect(screen.getByLabelText(/^口座番号/)).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"保存"}));await waitFor(()=>expect(m.update).toHaveBeenCalledWith(fields));expect(m.eq).toHaveBeenCalledWith("id","uuid-1");expect(m.insert).not.toHaveBeenCalled();});
 it("停止はis_activeだけをidで更新する",async()=>{render(<Page/>);fireEvent.click((await editRows())[0]);expect(screen.queryByRole("columnheader",{name:"操作"})).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"停止"}));expect(m.update).not.toHaveBeenCalled();fireEvent.click(within(screen.getByRole("dialog",{name:"停止の確認"})).getByRole("button",{name:"停止"}));await waitFor(()=>expect(m.update).toHaveBeenCalledWith({is_active:false}));expect(m.eq).toHaveBeenCalledWith("id","uuid-1");});
 it("重複エラーを日本語で表示する",async()=>{m.eq.mockResolvedValue({error:{code:"23505",message:"duplicate"}});render(<Page/>);fireEvent.click((await editRows())[0]);fireEvent.click(screen.getByRole("button",{name:"保存"}));expect(await screen.findByText("同じ法人・銀行・口座番号の口座がもうあります")).toBeInTheDocument();});
});

describe("銀行口座の空欄と保存エラー",()=>{
 it.each([false,true])("空の任意欄をnullで送る（編集=%s）",async(edit)=>{
   render(<Page/>);await editRows();
   fireEvent.click(edit?currentEditRows()[0]:screen.getByRole("button",{name:"+ 新規追加"}));
   if(!edit) fireEvent.change(screen.getByLabelText(/^口座番号/),{target:{value:"0012345"}});
   for(const label of [/^支店名/,/^支店コード/,/^弥生の補助科目名/,/^メモ/]) fireEvent.change(screen.getByLabelText(label),{target:{value:"  "}});
   fireEvent.click(screen.getByRole("button",{name:"保存"}));
   await waitFor(()=>expect(edit?m.update:m.insert).toHaveBeenCalledWith(expect.objectContaining({branch_name:null,branch_code:null,sub_account_label:null,notes:null})));
 });
 it("任意欄の前後の空白を除く",async()=>{
   render(<Page/>);fireEvent.click((await editRows())[0]);
   for(const [label,value] of [[/^支店名/," 本店 "],[/^支店コード/," 001 "],[/^弥生の補助科目名/," 京都補助 "],[/^メモ/," メモ "]] as const) fireEvent.change(screen.getByLabelText(label),{target:{value}});
   fireEvent.click(screen.getByRole("button",{name:"保存"}));
   await waitFor(()=>expect(m.update).toHaveBeenCalledWith(fields));
 });
 it.each(["23505","23514","42501"])("保存失敗%sを小窓内の保存ボタン上に表示する",async(code)=>{
   m.eq.mockResolvedValue({error:{code}});render(<Page/>);
   fireEvent.click((await editRows())[0]);
   fireEvent.click(screen.getByRole("button",{name:"保存"}));
   const dialog=screen.getByRole("dialog");const alert=await within(dialog).findByRole("alert");
   expect(screen.getAllByRole("alert")).toHaveLength(1);
   expect(alert.compareDocumentPosition(within(dialog).getByRole("button",{name:"保存"})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
   if(code==="23514") expect(alert).toHaveTextContent("入力の形が正しくありません（支店コードは数字3桁か空・口座番号は数字だけ）");
 });
 it("入力チェックの帯も小窓内に表示する",async()=>{
   render(<Page/>);await editRows();
   fireEvent.click(screen.getByRole("button",{name:"+ 新規追加"}));
   fireEvent.click(screen.getByRole("button",{name:"保存"}));
   expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();
   expect(m.insert).not.toHaveBeenCalled();
 });
});

it("閲覧者には行から編集を開かせない",async()=>{m.canWrite=false;render(<Page/>);await editRows();const tr=screen.getByText("0000000").closest("tr")!;expect(tr).not.toHaveAttribute("tabindex");fireEvent.click(tr);expect(screen.queryByRole("dialog")).not.toBeInTheDocument();});
it("Enter と Space で行を開き、停止の確認を取り消せる",async()=>{render(<Page/>);const rows=await editRows();for(const key of ["Enter"," "]){fireEvent.keyDown(rows[0],{key});fireEvent.click(screen.getByRole("button",{name:"停止"}));fireEvent.click(screen.getByRole("button",{name:"やめる"}));expect(m.update).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"キャンセル"}));}});
