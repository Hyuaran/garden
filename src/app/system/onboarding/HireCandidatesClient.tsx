"use client";
import { useState, useEffect, type ReactNode } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { EMPLOYMENT_TYPES, type HireCandidate, type HireInput } from "./_lib/hire-candidates";
import styles from "./onboarding.module.css";
const base = "/api/system/hire-candidates";
async function api(path = "", method = "GET", body?: unknown) {
 const res = await fetch(base+path,{method,headers:body ? {"Content-Type":"application/json"}:undefined,body:body ? JSON.stringify(body):undefined,cache:"no-store"});
 const data = await res.json(); if (!res.ok) throw new Error(data.error || "処理できませんでした"); return data;
}
type Options = {companies:{company_id:string;company_name:string}[];divisions:{code:string;name:string}[];workingTypes:{code:string;name:string}[]};
const labels: [keyof HireInput,string][] = [["last_name","姓"],["first_name","名"],["last_name_kana","セイ"],["first_name_kana","メイ"],["birthday","生年月日"],["hire_date","入社日"]];
const steps = [["number","社員番号を決める"],["kot","KOT に登録"],["roster","Kintone 名簿に登録"],["garden","Garden に反映"]];
export default function HireCandidatesClient({children}:{children:ReactNode}) {
 const [tab,setTab]=useState("candidates"), [rows,setRows]=useState<HireCandidate[]>([]), [message,setMessage]=useState(""), [busy,setBusy]=useState(false);
 const [options,setOptions]=useState<Options|null>(null), [form,setForm]=useState<HireInput|null>(null), [editing,setEditing]=useState<string|null>(null), [confirmation,setConfirmation]=useState<HireCandidate|null>(null);
 const load = async () => { const data = await api(); setRows(data); };
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 useEffect(()=>{if(!busy)return; const timer=setInterval(()=>{load().catch(()=>{});},1200);return()=>clearInterval(timer);},[busy]);
 const run = async (action:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await action();await load();}catch(e){setMessage(e instanceof Error?e.message:"処理できませんでした");}finally{setBusy(false);}};
 const openForm = (row?:HireCandidate)=>run(async()=>{setOptions(await api("/kot-options"));setEditing(row?.id ?? null);setForm(row ?? {last_name:"",first_name:"",last_name_kana:"",first_name_kana:"",birthday:"",hire_date:"",gender:"male",employment_type:"アルバイト",company_id:"",kot_division_code:"",kot_type_code:""});});
 const set=(key:keyof HireInput,value:string)=>setForm(old=>old?{...old,[key]:value}:null);
 const select=(key:keyof HireInput,label:string,opts:{value:string;label:string}[]) => <BoxSelect key={key} label={label} multiple={false} value={form?.[key]?[form[key]]:[]} options={opts} onChange={v=>set(key,v[0])}/>;
 const status=(r:HireCandidate)=>r.status==="hired"?"入社済み（"+r.employee_number+"）":r.status==="no_show"?"来なかった":r.status==="hiring"?(!r.steps.kot?.done?"KOT 登録待ち":!r.steps.roster?.done?"名簿登録待ち":"Garden 反映待ち"):"入社予定";
 const columns:DataColumn<HireCandidate>[]=[
 {id:"date",label:"入社日",type:"date",value:r=>r.hire_date},
 {id:"name",label:"氏名",type:"text",value:r=>r.last_name+" "+r.first_name},
 {id:"employment",label:"雇用形態",type:"text",value:r=>r.employment_type},
 {id:"status",label:"状態",type:"text",value:status},
 {id:"actions",label:"操作",type:"text",value:()=>"",wrap:true,render:r=><div>
 {(r.status==="planned"||r.status==="hiring")&&<button disabled={busy} onClick={()=>run(async()=>{const updated=await api("/"+r.id+"/hire","POST",{prepare:true});if(!updated.employee_number)throw new Error(updated.steps.number?.error || "社員番号を決められませんでした");setConfirmation(updated);})}>{r.status==="hiring"?"続きから":"出社を確認して入社にする"}</button>}
 {r.status==="planned"&&<>{!r.employee_number&&<button disabled={busy} onClick={()=>openForm(r)}>修正</button>}<button disabled={busy} onClick={()=>run(async()=>{await api("/"+r.id,"PATCH",{status:"no_show"});})}>来なかった</button></>}
 {(r.status==="hiring"||r.status==="hired")&&<ol aria-label="入社の進み具合">{steps.map(([key,label])=><li key={key}>{r.steps[key]?.done?"✓ ":""}{label}{r.steps[key]?.error&&<p role="status">{r.steps[key].error}</p>}</li>)}</ol>}
 </div>}
 ];
 return <><SystemTabs><button role="tab" aria-selected={tab==="candidates"} onClick={()=>setTab("candidates")}>入社予定者</button><button role="tab" aria-selected={tab==="onboarding"} onClick={()=>setTab("onboarding")}>入社手続き</button></SystemTabs>
 <div hidden={tab!=="onboarding"}>{children}</div>
 {tab==="candidates"&&<section className={styles.panel} {...CLARITY_MASK}>
 {message&&<p role="alert">{message}</p>}
 <DataTable rows={rows} columns={columns} rowKey={r=>r.id} searchText={r=>r.last_name+r.first_name+r.employee_number} defaultSort={{id:"date",direction:"desc"}} toolbar={<button disabled={busy} onClick={()=>openForm()}>＋ 入社予定者を登録</button>}/>
 {form&&options&&<section aria-label="入社予定者の入力" className={styles.panel}>
 <h2>{editing?"入社予定者を修正":"入社予定者を登録"}</h2>
 <div className={styles.hireGrid}>{labels.map(([key,label])=><label key={key}>{label}<input required type={key==="birthday"||key==="hire_date"?"date":"text"} value={form[key]} onChange={e=>set(key,e.target.value)}/></label>)}
 {select("gender","性別",[{value:"male",label:"男性"},{value:"female",label:"女性"}])}
 {select("employment_type","雇用形態",EMPLOYMENT_TYPES.map(value=>({value,label:value})))}
 {select("company_id","所属法人",options.companies.map(c=>({value:c.company_id,label:c.company_name})))}
 {select("kot_division_code","KOT の所属",options.divisions.map(c=>({value:c.code,label:c.name})))}
 {select("kot_type_code","KOT の雇用区分",options.workingTypes.map(c=>({value:c.code,label:c.name})))}
 </div><button disabled={busy} onClick={()=>run(async()=>{await api(editing?"/"+editing:"",editing?"PATCH":"POST",form);setForm(null);})}>保存する</button><button disabled={busy} onClick={()=>setForm(null)}>閉じる</button></section>}
 {confirmation&&<section role="dialog" aria-modal="true" aria-label="入社の確認" className={styles.panel}>
 <p>{confirmation.last_name} {confirmation.first_name}さんを社員番号 {confirmation.employee_number} で KOT と Garden に登録します。KOT はこの時点から料金の対象になります。</p>
 <button disabled={busy} onClick={()=>run(async()=>{const id=confirmation.id;setConfirmation(null);await api("/"+id+"/hire","POST",{});})}>登録する</button><button disabled={busy} onClick={()=>setConfirmation(null)}>やめる</button></section>}
 </section>}</>;
}
