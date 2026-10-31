import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search),useRouter:()=>({refresh:vi.fn()})}));
import ViewPermissionButton from "./ViewPermissionButton";
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute("open","");}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute("open");}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const props={pageKey:"system-onboarding",tabKey:"all",tabLabel:"みんなの入社手続き"};
const response={settings:[],employees:[{employee_id:"EMP-1",name:"追加する人",name_kana:null}],updaters:[],defaults:{"": ["super_admin","staff"],all:["super_admin","admin","manager"]}};
it("歯車は全権管理者だけに表示する",()=>{
  const {rerender}=render(<ViewPermissionButton {...props} admin={false} />);
  expect(screen.queryByRole("button")).toBeNull();
  rerender(<ViewPermissionButton {...props} admin={false} canAdd />);
  expect(screen.getByRole("button",{name:"＋ 人を追加"})).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"見られる人の設定"})).toBeNull();
});
it("初回は既定の役職にチェックし、全権管理者は外せない",async()=>{
  const fetcher=vi.fn(async()=>Response.json(response));vi.stubGlobal("fetch",fetcher);
  render(<ViewPermissionButton {...props} admin />);
  fireEvent.click(screen.getByRole("button",{name:"見られる人の設定"}));
  expect(await screen.findByRole("checkbox",{name:/全権管理者/})).toBeDisabled();
  await waitFor(()=>expect(screen.getByRole("checkbox",{name:"管理者"})).toBeChecked());
  expect(screen.getByRole("checkbox",{name:"責任者"})).toBeChecked();
  fireEvent.click(screen.getByRole("radio",{name:"画面全体"}));
  await waitFor(()=>expect(screen.getByRole("checkbox",{name:"管理者"})).not.toBeChecked());
  fireEvent.click(screen.getByRole("button",{name:"保存"}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  const request=fetcher.mock.calls[1] as unknown as [string,RequestInit];
  expect(JSON.parse(String(request[1].body))).toMatchObject({action:"save",tab:"",roles:["super_admin","staff"]});
});
it("追加だけできる人には役職や削除、保存の操作を出さない",async()=>{
  const fetcher=vi.fn(async()=>Response.json(response));vi.stubGlobal("fetch",fetcher);
  render(<ViewPermissionButton {...props} admin={false} canAdd />);
  fireEvent.click(screen.getByRole("button",{name:"＋ 人を追加"}));
  fireEvent.click(await screen.findByRole("checkbox",{name:"追加する人"}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  const request=fetcher.mock.calls[1] as unknown as [string,RequestInit];
  expect(JSON.parse(String(request[1].body))).toMatchObject({action:"add",tab:"all",employeeId:"EMP-1"});
  expect(screen.queryByRole("button",{name:"保存"})).toBeNull();
});
it("Budのお金の画面では閲覧者による追加をオフに固定する",async()=>{
  const fetcher=vi.fn(async()=>Response.json({...response,defaults:{"": ["super_admin","staff"]}}));vi.stubGlobal("fetch",fetcher);
  const view=render(<ViewPermissionButton pageKey="bud-expenses" tabKey="" tabLabel="" admin={false} canAdd />);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<ViewPermissionButton pageKey="bud-expenses" tabKey="" tabLabel="" admin />);
  fireEvent.click(screen.getByRole("button",{name:"見られる人の設定"}));
  const option=await screen.findByRole("checkbox",{name:/見られる人が人を追加できる/});
  expect(option).toBeDisabled(); expect(option).not.toBeChecked();
});
