import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkFilemakerRequests } from "@/app/system/onboarding/_lib/filemaker-accounts.server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const auth=verifyBearerRequest(req,"CRON_SECRET");
 if(!auth.ok)return Response.json({error:auth.reason},{status:auth.status});
 try{return Response.json(await checkFilemakerRequests(getSupabaseAdmin()));}
 catch{return Response.json({error:"確認できませんでした"},{status:500});}
}
