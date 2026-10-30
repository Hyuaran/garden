import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({viewer:{employeeId:"EMP-0010",role:"staff"},bud:false,tables:[] as string[],selects:[] as string[],filters:[] as unknown[][],rows:{} as Record<string,Record<string,unknown>[]>,permissions:[] as unknown[]}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:async()=>({db:db(),userId:"user-10",viewer:state.viewer}),readViewPermissions:async()=>state.permissions}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>db()}));
function db(){return {rpc:async()=>({data:state.bud,error:null}),from:(name:string)=>{const table=name.replace(/^search_v_/,"");
 state.tables.push(table);
 const predicates:((row:Record<string,unknown>)=>boolean)[]=[];
 let maximum=Infinity,from=0,to=Infinity;
 const q={
  select:(s:string)=>{state.selects.push(s);return q;},order:()=>q,
  range:(start:number,end:number)=>{state.filters.push([table,"range",start,end]);from=start;to=end;return q;},
  limit:(n:number)=>{state.filters.push([table,"limit",n]);maximum=n;return q;},
  ilike:(column:string,pattern:string)=>{
   state.filters.push([table,"ilike",column,pattern]);
   const needle=pattern.slice(1,-1).replace(/\\([\\%_])/g,"$1");
   predicates.push(row=>String(row[column]??"").toLowerCase().includes(needle));return q;
  },
  eq:(key:string,value:unknown)=>{predicates.push(row=>row[key]===value);state.filters.push([table,key,value]);return q;},
  is:(key:string,value:unknown)=>{predicates.push(row=>row[key]===value);state.filters.push([table,"is",key,value]);return q;},
  in:(key:string,values:unknown[])=>{predicates.push(row=>values.includes(row[key]));state.filters.push([table,"in",key,values]);return q;},
  then:(resolve:(value:unknown)=>unknown)=>resolve({data:(state.rows[table]??[]).filter(row=>predicates.every(predicate=>predicate(row))).slice(from,Math.min(to+1,from+maximum)),error:null})
 };return q;
}};}
import { gardenSearch, rowHit, searchPattern } from "./search.server";
import { SEARCH_SOURCES } from "./catalog";
beforeEach(()=>{state.viewer={employeeId:"EMP-0010",role:"staff"};state.bud=false;state.tables=[];state.selects=[];state.filters=[];state.rows={};state.permissions=[];});
it("does not select forbidden screens, secrets, external or list phone tables",async()=>{
 await gardenSearch("1000",new Set());
 expect(state.tables).not.toContain("root_employees");expect(state.tables).not.toContain("soil_list_phone");expect(state.tables).not.toContain("system_hire_candidates");
 expect(state.selects.join(",")).not.toMatch(/account_number|my_number|token|password|secret|cipher|\*/);
 for(const source of SEARCH_SOURCES)expect(source.fields.map(f=>f.select??f.column).join(",")).not.toMatch(/account_?number|my_?number|token|password|secret|cipher|\*/i);
});
it("keeps employee, submitted_by and requested_by restrictions",async()=>{
 state.rows.system_expense_report=[{id:"own",purpose:"1000",search_text:"1000",submitted_by:"user-10"},{id:"other",purpose:"1000",search_text:"1000",submitted_by:"other"}];
 const groups=await gardenSearch("1000",new Set());
 expect(groups.flatMap(g=>g.hits).map(h=>h.id)).toContain("system_expense_report:own");expect(groups.flatMap(g=>g.hits).map(h=>h.id)).not.toContain("system_expense_report:other");
 expect(state.filters).toContainEqual(["system_zenkaku_check_request","requested_by","user-10"]);
 expect(state.filters).toContainEqual(["system_onboarding","employee_id","EMP-0010"]);
});
it("applies permission overrides before selecting data and caps each category",async()=>{
 state.viewer.role="manager";
 state.permissions=[{page_key:"root-companies",tab_key:"",roles:[],employee_ids:[]}];
 state.rows.root_vendors=Array.from({length:25},(_,i)=>({vendor_id:String(i),vendor_name:"1000",search_text:"1000"}));
 let groups=await gardenSearch("1,000",new Set());expect(state.tables).not.toContain("root_companies");expect(groups.find(g=>g.key==="root_vendors")?.hits).toHaveLength(5);
 groups=await gardenSearch("1000",new Set(["root_vendors"]));expect(groups.find(g=>g.key==="root_vendors")?.hits).toHaveLength(20);
});
it("builds employee deep links with the search text",()=>{
 const source=SEARCH_SOURCES.find(s=>s.table==="root_employees")!;
 const hit=rowHit(source,{employee_id:"EMP-1",name:"田中",employee_number:"1000"},"1,000");
 expect(hit?.href).toContain("q=1%2C000");expect(hit?.href).toContain("employeeId=EMP-1");
});
it("filters in the database before limiting and still uses rowHit for the returned candidates",async()=>{
 state.viewer.role="manager";
 state.rows.root_vendors=[
  ...Array.from({length:1001},(_,i)=>({vendor_id:`skip-${i}`,vendor_name:"other",search_text:"other"})),
  {vendor_id:"match",vendor_name:"１０００",search_text:"1000"},
  {vendor_id:"db-excluded",vendor_name:"1000",search_text:"other"},
  {vendor_id:"rowHit-excluded",vendor_name:"other",search_text:"1000"},
 ];
 const groups=await gardenSearch("１，０００",new Set());
 expect(groups.find(group=>group.key==="root_vendors")?.hits.map(hit=>hit.id)).toEqual(["root_vendors:match"]);
 expect(state.filters).toContainEqual(["root_vendors","ilike","search_text","%1000%"]);
 expect(state.filters).toContainEqual(["root_vendors","limit",21]);
 expect(state.filters.some(filter=>filter[1]==="range")).toBe(false);
});
it("escapes LIKE wildcards and backslashes, preserving date and phone query spelling",()=>{
 expect(searchPattern(" Ａ＿１００％\\ ")).toBe("%a\\_100\\%\\\\%");
 expect(searchPattern("２０２６／１０／３０")).toBe("%2026/10/30%");
 expect(searchPattern("03-1234-5678")).toBe("%03-1234-5678%");
});
it("retains status, active target and deleted bank account restrictions",async()=>{
 state.viewer.role="super_admin";
 await gardenSearch("1000",new Set());
 expect(state.filters).toContainEqual(["root_bank_accounts","is","deleted_at",null]);
 expect(state.filters).toContainEqual(["system_line_target","active",true]);
 expect(state.filters).toContainEqual(["system_line_target","in","account",["dev","official"]]);
 expect(state.filters).toContainEqual(["system_line_target","in","target_type",["group","room"]]);
 expect(state.filters).toContainEqual(["system_hire_candidates","status","hired"]);
 expect(state.filters).toContainEqual(["system_hire_candidates","in","status",["planned","hiring","no_show"]]);
});
it("keeps the account visibility path outside the database search limit",async()=>{
 state.bud=true;
 await gardenSearch("1000",new Set());
 expect(state.filters).toContainEqual(["bud_mf_accounts","range",0,999]);
 expect(state.filters.some(filter=>filter[0]==="bud_mf_accounts" && ["ilike","limit"].includes(String(filter[1])))).toBe(false);
});
