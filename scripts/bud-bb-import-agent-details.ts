import { readFile } from "node:fs/promises";
import { importAgentFolder, type AgentDetail } from "../src/lib/bud/broadband/agent-details";
import { createClient } from "@supabase/supabase-js";

async function main() {
 const args=process.argv.slice(2), folder=args.find(a=>!a.startsWith("--"));
 const json=args.find(a=>a.startsWith("--from-json="))?.slice("--from-json=".length);
 if(!folder && !json) throw new Error("使い方: npx tsx scripts/bud-bb-import-agent-details.ts <フォルダ> [--dry-run]｜--from-json=<file> [--dry-run]");
 // 明細の Excel は数式の文字が exceljs では日付に化けることがあるため、Claude は Python（openpyxl）で読んだ JSON を --from-json で入れる（2026-10-21）
 const rows:AgentDetail[]=json ? JSON.parse(await readFile(json,"utf8")) : await importAgentFolder(folder!);
 console.log(JSON.stringify(rows,null,2));
 if(args.includes("--dry-run")) return;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) throw new Error("Supabase の接続設定がありません");
 const db=createClient(url,key,{auth:{persistSession:false}});
 for(let i=0;i<rows.length;i+=100) {const {error}=await db.from("bud_bb_agent_details").upsert(rows.slice(i,i+100),{onConflict:"payment_date,payee,corp_code"});if(error) throw error;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
