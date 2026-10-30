import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const push=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({push})}));
import GlobalSearch, { GlobalSearchButton } from "./GlobalSearch";
beforeEach(()=>{vi.useFakeTimers();push.mockClear();vi.spyOn(HTMLDialogElement.prototype,"showModal").mockImplementation(function(this: HTMLDialogElement){this.open=true;});vi.spyOn(HTMLDialogElement.prototype,"close").mockImplementation(function(this: HTMLDialogElement){this.open=false;});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
const input=()=>screen.getByRole("searchbox");
it("opens with Ctrl/Cmd K and button, focuses input, closes on Escape",()=>{
 render(<><GlobalSearchButton/><GlobalSearch/></>);
 fireEvent.keyDown(window,{key:"k",ctrlKey:true});expect(input()).toHaveFocus();
 fireEvent(screen.getByRole("dialog"),new Event("cancel",{bubbles:true,cancelable:true}));expect(screen.queryByRole("searchbox")).toBeNull();
 fireEvent.keyDown(window,{key:"k",metaKey:true});expect(input()).toHaveFocus();
 fireEvent.click(screen.getByRole("button",{name:"閉じる"}));fireEvent.click(screen.getByRole("button",{name:"Garden 全体を検索（Ctrl+K）"}));expect(input()).toHaveFocus();
});
it("debounces, shows loading, navigates with arrows and Enter",async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({groups:[{key:"test",label:"経費",more:false,hits:[{id:"1",title:"交通費",label:"金額",value:"1,000",module:"Bud",href:"/bud/expenses?q=1000"},{id:"2",title:"旅費",label:"金額",value:"1,000",module:"Bud",href:"/bud/expenses?q=1000&tab=done"}]}]})});vi.stubGlobal("fetch",fetcher);
 render(<GlobalSearch/>);fireEvent.keyDown(window,{key:"k",ctrlKey:true});
 fireEvent.change(input(),{target:{value:"10"}});await act(async()=>{vi.advanceTimersByTime(200);});
 fireEvent.change(input(),{target:{value:"1000"}});expect(screen.getByRole("status")).toHaveTextContent("検索中");
 await act(async()=>{vi.advanceTimersByTime(249);});expect(fetcher).not.toHaveBeenCalled();
 await act(async()=>{vi.advanceTimersByTime(1);});expect(fetcher).toHaveBeenCalledTimes(1);
 fireEvent.keyDown(input(),{key:"ArrowDown"});fireEvent.keyDown(input(),{key:"ArrowUp"});fireEvent.keyDown(input(),{key:"ArrowDown"});fireEvent.keyDown(input(),{key:"Enter"});
 expect(push).toHaveBeenCalledWith("/bud/expenses?q=1000&tab=done");expect(screen.queryByRole("dialog")).toBeNull();
});
it("shows an empty result and does not search a single digit",async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({groups:[]})});vi.stubGlobal("fetch",fetcher);
 render(<GlobalSearch/>);fireEvent.keyDown(window,{key:"k",ctrlKey:true});
 fireEvent.change(input(),{target:{value:"1"}});await act(async()=>{vi.advanceTimersByTime(300);});expect(fetcher).not.toHaveBeenCalled();
 fireEvent.change(input(),{target:{value:"田"}});await act(async()=>{vi.advanceTimersByTime(250);});expect(screen.getByText("見つかりませんでした")).toBeInTheDocument();
});
