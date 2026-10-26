import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentDetail } from "./agent-details";
import type { Bank } from "./reconcile";
export const isNtt = (partner:string) => partner.startsWith("NTT原価");
export const isK = (partner:string) => ["関電経費合計","決済費用（壱）","決済費用(壱)"].includes(partner);
export function nttReference(month:string, center:boolean, bank:Bank[]) {
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),10)).toISOString().slice(0,10);
 return bank.filter(b=>b.side==="EXPENSE" && b.date>=month+"-20" && b.date<=end && b.corp_code===(center ? "CR" : "HR") && b.content.includes(center ? "ゼイキントウ" : "電話料"));
}
export async function readReferences(db:SupabaseClient) {
 // 口座の明細は NTT 原価の参考額（電話料・ゼイキントウの出金）にしか使わない。全件（約 2 万件）を 1,000 件ずつ読んで画面へ送っていたため、
 // 開くのに 14 秒・6.7MB かかっていた（2026-10-26）。必要な行と列だけを読み、3 つの表は同時に読む
 const read=async<T,>(table:string,columns:string,order:string,filter?:(q:any)=>any)=>{const all:T[]=[];for(let offset=0;;offset+=1000) {let q=db.from(table).select(columns);if(filter) q=filter(q);const {data,error}=await q.order(order).range(offset,offset+999);if(error) throw new Error("明細を読み込めませんでした");all.push(...(data as T[]));if((data as T[]).length<1000) return all;}};
 const [agents,accounts,tx]=await Promise.all([
  read<AgentDetail>("bud_bb_agent_details","*","payment_date"),
  read<{mf_account_id:string;corp_code:string;bank_name:string}>("bud_mf_accounts","mf_account_id,corp_code,bank_name","mf_account_id",q=>q.eq("kind","bank")),
  read<Bank>("bud_mf_bank_transactions","mf_transaction_id,mf_account_id,date,side,value,content","mf_transaction_id",q=>q.eq("side","EXPENSE").or("content.like.*電話料*,content.like.*ゼイキントウ*")),
 ]);
 const byId=new Map(accounts.map(a=>[a.mf_account_id,a]));
 return {agents,bank:tx.flatMap(b=>{const a=byId.get(b.mf_account_id);return a ? [{...b,corp_code:a.corp_code,bank_name:a.bank_name}] : [];})};
}
