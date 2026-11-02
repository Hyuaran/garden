import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { InitialUrlView } from "@/lib/ui/InitialUrlView";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";
import { PageSearchProvider } from "../PageSearchSlot/PageSearchSlot";
import DataTable from "./DataTable";
import HireCandidatesClient from "../../onboarding/HireCandidatesClient";
import LineManager from "../../line/LineManager";
import BankAccounts from "@/app/bud/bank/BankAccounts";
import Employees from "@/app/root/employees/UrlViewClient";
import Transfer from "@/app/bud/transfers/[transfer_id]/UrlViewClient";
import { useInjectedBudTabs } from "@/app/bud/_components/useInjectedBudTabs";
import { useUrlTab } from "../SystemTabs/useUrlTab";
import type { ReactNode } from "react";
import { HIRE_FIELDS, type HireCandidate } from "../../onboarding/_lib/hire-candidates";
vi.mock("next/navigation",()=>({useParams:()=>({transfer_id:"T1"}),useRouter:()=>({push:vi.fn(),refresh:vi.fn()}),usePathname:()=>"/root/employees",useSearchParams:()=>new URLSearchParams()}));
vi.mock("@/app/root/_state/RootStateContext",()=>({useRootState:()=>({canWrite:true,rootUser:{garden_role:"super_admin",employee_id:"E1"}})}));
vi.mock("@/app/bud/_components/BudGardenFrame",()=>({BudGardenFrame:({children}:{children:ReactNode})=>children}));
const table=(loading=false)=><DataTable rows={[]} loading={loading} columns={[{id:"name",label:"氏名",type:"text",value:(r:{name:string})=>r.name}]} rowKey={r=>r.name} searchText={r=>r.name} defaultSort={{id:"name",direction:"asc"}}/>;
it("marks the local SSR search for CSS suppression at desktop widths",()=>{
  const html=renderToString(<PageSearchProvider>{table()}</PageSearchProvider>);
  expect(html).toContain('data-local-table-search=""');
  const css=readFileSync("src/app/system/_components/DataTable/DataTable.module.css","utf8");
  expect(css).toContain("@media(min-width:801px) { .root .localSearch { display:none; }");
  expect(css).toContain(":global(dialog) .root .localSearch");
});
it("reserves rows while loading and never announces an empty result",()=>{
  const html=renderToString(table(true));
  expect(html).toContain('aria-busy="true"');expect(html).toContain("読み込み中");
  expect(html).not.toContain("該当する明細はありません。");
});
it.each([
  ["入社手続き",<HireCandidatesClient userId="U1" tab="candidates" initialRows={[]}/>],
  ["公式 LINE",<LineManager/>], ["Root 社員一覧",<Employees/>],
  ["Bud 口座残高",<BankAccounts/>], ["Bud 振込",<Transfer/>],
] as const)("%s has no unmarked local search before effects",(_,component)=>{
  const html=renderToString(<ThemeProvider><InitialUrlView search="tab=card"><PageSearchProvider>{component}</PageSearchProvider></InitialUrlView></ThemeProvider>);
  const document=new DOMParser().parseFromString(html,"text/html");
  for(const input of document.querySelectorAll('input[type="search"]')){
    // Local form searches are independent; every DataTable search must carry the SSR CSS marker.
    if(input.closest("[data-table-search-id]"))expect(input.closest("[data-local-table-search]")).not.toBeNull();
  }
});
it("selects the URL tab in the first server render, including injected Bud panels",()=>{
  function Tabs(){const [tab]=useUrlTab<string>("first",key=>["first","second"].includes(key));return <p>{tab}</p>;}
  const source='<nav class="tab-nav"><button data-tab="first">一</button><button data-tab="second">二</button></nav><div id="tab-first" class="tab-content active">一の内容</div><div class="tab-content" id="tab-second">二の内容</div>';
  function Injected(){const view=useInjectedBudTabs(source);return <>{view.navigation}<div dangerouslySetInnerHTML={{__html:view.html}}/></>;}
  const html=renderToString(<InitialUrlView search="tab=second"><Tabs/><Injected/></InitialUrlView>);
  const document=new DOMParser().parseFromString(html,"text/html");
  expect(document.querySelector("p")?.textContent).toBe("second");
  expect(document.getElementById("tab-first")?.classList.contains("active")).toBe(false);
  expect(document.getElementById("tab-second")?.classList.contains("active")).toBe(true);
});
it("uses the requested bank tab in server HTML",()=>{
  const html=renderToString(<InitialUrlView search="tab=card"><BankAccounts/></InitialUrlView>);
  expect(html).toContain('id="panel-card"');expect(html).not.toContain('id="panel-bank"');
});
it("includes the server-loaded hire candidate rows before any effect runs",()=>{
  const row={...Object.fromEntries(HIRE_FIELDS.map(field=>[field,""])),id:"H1",last_name:"初期",first_name:"候補者",hire_date:"2026-11-10",employment_type:"アルバイト",status:"planned",steps:{},employee_number:null,employee_id:null,kintone_roster_record_id:null} as HireCandidate;
  const html=renderToString(<HireCandidatesClient userId="U1" tab="candidates" initialRows={[row]}/>);
  expect(html).toContain("初期 候補者");
  expect(html).not.toContain("該当する明細はありません。");
});
