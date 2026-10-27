import { act,cleanup,fireEvent,render,screen,within } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import HireConfirmationSteps from "./HireConfirmationSteps";
import type { HireCandidate } from "./_lib/hire-candidates";
vi.mock("@/app/system/_components/ChangeConfirm/ChangeConfirm",()=>({default:({actions}:{actions:React.ReactNode})=><div>{actions}</div>}));
const row={id:"test",status:"hired",onboarding_status:"submitted",line_registered:true,line_verified_at:"now",steps:{},checklist:Object.fromEntries(["contract_signed","nda_signed","emergency_signed"].map(k=>[k,{checked_at:"now",checked_by:"u"}]))} as HireCandidate;
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();vi.unstubAllGlobals();});
it("waits 120 seconds, updates every second, then reconciles once",async()=>{
 vi.useFakeTimers();const fetch=vi.fn(async(_url:string,_init?:RequestInit)=>Response.json({ok:true}));vi.stubGlobal("fetch",fetch);
 render(<HireConfirmationSteps row={row} canWrite documents={null} toggleFilemaker={()=>{}} skip={()=>{}} onRefresh={async()=>{}}/>);
 fireEvent.click(screen.getByRole("button",{name:"FileMaker に依頼"}));
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"依頼する"}));});
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(1000);});expect(screen.getByText("残り 1:59")).toBeVisible();
 await act(async()=>{vi.advanceTimersByTime(118000);});expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(1000);});expect(fetch).toHaveBeenCalledTimes(2);
 expect(fetch.mock.calls[1][1]).toMatchObject({method:"GET"});
});
it.each(["done","sent","failed"])("shows FileMaker %s result",status=>{
 render(<HireConfirmationSteps row={{...row,filemaker_request:{status,files:{shain:{status,error:"接続を確認してください"}}}}} canWrite documents={null} toggleFilemaker={()=>{}} skip={()=>{}} onRefresh={async()=>{}}/>);
 expect(screen.getByText(status==="done"?"FileMaker のアカウントを作りました":status==="sent"?"まだ作成中です。数分後にもう一度確かめてください":"作成できませんでした。下の理由を確認して、やり直してください")).toBeVisible();
});
it("locks LINE until all signatures and documents until submitted, including read only",()=>{
 render(<HireConfirmationSteps row={{...row,onboarding_status:"draft",checklist:{},line_verified_at:null}} canWrite documents={null} toggleFilemaker={()=>{}} skip={()=>{}} onRefresh={async()=>{}}/>);
 expect(screen.getByRole("button",{name:"テスト送信"})).toBeDisabled();expect(screen.getByRole("button",{name:"書類の PDF を作る"})).toBeDisabled();expect(screen.getByRole("button",{name:"FileMaker に依頼"})).toBeDisabled();
});

it("orders dates, offers renewal choices, recalculates only untouched dates and dims blocked steps",()=>{
 render(<HireConfirmationSteps row={{...row,checklist:{},line_verified_at:null}} canWrite documents={null} toggleFilemaker={()=>{}} skip={()=>{}} onRefresh={async()=>{}}/>);
 const start=screen.getByLabelText("契約開始日"),end=screen.getByLabelText("契約終了日"),concluded=screen.getByLabelText("契約日");
 expect(concluded.compareDocumentPosition(start)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(start.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 const renewal=screen.getByLabelText("契約更新");expect(renewal.tagName).toBe("SELECT");expect(renewal.querySelectorAll("option")).toHaveLength(4);expect(renewal).toHaveValue("更新する場合があり得る");
 fireEvent.change(start,{target:{value:"2026-10-05"}});expect(end).toHaveValue("2026-10-31");
 fireEvent.change(screen.getByLabelText("契約書の種類"),{target:{value:"full_time"}});expect(end).toHaveValue("2026-12-31");
 fireEvent.change(end,{target:{value:"2027-03-31"}});fireEvent.change(start,{target:{value:"2026-11-01"}});expect(end).toHaveValue("2027-03-31");
 fireEvent.change(screen.getByLabelText("雇用期間"),{target:{value:"yes"}});expect(end).toHaveValue("");expect(renewal).toBeDisabled();
 for(const title of ["② LINE テスト送信","③ FileMaker"])expect(screen.getByText(title).closest("section")).toHaveAttribute("aria-disabled","true");
});

it("switches header actions to status and shows code only after sending",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json({ok:true})));
 const props={canWrite:true,documents:null,toggleFilemaker:vi.fn(),skip:vi.fn(),onRefresh:async()=>{}};
 const pending={...row,line_verified_at:null};
 const view=render(<HireConfirmationSteps {...props} row={pending}/>);
 const line=within(screen.getByText("② LINE テスト送信").closest("section")!);
 expect(line.queryByLabelText("確認コード")).not.toBeInTheDocument();
 expect(line.getByRole("button",{name:"テスト送信"}).closest("header")).toBeTruthy();
 expect(line.getByRole("button",{name:"LINE 登録しない"}).closest("header")).toBeTruthy();
 await act(async()=>{fireEvent.click(line.getByRole("button",{name:"テスト送信"}));});
 expect(line.getByLabelText("確認コード")).toBeVisible();
 view.rerender(<HireConfirmationSteps {...props} row={row}/>);
 expect(line.getAllByText("確認済み")).toHaveLength(1);
 expect(line.queryByRole("button")).not.toBeInTheDocument();
 expect(line.queryByLabelText("確認コード")).not.toBeInTheDocument();
 const fm=within(screen.getByText("③ FileMaker").closest("section")!);
 fireEvent.click(fm.getByRole("button",{name:"手で追加済みにする"}));expect(props.toggleFilemaker).toHaveBeenCalledOnce();
 expect(fm.queryByRole("checkbox")).not.toBeInTheDocument();
 const checked={checked_at:"now",checked_by:"u"};
 view.rerender(<HireConfirmationSteps {...props} row={{...pending,checklist:{...row.checklist,line_skipped:checked,filemaker_added:checked}}}/>);
 expect(line.getAllByText("登録しない")).toHaveLength(1);
 fireEvent.click(line.getByRole("button",{name:"戻す"}));expect(props.skip).toHaveBeenCalledOnce();
 expect(fm.getAllByText("追加済み")).toHaveLength(1);
 expect(fm.queryByRole("button",{name:"FileMaker に依頼"})).not.toBeInTheDocument();
 fireEvent.click(fm.getByRole("button",{name:"戻す"}));expect(props.toggleFilemaker).toHaveBeenCalledTimes(2);
});
