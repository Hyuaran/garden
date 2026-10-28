import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Forwarding } from "@/lib/mail-forwarding/domain";
const state = vi.hoisted(() => ({ rows: [] as Forwarding[], role:"super_admin", fail:false, pending:undefined as undefined | ((v: unknown)=>void), rpc:vi.fn(), insert:vi.fn() }));
vi.mock("../_state/RootStateContext",()=>({useRootState:()=>({gardenRole:state.role})}));
vi.mock("../_components/PageHeader",()=>({PageHeader:({title}:{title:string})=><h1>{title}</h1>}));
vi.mock("@/app/system/_components/StickyTable/useStickyTable",()=>({default:({children}:{children:React.ReactNode})=><table>{children}</table>}));
vi.mock("../_lib/supabase",()=>({supabase:{
 from:()=>({select:async()=>({data:state.rows,error:null}),insert:(value:unknown)=>{state.insert(value);return Promise.resolve({error:state.fail?new Error("failed"):null});},update:()=>({eq:()=>({select:()=>({single:async()=>({error:null})})})})}),
 rpc:(...args:unknown[])=>{state.rpc(...args);return new Promise(resolve=>{state.pending=resolve;});},
}}));
import Page from "./page";
beforeEach(()=>{
 state.rows=[];state.role="super_admin";state.fail=false;state.pending=undefined;state.rpc.mockClear();state.insert.mockClear();
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
async function ready(){render(<Page/>);await waitFor(()=>expect(screen.getByRole("button",{name:"転送を追加"})).toBeEnabled());}
it("追加はすぐ一覧に反映し、失敗すれば元に戻す",async()=>{
 await ready();fireEvent.click(screen.getByRole("button",{name:"転送を追加"}));
 const dialog=screen.getByRole("dialog");
 for(const [label,value] of [["名義（必須）","新しい転送"],["転送元の住所（必須）","大阪"],["転送先の住所（必須）","東京"]]) fireEvent.change(within(dialog).getByLabelText(label),{target:{value}});
 fireEvent.click(within(dialog).getByRole("button",{name:"保存"}));
 expect(screen.getByText("新しい転送")).toBeInTheDocument();expect(state.rpc).toHaveBeenCalledWith("root_mail_forwarding_create",expect.anything());
 state.pending?.({error:new Error("failed")});
 await waitFor(()=>expect(screen.queryByText("新しい転送")).not.toBeInTheDocument());expect(screen.getByRole("alert")).toHaveTextContent("変更を戻しました");
});
it("届け直しは以前の記録を残して行を追加する",async()=>{
 state.rows=[{id:"a",holder:"転送先会社",from_address:"大阪",to_address:"東京",notes:"",stopped:false,filings:[{id:"f",forwarding_id:"a",filed_on:"2025-10-15",method:"窓口",receipt:"古い番号",filed_by:"担当者",notes:"旧記録"}]}];
 await ready();fireEvent.click(screen.getByRole("button",{name:"届け直した"}));fireEvent.change(screen.getByLabelText("新しい届出日（必須）"),{target:{value:"2026-10-28"}});fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"保存"}));
 await waitFor(()=>expect(screen.getByText("2027-10-27")).toBeInTheDocument());
 expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({forwarding_id:"a",filed_on:"2026-10-28",method:"e転居"}));
 fireEvent.click(screen.getByText("転送先会社"));expect(screen.getByText("旧記録")).toBeInTheDocument();expect(screen.getByText("2026-10-28・e転居")).toBeInTheDocument();
});
it("閲覧を許可された管理者にも書き込み操作を出さない",async()=>{
 state.role="admin";render(<Page/>);await waitFor(()=>expect(screen.queryByText("読み込んでいます。")).not.toBeInTheDocument());expect(screen.queryByRole("button",{name:"転送を追加"})).not.toBeInTheDocument();
});
