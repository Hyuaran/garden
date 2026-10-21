import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { expect, it, vi, beforeEach, afterEach } from "vitest";
import BroadbandTable, { Details } from "./BroadbandTable";
import type { TableRecord } from "@/lib/bud/broadband/table";
it("shows fee, actual bank details and server supplied Kintone link",()=>{
 render(<Details rows={[{kintone_record_id:"12",business:"事業",partner:"取引先",scheduled_date:"2026-10-31",actual_period:"2026-09-01",product:"商品",profit_net:10000,expected_gross:11000,recon_fee:440,recon_status:"matched",mf_date:"2026-10-30",mf_amount:10560,mf_bank:"楽天銀行",mf_content:"振込"} as TableRecord]} kintoneBase="https://example.cybozu.com/k/174" onClose={()=>{}} />);
 expect(screen.getByText("手数料 440 円")).toBeTruthy();expect(screen.getByText(/楽天銀行/)).toBeTruthy();expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.cybozu.com/k/174/show#record=12");
});

vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class {observe(){} disconnect(){}});localStorage.clear();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const sample=(partner:string,amount:number,business="事業")=>({kintone_record_id:business+partner,business,partner,profit_net:amount,scheduled_date:"2026-04-30",recon_status:"matched",confirmation:"",updated_at:""} as TableRecord);
const mount=()=>render(<BroadbandTable rows={[sample("A",20),sample("B",-100),sample("C",-10),sample("Z",1,"別事業")]} userId="u" today="2026-10-21" kintoneBase="" />);
const names=()=>[...document.querySelectorAll('tbody tr')].map(r=>r.children[1].textContent);
it("shows legend, resets three orders, moves with keyboard and persists",()=>{
 mount();expect(screen.getByText("金額はすべて税抜")).toBeTruthy();expect(screen.getByLabelText("色の凡例")).toBeTruthy();expect(screen.getByText("合計（税抜）")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 fireEvent.click(screen.getByText("金額の大きい順にする"));expect(names().slice(1,4)).toEqual(["A","C","B"]);
 fireEvent.click(screen.getByText("取引先名の順にする"));expect(names().slice(1,4)).toEqual(["A","B","C"]);
 fireEvent.click(screen.getByText("入金 → 支払いの順に戻す"));expect(names().slice(1,4)).toEqual(["A","B","C"]);
 fireEvent.keyDown(screen.getByRole("button",{name:"Aをつかんで移動"}),{key:"ArrowDown"});expect(names().slice(1,4)).toEqual(["B","A","C"]);
 expect(JSON.parse(localStorage.getItem("bud-broadband-order:u")!).partners.事業).toEqual(["B","A","C"]);
});
it("moves with pointer, rejects other businesses and works without storage",()=>{
 vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error();});vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error();});
 vi.stubGlobal("PointerEvent",class extends MouseEvent {pointerId=1;pointerType="mouse";});mount();fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 const a=screen.getByRole("button",{name:"Aをつかんで移動"}),b=screen.getByRole("button",{name:"Bをつかんで移動"});
 const hit=vi.fn(()=>b.closest("tr"));Object.defineProperty(document,"elementFromPoint",{configurable:true,value:hit});
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(1,4)).toEqual(["B","A","C"]);
 hit.mockReturnValue(screen.getByRole("button",{name:"Zをつかんで移動"}).closest("tr"));fireEvent.pointerDown(a,{button:0});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(1,4)).toEqual(["B","A","C"]);
});

it("restores per-user order and requires a 400ms touch hold",()=>{
 localStorage.setItem("bud-broadband-order:u",JSON.stringify({businesses:["事業","別事業"],partners:{事業:["B","A","C"]}}));
 vi.stubGlobal("PointerEvent",class extends MouseEvent {pointerId=2;pointerType="touch";});
 mount();expect(names().slice(1,4)).toEqual(["B","A","C"]);fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 const a=screen.getByRole("button",{name:"Aをつかんで移動"}),b=screen.getByRole("button",{name:"Bをつかんで移動"});
 Object.defineProperty(document,"elementFromPoint",{configurable:true,value:()=>b.closest("tr")});vi.useFakeTimers();
 try {
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:200});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(1,4)).toEqual(["B","A","C"]);
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:200});act(()=>vi.advanceTimersByTime(400));fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(1,4)).toEqual(["A","B","C"]);
 } finally {vi.useRealTimers();}
});
