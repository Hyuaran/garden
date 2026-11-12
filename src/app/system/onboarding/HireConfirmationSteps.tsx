"use client";
import { useStoredView } from "@/lib/ui/useStoredView";
import { ContractTypeFields } from "@/app/root/contracts/_components/ContractTypeFields";
import { contractDefaults, defaultContractType, type EmploymentContractPayload } from "@/app/root/contracts/_lib/employment-contract";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import ChangeConfirm from "@/app/system/_components/ChangeConfirm/ChangeConfirm";
import HireProcessingOverlay from "./HireProcessingOverlay";
import { signatureCount, hireInformationPending, signaturesComplete, lineComplete, type HireCandidate } from "./_lib/hire-candidates";
import layout from "./HireConfirmation.module.css";
import styles from "./onboarding.module.css";
import { initializeContract, japanToday, updateContract } from "./_lib/hire-contract-defaults";
const base="/api/system/onboarding/hire-candidates/";
export default function HireConfirmationSteps({row,canWrite,documents,toggleFilemaker,skip,onRefresh,onReconciled}:{row:HireCandidate;canWrite:boolean;documents:ReactNode;toggleFilemaker:()=>void;skip:()=>void;onRefresh:()=>Promise<unknown>;onReconciled?:()=>Promise<unknown>}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[code,setCode]=useState(""),[sent,setSent]=useState(false),[confirm,setConfirm]=useState(false);
 const [deadline,setDeadline,viewReady]=useStoredView<number|null>("hire-fm:"+row.id,null,raw=>Number(raw)>0?Number(raw):null,value=>value===null?"":String(value));
 const [seconds,setSeconds]=useState(0),[showWait,setShowWait]=useState(false);
 const [result,setResult]=useState<HireCandidate["filemaker_request"]>();
 const [today]=useState(()=>japanToday(new Date()));
 const automaticStart=useRef(true), automaticEnd=useRef(true), automaticConcluded=useRef(true);
 const [contract,setContract]=useState<Partial<EmploymentContractPayload>>(()=>initializeContract(contractDefaults(defaultContractType(row.employment_type??"")),today));
 function changeContract(value:Partial<EmploymentContractPayload>) {setContract(updateContract(automaticStart.current?{...value,contractStart:value.concludedOn||today}:value,today,automaticEnd.current));}
 const [identity,setIdentity]=useState({first_name:row.first_name??"",first_name_kana:row.first_name_kana??"",birthday:row.birthday??"",gender:row.gender??""});
 const [identityNotice,setIdentityNotice]=useState("");
 const [documentNotice,setDocumentNotice]=useState("");
 const checking=useRef(false);
 const skipped=!!row.checklist?.line_skipped?.checked_at&&!!row.checklist.line_skipped.checked_by;
 const displayName=`${(row.employee_number??"").padStart(4,"0")} ${row.last_name}　${row.first_name}`;
 const signed=signaturesComplete(row),lineDone=lineComplete(row),request=result??row.filemaker_request;
 async function call(path:string,body?:unknown) {
  const res=await fetch(base+row.id+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store"});
  const data=await res.json();if(!res.ok)throw new Error(data.error||"処理できませんでした");return data;
 }
 async function run(action:()=>Promise<void>,refresh=true) {setBusy(true);setError("");try{await action();if(refresh)await onRefresh();}catch(e){setError(e instanceof Error?e.message:"処理できませんでした");}finally{setBusy(false);}}
 async function reconcile() { const data=await call("/filemaker");if(data.request)setResult(data.request);await onReconciled?.(); }
 usePolling(async ()=>{
  if(deadline===null)return;
  const tick=async ()=>{
   setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
   if(Date.now()<deadline||checking.current)return;
   checking.current=true;
   await run(reconcile,false).finally(()=>{
    setDeadline(null);setShowWait(false);checking.current=false;try{localStorage.removeItem("hire-fm:"+row.id);}catch{}
   });
  };
  await tick();
 },1000,{enabled:deadline!==null});
 const locked=!canWrite||busy||deadline!==null;
 return <div className={layout.steps} style={{visibility:viewReady?"visible":"hidden"}}>
  {hireInformationPending(row)&&<section><h3>⓪ 名前・生年月日</h3>
   <form onSubmit={e=>{e.preventDefault();void run(async()=>{const res=await fetch(base+row.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({identity})});const data=await res.json();if(!res.ok)throw new Error(data.error||"保存できませんでした");setIdentityNotice(data.warning||"保存しました");});}}>
    <div className={layout.grid}>{([["first_name","名","text"],["first_name_kana","メイ","text"],["birthday","生年月日","date"]] as const).map(([key,label,type])=><label key={key}><span>{label}<span className="garden-required" aria-hidden="true">＊</span></span><input required aria-required="true" type={type} value={identity[key]} disabled={locked} onChange={e=>setIdentity({...identity,[key]:e.target.value})}/></label>)}
    <label><span>性別<span className="garden-required" aria-hidden="true">＊</span></span><select required aria-required="true" value={identity.gender} disabled={locked} onChange={e=>setIdentity({...identity,gender:e.target.value})}><option value="">不明</option><option value="male">男性</option><option value="female">女性</option></select></label></div><button disabled={locked}>保存</button>
   </form></section>}
  {identityNotice&&<p role="status">{identityNotice}</p>}
  <section><header className={layout.sectionHeading}><h3>① 締結</h3><span>{signatureCount(row)}/3</span></header><div className={layout.documents}>{documents}</div>{row.employment_type!=="派遣"&&!row.checklist?.contract_not_required&&<fieldset className={layout.contract} disabled={!canWrite}><legend>雇用契約書の中身</legend><div className={layout.grid}>
   <ContractTypeFields value={contract} onChange={changeContract} renewalSelect/>
   {([['concludedOn','契約日','date'],['contractStart','契約開始日','date'],['contractEnd','契約終了日','date'],['workLocation','就業場所','text']] as const).map(([key,label,type])=><label key={key}>{label}<input type={type} value={contract[key]??""} placeholder="既存の契約書の値を使用" disabled={key==="contractEnd"&&contract.indefinite} onChange={e=>{if(key==="contractStart")automaticStart.current=false;if(key==="contractEnd")automaticEnd.current=false;if(key==="concludedOn")automaticConcluded.current=false;changeContract({...contract,[key]:e.target.value});}}/></label>)}
   </div></fieldset>}
   {documentNotice&&<p role="status">{documentNotice}</p>}
   <button className={layout.primary} disabled={locked||row.employment_type==="派遣"||row.onboarding_status!=="submitted"} onClick={()=>run(async()=>{
    const overrides={...contract};
    if(automaticEnd.current)delete overrides.contractEnd;
    if(automaticStart.current)delete overrides.contractStart;
    if(automaticConcluded.current)delete overrides.concludedOn;
    const data=await call("/documents",{contract:overrides});
    setDocumentNotice(data.note??"");
    for(const file of data.files){const bytes=Uint8Array.from(atob(file.data),(c:string)=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));const a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
   })}>書類の PDF を作る</button>
   {row.onboarding_status!=="submitted"&&<p>本人の入力が提出されると作れます</p>}
  </section>
  <section className={!signed?layout.lockedStep:undefined} aria-disabled={!signed}><header className={layout.sectionHeading}><h3>② LINE テスト送信</h3><div className={layout.headerActions}>
   {skipped?<><span>登録しない</span><button className={layout.textButton} disabled={locked||!signed} onClick={skip}>戻す</button></>:row.line_verified_at?<><span className={layout.done}>{row.line_display_renamed_at?"確認済み・表示名変更済み":"確認済み"}</span>{row.line_display_renamed_at&&!request&&!row.checklist?.filemaker_added&&<button className={layout.textButton} disabled={locked||!signed} onClick={()=>run(async()=>{await call("/line",{action:"renamed_undo"});})}>戻す</button>}</>:<><button disabled={locked||!signed} onClick={skip}>LINE 登録しない</button><button className={layout.primary} disabled={locked||!signed||!row.line_registered} onClick={()=>run(async()=>{await call("/line",{action:"send"});setSent(true);setCode("");})}>テスト送信</button></>}
   </div></header>
   {!signed&&<p>①の締結がそろうと進めます</p>}
   {!skipped&&!row.line_verified_at&&!row.line_registered&&<p>まだ LINE を連携していません（入社手続きの最後のページの QR から登録）</p>}
   {sent&&!skipped&&!row.line_verified_at&&<><p role="status">確認コードを送りました</p><div className={layout.lineActions}>
   <label>確認コード<input aria-label="確認コード" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={locked||!signed||!row.line_registered} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>
   <button className={layout.primary} disabled={locked||!signed||!row.line_registered||code.length!==6} onClick={()=>run(async()=>{await call("/line",{action:"verify",code});setCode("");setSent(false);})}>確認</button></div></>}
   {!skipped&&row.line_verified_at&&!row.line_display_renamed_at&&<div>
    <p>LINE 管理画面で、この方の表示名を変更してください</p>
    <div className={layout.lineActions}><span>変更後の名前： {displayName}</span><button disabled={locked} onClick={()=>run(async()=>{await navigator.clipboard.writeText(displayName);},false)}>名前をコピー</button></div>
    <ol><li><a href="https://manager.line.biz/account/@586gtqpd/chat" target="_blank" rel="noopener noreferrer">LINE 管理画面のチャットを開く（新しいタブ）</a></li><li>この方のチャットを開き、名前の横の鉛筆マークを押す</li><li>上の名前を貼り付けて［保存］を押す</li></ol>
    <button className={layout.primary} disabled={locked||!signed} onClick={()=>run(async()=>{await call("/line",{action:"renamed"});})}>表示名を変更しました</button>
   </div>}
  </section>
  <section className={!signed||!lineDone?layout.lockedStep:undefined} aria-disabled={!signed||!lineDone}><header className={layout.sectionHeading}><h3>③ FileMaker</h3><div className={layout.headerActions}>
   {row.checklist?.filemaker_added?<><span className={layout.done}>追加済み</span><button className={layout.textButton} disabled={locked||!signed||!lineDone} onClick={toggleFilemaker}>戻す</button></>:<><button className={layout.textButton} disabled={locked||!signed||!lineDone} onClick={toggleFilemaker}>手で追加済みにする</button>{request?.status!=="done"&&<button className={layout.primary} disabled={locked||!signed||!lineDone||!!request&&request.status!=="failed"} onClick={()=>setConfirm(true)}>{request?.status==="failed"?"やり直す":"FileMaker に依頼"}</button>}</>}
   </div></header>
   {!signed?<p>①の締結がそろうと進めます</p>:!lineDone&&<p>②の LINE 確認と表示名の変更が済むと進めます</p>}
   {deadline!==null?<><p role="status"><span className={styles.hireSpinner} aria-hidden="true"/>残り {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</p><p>画面を閉じても依頼は止まりません</p></>:request?.status==="done"?<p>FileMaker のアカウントを作りました</p>:request?.status==="failed"?<p className={styles.hireError}>作成できませんでした。下の理由を確認して、やり直してください</p>:request&&<p>まだ作成中です。数分後にもう一度確かめてください</p>}
   {request&&<ul>{Object.entries(request.files).map(([key,file])=><li key={key} className={file.status==="failed"?styles.hireError:undefined}>{({eigyo:"【新】営業",shain:"社員情報",call:"コール履歴",roster:"社員情報の名簿"} as Record<string,string>)[key]}：{file.status==="done"?"作成済み":file.status==="failed"?(file.error||"作成できませんでした"):"作成中"}</li>)}</ul>}
   {request&&request.status!=="done"&&<button disabled={locked||deadline!==null} onClick={()=>run(reconcile,false)}>確かめる</button>}
  </section>
  {error&&<p role="alert" className={styles.hireError}>{error}</p>}
  <HireProcessingOverlay open={busy||showWait&&deadline!==null} title={deadline!==null?`FileMaker に依頼しています… 残り ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`:"1件を処理しています…"} onClose={deadline!==null?()=>setShowWait(false):undefined}/>
  {confirm&&<ChangeConfirm title="FileMaker に依頼" beforeLabel="現在" before="未作成" afterLabel="依頼後" after="FileMaker のアカウントを作成" question="依頼しますか？" onClose={()=>setConfirm(false)} actions={<><button onClick={()=>setConfirm(false)}>やめる</button><button disabled={locked} onClick={()=>{setConfirm(false);void run(async()=>{await call("/filemaker",{});setResult(undefined);const until=Date.now()+120_000;setDeadline(until);setSeconds(120);setShowWait(true);try{localStorage.setItem("hire-fm:"+row.id,String(until));}catch{}});}}>依頼する</button></>}/>}
 </div>;
}
