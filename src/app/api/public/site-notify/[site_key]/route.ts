import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import sites from "@/app/system/sites/_data/corporate-sites.json";
import { mentionsFor, type NotifyEmployee } from "@/lib/sites/notify";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"x-garden-site-key"};
export async function OPTIONS(){return new Response(null,{status:204,headers});}
export async function GET(request:Request,context:{params:Promise<{site_key:string}>}){
 const actual=Buffer.from(request.headers.get("x-garden-site-key") ?? ""),expected=Buffer.from(process.env.SITE_NOTIFY_SECRET ?? "");
 if(!expected.length || actual.length!==expected.length || !timingSafeEqual(actual,expected)) return Response.json({error:"unauthorized"},{status:401,headers});
 const {site_key}=await context.params;
 if(!sites.sites.some(s=>s.notify_key===site_key)) return Response.json({error:"not_found"},{status:404,headers});
 try{
 const admin=getSupabaseAdmin();
 const rows=await admin.from("system_site_notify_recipients").select("employee_id").eq("site_key",site_key).order("registration_order");
 if(rows.error) throw rows.error;
 const ids=(rows.data ?? []).map(r=>r.employee_id as string);
 if(!ids.length) return Response.json({mentions:[]},{headers});
 const employees=await admin.from("root_employees").select("employee_id,name,chatwork_account_id,is_active,termination_date,deleted_at").in("employee_id",ids);
 if(employees.error) throw employees.error;
 return Response.json({mentions:mentionsFor(ids,employees.data as NotifyEmployee[])},{headers});
 }catch{return Response.json({error:"unavailable"},{status:503,headers});}
}
