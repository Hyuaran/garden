import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import { expect, it, vi, beforeEach, afterEach } from "vitest";
import BroadbandTable, { Details } from "./BroadbandTable";
import type { TableRecord } from "@/lib/bud/broadband/table";
import type { AgentDetail } from "@/lib/bud/broadband/agent-details";
import type { Bank } from "@/lib/bud/broadband/reconcile";
it("filters business tabs and totals, keeps unknown codes only in broadband and remembers the tab",()=>{
 const rows=["101","103","105","102","999"].map((code,i)=>({...sample("取引先"+code,(i+1)*10),business:code+"_事業"}));
 const props={rows,userId:"tabs",today:"2026-10-28",kintoneBase:""};
 const view=render(<BroadbandTable {...props}/>);
 expect(screen.getAllByRole("tab").map(t=>t.textContent)).toEqual(["ブロードバンド事業","テレマ事業","ストック事業","関西電力事業","ブレーカー事業","NHK事業","その他","SES事業"]);
 expect(screen.getByText("999_事業")).toBeTruthy();
 fireEvent.click(screen.getByRole("tab",{name:"テレマ事業"}));
 expect(screen.queryByText("102_事業")).toBeNull();expect(screen.queryByText("999_事業")).toBeNull();
 const totalRow=screen.getByText("総合計").closest("tr")!;expect(within(totalRow).getAllByText("60 円")).toHaveLength(2);
 for(const code of ["101","103","105"])expect(screen.getByText(code+"_事業")).toBeTruthy();
 view.unmount();window.history.replaceState(null,"","/");render(<BroadbandTable {...props}/>);
 expect(screen.getByRole("tab",{name:"テレマ事業"})).toHaveAttribute("aria-selected","true");
 fireEvent.click(screen.getByRole("tab",{name:"NHK事業"}));expect(screen.getByText("NHK事業の収支は、現在作成中です。")).toBeTruthy();
});
it("opens a mismatch in a dialog with the difference and source links, and suppresses it for neutral totals",()=>{
 const row={...sample("Crescere",224000),business:"103_クレカ",expected_gross:246400,recon_status:"amount_mismatch",drive_link:"https://drive.google.com/open?id=meisai",recon_bank:[{mf_transaction_id:"b",mf_account_id:"account-1",date:"2026-03-31",bank_name:"楽天銀行",content:"カ)CRESCERE",value:114400} as Bank]} as TableRecord;
 render(<BroadbandTable rows={[row]} userId="modal" today="2026-10-28" kintoneBase="https://example.cybozu.com/k/174"/>);
 fireEvent.click(screen.getAllByRole("button",{name:/^Crescere.*の明細/})[0]);
 const dialog=screen.getByRole("dialog");expect(dialog).toHaveTextContent("132,000 円 少ない");
 expect(within(dialog).getByText("Kintoneレコード")).toHaveAttribute("href","https://example.cybozu.com/k/174/show#record="+encodeURIComponent(row.kintone_record_id));
 expect(within(dialog).getByText("Googleドライブ明細")).toHaveAttribute("href","https://drive.google.com/open?id=meisai");expect(within(dialog).queryByText("口座の明細を開く")).toBeNull();
 fireEvent.click(within(dialog).getAllByRole("button",{name:"閉じる"})[1]);expect(screen.queryByRole("dialog")).toBeNull();
 fireEvent.click(within(screen.getByText("総合計").closest("tr")!).getAllByRole("button")[0]);
 expect(screen.getByRole("dialog").querySelector('[class*="difference"]')).toBeNull();
});
it("explains the search deadline and lists ambiguous candidates without linking agent children to Kintone",()=>{
 const missing={...sample("A",100),drive_link:"https://www.google.com/",scheduled_date:"2026-04-30",recon_status:"not_arrived",recon_bank:[]} as TableRecord;
 const candidates=["one","two"].map(id=>({mf_transaction_id:id,mf_account_id:id,date:"2026-05-01",bank_name:"銀行"+id,content:"候補"+id,value:110} as Bank));
 const ambiguous={...sample("B",100),kintone_record_id:"agent-1",recon_status:"ambiguous",recon_bank:candidates} as TableRecord;
 render(<Details rows={[missing,ambiguous]} daysAfter={45} kintoneBase="https://example/k/1" onClose={()=>{}}/>);
 const dialog=screen.getByRole("dialog");expect(dialog).toHaveTextContent("2026-06-14まで探しました");
 expect(within(dialog).getAllByText(/同じ金額の候補/)).toHaveLength(2);
 expect(within(dialog).getAllByText("Kintoneレコード")).toHaveLength(1);expect(within(dialog).queryByText("Googleドライブ明細")).toBeNull();
});
it("groups NTT and shows neutral account references and document differences",()=>{
 const r={...sample("NTT原価（東）",-100),recon_status:"amount_mismatch"} as TableRecord;
 render(<BroadbandTable rows={[r,sample("NTT原価（西）",-200)]} bank={[{date:"2026-05-01",corp_code:"HR",content:"電話料123",side:"EXPENSE",value:330,mf_transaction_id:"phone"} as Bank]} userId="ntt" today="2026-10-21" kintoneBase=""/>);
 expect(screen.getByText("NTT原価（東西）ヒュアラン")).toBeTruthy();
 const ref=screen.getAllByText("口座（税込）の参考 330 円")[0];expect(ref.parentElement?.className).not.toContain("red");fireEvent.click(ref);
 expect(screen.getByText("Kintone の金額（NTT の書面・税抜）")).toBeTruthy();expect(screen.getByText("差（Kintone の税込 − 口座）")).toBeTruthy();
 expect(screen.queryAllByText(/口座（税込）の参考/).length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole("button",{name:"NTT原価（東西）ヒュアランを開く"}));expect(screen.getByText("NTT原価（東）")).toBeTruthy();
});
it("expands agents, shows the neutral difference, remembers state and confines child reordering",()=>{
 const agents=["株式会社COLORS","辻隼人"].map(payee=>({payee,payment_date:"2026-04-30",target_month:"2026-04",net:100,source_file:"明細.xlsx",review_reason:""} as AgentDetail));
 const props={rows:[sample("代理店支払い合計",-300),sample("関電経費合計",-20)],agents,userId:"agents",today:"2026-10-21",kintoneBase:""};
 const view=render(<BroadbandTable {...props}/>);
 expect(screen.queryByText("COLORS")).toBeNull();
 expect(screen.getByText("K＝Kintone のアプリの合計（口座とは照合しない）")).toBeTruthy();
 const toggle=screen.getByRole("button",{name:"代理店支払い合計を開く"});expect(toggle.getAttribute("aria-expanded")).toBe("false");
 fireEvent.click(toggle);expect(screen.getByText("COLORS")).toBeTruthy();expect(screen.getAllByText("明細との差 −100 円").length).toBe(2);
 fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));fireEvent.keyDown(screen.getByRole("button",{name:"COLORSをつかんで移動"}),{key:"ArrowDown"});
 expect([...document.querySelectorAll('tbody tr')].map(r=>r.children[1].textContent).findIndex(s=>s?.includes("辻隼人"))).toBeLessThan([...document.querySelectorAll('tbody tr')].map(r=>r.children[1].textContent).findIndex(s=>s?.includes("COLORS")));
 view.unmount();render(<BroadbandTable {...props}/>);expect(screen.getByRole("button",{name:"代理店支払い合計を閉じる"}).getAttribute("aria-expanded")).toBe("true");
});
it("shows fee, actual bank details and server supplied Kintone link",()=>{
 render(<Details rows={[{kintone_record_id:"12",business:"事業",partner:"取引先",scheduled_date:"2026-10-31",actual_period:"2026-09-01",product:"商品",profit_net:10000,expected_gross:11000,recon_fee:440,recon_status:"matched",mf_date:"2026-10-30",mf_amount:10560,mf_bank:"楽天銀行",mf_content:"振込"} as TableRecord]} kintoneBase="https://example.cybozu.com/k/174" onClose={()=>{}} />);
 expect(screen.getByText("差 手数料 440 円")).toBeTruthy();expect(screen.getByText("確認済み").closest("p")!.getAttribute("data-tone")).toBe("ok");expect(screen.getByText(/楽天銀行/)).toBeTruthy();expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.cybozu.com/k/174/show#record=12");
});

