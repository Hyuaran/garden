import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { agentWork, applyAgentResults, parseAgentResults } from "@/app/system/onboarding/_lib/filemaker-accounts.server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const auth=verifyBearerRequest(req,"RELAY_SECRET");
 if(!auth.ok)return Response.json({error:auth.reason},{status:auth.status});
 try{return Response.json(await agentWork(getSupabaseAdmin()),{headers:{"Cache-Control":"no-store"}});}
 catch{return Response.json({error:"依頼を読み込めませんでした"},{status:500});}
}
export async function POST(req:Request){
 const auth=verifyBearerRequest(req,"RELAY_SECRET");
 if(!auth.ok)return Response.json({error:auth.reason},{status:auth.status});
 let results;
 try{results=parseAgentResults(await req.json());}catch{return Response.json({error:"結果の形式が正しくありません"},{status:400});}
 try{await applyAgentResults(getSupabaseAdmin(),results);return Response.json({ok:true});}
 catch{return Response.json({error:"結果を保存できませんでした"},{status:500});}
}
