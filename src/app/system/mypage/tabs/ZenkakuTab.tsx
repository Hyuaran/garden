"use client";

import { useState } from "react";
import type { GardenCheckIssue, GardenCheckResult } from "../_lib/zenkaku-check";
import { runZenkakuCheck, ZenkakuCheckError } from "../_lib/zenkaku-source";
import styles from "../mypage.module.css";
import { formatPostalDatasetDate, isPostalDatasetStale, type PostalDatasetStatus } from "../_lib/postal-data";

function IssueList({ issues }: { issues: GardenCheckIssue[] }) {
  return <ul className={styles.issueList}>{issues.map((issue, index) => <li key={`${issue.ruleId}-${index}`}>
    <p>{issue.message}</p>{issue.missingFields?.length ? <ul>{issue.missingFields.map((field) => <li key={field}>{field}</li>)}</ul> : null}
  </li>)}</ul>;
}

function WarningList({ issues }: { issues: GardenCheckIssue[] }) {
  const duplicates=issues.filter(issue=>issue.ruleId==="R10"&&issue.duplicate);
  const others=issues.filter(issue=>issue.ruleId!=="R10"||!issue.duplicate);
  return <>{duplicates.length===1?<IssueList issues={duplicates}/>:duplicates.length>1?<div className={styles.duplicateSummary}><p>この営業IDは既に{duplicates.length}件登録されています。別商材の追加契約であれば、そのまま進めてください。</p><ul>{duplicates.map(({duplicate},index)=><li key={`${duplicate!.caseId}-${index}`}>{duplicate!.caseId} ／ {duplicate!.productName} ／ {duplicate!.registeredDate}</li>)}</ul></div>:null}{others.length?<IssueList issues={others}/>:null}</>;
}

const SIMPLE_REQUIRED_RULES = new Set(["R6", "R7", "R8", "R9"]);
type PartnerCandidate = { code:string; label:string };

