import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({role:"super_admin"}));
vi.mock("../_state/RootStateContext",()=>({useRootState:()=>({gardenRole:state.role})}));
vi.mock("../_components/PageHeader",()=>({PageHeader:({title,actions}:{title:string;actions:React.ReactNode})=><header>{title}{actions}</header>}));
vi.mock("../_components/DataTable",()=>({DataTable:()=>null}));
import Page from "./page";
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-27T00:00:00Z"));});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it("shows only viewing controls to an admin",async()=>{
 state.role="admin";vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({rows:[]})})));
 render(<Page/>);expect(await screen.findByText("今年の最低賃金が未登録です。大阪労働局の発表を見て追加してください")).toBeVisible();
 expect(screen.queryByRole("button",{name:"追加"})).toBeNull();expect(screen.queryByRole("button",{name:"厚生労働省から取り込む"})).toBeNull();
});
it("asks for change confirmation before writing",async()=>{
 state.role="super_admin";const fetcher=vi.fn(async()=>({ok:true,json:async()=>({rows:[]})}));vi.stubGlobal("fetch",fetcher);
 render(<Page/>);await screen.findByText("今年の最低賃金が未登録です。大阪労働局の発表を見て追加してください");
 fireEvent.click(screen.getByRole("button",{name:"追加"}));fireEvent.change(screen.getByLabelText("時給（円）"),{target:{value:"1231"}});fireEvent.change(screen.getByLabelText("いつから"),{target:{value:"2026-10-01"}});fireEvent.click(screen.getByRole("button",{name:"保存"}));
 expect(screen.getByText("この内容で保存しますか？")).toBeVisible();expect(fetcher).toHaveBeenCalledTimes(1);
});
