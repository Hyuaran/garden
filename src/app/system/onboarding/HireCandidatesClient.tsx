"use client";
import { useState, useEffect, useRef } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import Modal from "@/app/system/_components/Modal/Modal";
import layout from "./HireConfirmation.module.css";
import HireConfirmationSteps from "./HireConfirmationSteps";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { EMPLOYMENT_TYPES, signaturesComplete, lineComplete, checklistComplete, checklistPriority, type ChecklistKey, type HireCandidate, type HireInput } from "./_lib/hire-candidates";
import styles from "./onboarding.module.css";
const base = "/api/system/hire-candidates";
async function api(path = "", method = "GET", body?: unknown) {
 const res = await fetch(base+path,{method,headers:body ? {"Content-Type":"application/json"}:undefined,body:body ? JSON.stringify(body):undefined,cache:"no-store"});
 const data = await res.json(); if (!res.ok) throw new Error(data.error || "処理できませんでした"); return data;
}
type Options = {companies:{company_id:string;company_name:string}[];divisions:{code:string;name:string}[];workingTypes:{code:string;name:string}[]};
const steps = [["number","社員番号を決める"],["kot","KING OF TIME に登録"],["roster","Kintone 名簿に登録"],["garden","Garden に反映"]];
const stopped = (r:HireCandidate)=>steps.find(([key])=>key!=="filemaker"&&!!r.steps[key]?.error);
export default function HireCandidatesClient({userId,tab,canWrite = true}:{userId:string;tab:"candidates"|"confirmations";canWrite?:boolean}) {
 const [reviewId,setReviewId]=useState<string|null>(null);
 const [showNoShow,setShowNoShow]=useState(false), [showComplete,setShowComplete]=useState(false);
 const [resultRows,setResultRows]=useState<string[]>([]);
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
 const [rows,setRows]=useState<HireCandidate[]>([]), [message,setMessage]=useState(""), [busy,setBusy]=useState(false);
 const [options,setOptions]=useState<Options|null>(null), [form,setForm]=useState<HireInput|null>(null), [editing,setEditing]=useState<string|null>(null), [confirmation,setConfirmation]=useState<HireCandidate|null>(null);
 const formDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!form || !options)return;
  const dialog=formDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  return()=>{dialog?.close();previous?.focus();};
 },[!!form,!!options]);
 // 入社の確認も画面の真ん中のモーダルに（一覧の下に出ると人数が多いとき見えないため 2026-10-26）
 const confirmDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!confirmation)return;
  const dialog=confirmDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  return()=>{dialog?.close();previous?.focus();};
 },[!!confirmation]);
 const [failure,setFailure]=useState<HireCandidate|null>(null);
 const failureDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!failure)return;
  const dialog=failureDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  return()=>{dialog?.close();previous?.focus();};
 },[!!failure]);
 const [success,setSuccess]=useState<HireCandidate|null>(null);
 const successDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!success)return;
  const dialog=successDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  const timer=setTimeout(()=>setSuccess(null),3000);
  return()=>{clearTimeout(timer);dialog?.close();previous?.focus();};
 },[success]);
 const [lineSkip,setLineSkip]=useState<HireCandidate|null>(null);
 const lineSkipDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!lineSkip)return;
  const dialog=lineSkipDialog.current;
  const previous=document.activeElement as HTMLElement|null;
  dialog?.showModal();
  return()=>{dialog?.close();previous?.focus();};
 },[!!lineSkip]);
 const [saving,setSaving]=useState<string|null>(null);
 const load = async () => { const data = await api("?tab="+tab); setRows(data); return data as HireCandidate[]; };
 const register=async(id:string)=>{
  setFailure(null);setSuccess(null);
  const updated:HireCandidate=await api("/"+id+"/hire","POST",{});
  if(updated.status==="hired"){setSuccess(updated);return;}
  const refreshed=await load();
  const current=refreshed.find(r=>r.id===id) ?? updated;
  if(stopped(current))setFailure(current);
 };
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[tab]);
 usePolling(load,1200,{enabled:busy,immediate:false});
 const run = async (action:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await action();await load();}catch(e){setMessage(e instanceof Error?e.message:"処理できませんでした");}finally{setBusy(false);}};
 // KOT の選択肢は画面を開いた時に先に読んでおく（行を押してから小窓が出るまで 5 秒かかったため 2026-10-26）
 const optionsRequest=useRef<Promise<Options>|null>(null);
 const loadOptions=()=>optionsRequest.current ??= api("/kot-options").then((o:Options)=>{setOptions(o);return o;}).catch((e:unknown)=>{optionsRequest.current=null;throw e;});
 useEffect(()=>{if(canWrite)loadOptions().catch(()=>{});},[canWrite]);
 const openForm = (row?:HireCandidate)=>{setMessage("");setEditing(row?.id ?? null);setForm(row ?? {last_name:"",first_name:"",last_name_kana:"",first_name_kana:"",birthday:"",hire_date:"",gender:"male",employment_type:"アルバイト",company_id:"",kot_division_code:"104",kot_type_code:""});if(!options)loadOptions().catch(e=>setMessage(e instanceof Error?e.message:"選択肢を読み込めませんでした"));};
 const set=(key:keyof HireInput,value:string)=>setForm(old=>old?{...old,[key]:value}:null);
 const field=(key:keyof HireInput,label:string,type="text")=><label key={key}>{label}<input required type={type} value={form?.[key] ?? ""} onChange={e=>set(key,e.target.value)}/></label>;
 const choice=(key:keyof HireInput,label:string,opts:{value:string;label:string}[])=><label key={key}>{label}<select required value={form?.[key] ?? ""} onChange={e=>set(key,e.target.value)}><option value="" disabled>選んでください</option>{opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
 const status=(r:HireCandidate)=>{
  const failed=stopped(r)?.[0];
  if(failed)return ({number:"番号",kot:"KING OF TIME ",roster:"名簿",garden:"Garden 反映"}[failed] ?? "登録")+"で止まっています";
  return r.status==="hired"?"入社済み（"+r.employee_number+"）":r.status==="no_show"?"辞退":r.status==="hiring"?"処理中":"入社予定";
 };
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
 const check = (r:HireCandidate,key:ChecklistKey,label:string) => <label key={key} className={styles.hireCheck}><input type="checkbox" aria-label={`${r.last_name} ${r.first_name} ${key.startsWith("contract")?"雇用契約書":key.startsWith("nda")?"秘密保持":key.startsWith("emergency")?"緊急連絡先":"FileMaker"} ${label}`} checked={!!r.checklist?.[key]} disabled={!canWrite||busy||!!saving||(key==="filemaker_added"&&(!signaturesComplete(r)||!lineComplete(r)))} onChange={e=>toggleChecklist(r,key,e.target.checked)}/>{label}</label>;
 const columns:DataColumn<HireCandidate>[]=[
 {id:"date",label:"入社予定日",type:"date",value:r=>r.hire_date},
 {id:"name",label:"氏名",type:"text",value:r=>r.last_name+" "+r.first_name},
 {id:"employment",label:"雇用形態",type:"text",value:r=>r.employment_type},
 {id:"status",label:"状態", align: "mark",type:"text",value:r=>status(r)+(checklistComplete(r)?" 完了":""),render:r=><span className={stopped(r)?styles.hireError:undefined}>{status(r)}</span>},
 {id:"actions",label:"操作", align: "mark",type:"text",value:()=>"",wrap:true,render:r=><div className={styles.hireRowActions}>
 {r.status==="planned"&&<button className={styles.hireDecline} disabled={!canWrite||busy||!!saving} onClick={()=>run(async()=>{await api("/"+r.id,"PATCH",{status:"no_show"});})}>辞退</button>}
 {r.status==="planned"&&<button className={styles.hirePrimary} disabled={!canWrite||busy||!!saving} onClick={()=>run(async()=>{const updated=await api("/"+r.id+"/hire","POST",{prepare:true});if(stopped(updated)){await load();setFailure(updated);return;}if(!updated.employee_number)throw new Error("社員番号を決められませんでした");setConfirmation(updated);})}>入社</button>}
 {r.status==="hiring"&&(stopped(r)?<button className={styles.hirePrimary} disabled={!canWrite||busy||!!saving} onClick={()=>run(()=>register(r.id))}>続きから</button>:<span>処理中</span>)}
 </div>}
 ];
 const confirmationColumns:DataColumn<HireCandidate>[]=[
 {id:"name",label:"氏名",type:"text",value:r=>r.last_name+" "+r.first_name,wrap:true,render:r=><div><span>{r.last_name} {r.first_name}</span><p>{r.employee_number}・{r.hire_date} 入社</p>{checklistComplete(r)&&<span>完了</span>}</div>},
 {id:"complete",label:"①締結",align:"mark",type:"number",value:checklistPriority,render:r=><span className={signaturesComplete(r)?layout.done:layout.pending}>{[r.checklist?.contract_signed,r.checklist?.nda_signed,r.checklist?.emergency_signed].filter(Boolean).length}/3</span>},
 {id:"line",label:"②LINE",align:"mark",type:"text",value:r=>r.line_verified_at?"確認済み":r.checklist?.line_skipped?"登録しない":"未",render:r=><span className={lineComplete(r)?layout.done:layout.pending}>{r.line_verified_at?"確認済み":r.checklist?.line_skipped?"登録しない":"未"}</span>},
 {id:"filemaker",label:"③FileMaker",align:"mark",type:"text",value:r=>r.checklist?.filemaker_added?"追加済み":"未",render:r=><span className={r.checklist?.filemaker_added?layout.done:layout.pending}>{r.checklist?.filemaker_added?"追加済み":"未"}</span>},
 {id:"review",label:"操作",align:"mark",type:"text",value:()=>"",render:r=><button className={layout.reviewButton} onClick={()=>setReviewId(r.id)}>確認する</button>}
 ];
 const reviewRow=rows.find(r=>r.id===reviewId);
 const candidateRows=rows.filter(r=>r.status==="planned"||r.status==="hiring"||(showNoShow&&r.status==="no_show"));
 const confirmationRows=rows.filter(r=>r.status==="hired"&&(showComplete||resultRows.includes(r.id)||!checklistComplete(r)));
 return <>
 {tab==="confirmations"&&<section className={styles.hireCandidates} {...CLARITY_MASK}>
 {reviewRow&&<Modal title={`${reviewRow.last_name} ${reviewRow.first_name} さんの入社後の確認`} className={layout.dialog} onClose={()=>setReviewId(null)} actions={<button onClick={()=>setReviewId(null)} data-modal-action="secondary">閉じる</button>}>
 {((r:HireCandidate)=><HireConfirmationSteps row={r} canWrite={canWrite&&!busy&&!saving} onRefresh={load} onReconciled={async()=>{setResultRows(old=>old.includes(r.id)?old:[...old,r.id]);await load();}} toggleFilemaker={()=>void toggleChecklist(r,"filemaker_added",!r.checklist?.filemaker_added)} skip={()=>r.checklist?.line_skipped?void toggleChecklist(r,"line_skipped",false):setLineSkip(r)} documents={<>{([["contract","雇用契約書"],["nda","秘密保持誓約書"],["emergency","緊急連絡先"]] as const).map(([key,label])=><div key={key} className={styles.hireMfRow}><span>{label}</span>{check(r,`${key}_sent`,"送った")}{check(r,`${key}_signed`,"締結済み")}</div>)}</>}/>)(reviewRow)}
 </Modal>}
 {lineSkip&&<dialog ref={lineSkipDialog} aria-labelledby="hire-line-skip-title" className={styles.panel+" "+styles.hireDialog+" "+styles.hireConfirmDialog} onCancel={()=>setLineSkip(null)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setLineSkip(null);}}} data-garden-modal="panel" data-size="sm">
 <h2 id="hire-line-skip-title">公式 LINE を登録しない</h2>
 <p>{lineSkip.last_name} {lineSkip.first_name}さん：ガラケーなどで登録できないため、公式 LINE を登録しない扱いにします</p>
 <div className={styles.hireRowActions} data-modal-actions><button onClick={()=>setLineSkip(null)} data-modal-action="secondary">やめる</button>
<button disabled={!canWrite||busy||!!saving} onClick={()=>{const row=lineSkip;setLineSkip(null);void toggleChecklist(row,"line_skipped",true);}} data-modal-action="primary">登録しない</button></div>
 </dialog>}
 {message&&<p role="alert">{message}</p>}
 <DataTable onRowClick={r=>setReviewId(r.id)} rowClickable={()=>true} key="confirmations" rows={confirmationRows} columns={confirmationColumns} rowKey={r=>r.id} searchPlaceholder="氏名・カナで探す" searchText={r=>[r.last_name+r.first_name,r.last_name+" "+r.first_name,(r.last_name_kana??"")+(r.first_name_kana??""),r.last_name_kana+" "+r.first_name_kana,r.employee_number].join(" ")} defaultSort={{id:"complete",direction:"asc"}}/>
 <label className={styles.hireCheck}><input type="checkbox" checked={showComplete} onChange={e=>saveVisibility(showNoShow,e.target.checked)}/>完了も表示</label>
 </section>}
 {tab==="candidates"&&<section className={styles.hireCandidates} {...CLARITY_MASK}>
 {message&&<p role="alert">{message}</p>}
 <DataTable key="candidates" onRowClick={r=>{if(busy||saving)return;if(r.status==="hiring"&&stopped(r))setFailure(r);else if(canWrite&&r.status==="planned")openForm(r);}} rowClickable={r=>(canWrite&&r.status==="planned")||(r.status==="hiring"&&!!stopped(r))} rows={candidateRows} columns={columns} rowKey={r=>r.id} searchPlaceholder="氏名・カナで探す" searchText={r=>[r.last_name+r.first_name,r.last_name+" "+r.first_name,(r.last_name_kana??"")+(r.first_name_kana??""),r.last_name_kana+" "+r.first_name_kana,r.employee_number].join(" ")} defaultSort={{id:"date",direction:"asc"}} toolbar={canWrite && <button disabled={!canWrite||busy||!!saving} onClick={()=>openForm()}>＋ 入社予定者を登録</button>}/>
 <label className={styles.hireCheck}><input type="checkbox" checked={showNoShow} onChange={e=>saveVisibility(e.target.checked,showComplete)}/>辞退した人も表示</label>
 {form&&options&&<dialog ref={formDialog} aria-labelledby="hire-form-title" className={styles.panel+" "+styles.hireDialog} onCancel={()=>setForm(null)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setForm(null);}}} data-garden-modal="panel">
 <h2 id="hire-form-title">{editing?"入社予定者を修正":"入社予定者を登録"}</h2>
 {message&&<p role="alert">{message}</p>}
 {/* 並び＝東海林さん 2026-10-26：セイ・メイ・性別／姓・名・生年月日／入社日・所属法人・雇用形態／KOT の所属・KOT の雇用区分。選ぶ欄は普通のプルダウン（左ぞろえ） */}
 <div className={styles.hireGridWrap}><div className={styles.hireGrid}>
 {field("last_name_kana","セイ")}{field("first_name_kana","メイ")}{choice("gender","性別",[{value:"male",label:"男性"},{value:"female",label:"女性"}])}
 {field("last_name","姓")}{field("first_name","名")}{field("birthday","生年月日","date")}
 {field("hire_date","入社予定日","date")}{choice("company_id","所属法人",options.companies.map(c=>({value:c.company_id,label:c.company_name})))}{choice("employment_type","雇用形態",EMPLOYMENT_TYPES.map(value=>({value,label:value})))}
 {choice("kot_division_code","KING OF TIME の所属",options.divisions.map(c=>({value:c.code,label:c.name})))}{choice("kot_type_code","KING OF TIME の雇用区分",options.workingTypes.map(c=>({value:c.code,label:c.name})))}
  </div></div><div className={styles.hireRowActions} data-modal-actions><button disabled={!canWrite||busy||!!saving} onClick={()=>setForm(null)} data-modal-action="secondary">閉じる</button>
