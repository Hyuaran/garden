import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HireCandidatesClient from "./HireCandidatesClient";
const row={id:"c",last_name:"山田",first_name:"太郎",hire_date:"2026-10-24",employment_type:"アルバイト",status:"planned",employee_number:null,steps:{}};
afterEach(()=>vi.unstubAllGlobals());
it("shows candidate tab only in its super-admin wrapper and preserves the old list",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json([row])));
 render(<HireCandidatesClient><p>既存の入社手続き一覧</p></HireCandidatesClient>);
 expect(await screen.findByText("山田 太郎")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("tab",{name:"入社手続き"}));expect(screen.getByText("既存の入社手続き一覧")).toBeVisible();
});
it("confirms the persisted employee number and does not hire on cancellation",async()=>{
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>Response.json(init?.method==="POST"?{...row,employee_number:"1571"}:[row]));vi.stubGlobal("fetch",fetch);
 render(<HireCandidatesClient><p>既存一覧</p></HireCandidatesClient>);
 fireEvent.click(await screen.findByRole("button",{name:"出社を確認して入社にする"}));
 expect(await screen.findByRole("dialog",{name:"入社の確認"})).toHaveTextContent("社員番号 1571");
 await waitFor(()=>expect(screen.getByRole("button",{name:"やめる"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"やめる"}));
 expect(fetch.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);
 expect(fetch.mock.calls.find(([,init])=>init?.method==="POST")?.[1]?.body).toBe(JSON.stringify({prepare:true}));
});
