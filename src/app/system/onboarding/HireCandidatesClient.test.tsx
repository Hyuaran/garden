import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import CandidatePanel from "./HireCandidatesClient";
import { useState, type ReactNode } from "react";
function HireCandidatesClient({userId,children}:{userId:string;children:ReactNode}) {
 const [tab,setTab]=useState<"candidates"|"confirmations"|"onboarding">("candidates");
 return <><button role="tab" onClick={()=>setTab("confirmations")}>入社後の確認</button><button role="tab" onClick={()=>setTab("onboarding")}>入社手続き</button>{tab==="onboarding"?children:<CandidatePanel userId={userId} tab={tab}/>}</>;
}
import { CHECKLIST_KEYS } from "./_lib/hire-candidates";
it.each([true,false])("shows request button for hired without request only when writable: %s",async canWrite=>{
 const fetch=vi.fn(async()=>Response.json([{...hired,line_registered:false,filemaker_request:null}]));
 vi.stubGlobal("fetch",fetch);
 render(<CandidatePanel userId={"fm-new-"+canWrite} tab="confirmations" canWrite={canWrite}/>);
 await screen.findByText("入社 太郎");
 if(canWrite){
  fireEvent.click(screen.getByRole("button",{name:"FileMaker に依頼"}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/system/hire-candidates/h/filemaker",expect.objectContaining({method:"POST"})));
 }else expect(screen.queryByRole("button",{name:"FileMaker に依頼"})).not.toBeInTheDocument();
});
it.each(["done","failed"])("shows automatic FileMaker %s and retry",async status=>{
 const fetch=vi.fn(async()=>Response.json([{...hired,line_registered:false,filemaker_request:{status,files:{shain:{status}}}}]));
 vi.stubGlobal("fetch",fetch);
 render(<CandidatePanel userId="fm-test" tab="confirmations"/>);
 expect(await screen.findByText(status==="done"?"自動：作成済み":"自動：失敗（社員情報）")).toBeVisible();
 if(status==="failed"){
  fireEvent.click(screen.getByRole("button",{name:"もう一度"}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/system/hire-candidates/h/filemaker",expect.objectContaining({method:"POST"})));
 }
});
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute("open","");}});
 Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute("open");}});
});
const row={id:"c",last_name:"山田",first_name:"太郎",hire_date:"2026-10-24",employment_type:"アルバイト",status:"planned",employee_number:null,steps:{}};
const stoppedRow={...row,status:"hiring",employee_number:"1572",steps:{number:{done:true},kot:{done:true},roster:{done:false,error:"社員番号 1572 の名簿を確認してください。"}}};
it.each(["planned","hiring"])("shows success for %s and closes after three seconds",async status=>{
 let current={...row,status};
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith("kot-options"))return Response.json({companies:[],divisions:[],workingTypes:[]});
  if(init?.method==="POST"){
   if(init.body===JSON.stringify({prepare:true}))return Response.json({...current,employee_number:"1572"});
   current={...current,status:"hired"};return Response.json({...current,employee_number:"1572"});
  }
  return Response.json([{...current,steps:current.status==="hiring"?stoppedRow.steps:{}}]);
 }));
 render(<CandidatePanel userId="success" tab="candidates"/>);
 fireEvent.click(await screen.findByRole("button",{name:status==="planned"?"入社":"続きから"}));
 if(status==="planned"){
  await waitFor(()=>expect(screen.getByRole("button",{name:"登録する"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"登録する"}));
 }
 const dialog=await screen.findByRole("dialog",{name:"入社の登録が完了しました"});
 expect(within(dialog).getByRole("status")).toHaveTextContent("社員番号 1572");
 expect(within(dialog).getAllByRole("listitem")).toHaveLength(5);
 // Restart the effect with fake timers so the full three-second boundary is deterministic.
 cleanup();vi.useFakeTimers();
 try {
  current={...current,status:"hiring"};
  render(<CandidatePanel userId="success-timer" tab="candidates"/>);
  await act(async()=>{await Promise.resolve();});
  fireEvent.click(screen.getByRole("button",{name:"続きから"}));
  await act(async()=>{await Promise.resolve();});
  act(()=>vi.advanceTimersByTime(2999));
  expect(screen.getByRole("dialog",{name:"入社の登録が完了しました"})).toBeVisible();
  act(()=>vi.advanceTimersByTime(1));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 } finally {cleanup();vi.useRealTimers();}
});
it("opens the stop dialog after registration and from the stopped row without editing",async()=>{
 let current: typeof row | typeof stoppedRow=row;
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith("kot-options"))return Response.json({companies:[],divisions:[],workingTypes:[]});
  if(init?.method==="POST"){
   if(init.body===JSON.stringify({prepare:true}))return Response.json({...row,employee_number:"1572"});
   current=stoppedRow;return Response.json(stoppedRow);
  }
  return Response.json([current]);
 }));
 render(<CandidatePanel userId="admin" tab="candidates"/>);
 fireEvent.click(await screen.findByRole("button",{name:"入社"}));
 await screen.findByRole("dialog",{name:"入社の確認"});
 await waitFor(()=>expect(screen.getByRole("button",{name:"登録する"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"登録する"}));
 const dialog=await screen.findByRole("dialog",{name:"入社の登録が途中で止まりました"});
 const items=within(dialog).getAllByRole("listitem");
 expect(items.map(item=>item.textContent?.slice(0,1))).toEqual(["◎","◎","✕","✕","✕"]);
 expect(items[2].className).toContain("hireError");
 expect(within(dialog).getByRole("status")).toHaveTextContent("1572");
 expect(screen.getByText("名簿で止まっています").className).toContain("hireError");
 expect(screen.getByText("山田 太郎",{selector:"td"}).closest("tr")?.querySelector("ol")).toBeNull();
 fireEvent.click(within(dialog).getByRole("button",{name:"閉じる"}));
 fireEvent.click(screen.getByText("山田 太郎",{selector:"td"}));
 expect(await screen.findByRole("dialog",{name:"入社の登録が途中で止まりました"})).toBeVisible();
 expect(screen.queryByRole("dialog",{name:"入社予定者を修正"})).not.toBeInTheDocument();
 fireEvent(screen.getByRole("dialog"),new Event("cancel",{cancelable:true}));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does nothing when an in-progress row is clicked",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json([{...row,status:"hiring"}])));
 render(<CandidatePanel userId="admin" tab="candidates"/>);
 fireEvent.click(await screen.findByText("山田 太郎"));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"続きから"})).not.toBeInTheDocument();
});
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("shows candidate tab only in its super-admin wrapper and preserves the old list",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json([row])));
 render(<HireCandidatesClient userId="admin-1"><p>既存の入社手続き一覧</p></HireCandidatesClient>);
 expect(await screen.findByText("山田 太郎")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("tab",{name:"入社手続き"}));expect(screen.getByText("既存の入社手続き一覧")).toBeVisible();
});
const fullChecklist=Object.fromEntries(CHECKLIST_KEYS.map(key=>[key,{checked_at:"2026-10-26",checked_by:"admin"}]));
const hired={...row,id:"h",last_name:"入社",status:"hired",employee_number:"1571",onboarding_status:"submitted",line_registered:true,checklist:fullChecklist};
it("splits statuses, hides completed hires, and remembers visibility per user",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json([row,{...row,id:"working",last_name:"処理",status:"hiring"},{...row,id:"absent",last_name:"欠席",status:"no_show"},hired,{...hired,id:"pending",last_name:"未確認",line_registered:false}])));
 const view=render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 expect(await screen.findByText("山田 太郎")).toBeVisible();
 expect(screen.getByText("処理 太郎")).toBeVisible();
 expect(screen.queryByText("欠席 太郎")).not.toBeInTheDocument();
 expect(screen.queryByText("入社 太郎")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("checkbox",{name:"辞退した人も表示"}));
 expect(screen.getByText("欠席 太郎")).toBeVisible();
 fireEvent.click(screen.getByRole("tab",{name:"入社後の確認"}));
 expect(screen.getByText("未確認 太郎")).toBeVisible();
 expect(screen.queryByText("入社 太郎")).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"＋ 入社予定者を登録"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("checkbox",{name:"完了も表示"}));
 expect(screen.getByText("入社 太郎")).toBeVisible();
 expect(screen.getByText("完了")).toBeVisible();
 view.unmount();
 const restored=render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 expect(screen.getByRole("checkbox",{name:"辞退した人も表示"})).toBeChecked();
 fireEvent.click(screen.getByRole("tab",{name:"入社後の確認"}));
 expect(screen.getByRole("checkbox",{name:"完了も表示"})).toBeChecked();
 restored.unmount();
 render(<HireCandidatesClient userId="admin-2"><p>既存一覧</p></HireCandidatesClient>);
 expect(screen.getByRole("checkbox",{name:"辞退した人も表示"})).not.toBeChecked();
});
it("saves checks immediately, removes completed hires, and restores failed saves",async()=>{
 const pending={...hired,checklist:{...fullChecklist,filemaker_added:undefined}};
 const fetch=vi.fn(async(_url:string,init?:RequestInit)=>init?.method==="PATCH"?Response.json(hired):Response.json([pending]));
 vi.stubGlobal("fetch",fetch);
 render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 fireEvent.click(screen.getByRole("tab",{name:"入社後の確認"}));
 fireEvent.click(await screen.findByRole("checkbox",{name:"入社 太郎 FileMaker 追加済み"}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/system/hire-candidates/h",expect.objectContaining({method:"PATCH",body:JSON.stringify({checklist:{filemaker_added:true}})})));
 await waitFor(()=>expect(screen.queryByText("入社 太郎")).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole("checkbox",{name:"完了も表示"}));
 const check=screen.getByRole("checkbox",{name:"入社 太郎 FileMaker 追加済み"});
 await waitFor(()=>expect(check).toBeEnabled());
 fetch.mockImplementation(async()=>Response.json({error:"保存失敗"},{status:500}));
 fireEvent.click(check);
 expect(await screen.findByRole("alert")).toHaveTextContent("保存失敗");
 expect(check).toBeChecked();
});
it("skips LINE, restores it and prioritizes registration",async()=>{
 let current={...hired,line_registered:false,checklist:{...fullChecklist}};
 vi.stubGlobal("fetch",vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method==="PATCH"){
   const value=JSON.parse(String(init.body)).checklist.line_skipped;
   current={...current,checklist:{...fullChecklist,...(value?{line_skipped:{checked_at:"now",checked_by:"admin"}}:{})}};
   return Response.json(current);
  }
  return Response.json([current]);
 }));
 const view=render(<CandidatePanel userId="line-test" tab="confirmations"/>);
 fireEvent.click(await screen.findByRole("button",{name:"登録しない"}));
 const dialog=screen.getByRole("dialog",{name:"公式 LINE を登録しない"});
 expect(dialog).toHaveTextContent("ガラケー");
 fireEvent.click(within(dialog).getByRole("button",{name:"登録しない"}));
 await waitFor(()=>expect(screen.queryByText("入社 太郎")).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole("checkbox",{name:"完了も表示"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"戻す"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"戻す"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"登録しない"})).toBeEnabled());
 expect(screen.getByText("未登録")).toBeVisible();
 view.unmount();
 current={...current,line_registered:true,checklist:{...fullChecklist,line_skipped:{checked_at:"now",checked_by:"admin"}}};
 render(<CandidatePanel userId="line-test" tab="confirmations"/>);
 expect(await screen.findByText("登録済み")).toBeVisible();
 expect(screen.queryByRole("button",{name:"戻す"})).not.toBeInTheDocument();
});
it("works when localStorage is unavailable",async()=>{
 vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("blocked");});
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("blocked");});
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json([row])));
 render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 expect(await screen.findByText("山田 太郎")).toBeVisible();
 fireEvent.click(screen.getByRole("checkbox",{name:"辞退した人も表示"}));
 expect(screen.getByRole("checkbox",{name:"辞退した人も表示"})).toBeChecked();
});
it("confirms the persisted employee number and does not hire on cancellation",async()=>{
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>Response.json(init?.method==="POST"?{...row,employee_number:"1571"}:[row]));vi.stubGlobal("fetch",fetch);
 render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 fireEvent.click(await screen.findByRole("button",{name:"入社"}));
 expect(await screen.findByRole("dialog",{name:"入社の確認"})).toHaveTextContent("社員番号 1571");
 await waitFor(()=>expect(screen.getByRole("button",{name:"やめる"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"やめる"}));
 expect(fetch.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);
 expect(fetch.mock.calls.find(([,init])=>init?.method==="POST")?.[1]?.body).toBe(JSON.stringify({prepare:true}));
 expect(screen.queryByRole("heading",{name:"入社予定者を修正"})).not.toBeInTheDocument();
});

