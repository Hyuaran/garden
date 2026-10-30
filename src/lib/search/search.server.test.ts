import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({viewer:{employeeId:"EMP-0010",role:"staff"},tables:[] as string[],selects:[] as string[],filters:[] as unknown[][],rows:{} as Record<string,Record<string,unknown>[]>,permissions:[] as unknown[]}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:async()=>({db:db(),userId:"user-10",viewer:state.viewer}),readViewPermissions:async()=>state.permissions}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>db()}));
function db(){return {rpc:async()=>({data:false,error:null}),from:(table:string)=>{state.tables.push(table);const filters:unknown[][]=[];const q={select:(s:string)=>{state.selects.push(s);return q;},order:()=>q,range:()=>q,eq:(...args:unknown[])=>{filters.push(args);state.filters.push([table,...args]);return q;},is:()=>q,in:()=>q,then:(resolve:(value:unknown)=>unknown)=>resolve({data:(state.rows[table]??[]).filter(row=>filters.every(([key,value])=>row[String(key)]===value)),error:null})};return q;}};}
import { gardenSearch, rowHit } from "./search.server";
import { SEARCH_SOURCES } from "./catalog";
beforeEach(()=>{state.viewer={employeeId:"EMP-0010",role:"staff"};state.tables=[];state.selects=[];state.filters=[];state.rows={};state.permissions=[];});
it("does not select forbidden screens, secrets, external or list phone tables",async()=>{
 await gardenSearch("1000",new Set());
 expect(state.tables).not.toContain("root_employees");expect(state.tables).not.toContain("soil_list_phone");expect(state.tables).not.toContain("system_hire_candidates");
 expect(state.selects.join(",")).not.toMatch(/account_number|my_number|token|password|secret|cipher|\*/);
 for(const source of SEARCH_SOURCES)expect(source.fields.map(f=>f.select??f.column).join(",")).not.toMatch(/account_?number|my_?number|token|password|secret|cipher|\*/i);
});
it("keeps employee, submitted_by and requested_by restrictions",async()=>{
 state.rows.system_expense_report=[{id:"own",purpose:"1000",submitted_by:"user-10"},{id:"other",purpose:"1000",submitted_by:"other"}];
 const groups=await gardenSearch("1000",new Set());
 expect(groups.flatMap(g=>g.hits).map(h=>h.id)).toContain("system_expense_report:own");expect(groups.flatMap(g=>g.hits).map(h=>h.id)).not.toContain("system_expense_report:other");
 expect(state.filters).toContainEqual(["system_zenkaku_check_request","requested_by","user-10"]);
 expect(state.filters).toContainEqual(["system_onboarding","employee_id","EMP-0010"]);
});
it("applies permission overrides before selecting data and caps each category",async()=>{
 state.viewer.role="manager";
 state.permissions=[{page_key:"root-companies",tab_key:"",roles:[],employee_ids:[]}];
 state.rows.root_vendors=Array.from({length:25},(_,i)=>({vendor_id:String(i),vendor_name:"1000"}));
 let groups=await gardenSearch("1,000",new Set());expect(state.tables).not.toContain("root_companies");expect(groups.find(g=>g.key==="root_vendors")?.hits).toHaveLength(5);
 groups=await gardenSearch("1000",new Set(["root_vendors"]));expect(groups.find(g=>g.key==="root_vendors")?.hits).toHaveLength(20);
});
it("builds employee deep links with the search text",()=>{
 const source=SEARCH_SOURCES.find(s=>s.table==="root_employees")!;
 const hit=rowHit(source,{employee_id:"EMP-1",name:"田中",employee_number:"1000"},"1,000");
 expect(hit?.href).toContain("q=1%2C000");expect(hit?.href).toContain("employeeId=EMP-1");
});
