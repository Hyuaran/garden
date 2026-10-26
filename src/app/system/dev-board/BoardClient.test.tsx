import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import BoardClient from "./BoardClient";
import { resolveCanView } from "@/lib/auth/view-permission";
beforeEach(()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({questions:[{id:"one",module:"system",title:"交通費の扱い",body:"説明",status:"open",answer_type:"text",options:[],created_at:"2026-10-26",sort:0,system_dev_question_logs:[]}]})}));});
it("空のタブは無効で、一覧の行から対象の質問へ移動できる",async()=>{render(<BoardClient/>);await screen.findByText("交通費の扱い");expect(screen.getByRole("tab",{name:"Bloom"})).toBeDisabled();fireEvent.click(screen.getByText("交通費の扱い"));await waitFor(()=>expect(screen.getByRole("tab",{name:"System"})).toHaveAttribute("aria-selected","true"));expect(screen.getByRole("button",{name:"回答する"})).toBeInTheDocument();});
it("全権管理者もEMP-0008以外は見えない",()=>{expect(resolveCanView([],"system-dev-board","",{employeeId:"EMP-0009",role:"super_admin"})).toBe(false);expect(resolveCanView([],"system-dev-board","",{employeeId:"EMP-0008",role:"staff"})).toBe(true);});
