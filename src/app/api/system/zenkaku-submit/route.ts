import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function POST(request:Request){
 const supabase=await createServerClient(); const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return NextResponse.json({ok:false,error:"未ログインです"},{status:401});
 let body:{checkRequestId?:string;submissionId?:string;partnerCode?:string;confirmDuplicate?:boolean}={}; try{body=await request.json()}catch{return NextResponse.json({ok:false,error:"依頼内容を確認してください"},{status:400})}
 const admin=getSupabaseAdmin();
 if(body.submissionId){const {data}=await admin.from("system_zenkaku_submission").select("id").eq("id",body.submissionId).eq("requested_by",auth.user.id).in("status",["needs_partner","needs_confirmation"]).maybeSingle(); if(!data)return NextResponse.json({ok:false,error:"依頼を続けられません"},{status:409}); const values:Record<string,unknown>={status:"pending",updated_at:new Date().toISOString()}; if(body.partnerCode)values.selected_partner_code=body.partnerCode;if(body.confirmDuplicate)values.duplicate_confirmed=true; await admin.from("system_zenkaku_submission").update(values).eq("id",data.id);return NextResponse.json({ok:true,id:data.id});}
 if(!body.checkRequestId)return NextResponse.json({ok:false,error:"先に連携チェックを行ってください"},{status:400});
 const {data:check}=await admin.from("system_zenkaku_check_request").select("id,sales_id,requested_by,status,result").eq("id",body.checkRequestId).eq("requested_by",auth.user.id).maybeSingle();
 if(!check||check.status!=="done"||check.result?.blocking?.length)return NextResponse.json({ok:false,error:"先に連携チェックを完了してください"},{status:409});
 const name=String(auth.user.user_metadata?.full_name||auth.user.user_metadata?.name||auth.user.email||"担当者");
 const {data,error}=await admin.from("system_zenkaku_submission").insert({check_request_id:check.id,sales_id:check.sales_id,requested_by:auth.user.id,requester_name:name}).select("id").single();
 if(error||!data)return NextResponse.json({ok:false,error:"前確依頼を開始できませんでした"},{status:500}); return NextResponse.json({ok:true,id:data.id},{status:201});
}