<button className={styles.hirePrimary} disabled={!canWrite||busy||!!saving} onClick={()=>run(async()=>{await api(editing?"/"+editing:"",editing?"PATCH":"POST",form);setForm(null);})} data-modal-action="primary">保存する</button></div></dialog>}
 {success&&<dialog ref={successDialog} aria-labelledby="hire-success-title" className={styles.panel+" "+styles.hireDialog+" "+styles.hireConfirmDialog} onCancel={()=>setSuccess(null)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setSuccess(null);}}} data-garden-modal="panel" data-size="sm">
 <h2 id="hire-success-title">入社の登録が完了しました</h2>
 <p role="status">◎ {success.last_name} {success.first_name}さん（社員番号 {success.employee_number}）</p>
 <ol aria-label="入社の進み具合" className={styles.hireSteps}>{steps.map(([key,label])=><li key={key} className={success.steps[key]?.error?styles.hireError:styles.hireStepDone}><span className={styles.hireStepMark} aria-hidden="true">{success.steps[key]?.error?"✕":"◎"}</span>{label}{success.steps[key]?.error&&<p>{success.steps[key].error}</p>}</li>)}</ol>
 <p>次は「入社後の確認」タブで、契約書・LINE などを確認してください。</p>
 <div className={styles.hireRowActions} data-modal-actions><button onClick={()=>setSuccess(null)} data-modal-action="secondary">閉じる</button></div>
 </dialog>}
 {failure&&<dialog ref={failureDialog} aria-labelledby="hire-stop-title" className={styles.panel+" "+styles.hireDialog} onCancel={()=>setFailure(null)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setFailure(null);}}} data-garden-modal="panel">
 <h2 id="hire-stop-title">入社の登録が途中で止まりました</h2>
 <p>{failure.last_name} {failure.first_name}</p>
 <ol aria-label="入社の進み具合" className={styles.hireSteps}>{steps.map(([key,label])=><li key={key} className={failure.steps[key]?.error?styles.hireError:failure.steps[key]?.done?styles.hireStepDone:styles.hint}>
 <span className={styles.hireStepMark} aria-hidden="true">{failure.steps[key]?.done?"◎":"✕"}</span>{label}{key==="number"&&failure.employee_number&&"（"+failure.employee_number+"）"}
 {failure.steps[key]?.error&&<p role="status">{failure.steps[key].error}</p>}
 </li>)}</ol>
 <div className={styles.hireRowActions} data-modal-actions><button onClick={()=>setFailure(null)} data-modal-action="secondary">閉じる</button><button className={styles.hirePrimary} disabled={!canWrite||busy||!!saving} onClick={()=>run(()=>register(failure.id))} data-modal-action="primary">続きから</button></div>
 </dialog>}
 {confirmation&&<dialog ref={confirmDialog} aria-label="入社の確認" className={styles.panel+" "+styles.hireDialog+" "+styles.hireConfirmDialog} onCancel={()=>setConfirmation(null)} onClick={event=>{if(event.target===event.currentTarget)setConfirmation(null);}} data-garden-modal="panel" data-size="sm">
 <h2>入社の確認</h2>
 <p>{confirmation.last_name} {confirmation.first_name}さんを社員番号 {confirmation.employee_number} で KING OF TIME と Garden に登録します。KING OF TIME はこの時点から料金の対象になります。</p>
 <div className={styles.hireRowActions} data-modal-actions><button disabled={!canWrite||busy||!!saving} onClick={()=>setConfirmation(null)} data-modal-action="secondary">やめる</button>
<button className={styles.hirePrimary} disabled={!canWrite||busy||!!saving} onClick={()=>run(async()=>{const id=confirmation.id;setConfirmation(null);await register(id);})} data-modal-action="primary">登録する</button></div></dialog>}
 </section>}</>;
}