it("opens the row editor and registration dialog, closes on cancel and backdrop, and searches kana",async()=>{
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>Response.json(url.endsWith("kot-options")?{companies:[],divisions:[],workingTypes:[]}:[{...row,last_name_kana:"ヤマダ",first_name_kana:"タロウ"},{...row,id:"w",last_name:"処理",status:"hiring"},{...row,id:"n",last_name:"欠席",status:"no_show"}])));
 render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 const name=await screen.findByText("山田 太郎");
 expect(name.closest("tr")).toHaveAttribute("tabindex","0");
 expect(screen.getByText("処理 太郎").closest("tr")).not.toHaveAttribute("tabindex");
 fireEvent.click(screen.getByRole("checkbox",{name:"辞退した人も表示"}));
 expect(screen.getByText("欠席 太郎").closest("tr")).not.toHaveAttribute("tabindex");
 expect(screen.getByText("辞退",{selector:"span"})).toBeVisible();
 fireEvent.click(name);
 const dialog=await screen.findByRole("dialog",{name:"入社予定者を修正"});
 fireEvent(dialog,new Event("cancel",{cancelable:true}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 await waitFor(()=>expect(screen.getByRole("button",{name:"＋ 入社予定者を登録"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"＋ 入社予定者を登録"}));
 const registration=await screen.findByRole("dialog",{name:"入社予定者を登録"});
 fireEvent.click(registration,{clientX:-10,clientY:-10});
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 fireEvent.change(screen.getByPlaceholderText("氏名・カナで探す"),{target:{value:"ヤマダタロウ"}});
 expect(screen.getByText("山田 太郎")).toBeVisible();
 expect(screen.queryByText("処理 太郎")).not.toBeInTheDocument();
});
it("declines without opening the editor and retains the no_show database value",async()=>{
 const fetch=vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method==="PATCH"?{...row,status:"no_show"}:[row]));
 vi.stubGlobal("fetch",fetch);
 render(<HireCandidatesClient userId="admin-1"><p>既存一覧</p></HireCandidatesClient>);
 fireEvent.click(await screen.findByRole("button",{name:"辞退"}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/system/hire-candidates/c",expect.objectContaining({method:"PATCH",body:JSON.stringify({status:"no_show"})})));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.queryByRole("heading",{name:"入社予定者を修正"})).not.toBeInTheDocument();
});