vi.mock("next/navigation",()=>({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search),useRouter:()=>({refresh:vi.fn()})}));
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class {observe(){} disconnect(){}});localStorage.clear();window.history.replaceState(null,"","/");});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const sample=(partner:string,amount:number,business="事業")=>({kintone_record_id:business+partner,business,partner,profit_net:amount,scheduled_date:"2026-04-30",recon_status:"matched",confirmation:"",updated_at:""} as TableRecord);
const mount=()=>render(<BroadbandTable rows={[sample("A",20),sample("B",-100),sample("C",-10),sample("Z",1,"別事業")]} userId="u" today="2026-10-21" kintoneBase="" />);
const names=()=>[...document.querySelectorAll('tbody tr')].map(r=>r.children[1].textContent);
it("places child grips with partner names and floats the whole business group",()=>{
 vi.stubGlobal("PointerEvent",class extends MouseEvent {pointerId=1;pointerType="mouse";});
 mount();fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 const child=screen.getByRole("button",{name:"Aをつかんで移動"});
 const parent=screen.getByRole("button",{name:"事業をつかんで移動"});
 expect(child.closest("td")).toBe(child.closest("tr")!.children[1]);
 expect(parent.closest("th")).toBe(parent.closest("tr")!.children[0]);
 fireEvent.pointerDown(parent,{button:0,clientX:100,clientY:100});
 const group=[parent,child,screen.getByRole("button",{name:"Bをつかんで移動"}),screen.getByRole("button",{name:"Cをつかんで移動"})];
 for(const grip of group) expect(grip.closest("tr")!.className).toContain("dragging");
 const other=screen.getByRole("button",{name:"Zをつかんで移動"});
 Object.defineProperty(document,"elementFromPoint",{configurable:true,value:()=>other.closest("tr")});
 fireEvent.pointerMove(parent,{clientX:100,clientY:200});
 expect(other.closest("tr")!.className).not.toContain("dropTarget");
 expect(screen.getByRole("button",{name:"別事業をつかんで移動"}).closest("tr")!.className).toContain("dropTarget");
 fireEvent.pointerUp(parent);
});
it("shows legend, resets three orders, moves with keyboard and persists",()=>{
 mount();expect(screen.getByText("金額はすべて税抜")).toBeTruthy();expect(document.querySelector("tbody tr")!.getAttribute("data-row-key")).toBe("grand");expect(screen.getByLabelText("色の凡例")).toBeTruthy();expect(screen.getByText("合計（税抜）")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 fireEvent.click(screen.getByText("金額の大きい順にする"));expect(names().slice(2,5)).toEqual(["A","C","B"]);
 fireEvent.click(screen.getByText("取引先名の順にする"));expect(names().slice(2,5)).toEqual(["A","B","C"]);
 fireEvent.click(screen.getByText("入金 → 支払いの順に戻す"));expect(names().slice(2,5)).toEqual(["A","B","C"]);
 fireEvent.keyDown(screen.getByRole("button",{name:"Aをつかんで移動"}),{key:"ArrowDown"});expect(names().slice(2,5)).toEqual(["B","A","C"]);
 expect(JSON.parse(localStorage.getItem("bud-broadband-order:u")!).partners.事業).toEqual(["B","A","C"]);
});
it("moves with pointer, rejects other businesses and works without storage",()=>{
 vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error();});vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error();});
 vi.stubGlobal("PointerEvent",class extends MouseEvent {pointerId=1;pointerType="mouse";});mount();fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 const a=screen.getByRole("button",{name:"Aをつかんで移動"}),b=screen.getByRole("button",{name:"Bをつかんで移動"});
 const hit=vi.fn(()=>b.closest("tr"));Object.defineProperty(document,"elementFromPoint",{configurable:true,value:hit});
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(2,5)).toEqual(["B","A","C"]);
 hit.mockReturnValue(screen.getByRole("button",{name:"Zをつかんで移動"}).closest("tr"));fireEvent.pointerDown(a,{button:0});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(2,5)).toEqual(["B","A","C"]);
});