export default function ZenkakuTab({ runCheck = runZenkakuCheck, postalDataStatus = null, now = new Date() }: { runCheck?: (salesId: string) => Promise<GardenCheckResult>; postalDataStatus?: PostalDatasetStatus | null; now?: Date }) {
  const [salesId, setSalesId] = useState("");
  const [checking, setChecking] = useState(false);
  const [inputError, setInputError] = useState("");
  const [result, setResult] = useState<GardenCheckResult | null>(null);
  const [submitting,setSubmitting]=useState(false); const [submitMessage,setSubmitMessage]=useState("");
  const [partnerChoice,setPartnerChoice]=useState<{submissionId:string;candidates:PartnerCandidate[];selectedCode:string}|null>(null);
  async function pollSubmission(id:string){for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,1000));const response=await fetch(`/api/system/zenkaku-submit/${id}`,{cache:"no-store"});const state=await response.json();if(state.status==="done"){setSubmitMessage(`前確依頼を出しました（案件ID ${state.case_id}）`);return;}if(state.status==="needs_confirmation"){const count=state.candidates?.[0]?.count??result?.duplicateCount??0;if(!window.confirm(`既に${count}件あります。追加で出しますか？`)){setSubmitMessage("前確依頼を取りやめました。");return;}await fetch("/api/system/zenkaku-submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({submissionId:id,confirmDuplicate:true})});continue;}if(state.status==="needs_partner"){setPartnerChoice({submissionId:id,candidates:state.candidates??[],selectedCode:""});return;}if(state.status==="failed"){const mismatch=state.error_code==="dropdown_mismatch"?state.candidates?.map((item:{message?:string})=>item.message).filter(Boolean).join("\n"):"";const messages:Record<string,string>={team_not_registered:"チームが名簿に未登録です。管理者へ連絡してください。",duplicate_pending:"同じ商材の前確待ち案件が既にあります。",dropdown_mismatch:mismatch||"取次側にない選択肢があります。管理者へ連絡してください。"};throw new Error(messages[state.error_code]||"前確依頼を登録できませんでした。時間をおいて、もう一度お試しください。");}}throw new Error("前確依頼の登録に時間がかかっています。時間をおいて状況をご確認ください。");}
  async function continueWithPartner(){if(!partnerChoice?.selectedCode)return;setSubmitting(true);setSubmitMessage("");try{const response=await fetch("/api/system/zenkaku-submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({submissionId:partnerChoice.submissionId,partnerCode:partnerChoice.selectedCode})});if(!response.ok)throw new Error("選んだチームで依頼を続けられませんでした。");const id=partnerChoice.submissionId;setPartnerChoice(null);await pollSubmission(id);}catch(error){setSubmitMessage(error instanceof Error?error.message:"前確依頼を登録できませんでした。");}finally{setSubmitting(false);}}
  async function submit(){if(!result?.requestId)return;setSubmitting(true);setSubmitMessage("");try{const response=await fetch("/api/system/zenkaku-submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({checkRequestId:result.requestId})});const data=await response.json();if(!response.ok||!data.id)throw new Error(data.error||"前確依頼を開始できませんでした。");await pollSubmission(data.id);}catch(error){setSubmitMessage(error instanceof Error?error.message:"前確依頼を登録できませんでした。");}finally{setSubmitting(false);}}
  async function check() {
    const trimmed = salesId.trim();
    if (!trimmed) { setInputError("営業IDを入力してください。"); setResult(null); return; }
    setChecking(true); setInputError(""); setResult(null);
    try {
      setResult(await runCheck(trimmed));
    } catch (error) {
      setInputError(error instanceof ZenkakuCheckError && error.code === "not_found"
        ? "この営業IDは見つかりませんでした。番号をご確認ください。"
        : "社内のシステムに確認できませんでした。時間をおいて、もう一度お試しください。続くときは管理者へ問合せてください。");
    } finally { setChecking(false); }
  }
  const canProceed = result !== null && result.blocking.length === 0;
  const simpleRequired = result?.blocking.filter((issue) => SIMPLE_REQUIRED_RULES.has(issue.ruleId)).flatMap((issue) => issue.missingFields ?? []) ?? [];
  const explainedBlocking = result?.blocking.filter((issue) => !SIMPLE_REQUIRED_RULES.has(issue.ruleId)) ?? [];
  return <section className={styles.zenkakuContent} aria-labelledby="zenkaku-title">
    <div className={styles.card}><h2 id="zenkaku-title">前確依頼</h2><p className={styles.zenkakuLead}>営業IDを入力して、前確依頼に必要な項目を確認します。</p>
      <p className={styles.postalStatus}>郵便番号データ：{formatPostalDatasetDate(postalDataStatus?.sourceDate ?? null)}</p>
      {isPostalDatasetStale(postalDataStatus?.sourceDate ?? null, now) ? <p className={styles.postalWarning}>郵便番号データが古い可能性があります</p> : null}
      <div className={styles.checkForm}><label htmlFor="zenkaku-sales-id">営業ID</label><input id="zenkaku-sales-id" value={salesId} onChange={(event) => setSalesId(event.target.value)} disabled={checking}/>
        <button type="button" onClick={() => void check()} disabled={checking}>{checking ? "チェック中…" : "連携チェック"}</button></div>
      {checking ? <p role="status" className={styles.checking}>社内のシステムに確認しています…</p> : null}
      {inputError ? <p role="alert" className={styles.error}>{inputError}</p> : null}
    </div>
    {result?.blocking.length ? <section className={`${styles.card} ${styles.blockingResult}`} aria-labelledby="blocking-title"><h2 id="blocking-title">修正が必要です</h2><p className={styles.error}>次の項目を確認してください。修正するまで前確依頼へ進めません。</p><IssueList issues={explainedBlocking}/>
      {simpleRequired.length ? <div className={styles.groupedRequired}><p>次の項目を入力してください。</p><ul>{simpleRequired.map((field) => <li key={field}>{field}</li>)}</ul></div> : null}</section> : null}
    {result?.notices.length ? <section className={`${styles.card} ${styles.noticeResult}`} aria-labelledby="notice-title"><h2 id="notice-title">ご確認ください</h2><IssueList issues={result.notices}/></section> : null}
    {result?.warnings.length ? <section className={styles.confirmationBanner} aria-labelledby="warning-title"><div><h2 id="warning-title">警告</h2><WarningList issues={result.warnings}/></div></section> : null}
    {canProceed ? <section className={`${styles.card} ${styles.successResult}`} aria-labelledby="success-title"><h2 id="success-title">確認できました</h2><p>前確依頼に必要な項目が入力されています。</p>{partnerChoice?<div className={styles.partnerChoice}><fieldset><legend>どちらのチームか選んでください</legend>{partnerChoice.candidates.map(candidate=><label key={candidate.code}><input type="radio" name="zenkaku-partner" value={candidate.code} checked={partnerChoice.selectedCode===candidate.code} onChange={()=>setPartnerChoice({...partnerChoice,selectedCode:candidate.code})}/><span>{candidate.label}<small>コード {candidate.code}</small></span></label>)}</fieldset><div className={styles.partnerChoiceActions}><button type="button" onClick={()=>void continueWithPartner()} disabled={!partnerChoice.selectedCode||submitting}>このチームで出す</button><button type="button" className={styles.secondaryButton} onClick={()=>{setPartnerChoice(null);setSubmitMessage("前確依頼を取りやめました。");}}>取りやめる</button></div></div>:<button type="button" onClick={()=>void submit()} disabled={submitting}>{submitting?"前確依頼を送信中…":"前確依頼を出す"}</button>}{submitMessage?<p role="status">{submitMessage}</p>:null}</section> : null}
  </section>;
}
