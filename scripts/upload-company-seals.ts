/** Run: node --experimental-strip-types scripts/upload-company-seals.ts <PNG directory> [--dry-run]
 * Credentials: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
 * Resolves company_id from root_companies; never assumes production IDs.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
const names = ["ヒュアラン","センターライズ","リンクサポート","ARATA","たいよう","壱","ストーンベース"];
const directory = process.argv[2];
if (!directory || directory.startsWith("--")) throw new Error("PNG画像のディレクトリを引数で指定してください");
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const {data:companies,error}=await db.from("root_companies").select("company_id,company_name");
if(error)throw error;
const uploads=await Promise.all(names.map(async name=>{
 const matches=companies!.filter(c=>c.company_name.replace(/株式会社|合同会社|\s/g,"")===name);
 if(matches.length!==1)throw new Error(`${name}: 法人を一意に特定できません`);
 let filename=`${name}角印_実寸400dpi透過.png`;
 const bytes=await readFile(path.join(directory,filename)).catch(async error=>{
  if(error.code!=="ENOENT")throw error;
  filename=`${matches[0].company_name}角印_実寸400dpi透過.png`;
  return readFile(path.join(directory,filename));
 });
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error(`${filename}: PNGではありません`);
 return {companyId:matches[0].company_id,companyName:matches[0].company_name,filename,bytes};
}));
console.table(uploads.map(({companyId,companyName,filename})=>({companyId,companyName,filename,destination:`company-seals/${companyId}.png`})));
if(!process.argv.includes("--dry-run"))for(const item of uploads){
 const {error}=await db.storage.from("company-seals").upload(`${item.companyId}.png`,item.bytes,{contentType:"image/png",upsert:true});
 if(error)throw error;
}