it("restores per-user order and requires a 400ms touch hold",()=>{
 localStorage.setItem("bud-broadband-order:u",JSON.stringify({businesses:["事業","別事業"],partners:{事業:["B","A","C"]}}));
 vi.stubGlobal("PointerEvent",class extends MouseEvent {pointerId=2;pointerType="touch";});
 mount();expect(names().slice(2,5)).toEqual(["B","A","C"]);fireEvent.click(screen.getByRole("button",{name:"並べ替え"}));
 const a=screen.getByRole("button",{name:"Aをつかんで移動"}),b=screen.getByRole("button",{name:"Bをつかんで移動"});
 Object.defineProperty(document,"elementFromPoint",{configurable:true,value:()=>b.closest("tr")});vi.useFakeTimers();
 try {
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:200});fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(2,5)).toEqual(["B","A","C"]);
 fireEvent.pointerDown(a,{button:0,clientX:100,clientY:200});act(()=>vi.advanceTimersByTime(400));fireEvent.pointerMove(a,{clientX:100,clientY:200});fireEvent.pointerUp(a);expect(names().slice(2,5)).toEqual(["A","B","C"]);
 } finally {vi.useRealTimers();}
});

it("shows viewer settings only for super admins",()=>{
 const props={rows:[],userId:"u",today:"2026-10-23",kintoneBase:""};
 const view=render(<BroadbandTable {...props} />);
 expect(screen.queryByRole("button",{name:"閲覧権限"})).toBeNull();
 view.rerender(<BroadbandTable {...props} admin />);
 expect(screen.getByRole("button",{name:"閲覧権限"})).toBeTruthy();
});
it("saves with PATCH and closes settings",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({viewers:["a"],employees:[{employee_id:"a",name:"後道",name_kana:"ウシロミチ"}]})}).mockResolvedValueOnce({ok:true});
 vi.stubGlobal("fetch",fetcher);
 render(<BroadbandTable rows={[]} userId="u" today="2026-10-23" kintoneBase="" admin />);
 fireEvent.click(screen.getByRole("button",{name:"閲覧権限"}));
 expect(screen.queryByRole("table")).toBeNull();
 await screen.findByRole("checkbox",{name:"後道"});
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"保存"}));});
 expect(fetcher).toHaveBeenLastCalledWith("/api/bud/broadband/viewers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({viewers:["a"]})});
 expect(screen.queryByRole("button",{name:"保存"})).toBeNull();expect(screen.getByRole("table")).toBeTruthy();
});
it("announces save failure",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({viewers:[],employees:[]})}).mockResolvedValueOnce({ok:false,json:async()=>({error:"保存できませんでした"})}));
 render(<BroadbandTable rows={[]} userId="u" today="2026-10-23" kintoneBase="" admin />);
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"閲覧権限"}));});
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"保存"}));});
 expect(screen.getByRole("alert")).toHaveTextContent("保存できませんでした");expect(screen.queryByRole("table")).toBeNull();
});
it("names the page and tabs by business and shows SES as in preparation",()=>{
 render(<BroadbandTable rows={[]} userId="u" today="2026-10-23" kintoneBase="" />);
 expect(screen.getByRole("heading",{level:1,name:"事業の収支"})).toBeTruthy();
 expect(screen.getByRole("tab",{name:"ブロードバンド事業"}).getAttribute("aria-selected")).toBe("true");
 fireEvent.click(screen.getByRole("tab",{name:"SES事業"}));
 expect(screen.getByRole("tabpanel")).toHaveTextContent("SES事業の収支は、現在作成中です。");
 expect(screen.queryByRole("table")).toBeNull();expect(screen.getByRole("button",{name:"並べ替え"})).toBeDisabled();
 fireEvent.click(screen.getByRole("tab",{name:"ブロードバンド事業"}));
 expect(screen.getByRole("table")).toBeTruthy();
});
it("re-attaches the fixed header after switching tabs",()=>{
 render(<BroadbandTable rows={[sample("A",20)]} userId="u" today="2026-10-23" kintoneBase="" />);
 const heads=()=>document.body.querySelectorAll('[aria-label="表の見出し"]').length;
 expect(heads()).toBe(1);
 fireEvent.click(screen.getByRole("tab",{name:"SES事業"}));expect(heads()).toBe(0);
 fireEvent.click(screen.getByRole("tab",{name:"ブロードバンド事業"}));expect(heads()).toBe(1);
});
