import ExcelJS from "exceljs";
import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";

export type AgentDetail = {payment_date:string;target_month:string;payee:string;corp_code:string;net:number|null;gross:number|null;tax_rate:number|null;tax_mode:string;source_file:string;imported_at:string;review_reason:string};
export { agentName, AGENT_ALIASES } from "./agent-names";
const number = (v:string) => { const s=v.replace(/[,，円¥￥\s]/g, ""); return s && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
// 明細は数式で作られている。cell.text は書式（日付など）を当てて文字が化けるので、数式の結果・文字・数字をそのまま読む（2026-10-21 実測）
const cellText = (v:ExcelJS.CellValue):string => {
 if (v == null) return "";
 if (typeof v === "object") {
  if ("result" in v) return cellText((v as {result?:ExcelJS.CellValue}).result ?? null);
  if ("richText" in v) return (v as {richText:{text:string}[]}).richText.map(t=>t.text).join("");
  if ("text" in v) return String((v as {text:unknown}).text ?? "");
  if (v instanceof Date) return v.toISOString().slice(0,10);
  return "";
 }
 return String(v);
};
const cells = (sheet:ExcelJS.Worksheet) => {
 const rows:string[][]=[];sheet.eachRow({includeEmpty:true},row=>{const values:string[]=[];row.eachCell({includeEmpty:true},(cell,col)=>{values[col-1]=cellText(cell.value);});rows.push(values);});return rows;
};
export async function parseAgentFile(path:string, now=new Date().toISOString()):Promise<AgentDetail|null> {
 const name=basename(path), match=name.match(/御支払明細(\d{4})(\d{2})(\d{2})【(.+?)】(?:_([A-Za-z]+))?/);
 if(!match) throw new Error(`ファイル名を確認してください: ${name}`);
 const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);
 const cover=book.getWorksheet("表紙");if(!cover) throw new Error(`表紙がありません: ${name}`);
 const rows=cells(cover), row=rows.find(r=>r.some(c=>/関西電力/.test(c)));
 if(!row) return null;
 const index=row.findIndex(c=>/関西電力/.test(c)), amount=row.slice(index+1).map(number).find(n=>n!==null);
 if(amount==null) return {payment_date:`${match[1]}-${match[2]}-${match[3]}`,target_month:`${match[1]}-${match[2]}`,payee:match[4].replace(/_?修正版?$/,"").replace(/様$/, ""),corp_code:match[5] ?? "",net:null,gross:null,tax_rate:null,tax_mode:"不明",source_file:name,imported_at:now,review_reason:"関西電力の金額を確認できません"};
 const taxRow=rows.find(r=>r.some(c=>/^消費税/.test(c.trim()))), ti=taxRow?.findIndex(c=>/^消費税/.test(c.trim())) ?? -1;
 const tax=taxRow?.slice(ti+1).filter(Boolean) ?? [], mode=tax.some(c=>/内税|税込/.test(c)) ? "内税" : tax.some(c=>number(c)!==null) ? "別途" : "不明";
 let net:number|null=null,gross:number|null=null,rate:number|null=null,reason="";
 const detail=book.worksheets.find(s=>s!==cover && s.name.includes("関電"));
 const dr=detail ? cells(detail) : [], header=dr.findIndex(r=>r.some(c=>/コミッション/.test(c)) && r.some(c=>/消費税/.test(c)));
 if(mode==="別途") {net=amount;rate=0.1;gross=Math.round(amount*1.1);}
 else if(mode==="内税" && header>=0) {
  const ni=dr[header].findIndex(c=>/コミッション/.test(c)), xi=dr[header].findIndex(c=>/消費税/.test(c));
  const values=dr.slice(header+1).filter(r=>!r.some(c=>/合計|小計/.test(c))).map(r=>[number(r[ni]??""),number(r[xi]??"")]).filter(v=>v[0]!==null && v[1]!==null);
  if(values.length) {net=values.reduce((n,v)=>n+v[0]!,0);const t=values.reduce((n,v)=>n+v[1]!,0);gross=amount;rate=net===0 ? 0 : t/net;if(Math.abs(net+t-amount)>1) {reason="関電シートと表紙の金額が一致しません";net=null;}}
 }
 if(mode==="内税" && net===null && !reason) {
  const all=rows.flat().join(" ");
  if(/税率\s*0\s*%|消費税なし|消費税を取っていない/.test(all)) {net=amount;gross=amount;rate=0;}
  else if(/10\s*%/.test(all)) {net=Math.round(amount/1.1);gross=amount;rate=0.1;}
  else reason="内税の税率（10%／消費税なし）を確認してください";
 }
 if(mode==="不明") reason="消費税の内税／別途を確認してください";
 return {payment_date:`${match[1]}-${match[2]}-${match[3]}`,target_month:`${match[1]}-${match[2]}`,payee:match[4].replace(/_?修正版?$/,"").replace(/様$/, ""),corp_code:match[5] ?? "",net,gross,tax_rate:rate,tax_mode:mode,source_file:name,imported_at:now,review_reason:reason};
}
export async function importAgentFolder(folder:string):Promise<AgentDetail[]> {
 const files:string[]=[];
 const walk=async(dir:string)=>{for(const entry of await readdir(dir,{withFileTypes:true})) {const path=join(dir,entry.name);if(entry.isDirectory()) { if(entry.name!=="999_Archive") await walk(path); }else if(entry.name.endsWith(".xlsx") && entry.name.includes("御支払明細") && !entry.name.startsWith("~$")) files.push(path);}};
 await walk(folder);
 const chosen=new Map<string,string>();
 // 修正版の書き方は 5 通り（【修正】【修正版】-修正 _YYYYMMDD修正 様_修正版。2026-10-21 実測）。同じ支払日・支払先・法人なら修正版を使う
 const fixed=(name:string)=>/修正/.test(name);
 const baseKey=(name:string)=>name.replace(/【修正版?】|[-_]\d{0,8}修正版?|_修正版/g,"").replace(/\.xlsx$/,"");
 for(const path of files.sort()) {const key=baseKey(basename(path));const old=chosen.get(key);if(!old || (fixed(basename(path)) && !fixed(basename(old)))) chosen.set(key,path);}
 const result:AgentDetail[]=[];for(const path of chosen.values()) {try {const row=await parseAgentFile(path);if(row) result.push(row);} catch(e) {const m=basename(path).match(/御支払明細(\d{4})(\d{2})(\d{2})【(.+?)】/);if(m) result.push({payment_date:`${m[1]}-${m[2]}-${m[3]}`,target_month:`${m[1]}-${m[2]}`,payee:m[4].replace(/様$/,""),corp_code:"",net:null,gross:null,tax_rate:null,tax_mode:"不明",source_file:basename(path),imported_at:new Date().toISOString(),review_reason:`読めませんでした：${e instanceof Error ? e.message : ""}`});}}return result;
}
