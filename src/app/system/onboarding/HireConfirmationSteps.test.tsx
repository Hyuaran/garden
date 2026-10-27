import { act,cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import HireConfirmationSteps from "./HireConfirmationSteps";
import type { HireCandidate } from "./_lib/hire-candidates";
vi.mock("@/app/system/_components/ChangeConfirm/ChangeConfirm",()=>({default:({actions}:{actions:React.ReactNode})=><div>{actions}</div>}));
const row={id:"test",status:"hired",onboarding_status:"submitted",line_registered:true,line_verified_at:"now",steps:{},checklist:Object.fromEntries(["contract_signed","nda_signed","emergency_signed"].map(k=>[k,{checked_at:"now",checked_by:"u"}]))} as HireCandidate;
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();vi.unstubAllGlobals();});
it("waits 120 seconds, updates every second, then reconciles once",async()=>{
 vi.useFakeTimers();const fetch=vi.fn(async(_url:string,_init?:RequestInit)=>Response.json({ok:true}));vi.stubGlobal("fetch",fetch);
 render(<HireConfirmationSteps row={row} canWrite documents={null} filemakerCheck={null} skip={()=>{}} onRefresh={async()=>{}}/>);
 fireEvent.click(screen.getByRole("button",{name:"FileMaker に依頼"}));
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"依頼する"}));});
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(1000);});expect(screen.getByText("残り 1:59")).toBeVisible();
 await act(async()=>{vi.advanceTimersByTime(118000);});expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(1000);});expect(fetch).toHaveBeenCalledTimes(2);
 expect(fetch.mock.calls[1][1]).toMatchObject({method:"GET"});
});
it.each(["done","sent","failed"])("shows FileMaker %s result",status=>{
 render(<HireConfirmationSteps row={{...row,filemaker_request:{status,files:{shain:{status,error:"接続を確認してください"}}}}} canWrite documents={null} filemakerCheck={null} skip={()=>{}} onRefresh={async()=>{}}/>);
 expect(screen.getByText(status==="done"?"FileMaker のアカウントを作りました":status==="sent"?"まだ作成中です。数分後にもう一度確かめてください":"作成できませんでした。下の理由を確認して、やり直してください")).toBeVisible();
});
it("locks LINE until all signatures and documents until submitted, including read only",()=>{
 render(<HireConfirmationSteps row={{...row,onboarding_status:"draft",checklist:{}}} canWrite documents={null} filemakerCheck={null} skip={()=>{}} onRefresh={async()=>{}}/>);
 expect(screen.getByRole("button",{name:"テスト送信"})).toBeDisabled();expect(screen.getByRole("button",{name:"書類の PDF を作る"})).toBeDisabled();expect(screen.getByRole("button",{name:"FileMaker に依頼"})).toBeDisabled();
});
