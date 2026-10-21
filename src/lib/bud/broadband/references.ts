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
 const read=async<T,>(table:string,order:string)=>{const all:T[]=[];for(let offset=0;;offset+=1000) {const {data,error}=await db.from(table).select("*").order(order).range(offset,offset+999);if(error) throw new Error("明細を読み込めませんでした");all.push(...data as T[]);if(data.length<1000) return all;}};
 const agents=await read<AgentDetail>("bud_bb_agent_details","payment_date");
 const accounts=await read<{mf_account_id:string;corp_code:string;bank_name:string;kind:string}>("bud_mf_accounts","mf_account_id");
 const tx=await read<Bank>("bud_mf_bank_transactions","mf_transaction_id");
 return {agents,bank:tx.flatMap(b=>{const a=accounts.find(a=>a.mf_account_id===b.mf_account_id && a.kind==="bank");return a ? [{...b,corp_code:a.corp_code,bank_name:a.bank_name}] : [];})};
}
