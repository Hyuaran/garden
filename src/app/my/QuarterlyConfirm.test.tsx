import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import QuarterlyConfirm from "./QuarterlyConfirm";
import { SELF_CONFIRM_CATEGORIES } from "@/app/system/mypage/_lib/quarterly-confirm";

vi.mock("@/app/_lib/supabase/browser",()=>({createBrowserClient:vi.fn()}));
vi.mock("@/app/system/mypage/_components/SubmissionModal",()=>({default:({onSent}:{onSent:()=>void})=><button onClick={onSent}>申告を送る</button>}));
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
it("キーワードを確認し、全区分に答えるまで終了できない",async()=>{
 const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input);
  const body=url.includes("quarterly-confirm")?{required:true,birthdayRegistered:true,confirmations:{}}:
   url.includes("unlock")||url.includes("profile-current")?{ok:true,profile:{name:"本人",gardenRole:"staff",commuteDailyAllowance:null,commuteMonthlyCap:null,current:Object.fromEntries(SELF_CONFIRM_CATEGORIES.map(category=>[category,{payload:{}}])),confirmations:{}}}:
   url.includes("profile-confirm")?{confirmedAt:new Date().toISOString()}:{rows:[]};
  return {ok:true,json:async()=>body} as Response;
 });
 vi.stubGlobal("fetch",fetchMock);
 const onLock=vi.fn();
 render(<QuarterlyConfirm onLock={onLock}/>);
 const finish=screen.getByRole("button",{name:"確認を終える"});
 expect(finish).toBeDisabled();
 const keyword=await screen.findByRole("textbox");
 fireEvent.change(keyword,{target:{value:"0101"}});
 fireEvent.click(screen.getByRole("button",{name:"マイページを開く"}));
 await screen.findAllByRole("button",{name:"変更なし"});
 // 住所・連絡先・緊急連絡先は同じ申告で回答する。
 fireEvent.click(screen.getAllByRole("button",{name:"変更する"})[0]);
 fireEvent.click(screen.getByRole("button",{name:"申告を送る"}));
 expect(finish).toBeDisabled();
 for(let i=0;i<3;i++){
  fireEvent.click(screen.getAllByRole("button",{name:"変更なし"})[0]);
  await waitFor(()=>expect(screen.queryByRole("button",{name:"保存中"})).toBeNull());
 }
 await waitFor(()=>expect(finish).toBeEnabled());
 expect(onLock).toHaveBeenCalledWith(true);
 expect(fetchMock.mock.calls.filter(([url])=>String(url).includes("quarterly-confirm"))).toHaveLength(1);
});
it("確認不要なら小窓を閉じ、タブの制限を解除する",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({required:false,confirmations:{},birthdayRegistered:true})}));
 const onLock=vi.fn();render(<QuarterlyConfirm onLock={onLock}/>);
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 expect(onLock).toHaveBeenCalledWith(false);
});
