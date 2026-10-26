import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import BoardClient from "./BoardClient";
import { resolveCanView } from "@/lib/auth/view-permission";
import type { Question } from "./board";
beforeEach(()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({questions:[{id:"one",module:"system",title:"交通費の扱い",body:"説明",status:"open",answer_type:"text",options:[],created_at:"2026-10-26",sort:0,system_dev_question_logs:[]}]})}));});
it("空のタブは無効で、一覧の行から対象の質問へ移動できる",async()=>{render(<BoardClient/>);await screen.findByText("交通費の扱い");expect(screen.getByRole("tab",{name:"Bloom"})).toBeDisabled();fireEvent.click(screen.getByText("交通費の扱い"));await waitFor(()=>expect(screen.getByRole("tab",{name:"System"})).toHaveAttribute("aria-selected","true"));expect(screen.getByRole("button",{name:"回答する"})).toBeInTheDocument();});
it("全権管理者もEMP-0008以外は見えない",()=>{expect(resolveCanView([],"system-dev-board","",{employeeId:"EMP-0009",role:"super_admin"})).toBe(false);expect(resolveCanView([],"system-dev-board","",{employeeId:"EMP-0008",role:"staff"})).toBe(true);});

it("状態で残数を数え、回答済みと完了をまとめ、利用者ごとに開閉を復元する", async()=>{
 localStorage.clear();
 const questions = ["open","answered","in_progress","done"].map((status,index)=>({id:String(index),module:"system",title:`質問${index}`,body:"説明",status,answer_type:"text",options:[],answer_choice:null,answer_text_raw:null,answer_text:null,done_at:null,answered_at:null,created_at:"2026-10-26",sort:index,system_dev_question_logs:[]} as Question));
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({questions})}));
 const {container,unmount}=render(<BoardClient userId="person-a"/>);
 await screen.findByText("質問0");
 expect(screen.queryByRole("progressbar")).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:"System"}));
 expect(screen.getByRole("progressbar",{name:"残り 1件（全4件）"})).toHaveAttribute("aria-valuenow","3");
 const answered=screen.getByText("回答済み（2件）").closest("details")!;
 expect(answered.open).toBe(false);
 fireEvent.click(screen.getByText("回答済み（2件）"));
 await waitFor(()=>expect(localStorage.getItem("dev-board:person-a:system:answered")).toBe("true"));
 expect(container.querySelector("#question-3")).toBeNull();
 fireEvent.click(screen.getByRole("checkbox",{name:"完了も表示"}));
 expect(screen.getByText("完了（1件）").closest("details")!.open).toBe(false);
 unmount();
 render(<BoardClient userId="person-a"/>);await screen.findByText("質問0");fireEvent.click(screen.getByRole("tab",{name:"System"}));
 await waitFor(()=>expect(screen.getByText("回答済み（2件）").closest("details")!.open).toBe(true));
});
