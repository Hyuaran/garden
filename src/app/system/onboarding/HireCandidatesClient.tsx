"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { EMPLOYMENT_TYPES, checklistComplete, checklistPriority, type ChecklistKey, type HireCandidate, type HireInput } from "./_lib/hire-candidates";
import styles from "./onboarding.module.css";
const base = "/api/system/hire-candidates";
async function api(path = "", method = "GET", body?: unknown) {
 const res = await fetch(base+path,{method,headers:body ? {"Content-Type":"application/json"}:undefined,body:body ? JSON.stringify(body):undefined,cache:"no-store"});
 const data = await res.json(); if (!res.ok) throw new Error(data.error || "処理できませんでした"); return data;
}
type Options = {companies:{company_id:string;company_name:string}[];divisions:{code:string;name:string}[];workingTypes:{code:string;name:string}[]};
const steps = [["number","社員番号を決める"],["kot","KOT に登録"],["roster","Kintone 名簿に登録"],["garden","Garden に反映"]];
export default function HireCandidatesClient({children,userId}:{children:ReactNode;userId:string}) {
 const [showNoShow,setShowNoShow]=useState(false), [showComplete,setShowComplete]=useState(false);
 useEffect(()=>{
  try {
   const saved=JSON.parse(localStorage.getItem('hire-candidates:'+userId) ?? "{}");
   setShowNoShow(saved?.showNoShow===true);setShowComplete(saved?.showComplete===true);
  } catch {setShowNoShow(false);setShowComplete(false);}
 },[userId]);
 const saveVisibility=(noShow:boolean,complete:boolean)=>{
  setShowNoShow(noShow);setShowComplete(complete);
  try {localStorage.setItem('hire-candidates:'+userId,JSON.stringify({showNoShow:noShow,showComplete:complete}));} catch {}
 };
 const [tab,setTab]=useState("candidates"), [rows,setRows]=useState<HireCandidate[]>([]), [message,setMessage]=useState(""), [busy,setBusy]=useState(false);
 const [options,setOptions]=useState<Options|null>(null), [form,setForm]=useState<HireInput|null>(null), [editing,setEditing]=useState<string|null>(null), [confirmation,setConfirmation]=useState<HireCandidate|null>(null);
 const formDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!form || !options)return;
  const dialog=formDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  return()=>{dialog?.close();previous?.focus();};
 },[!!form,!!options]);
 const [saving,setSaving]=useState<string|null>(null);
 const load = async () => { const data = await api(); setRows(data); };
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 useEffect(()=>{if(!busy)return; const timer=setInterval(()=>{load().catch(()=>{});},1200);return()=>clearInterval(timer);},[busy]);
 const run = async (action:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await action();await load();}catch(e){setMessage(e instanceof Error?e.message:"処理できませんでした");}finally{setBusy(false);}};
 // KOT の選択肢は画面を開いた時に先に読んでおく（行を押してから小窓が出るまで 5 秒かかったため 2026-10-26）
 const optionsRequest=useRef<Promise<Options>|null>(null);
 const loadOptions=()=>optionsRequest.current ??= api("/kot-options").then((o:Options)=>{setOptions(o);return o;}).catch((e:unknown)=>{optionsRequest.current=null;throw e;});
 useEffect(()=>{loadOptions().catch(()=>{});},[]);
 const openForm = (row?:HireCandidate)=>{setMessage("");setEditing(row?.id ?? null);setForm(row ?? {last_name:"",first_name:"",last_name_kana:"",first_name_kana:"",birthday:"",hire_date:"",gender:"male",employment_type:"アルバイト",company_id:"",kot_division_code:"104",kot_type_code:""});if(!options)loadOptions().catch(e=>setMessage(e instanceof Error?e.message:"選択肢を読み込めませんでした"));};
 const set=(key:keyof HireInput,value:string)=>setForm(old=>old?{...old,[key]:value}:null);
 const field=(key:keyof HireInput,label:string,type="text")=><label key={key}>{label}<input required type={type} value={form?.[key] ?? ""} onChange={e=>set(key,e.target.value)}/></label>;
 const choice=(key:keyof HireInput,label:string,opts:{value:string;label:string}[])=><label key={key}>{label}<select required value={form?.[key] ?? ""} onChange={e=>set(key,e.target.value)}><option value="" disabled>選んでください</option>{opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
 const status=(r:HireCandidate)=>r.status==="hired"?"入社済み（"+r.employee_number+"）":r.status==="no_show"?"辞退":r.status==="hiring"?(!r.steps.kot?.done?"KOT 登録待ち":!r.steps.roster?.done?"名簿登録待ち":"Garden 反映待ち"):"入社予定";
 const toggleChecklist = async (row:HireCandidate,key:ChecklistKey,value:boolean) => {
  if(saving)return;
  setSaving(row.id);setMessage("");
  setRows(old=>old.map(r=>r.id===row.id?{...r,checklist:{...r.checklist,[key]:value?{checked_at:new Date().toISOString(),checked_by:"pending"}:undefined}}:r));
  try {
   const updated=await api("/"+row.id,"PATCH",{checklist:{[key]:value}});
   setRows(old=>old.map(r=>r.id===row.id?{...r,checklist:updated.checklist}:r));
  } catch(e) {
   setRows(old=>old.map(r=>r.id===row.id?{...r,checklist:row.checklist}:r));
   setMessage(e instanceof Error?e.message:"保存できませんでした");
  } finally {setSaving(null);}
 };
 const check = (r:HireCandidate,key:ChecklistKey,label:string) => <label key={key} className={styles.hireCheck}><input type="checkbox" aria-label={`${r.last_name} ${r.first_name} ${key.startsWith("contract")?"雇用契約書":key.startsWith("nda")?"秘密保持":key.startsWith("emergency")?"緊急連絡先":"FileMaker"} ${label}`} checked={!!r.checklist?.[key]} disabled={busy||!!saving} onChange={e=>toggleChecklist(r,key,e.target.checked)}/>{label}</label>;
 const columns:DataColumn<HireCandidate>[]=[
 {id:"date",label:"入社予定日",type:"date",value:r=>r.hire_date},
 {id:"name",label:"氏名",type:"text",value:r=>r.last_name+" "+r.first_name},
 {id:"employment",label:"雇用形態",type:"text",value:r=>r.employment_type},
 {id:"status",label:"状態",type:"text",value:r=>status(r)+(checklistComplete(r)?" 完了":"")},
 {id:"actions",label:"操作",type:"text",value:()=>"",wrap:true,render:r=><div className={styles.hireRowActions}>
 {r.status==="planned"&&<button className={styles.hireDecline} disabled={busy||!!saving} onClick={()=>run(async()=>{await api("/"+r.id,"PATCH",{status:"no_show"});})}>辞退</button>}
 {(r.status==="planned"||r.status==="hiring")&&<button className={styles.hirePrimary} disabled={busy||!!saving} onClick={()=>run(async()=>{const updated=await api("/"+r.id+"/hire","POST",{prepare:true});if(!updated.employee_number)throw new Error(updated.steps.number?.error || "社員番号を決められませんでした");setConfirmation(updated);})}>{r.status==="hiring"?"続きから":"入社"}</button>}
 {(r.status==="hiring"||r.status==="hired")&&<ol aria-label="入社の進み具合">{steps.map(([key,label])=><li key={key}>{r.steps[key]?.done?"✓ ":""}{label}{r.steps[key]?.error&&<p role="status">{r.steps[key].error}</p>}</li>)}</ol>}
 </div>}
 ];
 const confirmationColumns:DataColumn<HireCandidate>[]=[
 // 1280px の画面でもはみ出さないよう 3 列に（氏名の下に社員番号・入社日、書類と FileMaker は 1 列）2026-10-26
 {id:"name",label:"氏名",type:"text",value:r=>r.last_name+" "+r.first_name,wrap:true,render:r=><div className={styles.hireMf}><div>{r.last_name} {r.first_name}{checklistComplete(r)&&<span className={styles.hireDone}>完了</span>}</div><div className={styles.hireNumber}>{r.employee_number ?? "番号なし"}・{r.hire_date} 入社</div></div>},
 {id:"onboarding",label:"手続き・LINE",type:"text",value:r=>(r.onboarding_status==="submitted"?"提出済み":r.onboarding_status?"入力中":"未")+" "+(r.line_registered?"登録済み":"未登録"),wrap:true,render:r=><div className={styles.hireMf}><div className={styles.hireMfRow}><span className={styles.hireMfLabel}>入社手続き</span>{r.onboarding_status==="submitted"?"提出済み":r.onboarding_status?"入力中":"未"}</div><div className={styles.hireMfRow}><span className={styles.hireMfLabel}>公式 LINE</span>{r.line_registered?"登録済み":"未登録"}</div></div>},
 {id:"docs",label:"書類・FileMaker",type:"number",value:checklistPriority,wrap:true,render:r=><div className={styles.hireMf}>{([["contract","雇用契約書"],["nda","秘密保持"],["emergency","緊急連絡先"]] as const).map(([key,label])=><div key={key} className={styles.hireMfRow}><span className={styles.hireMfLabel}>{label}</span>{check(r,`${key}_sent`,"送った")}{check(r,`${key}_signed`,"締結済み")}</div>)}<div className={styles.hireMfRow}><span className={styles.hireMfLabel}>FileMaker</span>{check(r,"filemaker_added","追加済み")}</div></div>}
 ];
 const candidateRows=rows.filter(r=>r.status==="planned"||r.status==="hiring"||(showNoShow&&r.status==="no_show"));
 const confirmationRows=rows.filter(r=>r.status==="hired"&&(showComplete||!checklistComplete(r)));
 return <><SystemTabs><button role="tab" aria-selected={tab==="candidates"} onClick={()=>setTab("candidates")}>入社予定者</button><button role="tab" aria-selected={tab==="confirmations"} onClick={()=>setTab("confirmations")}>入社後の確認</button><button role="tab" aria-selected={tab==="onboarding"} onClick={()=>setTab("onboarding")}>入社手続き</button></SystemTabs>
 <div hidden={tab!=="onboarding"}>{children}</div>
 {tab==="confirmations"&&<section className={styles.hireCandidates} {...CLARITY_MASK}>
 {message&&<p role="alert">{message}</p>}
 <DataTable key="confirmations" rows={confirmationRows} columns={confirmationColumns} rowKey={r=>r.id} searchPlaceholder="氏名・カナで探す" searchText={r=>[r.last_name+r.first_name,r.last_name+" "+r.first_name,(r.last_name_kana??"")+(r.first_name_kana??""),r.last_name_kana+" "+r.first_name_kana,r.employee_number].join(" ")} defaultSort={{id:"complete",direction:"asc"}}/>
 <label className={styles.hireCheck}><input type="checkbox" checked={showComplete} onChange={e=>saveVisibility(showNoShow,e.target.checked)}/>完了も表示</label>
 </section>}
 {tab==="candidates"&&<section className={styles.hireCandidates} {...CLARITY_MASK}>
 {message&&<p role="alert">{message}</p>}
 <DataTable key="candidates" onRowClick={r=>{if(!busy&&!saving)void openForm(r);}} rowClickable={r=>r.status==="planned"} rows={candidateRows} columns={columns} rowKey={r=>r.id} searchPlaceholder="氏名・カナで探す" searchText={r=>[r.last_name+r.first_name,r.last_name+" "+r.first_name,(r.last_name_kana??"")+(r.first_name_kana??""),r.last_name_kana+" "+r.first_name_kana,r.employee_number].join(" ")} defaultSort={{id:"date",direction:"asc"}} toolbar={<button disabled={busy||!!saving} onClick={()=>openForm()}>＋ 入社予定者を登録</button>}/>
 <label className={styles.hireCheck}><input type="checkbox" checked={showNoShow} onChange={e=>saveVisibility(e.target.checked,showComplete)}/>辞退した人も表示</label>
 {form&&options&&<dialog ref={formDialog} aria-labelledby="hire-form-title" className={styles.panel+" "+styles.hireDialog} onCancel={()=>setForm(null)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setForm(null);}}}>
 <h2 id="hire-form-title">{editing?"入社予定者を修正":"入社予定者を登録"}</h2>
 {message&&<p role="alert">{message}</p>}
 {/* 並び＝東海林さん 2026-10-26：セイ・メイ・性別／姓・名・生年月日／入社日・所属法人・雇用形態／KOT の所属・KOT の雇用区分。選ぶ欄は普通のプルダウン（左ぞろえ） */}
 <div className={styles.hireGridWrap}><div className={styles.hireGrid}>
 {field("last_name_kana","セイ")}{field("first_name_kana","メイ")}{choice("gender","性別",[{value:"male",label:"男性"},{value:"female",label:"女性"}])}
 {field("last_name","姓")}{field("first_name","名")}{field("birthday","生年月日","date")}
 {field("hire_date","入社予定日","date")}{choice("company_id","所属法人",options.companies.map(c=>({value:c.company_id,label:c.company_name})))}{choice("employment_type","雇用形態",EMPLOYMENT_TYPES.map(value=>({value,label:value})))}
 {choice("kot_division_code","KOT の所属",options.divisions.map(c=>({value:c.code,label:c.name})))}{choice("kot_type_code","KOT の雇用区分",options.workingTypes.map(c=>({value:c.code,label:c.name})))}
  </div></div><div className={styles.hireRowActions}><button className={styles.hirePrimary} disabled={busy||!!saving} onClick={()=>run(async()=>{await api(editing?"/"+editing:"",editing?"PATCH":"POST",form);setForm(null);})}>保存する</button><button disabled={busy||!!saving} onClick={()=>setForm(null)}>閉じる</button></div></dialog>}
 {confirmation&&<section role="dialog" aria-modal="true" aria-label="入社の確認" className={styles.panel}>
 <p>{confirmation.last_name} {confirmation.first_name}さんを社員番号 {confirmation.employee_number} で KOT と Garden に登録します。KOT はこの時点から料金の対象になります。</p>
 <button disabled={busy||!!saving} onClick={()=>run(async()=>{const id=confirmation.id;setConfirmation(null);await api("/"+id+"/hire","POST",{});})}>登録する</button><button disabled={busy||!!saving} onClick={()=>setConfirmation(null)}>やめる</button></section>}
 </section>}</>;
}
