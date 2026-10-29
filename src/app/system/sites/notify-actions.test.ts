import { beforeEach, expect, it, vi } from "vitest";
import { saveNotifyRecipients } from "./notify-actions";
const state=vi.hoisted(()=>({user:true,role:"super_admin",active:true,visible:true,rpc:vi.fn().mockResolvedValue({error:null})}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:async()=>({data:{user:state.user?{id:"u"}:null}})},from:()=>{
 const query={select:()=>query,eq:()=>query,is:()=>query,maybeSingle:async()=>({data:{employee_id:"admin",garden_role:state.role,is_active:state.active}})};return query;
}})}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:async()=>({viewer:{}}),canView:async()=>state.visible}));
vi.mock("@/lib/sites/notify.server",()=>({loadNotifyState:async()=>({employees:[{value:"a",label:"A"}],recipients:{}})}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({rpc:state.rpc})}));
beforeEach(()=>{state.user=true;state.role="super_admin";state.active=true;state.visible=true;state.rpc.mockClear();});
it("requires login, active super admin and site visibility",async()=>{
 for(const setup of [()=>{state.user=false;},()=>{state.user=true;state.role="admin";},()=>{state.role="super_admin";state.active=false;},()=>{state.active=true;state.visible=false;}]){setup();await expect(saveNotifyRecipients("hyuaran-company",["a"])).rejects.toThrow();}
 expect(state.rpc).not.toHaveBeenCalled();
});
it("rejects unknown sites, duplicate ids and ineligible employees",async()=>{
 for(const [key,ids] of [["unknown",["a"]],["hyuaran-company",["a","a"]],["hyuaran-company",["no-number"]]] as const) await expect(saveNotifyRecipients(key,[...ids])).rejects.toThrow();
 expect(state.rpc).not.toHaveBeenCalled();
});
it("saves a validated selection atomically with the actor",async()=>{await saveNotifyRecipients("hyuaran-company",["a"]);expect(state.rpc).toHaveBeenCalledWith("replace_site_notify_recipients",{p_site_key:"hyuaran-company",p_employee_ids:["a"],p_updated_by:"admin"});});
